"""API router for schedule/session and availability operations"""

import json
import secrets
import uuid
from collections import defaultdict
from datetime import date as date_type, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..config import get_settings
from ..logging_config import get_logger
from ..dependencies import get_current_user
from ..services.discord_webhook import (
    PlayerDetail,
    SessionAnnouncementData,
    build_cancelled_payload,
    build_session_announcement_payload,
    build_test_reminder_payload,
    compute_announcement_hash,
    compute_rsvp_hash,
    _next_occurrence_iso,
    _recurrence_rule_to_text,
)
from ..exceptions import ValidationError
from ..models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User
from ..models.availability import AvailabilityTemplate, UserAvailability
from ..models.schedule import DiscordMessageMapping, ScheduleRsvp, ScheduleSession, ScheduleSettings
from ..permissions import (
    NotFound,
    PermissionDenied,
    get_static_group,
    require_can_manage_members,
    require_membership,
)
from ..schemas.schedule import (
    AvailabilityDateSummary,
    AvailabilitySubmit,
    InitialRsvpStatusEnum,
    RsvpCreate,
    RsvpResponse,
    RsvpStatusEnum,
    CalendarTokenResponse,
    ScheduleSessionCreate,
    ScheduleSessionResponse,
    ScheduleSettingsResponse,
    ScheduleSettingsUpdate,
    ScheduleSessionUpdate,
    AvailabilityTemplateDaySummary,
    AvailabilityTemplateResponse,
    AvailabilityTemplateSubmit,
    TestReminderResponse,
    UserAvailabilityResponse,
    VALID_DAYS,
)

router = APIRouter(prefix="/api", tags=["schedule"])
settings = get_settings()
logger = get_logger(__name__)

# Upper bound on how many days of availability can be requested in one call.
# The grid only renders a week at a time, so this leaves generous headroom
# while preventing an unbounded date range from producing a huge response.
MAX_AVAILABILITY_RANGE_DAYS = 62


def _mask_webhook_url(webhook_url: str | None) -> str | None:
    if not webhook_url:
        return None
    return f"{webhook_url[:32]}...{webhook_url[-8:]}" if len(webhook_url) > 48 else "Configured"


async def _get_member_count(db: AsyncSession, group_id: str) -> int:
    """Return the count of non-viewer members in a static group."""
    result = await db.execute(
        select(Membership.id).where(
            Membership.static_group_id == group_id,
            Membership.role != MemberRole.VIEWER.value,
        )
    )
    return len(result.scalars().all())


async def _get_player_map(db: AsyncSession, group_id: str) -> dict[str, SnapshotPlayer]:
    """Map user_id → SnapshotPlayer for the group's active tier.

    Returns an empty dict if no active tier exists or no players are linked.
    """
    tier_result = await db.execute(
        select(TierSnapshot.id).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.is_active.is_(True),
        )
    )
    tier_id = tier_result.scalar_one_or_none()
    if not tier_id:
        return {}

    player_result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.tier_snapshot_id == tier_id,
            SnapshotPlayer.user_id.isnot(None),
        )
    )
    return {p.user_id: p for p in player_result.scalars().all()}


