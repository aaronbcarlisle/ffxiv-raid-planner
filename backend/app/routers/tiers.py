"""API router for tier snapshot operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User
from ..permissions import (
    NotFound,
    PermissionDenied,
    check_view_permission,
    get_static_group,
    get_user_membership,
    require_can_edit_roster,
)
from ..schemas import (
    RolloverRequest,
    RolloverResponse,
    SnapshotPlayerCreate,
    SnapshotPlayerResponse,
    SnapshotPlayerUpdate,
    TierSnapshotCreate,
    TierSnapshotResponse,
    TierSnapshotUpdate,
    TierSnapshotWithPlayers,
)
from ..schemas.tier_snapshot import GearSlotStatus, TomeWeaponStatus

router = APIRouter(prefix="/api/static-groups", tags=["tiers"])


# Default gear slots for a new player
DEFAULT_GEAR_SLOTS = [
    "weapon", "head", "body", "hands", "legs", "feet",
    "earring", "necklace", "bracelet", "ring1", "ring2",
]

# Optimal party composition for 8-player raids
OPTIMAL_PARTY_COMP = [
    {"template_role": "tank", "position": "T1", "tank_role": "MT"},
    {"template_role": "tank", "position": "T2", "tank_role": "OT"},
    {"template_role": "pure-healer", "position": "H1", "tank_role": None},
    {"template_role": "barrier-healer", "position": "H2", "tank_role": None},
    {"template_role": "melee", "position": "M1", "tank_role": None},
    {"template_role": "melee", "position": "M2", "tank_role": None},
    {"template_role": "physical-ranged", "position": "R1", "tank_role": None},
    {"template_role": "magical-ranged", "position": "R2", "tank_role": None},
]


def create_default_gear() -> list[dict]:
    """Create default gear configuration"""
    return [
        {"slot": slot, "bisSource": "raid", "hasItem": False, "isAugmented": False}
        for slot in DEFAULT_GEAR_SLOTS
    ]


def create_default_gear_ring2_tome() -> list[dict]:
    """Create default gear with ring2 as tome source"""
    gear = create_default_gear()
    for slot in gear:
        if slot["slot"] == "ring2":
            slot["bisSource"] = "tome"
    return gear


def create_default_tome_weapon() -> dict:
    """Create default tome weapon status"""
    return {"pursuing": False, "hasItem": False, "isAugmented": False}


def create_template_players(snapshot_id: str) -> list[SnapshotPlayer]:
    """Create 8 template player slots"""
    now = datetime.now(timezone.utc).isoformat()
    players = []

    for i, slot in enumerate(OPTIMAL_PARTY_COMP):
        players.append(
            SnapshotPlayer(
                id=str(uuid.uuid4()),
                tier_snapshot_id=snapshot_id,
                name="",
                job="",
                role="",
                position=slot["position"],
                tank_role=slot["tank_role"],
                template_role=slot["template_role"],
                configured=False,
                sort_order=i,
                is_substitute=False,
                gear=create_default_gear_ring2_tome(),
                tome_weapon=create_default_tome_weapon(),
                created_at=now,
                updated_at=now,
            )
        )

    return players


def player_to_response(player: SnapshotPlayer) -> SnapshotPlayerResponse:
    """Convert SnapshotPlayer model to response schema"""
    gear = [
        GearSlotStatus(
            slot=g["slot"],
            bis_source=g.get("bisSource", "raid"),
            has_item=g.get("hasItem", False),
            is_augmented=g.get("isAugmented", False),
            item_name=g.get("itemName"),
            item_level=g.get("itemLevel"),
        )
        for g in (player.gear or [])
    ]

    tw = player.tome_weapon or {}
    tome_weapon = TomeWeaponStatus(
        pursuing=tw.get("pursuing", False),
        has_item=tw.get("hasItem", False),
        is_augmented=tw.get("isAugmented", False),
    )

    return SnapshotPlayerResponse(
        id=player.id,
        tier_snapshot_id=player.tier_snapshot_id,
        user_id=player.user_id,
        name=player.name,
        job=player.job,
        role=player.role,
        position=player.position,
        tank_role=player.tank_role,
        template_role=player.template_role,
        configured=player.configured,
        sort_order=player.sort_order,
        is_substitute=player.is_substitute,
        notes=player.notes,
        lodestone_id=player.lodestone_id,
        bis_link=player.bis_link,
        fflogs_id=player.fflogs_id,
        last_sync=player.last_sync,
        gear=gear,
        tome_weapon=tome_weapon,
        created_at=player.created_at,
        updated_at=player.updated_at,
    )


def snapshot_to_response(snapshot: TierSnapshot) -> TierSnapshotResponse:
    """Convert TierSnapshot model to response schema"""
    return TierSnapshotResponse(
        id=snapshot.id,
        static_group_id=snapshot.static_group_id,
        tier_id=snapshot.tier_id,
        content_type=snapshot.content_type,
        is_active=snapshot.is_active,
        player_count=snapshot.player_count,
        created_at=snapshot.created_at,
        updated_at=snapshot.updated_at,
    )


def snapshot_to_response_with_players(snapshot: TierSnapshot) -> TierSnapshotWithPlayers:
    """Convert TierSnapshot model to response schema with players"""
    players = [player_to_response(p) for p in (snapshot.players or [])]

    return TierSnapshotWithPlayers(
        id=snapshot.id,
        static_group_id=snapshot.static_group_id,
        tier_id=snapshot.tier_id,
        content_type=snapshot.content_type,
        is_active=snapshot.is_active,
        players=players,
        created_at=snapshot.created_at,
        updated_at=snapshot.updated_at,
    )


# --- Tier Snapshot CRUD ---


@router.get("/{group_id}/tiers", response_model=list[TierSnapshotResponse])
async def list_tier_snapshots(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[TierSnapshotResponse]:
    """List all tier snapshots for a static group"""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.static_group_id == group_id)
        .options(selectinload(TierSnapshot.players))
        .order_by(TierSnapshot.created_at.desc())
    )
    snapshots = result.scalars().all()

    return [snapshot_to_response(s) for s in snapshots]


@router.post("/{group_id}/tiers", response_model=TierSnapshotWithPlayers, status_code=status.HTTP_201_CREATED)
async def create_tier_snapshot(
    group_id: str,
    data: TierSnapshotCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TierSnapshotWithPlayers:
    """Create a new tier snapshot with template players"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Check if tier already exists
    existing = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == data.tier_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tier snapshot for '{data.tier_id}' already exists",
        )

    now = datetime.now(timezone.utc).isoformat()
    snapshot_id = str(uuid.uuid4())

    # If this is set as active, deactivate other snapshots
    if data.is_active:
        await session.execute(
            select(TierSnapshot)
            .where(TierSnapshot.static_group_id == group_id)
        )
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == group_id)
        )
        for s in result.scalars():
            s.is_active = False

    snapshot = TierSnapshot(
        id=snapshot_id,
        static_group_id=group_id,
        tier_id=data.tier_id,
        content_type=data.content_type,
        is_active=data.is_active,
        created_at=now,
        updated_at=now,
    )
    session.add(snapshot)

    # Create template players
    template_players = create_template_players(snapshot_id)
    for player in template_players:
        session.add(player)

    await session.flush()

    # Reload with relationships
    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.id == snapshot_id)
        .options(selectinload(TierSnapshot.players))
    )
    snapshot = result.scalar_one()

    return snapshot_to_response_with_players(snapshot)


