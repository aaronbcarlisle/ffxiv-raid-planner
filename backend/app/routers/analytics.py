"""
Analytics Router

Endpoints for collecting frontend analytics events and error reports,
plus admin-only dashboard queries for usage metrics and error monitoring.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import distinct, func, literal_column, select, update, case
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import (
    AnalyticsEvent,
    ErrorReport,
    LootLogEntry,
    Membership,
    SnapshotPlayer,
    StaticGroup,
    TierSnapshot,
    User,
)
from ..permissions import NotFound, PermissionDenied, is_user_admin
from ..rate_limit import limiter
from ..schemas.analytics import (
    AnalyticsEventBatch,
    BatchReviewRequest,
    ErrorGroupDetailResponse,
    ErrorGroupItem,
    ErrorGroupListResponse,
    ErrorDetailItem,
    ErrorReportIn,
    GrowthPoint,
    GrowthResponse,
    OverviewResponse,
    TopStaticItem,
    TopUserItem,
    UsageEventItem,
    UsageResponse,
    UserStaticItem,
    UserStaticsResponse,
)

router = APIRouter(tags=["analytics"])
logger = get_logger(__name__)


# --- Helpers ---


async def require_admin(user: User, session: AsyncSession) -> None:
    """Raise PermissionDenied if user is not an admin."""
    if not await is_user_admin(session, user.id):
        raise PermissionDenied("Only admins can access analytics")


def _parse_range(range_str: str) -> datetime | None:
    """Parse a time range string (7d, 30d, 90d, all) into a cutoff datetime."""
    now = datetime.now(timezone.utc)
    if range_str == "7d":
        return now - timedelta(days=7)
    elif range_str == "30d":
        return now - timedelta(days=30)
    elif range_str == "90d":
        return now - timedelta(days=90)
    elif range_str == "all":
        return None
    # Default to 30d for unknown values
    return now - timedelta(days=30)


# --- Authenticated Endpoints (any logged-in user) ---


@router.post("/api/analytics/events")
@limiter.limit("10/minute")
async def receive_events(
    request: Request,
    batch: AnalyticsEventBatch,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Receive a batch of analytics events from the frontend."""
    now = datetime.now(timezone.utc).isoformat()

    for event_in in batch.events:
        event = AnalyticsEvent(
            user_id=user.id,
            session_id=batch.session_id or "",
            event_category=event_in.event_category,
            event_name=event_in.event_name,
            event_data=event_in.event_data,
            page_url=event_in.page_url,
            created_at=now,
        )
        session.add(event)

    await session.commit()

    logger.info(
        "analytics_events_received",
        user_id=user.id,
        count=len(batch.events),
    )

    return {"status": "ok", "count": len(batch.events)}