def _build_announcement_data(
    sched_session: ScheduleSession,
    static_group: StaticGroup,
    member_count: int,
    rsvps: list[ScheduleRsvp] | None = None,
    player_map: dict[str, SnapshotPlayer] | None = None,
) -> SessionAnnouncementData:
    """Assemble a SessionAnnouncementData from ORM objects.

    Computes RSVP counts from the session's loaded rsvps relationship (or
    the passed-in ``rsvps`` list when the relationship isn't loaded yet),
    resolves the next upcoming occurrence for recurring sessions, and
    converts the recurrence rule to human-readable text.

    ``player_map`` maps user_id → SnapshotPlayer from the active tier,
    used to populate cannot-make-it and tentative named lists.
    """
    rsvp_list = rsvps if rsvps is not None else list(sched_session.rsvps)
    rsvp_counts: dict[str, int] = {}
    for rsvp in rsvp_list:
        rsvp_counts[rsvp.status] = rsvp_counts.get(rsvp.status, 0) + 1

    pm = player_map or {}
    unavailable_players: list[PlayerDetail] = []
    tentative_players: list[PlayerDetail] = []
    for rsvp in rsvp_list:
        sp = pm.get(rsvp.user_id)
        detail = PlayerDetail(
            name=sp.name if sp else (rsvp.user.discord_username if rsvp.user else "Unknown"),
            position=sp.position if sp else None,
            job=sp.job if sp and sp.job else None,
        )
        if rsvp.status == "unavailable":
            unavailable_players.append(detail)
        elif rsvp.status == "tentative":
            tentative_players.append(detail)

    start_iso = _next_occurrence_iso(sched_session.start_time, sched_session.recurrence_rule)
    try:
        from datetime import datetime as _dt
        orig_start = _dt.fromisoformat(sched_session.start_time.replace("Z", "+00:00"))
        orig_end = _dt.fromisoformat(sched_session.end_time.replace("Z", "+00:00"))
        resolved_start = _dt.fromisoformat(start_iso.replace("Z", "+00:00"))
        end_iso = (orig_end + (resolved_start - orig_start)).isoformat()
    except (ValueError, TypeError):
        end_iso = sched_session.end_time

    session_url = (
        f"{settings.frontend_url}/group/{static_group.share_code}?tab=schedule"
    )

    return SessionAnnouncementData(
        session_title=sched_session.title,
        start_iso=start_iso,
        end_iso=end_iso,
        static_group_name=static_group.name,
        session_url=session_url,
        rsvp_counts=rsvp_counts,
        total_member_count=member_count,
        session_description=sched_session.description,
        recurrence_summary=_recurrence_rule_to_text(sched_session.recurrence_rule),
        unavailable_players=unavailable_players,
        tentative_players=tentative_players,
    )