@router.get("/{group_id}/tiers/{tier_id}", response_model=TierSnapshotWithPlayers)
async def get_tier_snapshot(
    group_id: str,
    tier_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> TierSnapshotWithPlayers:
    """Get a tier snapshot by tier ID"""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(TierSnapshot.players))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    return snapshot_to_response_with_players(snapshot)


@router.put("/{group_id}/tiers/{tier_id}", response_model=TierSnapshotResponse)
async def update_tier_snapshot(
    group_id: str,
    tier_id: str,
    data: TierSnapshotUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TierSnapshotResponse:
    """Update a tier snapshot (e.g., set as active)"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(TierSnapshot.players))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    # If setting as active, deactivate others
    if data.is_active is True:
        all_result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == group_id)
        )
        for s in all_result.scalars():
            s.is_active = False

    if data.is_active is not None:
        snapshot.is_active = data.is_active

    snapshot.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    return snapshot_to_response(snapshot)


@router.delete("/{group_id}/tiers/{tier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier_snapshot(
    group_id: str,
    tier_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a tier snapshot and all its players"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    await session.delete(snapshot)


# --- Rollover ---


@router.post("/{group_id}/tiers/{tier_id}/rollover", response_model=RolloverResponse)
async def rollover_tier(
    group_id: str,
    tier_id: str,
    data: RolloverRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RolloverResponse:
    """Copy roster from one tier to another (rollover)"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Get source snapshot
    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(TierSnapshot.players))
    )
    source_snapshot = result.scalar_one_or_none()

    if not source_snapshot:
        raise NotFound(f"Source tier snapshot for '{tier_id}' not found")

    # Check if target already exists
    target_result = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == data.target_tier_id,
        )
    )
    if target_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Target tier '{data.target_tier_id}' already exists. Delete it first or choose a different tier.",
        )

    now = datetime.now(timezone.utc).isoformat()
    target_snapshot_id = str(uuid.uuid4())

    # Deactivate source, create active target
    source_snapshot.is_active = False

    target_snapshot = TierSnapshot(
        id=target_snapshot_id,
        static_group_id=group_id,
        tier_id=data.target_tier_id,
        content_type=source_snapshot.content_type,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(target_snapshot)

    # Copy players
    players_copied = 0
    for source_player in source_snapshot.players:
        # Copy gear or reset based on request
        if data.reset_gear:
            gear = create_default_gear_ring2_tome()
            tome_weapon = create_default_tome_weapon()
        else:
            gear = source_player.gear
            tome_weapon = source_player.tome_weapon

        new_player = SnapshotPlayer(
            id=str(uuid.uuid4()),
            tier_snapshot_id=target_snapshot_id,
            user_id=source_player.user_id,
            name=source_player.name,
            job=source_player.job,
            role=source_player.role,
            position=source_player.position,
            tank_role=source_player.tank_role,
            template_role=source_player.template_role,
            configured=source_player.configured,
            sort_order=source_player.sort_order,
            is_substitute=source_player.is_substitute,
            notes=source_player.notes,
            lodestone_id=source_player.lodestone_id,
            bis_link=source_player.bis_link,
            fflogs_id=source_player.fflogs_id,
            gear=gear,
            tome_weapon=tome_weapon,
            created_at=now,
            updated_at=now,
        )
        session.add(new_player)
        players_copied += 1

    await session.flush()

    # Reload target with players
    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.id == target_snapshot_id)
        .options(selectinload(TierSnapshot.players))
    )
    target_snapshot = result.scalar_one()

    return RolloverResponse(
        source_snapshot=snapshot_to_response(source_snapshot),
        target_snapshot=snapshot_to_response_with_players(target_snapshot),
        players_copied=players_copied,
    )