@router.post("/api/analytics/errors")
@limiter.limit("30/minute")
async def receive_error_report(
    request: Request,
    report: ErrorReportIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Receive a single error report from the frontend."""
    error = ErrorReport(
        fingerprint=report.fingerprint,
        user_id=user.id,
        session_id=None,  # Will be set by frontend reporter in future
        error_type=report.error_type,
        message=report.message,
        stack_trace=report.stack_trace,
        context=report.context,
        severity=report.severity,
        source="frontend",
        is_reviewed=False,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(error)
    await session.commit()

    logger.info(
        "error_report_received",
        user_id=user.id,
        fingerprint=report.fingerprint,
        error_type=report.error_type,
        severity=report.severity,
    )

    return {"status": "ok"}


# --- Admin Endpoints ---


@router.get("/api/admin/analytics/overview", response_model=OverviewResponse)
async def get_overview(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OverviewResponse:
    """Get KPI overview data for the admin analytics dashboard."""
    await require_admin(user, session)

    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    twenty_four_hours_ago = (now - timedelta(hours=24)).isoformat()

    # Total users
    result = await session.execute(select(func.count(User.id)))
    total_users = result.scalar() or 0

    # Total statics
    result = await session.execute(select(func.count(StaticGroup.id)))
    total_statics = result.scalar() or 0

    # Average claimed cards per tier (SnapshotPlayers with user_id linked)
    # Group by tier_snapshot_id, count players with user_id, then average
    claimed_subq = (
        select(
            SnapshotPlayer.tier_snapshot_id,
            func.count(SnapshotPlayer.id).label("claimed_count"),
        )
        .where(SnapshotPlayer.user_id.isnot(None))
        .group_by(SnapshotPlayer.tier_snapshot_id)
        .subquery()
    )
    result = await session.execute(
        select(func.coalesce(func.avg(claimed_subq.c.claimed_count), 0.0))
    )
    avg_claimed_cards = round(float(result.scalar() or 0.0), 1)

    # Errors in last 24 hours (unreviewed only)
    result = await session.execute(
        select(func.count(ErrorReport.id)).where(
            ErrorReport.created_at > twenty_four_hours_ago,
            ErrorReport.is_reviewed == False,  # noqa: E712
        )
    )
    errors_24h = result.scalar() or 0

    # Users created in last 7 days
    result = await session.execute(
        select(func.count(User.id)).where(User.created_at > seven_days_ago)
    )
    users_change_7d = result.scalar() or 0

    # Statics created in last 7 days
    result = await session.execute(
        select(func.count(StaticGroup.id)).where(
            StaticGroup.created_at > seven_days_ago
        )
    )
    statics_change_7d = result.scalar() or 0

    return OverviewResponse(
        total_users=total_users,
        total_statics=total_statics,
        avg_claimed_cards=avg_claimed_cards,
        errors_24h=errors_24h,
        users_change_7d=users_change_7d,
        statics_change_7d=statics_change_7d,
    )


@router.get("/api/admin/analytics/growth", response_model=GrowthResponse)
async def get_growth(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    time_range: str = Query("30d", alias="range", pattern="^(7d|30d|90d|all)$"),
) -> GrowthResponse:
    """Get time-series growth data for users and statics."""
    await require_admin(user, session)

    cutoff = _parse_range(time_range)

    # Users by date
    date_col = func.substr(User.created_at, 1, 10)
    user_query = select(
        date_col.label("date"),
        func.count(User.id).label("count"),
    ).group_by(date_col).order_by(date_col)

    if cutoff:
        user_query = user_query.where(User.created_at > cutoff.isoformat())

    result = await session.execute(user_query)
    user_points = [
        GrowthPoint(date=row.date, count=row.count) for row in result.all()
    ]

    # Statics by date
    static_date_col = func.substr(StaticGroup.created_at, 1, 10)
    static_query = select(
        static_date_col.label("date"),
        func.count(StaticGroup.id).label("count"),
    ).group_by(static_date_col).order_by(static_date_col)

    if cutoff:
        static_query = static_query.where(
            StaticGroup.created_at > cutoff.isoformat()
        )

    result = await session.execute(static_query)
    static_points = [
        GrowthPoint(date=row.date, count=row.count) for row in result.all()
    ]

    return GrowthResponse(users=user_points, statics=static_points)


@router.get("/api/admin/analytics/usage", response_model=UsageResponse)
async def get_usage(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    time_range: str = Query("30d", alias="range", pattern="^(7d|30d|90d|all)$"),
) -> UsageResponse:
    """Get feature usage statistics from analytics events."""
    await require_admin(user, session)

    cutoff = _parse_range(time_range)

    query = select(
        AnalyticsEvent.event_name,
        AnalyticsEvent.event_category,
        func.count(AnalyticsEvent.id).label("count"),
        func.count(distinct(AnalyticsEvent.user_id)).label("unique_users"),
    ).group_by(
        AnalyticsEvent.event_name,
        AnalyticsEvent.event_category,
    ).order_by(func.count(AnalyticsEvent.id).desc())

    if cutoff:
        query = query.where(AnalyticsEvent.created_at > cutoff.isoformat())

    result = await session.execute(query)
    rows = result.all()

    events = [
        UsageEventItem(
            event_name=row.event_name,
            category=row.event_category,
            count=row.count,
            unique_users=row.unique_users,
        )
        for row in rows
    ]

    total_events = sum(e.count for e in events)

    return UsageResponse(events=events, total_events=total_events)


@router.get("/api/admin/analytics/top-users")
async def get_top_users(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=1, le=50),
) -> list[TopUserItem]:
    """Get top users by activity (statics created + joined)."""
    await require_admin(user, session)

    # Count statics created (owned) and statics joined (memberships)
    owned_count = (
        select(
            StaticGroup.owner_id.label("user_id"),
            func.count(StaticGroup.id).label("statics_created"),
        )
        .group_by(StaticGroup.owner_id)
        .subquery()
    )

    joined_count = (
        select(
            Membership.user_id.label("user_id"),
            func.count(Membership.id).label("statics_joined"),
        )
        .group_by(Membership.user_id)
        .subquery()
    )

    query = (
        select(
            User.id,
            User.discord_username,
            User.discord_id,
            User.discord_avatar,
            func.coalesce(owned_count.c.statics_created, 0).label("statics_created"),
            func.coalesce(joined_count.c.statics_joined, 0).label("statics_joined"),
            User.last_login_at,
        )
        .outerjoin(owned_count, User.id == owned_count.c.user_id)
        .outerjoin(joined_count, User.id == joined_count.c.user_id)
        .order_by(
            (
                func.coalesce(owned_count.c.statics_created, 0)
                + func.coalesce(joined_count.c.statics_joined, 0)
            ).desc()
        )
        .limit(limit)
    )

    result = await session.execute(query)
    rows = result.all()

    return [
        TopUserItem(
            user_id=row.id,
            username=row.discord_username,
            avatar_url=(
                f"https://cdn.discordapp.com/avatars/{row.discord_id}/{row.discord_avatar}.png"
                if row.discord_avatar
                else None
            ),
            statics_created=row.statics_created,
            statics_joined=row.statics_joined,
            last_active=row.last_login_at,
        )
        for row in rows
    ]


@router.get("/api/admin/analytics/top-statics")
async def get_top_statics(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=1, le=50),
) -> list[TopStaticItem]:
    """Get most active statics by loot log entries."""
    await require_admin(user, session)

    # Count loot log entries per static (via tier_snapshot)
    loot_count = (
        select(
            TierSnapshot.static_group_id.label("static_group_id"),
            func.count(LootLogEntry.id).label("loot_entries"),
            func.max(LootLogEntry.created_at).label("last_log"),
        )
        .join(LootLogEntry, LootLogEntry.tier_snapshot_id == TierSnapshot.id)
        .group_by(TierSnapshot.static_group_id)
        .subquery()
    )

    # Count members per static
    member_count = (
        select(
            Membership.static_group_id.label("static_group_id"),
            func.count(Membership.id).label("member_count"),
        )
        .group_by(Membership.static_group_id)
        .subquery()
    )

    query = (
        select(
            StaticGroup.id,
            StaticGroup.name,
            StaticGroup.share_code,
            func.coalesce(member_count.c.member_count, 0).label("member_count"),
            func.coalesce(loot_count.c.loot_entries, 0).label("loot_entries"),
            loot_count.c.last_log,
        )
        .outerjoin(loot_count, StaticGroup.id == loot_count.c.static_group_id)
        .outerjoin(member_count, StaticGroup.id == member_count.c.static_group_id)
        .order_by(func.coalesce(loot_count.c.loot_entries, 0).desc())
        .limit(limit)
    )

    result = await session.execute(query)
    rows = result.all()

    return [
        TopStaticItem(
            static_id=row.id,
            name=row.name,
            share_code=row.share_code,
            member_count=row.member_count,
            loot_entries=row.loot_entries,
            last_log=row.last_log,
        )
        for row in rows
    ]


@router.get(
    "/api/admin/analytics/errors", response_model=ErrorGroupListResponse
)
async def get_error_groups(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    status: str = Query("unreviewed", pattern="^(unreviewed|reviewed|all)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: str = Query("", pattern="^(frontend|backend|)$"),
    severity: str = Query("", pattern="^(critical|error|warning|info|)$"),
) -> ErrorGroupListResponse:
    """Get error reports grouped by fingerprint with filtering and pagination."""
    await require_admin(user, session)

    # Map severity to numeric order so max() picks the highest severity,
    # not the lexicographically largest string ("warning" > "error" > "critical").
    severity_rank = case(
        (ErrorReport.severity == "critical", 3),
        (ErrorReport.severity == "error", 2),
        (ErrorReport.severity == "warning", 1),
        else_=0,
    )
    # Reverse map: convert the max numeric rank back to a severity string.
    max_severity = case(
        (func.max(severity_rank) == 3, "critical"),
        (func.max(severity_rank) == 2, "error"),
        (func.max(severity_rank) == 1, "warning"),
        else_="info",
    )

    # Base query: group by fingerprint
    query = select(
        ErrorReport.fingerprint,
        func.max(ErrorReport.message).label("message"),
        func.max(ErrorReport.error_type).label("error_type"),
        max_severity.label("severity"),
        func.max(ErrorReport.source).label("source"),
        func.count(ErrorReport.id).label("count"),
        func.count(distinct(ErrorReport.user_id)).label("affected_users"),
        func.min(ErrorReport.created_at).label("first_seen"),
        func.max(ErrorReport.created_at).label("last_seen"),
        # A group is "reviewed" if ALL occurrences are reviewed
        # Use MIN(is_reviewed) — if any is False (0), the group is unreviewed
        func.min(
            case(
                (ErrorReport.is_reviewed == True, 1),  # noqa: E712
                else_=0,
            )
        ).label("is_reviewed"),
    ).group_by(ErrorReport.fingerprint)

    # Apply filters
    if status == "unreviewed":
        # Has at least one unreviewed occurrence
        query = query.having(
            func.min(
                case(
                    (ErrorReport.is_reviewed == True, 1),  # noqa: E712
                    else_=0,
                )
            )
            == 0
        )
    elif status == "reviewed":
        # All occurrences reviewed
        query = query.having(
            func.min(
                case(
                    (ErrorReport.is_reviewed == True, 1),  # noqa: E712
                    else_=0,
                )
            )
            == 1
        )

    if source:
        query = query.where(ErrorReport.source == source)
    if severity:
        query = query.where(ErrorReport.severity == severity)

    # Get total count (wrap in subquery)
    count_query = select(func.count()).select_from(query.subquery())
    result = await session.execute(count_query)
    total = result.scalar() or 0

    # Apply pagination and ordering
    query = (
        query.order_by(func.max(ErrorReport.created_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await session.execute(query)
    rows = result.all()

    errors = [
        ErrorGroupItem(
            fingerprint=row.fingerprint,
            message=row.message,
            error_type=row.error_type,
            severity=row.severity,
            source=row.source,
            count=row.count,
            affected_users=row.affected_users,
            first_seen=row.first_seen,
            last_seen=row.last_seen,
            is_reviewed=bool(row.is_reviewed),
        )
        for row in rows
    ]

    return ErrorGroupListResponse(
        errors=errors,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/api/admin/analytics/errors/{fingerprint}",
    response_model=ErrorGroupDetailResponse,
)
async def get_error_detail(
    fingerprint: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ErrorGroupDetailResponse:
    """Get detailed view of a single error group with recent occurrences."""
    await require_admin(user, session)

    # Get aggregate info
    agg_query = select(
        ErrorReport.fingerprint,
        func.max(ErrorReport.message).label("message"),
        func.max(ErrorReport.error_type).label("error_type"),
        func.count(ErrorReport.id).label("count"),
        func.count(distinct(ErrorReport.user_id)).label("affected_users"),
        func.min(ErrorReport.created_at).label("first_seen"),
        func.max(ErrorReport.created_at).label("last_seen"),
        func.min(
            case(
                (ErrorReport.is_reviewed == True, 1),  # noqa: E712
                else_=0,
            )
        ).label("is_reviewed"),
    ).where(ErrorReport.fingerprint == fingerprint).group_by(
        ErrorReport.fingerprint
    )

    result = await session.execute(agg_query)
    agg = result.one_or_none()

    if not agg:
        raise NotFound("Error group not found")

    # Get last 50 occurrences
    occurrences_query = (
        select(ErrorReport)
        .where(ErrorReport.fingerprint == fingerprint)
        .order_by(ErrorReport.created_at.desc())
        .limit(50)
    )

    result = await session.execute(occurrences_query)
    rows = result.scalars().all()

    occurrences = [
        ErrorDetailItem(
            id=row.id,
            user_id=row.user_id,
            session_id=row.session_id,
            message=row.message,
            stack_trace=row.stack_trace,
            context=row.context,
            severity=row.severity,
            source=row.source,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return ErrorGroupDetailResponse(
        fingerprint=agg.fingerprint,
        message=agg.message,
        error_type=agg.error_type,
        count=agg.count,
        affected_users=agg.affected_users,
        first_seen=agg.first_seen,
        last_seen=agg.last_seen,
        is_reviewed=bool(agg.is_reviewed),
        occurrences=occurrences,
    )


@router.post("/api/admin/analytics/errors/{fingerprint}/review")
async def mark_error_reviewed(
    fingerprint: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark all occurrences of an error group as reviewed."""
    await require_admin(user, session)

    result = await session.execute(
        update(ErrorReport)
        .where(ErrorReport.fingerprint == fingerprint)
        .values(is_reviewed=True)
    )

    if result.rowcount == 0:
        raise NotFound(f"Error group '{fingerprint}' not found")

    await session.commit()

    logger.info(
        "error_group_reviewed",
        fingerprint=fingerprint,
        reviewed_by=user.id,
        count=result.rowcount,
    )

    return {"status": "ok"}


@router.post("/api/admin/analytics/errors/{fingerprint}/unreview")
async def mark_error_unreviewed(
    fingerprint: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark all occurrences of an error group as unreviewed (re-open)."""
    await require_admin(user, session)

    result = await session.execute(
        update(ErrorReport)
        .where(ErrorReport.fingerprint == fingerprint)
        .values(is_reviewed=False)
    )

    if result.rowcount == 0:
        raise NotFound(f"Error group '{fingerprint}' not found")

    await session.commit()

    logger.info(
        "error_group_unreviewed",
        fingerprint=fingerprint,
        unreviewed_by=user.id,
        count=result.rowcount,
    )

    return {"status": "ok"}


@router.post("/api/admin/analytics/errors/batch-review")
async def batch_review_errors(
    body: BatchReviewRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Batch mark/unmark error groups as reviewed."""
    await require_admin(user, session)

    is_reviewed = body.action == "review"
    result = await session.execute(
        update(ErrorReport)
        .where(ErrorReport.fingerprint.in_(body.fingerprints))
        .values(is_reviewed=is_reviewed)
    )
    await session.commit()

    logger.info(
        "batch_errors_reviewed",
        action=body.action,
        fingerprints=len(body.fingerprints),
        rows_updated=result.rowcount,
        admin_user_id=user.id,
    )

    return {"status": "ok", "count": result.rowcount}


@router.get("/api/admin/analytics/users/{user_id}/statics")
async def get_user_statics(
    user_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserStaticsResponse:
    """Get statics created and joined by a specific user."""
    await require_admin(user, session)

    # Statics created (owned)
    # Need member count for each
    member_count_sq = (
        select(
            Membership.static_group_id,
            func.count(Membership.id).label("member_count"),
        )
        .group_by(Membership.static_group_id)
        .subquery()
    )

    created_result = await session.execute(
        select(
            StaticGroup.id,
            StaticGroup.name,
            StaticGroup.share_code,
            func.coalesce(member_count_sq.c.member_count, 0).label("member_count"),
        )
        .outerjoin(
            member_count_sq,
            StaticGroup.id == member_count_sq.c.static_group_id,
        )
        .where(StaticGroup.owner_id == user_id)
        .order_by(StaticGroup.name)
    )
    created = [
        UserStaticItem(
            static_id=row.id,
            name=row.name,
            share_code=row.share_code,
            member_count=row.member_count,
        )
        for row in created_result.all()
    ]

    # Statics joined (memberships, excluding owned)
    joined_result = await session.execute(
        select(
            StaticGroup.id,
            StaticGroup.name,
            StaticGroup.share_code,
            Membership.role,
            func.coalesce(member_count_sq.c.member_count, 0).label("member_count"),
        )
        .join(Membership, Membership.static_group_id == StaticGroup.id)
        .outerjoin(
            member_count_sq,
            StaticGroup.id == member_count_sq.c.static_group_id,
        )
        .where(
            Membership.user_id == user_id,
            StaticGroup.owner_id != user_id,
        )
        .order_by(StaticGroup.name)
    )
    joined = [
        UserStaticItem(
            static_id=row.id,
            name=row.name,
            share_code=row.share_code,
            member_count=row.member_count,
            role=row.role,
        )
        for row in joined_result.all()
    ]

    return UserStaticsResponse(created=created, joined=joined)
