"""API router for static group operations"""

import copy
import json
import uuid
from datetime import datetime, timezone
from typing import Any, TypeVar

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User
from ..permissions import (
    NotFound,
    PermissionDenied,
    check_view_permission,
    get_static_group,
    get_static_group_by_share_code,
    get_user_linked_static_groups,
    get_user_membership,
    get_user_role_for_response,
    get_user_static_groups,
    is_user_admin,
    require_can_manage_members,
    require_owner,
)
from ..schemas import (
    AdminStaticGroupListItem,
    AdminStaticGroupListResponse,
    DuplicateGroupRequest,
    GroupSourceEnum,
    InteractedUserInfo,
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

# TypeVar for generic JSON field types in safe_copy_json
JSONValue = TypeVar("JSONValue")


def safe_copy_json(value: Any, default: JSONValue, field_name: str = "unknown") -> JSONValue:
    """Copy JSON field, handling both Python objects and JSON strings.

    Used during group duplication to deep copy JSON fields like gear, weapon_priorities, etc.
    Handles both parsed Python objects and raw JSON strings from the database.
    """
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
    is_admin_access: bool = False,
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
        is_admin_access=is_admin_access,
    )


def group_to_response_with_members(
    group: StaticGroup,
    user_role: MemberRole | None = None,
    is_admin_access: bool = False,
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
        is_admin_access=is_admin_access,
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
    await session.commit()

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

    # Check view permission (this also handles private group access checks)
    await check_view_permission(session, group, current_user)

    # Get role and admin access flag for response
    user_role, is_admin_access = (None, False)
    if current_user:
        user_role, is_admin_access = await get_user_role_for_response(
            session, current_user.id, group.id
        )

    return group_to_response_with_members(group, user_role, is_admin_access)


# --- Admin Endpoints ---
# NOTE: These must be defined BEFORE /{group_id} to avoid route conflicts


@router.get("/admin/all", response_model=AdminStaticGroupListResponse)
async def list_all_static_groups_admin(
    search: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AdminStaticGroupListResponse:
    """List all static groups (admin only).

    This endpoint is restricted to admin users and returns all static groups
    in the system with owner information for troubleshooting purposes.

    Args:
        search: Optional search term to filter by group name or owner username
        sort_by: Column to sort by (name, owner, memberCount, tierCount, isPublic, createdAt)
        sort_order: Sort direction (asc or desc)
        limit: Maximum number of groups to return (default 50, max 100)
        offset: Number of groups to skip for pagination
    """
    # Check admin permission
    if not await is_user_admin(session, current_user.id):
        raise PermissionDenied("Admin access required")

    # Clamp limit to prevent unbounded queries
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    # Build subqueries for computed columns (memberCount, tierCount)
    member_count_subq = (
        select(func.count(Membership.id))
        .where(Membership.static_group_id == StaticGroup.id)
        .correlate(StaticGroup)
        .scalar_subquery()
    )

    tier_count_subq = (
        select(func.count(TierSnapshot.id))
        .where(TierSnapshot.static_group_id == StaticGroup.id)
        .correlate(StaticGroup)
        .scalar_subquery()
    )

    # Build base query with scalar subqueries for counts (avoiding N+1)
    # Only eager load owner relationship - counts come from subqueries
    query = (
        select(
            StaticGroup,
            member_count_subq.label("member_count"),
            tier_count_subq.label("tier_count"),
        )
        .options(selectinload(StaticGroup.owner))
    )

    # For owner sorting, we need to join the User table
    needs_owner_join = sort_by == "owner"
    if needs_owner_join:
        query = query.join(User, StaticGroup.owner_id == User.id)

    # Determine sort column and direction
    sort_columns = {
        "name": StaticGroup.name,
        "createdAt": StaticGroup.created_at,
        "isPublic": StaticGroup.is_public,
        "memberCount": member_count_subq,
        "tierCount": tier_count_subq,
        "owner": User.discord_username,  # Requires owner join
    }
    sort_column = sort_columns.get(sort_by, StaticGroup.name)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Compute search term once if provided
    search_term = f"%{search.lower()}%" if search else None

    # Apply search filter if provided
    if search_term:
        # Only join User if not already joined for owner sorting
        if not needs_owner_join:
            query = query.join(User, StaticGroup.owner_id == User.id)
        query = query.where(
            (StaticGroup.name.ilike(search_term)) |
            (User.discord_username.ilike(search_term))
        )

    # Get total count (before pagination) using func.count() for efficiency
    count_query = select(func.count(StaticGroup.id))
    if search_term:
        count_query = count_query.join(User, StaticGroup.owner_id == User.id).where(
            (StaticGroup.name.ilike(search_term)) |
            (User.discord_username.ilike(search_term))
        )
    total = await session.scalar(count_query) or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)

    result = await session.execute(query)
    rows = result.unique().all()

    items = []
    for row in rows:
        # Unpack: (StaticGroup, member_count, tier_count)
        group = row[0]
        member_count = row[1]
        tier_count = row[2]

        items.append(
            AdminStaticGroupListItem(
                id=group.id,
                name=group.name,
                share_code=group.share_code,
                is_public=group.is_public,
                owner_id=group.owner_id,
                owner=OwnerInfo(
                    id=group.owner.id,
                    discord_username=group.owner.discord_username,
                    discord_avatar=group.owner.discord_avatar,
                    avatar_url=group.owner.avatar_url,
                    display_name=group.owner.display_name,
                ) if group.owner else None,
                member_count=member_count,
                tier_count=tier_count,
                created_at=group.created_at,
                updated_at=group.updated_at,
            )
        )

    return AdminStaticGroupListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/admin/user-role/{group_id}/{user_id}")
async def get_user_role_in_group_admin(
    group_id: str,
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get a user's role in a specific group (admin only).

    Used for the "View As" feature to show the UI from another user's perspective.
    Returns the user's membership info including role, or indicates they're not a member.
    """
    # Check admin permission
    if not await is_user_admin(session, current_user.id):
        raise PermissionDenied("Admin access required")

    # Verify group exists
    group = await get_static_group(session, group_id)

    # Get target user info
    result = await session.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise NotFound("User not found")

    # Get their membership in this group
    membership = await get_user_membership(session, user_id, group_id)

    # Check if user is linked to any player in this group (via player.user_id)
    linked_player_result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(TierSnapshot.static_group_id == group_id)
        .where(SnapshotPlayer.user_id == user_id)
        .limit(1)
    )
    linked_player = linked_player_result.scalar_one_or_none()

    return {
        "userId": target_user.id,
        "discordUsername": target_user.discord_username,
        "displayName": target_user.display_name,
        "avatarUrl": target_user.avatar_url,
        "groupId": group_id,
        "groupName": group.name,
        "isMember": membership is not None,
        "role": membership.role if membership else None,
        "isLinkedPlayer": linked_player is not None,
        "linkedPlayerId": linked_player.id if linked_player else None,
        "linkedPlayerName": linked_player.name if linked_player else None,
    }


@router.get("/admin/all-users", response_model=list[InteractedUserInfo])
async def list_all_users_admin(
    group_id: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[InteractedUserInfo]:
    """List ALL users in the database (admin only)

    Used by admins in assignment modals to assign any user to a player card.

    Args:
        group_id: Optional group ID to check membership status for each user
    """
    # Require admin permission
    is_admin = await is_user_admin(session, current_user.id)
    if not is_admin:
        raise PermissionDenied("Only admins can view all users")

    # Fetch all users
    result = await session.execute(select(User).order_by(User.discord_username))
    users = result.scalars().all()

    # If group_id provided, fetch memberships for that group
    memberships_map: dict[str, Membership] = {}
    if group_id:
        memberships_result = await session.execute(
            select(Membership).where(Membership.static_group_id == group_id)
        )
        for membership in memberships_result.scalars().all():
            memberships_map[membership.user_id] = membership

    # Convert to InteractedUserInfo format
    return [
        InteractedUserInfo(
            user=MemberInfo(
                id=user.id,
                discord_id=user.discord_id,
                discord_username=user.discord_username,
                discord_avatar=user.discord_avatar,
                avatar_url=user.avatar_url,
                display_name=user.display_name,
            ),
            is_member=user.id in memberships_map,
            member_role=memberships_map[user.id].role if user.id in memberships_map else None,
        )
        for user in users
    ]


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

    # Check view permission (this also handles private group access checks)
    await check_view_permission(session, group, current_user)

    # Get role and admin access flag for response
    user_role, is_admin_access = (None, False)
    if current_user:
        user_role, is_admin_access = await get_user_role_for_response(
            session, current_user.id, group.id
        )

    return group_to_response_with_members(group, user_role, is_admin_access)


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
    await session.commit()

    # Get user's role for response (including admin virtual role)
    user_role, is_admin_access = await get_user_role_for_response(
        session, current_user.id, group_id
    )

    return group_to_response(group, user_role, is_admin_access)


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
    await session.commit()


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
    # Verify permission - must be member of source group (or admin)
    user_is_admin = await is_user_admin(session, current_user.id)
    membership = await get_user_membership(session, current_user.id, group_id)
    if not membership and not user_is_admin:
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
        settings=copy.deepcopy(source_group.settings) if source_group.settings else None,
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

    if data.copy_tiers and source_group.tier_snapshots:
        # Find which tier_id is currently active in the source group
        # This ensures the same tier (by tier_id like "aac-heavyweight") stays active
        source_active_tier_id = next(
            (t.tier_id for t in source_group.tier_snapshots if t.is_active),
            None
        )

        for source_tier in source_group.tier_snapshots:
            new_tier_id = str(uuid.uuid4())
            tier_id_map[source_tier.id] = new_tier_id

            # Set the tier with matching tier_id as active (preserves user's selection)
            should_be_active = source_tier.tier_id == source_active_tier_id

            new_tier = TierSnapshot(
                id=new_tier_id,
                static_group_id=new_group_id,
                tier_id=source_tier.tier_id,
                content_type=source_tier.content_type,
                is_active=should_be_active,
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

                    # Deep copy gear data
                    copied_gear = safe_copy_json(source_player.gear, [], "gear")
                    copied_tome_weapon = safe_copy_json(source_player.tome_weapon, {}, "tome_weapon")
                    copied_weapon_priorities = safe_copy_json(source_player.weapon_priorities, [], "weapon_priorities")

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
                        gear=copied_gear,
                        tome_weapon=copied_tome_weapon,
                        weapon_priorities=copied_weapon_priorities,
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
    await session.commit()

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
    # Check group exists and user has view permission (also loads memberships for role lookup)
    group = await get_static_group(session, group_id, load_memberships=True)
    await check_view_permission(session, group, current_user)

    # Build membership role lookup (user_id -> role)
    membership_roles: dict[str, str] = {
        m.user_id: m.role for m in group.memberships
    }

    # Get all linked players across all tiers for this group
    # Select both SnapshotPlayer and TierSnapshot to get the tier_id (identifier, not UUID)
    result = await session.execute(
        select(SnapshotPlayer, TierSnapshot.tier_id)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(TierSnapshot.static_group_id == group_id)
        .where(SnapshotPlayer.user_id.isnot(None))
        .options(selectinload(SnapshotPlayer.user))
    )
    rows = result.all()

    # Deduplicate by user_id (same user might be linked in multiple tiers)
    seen_users: set[str] = set()
    linked_players: list[LinkedPlayerInfo] = []

    for player, tier_id in rows:
        if player.user_id and player.user_id not in seen_users and player.user:
            seen_users.add(player.user_id)
            linked_players.append(
                LinkedPlayerInfo(
                    player_id=player.id,
                    player_name=player.name,
                    player_job=player.job,
                    tier_id=tier_id,  # Use the tier identifier, not UUID
                    user=LinkedUserInfo(
                        id=player.user.id,
                        discord_id=player.user.discord_id,
                        discord_username=player.user.discord_username,
                        discord_avatar=player.user.discord_avatar,
                        avatar_url=player.user.avatar_url,
                        display_name=player.user.display_name,
                        membership_role=membership_roles.get(player.user_id),
                    ),
                )
            )

    return linked_players


@router.get("/{group_id}/interacted-users", response_model=list[InteractedUserInfo])
async def list_interacted_users(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[InteractedUserInfo]:
    """List all users who have interacted with this group (members + linked players)

    Owner or admin only. Used for assignment modals to show all possible users.
    """
    # Require owner or admin permission
    is_admin = await is_user_admin(session, current_user.id)
    if not is_admin:
        await require_owner(session, current_user.id, group_id)

    group = await get_static_group(session, group_id, load_memberships=True, load_membership_users=True)

    # Build user map from members
    user_map: dict[str, InteractedUserInfo] = {}

    # Add all members
    for membership in group.memberships:
        if membership.user:
            user_map[membership.user.id] = InteractedUserInfo(
                user=MemberInfo(
                    id=membership.user.id,
                    discord_id=membership.user.discord_id,
                    discord_username=membership.user.discord_username,
                    discord_avatar=membership.user.discord_avatar,
                    avatar_url=membership.user.avatar_url,
                    display_name=membership.user.display_name,
                ),
                is_member=True,
                member_role=membership.role,
            )

    # Add all linked players (if not already in map as members)
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(TierSnapshot.static_group_id == group_id)
        .where(SnapshotPlayer.user_id.isnot(None))
        .options(selectinload(SnapshotPlayer.user))
    )
    players = result.scalars().all()

    for player in players:
        if player.user_id and player.user_id not in user_map and player.user:
            user_map[player.user_id] = InteractedUserInfo(
                user=MemberInfo(
                    id=player.user.id,
                    discord_id=player.user.discord_id,
                    discord_username=player.user.discord_username,
                    discord_avatar=player.user.discord_avatar,
                    avatar_url=player.user.avatar_url,
                    display_name=player.user.display_name,
                ),
                is_member=False,
                member_role=None,
            )

    # Return sorted by username
    return sorted(user_map.values(), key=lambda u: u.user.discord_username.lower())


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
    await session.commit()

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
    await session.commit()

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
    unlink_players: bool = True,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a member from a static group (lead/owner, or self)

    Args:
        group_id: Static group ID
        user_id: User ID to remove
        unlink_players: If True (default), also unlink any player cards assigned to this user
    """
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
        # Unlink players if requested
        if unlink_players:
            await _unlink_user_players(session, group_id, user_id)
        await session.delete(target_membership)
        await session.commit()
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

    # Unlink players if requested
    if unlink_players:
        await _unlink_user_players(session, group_id, user_id)

    await session.delete(target_membership)
    await session.commit()


async def _unlink_user_players(session: AsyncSession, group_id: str, user_id: str) -> None:
    """Unlink all player cards assigned to a user in a group.

    Finds all SnapshotPlayer records across all tiers in the group that are
    linked to the given user and sets their user_id to None.
    """
    # Find all players linked to this user in any tier of this group
    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(
            TierSnapshot.static_group_id == group_id,
            SnapshotPlayer.user_id == user_id,
        )
    )
    linked_players = result.scalars().all()

    # Unlink each player
    now = datetime.now(timezone.utc).isoformat()
    for player in linked_players:
        player.user_id = None
        player.updated_at = now


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
    await session.commit()

    return group_to_response(group, MemberRole.LEAD)
