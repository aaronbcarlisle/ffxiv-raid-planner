"""API router for tier snapshot operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, status

from ..logging_config import get_logger

logger = get_logger(__name__)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import MemberRole, SnapshotPlayer, TierSnapshot, User, WeeklyAssignment
from ..permissions import (
    NotFound,
    PermissionDenied,
    check_view_permission,
    create_membership_for_assignment,
    get_static_group,
    get_user_membership,
    is_user_admin,
    require_can_edit_roster,
    require_owner,
)
from .. import schemas
from ..schemas import (
    LinkedUserInfo,
    RolloverRequest,
    RolloverResponse,
    SnapshotPlayerCreate,
    SnapshotPlayerResponse,
    SnapshotPlayerUpdate,
    TierSnapshotCreate,
    TierSnapshotResponse,
    TierSnapshotUpdate,
    TierSnapshotWithPlayers,
    WeaponPrioritiesUpdate,
    WeaponPrioritySettingsUpdate,
    WeeklyAssignmentCreate,
    WeeklyAssignmentResponse,
    WeeklyAssignmentUpdate,
    WeeklyAssignmentBulkCreate,
    WeeklyAssignmentBulkDelete,
)
from ..constants import (
    OPTIMAL_PARTY_COMP,
    create_default_gear_ring2_tome,
    create_default_tome_weapon,
)
from ..schemas.tier_snapshot import GearSlotStatus, MateriaSlot, TomeWeaponStatus

router = APIRouter(prefix="/api/static-groups", tags=["tiers"])


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


async def get_user_membership_role(session: AsyncSession, user_id: str, group_id: str) -> str | None:
    """Get the membership role for a user in a group

    Args:
        session: Database session
        user_id: The user ID to look up
        group_id: The static group ID

    Returns:
        The membership role (owner/lead/member/viewer) or None if not a member
    """
    from ..models import Membership
    result = await session.execute(
        select(Membership).where(
            Membership.user_id == user_id,
            Membership.static_group_id == group_id
        )
    )
    membership = result.scalar_one_or_none()
    return membership.role if membership else None


def player_to_response(player: SnapshotPlayer, membership_role: str | None = None) -> SnapshotPlayerResponse:
    """Convert SnapshotPlayer model to response schema

    Args:
        player: The snapshot player to convert
        membership_role: Optional membership role for the linked user (owner/lead/member/viewer)
    """
    gear = [
        GearSlotStatus(
            slot=g["slot"],
            bis_source=g.get("bisSource", "raid"),
            current_source=g.get("currentSource", "unknown"),
            has_item=g.get("hasItem", False),
            is_augmented=g.get("isAugmented", False),
            item_name=g.get("itemName"),
            item_level=g.get("itemLevel"),
            item_icon=g.get("itemIcon"),
            item_stats=g.get("itemStats"),
            materia=[
                MateriaSlot(
                    item_id=m.get("itemId", 0),
                    item_name=m.get("itemName", ""),
                    stat=m.get("stat"),
                    tier=m.get("tier"),
                    icon=m.get("icon"),
                )
                for m in g.get("materia", [])
            ],
        )
        for g in (player.gear or [])
    ]

    tw = player.tome_weapon or {}
    tome_weapon = TomeWeaponStatus(
        pursuing=tw.get("pursuing", False),
        has_item=tw.get("hasItem", False),
        is_augmented=tw.get("isAugmented", False),
    )

    # Build linked user info if user is loaded
    linked_user = None
    if player.user:
        linked_user = LinkedUserInfo(
            id=player.user.id,
            discord_id=player.user.discord_id,
            discord_username=player.user.discord_username,
            discord_avatar=player.user.discord_avatar,
            avatar_url=player.user.avatar_url,
            display_name=player.user.display_name,
            membership_role=membership_role,
        )

    # Build weapon priorities
    from ..schemas.tier_snapshot import WeaponPriority
    weapon_priorities = [
        WeaponPriority(
            job=wp.get("job", ""),
            weapon_name=wp.get("weaponName"),
            received=wp.get("received", False),
            received_date=wp.get("receivedDate"),
        )
        for wp in (player.weapon_priorities or [])
    ]

    return SnapshotPlayerResponse(
        id=player.id,
        tier_snapshot_id=player.tier_snapshot_id,
        user_id=player.user_id,
        linked_user=linked_user,
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
        weapon_priorities=weapon_priorities,
        weapon_priorities_locked=player.weapon_priorities_locked,
        weapon_priorities_locked_by=player.weapon_priorities_locked_by,
        weapon_priorities_locked_at=player.weapon_priorities_locked_at,
        loot_adjustment=player.loot_adjustment,
        page_adjustments=player.page_adjustments,
        priority_modifier=player.priority_modifier,
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
        weapon_priorities_auto_lock_date=snapshot.weapon_priorities_auto_lock_date,
        weapon_priorities_global_lock=snapshot.weapon_priorities_global_lock,
        weapon_priorities_global_locked_by=snapshot.weapon_priorities_global_locked_by,
        weapon_priorities_global_locked_at=snapshot.weapon_priorities_global_locked_at,
        current_week=snapshot.current_week,
        week_start_date=snapshot.week_start_date,
        created_at=snapshot.created_at,
        updated_at=snapshot.updated_at,
    )


def snapshot_to_response_with_players(snapshot: TierSnapshot, membership_map: dict[str, str] | None = None) -> TierSnapshotWithPlayers:
    """Convert TierSnapshot model to response schema with players

    Args:
        snapshot: The tier snapshot to convert
        membership_map: Optional dict mapping user_id to membership role
    """
    membership_map = membership_map or {}
    players = [player_to_response(p, membership_map.get(p.user_id)) for p in (snapshot.players or [])]

    return TierSnapshotWithPlayers(
        id=snapshot.id,
        static_group_id=snapshot.static_group_id,
        tier_id=snapshot.tier_id,
        content_type=snapshot.content_type,
        is_active=snapshot.is_active,
        players=players,
        weapon_priorities_auto_lock_date=snapshot.weapon_priorities_auto_lock_date,
        weapon_priorities_global_lock=snapshot.weapon_priorities_global_lock,
        weapon_priorities_global_locked_by=snapshot.weapon_priorities_global_locked_by,
        weapon_priorities_global_locked_at=snapshot.weapon_priorities_global_locked_at,
        current_week=snapshot.current_week,
        week_start_date=snapshot.week_start_date,
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
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
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

    # If this is set as active, deactivate other snapshots with bulk update
    if data.is_active:
        await session.execute(
            update(TierSnapshot)
            .where(TierSnapshot.static_group_id == group_id)
            .values(is_active=False)
        )

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
    await session.commit()

    # Log tier creation
    logger.info(
        "tier_snapshot_created",
        group_id=group_id,
        tier_id=data.tier_id,
        snapshot_id=snapshot_id,
        content_type=data.content_type,
        is_active=data.is_active,
        user_id=current_user.id,
    )

    # Reload with relationships
    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.id == snapshot_id)
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    snapshot = result.scalar_one()

    # Build membership role map for linked users
    user_ids = [p.user_id for p in snapshot.players if p.user_id]
    membership_map: dict[str, str] = {}

    if user_ids:
        # Fetch memberships for all users in one query
        from ..models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.static_group_id == group_id,
                Membership.user_id.in_(user_ids)
            )
        )
        memberships = result.scalars().all()
        membership_map = {m.user_id: m.role for m in memberships}

    return snapshot_to_response_with_players(snapshot, membership_map)


@router.get("/{group_id}/tiers/{tier_id}", response_model=TierSnapshotWithPlayers)
async def get_tier_snapshot(
    group_id: str,
    tier_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> TierSnapshotWithPlayers:
    """Get a tier snapshot by tier ID.

    tier_id can be either the UUID (id) or the tier slug (tier_id).
    """
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    # Try to find by UUID first, then by tier slug
    result = await session.execute(
        select(TierSnapshot)
        .where(
            TierSnapshot.static_group_id == group_id,
            (TierSnapshot.id == tier_id) | (TierSnapshot.tier_id == tier_id),
        )
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    # Build membership role map for linked users
    user_ids = [p.user_id for p in snapshot.players if p.user_id]
    membership_map: dict[str, str] = {}

    if user_ids:
        # Fetch memberships for all users in one query
        from ..models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.static_group_id == group_id,
                Membership.user_id.in_(user_ids)
            )
        )
        memberships = result.scalars().all()
        membership_map = {m.user_id: m.role for m in memberships}

    return snapshot_to_response_with_players(snapshot, membership_map)


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
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    # If setting as active, deactivate other tiers (exclude current to avoid SQLAlchemy change tracking issues)
    if data.is_active is True:
        await session.execute(
            update(TierSnapshot)
            .where(
                TierSnapshot.static_group_id == group_id,
                TierSnapshot.id != snapshot.id,
            )
            .values(is_active=False)
        )

    if data.is_active is not None:
        snapshot.is_active = data.is_active

    snapshot.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    return snapshot_to_response(snapshot)


@router.delete("/{group_id}/tiers/{tier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier_snapshot(
    group_id: str,
    tier_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a tier snapshot and all its players.

    tier_id can be either the UUID (id) or the tier slug (tier_id).
    """
    group = await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Try to find by UUID first, then by tier slug
    result = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id,
            (TierSnapshot.id == tier_id) | (TierSnapshot.tier_id == tier_id),
        )
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    await session.delete(snapshot)
    await session.commit()


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
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
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
    await session.commit()

    # Reload target with players
    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.id == target_snapshot_id)
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    target_snapshot = result.scalar_one()

    # Build membership role map for linked users
    user_ids = [p.user_id for p in target_snapshot.players if p.user_id]
    membership_map: dict[str, str] = {}

    if user_ids:
        # Fetch memberships for all users in one query
        from ..models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.static_group_id == group_id,
                Membership.user_id.in_(user_ids)
            )
        )
        memberships = result.scalars().all()
        membership_map = {m.user_id: m.role for m in memberships}

    return RolloverResponse(
        source_snapshot=snapshot_to_response(source_snapshot),
        target_snapshot=snapshot_to_response_with_players(target_snapshot, membership_map),
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
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    # Build membership role map for linked users
    user_ids = [p.user_id for p in snapshot.players if p.user_id]
    membership_map: dict[str, str] = {}

    if user_ids:
        # Fetch memberships for all users in one query
        from ..models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.static_group_id == group_id,
                Membership.user_id.in_(user_ids)
            )
        )
        memberships = result.scalars().all()
        membership_map = {m.user_id: m.role for m in memberships}

    return [player_to_response(p, membership_map.get(p.user_id)) for p in snapshot.players]


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
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise NotFound(f"Tier snapshot for '{tier_id}' not found")

    now = datetime.now(timezone.utc).isoformat()

    # Convert gear and tome_weapon to dict format for storage
    gear = [g.model_dump(by_alias=True) for g in data.gear] if data.gear else create_default_gear_ring2_tome()
    tome_weapon = data.tome_weapon.model_dump(by_alias=True) if data.tome_weapon else create_default_tome_weapon()

    player_id = str(uuid.uuid4())
    player = SnapshotPlayer(
        id=player_id,
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
        priority_modifier=data.priority_modifier,
        gear=gear,
        tome_weapon=tome_weapon,
        created_at=now,
        updated_at=now,
    )
    session.add(player)
    await session.flush()
    await session.commit()

    # Reload with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


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

    # Check if user is admin (grants full access)
    user_is_admin = await is_user_admin(session, current_user.id)
    membership = await get_user_membership(session, current_user.id, group_id)

    if not membership and not user_is_admin:
        raise PermissionDenied("You are not a member of this static group")

    # Get player with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Check permissions: admins and leads/owners can edit anyone, members can only edit their own
    is_owner_or_lead = membership and membership.role in (MemberRole.OWNER.value, MemberRole.LEAD.value)
    can_edit_anyone = user_is_admin or is_owner_or_lead
    is_own_player = player.user_id == current_user.id

    if not can_edit_anyone and not is_own_player:
        raise PermissionDenied("You can only edit your own character")

    # Members can only update their own player's fields
    # Note: Field restrictions are based on membership role only, not admin status.
    # Admins editing their own card as a regular member are still subject to restrictions.
    if not is_owner_or_lead and is_own_player:
        allowed_fields = {
            "gear", "tome_weapon", "bis_link", "lodestone_id",
            "job", "name", "role", "position", "tank_role"
        }
        # Use by_alias=False to get Python field names (snake_case) not JSON aliases (camelCase)
        update_data = data.model_dump(exclude_unset=True, by_alias=False)
        for field in update_data:
            if field not in allowed_fields:
                raise PermissionDenied(f"Members cannot update '{field}'")

    # Apply updates - use model_fields_set to detect explicitly sent fields (including null)
    sent_fields = data.model_fields_set

    if "name" in sent_fields:
        player.name = data.name or ""
    if "job" in sent_fields:
        player.job = data.job or ""
    if "role" in sent_fields:
        player.role = data.role or ""
    if "position" in sent_fields:
        player.position = data.position  # Can be None to clear
    if "tank_role" in sent_fields:
        player.tank_role = data.tank_role  # Can be None to clear
    if "template_role" in sent_fields:
        player.template_role = data.template_role  # Can be None to clear
    if "configured" in sent_fields and data.configured is not None:
        player.configured = data.configured
    if "sort_order" in sent_fields and data.sort_order is not None:
        player.sort_order = data.sort_order
    if "is_substitute" in sent_fields and data.is_substitute is not None:
        player.is_substitute = data.is_substitute
    if "user_id" in sent_fields:
        player.user_id = data.user_id  # Can be None to clear
    if "notes" in sent_fields:
        player.notes = data.notes  # Can be None to clear
    if "lodestone_id" in sent_fields:
        player.lodestone_id = data.lodestone_id  # Can be None to clear
    if "bis_link" in sent_fields:
        # Treat empty string as None to clear the field
        player.bis_link = data.bis_link if data.bis_link else None
    if "fflogs_id" in sent_fields:
        player.fflogs_id = data.fflogs_id  # Can be None to clear
    if "gear" in sent_fields and data.gear is not None:
        player.gear = [g.model_dump(by_alias=True) for g in data.gear]
    if "tome_weapon" in sent_fields and data.tome_weapon is not None:
        player.tome_weapon = data.tome_weapon.model_dump(by_alias=True)
    if "loot_adjustment" in sent_fields and data.loot_adjustment is not None:
        player.loot_adjustment = data.loot_adjustment
    if "page_adjustments" in sent_fields and data.page_adjustments is not None:
        player.page_adjustments = data.page_adjustments
    if "priority_modifier" in sent_fields and data.priority_modifier is not None:
        player.priority_modifier = data.priority_modifier

    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


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
    await session.commit()


