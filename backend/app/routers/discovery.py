"""Public static discovery API - read-only, no auth required"""

import json
from datetime import UTC, datetime
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
    FinderListItem,
    FitBis,
    FitComms,
    FitCounts,
    FitGoals,
    FitJobs,
    FitNight,
    FitReason,
    FitSchedule,
    FitSummary,
    FitV2,
    FitV2Role,
    FitV2Schedule,
    FitViewer,
    GoalAlignmentSummarySlim,
)
from ..services.availability_layering import TemplateDay
from ..services.finder_fit import (
    ViewerJob,
    best_match_key,
    compute_fit_v2,
    compute_role_fit,
    compute_schedule_fit,
    has_typical_week,
    in_day_group,
    listing_day_codes,
    recruit_entries,
    role_for_job,
    viewer_display_zone,
)
from ..services.fit_score import compute_fit_summary
from ..services.goal_matching import compute_alignment

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

SortOption = Literal["recent", "members", "name", "best"]
RoleKey = Literal["tank", "healer", "melee", "ranged", "caster"]
DayGroup = Literal["weeknights", "weekends"]


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


def _build_fit_v2(raw: dict) -> FitV2:
    """Convert compute_fit_v2() dict output to a FitV2 schema object."""
    role = raw["role"]
    schedule = raw["schedule"]
    return FitV2(
        tier=raw["tier"],
        missing=raw["missing"],
        role=FitV2Role(
            status=role["status"],
            matched_job=role["matched_job"],
            matched_role=role["matched_role"],
            priority=role["priority"],
            is_main=role["is_main"],
            as_role=role["as_role"],
        ),
        schedule=FitV2Schedule(
            status=schedule["status"],
            basis=schedule["basis"],
            nights=[FitNight(**night) for night in schedule["nights"]],
        ),
        reasons=[FitReason(**reason) for reason in raw["reasons"]],
    )


def _template_days(rows: list[PersonalAvailabilityTemplate]) -> list[TemplateDay]:
    """Template rows as the PH3 pipe's TemplateDay; slots that aren't a JSON list read as empty."""
    days: list[TemplateDay] = []
    for row in rows:
        slots: object = row.slots
        if isinstance(slots, str):
            try:
                slots = json.loads(slots)
            except ValueError:
                slots = []
        days.append(
            TemplateDay(
                user_id=row.user_id,
                day_of_week=row.day_of_week,
                slots=tuple(slots) if isinstance(slots, list) else (),
                timezone=row.timezone,
            )
        )
    return days


