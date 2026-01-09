"""Permission utilities for static group access control"""

from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User


class PermissionDenied(HTTPException):
    """Exception for permission denied errors"""

    def __init__(self, detail: str = "Permission denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def create_admin_membership(user_id: str, group_id: str) -> Membership:
    """
    Create a virtual owner membership for admin users.

    This allows admins to bypass normal permission checks by having
    owner-level access to any group without being an actual member.
    """
    now = datetime.now(timezone.utc).isoformat()
    return Membership(
        id=f"admin-virtual-{user_id}-{group_id}",
        user_id=user_id,
        static_group_id=group_id,
        role=MemberRole.OWNER.value,
        joined_at=now,
        updated_at=now,
    )


async def is_user_admin(session: AsyncSession, user_id: str) -> bool:
    """Check if a user has admin privileges."""
    result = await session.execute(
        select(User.is_admin).where(User.id == user_id)
    )
    is_admin = result.scalar_one_or_none()
    return is_admin is True


class NotFound(HTTPException):
    """Exception for not found errors"""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


async def get_static_group(
    session: AsyncSession,
    group_id: str,
    load_memberships: bool = False,
) -> StaticGroup:
    """Get a static group by ID, raising NotFound if it doesn't exist"""
    query = select(StaticGroup).where(StaticGroup.id == group_id)
    if load_memberships:
        query = query.options(selectinload(StaticGroup.memberships))

    result = await session.execute(query)
    group = result.scalar_one_or_none()

    if not group:
        raise NotFound("Static group not found")

    return group


async def get_static_group_by_share_code(
    session: AsyncSession,
    share_code: str,
    load_memberships: bool = False,
) -> StaticGroup:
    """Get a static group by share code, raising NotFound if it doesn't exist"""
    query = select(StaticGroup).where(StaticGroup.share_code == share_code)
    if load_memberships:
        query = query.options(selectinload(StaticGroup.memberships))

    result = await session.execute(query)
    group = result.scalar_one_or_none()

    if not group:
        raise NotFound("Static group not found")

    return group


async def get_user_membership(
    session: AsyncSession,
    user_id: str,
    group_id: str,
) -> Membership | None:
    """Get a user's membership in a static group, or None if not a member"""
    result = await session.execute(
        select(Membership).where(
            Membership.user_id == user_id,
            Membership.static_group_id == group_id,
        )
    )
    return result.scalar_one_or_none()


async def get_user_role_for_response(
    session: AsyncSession,
    user_id: str,
    group_id: str,
) -> tuple[MemberRole | None, bool]:
    """
    Get user's effective role for API responses, including admin virtual role.

    This function should be used in API endpoint responses to correctly
    represent admin users' access level even when they're not actual members.

    Returns:
        Tuple of (role, is_admin_access) where:
        - role: The user's effective role (including 'owner' for admins)
        - is_admin_access: True if role is granted via admin privileges (not actual membership)
    """
    # First check actual membership
    membership = await get_user_membership(session, user_id, group_id)
    if membership:
        return MemberRole(membership.role), False

    # Check if user is admin - grants owner access
    if await is_user_admin(session, user_id):
        return MemberRole.OWNER, True

    return None, False


async def require_membership(
    session: AsyncSession,
    user_id: str,
    group_id: str,
    min_role: MemberRole | None = None,
) -> Membership:
    """
    Require that a user is a member of a static group.

    Admins automatically get owner-level access to all groups.

    Args:
        session: Database session
        user_id: User ID to check
        group_id: Static group ID
        min_role: Minimum required role (optional)

    Returns:
        The user's membership (or virtual admin membership)

    Raises:
        PermissionDenied: If user is not a member or doesn't have required role
    """
    # Check if user is an admin - admins get owner access to all groups
    if await is_user_admin(session, user_id):
        return create_admin_membership(user_id, group_id)

    membership = await get_user_membership(session, user_id, group_id)

    if not membership:
        raise PermissionDenied("You are not a member of this static group")

    if min_role:
        from .models import ROLE_HIERARCHY

        required_level = ROLE_HIERARCHY.get(min_role, 0)
        user_level = membership.role_level

        if user_level < required_level:
            raise PermissionDenied(
                f"This action requires {min_role.value} role or higher"
            )

    return membership


async def check_view_permission(
    session: AsyncSession,
    group: StaticGroup,
    user: User | None,
) -> Membership | None:
    """
    Check if a user can view a static group.

    Admins can view all groups (public and private).

    Args:
        session: Database session
        group: The static group to check
        user: The user (or None for anonymous)

    Returns:
        The user's membership if they are a member, None for public access,
        or virtual admin membership for admins

    Raises:
        PermissionDenied: If the group is private and user is not a member
    """
    # Check if user is an admin - admins can view all groups
    if user and await is_user_admin(session, user.id):
        # Return real membership if exists, otherwise virtual admin membership
        membership = await get_user_membership(session, user.id, group.id)
        return membership or create_admin_membership(user.id, group.id)

    # Public groups can be viewed by anyone
    if group.is_public:
        if user:
            # Return membership if user is logged in and is a member
            return await get_user_membership(session, user.id, group.id)
        return None

    # Private groups require membership
    if not user:
        raise PermissionDenied("This static group is private. Please log in.")

    membership = await get_user_membership(session, user.id, group.id)
    if not membership:
        raise PermissionDenied("This static group is private")

    return membership


async def require_can_edit_roster(
    session: AsyncSession,
    user_id: str,
    group_id: str,
) -> Membership:
    """Require that a user can edit the roster (owner or lead)"""
    return await require_membership(session, user_id, group_id, MemberRole.LEAD)


async def require_can_manage_members(
    session: AsyncSession,
    user_id: str,
    group_id: str,
) -> Membership:
    """Require that a user can manage members (owner or lead)"""
    return await require_membership(session, user_id, group_id, MemberRole.LEAD)


async def require_owner(
    session: AsyncSession,
    user_id: str,
    group_id: str,
) -> Membership:
    """Require that a user is the owner of a static group"""
    return await require_membership(session, user_id, group_id, MemberRole.OWNER)


async def get_user_static_groups(
    session: AsyncSession,
    user_id: str,
) -> list[tuple[StaticGroup, Membership]]:
    """
    Get all static groups a user is a member of.

    Returns:
        List of (StaticGroup, Membership) tuples
    """
    result = await session.execute(
        select(StaticGroup, Membership)
        .join(Membership, Membership.static_group_id == StaticGroup.id)
        .where(Membership.user_id == user_id)
        .options(selectinload(StaticGroup.memberships))
        .order_by(StaticGroup.name)
    )
    return list(result.unique().all())


async def get_user_linked_static_groups(
    session: AsyncSession,
    user_id: str,
) -> list[StaticGroup]:
    """
    Get all static groups where the user is linked to a player (but not a member).

    Returns:
        List of StaticGroup objects
    """
    # Get groups where user is linked to a player
    result = await session.execute(
        select(StaticGroup)
        .join(TierSnapshot, TierSnapshot.static_group_id == StaticGroup.id)
        .join(SnapshotPlayer, SnapshotPlayer.tier_snapshot_id == TierSnapshot.id)
        .where(SnapshotPlayer.user_id == user_id)
        .options(selectinload(StaticGroup.memberships))
        .order_by(StaticGroup.name)
    )
    return list(result.unique().scalars().all())
