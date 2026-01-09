"""API router for static group operations"""

import copy
import json
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User
from ..permissions import (
    NotFound,
    check_view_permission,
    get_static_group,
    get_static_group_by_share_code,
    get_user_linked_static_groups,
    get_user_membership,
    get_user_static_groups,
    require_can_manage_members,
    require_owner,
)
from ..schemas import (
    DuplicateGroupRequest,
    GroupSourceEnum,
    LinkedPlayerInfo,
    LinkedUserInfo,
    MemberInfo,
    MemberRoleEnum,
    MembershipResponse,
    MembershipUpdate,
    OwnerInfo,
    StaticGroupCreate,
    StaticGroupListItem,
    StaticGroupResponse,
    StaticGroupUpdate,
    StaticGroupWithMembers,
    StaticSettingsSchema,
)
from ..services import generate_share_code

router = APIRouter(prefix="/api/static-groups", tags=["static-groups"])
logger = structlog.get_logger(__name__)


def settings_to_schema(settings: dict | None) -> StaticSettingsSchema | None:
    """Convert settings dict from DB to schema. Returns None if no custom settings."""
    if not settings:
        return None
    return StaticSettingsSchema(**settings)


def membership_to_response(membership: Membership, include_user: bool = True) -> MembershipResponse:
    """Convert Membership model to MembershipResponse schema"""
    user_info = None
    if include_user and membership.user:
        user_info = MemberInfo(
            id=membership.user.id,
            discord_id=membership.user.discord_id,
            discord_username=membership.user.discord_username,
            discord_avatar=membership.user.discord_avatar,
            avatar_url=membership.user.avatar_url,
            display_name=membership.user.display_name,
        )

    return MembershipResponse(
        id=membership.id,
        user_id=membership.user_id,
        static_group_id=membership.static_group_id,
        role=MemberRoleEnum(membership.role),
        joined_at=membership.joined_at,
        user=user_info,
    )


def group_to_response(
    group: StaticGroup,
    user_role: MemberRole | None = None,
) -> StaticGroupResponse:
    """Convert StaticGroup model to StaticGroupResponse schema"""
    return StaticGroupResponse(
        id=group.id,
        name=group.name,
        share_code=group.share_code,
        is_public=group.is_public,
        owner_id=group.owner_id,
        settings=settings_to_schema(group.settings),
        created_at=group.created_at,
        updated_at=group.updated_at,
        member_count=group.member_count,
        user_role=MemberRoleEnum(user_role.value) if user_role else None,
    )


def group_to_response_with_members(
    group: StaticGroup,
    user_role: MemberRole | None = None,
) -> StaticGroupWithMembers:
    """Convert StaticGroup model to StaticGroupWithMembers schema"""
    owner_info = None
    if group.owner:
        owner_info = OwnerInfo(
            id=group.owner.id,
            discord_username=group.owner.discord_username,
            discord_avatar=group.owner.discord_avatar,
            avatar_url=group.owner.avatar_url,
            display_name=group.owner.display_name,
        )

    members = [
        membership_to_response(m, include_user=True)
        for m in (group.memberships or [])
    ]

    return StaticGroupWithMembers(
        id=group.id,
        name=group.name,
        share_code=group.share_code,
        is_public=group.is_public,
        owner_id=group.owner_id,
        owner=owner_info,
        members=members,
        settings=settings_to_schema(group.settings),
        created_at=group.created_at,
        updated_at=group.updated_at,
        user_role=MemberRoleEnum(user_role.value) if user_role else None,
    )


# --- Static Group CRUD ---