# --- Player Ownership (Claim/Release) ---


@router.post("/{group_id}/tiers/{tier_id}/players/{player_id}/claim", response_model=SnapshotPlayerResponse)
async def claim_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Link current user to a player card (take ownership)"""
    group = await get_static_group(session, group_id)

    # User must have at least viewer access to the group
    await check_view_permission(session, group, current_user)

    # User must be a member (not just have view access via share code)
    # Admins bypass this check
    is_admin = await is_user_admin(session, current_user.id)
    if not is_admin:
        membership = await get_user_membership(session, current_user.id, group_id)
        if not membership:
            raise PermissionDenied(
                "Only group members can claim player cards. "
                "Share code access is read-only. Ask the owner for an invitation."
            )

    # Get player with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Check if already claimed by someone else
    if player.user_id and player.user_id != current_user.id:
        raise PermissionDenied("This player is already linked to another user")

    # Check if user is already linked to another player in this tier
    existing_link = await session.execute(
        select(SnapshotPlayer)
        .where(
            SnapshotPlayer.tier_snapshot_id == player.tier_snapshot_id,
            SnapshotPlayer.user_id == current_user.id,
            SnapshotPlayer.id != player_id,
        )
    )
    if existing_link.scalar_one_or_none():
        raise PermissionDenied("You are already linked to another player in this tier")

    # Link the user
    player.user_id = current_user.id
    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


@router.delete("/{group_id}/tiers/{tier_id}/players/{player_id}/claim", response_model=SnapshotPlayerResponse)
async def release_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Unlink user from a player card. User can release self, owner can release anyone."""
    group = await get_static_group(session, group_id)

    # Get player with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    if not player.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This player is not linked to any user",
        )

    # Check permissions: user can release self, owner/admin can release anyone
    is_self = player.user_id == current_user.id
    user_is_admin = await is_user_admin(session, current_user.id)
    membership = await get_user_membership(session, current_user.id, group_id)
    is_owner = membership and membership.role == MemberRole.OWNER.value

    if not is_self and not is_owner and not user_is_admin:
        raise PermissionDenied("You can only unlink yourself or you must be the group owner")

    # Unlink the user
    player.user_id = None
    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload to get fresh state (user relationship now None)
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # No membership role since we just released (user_id is None)
    return player_to_response(player, None)