# --- Snapshot Player CRUD ---


@router.get("/{group_id}/tiers/{tier_id}/players", response_model=list[SnapshotPlayerResponse])
async def list_snapshot_players(
    group_id: str,
    tier_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[SnapshotPlayerResponse]:
    """List all players in a tier snapshot"""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(TierSnapshot.players))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    return [player_to_response(p) for p in snapshot.players]


@router.post("/{group_id}/tiers/{tier_id}/players", response_model=SnapshotPlayerResponse, status_code=status.HTTP_201_CREATED)
async def create_snapshot_player(
    group_id: str,
    tier_id: str,
    data: SnapshotPlayerCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Add a player to a tier snapshot"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(TierSnapshot.players))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    now = datetime.now(timezone.utc).isoformat()

    # Convert gear and tome_weapon to dict format for storage
    gear = [g.model_dump(by_alias=True) for g in data.gear] if data.gear else create_default_gear_ring2_tome()
    tome_weapon = data.tome_weapon.model_dump(by_alias=True) if data.tome_weapon else create_default_tome_weapon()

    player = SnapshotPlayer(
        id=str(uuid.uuid4()),
        tier_snapshot_id=snapshot.id,
        user_id=data.user_id,
        name=data.name,
        job=data.job,
        role=data.role,
        position=data.position,
        tank_role=data.tank_role,
        template_role=data.template_role,
        configured=data.configured,
        sort_order=data.sort_order,
        is_substitute=data.is_substitute,
        notes=data.notes,
        lodestone_id=data.lodestone_id,
        bis_link=data.bis_link,
        fflogs_id=data.fflogs_id,
        gear=gear,
        tome_weapon=tome_weapon,
        created_at=now,
        updated_at=now,
    )
    session.add(player)
    await session.flush()

    return player_to_response(player)


@router.put("/{group_id}/tiers/{tier_id}/players/{player_id}", response_model=SnapshotPlayerResponse)
async def update_snapshot_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    data: SnapshotPlayerUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Update a player in a tier snapshot"""
    group = await get_static_group(session, group_id)
    membership = await get_user_membership(session, current_user.id, group_id)

    if not membership:
        raise PermissionDenied("You are not a member of this static group")

    # Get player
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Check permissions: leads/owners can edit anyone, members can only edit their own
    can_edit_all = membership.role in (MemberRole.OWNER.value, MemberRole.LEAD.value)
    is_own_player = player.user_id == current_user.id

    if not can_edit_all and not is_own_player:
        raise PermissionDenied("You can only edit your own character")

    # Members can only update gear-related fields
    if not can_edit_all and is_own_player:
        allowed_fields = {"gear", "tome_weapon", "bis_link", "lodestone_id"}
        update_data = data.model_dump(exclude_unset=True)
        for field in update_data:
            if field not in allowed_fields:
                raise PermissionDenied(f"Members cannot update '{field}'")

    # Apply updates
    if data.name is not None:
        player.name = data.name
    if data.job is not None:
        player.job = data.job
    if data.role is not None:
        player.role = data.role
    if data.position is not None:
        player.position = data.position
    if data.tank_role is not None:
        player.tank_role = data.tank_role
    if data.template_role is not None:
        player.template_role = data.template_role
    if data.configured is not None:
        player.configured = data.configured
    if data.sort_order is not None:
        player.sort_order = data.sort_order
    if data.is_substitute is not None:
        player.is_substitute = data.is_substitute
    if data.user_id is not None:
        player.user_id = data.user_id
    if data.notes is not None:
        player.notes = data.notes
    if data.lodestone_id is not None:
        player.lodestone_id = data.lodestone_id
    if data.bis_link is not None:
        player.bis_link = data.bis_link
    if data.fflogs_id is not None:
        player.fflogs_id = data.fflogs_id
    if data.gear is not None:
        player.gear = [g.model_dump(by_alias=True) for g in data.gear]
    if data.tome_weapon is not None:
        player.tome_weapon = data.tome_weapon.model_dump(by_alias=True)

    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    return player_to_response(player)


@router.delete("/{group_id}/tiers/{tier_id}/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a player from a tier snapshot"""
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    await session.delete(player)
