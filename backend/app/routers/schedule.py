"""API router for schedule/session and availability operations"""

import json
import uuid
from collections import defaultdict
from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user
from ..models import User
from ..models.availability import UserAvailability
from ..models.schedule import ScheduleRsvp, ScheduleSession
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
    RsvpCreate,
    RsvpResponse,
    RsvpStatusEnum,
    ScheduleSessionCreate,
    ScheduleSessionResponse,
    ScheduleSessionUpdate,
    UserAvailabilityResponse,
)

router = APIRouter(prefix="/api", tags=["schedule"])


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
        created_at=now,
        updated_at=now,
    )
    session.add(schedule_session)
    await session.flush()
    await session.commit()

    result = await session.execute(
        select(ScheduleSession)
        .where(ScheduleSession.id == schedule_session.id)
        .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
    )
    created = result.scalar_one()

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
        setattr(schedule_session, field, value)
    schedule_session.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

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

    await session.delete(schedule_session)
    await session.flush()
    await session.commit()


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

    return RsvpResponse(
        id=rsvp.id,
        session_id=rsvp.session_id,
        user_id=rsvp.user_id,
        username=current_user.discord_username,
        status=RsvpStatusEnum(rsvp.status),
        note=rsvp.note,
        updated_at=rsvp.updated_at,
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

    start = date_type.fromisoformat(start_date)
    end = date_type.fromisoformat(end_date)
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
