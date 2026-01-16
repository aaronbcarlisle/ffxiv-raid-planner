"""API router for invitation operations"""

import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user, get_current_user_optional
from ..models import Invitation, Membership, MemberRole, StaticGroup, User
from ..permissions import (
    NotFound,
    PermissionDenied,
    get_static_group,
    get_user_membership,
    require_can_manage_members,
)
from ..schemas import (
    InvitationAcceptResponse,
    InvitationCreate,
    InvitationPreview,
    InvitationResponse,
    MemberRoleEnum,
)

router = APIRouter(prefix="/api", tags=["invitations"])

# Invite code characters (excluding ambiguous ones)
INVITE_CODE_CHARS = (
    string.ascii_uppercase.replace("O", "").replace("I", "")
    + string.digits.replace("0", "").replace("1", "")
)
INVITE_CODE_LENGTH = 8


def generate_invite_code() -> str:
    """Generate a random invite code"""
    return "".join(secrets.choice(INVITE_CODE_CHARS) for _ in range(INVITE_CODE_LENGTH))


async def get_unique_invite_code(session: AsyncSession, max_attempts: int = 10) -> str:
    """Generate a unique invite code that doesn't exist in the database"""
    for _ in range(max_attempts):
        code = generate_invite_code()
        result = await session.execute(
            select(Invitation).where(Invitation.invite_code == code)
        )
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError(f"Unable to generate unique invite code after {max_attempts} attempts")


def invitation_to_response(invitation: Invitation, group_name: str | None = None) -> InvitationResponse:
    """Convert Invitation model to InvitationResponse schema"""
    return InvitationResponse(
        id=invitation.id,
        static_group_id=invitation.static_group_id,
        invite_code=invitation.invite_code,
        role=MemberRoleEnum(invitation.role),
        expires_at=invitation.expires_at,
        max_uses=invitation.max_uses,
        use_count=invitation.use_count,
        is_active=invitation.is_active,
        is_valid=invitation.is_valid,
        created_at=invitation.created_at,
        created_by_id=invitation.created_by_id,
        static_group_name=group_name,
    )


# --- Invitation CRUD (within a static group) ---


@router.get("/static-groups/{group_id}/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[InvitationResponse]:
    """List all invitations for a static group (lead or owner only)"""
    group = await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    # Load invitations
    result = await session.execute(
        select(Invitation)
        .where(Invitation.static_group_id == group_id)
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()

    return [invitation_to_response(inv, group.name) for inv in invitations]


@router.post(
    "/static-groups/{group_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    group_id: str,
    data: InvitationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InvitationResponse:
    """Create a new invitation for a static group (lead or owner only)"""
    group = await get_static_group(session, group_id)
    actor_membership = await require_can_manage_members(session, current_user.id, group_id)

    # Leads cannot create invitations for lead role
    if data.role == MemberRoleEnum.LEAD and actor_membership.role != MemberRole.OWNER.value:
        raise PermissionDenied("Only owners can create invitations for the lead role")

    # Cannot create invitations for owner role
    if data.role == MemberRoleEnum.OWNER:
        raise PermissionDenied("Cannot create invitations for the owner role")

    now = datetime.now(timezone.utc)
    expires_at = None
    if data.expires_in_days is not None:
        expires_at = (now + timedelta(days=data.expires_in_days)).isoformat()

    invite_code = await get_unique_invite_code(session)

    invitation = Invitation(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        invite_code=invite_code,
        role=data.role.value,
        expires_at=expires_at,
        max_uses=data.max_uses,
        use_count=0,
        is_active=True,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )
    session.add(invitation)
    await session.flush()
    await session.commit()

    return invitation_to_response(invitation, group.name)


@router.delete(
    "/static-groups/{group_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_invitation(
    group_id: str,
    invitation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Revoke (deactivate) an invitation (lead or owner only)"""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    # Get invitation
    result = await session.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.static_group_id == group_id,
        )
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise NotFound("Invitation not found")

    # Soft delete - just deactivate
    invitation.is_active = False
    invitation.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()


# --- Public Invitation Endpoints ---


@router.get("/invitations/{invite_code}", response_model=InvitationPreview)
async def get_invitation_preview(
    invite_code: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> InvitationPreview:
    """
    Get invitation preview (public endpoint).

    Returns information about the invitation and static group
    for display before accepting.
    """
    # Find invitation
    result = await session.execute(
        select(Invitation)
        .where(Invitation.invite_code == invite_code.upper())
        .options(selectinload(Invitation.static_group))
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise NotFound("Invitation not found or has expired")

    # Check if user is already a member
    already_member = False
    if current_user:
        membership = await get_user_membership(
            session, current_user.id, invitation.static_group_id
        )
        already_member = membership is not None

    return InvitationPreview(
        invite_code=invitation.invite_code,
        static_group_name=invitation.static_group.name,
        static_group_id=invitation.static_group_id,
        share_code=invitation.static_group.share_code,
        role=MemberRoleEnum(invitation.role),
        is_valid=invitation.is_valid,
        expires_at=invitation.expires_at,
        already_member=already_member,
    )


@router.post("/invitations/{invite_code}/accept", response_model=InvitationAcceptResponse)
async def accept_invitation(
    invite_code: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InvitationAcceptResponse:
    """
    Accept an invitation to join a static group.

    Requires authentication. The user will be added as a member
    with the role specified in the invitation.
    """
    # Find invitation
    result = await session.execute(
        select(Invitation)
        .where(Invitation.invite_code == invite_code.upper())
        .options(selectinload(Invitation.static_group))
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise NotFound("Invitation not found")

    # Validate invitation
    if not invitation.is_active:
        return InvitationAcceptResponse(
            success=False,
            message="This invitation has been revoked.",
        )

    if invitation.is_expired:
        return InvitationAcceptResponse(
            success=False,
            message="This invitation has expired.",
        )

    if invitation.is_exhausted:
        return InvitationAcceptResponse(
            success=False,
            message="This invitation has reached its maximum number of uses.",
        )

    # Check if already a member
    existing_membership = await get_user_membership(
        session, current_user.id, invitation.static_group_id
    )
    if existing_membership:
        return InvitationAcceptResponse(
            success=False,
            message="You are already a member of this static group.",
            static_group_id=invitation.static_group_id,
            share_code=invitation.static_group.share_code,
            role=MemberRoleEnum(existing_membership.role),
        )

    # Create membership
    now = datetime.now(timezone.utc).isoformat()
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        static_group_id=invitation.static_group_id,
        role=invitation.role,
        joined_at=now,
        updated_at=now,
    )
    session.add(membership)

    # Increment use count
    invitation.use_count += 1
    invitation.updated_at = now

    await session.flush()
    await session.commit()

    return InvitationAcceptResponse(
        success=True,
        message=f"Welcome to {invitation.static_group.name}!",
        static_group_id=invitation.static_group_id,
        share_code=invitation.static_group.share_code,
        role=MemberRoleEnum(invitation.role),
    )
