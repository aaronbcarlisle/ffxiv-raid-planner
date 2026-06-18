"""Split Clear Planner endpoints"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..models import SnapshotPlayer, TierSnapshot, User
from ..models.split_clear import SplitClearAssignment
from ..models.static_group import StaticGroup
from ..permissions import (
    NotFound,
    check_view_permission,
    get_static_group,
    require_can_edit_roster,
)
from ..schemas.split_clear import (
    SplitClearAssignmentResponse,
    SplitClearAssignmentUpdate,
    SplitClearResponse,
    SplitClearSettingsUpdate,
)

router = APIRouter(prefix="/api", tags=["split-clear"])

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _assignment_to_response(a: SplitClearAssignment) -> SplitClearAssignmentResponse:
    return SplitClearAssignmentResponse(
        id=a.id,
        snapshot_player_id=a.snapshot_player_id,
        main_character_name=a.main_character_name,
        main_character_world=a.main_character_world,
        alt_character_name=a.alt_character_name,
        alt_character_world=a.alt_character_world,
        run_a_character=a.run_a_character,  # type: ignore[arg-type]
        run_b_character=a.run_b_character,  # type: ignore[arg-type]
        loot_target=a.loot_target,
        loot_target_job=a.loot_target_job,
        run_a_cleared=a.run_a_cleared,
        run_b_cleared=a.run_b_cleared,
        notes=a.notes,
        updated_at=a.updated_at,
    )


def _split_clear_enabled(group: StaticGroup) -> bool:
    settings = group.settings or {}
    return bool(settings.get("splitClearMode", False))


@router.get(
    "/static-groups/{group_id}/split-clear",
    response_model=SplitClearResponse,
)
async def get_split_clear(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user),
) -> SplitClearResponse:
    """Get split-clear mode status and all assignments for the current tier's roster."""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    result = await session.execute(
        select(SplitClearAssignment).where(SplitClearAssignment.static_group_id == group_id)
    )
    assignments = result.scalars().all()

    return SplitClearResponse(
        enabled=_split_clear_enabled(group),
        assignments=[_assignment_to_response(a) for a in assignments],
    )


@router.put(
    "/static-groups/{group_id}/split-clear/settings",
    response_model=SplitClearResponse,
)
async def update_split_clear_settings(
    group_id: str,
    data: SplitClearSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SplitClearResponse:
    """Enable or disable split-clear mode (lead or owner only)."""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    group.settings = {**(group.settings or {}), "splitClearMode": data.enabled}
    group.updated_at = _now()
    await session.flush()
    await session.commit()

    result = await session.execute(
        select(SplitClearAssignment).where(SplitClearAssignment.static_group_id == group_id)
    )
    assignments = result.scalars().all()

    return SplitClearResponse(
        enabled=data.enabled,
        assignments=[_assignment_to_response(a) for a in assignments],
    )


@router.patch(
    "/static-groups/{group_id}/split-clear/{player_id}",
    response_model=SplitClearAssignmentResponse,
)
async def upsert_split_clear_assignment(
    group_id: str,
    player_id: str,
    data: SplitClearAssignmentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SplitClearAssignmentResponse:
    """Create or update the split-clear assignment for a roster player (lead or owner only)."""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    if not _split_clear_enabled(group):
        raise HTTPException(status_code=409, detail="Split-clear mode is disabled")

    # A player id from another static must never be attachable to this plan.
    player_result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
        )
    )
    player = player_result.scalar_one_or_none()
    if not player:
        raise NotFound("Player not found")

    result = await session.execute(
        select(SplitClearAssignment).where(
            SplitClearAssignment.static_group_id == group_id,
            SplitClearAssignment.snapshot_player_id == player_id,
        )
    )
    assignment = result.scalar_one_or_none()
    now = _now()

    if assignment is None:
        assignment = SplitClearAssignment(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            snapshot_player_id=player_id,
            created_at=now,
            updated_at=now,
        )
        session.add(assignment)

    fields = data.model_fields_set
    for field in (
        "main_character_name",
        "main_character_world",
        "alt_character_name",
        "alt_character_world",
        "run_a_character",
        "run_b_character",
        "run_a_cleared",
        "run_b_cleared",
        "notes",
    ):
        if field in fields:
            setattr(assignment, field, getattr(data, field))

    next_loot_target = data.loot_target if "loot_target" in fields else assignment.loot_target
    next_loot_target_job = data.loot_target_job if "loot_target_job" in fields else assignment.loot_target_job
    if "loot_target" in fields:
        assignment.loot_target = next_loot_target or "normal"
    assignment.loot_target_job = next_loot_target_job if next_loot_target == "funnel_job" else None
    assignment.updated_at = now

    await session.flush()
    await session.commit()
    return _assignment_to_response(assignment)


@router.post(
    "/static-groups/{group_id}/split-clear/reset-week",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reset_split_clear_week(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark all players as not-cleared for the new week (lead or owner only)."""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(SplitClearAssignment).where(SplitClearAssignment.static_group_id == group_id)
    )
    for assignment in result.scalars().all():
        assignment.run_a_cleared = False
        assignment.run_b_cleared = False
        assignment.updated_at = _now()

    await session.flush()
    await session.commit()
