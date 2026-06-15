"""API router for static-group objective goals (raid/progression objectives)."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.player_goal import PlayerGoal
from ..models.static_objective_goal import (
    StaticObjectiveGoal,
    VALID_OBJECTIVE_CATEGORIES,
    VALID_OBJECTIVE_PRIORITIES,
)
from ..models.membership import Membership
from ..models.player_profile import PlayerProfile
from ..models.user import User as UserModel
from ..models.collection_goal import CollectionGoal
from ..models.join_request import JoinRequest
from ..models.schedule import ScheduleSession
from ..models.tier_snapshot import TierSnapshot
from ..models.snapshot_player import SnapshotPlayer
from ..models.bis_target_set import BiSTargetSet
from ..permissions import NotFound, get_static_group, require_can_manage_members, require_membership
from ..schemas.objective_goals import (
    StaticObjectiveGoalCreate,
    StaticObjectiveGoalResponse,
    StaticObjectiveGoalUpdate,
)
from ..schemas.player import GoalAlignmentItem, GoalAlignmentResponse, GoalAlignmentSummary
from ..services.goal_matching import compute_alignment

router = APIRouter(prefix="/api", tags=["objective-goals"])
logger = get_logger(__name__)


def _goal_to_response(goal: StaticObjectiveGoal) -> StaticObjectiveGoalResponse:
    return StaticObjectiveGoalResponse(
        id=goal.id,
        static_group_id=goal.static_group_id,
        created_by_id=goal.created_by_id,
        category=goal.category,
        title=goal.title,
        description=goal.description,
        priority=goal.priority,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


@router.get(
    "/static-groups/{group_id}/objective-goals",
    response_model=list[StaticObjectiveGoalResponse],
)
async def list_objective_goals(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[StaticObjectiveGoalResponse]:
    """List objective goals for a static group. Requires membership."""
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    result = await session.execute(
        select(StaticObjectiveGoal)
        .where(StaticObjectiveGoal.static_group_id == group_id)
        .order_by(StaticObjectiveGoal.created_at)
    )
    goals = result.scalars().all()
    return [_goal_to_response(g) for g in goals]


@router.post(
    "/static-groups/{group_id}/objective-goals",
    response_model=StaticObjectiveGoalResponse,
    status_code=201,
)
async def create_objective_goal(
    group_id: str,
    body: StaticObjectiveGoalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticObjectiveGoalResponse:
    """Create a new objective goal for a static group. Requires lead or owner."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    if body.category not in VALID_OBJECTIVE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_OBJECTIVE_CATEGORIES))}",
        )
    if body.priority not in VALID_OBJECTIVE_PRIORITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid priority. Must be one of: {', '.join(sorted(VALID_OBJECTIVE_PRIORITIES))}",
        )

    now = datetime.now(timezone.utc).isoformat()
    goal = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        category=body.category,
        title=body.title,
        description=body.description,
        priority=body.priority,
        created_at=now,
        updated_at=now,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    logger.info(
        "objective_goal_created",
        group_id=group_id,
        goal_id=goal.id,
        category=goal.category,
        priority=goal.priority,
    )
    return _goal_to_response(goal)