async def _assign_player_impl(
    session: AsyncSession,
    group_id: str,
    tier_id: str,
    player_id: str,
    data: schemas.AssignPlayerRequest,
) -> SnapshotPlayerResponse:
    """
    Common implementation for assigning/unassigning a user to a player card.

    Used by both admin-assign and owner-assign endpoints after their permission checks.

    IMPORTANT: If the target user is already linked to another player in the same tier,
    this function will automatically unlink them from that player before assigning them
    to the new player. This allows reassignment without requiring a separate unlink step.
    The frontend should warn users about this behavior before confirming reassignment.

    Args:
        session: Database session
        group_id: Static group ID
        tier_id: Tier identifier (e.g., "aac-lightweight")
        player_id: Player UUID
        data: Assignment request data

    Returns:
        Updated player response

    Raises:
        NotFound: If player or target user not found
        HTTPException: If invalid membership role provided
    """
    # Get player
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # If assigning a user, verify the user exists
    if data.user_id:
        # Support both Discord ID and internal user ID
        user_result = await session.execute(
            select(User).where((User.discord_id == data.user_id) | (User.id == data.user_id))
        )
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            raise NotFound(f"User with ID {data.user_id} not found")

        # Check if target user is already linked to another player in this tier
        existing_link = await session.execute(
            select(SnapshotPlayer)
            .where(
                SnapshotPlayer.tier_snapshot_id == player.tier_snapshot_id,
                SnapshotPlayer.user_id == target_user.id,
                SnapshotPlayer.id != player_id,
            )
        )
        existing_player = existing_link.scalar_one_or_none()
        if existing_player:
            # Automatically unlink from the old player (reassignment)
            existing_player.user_id = None
            existing_player.updated_at = datetime.now(timezone.utc).isoformat()

        # Create membership if requested and user is not a member
        if data.create_membership:
            existing_membership = await get_user_membership(session, target_user.id, group_id)
            if not existing_membership and data.membership_role:
                try:
                    role = MemberRole(data.membership_role)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid membership role: {data.membership_role}. Must be 'member' or 'lead'.",
                    )
                await create_membership_for_assignment(session, target_user.id, group_id, role)

        # Assign the user
        player.user_id = target_user.id
    else:
        # Unassign (null user_id)
        player.user_id = None

    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Clear session cache to ensure fresh data
    session.expire_all()

    # Reload with user relationship
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the newly assigned user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