def _to_list_item(
    group: StaticGroup,
    discovery: dict,
    member_count: int,
    objective_categories: list[str] | None = None,
    goal_alignment: GoalAlignmentSummarySlim | None = None,
    fit_summary: FitSummary | None = None,
    fit_v2: FitV2 | None = None,
    static_id: str | None = None,
) -> DiscoveryListItem:
    contact_method, contact_value = _sanitize_contact(
        discovery.get("contactMethod"), discovery.get("contactValue")
    )
    # Only expose member count when owner explicitly opted in
    show_count = discovery.get("showMemberCount") is True
    # `id` is emitted only on the signed-in fitV2 path (OWNER-3): a FinderListItem
    # carries it, a plain DiscoveryListItem has no `id` key at all.
    item_class = FinderListItem if static_id is not None else DiscoveryListItem
    extra = {"id": static_id} if static_id is not None else {}
    return item_class(
        **extra,
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
        fit_v2=fit_v2,
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
    sort: SortOption = Query("recent", description="Sort: recent, members, name, best (fitV2)"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    fit_v2: bool = Query(
        False, alias="fitV2", description="Compute the Static Finder V2 fit for the viewer"
    ),
    as_role: RoleKey | None = Query(
        None, alias="asRole", description="Match as any job of this role (needs fitV2)"
    ),
    day_group: DayGroup | None = Query(
        None,
        alias="dayGroup",
        description="Keep listings with a raid night in the group, on the viewer's calendar",
    ),
    viewer_tz: str | None = Query(
        None,
        alias="viewerTz",
        description="The viewer's browser IANA zone: the fallback display zone with fitV2",
    ),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> DiscoveryListResponse:
    # asRole, sort=best, viewerTz and the fitV2 fields need fitV2 and a signed-in caller (R-SF-A).
    fit_v2_active = fit_v2 and current_user is not None
    # The `timezone` query parameter shadows datetime.timezone here, hence datetime.UTC (R-SF-C).
    now = datetime.now(UTC)

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
    viewer_jobs: list[ViewerJob] = []
    template_days: list[TemplateDay] = []
    display_zone: str | None = None

    if current_user:
        # R-SF-E: with fitV2 the viewer's own inputs load whatever the visibility, because
        # only the viewer sees their fit. V1's fit keeps its discoverable-only gate below.
        profile_stmt = select(PlayerProfile).where(PlayerProfile.user_id == current_user.id)
        if not fit_v2_active:
            profile_stmt = profile_stmt.where(PlayerProfile.visibility == "discoverable")
        profile_result = await session.execute(profile_stmt.limit(1))
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
            viewer_jobs = [
                ViewerJob(job=j.job, role=j.role or role_for_job(j.job), is_main=index == 0)
                for index, j in enumerate(sorted_jobs)
            ]

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

        if user_profile or fit_v2_active:
            # Personal availability — collect unique days (loaded by user id even with
            # no profile on the fitV2 path, R-SF-E)
            avail_result = await session.execute(
                select(PersonalAvailabilityTemplate).where(
                    PersonalAvailabilityTemplate.user_id == current_user.id,
                )
            )
            avail_rows = list(avail_result.scalars().all())
            if avail_rows:
                user_availability = {"days": [row.day_of_week for row in avail_rows]}
            if fit_v2_active:
                template_days = _template_days(avail_rows)
                display_zone = viewer_display_zone(
                    [(row.timezone, row.updated_at) for row in avail_rows], viewer_tz
                )

    # V1's fitSummary and goalAlignment stay discoverable-only (R-SF-E).
    v1_fit_enabled = user_profile is not None and user_profile.visibility == "discoverable"
    missing: list[str] = []
    if fit_v2_active:
        if not has_typical_week(template_days):
            missing.append("template")
        if not viewer_jobs:
            missing.append("jobs")
    if goal_category:
        # A comma-separated list matches any value; a single value behaves as before (R-SF-A).
        wanted_categories = [c.strip() for c in goal_category.split(",") if c.strip()]
    else:
        wanted_categories = []

    items: list[DiscoveryListItem] = []
    best_keys: dict[int, tuple[int, int]] = {}
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
        if goal_category and not any(c in categories for c in wanted_categories):
            continue

        # Compute goal alignment for authenticated users with public goals (legacy)
        goal_alignment: GoalAlignmentSummarySlim | None = None
        if v1_fit_enabled and user_public_goals and static_goals:
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

        # Compute fit summary for authenticated users with a discoverable profile; the
        # fitV2 path shares its goal, comms and BiS components whatever the visibility.
        fit_summary: FitSummary | None = None
        raw_fit: dict | None = None
        if v1_fit_enabled or fit_v2_active:
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
        if v1_fit_enabled and raw_fit is not None:
            fit_summary = _build_fit_summary(raw_fit)

        fit_v2_obj: FitV2 | None = None
        local_days: list[str] = []
        if fit_v2_active and raw_fit is not None:
            role_fit = compute_role_fit(viewer_jobs, recruit_entries(discovery), as_role)
            schedule_fit = compute_schedule_fit(
                template_days, discovery, now=now, display_zone=display_zone
            )
            raw_v2 = compute_fit_v2(
                role_fit=role_fit,
                schedule_fit=schedule_fit,
                goal_counts=raw_fit["goals"],
                comms_fit=raw_fit["comms"],
                bis_fit=raw_fit["bis"],
                missing=missing,
            )
            # Fit-based filters on the V2 statuses (R-SF-F); hideGoalConflicts works for
            # private profiles too (F4).
            if hide_goal_conflicts and raw_fit["goals"]["conflicts"] > 0:
                continue
            if schedule_overlap and schedule_fit["status"] not in ("match", "partial"):
                continue
            fit_v2_obj = _build_fit_v2(raw_v2)
            local_days = [n["local_day"] for n in schedule_fit["nights"] if n["local_day"]]
        elif v1_fit_enabled and raw_fit is not None:
            # Fit-based filters
            if hide_goal_conflicts and raw_fit["goals"]["conflicts"] > 0:
                continue
            if schedule_overlap and raw_fit["schedule"]["status"] not in ("match", "partial"):
                continue

        # dayGroup on the viewer's calendar when the nights are placed, else the listing's
        # own days; a listing with no days is dropped (SF-7, R-SF-F).
        if day_group and not in_day_group(
            day_group, local_days or listing_day_codes(discovery.get("scheduleDays"))
        ):
            continue

        item = _to_list_item(
            group, discovery, member_count, categories, goal_alignment, fit_summary,
            fit_v2=fit_v2_obj, static_id=group.id if fit_v2_active else None,
        )
        if fit_v2_obj is not None:
            best_keys[id(item)] = best_match_key(raw_v2["tier"], raw_v2["reasons"])
        items.append(item)

    # Sort: best = tier rank, then match reasons, then recency (R-SF-G); for guests or
    # without fitV2 it sorts as recent.
    if sort == "best" and fit_v2_active:
        items.sort(key=lambda i: i.last_updated or "", reverse=True)
        items.sort(key=lambda i: best_keys[id(i)])
    else:
        items = _sort_items(items, "recent" if sort == "best" else sort)

    # fitCounts over the whole filtered list, before pagination (R-SF-F)
    fit_counts: FitCounts | None = None
    viewer: FitViewer | None = None
    if fit_v2_active:
        tally = {"strong": 0, "good": 0, "partial": 0, "weak": 0, "unknown": 0}
        for item in items:
            if item.fit_v2 is not None:
                tally[item.fit_v2.tier] += 1
        fit_counts = FitCounts(**tally)
        viewer = FitViewer(
            main_job=viewer_jobs[0].job if viewer_jobs else None,
            main_role=viewer_jobs[0].role if viewer_jobs else None,
            missing=missing,
        )

    total = len(items)
    items = items[offset : offset + limit]

    return DiscoveryListResponse(items=items, total=total, fit_counts=fit_counts, viewer=viewer)
