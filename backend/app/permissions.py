"""Permission utilities for static group access control"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Membership, MemberRole, StaticGroup, User


class PermissionDenied(HTTPException):
    """Exception for permission denied errors"""

    def __init__(self, detail: str = "Permission denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


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


async def require_membership(
    session: AsyncSession,
    user_id: str,
    group_id: str,
    min_role: MemberRole | None = None,
) -> Membership:
    """
    Require that a user is a member of a static group.

    Args:
        session: Database session
        user_id: User ID to check
        group_id: Static group ID
        min_role: Minimum required role (optional)

    Returns:
        The user's membership

    Raises:
        PermissionDenied: If user is not a member or doesn't have required role
    """
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

    Args:
        session: Database session
        group: The static group to check
        user: The user (or None for anonymous)

    Returns:
        The user's membership if they are a member, None for public access

    Raises:
        PermissionDenied: If the group is private and user is not a member
    """
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
        .order_by(StaticGroup.name)
    )
    return list(result.all())
