"""Public static discovery API - read-only, no auth required"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user_optional
from ..models import Membership, StaticGroup, User
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
    FitSchedule,
    FitSummary,
    FitV2,
    FitViewer,
    GoalAlignmentSummarySlim,
)
from ..services.discovery_settings import (
    STATUSES,
    get_discovery,
    is_discoverable,
    normalize_status,
)
from ..services.finder_fit import (
    best_match_key,
    compute_fit_v2,
    compute_role_fit,
    compute_schedule_fit,
    in_day_group,
    listing_day_codes,
    recruit_entries,
)
from ..services.finder_inputs import FitInputs, load_fit_inputs
from ..services.fit_score import compute_fit_summary
from ..services.goal_matching import compute_alignment

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

SortOption = Literal["recent", "members", "name", "best"]
RoleKey = Literal["tank", "healer", "melee", "ranged", "caster"]
DayGroup = Literal["weeknights", "weekends"]


def _response_status(discovery: dict) -> str:
    """The listing's `recruitmentStatus` as V1 reads it: an explicit string (including
    `"limited"`) passes through unchanged; missing, empty or non-string reads as open
    (R-RH-A). Listed rows are open or selective by `is_discoverable`, so no default is closed."""
    raw = discovery.get("recruitmentStatus")
    return raw if isinstance(raw, str) and raw.strip() else "open"


def _matches_list_filter(value: str | None, candidates: list[str] | None) -> bool:
    """Check if value appears in the candidate list (case-insensitive)."""
    if not candidates:
        return False
    return value.lower() in [c.lower() for c in candidates]


def _matches_string_filter(filter_val: str, field_val: str | None) -> bool:
    if not field_val:
        return False
    return filter_val.lower() == field_val.lower()


def _matches_status_filter(filter_val: str, raw_status: object) -> bool:
    """`?recruitmentStatus=` against the normalised stored status: V2's `selective`
    finds a legacy `limited` listing and V1's `limited` finds a `selective` one. A
    query outside the known statuses matches nothing (it never reads as open)."""
    wanted = filter_val.lower()
    if wanted == "limited":
        wanted = "selective"
    if wanted not in STATUSES:
        return False
    return normalize_status(raw_status) == wanted


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
    fit_v2: FitV2 | None = None,
    static_id: str | None = None,
    recruitment_status: str = "open",
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
        recruitment_status=recruitment_status,
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


def _best_key(item: DiscoveryListItem) -> tuple[int, int]:
    """`sort=best` key from the item's own fitV2 (R-SF-G); an item without one sorts as unknown."""
    fit = item.fit_v2
    if fit is None:
        return best_match_key("unknown", [])
    return best_match_key(fit.tier, [{"status": reason.status} for reason in fit.reasons])


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

    # Load current user's profile + data for alignment and fit scoring (if authenticated).
    # R-SF-E: with fitV2 the viewer's own inputs load whatever the visibility, because
    # only the viewer sees their fit. V1's fit keeps its discoverable-only gate below.
    # Languages and comms are not read from the profile (spec §9).
    user_languages: list[str] = []
    user_comms: str | None = None
    inputs = FitInputs()
    if current_user:
        loaded = await load_fit_inputs(
            session,
            [current_user.id],
            discoverable_only=not fit_v2_active,
            availability_always=fit_v2_active,
            viewer_tz=viewer_tz,
        )
        inputs = loaded[current_user.id]
    user_profile = inputs.profile
    user_public_goals = inputs.public_goals
    user_player_jobs = inputs.player_jobs
    user_availability = inputs.availability
    user_public_bis = inputs.public_bis
    viewer_jobs = inputs.viewer_jobs
    template_days = inputs.template_days
    display_zone = inputs.display_zone

    # V1's fitSummary and goalAlignment stay discoverable-only (R-SF-E).
    v1_fit_enabled = user_profile is not None and user_profile.visibility == "discoverable"
    missing: list[str] = inputs.missing if fit_v2_active else []
    if goal_category:
        # A comma-separated list matches any value; a single value behaves as before (R-SF-A).
        wanted_categories = [c.strip() for c in goal_category.split(",") if c.strip()]
    else:
        wanted_categories = []

    items: list[DiscoveryListItem] = []
    for group, member_count in rows:
        if not is_discoverable(group):
            continue

        discovery = get_discovery(group.settings)
        assert discovery is not None
        # The response keeps the raw stored string (R-RH-A); the status filter below
        # compares normalised values, so a non-string stored status can't 500 it.
        response_status = _response_status(discovery)

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
        if recruitment_status and not _matches_status_filter(
            recruitment_status, discovery.get("recruitmentStatus")
        ):
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
            fit_v2_obj = FitV2.from_raw(raw_v2)
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

        items.append(_to_list_item(
            group, discovery, member_count, categories, goal_alignment, fit_summary,
            fit_v2=fit_v2_obj, static_id=group.id if fit_v2_active else None,
            recruitment_status=response_status,
        ))

    # Sort: best = tier rank, then match reasons, then recency (R-SF-G); for guests or
    # without fitV2 it sorts as recent.
    if sort == "best" and fit_v2_active:
        items.sort(key=lambda i: i.last_updated or "", reverse=True)
        items.sort(key=_best_key)
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
