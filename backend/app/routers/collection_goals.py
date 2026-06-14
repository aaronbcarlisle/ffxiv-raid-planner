"""API router for static-group collection goals (mounts, tokens, minions, etc.)"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.collection_goal import CollectionGoal
from ..permissions import NotFound, get_static_group, require_can_manage_members, require_membership
from ..schemas.collection_goals import CollectionGoalCreate, CollectionGoalResponse, CollectionGoalUpdate

router = APIRouter(prefix="/api", tags=["collection-goals"])
logger = get_logger(__name__)


@router.get(
    "/static-groups/{group_id}/collection-goals",
    response_model=list[CollectionGoalResponse],
)
async def list_collection_goals(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[CollectionGoal]:
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    result = await session.execute(
        select(CollectionGoal)
        .where(CollectionGoal.static_group_id == group_id)
        .order_by(CollectionGoal.created_at)
    )
    return list(result.scalars().all())


@router.post(
    "/static-groups/{group_id}/collection-goals",
    response_model=CollectionGoalResponse,
    status_code=201,
)
async def create_collection_goal(
    group_id: str,
    body: CollectionGoalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoal:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    now = datetime.now(timezone.utc).isoformat()
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        goal_type=body.goal_type,
        content_type=body.content_type,
        content_key=body.content_key,
        title=body.title,
        status=body.status,
        summary=body.summary,
        linked_duty_id=body.linked_duty_id,
        linked_reward_id=body.linked_reward_id,
        target_count=body.target_count,
        current_count=body.current_count,
        note=body.note,
        created_at=now,
        updated_at=now,
        completed_at=None,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    logger.info("collection_goal_created", group_id=group_id, goal_id=goal.id, goal_type=goal.goal_type)
    return goal


@router.put(
    "/static-groups/{group_id}/collection-goals/{goal_id}",
    response_model=CollectionGoalResponse,
)
async def update_collection_goal(
    group_id: str,
    goal_id: str,
    body: CollectionGoalUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoal:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(CollectionGoal).where(
            CollectionGoal.id == goal_id,
            CollectionGoal.static_group_id == group_id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Collection goal not found")

    now = datetime.now(timezone.utc).isoformat()
    data = body.model_dump(exclude_unset=True)

    # Auto-set completed_at when transitioning to complete
    if data.get("status") == "complete" and goal.status != "complete":
        data.setdefault("completed_at", now)
    elif data.get("status") and data["status"] != "complete":
        data["completed_at"] = None

    for key, value in data.items():
        setattr(goal, key, value)
    goal.updated_at = now

    await session.commit()
    await session.refresh(goal)
    return goal


@router.delete(
    "/static-groups/{group_id}/collection-goals/{goal_id}",
    status_code=204,
)
async def delete_collection_goal(
    group_id: str,
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    result = await session.execute(
        select(CollectionGoal).where(
            CollectionGoal.id == goal_id,
            CollectionGoal.static_group_id == group_id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Collection goal not found")

    await session.delete(goal)
    await session.commit()
    logger.info("collection_goal_deleted", group_id=group_id, goal_id=goal_id)