@router.get("", response_model=list[StaticGroupListItem])
async def list_user_static_groups(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[StaticGroupListItem]:
    """List all static groups the current user is a member of or linked to.

    Args:
        limit: Maximum number of groups to return (default 50, max 100)
        offset: Number of groups to skip for pagination
    """
    # Clamp limit to prevent unbounded queries
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    # Get groups via membership
    groups_with_memberships = await get_user_static_groups(session, current_user.id)
    member_group_ids = {group.id for group, _ in groups_with_memberships}

    result: list[StaticGroupListItem] = [
        StaticGroupListItem(
            id=group.id,
            name=group.name,
            share_code=group.share_code,
            is_public=group.is_public,
            owner_id=group.owner_id,
            member_count=group.member_count,
            user_role=MemberRoleEnum(membership.role),
            source=GroupSourceEnum.MEMBERSHIP,
            settings=settings_to_schema(group.settings),
            created_at=group.created_at,
            updated_at=group.updated_at,
        )
        for group, membership in groups_with_memberships
    ]

    # Get groups via player link (excluding those already in membership)
    linked_groups = await get_user_linked_static_groups(session, current_user.id)
    for group in linked_groups:
        if group.id not in member_group_ids:
            result.append(
                StaticGroupListItem(
                    id=group.id,
                    name=group.name,
                    share_code=group.share_code,
                    is_public=group.is_public,
                    owner_id=group.owner_id,
                    member_count=group.member_count,
                    user_role=None,  # No membership role for linked groups
                    source=GroupSourceEnum.LINKED,
                    settings=settings_to_schema(group.settings),
                    created_at=group.created_at,
                    updated_at=group.updated_at,
                )
            )

    # Sort by name and apply pagination
    result.sort(key=lambda x: x.name)
    return result[offset:offset + limit]


@router.post("", response_model=StaticGroupWithMembers, status_code=status.HTTP_201_CREATED)
async def create_static_group(
    data: StaticGroupCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticGroupWithMembers:
    """Create a new static group (user becomes owner)"""
    now = datetime.now(timezone.utc).isoformat()
    group_id = str(uuid.uuid4())
    share_code = await generate_share_code(session)

    # Create the static group
    group = StaticGroup(
        id=group_id,
        name=data.name,
        owner_id=current_user.id,
        share_code=share_code,
        is_public=data.is_public,
        settings=data.settings.model_dump(by_alias=True) if data.settings else None,
        created_at=now,
        updated_at=now,
    )
    session.add(group)

    # Create owner membership
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        static_group_id=group_id,
        role=MemberRole.OWNER.value,
        joined_at=now,
        updated_at=now,
    )
    session.add(membership)

    await session.flush()

    # Reload with relationships
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == group_id)
        .options(
            selectinload(StaticGroup.owner),
            selectinload(StaticGroup.memberships).selectinload(Membership.user),
        )
    )
    group = result.scalar_one()

    return group_to_response_with_members(group, MemberRole.OWNER)


@router.get("/by-code/{share_code}", response_model=StaticGroupWithMembers)
async def get_static_group_by_code(
    share_code: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> StaticGroupWithMembers:
    """Get a static group by share code (public access or member access)"""
    # Get the group
    group = await get_static_group_by_share_code(session, share_code.upper(), load_memberships=False)

    # Load full group with relationships
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == group.id)
        .options(
            selectinload(StaticGroup.owner),
            selectinload(StaticGroup.memberships).selectinload(Membership.user),
        )
    )
    group = result.scalar_one()

    # Check view permission
    membership = await check_view_permission(session, group, current_user)

    user_role = MemberRole(membership.role) if membership else None
    return group_to_response_with_members(group, user_role)


@router.get("/{group_id}", response_model=StaticGroupWithMembers)
async def get_static_group_by_id(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> StaticGroupWithMembers:
    """Get a static group by ID (public access or member access)"""
    # Load group with relationships
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == group_id)
        .options(
            selectinload(StaticGroup.owner),
            selectinload(StaticGroup.memberships).selectinload(Membership.user),
        )
    )
    group = result.scalar_one_or_none()

    if not group:
        raise NotFound("Static group not found")

    # Check view permission
    membership = await check_view_permission(session, group, current_user)

    user_role = MemberRole(membership.role) if membership else None
    return group_to_response_with_members(group, user_role)