@router.patch(
    "/static-groups/{group_id}/objective-goals/{goal_id}",
    response_model=StaticObjectiveGoalResponse,
)
async def update_objective_goal(
    group_id: str,
    goal_id: str,
    body: StaticObjectiveGoalUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticObjectiveGoalResponse:
    """Update an objective goal. Requires lead or owner."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(StaticObjectiveGoal).where(
            StaticObjectiveGoal.id == goal_id,
            StaticObjectiveGoal.static_group_id == group_id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Objective goal not found")

    if body.priority is not None and body.priority not in VALID_OBJECTIVE_PRIORITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid priority. Must be one of: {', '.join(sorted(VALID_OBJECTIVE_PRIORITIES))}",
        )

    now = datetime.now(timezone.utc).isoformat()
    if body.title is not None:
        goal.title = body.title
    if body.description is not None:
        goal.description = body.description
    if body.priority is not None:
        goal.priority = body.priority
    goal.updated_at = now

    await session.commit()
    await session.refresh(goal)

    logger.info("objective_goal_updated", group_id=group_id, goal_id=goal_id)
    return _goal_to_response(goal)


@router.delete(
    "/static-groups/{group_id}/objective-goals/{goal_id}",
    status_code=204,
)
async def delete_objective_goal(
    group_id: str,
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an objective goal. Requires lead or owner."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(StaticObjectiveGoal).where(
            StaticObjectiveGoal.id == goal_id,
            StaticObjectiveGoal.static_group_id == group_id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Objective goal not found")

    await session.delete(goal)
    await session.commit()
    logger.info("objective_goal_deleted", group_id=group_id, goal_id=goal_id)


@router.get(
    "/static-groups/{group_id}/goal-alignment",
    response_model=GoalAlignmentResponse,
)
async def get_goal_alignment(
    group_id: str,
    profile_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GoalAlignmentResponse:
    """Compute goal alignment between a player profile and the static's objectives.

    Any member of the static can request alignment for any profile_id.
    Only the player's public goals (is_public=True) are included.
    """
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    # Fetch static objective goals
    result = await session.execute(
        select(StaticObjectiveGoal)
        .where(StaticObjectiveGoal.static_group_id == group_id)
        .order_by(StaticObjectiveGoal.created_at)
    )
    static_goals = result.scalars().all()

    # Fetch only public player goals for the given profile
    result = await session.execute(
        select(PlayerGoal).where(
            PlayerGoal.profile_id == profile_id,
            PlayerGoal.is_public == True,  # noqa: E712
        )
    )
    player_goals = result.scalars().all()

    static_dicts = [
        {
            "id": g.id,
            "category": g.category,
            "priority": g.priority,
            "title": g.title,
        }
        for g in static_goals
    ]
    player_dicts = [
        {
            "id": g.id,
            "goal_type": g.goal_type,
            "category": g.objective_category or g.category,
            "intent_level": g.intent_level,
        }
        for g in player_goals
    ]

    result_data = compute_alignment(player_dicts, static_dicts)
    summary = result_data["summary"]
    items = result_data["items"]

    return GoalAlignmentResponse(
        summary=GoalAlignmentSummary(
            aligned=summary["aligned"],
            partial=summary["partial"],
            conflicts=summary["conflicts"],
            missing=summary["missing"],
            unknown=summary["unknown"],
        ),
        items=[
            GoalAlignmentItem(
                category=item["category"],
                static_title=item["staticTitle"],
                player_intent=item["playerIntent"],
                static_priority=item["staticPriority"],
                status=item["status"],
            )
            for item in items
        ],
    )


# ---------------------------------------------------------------------------
# Roster alignment — per-member summary for leads/owners
# ---------------------------------------------------------------------------

class RosterMemberAlignment(GoalAlignmentSummary):
    """GoalAlignmentSummary extended with member identity for roster view."""
    user_id: str
    profile_id: str | None
    display_name: str | None


@router.get(
    "/static-groups/{group_id}/roster-alignment",
    response_model=list[RosterMemberAlignment],
)
async def get_roster_alignment(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[RosterMemberAlignment]:
    """Compute goal alignment summary for every member of the static.

    Only includes members who have a public player profile with at least one
    public goal. Members with no public goals get a null-equivalent summary
    (all zeros). Requires lead or owner — members should not see each other's
    goal alignment breakdowns.

    Private goals are never included.
    """
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    # Fetch static objective goals once
    og_result = await session.execute(
        select(StaticObjectiveGoal)
        .where(StaticObjectiveGoal.static_group_id == group_id)
        .order_by(StaticObjectiveGoal.created_at)
    )
    static_goals = [
        {"id": g.id, "category": g.category, "priority": g.priority, "title": g.title}
        for g in og_result.scalars().all()
    ]

    # Fetch all members with their user info
    member_result = await session.execute(
        select(Membership, UserModel)
        .join(UserModel, UserModel.id == Membership.user_id)
        .where(Membership.static_group_id == group_id)
    )
    rows = member_result.all()

    out: list[RosterMemberAlignment] = []
    for membership, user in rows:
        # Try to find a public profile for this user
        profile_result = await session.execute(
            select(PlayerProfile)
            .where(
                PlayerProfile.user_id == user.id,
                PlayerProfile.visibility == "discoverable",
            )
            .limit(1)
        )
        profile = profile_result.scalar_one_or_none()

        if profile is None or not static_goals:
            out.append(RosterMemberAlignment(
                user_id=user.id,
                profile_id=None,
                display_name=getattr(user, "display_name", None),
                aligned=0, partial=0, conflicts=0, missing=0, unknown=0,
            ))
            continue

        # Fetch public goals for this profile
        goal_result = await session.execute(
            select(PlayerGoal).where(
                PlayerGoal.profile_id == profile.id,
                PlayerGoal.is_public == True,  # noqa: E712
            )
        )
        player_goals = [
            {
                "id": g.id,
                "goal_type": g.goal_type,
                "category": g.objective_category or g.category,
                "intent_level": g.intent_level,
            }
            for g in goal_result.scalars().all()
        ]

        alignment = compute_alignment(player_goals, static_goals)
        s = alignment["summary"]
        out.append(RosterMemberAlignment(
            user_id=user.id,
            profile_id=profile.id,
            display_name=getattr(user, "display_name", None),
            aligned=s["aligned"],
            partial=s["partial"],
            conflicts=s["conflicts"],
            missing=s["missing"],
            unknown=s["unknown"],
        ))

    return out


# ---------------------------------------------------------------------------
# Objective Command Center — per-objective aggregate card data
# ---------------------------------------------------------------------------

# Farm-like categories that should be linked to a CollectionGoal
_FARM_CATEGORIES = frozenset({
    "savage_mount",
    "loot_farm",
    "mount_farm",
    "gil_farm",
})

# Category → collection goal_type affinities for matching
_CATEGORY_COLLECTION_AFFINITY: dict[str, frozenset[str]] = {
    "savage_mount":  frozenset({"mount", "token", "clear_count"}),
    "mount_farm":    frozenset({"mount", "token"}),
    "loot_farm":     frozenset({"token", "weapon", "weapon_coffer", "clear_count"}),
    "gil_farm":      frozenset({"custom_reward"}),
}


class _RosterReadiness(BaseModel):
    ready: int
    total: int


class _GoalAlignment(BaseModel):
    aligned: int
    partial: int
    conflicts: int


class _BiSReadiness(BaseModel):
    ready: int
    missing: int


class _LinkedCollectionGoal(BaseModel):
    id: str
    title: str
    progress: int | None
    target: int | None


class _NextSession(BaseModel):
    id: str
    date: str
    title: str


class ObjectiveCommandCard(BaseModel):
    id: str
    title: str
    category: str
    priority: str
    roster_readiness: _RosterReadiness
    goal_alignment: _GoalAlignment
    bis_readiness: _BiSReadiness | None
    linked_collection_goal: _LinkedCollectionGoal | None
    next_session: _NextSession | None
    next_action: str
    next_action_target: str | None


def _compute_next_action(
    roster_readiness: _RosterReadiness,
    has_open_join_requests: bool,
    next_session: _NextSession | None,
    category: str,
    linked_collection_goal: _LinkedCollectionGoal | None,
    bis_readiness: _BiSReadiness | None,
) -> tuple[str, str | None]:
    """Return (next_action label, next_action_target) following priority rules."""
    # 1. Roster conflicts (non-configured players)
    non_configured = roster_readiness.total - roster_readiness.ready
    if non_configured > 0:
        return ("Review roster fit", "roster")

    # 2. Open join requests matching this category
    if has_open_join_requests:
        return ("Review applicants", "applicants")

    # 3. No next session
    if next_session is None:
        return ("Schedule session", "schedule")

    # 4. Farm-like category with no linked collection goal
    if category in _FARM_CATEGORIES and linked_collection_goal is None:
        return ("Link farm tracker", "collection")

    # 5. BiS readiness with many missing
    if bis_readiness is not None and bis_readiness.missing > 2:
        return ("Review BiS readiness", "bis")

    return ("Ready for next raid", None)


@router.get(
    "/static-groups/{group_id}/objective-command",
    response_model=list[ObjectiveCommandCard],
)
async def get_objective_command(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ObjectiveCommandCard]:
    """Aggregate per-objective card data for the Objective Command Center.

    Requires membership (member/lead/owner). Returns up to 5 cards for
    non-'not_doing' objectives. Only public goals and public BiS targets
    are included — private player data is never exposed.
    """
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    # ── Fetch objectives ────────────────────────────────────────────────────
    obj_result = await session.execute(
        select(StaticObjectiveGoal)
        .where(StaticObjectiveGoal.static_group_id == group_id)
        .order_by(StaticObjectiveGoal.created_at)
    )
    all_objectives = obj_result.scalars().all()
    active = [o for o in all_objectives if o.priority != "not_doing"][:5]

    if not active:
        return []

    # ── Roster readiness (active tier snapshot) ─────────────────────────────
    tier_result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    active_tier = tier_result.scalar_one_or_none()

    roster_total = 0
    roster_ready = 0
    player_ids: list[str] = []

    if active_tier:
        player_result = await session.execute(
            select(SnapshotPlayer)
            .where(
                SnapshotPlayer.tier_snapshot_id == active_tier.id,
                SnapshotPlayer.is_substitute == False,  # noqa: E712
            )
        )
        players = player_result.scalars().all()
        roster_total = len(players)
        roster_ready = sum(1 for p in players if p.configured)
        player_ids = [p.id for p in players]

    roster_readiness = _RosterReadiness(ready=roster_ready, total=roster_total)

    # ── Open join requests (pending / under_review) ─────────────────────────
    jr_result = await session.execute(
        select(JoinRequest).where(
            JoinRequest.static_group_id == group_id,
            JoinRequest.status.in_(["pending", "under_review"]),
        )
    )
    open_join_requests = jr_result.scalars().all()
    has_open_jr = len(open_join_requests) > 0

    # ── Next future session ──────────────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    sess_result = await session.execute(
        select(ScheduleSession)
        .where(
            ScheduleSession.static_group_id == group_id,
            ScheduleSession.start_time >= now_iso,
        )
        .order_by(ScheduleSession.start_time)
        .limit(1)
    )
    next_sched = sess_result.scalar_one_or_none()
    next_session_obj: _NextSession | None = None
    if next_sched:
        next_session_obj = _NextSession(
            id=next_sched.id,
            date=next_sched.start_time,
            title=next_sched.title,
        )

    # ── Collection goals ─────────────────────────────────────────────────────
    cg_result = await session.execute(
        select(CollectionGoal)
        .where(
            CollectionGoal.static_group_id == group_id,
            CollectionGoal.status != "complete",
        )
    )
    collection_goals = cg_result.scalars().all()

    # ── Public BiS targets on roster players ────────────────────────────────
    public_bis_count = 0
    if player_ids:
        bis_result = await session.execute(
            select(BiSTargetSet).where(
                BiSTargetSet.snapshot_player_id.in_(player_ids),
                BiSTargetSet.is_public == True,  # noqa: E712
                BiSTargetSet.is_active == True,  # noqa: E712
            )
        )
        public_bis_targets = bis_result.scalars().all()
        public_bis_count = len(public_bis_targets)

    # ── Goal alignment (public goals only across all members) ───────────────
    # Fetch all members of the group
    member_result = await session.execute(
        select(Membership)
        .where(Membership.static_group_id == group_id)
    )
    members = member_result.scalars().all()
    member_user_ids = [m.user_id for m in members]

    # Fetch discoverable profiles for those users
    profile_result = await session.execute(
        select(PlayerProfile)
        .where(
            PlayerProfile.user_id.in_(member_user_ids),
            PlayerProfile.visibility == "discoverable",
        )
    )
    member_profiles = profile_result.scalars().all()
    profile_ids = [p.id for p in member_profiles]

    # Fetch public player goals for those profiles
    all_player_goals: list[dict[str, Any]] = []
    if profile_ids:
        pg_result = await session.execute(
            select(PlayerGoal).where(
                PlayerGoal.profile_id.in_(profile_ids),
                PlayerGoal.is_public == True,  # noqa: E712
            )
        )
        for g in pg_result.scalars().all():
            all_player_goals.append({
                "id": g.id,
                "goal_type": g.goal_type,
                "category": getattr(g, "objective_category", None) or g.category,
                "intent_level": g.intent_level,
            })

    # ── Build cards ──────────────────────────────────────────────────────────
    cards: list[ObjectiveCommandCard] = []
    for obj in active:
        # Goal alignment for this objective using public goals only
        static_dict = [{
            "id": obj.id,
            "category": obj.category,
            "priority": obj.priority,
            "title": obj.title,
        }]
        alignment = compute_alignment(all_player_goals, static_dict)
        s = alignment["summary"]
        goal_alignment = _GoalAlignment(
            aligned=s["aligned"],
            partial=s["partial"],
            conflicts=s["conflicts"],
        )

        # BiS readiness — only when public bis targets exist
        bis_readiness: _BiSReadiness | None = None
        if public_bis_count > 0:
            # ready = players with a public active bis target; missing = those without
            players_with_bis = public_bis_count
            missing = max(0, roster_total - players_with_bis)
            bis_readiness = _BiSReadiness(ready=min(players_with_bis, roster_total), missing=missing)

        # Linked collection goal — match by category affinity
        linked_cg: _LinkedCollectionGoal | None = None
        affinity_types = _CATEGORY_COLLECTION_AFFINITY.get(obj.category, frozenset())
        if affinity_types:
            for cg in collection_goals:
                if cg.goal_type in affinity_types:
                    linked_cg = _LinkedCollectionGoal(
                        id=cg.id,
                        title=cg.title,
                        progress=cg.current_count,
                        target=cg.target_count,
                    )
                    break

        next_action, next_action_target = _compute_next_action(
            roster_readiness=roster_readiness,
            has_open_join_requests=has_open_jr,
            next_session=next_session_obj,
            category=obj.category,
            linked_collection_goal=linked_cg,
            bis_readiness=bis_readiness,
        )

        cards.append(ObjectiveCommandCard(
            id=obj.id,
            title=obj.title,
            category=obj.category,
            priority=obj.priority,
            roster_readiness=roster_readiness,
            goal_alignment=goal_alignment,
            bis_readiness=bis_readiness,
            linked_collection_goal=linked_cg,
            next_session=next_session_obj,
            next_action=next_action,
            next_action_target=next_action_target,
        ))

    return cards
