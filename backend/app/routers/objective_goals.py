"""API router for static-group objective goals (raid/progression objectives)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
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
            "category": g.category,
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
                "category": g.category,
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
