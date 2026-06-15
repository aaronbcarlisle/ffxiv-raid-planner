"""Public static discovery API - read-only, no auth required"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user_optional
from ..models import Membership, StaticGroup, User
from ..models.bis_target_set import BiSTargetSet
from ..models.personal_availability import PersonalAvailabilityTemplate
from ..models.player_goal import PlayerGoal
from ..models.player_job_profile import PlayerJobProfile
from ..models.player_profile import PlayerProfile
from ..models.static_objective_goal import StaticObjectiveGoal
from ..rate_limit import limiter
from ..schemas.discovery import (
    DiscoveryListItem,
    DiscoveryListResponse,
    FitBis,
    FitComms,
    FitGoals,
    FitJobs,
    FitSchedule,
    FitSummary,
    GoalAlignmentSummarySlim,
)
from ..services.fit_score import compute_fit_summary
from ..services.goal_matching import compute_alignment

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

SortOption = Literal["recent", "members", "name"]


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


def _matches_text_query(query: str, group_name: str, description: str | None) -> bool:
    """Case-insensitive substring search over name and description."""
    q = query.lower()
    if q in group_name.lower():
        return True
    if description and q in description.lower():
        return True
    return False


def _sanitize_contact(method: str | None, value: str | None) -> tuple[str | None, str | None]:
    """Only return contact fields when both method and value are set and valid."""
    VALID_METHODS = {"discord", "discord_server", "url", "text"}
    if not method or not value or method not in VALID_METHODS:
        return None, None
    # Trim whitespace and truncate to 200 chars
    clean = value.strip()[:200]
    if not clean:
        return None, None
    # Reject unsafe URL protocols
    if method == "url":
        lower = clean.lower()
        if not (lower.startswith("https://") or lower.startswith("http://")):
            return None, None
    return method, clean


def _build_fit_summary(raw: dict) -> FitSummary:
    """Convert compute_fit_summary() dict output to a FitSummary schema object."""
    goals_raw = raw.get("goals", {})
    jobs_raw = raw.get("jobs", {})
    return FitSummary(
        overall=raw.get("overall", "unknown"),
        goals=FitGoals(
            aligned=goals_raw.get("aligned", 0),
            partial=goals_raw.get("partial", 0),
            conflicts=goals_raw.get("conflicts", 0),
            missing=goals_raw.get("missing", 0),
        ),
        jobs=FitJobs(
            status=jobs_raw.get("status", "unknown"),
            matched_jobs=jobs_raw.get("matchedJobs", []),
        ),
        schedule=FitSchedule(status=raw.get("schedule", {}).get("status", "unknown")),
        comms=FitComms(status=raw.get("comms", {}).get("status", "unknown")),
        bis=FitBis(status=raw.get("bis", {}).get("status", "unknown")),
    )


def _to_list_item(
    group: StaticGroup,
    discovery: dict,
    member_count: int,
    objective_categories: list[str] | None = None,
    goal_alignment: GoalAlignmentSummarySlim | None = None,
    fit_summary: FitSummary | None = None,
) -> DiscoveryListItem:
    contact_method, contact_value = _sanitize_contact(
        discovery.get("contactMethod"), discovery.get("contactValue")
    )
    # Only expose member count when owner explicitly opted in
    show_count = discovery.get("showMemberCount") is True
    return DiscoveryListItem(
        name=group.name,
        share_code=group.share_code,
        recruitment_status=discovery.get("recruitmentStatus", "closed"),
        description=discovery.get("description"),
        contact_method=contact_method,
        contact_value=contact_value,
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
        member_count=member_count if show_count else 0,
        last_updated=group.updated_at,
        recruiting_roles=discovery.get("recruitingRoles"),
        communication_style=discovery.get("communicationStyle"),
        objective_categories=objective_categories or [],
        goal_alignment=goal_alignment,
        fit_summary=fit_summary,
    )


def _sort_items(items: list[DiscoveryListItem], sort: SortOption) -> list[DiscoveryListItem]:
    if sort == "members":
        return sorted(items, key=lambda i: i.member_count, reverse=True)
    if sort == "name":
        return sorted(items, key=lambda i: i.name.lower())
    # Default: recent (by last_updated desc)
    return sorted(items, key=lambda i: i.last_updated or "", reverse=True)


@router.get("/statics", response_model=DiscoveryListResponse)
@limiter.limit("60/minute")
async def list_discoverable_statics(
    request: Request,
    q: str | None = Query(None, max_length=100, description="Text search over name and description"),
    role: str | None = Query(None, description="Filter by needed role"),
    job: str | None = Query(None, description="Filter by needed job"),
    day: str | None = Query(None, description="Filter by schedule day"),
    timezone: str | None = Query(None, description="Filter by timezone"),
    language: str | None = Query(None, description="Filter by language"),
    intensity: str | None = Query(None, description="Filter by intensity"),
    recruitment_status: str | None = Query(None, alias="recruitmentStatus", description="Filter by recruitment status"),
    data_center: str | None = Query(None, alias="dataCenter", description="Filter by data center"),
    server: str | None = Query(None, description="Filter by server"),
    goal_category: str | None = Query(None, alias="goalCategory", description="Filter by static objective goal category"),
    hide_conflicts: bool = Query(False, alias="hideConflicts", description="Hide statics that conflict with the authenticated user's public goals"),
    hide_goal_conflicts: bool = Query(False, alias="hideGoalConflicts", description="Hide statics where fit score shows goal conflicts"),
    schedule_overlap: bool = Query(False, alias="scheduleOverlap", description="Only show statics with match/partial schedule overlap"),
    sort: SortOption = Query("recent", description="Sort order: recent, members, name"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> DiscoveryListResponse:
    stmt = (
        select(StaticGroup, func.count(Membership.id).label("member_count"))
        .outerjoin(Membership, Membership.static_group_id == StaticGroup.id)
        .where(StaticGroup.is_public.is_(True))
        .group_by(StaticGroup.id)
    )

    result = await session.execute(stmt)
    rows = result.all()

    # Load objective goals for all groups in one query
    group_ids = [group.id for group, _ in rows]
    obj_goals_map: dict[str, list[dict]] = {gid: [] for gid in group_ids}
    if group_ids:
        og_result = await session.execute(
            select(StaticObjectiveGoal).where(
                StaticObjectiveGoal.static_group_id.in_(group_ids)
            )
        )
        for g in og_result.scalars().all():
            obj_goals_map.setdefault(g.static_group_id, []).append({
                "id": g.id, "category": g.category, "priority": g.priority, "title": g.title
            })

    # Load current user's profile + data for alignment and fit scoring (if authenticated)
    user_public_goals: list[dict] = []
    user_player_jobs: list[str] = []
    user_availability: dict | None = None
    user_languages: list[str] = []
    user_comms: str | None = None
    user_public_bis: list[dict] = []
    user_profile: PlayerProfile | None = None

    if current_user:
        profile_result = await session.execute(
            select(PlayerProfile).where(
                PlayerProfile.user_id == current_user.id,
                PlayerProfile.visibility == "discoverable",
            ).limit(1)
        )
        user_profile = profile_result.scalar_one_or_none()

        if user_profile:
            # Public goals only
            pg_result = await session.execute(
                select(PlayerGoal).where(
                    PlayerGoal.profile_id == user_profile.id,
                    PlayerGoal.is_public == True,  # noqa: E712
                )
            )
            user_public_goals = [
                {
                    "id": g.id,
                    "goal_type": g.goal_type,
                    # objective_category takes priority — same taxonomy as
                    # StaticObjectiveGoal; fall back to free-form category.
                    "category": g.objective_category or g.category,
                    "intent_level": g.intent_level,
                }
                for g in pg_result.scalars().all()
                # Only goals with an explicit matching category or goal_type participate
                if g.objective_category is not None or g.goal_type is not None
            ]

            # Job profiles — main first, then alts
            jp_result = await session.execute(
                select(PlayerJobProfile).where(
                    PlayerJobProfile.profile_id == user_profile.id,
                ).order_by(
                    # main > preferred_alt > flex > emergency > casual
                    PlayerJobProfile.priority,
                )
            )
            all_jobs = jp_result.scalars().all()
            # Sort: main first, others by db order
            priority_order = {"main": 0, "preferred_alt": 1, "flex": 2, "emergency": 3, "casual": 4}
            sorted_jobs = sorted(all_jobs, key=lambda j: priority_order.get(j.priority, 99))
            user_player_jobs = [j.job for j in sorted_jobs]

            # Public BiS targets linked to player job profiles
            if user_player_jobs:
                # Get all job_profile_ids belonging to this profile
                jp_ids = [j.id for j in sorted_jobs]
                if jp_ids:
                    bis_result = await session.execute(
                        select(BiSTargetSet).where(
                            BiSTargetSet.job_profile_id.in_(jp_ids),
                            BiSTargetSet.is_public == True,  # noqa: E712
                        )
                    )
                    user_public_bis = [
                        {"job": b.job, "is_public": b.is_public}
                        for b in bis_result.scalars().all()
                    ]

            # Personal availability — collect unique days
            avail_result = await session.execute(
                select(PersonalAvailabilityTemplate).where(
                    PersonalAvailabilityTemplate.user_id == current_user.id,
                )
            )
            avail_rows = avail_result.scalars().all()
            if avail_rows:
                user_availability = {"days": [row.day_of_week for row in avail_rows]}

    items: list[DiscoveryListItem] = []
    for group, member_count in rows:
        if not _is_discoverable(group):
            continue

        discovery = _get_discovery(group.settings)
        assert discovery is not None

        # Text search
        if q and not _matches_text_query(q, group.name, discovery.get("description")):
            continue

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

        static_goals = obj_goals_map.get(group.id, [])
        categories = list({g["category"] for g in static_goals})

        # Goal category filter
        if goal_category and goal_category not in categories:
            continue

        # Compute goal alignment for authenticated users with public goals (legacy)
        goal_alignment: GoalAlignmentSummarySlim | None = None
        if current_user and user_public_goals and static_goals:
            alignment_result = compute_alignment(user_public_goals, static_goals)
            s = alignment_result["summary"]
            goal_alignment = GoalAlignmentSummarySlim(
                aligned=s["aligned"],
                partial=s["partial"],
                conflicts=s["conflicts"],
                missing=s["missing"],
                unknown=s["unknown"],
            )
            # Hide statics with conflicts if requested (legacy hideConflicts param)
            if hide_conflicts and s["conflicts"] > 0:
                continue

        # Compute fit summary for authenticated users with a discoverable profile
        fit_summary: FitSummary | None = None
        if current_user and user_profile:
            raw_fit = compute_fit_summary(
                static_group=group,
                static_objectives=static_goals,
                player_goals=user_public_goals,
                player_jobs=user_player_jobs,
                player_availability=user_availability,
                player_languages=user_languages,
                player_comms=user_comms,
                player_bis_targets=user_public_bis,
                listing_data=discovery,
            )
            fit_summary = _build_fit_summary(raw_fit)

            # Fit-based filters
            if hide_goal_conflicts and raw_fit["goals"]["conflicts"] > 0:
                continue
            if schedule_overlap and raw_fit["schedule"]["status"] not in ("match", "partial"):
                continue

        items.append(_to_list_item(
            group, discovery, member_count, categories, goal_alignment, fit_summary
        ))

    # Sort
    items = _sort_items(items, sort)

    total = len(items)
    items = items[offset : offset + limit]

    return DiscoveryListResponse(items=items, total=total)