@router.post("/{group_id}/tiers/{tier_id}/players/{player_id}/admin-assign", response_model=SnapshotPlayerResponse)
async def admin_assign_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    data: schemas.AssignPlayerRequest = Body(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Admin-only endpoint to assign any user to a player card, bypassing normal claim restrictions"""
    # Check if current user is an admin
    if not await is_user_admin(session, current_user.id):
        raise PermissionDenied("Only admins can use this endpoint")

    group = await get_static_group(session, group_id)

    # Verify admin has view permission (should always pass for admins, but check anyway)
    await check_view_permission(session, group, current_user)

    return await _assign_player_impl(session, group_id, tier_id, player_id, data)


@router.post("/{group_id}/tiers/{tier_id}/players/{player_id}/owner-assign", response_model=SnapshotPlayerResponse)
async def owner_assign_player(
    group_id: str,
    tier_id: str,
    player_id: str,
    data: schemas.AssignPlayerRequest = Body(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Owner-only endpoint to assign members to player cards with optional membership creation"""
    # Check if current user is owner (or admin, which bypasses to owner-level)
    await require_owner(session, current_user.id, group_id)

    return await _assign_player_impl(session, group_id, tier_id, player_id, data)


# --- Weapon Priority Endpoints ---


@router.put(
    "/{group_id}/tiers/{tier_id}/players/{player_id}/weapon-priorities",
    response_model=SnapshotPlayerResponse,
)
async def update_weapon_priorities(
    group_id: str,
    tier_id: str,
    player_id: str,
    data: WeaponPrioritiesUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Update a player's weapon priority list"""
    await get_static_group(session, group_id)

    # Check if user is admin (grants full access)
    user_is_admin = await is_user_admin(session, current_user.id)
    membership = await get_user_membership(session, current_user.id, group_id)

    if not membership and not user_is_admin:
        raise PermissionDenied("You are not a member of this static group")

    # Get player and tier snapshot
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Get tier snapshot to check lock states
    tier_result = await session.execute(
        select(TierSnapshot).where(TierSnapshot.id == player.tier_snapshot_id)
    )
    tier = tier_result.scalar_one()

    # Check if locked
    can_edit_all = user_is_admin or (membership and membership.role in (MemberRole.OWNER.value, MemberRole.LEAD.value))
    is_own_player = player.user_id == current_user.id

    # Determine if locked
    is_locked = False
    lock_reason = None

    if tier.weapon_priorities_global_lock:
        is_locked = True
        lock_reason = "Weapon priorities are globally locked"
    elif player.weapon_priorities_locked:
        is_locked = True
        lock_reason = "This player's weapon priorities are locked"
    elif tier.weapon_priorities_auto_lock_date:
        from dateutil import parser as date_parser

        try:
            lock_date = date_parser.isoparse(tier.weapon_priorities_auto_lock_date)
            now = datetime.now(timezone.utc)
            if now >= lock_date:
                is_locked = True
                lock_reason = f"Weapon priorities auto-locked on {tier.weapon_priorities_auto_lock_date}"
        except (ValueError, TypeError):
            # Invalid date format stored - log but don't block (data corruption shouldn't break the app)
            import logging
            logging.warning(f"Invalid auto-lock date format: {tier.weapon_priorities_auto_lock_date}")

    # Only Owner/Lead can edit when locked
    if is_locked and not can_edit_all:
        raise PermissionDenied(lock_reason or "Weapon priorities are locked")

    # Members can only edit their own player
    if not can_edit_all and not is_own_player:
        raise PermissionDenied("You can only edit your own character's weapon priorities")

    # Update weapon priorities (use by_alias=True to preserve camelCase keys for frontend)
    weapon_priorities_data = [wp.model_dump(mode="json", by_alias=True) for wp in data.weapon_priorities]
    player.weapon_priorities = weapon_priorities_data
    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload to get fresh state
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


@router.post(
    "/{group_id}/tiers/{tier_id}/players/{player_id}/weapon-priorities/lock",
    response_model=SnapshotPlayerResponse,
)
async def lock_player_weapon_priorities(
    group_id: str,
    tier_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Lock a player's weapon priorities (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Get player
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Lock the player's weapon priorities
    player.weapon_priorities_locked = True
    player.weapon_priorities_locked_by = current_user.id
    player.weapon_priorities_locked_at = datetime.now(timezone.utc).isoformat()
    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload to get fresh state
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


@router.delete(
    "/{group_id}/tiers/{tier_id}/players/{player_id}/weapon-priorities/lock",
    response_model=SnapshotPlayerResponse,
)
async def unlock_player_weapon_priorities(
    group_id: str,
    tier_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotPlayerResponse:
    """Unlock a player's weapon priorities (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Get player
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise NotFound("Player not found")

    # Unlock the player's weapon priorities
    player.weapon_priorities_locked = False
    player.weapon_priorities_locked_by = None
    player.weapon_priorities_locked_at = None
    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload to get fresh state
    result = await session.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.id == player_id)
        .options(selectinload(SnapshotPlayer.user))
    )
    player = result.scalar_one()

    # Look up membership role for the linked user
    membership_role = None
    if player.user_id:
        membership_role = await get_user_membership_role(session, player.user_id, group_id)

    return player_to_response(player, membership_role)


@router.put(
    "/{group_id}/tiers/{tier_id}/weapon-priority-settings",
    response_model=TierSnapshotResponse,
)
async def update_weapon_priority_settings(
    group_id: str,
    tier_id: str,
    data: WeaponPrioritySettingsUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TierSnapshotResponse:
    """Update tier-level weapon priority settings (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Get tier snapshot
    result = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id, TierSnapshot.tier_id == tier_id
        )
    )
    tier = result.scalar_one_or_none()

    if not tier:
        raise NotFound("Tier snapshot not found")

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    if "weapon_priorities_auto_lock_date" in update_data:
        tier.weapon_priorities_auto_lock_date = update_data["weapon_priorities_auto_lock_date"]

    if "weapon_priorities_global_lock" in update_data:
        is_locking = update_data["weapon_priorities_global_lock"]
        tier.weapon_priorities_global_lock = is_locking

        if is_locking:
            tier.weapon_priorities_global_locked_by = current_user.id
            tier.weapon_priorities_global_locked_at = datetime.now(timezone.utc).isoformat()
        else:
            tier.weapon_priorities_global_locked_by = None
            tier.weapon_priorities_global_locked_at = None

    tier.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Reload to get fresh state
    result = await session.execute(
        select(TierSnapshot)
        .where(TierSnapshot.id == tier.id)
        .options(selectinload(TierSnapshot.players).selectinload(SnapshotPlayer.user))
    )
    tier = result.scalar_one()

    return snapshot_to_response(tier)


# --- Weekly Assignment Endpoints (Manual Planning Mode) ---


def assignment_to_response(
    assignment: WeeklyAssignment, player: SnapshotPlayer | None = None
) -> WeeklyAssignmentResponse:
    """Convert WeeklyAssignment model to response schema"""
    return WeeklyAssignmentResponse(
        id=assignment.id,
        static_group_id=assignment.static_group_id,
        tier_id=assignment.tier_id,
        week=assignment.week,
        floor=assignment.floor,
        slot=assignment.slot,
        player_id=assignment.player_id,
        player_name=player.name if player else None,
        player_job=player.job if player else None,
        sort_order=assignment.sort_order,
        did_not_drop=assignment.did_not_drop,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


@router.get(
    "/{group_id}/weekly-assignments",
    response_model=list[WeeklyAssignmentResponse],
)
async def list_weekly_assignments(
    group_id: str,
    tier_id: str | None = None,
    week: int | None = None,
    floor: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[WeeklyAssignmentResponse]:
    """List weekly assignments for a static group with optional filters"""
    group = await get_static_group(session, group_id)
    await check_view_permission(session, group, current_user)

    # Build query with filters
    query = select(WeeklyAssignment).where(
        WeeklyAssignment.static_group_id == group_id
    )

    if tier_id:
        query = query.where(WeeklyAssignment.tier_id == tier_id)
    if week:
        query = query.where(WeeklyAssignment.week == week)
    if floor:
        query = query.where(WeeklyAssignment.floor == floor)

    query = query.order_by(
        WeeklyAssignment.week,
        WeeklyAssignment.floor,
        WeeklyAssignment.slot,
        WeeklyAssignment.sort_order,
    )

    result = await session.execute(query)
    assignments = result.scalars().all()

    # Get player info for all assignments
    player_ids = [a.player_id for a in assignments if a.player_id]
    players_map: dict[str, SnapshotPlayer] = {}

    if player_ids:
        players_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.id.in_(player_ids))
        )
        players = players_result.scalars().all()
        players_map = {p.id: p for p in players}

    return [
        assignment_to_response(a, players_map.get(a.player_id) if a.player_id else None)
        for a in assignments
    ]


@router.post(
    "/{group_id}/weekly-assignments",
    response_model=WeeklyAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_weekly_assignment(
    group_id: str,
    data: WeeklyAssignmentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> WeeklyAssignmentResponse:
    """Create a weekly assignment (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Validate player_id if provided - must belong to a player in this group/tier
    if data.player_id:
        player_check = await session.execute(
            select(SnapshotPlayer)
            .join(TierSnapshot)
            .where(
                SnapshotPlayer.id == data.player_id,
                TierSnapshot.static_group_id == group_id,
                TierSnapshot.tier_id == data.tier_id,
            )
        )
        if not player_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player not found in this tier/group",
            )

    now = datetime.now(timezone.utc).isoformat()

    # Check for duplicate
    existing = await session.execute(
        select(WeeklyAssignment).where(
            WeeklyAssignment.static_group_id == group_id,
            WeeklyAssignment.tier_id == data.tier_id,
            WeeklyAssignment.week == data.week,
            WeeklyAssignment.floor == data.floor,
            WeeklyAssignment.slot == data.slot,
            WeeklyAssignment.player_id == data.player_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assignment already exists for this player/slot/week combination",
        )

    assignment = WeeklyAssignment(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        tier_id=data.tier_id,
        week=data.week,
        floor=data.floor,
        slot=data.slot,
        player_id=data.player_id,
        sort_order=data.sort_order,
        did_not_drop=data.did_not_drop,
        created_at=now,
        updated_at=now,
    )

    session.add(assignment)
    await session.flush()
    await session.commit()

    # Get player info if assigned
    player = None
    if assignment.player_id:
        player_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.id == assignment.player_id)
        )
        player = player_result.scalar_one_or_none()

    return assignment_to_response(assignment, player)


@router.put(
    "/{group_id}/weekly-assignments/{assignment_id}",
    response_model=WeeklyAssignmentResponse,
)
async def update_weekly_assignment(
    group_id: str,
    assignment_id: str,
    data: WeeklyAssignmentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> WeeklyAssignmentResponse:
    """Update a weekly assignment (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(WeeklyAssignment).where(
            WeeklyAssignment.id == assignment_id,
            WeeklyAssignment.static_group_id == group_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise NotFound("Assignment not found")

    # Validate player_id if being updated to a non-null value
    if data.player_id is not None and data.player_id:
        player_check = await session.execute(
            select(SnapshotPlayer)
            .join(TierSnapshot)
            .where(
                SnapshotPlayer.id == data.player_id,
                TierSnapshot.static_group_id == group_id,
                TierSnapshot.tier_id == assignment.tier_id,
            )
        )
        if not player_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player not found in this tier/group",
            )

    # Apply updates
    if data.player_id is not None:
        assignment.player_id = data.player_id if data.player_id else None
    if data.sort_order is not None:
        assignment.sort_order = data.sort_order
    if data.did_not_drop is not None:
        assignment.did_not_drop = data.did_not_drop

    assignment.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    # Get player info if assigned
    player = None
    if assignment.player_id:
        player_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.id == assignment.player_id)
        )
        player = player_result.scalar_one_or_none()

    return assignment_to_response(assignment, player)


@router.delete(
    "/{group_id}/weekly-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_weekly_assignment(
    group_id: str,
    assignment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a weekly assignment (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    result = await session.execute(
        select(WeeklyAssignment).where(
            WeeklyAssignment.id == assignment_id,
            WeeklyAssignment.static_group_id == group_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise NotFound("Assignment not found")

    await session.delete(assignment)
    await session.commit()


@router.post(
    "/{group_id}/weekly-assignments/bulk",
    response_model=list[WeeklyAssignmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_weekly_assignments(
    group_id: str,
    data: WeeklyAssignmentBulkCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[WeeklyAssignmentResponse]:
    """Bulk create weekly assignments (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    now = datetime.now(timezone.utc).isoformat()
    created_assignments: list[WeeklyAssignment] = []

    # Batch fetch existing assignments to avoid N+1 queries
    existing_result = await session.execute(
        select(WeeklyAssignment).where(
            WeeklyAssignment.static_group_id == group_id,
            WeeklyAssignment.tier_id == data.tier_id,
            WeeklyAssignment.week == data.week,
        )
    )
    existing_assignments = existing_result.scalars().all()
    existing_keys = {(a.floor, a.slot, a.player_id) for a in existing_assignments}

    # Batch validate player_ids - collect unique non-null player IDs
    player_ids_to_validate = {
        a.player_id for a in data.assignments if a.player_id
    }
    valid_player_ids: set[str] = set()
    if player_ids_to_validate:
        valid_players_result = await session.execute(
            select(SnapshotPlayer.id)
            .join(TierSnapshot)
            .where(
                SnapshotPlayer.id.in_(player_ids_to_validate),
                TierSnapshot.static_group_id == group_id,
                TierSnapshot.tier_id == data.tier_id,
            )
        )
        valid_player_ids = {p[0] for p in valid_players_result.all()}

    for assignment_data in data.assignments:
        # Skip if player_id is invalid (not in tier/group)
        if assignment_data.player_id and assignment_data.player_id not in valid_player_ids:
            continue

        # Skip duplicates silently in bulk mode
        key = (assignment_data.floor, assignment_data.slot, assignment_data.player_id)
        if key in existing_keys:
            continue

        assignment = WeeklyAssignment(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            tier_id=data.tier_id,
            week=data.week,
            floor=assignment_data.floor,
            slot=assignment_data.slot,
            player_id=assignment_data.player_id,
            sort_order=assignment_data.sort_order,
            did_not_drop=assignment_data.did_not_drop,
            created_at=now,
            updated_at=now,
        )
        session.add(assignment)
        created_assignments.append(assignment)
        # Add to existing_keys to prevent duplicates within the same request
        existing_keys.add(key)

    await session.flush()
    await session.commit()

    # Get player info for all assignments
    player_ids = [a.player_id for a in created_assignments if a.player_id]
    players_map: dict[str, SnapshotPlayer] = {}

    if player_ids:
        players_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.id.in_(player_ids))
        )
        players = players_result.scalars().all()
        players_map = {p.id: p for p in players}

    return [
        assignment_to_response(a, players_map.get(a.player_id) if a.player_id else None)
        for a in created_assignments
    ]


@router.delete(
    "/{group_id}/weekly-assignments/bulk",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def bulk_delete_weekly_assignments(
    group_id: str,
    data: WeeklyAssignmentBulkDelete,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Bulk delete weekly assignments (Owner/Lead only)"""
    await get_static_group(session, group_id)
    await require_can_edit_roster(session, current_user.id, group_id)

    # Build delete query with filters
    from sqlalchemy import delete

    query = delete(WeeklyAssignment).where(
        WeeklyAssignment.static_group_id == group_id,
        WeeklyAssignment.tier_id == data.tier_id,
        WeeklyAssignment.week == data.week,
    )

    if data.floor:
        query = query.where(WeeklyAssignment.floor == data.floor)
    if data.slot:
        query = query.where(WeeklyAssignment.slot == data.slot)

    await session.execute(query)
    await session.commit()
