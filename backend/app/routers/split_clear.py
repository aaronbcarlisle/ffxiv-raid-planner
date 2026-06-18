"""Split Clear Planner endpoints"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user
from ..models import SnapshotPlayer, TierSnapshot, User
from ..models.player_character import PlayerCharacter
from ..models.player_profile import PlayerProfile
from ..models.split_clear import SplitClearAssignment
from ..models.static_character_registration import StaticCharacterRegistration
from ..models.static_group import StaticGroup
from ..permissions import (
    NotFound,
    check_view_permission,
    get_static_group,
    require_can_edit_roster,
)
from ..schemas.split_clear import (
    SplitCharacterResponse,
    SplitClearAssignmentResponse,
    SplitClearAssignmentUpdate,
    SplitClearResponse,
    SplitClearSettingsUpdate,
)

router = APIRouter(prefix="/api", tags=["split-clear"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _char_to_split_response(char: PlayerCharacter) -> SplitCharacterResponse:
    """Convert a PlayerCharacter to the split-clear character response shape."""
    last_synced_at: str | None = None
    sync_source: str | None = None

    if char.gear_snapshots:
        # Pick the most recently active snapshot (prefer plugin seen time)
        def _key(gs):  # type: ignore[no-untyped-def]
            return max(gs.last_plugin_seen_at or "", gs.synced_at or "")

        most_recent = max(char.gear_snapshots, key=_key, default=None)
        if most_recent:
            if most_recent.last_plugin_seen_at and (
                not most_recent.synced_at
                or most_recent.last_plugin_seen_at > most_recent.synced_at
            ):
                last_synced_at = most_recent.last_plugin_seen_at
                sync_source = "plugin"
            elif most_recent.synced_at:
                last_synced_at = most_recent.synced_at
                sync_source = most_recent.source

    return SplitCharacterResponse(
        id=char.id,
        name=char.name,
        server=char.server,
        data_center=char.data_center,
        is_main=char.is_main,
        last_synced_at=last_synced_at,
        sync_source=sync_source,
    )


def _assignment_to_response(a: SplitClearAssignment) -> SplitClearAssignmentResponse:
    return SplitClearAssignmentResponse(
        id=a.id,
        snapshot_player_id=a.snapshot_player_id,
        run_a_character_link_id=a.run_a_character_link_id,
        run_b_character_link_id=a.run_b_character_link_id,
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


async def _load_player_characters(
    session: AsyncSession, group_id: str
) -> dict[str, list[SplitCharacterResponse]]:
    """Return linked characters for every player in the group's active tier.

    Prefers StaticCharacterRegistration (curated per-static list) when available.
    Falls back to all PlayerHub characters from the player's profile when no
    registrations exist for that player.
    """
    players_result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.is_active == True,  # noqa: E712
        )
    )
    players = players_result.scalars().all()
    if not players:
        return {}

    player_ids = [p.id for p in players]

    # Load static character registrations for these players
    reg_result = await session.execute(
        select(StaticCharacterRegistration)
        .where(
            StaticCharacterRegistration.static_group_id == group_id,
            StaticCharacterRegistration.snapshot_player_id.in_(player_ids),
            StaticCharacterRegistration.player_character_id.is_not(None),
        )
        .options(
            selectinload(StaticCharacterRegistration.player_character).selectinload(
                PlayerCharacter.gear_snapshots
            )
        )
        .order_by(
            StaticCharacterRegistration.snapshot_player_id,
            StaticCharacterRegistration.is_primary_for_static.desc(),
            StaticCharacterRegistration.created_at.asc(),
        )
    )
    regs = reg_result.scalars().all()

    # Group registrations by player
    regs_by_player: dict[str, list[StaticCharacterRegistration]] = {}
    for reg in regs:
        regs_by_player.setdefault(reg.snapshot_player_id, []).append(reg)

    # For players without registrations, fall back to all PlayerHub chars
    user_ids_for_fallback = list({
        p.user_id
        for p in players
        if p.user_id and p.id not in regs_by_player
    })
    user_profile_map: dict[str, PlayerProfile] = {}
    if user_ids_for_fallback:
        profiles_result = await session.execute(
            select(PlayerProfile)
            .options(
                selectinload(PlayerProfile.characters).selectinload(PlayerCharacter.gear_snapshots)
            )
            .where(PlayerProfile.user_id.in_(user_ids_for_fallback))
        )
        user_profile_map = {p.user_id: p for p in profiles_result.scalars().all()}

    out: dict[str, list[SplitCharacterResponse]] = {}
    for player in players:
        if player.id in regs_by_player:
            # Use curated static registrations (primary first, then alts)
            chars = [
                reg.player_character
                for reg in regs_by_player[player.id]
                if reg.player_character is not None
            ]
            if chars:
                out[player.id] = [_char_to_split_response(c) for c in chars]
        elif player.user_id and player.user_id in user_profile_map:
            # Fallback: all characters from PlayerHub profile
            profile = user_profile_map[player.user_id]
            out[player.id] = [_char_to_split_response(c) for c in profile.characters]

    return out


async def _validate_character_ownership(
    session: AsyncSession,
    player: SnapshotPlayer,
    character_link_id: str,
    field_label: str,
) -> None:
    """Raise 422 if the character does not belong to the roster player's user."""
    if not player.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{field_label}: roster player has no linked user — cannot use character link",
        )
    char_result = await session.execute(
        select(PlayerCharacter)
        .join(PlayerProfile, PlayerCharacter.profile_id == PlayerProfile.id)
        .where(
            PlayerCharacter.id == character_link_id,
            PlayerProfile.user_id == player.user_id,
        )
    )
    if not char_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{field_label}: character does not belong to this roster player",
        )


@router.get(
    "/static-groups/{group_id}/split-clear",
    response_model=SplitClearResponse,
)
async def get_split_clear(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user),
) -> SplitClearResponse:
    """Get split-clear mode status, all assignments, and linked characters for the active tier."""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    result = await session.execute(
        select(SplitClearAssignment).where(SplitClearAssignment.static_group_id == group_id)
    )
    assignments = result.scalars().all()

    player_characters = await _load_player_characters(session, group_id)

    return SplitClearResponse(
        enabled=_split_clear_enabled(group),
        assignments=[_assignment_to_response(a) for a in assignments],
        player_characters=player_characters,
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
    player_characters = await _load_player_characters(session, group_id)

    return SplitClearResponse(
        enabled=data.enabled,
        assignments=[_assignment_to_response(a) for a in assignments],
        player_characters=player_characters,
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

    # A player from another static must never be attachable to this plan.
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

    fields = data.model_fields_set

    # Validate character link ownership before touching the DB
    if "run_a_character_link_id" in fields and data.run_a_character_link_id:
        await _validate_character_ownership(
            session, player, data.run_a_character_link_id, "run_a_character_link_id"
        )
    if "run_b_character_link_id" in fields and data.run_b_character_link_id:
        await _validate_character_ownership(
            session, player, data.run_b_character_link_id, "run_b_character_link_id"
        )

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

    for field in (
        "run_a_character_link_id",
        "run_b_character_link_id",
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