async def _try_fire_webhook(
    webhook_url: str,
    payload: dict,
) -> None:
    """POST a Discord webhook payload — fire-and-forget, never raises.

    Errors are logged at WARNING level but never propagate. The webhook
    URL is masked in all log messages so the token is never exposed.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json=payload)
        if resp.status_code >= 400:
            logger.warning(
                "discord_webhook_rejected",
                status=resp.status_code,
                webhook=_mask_webhook_url(webhook_url),
            )
    except Exception as exc:
        logger.warning(
            "discord_webhook_error",
            error=str(exc),
            webhook=_mask_webhook_url(webhook_url),
        )


async def _post_or_edit_webhook(
    db: AsyncSession,
    webhook_url: str,
    payload: dict,
    session_id: str,
    group_id: str,
    content_hash: str,
) -> None:
    """Post a new Discord message or edit the existing one for this session.

    On first call (no mapping): POST with ?wait=true, store message ID.
    On subsequent calls: skip if hash unchanged, else PATCH existing message.
    On PATCH 404 (message deleted): POST replacement, update mapping.
    Never raises — all errors are logged with masked webhook URL.
    """
    try:
        result = await db.execute(
            select(DiscordMessageMapping).where(
                DiscordMessageMapping.session_id == session_id,
                DiscordMessageMapping.occurrence_start_time.is_(None),
            )
        )
        mapping = result.scalar_one_or_none()
        now = datetime.now(timezone.utc).isoformat()

        if mapping and mapping.last_rsvp_hash == content_hash:
            return

        async with httpx.AsyncClient(timeout=5.0) as client:
            if mapping:
                edit_url = f"{webhook_url}/messages/{mapping.webhook_message_id}"
                resp = await client.patch(edit_url, json=payload)

                if resp.status_code == 404:
                    resp = await client.post(f"{webhook_url}?wait=true", json=payload)
                    if resp.status_code == 200:
                        msg_data = resp.json()
                        mapping.webhook_message_id = msg_data["id"]
                        mapping.last_posted_at = now
                        mapping.last_rsvp_hash = content_hash
                        mapping.updated_at = now
                        await db.flush()
                        await db.commit()
                    elif resp.status_code >= 400:
                        logger.warning(
                            "discord_webhook_replacement_rejected",
                            status=resp.status_code,
                            webhook=_mask_webhook_url(webhook_url),
                        )
                    return

                if resp.status_code >= 400:
                    logger.warning(
                        "discord_webhook_edit_rejected",
                        status=resp.status_code,
                        webhook=_mask_webhook_url(webhook_url),
                    )
                    return

                mapping.last_edited_at = now
                mapping.last_rsvp_hash = content_hash
                mapping.updated_at = now
                await db.flush()
                await db.commit()
            else:
                resp = await client.post(f"{webhook_url}?wait=true", json=payload)
                if resp.status_code == 200:
                    msg_data = resp.json()
                    new_mapping = DiscordMessageMapping(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        static_group_id=group_id,
                        occurrence_start_time=None,
                        webhook_message_id=msg_data["id"],
                        last_posted_at=now,
                        last_rsvp_hash=content_hash,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(new_mapping)
                    await db.flush()
                    await db.commit()
                elif resp.status_code >= 400:
                    logger.warning(
                        "discord_webhook_rejected",
                        status=resp.status_code,
                        webhook=_mask_webhook_url(webhook_url),
                    )
    except Exception as exc:
        logger.warning(
            "discord_webhook_error",
            error=str(exc),
            webhook=_mask_webhook_url(webhook_url),
        )


def _calendar_url(token: str | None) -> str | None:
    if not token:
        return None
    return f"{settings.backend_url}/api/calendar/{token}.ics"


def _settings_response(
    row: ScheduleSettings | None,
    group_id: str,
    can_manage: bool,
) -> ScheduleSettingsResponse:
    return ScheduleSettingsResponse(
        id=row.id if row else None,
        static_group_id=group_id,
        webhook_configured=bool(row and row.webhook_url),
        webhook_url_masked=_mask_webhook_url(row.webhook_url) if row and can_manage else None,
        reminder_channel_label=row.reminder_channel_label if row and can_manage else None,
        enable_24h_reminder=bool(row and row.enable_24h_reminder) if can_manage else False,
        enable_1h_reminder=bool(row and row.enable_1h_reminder) if can_manage else False,
        enable_missing_rsvp_reminder=bool(row and row.enable_missing_rsvp_reminder) if can_manage else False,
        calendar_enabled=bool(row and row.calendar_enabled),
        calendar_url=_calendar_url(row.calendar_token) if row and row.calendar_enabled else None,
        calendar_token_created_at=row.calendar_token_created_at if row else None,
        can_manage=can_manage,
        created_at=row.created_at if row else None,
        updated_at=row.updated_at if row else None,
    )


async def _get_schedule_settings(session: AsyncSession, group_id: str) -> ScheduleSettings | None:
    try:
        result = await session.execute(
            select(ScheduleSettings).where(ScheduleSettings.static_group_id == group_id)
        )
        return result.scalar_one_or_none()
    except SQLAlchemyError:
        raise ValidationError(
            "Scheduler integrations storage is not available. "
            "Ask the site maintainer to apply the schedule_settings migration."
        )


async def _get_or_create_schedule_settings(session: AsyncSession, group_id: str) -> ScheduleSettings:
    row = await _get_schedule_settings(session, group_id)
    if row:
        return row

    now = datetime.now(timezone.utc).isoformat()
    row = ScheduleSettings(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    try:
        await session.flush()
    except SQLAlchemyError:
        await session.rollback()
        raise ValidationError(
            "Scheduler integrations storage is not available. "
            "Ask the site maintainer to apply the schedule_settings migration."
        )
    return row


def _escape_ical_text(value: str | None) -> str:
    if not value:
        return ""
    return (
        value
        .replace("\\", "\\\\")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


async def _create_initial_rsvps(
    session: AsyncSession,
    schedule_session: ScheduleSession,
    initial_status: InitialRsvpStatusEnum | None,
    updated_at: str,
) -> None:
    """Seed RSVP rows for current non-viewer static members when requested."""
    if initial_status is None or initial_status in {
        InitialRsvpStatusEnum.NONE,
        InitialRsvpStatusEnum.NO_RESPONSE,
    }:
        return

    member_result = await session.execute(
        select(Membership.user_id).where(
            Membership.static_group_id == schedule_session.static_group_id,
            Membership.role != MemberRole.VIEWER.value,
        )
    )
    user_ids = sorted(set(member_result.scalars().all()))
    for user_id in user_ids:
        session.add(
            ScheduleRsvp(
                id=str(uuid.uuid4()),
                session_id=schedule_session.id,
                user_id=user_id,
                status=initial_status.value,
                updated_at=updated_at,
            )
        )


def set_no_store_cache_headers(response: Response) -> None:
    """Prevent browsers from reusing stale authenticated schedule data."""
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def session_to_response(session: ScheduleSession) -> ScheduleSessionResponse:
    """Convert ScheduleSession model to response schema."""
    rsvps = []
    for rsvp in session.rsvps:
        username = None
        if rsvp.user:
            username = rsvp.user.discord_username
        rsvps.append(
            RsvpResponse(
                id=rsvp.id,
                session_id=rsvp.session_id,
                user_id=rsvp.user_id,
                username=username,
                status=RsvpStatusEnum(rsvp.status),
                note=rsvp.note,
                updated_at=rsvp.updated_at,
            )
        )

    return ScheduleSessionResponse(
        id=session.id,
        static_group_id=session.static_group_id,
        created_by_id=session.created_by_id,
        title=session.title,
        description=session.description,
        start_time=session.start_time,
        end_time=session.end_time,
        timezone=session.timezone,
        is_recurring=session.is_recurring,
        recurrence_rule=session.recurrence_rule,
        category=getattr(session, 'category', None),
        content_id=getattr(session, 'content_id', None),
        content_name=getattr(session, 'content_name', None),
        created_at=session.created_at,
        updated_at=session.updated_at,
        rsvps=rsvps,
    )


@router.get(
    "/static-groups/{group_id}/schedule",
    response_model=list[ScheduleSessionResponse],
)
async def list_schedule_sessions(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ScheduleSessionResponse]:
    """List all schedule sessions for a static group."""
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    result = await session.execute(
        select(ScheduleSession)
        .where(ScheduleSession.static_group_id == group_id)
        .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
        .order_by(ScheduleSession.start_time.asc())
    )
    sessions = result.scalars().all()

    return [session_to_response(s) for s in sessions]


@router.post(
    "/static-groups/{group_id}/schedule",
    response_model=ScheduleSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_schedule_session(
    group_id: str,
    data: ScheduleSessionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ScheduleSessionResponse:
    """Create a new schedule session (lead or owner only)."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    now = datetime.now(timezone.utc).isoformat()

    schedule_session = ScheduleSession(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        title=data.title,
        description=data.description,
        start_time=data.start_time,
        end_time=data.end_time,
        timezone=data.timezone,
        is_recurring=data.is_recurring,
        recurrence_rule=data.recurrence_rule,
        category=data.category.value if data.category else None,
        content_id=data.content_id,
        content_name=data.content_name,
        created_at=now,
        updated_at=now,
    )
    session.add(schedule_session)
    await session.flush()
    await _create_initial_rsvps(session, schedule_session, data.initial_rsvp_status, now)
    await session.flush()
    await session.commit()

    result = await session.execute(
        select(ScheduleSession)
        .where(ScheduleSession.id == schedule_session.id)
        .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
    )
    created = result.scalar_one()

    # Fire Discord webhook after successful commit
    sched_settings = await _get_schedule_settings(session, group_id)
    if sched_settings and sched_settings.webhook_url:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        player_map = await _get_player_map(session, group_id)
        ann_data = _build_announcement_data(created, static_group, member_count, player_map=player_map)
        payload = build_session_announcement_payload(ann_data)
        content_hash = compute_announcement_hash(ann_data)
        await _post_or_edit_webhook(
            session, sched_settings.webhook_url, payload,
            created.id, group_id, content_hash,
        )

    return session_to_response(created)


