"""Public static discovery API - read-only, no auth required"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Membership, StaticGroup
from ..schemas.discovery import DiscoveryListItem, DiscoveryListResponse

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


def _get_discovery(settings: dict | None) -> dict | None:
    if not settings or not isinstance(settings, dict):
        return None
    discovery = settings.get("discovery")
    if not discovery or not isinstance(discovery, dict):
        return None
    return discovery


def _is_discoverable(group: StaticGroup) -> bool:
    if not group.is_public:
        return False
    discovery = _get_discovery(group.settings)
    if not discovery:
        return False
    return discovery.get("enabled") is True


def _matches_list_filter(value: str | None, candidates: list[str] | None) -> bool:
    """Check if value appears in the candidate list (case-insensitive)."""
    if not candidates:
        return False
    return value.lower() in [c.lower() for c in candidates]


def _matches_string_filter(filter_val: str, field_val: str | None) -> bool:
    if not field_val:
        return False
    return filter_val.lower() == field_val.lower()


def _to_list_item(group: StaticGroup, discovery: dict, member_count: int) -> DiscoveryListItem:
    return DiscoveryListItem(
        name=group.name,
        share_code=group.share_code,
        recruitment_status=discovery.get("recruitmentStatus", "closed"),
        description=discovery.get("description"),
        needed_roles=discovery.get("neededRoles"),
        needed_jobs=discovery.get("neededJobs"),
        schedule_days=discovery.get("scheduleDays"),
        schedule_start_time=discovery.get("scheduleStartTime"),
        schedule_end_time=discovery.get("scheduleEndTime"),
        timezone=discovery.get("timezone"),
        languages=discovery.get("languages"),
        intensity=discovery.get("intensity"),
        data_center=discovery.get("dataCenter"),
        server=discovery.get("server"),
        member_count=member_count,
        last_updated=group.updated_at,
    )


@router.get("/statics", response_model=DiscoveryListResponse)
async def list_discoverable_statics(
    role: str | None = Query(None, description="Filter by needed role"),
    job: str | None = Query(None, description="Filter by needed job"),
    day: str | None = Query(None, description="Filter by schedule day"),
    timezone: str | None = Query(None, description="Filter by timezone"),
    language: str | None = Query(None, description="Filter by language"),
    intensity: str | None = Query(None, description="Filter by intensity"),
    recruitment_status: str | None = Query(None, alias="recruitmentStatus", description="Filter by recruitment status"),
    data_center: str | None = Query(None, alias="dataCenter", description="Filter by data center"),
    server: str | None = Query(None, description="Filter by server"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_session),
) -> DiscoveryListResponse:
    stmt = (
        select(StaticGroup, func.count(Membership.id).label("member_count"))
        .outerjoin(Membership, Membership.static_group_id == StaticGroup.id)
        .where(StaticGroup.is_public.is_(True))
        .group_by(StaticGroup.id)
    )

    result = await session.execute(stmt)
    rows = result.all()

    items: list[DiscoveryListItem] = []
    for group, member_count in rows:
        if not _is_discoverable(group):
            continue

        discovery = _get_discovery(group.settings)
        assert discovery is not None

        if role and not _matches_list_filter(role, discovery.get("neededRoles")):
            continue
        if job and not _matches_list_filter(job, discovery.get("neededJobs")):
            continue
        if day and not _matches_list_filter(day, discovery.get("scheduleDays")):
            continue
        if language and not _matches_list_filter(language, discovery.get("languages")):
            continue
        if timezone and not _matches_string_filter(timezone, discovery.get("timezone")):
            continue
        if intensity and not _matches_string_filter(intensity, discovery.get("intensity")):
            continue
        if recruitment_status and not _matches_string_filter(recruitment_status, discovery.get("recruitmentStatus")):
            continue
        if data_center and not _matches_string_filter(data_center, discovery.get("dataCenter")):
            continue
        if server and not _matches_string_filter(server, discovery.get("server")):
            continue

        items.append(_to_list_item(group, discovery, member_count))

    total = len(items)
    items = items[offset : offset + limit]

    return DiscoveryListResponse(items=items, total=total)
