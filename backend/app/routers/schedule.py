"""API router for schedule/session and availability operations"""

import json
import secrets
import uuid
from collections import defaultdict
from datetime import date as date_type, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, select
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
    build_schedule_session_url,
    build_session_announcement_payload,
    build_test_reminder_payload,
    compute_announcement_hash,
    compute_rsvp_hash,
    _next_occurrence_iso,
    _recurrence_rule_to_text,
)
from ..services.schedule_webhooks import (
    mask_webhook_url,
    post_schedule_webhook,
    resolve_schedule_webhook,
)
from ..exceptions import ValidationError
from ..models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User
from ..models.notification import Notification
from .notifications import create_notification
from ..models.availability import AvailabilityTemplate, UserAvailability
from ..models.schedule import DiscordMessageMapping, ScheduleDiscordMirror, ScheduleException, ScheduleRsvp, ScheduleSession, ScheduleSettings
from ..services.recurrence import generate_occurrences, next_occurrence
from ..services.discord_guild_events import sync_session_mirror
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
    OccurrenceResponse,
    RsvpCreate,
    RsvpResponse,
    RsvpStatusEnum,
    CalendarTokenResponse,
    ScheduleExceptionCreate,
    ScheduleExceptionResponse,
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
    return mask_webhook_url(webhook_url)


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
    mention_target: str = "none",
    mention_role_id: str | None = None,
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

    session_url = build_schedule_session_url(
        settings.public_app_base_url,
        static_group.share_code,
        sched_session.id,
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
        mention_target=mention_target,
        mention_role_id=mention_role_id,
        track_availability=getattr(sched_session, "track_availability", True),
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


async def _notify_webhook_failure(
    db: AsyncSession,
    group_id: str,
    error_text: str | None,
) -> None:
    """Send one webhook_failure notification per lead/owner — deduped on unread."""
    try:
        group_result = await db.execute(
            select(StaticGroup).where(StaticGroup.id == group_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            return
        href = f"/group/{group.share_code}?tab=schedule&subtab=integrations"

        leads_result = await db.execute(
            select(Membership).where(
                Membership.static_group_id == group_id,
                Membership.role.in_(["owner", "lead"]),
            )
        )
        for member in leads_result.scalars().all():
            existing = await db.execute(
                select(Notification).where(
                    Notification.user_id == member.user_id,
                    Notification.notification_type == "webhook_failure",
                    Notification.href == href,
                    Notification.is_read == False,  # noqa: E712
                )
            )
            if existing.scalar_one_or_none():
                continue
            await create_notification(
                db,
                user_id=member.user_id,
                notification_type="webhook_failure",
                title=f"Discord webhook failed for {group.name}",
                body=(error_text or "")[:200] or None,
                href=href,
                group_id=group.id,
            )
    except Exception as exc:
        logger.warning("webhook_failure_notification_error", group_id=group_id, error=str(exc))


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
                        mapping.last_delivery_status = 200
                        mapping.last_delivery_error = None
                        mapping.updated_at = now
                        await db.flush()
                        await db.commit()
                    elif resp.status_code >= 400:
                        err = resp.text[:500] if resp.text else f"HTTP {resp.status_code}"
                        logger.warning(
                            "discord_webhook_replacement_rejected",
                            status=resp.status_code,
                            webhook=_mask_webhook_url(webhook_url),
                        )
                        mapping.last_delivery_status = resp.status_code
                        mapping.last_delivery_error = err
                        mapping.delivery_retry_count = (mapping.delivery_retry_count or 0) + 1
                        mapping.updated_at = now
                        await db.flush()
                        await db.commit()
                        await _notify_webhook_failure(db, group_id, err)
                    return

                if resp.status_code >= 400:
                    err = resp.text[:500] if resp.text else f"HTTP {resp.status_code}"
                    logger.warning(
                        "discord_webhook_edit_rejected",
                        status=resp.status_code,
                        webhook=_mask_webhook_url(webhook_url),
                    )
                    mapping.last_delivery_status = resp.status_code
                    mapping.last_delivery_error = err
                    mapping.delivery_retry_count = (mapping.delivery_retry_count or 0) + 1
                    mapping.updated_at = now
                    await db.flush()
                    await db.commit()
                    await _notify_webhook_failure(db, group_id, err)
                    return

                mapping.last_edited_at = now
                mapping.last_rsvp_hash = content_hash
                mapping.last_delivery_status = resp.status_code
                mapping.last_delivery_error = None
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
                        last_delivery_status=200,
                        last_delivery_error=None,
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
    last_delivery_status: int | None = None,
    last_delivery_error: str | None = None,
) -> ScheduleSettingsResponse:
    return ScheduleSettingsResponse(
        id=row.id if row else None,
        static_group_id=group_id,
        webhook_configured=bool(row and row.webhook_url),
        webhook_url_masked=_mask_webhook_url(row.webhook_url) if row and can_manage else None,
        reminder_channel_label=row.reminder_channel_label if row and can_manage else None,
        mention_target=row.mention_target if row and can_manage else "none",
        mention_role_id=row.mention_role_id if row and can_manage and row.mention_target == "role" else None,
        enable_at_start_reminder=bool(row and row.enable_at_start_reminder) if can_manage else False,
        enable_15m_reminder=bool(row and row.enable_15m_reminder) if can_manage else False,
        enable_24h_reminder=bool(row and row.enable_24h_reminder) if can_manage else False,
        enable_1h_reminder=bool(row and row.enable_1h_reminder) if can_manage else False,
        enable_6h_reminder=bool(row and row.enable_6h_reminder) if can_manage else False,
        enable_12h_reminder=bool(row and row.enable_12h_reminder) if can_manage else False,
        enable_missing_rsvp_reminder=bool(row and row.enable_missing_rsvp_reminder) if can_manage else False,
        calendar_enabled=bool(row and row.calendar_enabled),
        calendar_url=_calendar_url(row.calendar_token) if row and row.calendar_enabled else None,
        calendar_token_created_at=row.calendar_token_created_at if row else None,
        webhook_last_delivery_status=last_delivery_status if can_manage else None,
        webhook_last_delivery_error=last_delivery_error if can_manage else None,
        discord_bot_configured=bool(row and getattr(row, 'discord_bot_token', None)) if can_manage else False,
        discord_guild_id=getattr(row, 'discord_guild_id', None) if row and can_manage else None,
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
        track_availability=getattr(session, "track_availability", True),
        category=getattr(session, 'category', None),
        content_id=getattr(session, 'content_id', None),
        content_name=getattr(session, 'content_name', None),
        banner_url=getattr(session, 'banner_url', None),
        banner_key=getattr(session, 'banner_key', None),
        banner_source_type=getattr(session, 'banner_source_type', None),
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
        recurrence_rule=data.recurrence_rule if data.is_recurring else None,
        track_availability=data.track_availability,
        category=data.category.value if data.category else None,
        content_id=data.content_id,
        content_name=data.content_name,
        banner_url=data.banner_url,
        banner_key=data.banner_key,
        banner_source_type=data.banner_source_type.value if data.banner_source_type else None,
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
    webhook_destination = resolve_schedule_webhook(sched_settings)
    if webhook_destination:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        player_map = await _get_player_map(session, group_id)
        ann_data = _build_announcement_data(
            created,
            static_group,
            member_count,
            player_map=player_map,
            mention_target=webhook_destination.mention_target,
            mention_role_id=webhook_destination.mention_role_id,
        )
        payload = build_session_announcement_payload(ann_data)
        content_hash = compute_announcement_hash(ann_data)
        await _post_or_edit_webhook(
            session, webhook_destination.webhook_url, payload,
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

    update_data = data.model_dump(exclude_unset=True, by_alias=False)
    if update_data.get("is_recurring") is False and "recurrence_rule" not in update_data:
        update_data["recurrence_rule"] = None
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
    webhook_destination = resolve_schedule_webhook(sched_settings)
    if webhook_destination:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        player_map = await _get_player_map(session, group_id)
        ann_data = _build_announcement_data(
            schedule_session,
            static_group,
            member_count,
            player_map=player_map,
            mention_target=webhook_destination.mention_target,
            mention_role_id=webhook_destination.mention_role_id,
        )
        payload = build_session_announcement_payload(ann_data)
        content_hash = compute_announcement_hash(ann_data)
        await _post_or_edit_webhook(
            session, webhook_destination.webhook_url, payload,
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
    webhook_destination = resolve_schedule_webhook(sched_settings)
    webhook_url = webhook_destination.webhook_url if webhook_destination else None
    webhook_payload = None
    mapping_msg_id = None

    if webhook_url:
        static_group = await get_static_group(session, group_id)
        member_count = await _get_member_count(session, group_id)
        ann_data = _build_announcement_data(
            schedule_session,
            static_group,
            member_count,
            rsvps=[],
            mention_target=webhook_destination.mention_target if webhook_destination else "none",
            mention_role_id=webhook_destination.mention_role_id if webhook_destination else None,
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
    webhook_destination = resolve_schedule_webhook(sched_settings)
    if webhook_destination:
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
            ann_data = _build_announcement_data(
                refreshed,
                static_group,
                member_count,
                player_map=player_map,
                mention_target=webhook_destination.mention_target,
                mention_role_id=webhook_destination.mention_role_id,
            )
            payload = build_session_announcement_payload(ann_data)
            content_hash = compute_announcement_hash(ann_data)
            await _post_or_edit_webhook(
                session, webhook_destination.webhook_url, payload,
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

    last_delivery_status = None
    last_delivery_error = None
    if can_manage and row and row.webhook_url:
        fail_result = await session.execute(
            select(DiscordMessageMapping)
            .where(
                DiscordMessageMapping.static_group_id == group_id,
                DiscordMessageMapping.last_delivery_status >= 400,
            )
            .order_by(desc(DiscordMessageMapping.updated_at))
            .limit(1)
        )
        latest_fail = fail_result.scalar_one_or_none()
        if latest_fail:
            last_delivery_status = latest_fail.last_delivery_status
            last_delivery_error = latest_fail.last_delivery_error

    return _settings_response(row, group_id, can_manage, last_delivery_status, last_delivery_error)


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
        "mention_target",
        "mention_role_id",
        "enable_at_start_reminder",
        "enable_15m_reminder",
        "enable_24h_reminder",
        "enable_1h_reminder",
        "enable_6h_reminder",
        "enable_12h_reminder",
        "enable_missing_rsvp_reminder",
        "discord_bot_token",
        "discord_guild_id",
    ):
        if field in update_data:
            value = update_data[field]
            if hasattr(value, "value"):
                value = value.value
            setattr(row, field, value)
    if row.mention_target != "role":
        row.mention_role_id = None

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
    webhook_destination = resolve_schedule_webhook(row)
    if not webhook_destination:
        raise ValidationError("Configure a Discord webhook URL before sending a test reminder")

    payload = build_test_reminder_payload(
        static_group_name=static_group.name,
        planner_url=settings.public_app_base_url,
        share_code=static_group.share_code,
        mention_target=webhook_destination.mention_target,
        mention_role_id=webhook_destination.mention_role_id,
    )

    ok, _status, _err = await post_schedule_webhook(webhook_destination, payload, timeout=10.0)
    if not ok:
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
    webhook_destination = resolve_schedule_webhook(row)
    if not webhook_destination:
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
    ann_data = _build_announcement_data(
        upcoming,
        static_group,
        member_count,
        player_map=player_map,
        mention_target=webhook_destination.mention_target,
        mention_role_id=webhook_destination.mention_role_id,
    )
    payload = build_session_announcement_payload(ann_data)
    content_hash = compute_announcement_hash(ann_data)
    await _post_or_edit_webhook(
        session, webhook_destination.webhook_url, payload,
        upcoming.id, group_id, content_hash,
    )

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
        planner_url = build_schedule_session_url(
            settings.public_app_base_url,
            static_group.share_code,
            schedule_session.id,
        )
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{schedule_session.id}@ffxiv-raid-planner",
                f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"DTSTART:{start_dt.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end_dt.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{_escape_ical_text(schedule_session.title)}",
                f"DESCRIPTION:{_escape_ical_text(schedule_session.description)}\\n{planner_url}",
                f"URL:{_escape_ical_text(planner_url)}",
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


# ──────────────────────────────────────────────────────────────────────────────
# Occurrence generation
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/static-groups/{group_id}/schedule/{session_id}/occurrences",
    response_model=list[OccurrenceResponse],
)
async def list_session_occurrences(
    group_id: str,
    session_id: str,
    count: int = Query(default=20, ge=1, le=100),
    response: Response = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[OccurrenceResponse]:
    """Generate upcoming occurrences for a recurring session.

    For non-recurring sessions this returns the single session start if it is
    in the future, otherwise an empty list.  Cancelled occurrences are excluded.
    Edited occurrences have their overrides applied.
    """
    await get_static_group(db, group_id)
    await require_membership(db, current_user.id, group_id)

    result = await db.execute(
        select(ScheduleSession).where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise NotFound("Schedule session not found")

    # Load exceptions keyed by occurrence_date
    exc_result = await db.execute(
        select(ScheduleException).where(ScheduleException.session_id == session_id)
    )
    exceptions: dict[str, ScheduleException] = {
        e.occurrence_date: e for e in exc_result.scalars().all()
    }

    if not sched.is_recurring or not sched.recurrence_rule:
        occ = next_occurrence(
            sched.start_time, sched.end_time, None,
            exceptions=exceptions,
            session_title=sched.title,
            session_description=sched.description,
            session_banner_url=getattr(sched, 'banner_url', None),
            session_banner_key=getattr(sched, 'banner_key', None),
            session_banner_source_type=getattr(sched, 'banner_source_type', None),
        )
        occurrences = [occ] if occ else []
    else:
        occurrences = generate_occurrences(
            sched.start_time, sched.end_time, sched.recurrence_rule,
            count=count,
            exceptions=exceptions,
            session_title=sched.title,
            session_description=sched.description,
            session_banner_url=getattr(sched, 'banner_url', None),
            session_banner_key=getattr(sched, 'banner_key', None),
            session_banner_source_type=getattr(sched, 'banner_source_type', None),
        )

    return [
        OccurrenceResponse(
            occurrence_date=o.occurrence_date,
            start_time=o.start_time,
            end_time=o.end_time,
            title=o.title,
            description=o.description,
            banner_url=o.banner_url,
            banner_key=o.banner_key,
            banner_source_type=o.banner_source_type,
            is_exception=o.is_exception,
            exception_id=o.exception_id,
        )
        for o in occurrences
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Schedule exceptions (cancel / edit one occurrence)
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/static-groups/{group_id}/schedule/{session_id}/exceptions",
    response_model=ScheduleExceptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_schedule_exception(
    group_id: str,
    session_id: str,
    data: ScheduleExceptionCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ScheduleExceptionResponse:
    """Create or update an exception for one occurrence of a recurring session.

    type='cancelled' — the occurrence is hidden from future-occurrence lists and
    skipped when computing 'Next Raid'.
    type='edited'    — the occurrence uses the override fields instead of series defaults.

    Idempotent: if an exception already exists for this (session, occurrence_date)
    pair, it is updated in-place.
    """
    await get_static_group(db, group_id)
    await require_can_manage_members(db, current_user.id, group_id)

    result = await db.execute(
        select(ScheduleSession).where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise NotFound("Schedule session not found")
    if not sched.is_recurring:
        raise HTTPException(status_code=400, detail="Exceptions can only be created for recurring sessions")

    existing_result = await db.execute(
        select(ScheduleException).where(
            ScheduleException.session_id == session_id,
            ScheduleException.occurrence_date == data.occurrence_date,
        )
    )
    exc = existing_result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()

    if exc:
        exc.type = data.type.value
        exc.override_start_time = data.override_start_time
        exc.override_end_time = data.override_end_time
        exc.override_title = data.override_title
        exc.override_description = data.override_description
        exc.override_banner_url = data.override_banner_url
        exc.override_banner_key = data.override_banner_key
        exc.cancellation_reason = data.cancellation_reason
        exc.updated_at = now
    else:
        exc = ScheduleException(
            id=str(uuid.uuid4()),
            session_id=session_id,
            occurrence_date=data.occurrence_date,
            type=data.type.value,
            override_start_time=data.override_start_time,
            override_end_time=data.override_end_time,
            override_title=data.override_title,
            override_description=data.override_description,
            override_banner_url=data.override_banner_url,
            override_banner_key=data.override_banner_key,
            cancellation_reason=data.cancellation_reason,
            created_by_id=current_user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(exc)

    await db.flush()
    await db.commit()

    logger.info(
        "schedule_exception_upserted",
        session_id=session_id,
        occurrence_date=data.occurrence_date,
        type=data.type.value,
        user_id=current_user.id,
    )

    return ScheduleExceptionResponse(
        id=exc.id,
        session_id=exc.session_id,
        occurrence_date=exc.occurrence_date,
        type=exc.type,
        override_start_time=exc.override_start_time,
        override_end_time=exc.override_end_time,
        override_title=exc.override_title,
        override_description=exc.override_description,
        override_banner_url=exc.override_banner_url,
        override_banner_key=exc.override_banner_key,
        cancellation_reason=exc.cancellation_reason,
        created_by_id=exc.created_by_id,
        created_at=exc.created_at,
        updated_at=exc.updated_at,
    )


@router.get(
    "/static-groups/{group_id}/schedule/{session_id}/exceptions",
    response_model=list[ScheduleExceptionResponse],
)
async def list_schedule_exceptions(
    group_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ScheduleExceptionResponse]:
    """List all exceptions for a recurring session."""
    await get_static_group(db, group_id)
    await require_membership(db, current_user.id, group_id)

    result = await db.execute(
        select(ScheduleException)
        .where(ScheduleException.session_id == session_id)
        .order_by(ScheduleException.occurrence_date)
    )
    exceptions = result.scalars().all()

    return [
        ScheduleExceptionResponse(
            id=e.id,
            session_id=e.session_id,
            occurrence_date=e.occurrence_date,
            type=e.type,
            override_start_time=e.override_start_time,
            override_end_time=e.override_end_time,
            override_title=e.override_title,
            override_description=e.override_description,
            override_banner_url=e.override_banner_url,
            override_banner_key=e.override_banner_key,
            cancellation_reason=e.cancellation_reason,
            created_by_id=e.created_by_id,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in exceptions
    ]


@router.delete(
    "/static-groups/{group_id}/schedule/{session_id}/exceptions/{occurrence_date}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_schedule_exception(
    group_id: str,
    session_id: str,
    occurrence_date: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove an exception, restoring the occurrence to series defaults."""
    await get_static_group(db, group_id)
    await require_can_manage_members(db, current_user.id, group_id)

    result = await db.execute(
        select(ScheduleException).where(
            ScheduleException.session_id == session_id,
            ScheduleException.occurrence_date == occurrence_date,
        )
    )
    exc = result.scalar_one_or_none()
    if not exc:
        raise NotFound("Exception not found")

    await db.delete(exc)
    await db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Discord Guild Scheduled Events mirror (V1 rolling window)
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/static-groups/{group_id}/schedule/{session_id}/sync-discord",
    status_code=status.HTTP_200_OK,
)
async def sync_session_discord_mirror(
    group_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Trigger a rolling 4-week Discord Guild Scheduled Events sync for one session.

    Requires the group's ScheduleSettings to have discord_bot_token and
    discord_guild_id configured.  Returns a log of actions taken.

    Only leads and owners can trigger a sync.
    """
    await get_static_group(db, group_id)
    await require_can_manage_members(db, current_user.id, group_id)

    sched_result = await db.execute(
        select(ScheduleSession).where(
            ScheduleSession.id == session_id,
            ScheduleSession.static_group_id == group_id,
        )
    )
    sched = sched_result.scalar_one_or_none()
    if not sched:
        raise NotFound("Schedule session not found")

    settings_result = await db.execute(
        select(ScheduleSettings).where(ScheduleSettings.static_group_id == group_id)
    )
    settings = settings_result.scalar_one_or_none()
    if not settings or not settings.discord_bot_token or not settings.discord_guild_id:
        raise HTTPException(
            status_code=400,
            detail="Discord bot token and guild ID must be configured in schedule settings",
        )

    exc_result = await db.execute(
        select(ScheduleException).where(ScheduleException.session_id == session_id)
    )
    exceptions: dict[str, ScheduleException] = {
        e.occurrence_date: e for e in exc_result.scalars().all()
    }

    mirror_result = await db.execute(
        select(ScheduleDiscordMirror).where(ScheduleDiscordMirror.session_id == session_id)
    )
    mirrors = mirror_result.scalars().all()

    log = await sync_session_mirror(
        session=sched,
        settings=settings,
        mirrors=list(mirrors),
        exceptions=exceptions,
        db_add=db.add,
        db_delete=db.delete,
    )

    await db.commit()

    logger.info(
        "discord_mirror_synced",
        session_id=session_id,
        group_id=group_id,
        user_id=current_user.id,
        actions=len(log),
    )

    return {"actions": log}


@router.get(
    "/static-groups/{group_id}/schedule/{session_id}/discord-mirrors",
    response_model=list[dict],
)
async def list_discord_mirrors(
    group_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List Discord mirror rows for a session (sync status per occurrence)."""
    await get_static_group(db, group_id)
    await require_membership(db, current_user.id, group_id)

    result = await db.execute(
        select(ScheduleDiscordMirror)
        .where(ScheduleDiscordMirror.session_id == session_id)
        .order_by(ScheduleDiscordMirror.occurrence_date)
    )
    mirrors = result.scalars().all()

    return [
        {
            "id": m.id,
            "sessionId": session_id,
            "occurrenceDate": m.occurrence_date,
            "discordGuildId": m.discord_guild_id,
            "discordScheduledEventId": m.discord_scheduled_event_id,
            "syncStatus": m.sync_status,
            "lastSyncedAt": m.last_synced_at,
            "lastError": m.last_error,
            "updatedAt": m.updated_at,
        }
        for m in mirrors
    ]