@router.put(
    "/static-groups/{group_id}/schedule/{session_id}",
    response_model=ScheduleSessionResponse,
)
async def update_schedule_session(
    group_id: str,
    session_id: str,
    data: ScheduleSessionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ScheduleSessionResponse:
    """Update a schedule session (lead or owner only)."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(ScheduleSession)
        .where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
        .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
    )
    schedule_session = result.scalar_one_or_none()

    if not schedule_session:
        raise NotFound("Schedule session not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum values to their string form for DB storage
        if hasattr(value, 'value'):
            value = value.value
        setattr(schedule_session, field, value)
    schedule_session.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Fire Discord webhook after successful commit
    sched_settings = await _get_schedule_settings(session, group_id)
    if sched_settings and sched_settings.webhook_url:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        player_map = await _get_player_map(session, group_id)
        ann_data = _build_announcement_data(schedule_session, static_group, member_count, player_map=player_map)
        payload = build_session_announcement_payload(ann_data)
        content_hash = compute_announcement_hash(ann_data)
        await _post_or_edit_webhook(
            session, sched_settings.webhook_url, payload,
            session_id, group_id, content_hash,
        )

    return session_to_response(schedule_session)


@router.delete(
    "/static-groups/{group_id}/schedule/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_schedule_session(
    group_id: str,
    session_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a schedule session (lead or owner only)."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(ScheduleSession).where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
    )
    schedule_session = result.scalar_one_or_none()

    if not schedule_session:
        raise NotFound("Schedule session not found")

    sched_settings = await _get_schedule_settings(session, group_id)
    webhook_url = sched_settings.webhook_url if sched_settings else None
    webhook_payload = None
    mapping_msg_id = None

    if webhook_url:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        ann_data = _build_announcement_data(
            schedule_session, static_group, member_count, rsvps=[]
        )
        webhook_payload = build_cancelled_payload(ann_data)

        map_result = await session.execute(
            select(DiscordMessageMapping).where(
                DiscordMessageMapping.session_id == session_id,
                DiscordMessageMapping.occurrence_start_time.is_(None),
            )
        )
        mapping = map_result.scalar_one_or_none()
        if mapping:
            mapping_msg_id = mapping.webhook_message_id

    await session.delete(schedule_session)
    await session.flush()
    await session.commit()

    if webhook_url and webhook_payload:
        if mapping_msg_id:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.patch(
                        f"{webhook_url}/messages/{mapping_msg_id}",
                        json=webhook_payload,
                    )
            except Exception as exc:
                logger.warning(
                    "discord_webhook_error",
                    error=str(exc),
                    webhook=_mask_webhook_url(webhook_url),
                )
        else:
            await _try_fire_webhook(webhook_url, webhook_payload)


@router.post(
    "/static-groups/{group_id}/schedule/{session_id}/rsvp",
    response_model=RsvpResponse,
)
async def create_or_update_rsvp(
    group_id: str,
    session_id: str,
    data: RsvpCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RsvpResponse:
    """Create or update an RSVP for a schedule session (member or above)."""
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)

    if membership.role == "viewer":
        raise PermissionDenied("Viewers cannot RSVP to sessions")

    result = await session.execute(
        select(ScheduleSession).where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
    )
    schedule_session = result.scalar_one_or_none()

    if not schedule_session:
        raise NotFound("Schedule session not found")

    result = await session.execute(
        select(ScheduleRsvp).where(
            ScheduleRsvp.session_id == session_id,
            ScheduleRsvp.user_id == current_user.id,
        )
    )
    existing_rsvp = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()

    if existing_rsvp:
        existing_rsvp.status = data.status.value
        existing_rsvp.note = data.note
        existing_rsvp.updated_at = now
        rsvp = existing_rsvp
    else:
        rsvp = ScheduleRsvp(
            id=str(uuid.uuid4()),
            session_id=session_id,
            user_id=current_user.id,
            status=data.status.value,
            note=data.note,
            updated_at=now,
        )
        session.add(rsvp)

    await session.flush()
    await session.commit()

    # Edit existing Discord announcement (or skip if nothing changed)
    sched_settings = await _get_schedule_settings(session, group_id)
    if sched_settings and sched_settings.webhook_url:
        rsvp_result = await session.execute(
            select(ScheduleSession)
            .where(ScheduleSession.id == session_id)
            .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
        )
        refreshed = rsvp_result.scalar_one_or_none()
        if refreshed:
            static_group = await get_static_group(session, group_id)
            member_count = await _get_member_count(session, group_id)
            player_map = await _get_player_map(session, group_id)
            ann_data = _build_announcement_data(refreshed, static_group, member_count, player_map=player_map)
            payload = build_session_announcement_payload(ann_data)
            content_hash = compute_announcement_hash(ann_data)
            await _post_or_edit_webhook(
                session, sched_settings.webhook_url, payload,
                session_id, group_id, content_hash,
            )

    return RsvpResponse(
        id=rsvp.id,
        session_id=rsvp.session_id,
        user_id=rsvp.user_id,
        username=current_user.discord_username,
        status=RsvpStatusEnum(rsvp.status),
        note=rsvp.note,
        updated_at=rsvp.updated_at,
    )


# ==================== Scheduler Integrations ====================


@router.get(
    "/static-groups/{group_id}/scheduler/settings",
    response_model=ScheduleSettingsResponse,
)
async def get_schedule_settings(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ScheduleSettingsResponse:
    """Read scheduler integration settings without exposing webhook secrets."""
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)
    if membership.role == "viewer":
        raise PermissionDenied("Viewers cannot access scheduler integrations")

    row = await _get_schedule_settings(session, group_id)
    can_manage = membership.role in {"owner", "lead"} or current_user.is_admin
    return _settings_response(row, group_id, can_manage)


@router.put(
    "/static-groups/{group_id}/scheduler/settings",
    response_model=ScheduleSettingsResponse,
)
async def update_schedule_settings(
    group_id: str,
    data: ScheduleSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ScheduleSettingsResponse:
    """Update Discord reminder settings (lead or owner only)."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    row = await _get_or_create_schedule_settings(session, group_id)
    update_data = data.model_dump(exclude_unset=True, by_alias=False)

    if "webhook_url" in update_data:
        webhook_url = update_data["webhook_url"]
        if webhook_url and not webhook_url.startswith("https://discord.com/api/webhooks/"):
            raise ValidationError("Discord webhook URL must be a valid discord.com webhook URL")
        row.webhook_url = webhook_url

    for field in (
        "reminder_channel_label",
        "enable_24h_reminder",
        "enable_1h_reminder",
        "enable_missing_rsvp_reminder",
    ):
        if field in update_data:
            setattr(row, field, update_data[field])

    row.updated_at = datetime.now(timezone.utc).isoformat()
    await session.flush()
    await session.commit()

    return _settings_response(row, group_id, True)


@router.post(
    "/static-groups/{group_id}/scheduler/settings/test-reminder",
    response_model=TestReminderResponse,
)
async def test_schedule_reminder(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TestReminderResponse:
    """Send a test Discord reminder (lead or owner only)."""
    static_group = await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    row = await _get_schedule_settings(session, group_id)
    if not row or not row.webhook_url:
        raise ValidationError("Configure a Discord webhook URL before sending a test reminder")

    payload = build_test_reminder_payload(
        static_group_name=static_group.name,
        planner_url=settings.frontend_url,
        share_code=static_group.share_code,
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(row.webhook_url, json=payload)
    except httpx.RequestError:
        raise ValidationError("Discord webhook could not be reached")

    if response.status_code >= 400:
        raise ValidationError("Discord webhook rejected the test reminder")

    return TestReminderResponse(ok=True, message="Test reminder sent")


@router.post(
    "/static-groups/{group_id}/scheduler/settings/post-session-preview",
    response_model=TestReminderResponse,
)
async def post_session_preview(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TestReminderResponse:
    """Post the next upcoming session to Discord (lead or owner only).

    If the group has no upcoming sessions this returns a validation error.
    Unlike the test-reminder, this uses real session and RSVP data.
    """
    static_group = await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    row = await _get_schedule_settings(session, group_id)
    if not row or not row.webhook_url:
        raise ValidationError("Configure a Discord webhook URL before posting a session preview")

    now_iso = datetime.now(timezone.utc).isoformat()
    result = await session.execute(
        select(ScheduleSession)
        .where(
            ScheduleSession.static_group_id == group_id,
            ScheduleSession.start_time >= now_iso,
        )
        .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
        .order_by(ScheduleSession.start_time.asc())
        .limit(1)
    )
    upcoming = result.scalar_one_or_none()

    if not upcoming:
        raise ValidationError("No upcoming sessions found. Create a session first.")

    member_count = await _get_member_count(session, group_id)
    player_map = await _get_player_map(session, group_id)
    ann_data = _build_announcement_data(upcoming, static_group, member_count, player_map=player_map)
    payload = build_session_announcement_payload(ann_data)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(row.webhook_url, json=payload)
    except httpx.RequestError:
        raise ValidationError("Discord webhook could not be reached")

    if response.status_code >= 400:
        raise ValidationError("Discord webhook rejected the session preview")

    return TestReminderResponse(ok=True, message="Session preview posted to Discord")


@router.post(
    "/static-groups/{group_id}/scheduler/calendar/regenerate",
    response_model=CalendarTokenResponse,
)
async def regenerate_calendar_token(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CalendarTokenResponse:
    """Create or rotate the private calendar subscription token."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    row = await _get_or_create_schedule_settings(session, group_id)
    now = datetime.now(timezone.utc).isoformat()
    row.calendar_enabled = True
    row.calendar_token = secrets.token_urlsafe(32)
    row.calendar_token_created_at = now
    row.updated_at = now
    await session.flush()
    await session.commit()

    return CalendarTokenResponse(
        calendar_enabled=True,
        calendar_url=_calendar_url(row.calendar_token),
        calendar_token_created_at=row.calendar_token_created_at,
    )


@router.post(
    "/static-groups/{group_id}/scheduler/calendar/revoke",
    response_model=CalendarTokenResponse,
)
async def revoke_calendar_token(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CalendarTokenResponse:
    """Revoke the private calendar subscription token."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    row = await _get_or_create_schedule_settings(session, group_id)
    row.calendar_enabled = False
    row.calendar_token = None
    row.calendar_token_created_at = None
    row.updated_at = datetime.now(timezone.utc).isoformat()
    await session.flush()
    await session.commit()

    return CalendarTokenResponse(calendar_enabled=False)


@router.get("/calendar/{token}.ics")
async def get_calendar_feed(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Public token-based iCalendar feed for scheduled sessions."""
    try:
        settings_result = await session.execute(
            select(ScheduleSettings).where(
                ScheduleSettings.calendar_token == token,
                ScheduleSettings.calendar_enabled == True,  # noqa: E712
            )
        )
    except SQLAlchemyError:
        raise NotFound("Calendar feed not found")
    row = settings_result.scalar_one_or_none()
    if not row:
        raise NotFound("Calendar feed not found")

    static_group = await get_static_group(session, row.static_group_id)
    sessions_result = await session.execute(
        select(ScheduleSession)
        .where(ScheduleSession.static_group_id == row.static_group_id)
        .order_by(ScheduleSession.start_time.asc())
    )
    schedule_sessions = sessions_result.scalars().all()

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//FFXIV Raid Planner//Scheduler//EN",
        "CALSCALE:GREGORIAN",
        f"X-WR-CALNAME:{_escape_ical_text(static_group.name)} Raid Schedule",
    ]
    for schedule_session in schedule_sessions:
        start_dt = datetime.fromisoformat(schedule_session.start_time.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(schedule_session.end_time.replace("Z", "+00:00"))
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{schedule_session.id}@ffxiv-raid-planner",
                f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"DTSTART:{start_dt.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end_dt.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{_escape_ical_text(schedule_session.title)}",
                f"DESCRIPTION:{_escape_ical_text(schedule_session.description)}\\n{settings.frontend_url}/group/{static_group.share_code}?tab=schedule",
                f"URL:{_escape_ical_text(f'{settings.frontend_url}/group/{static_group.share_code}?tab=schedule')}",
            ]
        )
        if schedule_session.is_recurring and schedule_session.recurrence_rule:
            lines.append(f"RRULE:{schedule_session.recurrence_rule}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")

    return Response(
        content="\r\n".join(lines) + "\r\n",
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="raid-schedule.ics"'},
    )


# ==================== Availability Endpoints ====================


@router.get(
    "/static-groups/{group_id}/availability",
    response_model=list[AvailabilityDateSummary],
)
async def list_availability(
    group_id: str,
    response: Response,
    start_date: str = Query(..., description="Start date in ISO format (UTC)"),
    end_date: str = Query(..., description="End date in ISO format (UTC)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AvailabilityDateSummary]:
    """List availability for all members in a date range."""
    set_no_store_cache_headers(response)
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    try:
        start = date_type.fromisoformat(start_date)
        end = date_type.fromisoformat(end_date)
    except ValueError:
        raise ValidationError(
            "start_date and end_date must be valid ISO dates (YYYY-MM-DD)"
        )

    if end < start:
        raise ValidationError("end_date must be on or after start_date")

    if (end - start).days > MAX_AVAILABILITY_RANGE_DAYS:
        raise ValidationError(
            f"Date range cannot exceed {MAX_AVAILABILITY_RANGE_DAYS} days"
        )

    result = await session.execute(
        select(UserAvailability)
        .where(
            UserAvailability.static_group_id == group_id,
            UserAvailability.date >= start_date,
            UserAvailability.date <= end_date,
        )
        .options(selectinload(UserAvailability.user))
        .order_by(UserAvailability.date)
    )
    rows = result.scalars().all()

    by_date: dict[str, list[UserAvailabilityResponse]] = defaultdict(list)
    for row in rows:
        slots = json.loads(row.slots) if isinstance(row.slots, str) else row.slots
        by_date[row.date].append(
            UserAvailabilityResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.discord_username if row.user else None,
                date=row.date,
                slots=slots,
            )
        )

    result_list = []
    current = start
    while current <= end:
        date_str = current.isoformat()
        result_list.append(
            AvailabilityDateSummary(
                date=date_str,
                responses=by_date.get(date_str, []),
            )
        )
        current += timedelta(days=1)

    return result_list


@router.put(
    "/static-groups/{group_id}/availability",
    response_model=UserAvailabilityResponse,
)
async def submit_availability(
    group_id: str,
    data: AvailabilitySubmit,
    response: Response,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserAvailabilityResponse:
    """Submit or update availability for a date (member or above)."""
    set_no_store_cache_headers(response)
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)

    if membership.role == "viewer":
        raise PermissionDenied("Viewers cannot submit availability")

    result = await session.execute(
        select(UserAvailability).where(
            UserAvailability.static_group_id == group_id,
            UserAvailability.user_id == current_user.id,
            UserAvailability.date == data.date,
        )
    )
    existing = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()
    slots_json = json.dumps(sorted(data.slots))

    if existing:
        existing.slots = slots_json
        existing.updated_at = now
        row = existing
    else:
        row = UserAvailability(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            user_id=current_user.id,
            date=data.date,
            slots=slots_json,
            updated_at=now,
        )
        session.add(row)

    await session.flush()
    await session.commit()

    return UserAvailabilityResponse(
        id=row.id,
        user_id=row.user_id,
        username=current_user.discord_username,
        date=row.date,
        slots=json.loads(row.slots),
    )


# ==================== Availability Template Endpoints ====================


@router.get(
    "/static-groups/{group_id}/availability/template",
    response_model=list[AvailabilityTemplateDaySummary],
)
async def list_availability_templates(
    group_id: str,
    response: Response,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AvailabilityTemplateDaySummary]:
    """Return all members' recurring weekly availability templates for a static."""
    set_no_store_cache_headers(response)
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    result = await session.execute(
        select(AvailabilityTemplate)
        .where(AvailabilityTemplate.static_group_id == group_id)
        .options(selectinload(AvailabilityTemplate.user))
        .order_by(AvailabilityTemplate.day_of_week)
    )
    rows = result.scalars().all()

    by_day: dict[str, list[AvailabilityTemplateResponse]] = defaultdict(list)
    for row in rows:
        slots = json.loads(row.slots) if isinstance(row.slots, str) else row.slots
        by_day[row.day_of_week].append(
            AvailabilityTemplateResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.discord_username if row.user else None,
                day_of_week=row.day_of_week,
                slots=slots,
            )
        )

    day_order = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
    all_days = sorted(by_day.keys(), key=lambda d: day_order.index(d) if d in day_order else 99)
    return [
        AvailabilityTemplateDaySummary(day_of_week=day, responses=by_day[day])
        for day in all_days
    ]


@router.put(
    "/static-groups/{group_id}/availability/template",
    response_model=AvailabilityTemplateResponse,
)
async def submit_availability_template(
    group_id: str,
    data: AvailabilityTemplateSubmit,
    response: Response,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AvailabilityTemplateResponse:
    """Create or replace the current user's recurring availability for a weekday."""
    set_no_store_cache_headers(response)
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)

    if membership.role == "viewer":
        raise PermissionDenied("Viewers cannot submit availability")

    if data.day_of_week not in VALID_DAYS:
        raise ValidationError(f"day_of_week must be one of {sorted(VALID_DAYS)}")

    result = await session.execute(
        select(AvailabilityTemplate).where(
            AvailabilityTemplate.static_group_id == group_id,
            AvailabilityTemplate.user_id == current_user.id,
            AvailabilityTemplate.day_of_week == data.day_of_week,
        )
    )
    existing = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()
    slots_json = json.dumps(sorted(data.slots))

    if existing:
        existing.slots = slots_json
        existing.updated_at = now
        row = existing
    else:
        row = AvailabilityTemplate(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            user_id=current_user.id,
            day_of_week=data.day_of_week,
            slots=slots_json,
            updated_at=now,
        )
        session.add(row)

    await session.flush()
    await session.commit()

    return AvailabilityTemplateResponse(
        id=row.id,
        user_id=row.user_id,
        username=current_user.discord_username,
        day_of_week=row.day_of_week,
        slots=json.loads(row.slots),
    )
