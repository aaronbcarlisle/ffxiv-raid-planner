"""API router for static group operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import Membership, MemberRole, StaticGroup, User
from ..permissions import (
    NotFound,
    check_view_permission,
    get_static_group,
    get_static_group_by_share_code,
    get_user_membership,
    get_user_static_groups,
    require_can_manage_members,
    require_owner,
)
from ..schemas import (
    MemberInfo,
    MemberRoleEnum,
    MembershipResponse,
    OwnerInfo,
    StaticGroupCreate,
    StaticGroupListItem,
    StaticGroupResponse,
    StaticGroupUpdate,
    StaticGroupWithMembers,
)
from ..services import generate_share_code

router = APIRouter(prefix="/api/static-groups", tags=["static-groups"])


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
        created_at=group.created_at,
        updated_at=group.updated_at,
        user_role=MemberRoleEnum(user_role.value) if user_role else None,
    )


# --- Static Group CRUD ---


@router.get("", response_model=list[StaticGroupListItem])
async def list_user_static_groups(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[StaticGroupListItem]:
    """List all static groups the current user is a member of"""
    groups_with_memberships = await get_user_static_groups(session, current_user.id)

    return [
        StaticGroupListItem(
            id=group.id,
            name=group.name,
            share_code=group.share_code,
            is_public=group.is_public,
            owner_id=group.owner_id,
            member_count=group.member_count,
            user_role=MemberRoleEnum(membership.role),
            created_at=group.created_at,
            updated_at=group.updated_at,
        )
        for group, membership in groups_with_memberships
    ]


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

    # Check permission - name requires lead, visibility requires owner
    if data.is_public is not None:
        await require_owner(session, current_user.id, group_id)
    else:
        await require_can_manage_members(session, current_user.id, group_id)

    # Update fields
    if data.name is not None:
        group.name = data.name
    if data.is_public is not None:
        group.is_public = data.is_public

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
    role: MemberRoleEnum,
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
    if role == MemberRoleEnum.OWNER:
        raise PermissionDenied("Cannot promote to owner")

    # Leads can only manage members/viewers, not other leads
    if actor_membership.role != MemberRole.OWNER.value:
        if target_membership.role == MemberRole.LEAD.value:
            raise PermissionDenied("Only owners can manage leads")
        if role == MemberRoleEnum.LEAD:
            raise PermissionDenied("Only owners can promote to lead")

    # Update role
    target_membership.role = role.value
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