@router.put("/{group_id}", response_model=StaticGroupResponse)
async def update_static_group(
    group_id: str,
    data: StaticGroupUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticGroupResponse:
    """Update a static group (owner or lead only)"""
    group = await get_static_group(session, group_id, load_memberships=True)

    # Check permission - name/settings require lead, visibility requires owner
    if data.is_public is not None:
        await require_owner(session, current_user.id, group_id)
    else:
        await require_can_manage_members(session, current_user.id, group_id)

    # Update fields
    if data.name is not None:
        group.name = data.name
    if data.is_public is not None:
        group.is_public = data.is_public
    if data.settings is not None:
        group.settings = data.settings.model_dump(by_alias=True)

    group.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    # Get user's membership for response
    membership = await get_user_membership(session, current_user.id, group_id)
    user_role = MemberRole(membership.role) if membership else None

    return group_to_response(group, user_role)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_static_group(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a static group (owner only)"""
    group = await get_static_group(session, group_id)

    # Only owner can delete
    await require_owner(session, current_user.id, group_id)

    await session.delete(group)


@router.post("/{group_id}/duplicate", response_model=StaticGroupWithMembers, status_code=status.HTTP_201_CREATED)
async def duplicate_group(
    group_id: str,
    data: DuplicateGroupRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticGroupWithMembers:
    """Duplicate a static group with all tiers and players in a single transaction.

    This endpoint efficiently copies a group, its tiers, and player configurations
    in a single database transaction, avoiding the N+1 query problem of multiple
    sequential API calls.
    """
    # Verify permission - must be member of source group
    membership = await get_user_membership(session, current_user.id, group_id)
    if not membership:
        raise NotFound("Group not found or you don't have access")

    # Load source group with all tiers and players
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == group_id)
        .options(
            selectinload(StaticGroup.tier_snapshots).selectinload(TierSnapshot.players),
        )
    )
    source_group = result.scalar_one_or_none()

    if not source_group:
        raise NotFound("Source group not found")

    now = datetime.now(timezone.utc).isoformat()
    new_group_id = str(uuid.uuid4())
    new_share_code = await generate_share_code(session)

    # Create new group (current user becomes owner)
    new_group = StaticGroup(
        id=new_group_id,
        name=data.new_name,
        owner_id=current_user.id,
        share_code=new_share_code,
        is_public=False,  # Duplicated groups start private
        settings=source_group.settings,
        created_at=now,
        updated_at=now,
    )
    session.add(new_group)

    # Create owner membership for current user
    owner_membership = Membership(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        static_group_id=new_group_id,
        role=MemberRole.OWNER.value,
        joined_at=now,
        updated_at=now,
    )
    session.add(owner_membership)

    # Track ID mappings for any future loot history duplication
    tier_id_map: dict[str, str] = {}
    player_id_map: dict[str, str] = {}

    def safe_copy_json(value, default, field_name: str = "unknown"):
        """Copy JSON field, handling both Python objects and JSON strings."""
        if value is None:
            return default
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return copy.deepcopy(parsed)
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    "Failed to parse JSON field during group duplication",
                    field=field_name,
                    error=str(e),
                    value_preview=value[:100] if len(value) > 100 else value,
                )
                return default
        if isinstance(value, (list, dict)):
            return copy.deepcopy(value)
        return default

    if data.copy_tiers and source_group.tier_snapshots:
        for source_tier in source_group.tier_snapshots:
            new_tier_id = str(uuid.uuid4())
            tier_id_map[source_tier.id] = new_tier_id

            new_tier = TierSnapshot(
                id=new_tier_id,
                static_group_id=new_group_id,
                tier_id=source_tier.tier_id,
                content_type=source_tier.content_type,
                is_active=source_tier.is_active,
                current_week=1,  # Reset week tracking for new group
                week_start_date=None,  # Clear week start date
                weapon_priorities_auto_lock_date=source_tier.weapon_priorities_auto_lock_date,
                weapon_priorities_global_lock=False,  # Reset lock state
                weapon_priorities_global_locked_by=None,
                weapon_priorities_global_locked_at=None,
                created_at=now,
                updated_at=now,
            )
            session.add(new_tier)

            if data.copy_players and source_tier.players:
                for source_player in source_tier.players:
                    new_player_id = str(uuid.uuid4())
                    player_id_map[source_player.id] = new_player_id

                    new_player = SnapshotPlayer(
                        id=new_player_id,
                        tier_snapshot_id=new_tier_id,
                        # Don't copy user_id - new group has independent ownership
                        user_id=None,
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
                        bis_link=source_player.bis_link,
                        gear=safe_copy_json(source_player.gear, [], "gear"),
                        tome_weapon=safe_copy_json(source_player.tome_weapon, {}, "tome_weapon"),
                        weapon_priorities=safe_copy_json(source_player.weapon_priorities, [], "weapon_priorities"),
                        weapon_priorities_locked=False,  # Reset lock state
                        weapon_priorities_locked_by=None,
                        weapon_priorities_locked_at=None,
                        loot_adjustment=0,  # Reset adjustments for new group
                        page_adjustments={"I": 0, "II": 0, "III": 0, "IV": 0},
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(new_player)

    await session.flush()

    logger.info(
        "static_group_duplicated",
        source_id=group_id,
        new_id=new_group_id,
        user_id=current_user.id,
        tiers_copied=len(tier_id_map),
        players_copied=len(player_id_map),
    )

    # Reload with relationships for response
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == new_group_id)
        .options(
            selectinload(StaticGroup.owner),
            selectinload(StaticGroup.memberships).selectinload(Membership.user),
        )
    )
    new_group = result.scalar_one()

    return group_to_response_with_members(new_group, MemberRole.OWNER)


# --- Membership Management ---


@router.get("/{group_id}/members", response_model=list[MembershipResponse])
async def list_members(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[MembershipResponse]:
    """List all members of a static group"""
    # Load group with memberships
    result = await session.execute(
        select(StaticGroup)
        .where(StaticGroup.id == group_id)
        .options(selectinload(StaticGroup.memberships).selectinload(Membership.user))
    )
    group = result.scalar_one_or_none()

    if not group:
        raise NotFound("Static group not found")

    # Check view permission
    await check_view_permission(session, group, current_user)

    return [membership_to_response(m) for m in group.memberships]


@router.get("/{group_id}/linked-players", response_model=list[LinkedPlayerInfo])
async def list_linked_players(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[LinkedPlayerInfo]:
    """List all users who have claimed player cards in this group (across all tiers)"""
    # Check group exists and user has view permission
    group = await get_static_group(session, group_id, load_memberships=False)
    await check_view_permission(session, group, current_user)

    # Get all linked players across all tiers for this group
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(TierSnapshot.static_group_id == group_id)
        .where(SnapshotPlayer.user_id.isnot(None))
        .options(selectinload(SnapshotPlayer.user))
    )
    players = result.scalars().all()

    # Deduplicate by user_id (same user might be linked in multiple tiers)
    seen_users: set[str] = set()
    linked_players: list[LinkedPlayerInfo] = []

    for player in players:
        if player.user_id and player.user_id not in seen_users and player.user:
            seen_users.add(player.user_id)
            linked_players.append(
                LinkedPlayerInfo(
                    player_id=player.id,
                    player_name=player.name,
                    player_job=player.job,
                    tier_id=player.tier_snapshot_id,
                    user=LinkedUserInfo(
                        id=player.user.id,
                        discord_id=player.user.discord_id,
                        discord_username=player.user.discord_username,
                        discord_avatar=player.user.discord_avatar,
                        avatar_url=player.user.avatar_url,
                        display_name=player.user.display_name,
                    ),
                )
            )

    return linked_players


@router.post("/{group_id}/members", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: str,
    user_id: str,
    role: MemberRoleEnum = MemberRoleEnum.MEMBER,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MembershipResponse:
    """Add a member to a static group (lead or owner only)"""
    from ..permissions import PermissionDenied

    group = await get_static_group(session, group_id)

    # Check permission
    actor_membership = await require_can_manage_members(session, current_user.id, group_id)

    # Cannot add someone as owner
    if role == MemberRoleEnum.OWNER:
        raise PermissionDenied("Cannot add a member as owner")

    # Leads cannot add other leads
    if role == MemberRoleEnum.LEAD and actor_membership.role != MemberRole.OWNER.value:
        raise PermissionDenied("Only owners can add leads")

    # Check if user exists
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFound("User not found")

    # Check if already a member
    existing = await get_user_membership(session, user_id, group_id)
    if existing:
        raise PermissionDenied("User is already a member of this group")

    # Create membership
    now = datetime.now(timezone.utc).isoformat()
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=user_id,
        static_group_id=group_id,
        role=role.value,
        joined_at=now,
        updated_at=now,
    )
    session.add(membership)
    await session.flush()

    # Reload with user relationship
    result = await session.execute(
        select(Membership)
        .where(Membership.id == membership.id)
        .options(selectinload(Membership.user))
    )
    membership = result.scalar_one()

    return membership_to_response(membership)


@router.put("/{group_id}/members/{user_id}", response_model=MembershipResponse)
async def update_member_role(
    group_id: str,
    user_id: str,
    data: MembershipUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MembershipResponse:
    """Update a member's role (lead or owner only)"""
    from ..permissions import PermissionDenied

    group = await get_static_group(session, group_id)

    # Get actor's membership
    actor_membership = await require_can_manage_members(session, current_user.id, group_id)

    # Get target membership
    target_membership = await get_user_membership(session, user_id, group_id)
    if not target_membership:
        raise NotFound("Member not found")

    # Cannot change owner's role
    if target_membership.role == MemberRole.OWNER.value:
        raise PermissionDenied("Cannot change owner's role")

    # Cannot promote to owner
    if data.role == MemberRoleEnum.OWNER:
        raise PermissionDenied("Cannot promote to owner")

    # Leads can only manage members/viewers, not other leads
    if actor_membership.role != MemberRole.OWNER.value:
        if target_membership.role == MemberRole.LEAD.value:
            raise PermissionDenied("Only owners can manage leads")
        if data.role == MemberRoleEnum.LEAD:
            raise PermissionDenied("Only owners can promote to lead")

    # Update role
    target_membership.role = data.role.value
    target_membership.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    # Reload with user relationship
    result = await session.execute(
        select(Membership)
        .where(Membership.id == target_membership.id)
        .options(selectinload(Membership.user))
    )
    membership = result.scalar_one()

    return membership_to_response(membership)


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: str,
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a member from a static group (lead/owner, or self)"""
    from ..permissions import PermissionDenied

    group = await get_static_group(session, group_id)

    # Get target membership
    target_membership = await get_user_membership(session, user_id, group_id)
    if not target_membership:
        raise NotFound("Member not found")

    # Self-removal is always allowed (except for owner)
    if user_id == current_user.id:
        if target_membership.role == MemberRole.OWNER.value:
            raise PermissionDenied("Owner cannot leave the group. Transfer ownership first.")
        await session.delete(target_membership)
        return

    # Otherwise, need manage permission
    actor_membership = await require_can_manage_members(session, current_user.id, group_id)

    # Cannot remove owner
    if target_membership.role == MemberRole.OWNER.value:
        raise PermissionDenied("Cannot remove the owner")

    # Leads cannot remove other leads
    if (
        actor_membership.role != MemberRole.OWNER.value
        and target_membership.role == MemberRole.LEAD.value
    ):
        raise PermissionDenied("Only owners can remove leads")

    await session.delete(target_membership)


@router.post("/{group_id}/transfer-ownership", response_model=StaticGroupResponse)
async def transfer_ownership(
    group_id: str,
    new_owner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StaticGroupResponse:
    """Transfer ownership to another member (owner only)"""
    from ..permissions import PermissionDenied

    group = await get_static_group(session, group_id)

    # Only owner can transfer
    await require_owner(session, current_user.id, group_id)

    # Get new owner's membership
    new_owner_membership = await get_user_membership(session, new_owner_id, group_id)
    if not new_owner_membership:
        raise NotFound("New owner must be a member of the group")

    # Get current owner's membership
    current_owner_membership = await get_user_membership(session, current_user.id, group_id)

    now = datetime.now(timezone.utc).isoformat()

    # Update group owner
    group.owner_id = new_owner_id
    group.updated_at = now

    # Update memberships
    new_owner_membership.role = MemberRole.OWNER.value
    new_owner_membership.updated_at = now

    current_owner_membership.role = MemberRole.LEAD.value  # Demote to lead
    current_owner_membership.updated_at = now

    await session.flush()

    return group_to_response(group, MemberRole.LEAD)
