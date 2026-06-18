"""Static Character Registrations — shared character identity layer.

Lets roster players register their Player Hub characters (or manual
fallback characters) for a specific static.  These registrations are the
canonical source for:
  - Split Planner character candidates
  - Roster character badges / management UI
  - (V2) Loot log recipient character
  - (V2) Summary main-only vs include-alts aggregation
"""

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user
from ..models import SnapshotPlayer, User
from ..models.player_character import PlayerCharacter
from ..models.player_profile import PlayerProfile
from ..models.snapshot_player import SnapshotPlayer as _SnapshotPlayer
from ..models.static_character_registration import StaticCharacterRegistration
from ..models.static_group import StaticGroup
from ..models.tier_snapshot import TierSnapshot as _TierSnapshot
from ..permissions import (
    NotFound,
    check_view_permission,
    get_static_group,
    require_can_edit_roster,
)
from ..schemas.static_characters import (
    CharacterRegistrationCreate,
    CharacterRegistrationResponse,
    CharacterRegistrationUpdate,
    LinkedCharacterSummary,
    StaticCharacterRegistrationsResponse,
)

router = APIRouter(prefix="/api", tags=["static-characters"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _reg_to_response(reg: StaticCharacterRegistration) -> CharacterRegistrationResponse:
    linked: LinkedCharacterSummary | None = None
    resolved_name: str | None = None
    resolved_world: str | None = None
    resolved_dc: str | None = None

    if reg.player_character:
        char = reg.player_character
        last_synced_at: str | None = None
        if char.gear_snapshots:
            def _key(gs):  # type: ignore[no-untyped-def]
                return max(gs.last_plugin_seen_at or "", gs.synced_at or "")
            most_recent = max(char.gear_snapshots, key=_key, default=None)
            if most_recent:
                last_synced_at = most_recent.last_plugin_seen_at or most_recent.synced_at

        linked = LinkedCharacterSummary(
            id=char.id,
            name=char.name,
            server=char.server,
            data_center=char.data_center,
            is_main=char.is_main,
            avatar_url=char.avatar_url,
            last_synced_at=last_synced_at,
        )
        resolved_name = char.name
        resolved_world = char.server
        resolved_dc = char.data_center
    else:
        resolved_name = reg.manual_character_name
        resolved_world = reg.manual_world
        resolved_dc = reg.manual_data_center

    return CharacterRegistrationResponse(
        id=reg.id,
        static_group_id=reg.static_group_id,
        snapshot_player_id=reg.snapshot_player_id,
        player_character_id=reg.player_character_id,
        manual_character_name=reg.manual_character_name,
        manual_world=reg.manual_world,
        manual_data_center=reg.manual_data_center,
        role_in_static=reg.role_in_static,
        job=reg.job,
        is_primary_for_static=reg.is_primary_for_static,
        source=reg.source,
        last_synced_at=reg.last_synced_at,
        created_at=reg.created_at,
        updated_at=reg.updated_at,
        resolved_name=resolved_name,
        resolved_world=resolved_world,
        resolved_data_center=resolved_dc,
        linked_character=linked,
    )


async def _get_group_and_player(
    session: AsyncSession,
    group_id: str,
    player_id: str,
) -> tuple[StaticGroup, SnapshotPlayer]:
    group = await get_static_group(session, group_id)
    result = await session.execute(
        select(SnapshotPlayer).where(SnapshotPlayer.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise NotFound("Roster player not found")
    # Confirm player belongs to this static (via any tier snapshot)
    snap_result = await session.execute(
        select(_TierSnapshot).where(
            _TierSnapshot.id == player.tier_snapshot_id,
            _TierSnapshot.static_group_id == group_id,
        )
    )
    if not snap_result.scalar_one_or_none():
        raise NotFound("Roster player not found in this static")
    return group, player


async def _validate_character_belongs_to_player(
    session: AsyncSession,
    player: SnapshotPlayer,
    player_character_id: str,
) -> PlayerCharacter:
    """Raise 422 if character doesn't belong to the roster player's user."""
    if not player.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Roster player has no linked user account — cannot validate character ownership",
        )
    char_result = await session.execute(
        select(PlayerCharacter)
        .join(PlayerProfile, PlayerCharacter.profile_id == PlayerProfile.id)
        .where(
            PlayerCharacter.id == player_character_id,
            PlayerProfile.user_id == player.user_id,
        )
        .options(selectinload(PlayerCharacter.gear_snapshots))
    )
    char = char_result.scalar_one_or_none()
    if not char:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Character does not belong to this roster player's account",
        )
    return char


def _can_edit_own_registration(
    user: User,
    player: SnapshotPlayer,
) -> bool:
    """True if the current user owns this roster slot."""
    return bool(player.user_id and player.user_id == user.id)


# ── GET all registrations for a static ────────────────────────────────────────

@router.get(
    "/static-groups/{group_id}/character-registrations",
    response_model=StaticCharacterRegistrationsResponse,
)
async def list_character_registrations(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_current_user),
) -> StaticCharacterRegistrationsResponse:
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, user)

    result = await session.execute(
        select(StaticCharacterRegistration)
        .where(StaticCharacterRegistration.static_group_id == group_id)
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
    regs = result.scalars().all()

    by_player: dict[str, list[CharacterRegistrationResponse]] = defaultdict(list)
    for reg in regs:
        by_player[reg.snapshot_player_id].append(_reg_to_response(reg))

    # Build available_for_linking: Player Hub characters that belong to each
    # roster player's user but are NOT yet linked in any registration here.
    available = await _load_available_for_linking(session, group_id, regs)

    return StaticCharacterRegistrationsResponse(
        registrations=dict(by_player),
        available_for_linking=available,
    )


# ── POST create registration ───────────────────────────────────────────────────

@router.post(
    "/static-groups/{group_id}/character-registrations",
    response_model=CharacterRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_character_registration(
    group_id: str,
    body: CharacterRegistrationCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CharacterRegistrationResponse:
    group, player = await _get_group_and_player(session, group_id, body.snapshot_player_id)

    # Permission: lead/owner OR the player themselves
    is_own = _can_edit_own_registration(user, player)
    if not is_own:
        await require_can_edit_roster(session, user.id, group_id)

    # Validate character ownership if a Player Hub character is specified
    linked_char: PlayerCharacter | None = None
    if body.player_character_id:
        linked_char = await _validate_character_belongs_to_player(
            session, player, body.player_character_id
        )

    # Require at least one identity source
    if not body.player_character_id and not body.manual_character_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Provide either playerCharacterId or manualCharacterName",
        )

    # Prevent duplicate registration of the same PlayerHub character
    if body.player_character_id:
        existing = await session.execute(
            select(StaticCharacterRegistration).where(
                StaticCharacterRegistration.static_group_id == group_id,
                StaticCharacterRegistration.snapshot_player_id == body.snapshot_player_id,
                StaticCharacterRegistration.player_character_id == body.player_character_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This character is already registered for this roster slot",
            )

    # If marking as primary, demote existing primary first
    if body.is_primary_for_static:
        await _demote_existing_primary(session, group_id, body.snapshot_player_id)

    # Derive source
    source = body.source
    if body.player_character_id:
        source = "player_hub"

    # Sync freshness from linked character
    last_synced_at: str | None = None
    if linked_char and linked_char.gear_snapshots:
        def _key(gs):  # type: ignore[no-untyped-def]
            return max(gs.last_plugin_seen_at or "", gs.synced_at or "")
        most_recent = max(linked_char.gear_snapshots, key=_key, default=None)
        if most_recent:
            last_synced_at = most_recent.last_plugin_seen_at or most_recent.synced_at

    reg = StaticCharacterRegistration(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        snapshot_player_id=body.snapshot_player_id,
        player_character_id=body.player_character_id,
        manual_character_name=body.manual_character_name,
        manual_world=body.manual_world,
        manual_data_center=body.manual_data_center,
        role_in_static=body.role_in_static,
        job=body.job,
        is_primary_for_static=body.is_primary_for_static,
        source=source,
        last_synced_at=last_synced_at,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(reg)
    await session.flush()

    # Eagerly load linked character for the response
    if reg.player_character_id:
        await session.refresh(reg, ["player_character"])
        if reg.player_character:
            await session.refresh(reg.player_character, ["gear_snapshots"])

    await session.commit()
    return _reg_to_response(reg)


# ── PATCH update registration ──────────────────────────────────────────────────

@router.patch(
    "/static-groups/{group_id}/character-registrations/{reg_id}",
    response_model=CharacterRegistrationResponse,
)
async def update_character_registration(
    group_id: str,
    reg_id: str,
    body: CharacterRegistrationUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CharacterRegistrationResponse:
    reg = await _get_registration(session, group_id, reg_id)
    player = await _get_snapshot_player(session, reg.snapshot_player_id)

    is_own = _can_edit_own_registration(user, player)
    if not is_own:
        await require_can_edit_roster(session, user.id, group_id)

    if body.role_in_static is not None:
        reg.role_in_static = body.role_in_static
    if body.job is not None:
        reg.job = body.job
    if body.manual_character_name is not None:
        reg.manual_character_name = body.manual_character_name
    if body.manual_world is not None:
        reg.manual_world = body.manual_world
    if body.manual_data_center is not None:
        reg.manual_data_center = body.manual_data_center

    if body.is_primary_for_static is not None and body.is_primary_for_static:
        await _demote_existing_primary(session, group_id, reg.snapshot_player_id)
        reg.is_primary_for_static = True
    elif body.is_primary_for_static is False:
        reg.is_primary_for_static = False

    reg.updated_at = _now()
    await session.flush()

    if reg.player_character_id:
        await session.refresh(reg, ["player_character"])
        if reg.player_character:
            await session.refresh(reg.player_character, ["gear_snapshots"])

    await session.commit()
    return _reg_to_response(reg)


# ── DELETE remove registration ─────────────────────────────────────────────────

@router.delete(
    "/static-groups/{group_id}/character-registrations/{reg_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_character_registration(
    group_id: str,
    reg_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    reg = await _get_registration(session, group_id, reg_id)
    player = await _get_snapshot_player(session, reg.snapshot_player_id)

    is_own = _can_edit_own_registration(user, player)
    if not is_own:
        await require_can_edit_roster(session, user.id, group_id)

    await session.delete(reg)
    await session.commit()


# ── POST set-primary shortcut ──────────────────────────────────────────────────

@router.post(
    "/static-groups/{group_id}/character-registrations/{reg_id}/set-primary",
    response_model=CharacterRegistrationResponse,
)
async def set_primary_registration(
    group_id: str,
    reg_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CharacterRegistrationResponse:
    reg = await _get_registration(session, group_id, reg_id)
    player = await _get_snapshot_player(session, reg.snapshot_player_id)

    is_own = _can_edit_own_registration(user, player)
    if not is_own:
        await require_can_edit_roster(session, user.id, group_id)

    await _demote_existing_primary(session, group_id, reg.snapshot_player_id)
    reg.is_primary_for_static = True
    reg.role_in_static = "main"
    reg.updated_at = _now()

    await session.flush()
    if reg.player_character_id:
        await session.refresh(reg, ["player_character"])
        if reg.player_character:
            await session.refresh(reg.player_character, ["gear_snapshots"])

    await session.commit()
    return _reg_to_response(reg)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_registration(
    session: AsyncSession,
    group_id: str,
    reg_id: str,
) -> StaticCharacterRegistration:
    result = await session.execute(
        select(StaticCharacterRegistration).where(
            StaticCharacterRegistration.id == reg_id,
            StaticCharacterRegistration.static_group_id == group_id,
        )
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFound("Character registration not found")
    return reg


async def _get_snapshot_player(session: AsyncSession, player_id: str) -> SnapshotPlayer:
    result = await session.execute(
        select(SnapshotPlayer).where(SnapshotPlayer.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise NotFound("Roster player not found")
    return player


async def _load_available_for_linking(
    session: AsyncSession,
    group_id: str,
    existing_regs: list[StaticCharacterRegistration],
) -> dict[str, list[LinkedCharacterSummary]]:
    """Return Player Hub characters available to link per roster player.

    A character is *available* when:
    - it belongs to the roster player's linked user account
    - it is NOT already registered for this static (by player_character_id)
    """
    # Load all players in the active tier for this static
    players_result = await session.execute(
        select(_SnapshotPlayer)
        .join(_TierSnapshot, _SnapshotPlayer.tier_snapshot_id == _TierSnapshot.id)
        .where(
            _TierSnapshot.static_group_id == group_id,
            _TierSnapshot.is_active.is_(True),
        )
    )
    players = players_result.scalars().all()

    user_ids = {p.user_id for p in players if p.user_id}
    if not user_ids:
        return {}

    # Load Player Hub profiles with characters and their gear snapshots
    profiles_result = await session.execute(
        select(PlayerProfile)
        .options(
            selectinload(PlayerProfile.characters).selectinload(PlayerCharacter.gear_snapshots)
        )
        .where(PlayerProfile.user_id.in_(user_ids))
    )
    user_to_chars: dict[str, list[PlayerCharacter]] = {
        p.user_id: list(p.characters) for p in profiles_result.scalars().all()
    }

    # Collect already-registered player_character_ids per snapshot_player
    registered_by_player: dict[str, set[str]] = defaultdict(set)
    for reg in existing_regs:
        if reg.player_character_id:
            registered_by_player[reg.snapshot_player_id].add(reg.player_character_id)

    out: dict[str, list[LinkedCharacterSummary]] = {}
    for player in players:
        if not player.user_id:
            continue
        all_chars = user_to_chars.get(player.user_id, [])
        already_linked = registered_by_player.get(player.id, set())
        available = [c for c in all_chars if c.id not in already_linked]
        if available:
            out[player.id] = [_char_to_linked_summary(c) for c in available]

    return out


def _char_to_linked_summary(char: PlayerCharacter) -> LinkedCharacterSummary:
    last_synced_at: str | None = None
    if char.gear_snapshots:
        def _key(gs):  # type: ignore[no-untyped-def]
            return max(gs.last_plugin_seen_at or "", gs.synced_at or "")
        most_recent = max(char.gear_snapshots, key=_key, default=None)
        if most_recent:
            last_synced_at = most_recent.last_plugin_seen_at or most_recent.synced_at
    return LinkedCharacterSummary(
        id=char.id,
        name=char.name,
        server=char.server,
        data_center=char.data_center,
        is_main=char.is_main,
        avatar_url=char.avatar_url,
        last_synced_at=last_synced_at,
    )


async def _demote_existing_primary(
    session: AsyncSession,
    group_id: str,
    snapshot_player_id: str,
) -> None:
    """Clear is_primary_for_static on any existing primary registration for this player."""
    result = await session.execute(
        select(StaticCharacterRegistration).where(
            StaticCharacterRegistration.static_group_id == group_id,
            StaticCharacterRegistration.snapshot_player_id == snapshot_player_id,
            StaticCharacterRegistration.is_primary_for_static.is_(True),
        )
    )
    for existing in result.scalars().all():
        existing.is_primary_for_static = False
        existing.updated_at = _now()
    await session.flush()
