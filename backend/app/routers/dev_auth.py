"""Development-only authentication endpoints.

These endpoints bypass Discord OAuth for local testing.
ONLY enabled when ENVIRONMENT=development AND DEV_AUTH_MODE=true.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import create_access_token, create_refresh_token
from ..config import get_settings
from ..database import get_session
from ..models import (
    ApiKey,
    Invitation,
    LootLogEntry,
    MaterialLogEntry,
    Membership,
    MemberRole,
    PageLedgerEntry,
    ScheduleRsvp,
    ScheduleSession,
    SnapshotPlayer,
    StaticGroup,
    User,
    UserAvailability,
)
from ..schemas import UserResponse

router = APIRouter(prefix="/api/dev-auth", tags=["dev-auth"])
settings = get_settings()

DEV_USERS = [
    {
        "discord_id": "dev_owner_001",
        "discord_username": "DevOwner",
        "display_name": "Dev Owner",
    },
    {
        "discord_id": "dev_member_002",
        "discord_username": "DevMember",
        "display_name": "Dev Member",
    },
    {
        "discord_id": "dev_applicant_003",
        "discord_username": "DevApplicant",
        "display_name": "Dev Applicant",
    },
]

DEV_STATIC_NAME = "Dev Test Static"
DEV_SHARE_CODE = "DEVTST"
ROLE_PRIORITY = {
    MemberRole.VIEWER.value: 1,
    MemberRole.MEMBER.value: 2,
    MemberRole.LEAD.value: 3,
    MemberRole.OWNER.value: 4,
}


def _require_dev_mode():
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    if not getattr(settings, "dev_auth_mode", False):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )


def _merge_role(primary_role: str, duplicate_role: str) -> str:
    """Keep the highest-permission role when duplicate memberships exist."""
    if ROLE_PRIORITY.get(duplicate_role, 0) > ROLE_PRIORITY.get(primary_role, 0):
        return duplicate_role
    return primary_role


def _latest_timestamp(*timestamps: str | None) -> str | None:
    """Return the latest non-empty ISO timestamp string."""
    present = [timestamp for timestamp in timestamps if timestamp]
    return max(present) if present else None


async def _merge_duplicate_dev_users(
    session: AsyncSession,
    canonical_user: User,
    user_data: dict,
) -> User:
    """Merge old duplicate dev-auth users back into the canonical dev user.

    This repairs local databases after changes to dev-auth identifiers created
    multiple rows with the same DevOwner/DevMember username.
    """
    result = await session.execute(
        select(User).where(
            User.discord_username == user_data["discord_username"],
            User.id != canonical_user.id,
        )
    )
    duplicates = result.scalars().all()

    now = datetime.now(timezone.utc).isoformat()
    canonical_user.discord_id = user_data["discord_id"]
    canonical_user.discord_username = user_data["discord_username"]
    canonical_user.display_name = user_data["display_name"]
    canonical_user.updated_at = now

    if not duplicates:
        return canonical_user

    for duplicate in duplicates:
        group_result = await session.execute(
            select(StaticGroup).where(StaticGroup.owner_id == duplicate.id)
        )
        for group in group_result.scalars().all():
            group.owner_id = canonical_user.id
            group.updated_at = now

        session_result = await session.execute(
            select(ScheduleSession).where(ScheduleSession.created_by_id == duplicate.id)
        )
        for schedule_session in session_result.scalars().all():
            schedule_session.created_by_id = canonical_user.id

        invitation_result = await session.execute(
            select(Invitation).where(Invitation.created_by_id == duplicate.id)
        )
        for invitation in invitation_result.scalars().all():
            invitation.created_by_id = canonical_user.id

        api_key_result = await session.execute(
            select(ApiKey).where(ApiKey.user_id == duplicate.id)
        )
        for api_key in api_key_result.scalars().all():
            api_key.user_id = canonical_user.id

        loot_result = await session.execute(
            select(LootLogEntry).where(LootLogEntry.created_by_user_id == duplicate.id)
        )
        for loot_entry in loot_result.scalars().all():
            loot_entry.created_by_user_id = canonical_user.id

        material_result = await session.execute(
            select(MaterialLogEntry).where(MaterialLogEntry.created_by_user_id == duplicate.id)
        )
        for material_entry in material_result.scalars().all():
            material_entry.created_by_user_id = canonical_user.id

        page_result = await session.execute(
            select(PageLedgerEntry).where(PageLedgerEntry.created_by_user_id == duplicate.id)
        )
        for page_entry in page_result.scalars().all():
            page_entry.created_by_user_id = canonical_user.id

        player_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.user_id == duplicate.id)
        )
        for player in player_result.scalars().all():
            player.user_id = canonical_user.id
            player.updated_at = now

        canonical_membership_result = await session.execute(
            select(Membership).where(Membership.user_id == canonical_user.id)
        )
        canonical_memberships = {
            membership.static_group_id: membership
            for membership in canonical_membership_result.scalars().all()
        }

        duplicate_membership_result = await session.execute(
            select(Membership).where(Membership.user_id == duplicate.id)
        )
        for membership in duplicate_membership_result.scalars().all():
            canonical_membership = canonical_memberships.get(membership.static_group_id)
            if canonical_membership:
                canonical_membership.role = _merge_role(
                    canonical_membership.role,
                    membership.role,
                )
                canonical_membership.joined_at = min(
                    canonical_membership.joined_at,
                    membership.joined_at,
                )
                canonical_membership.updated_at = now
                await session.delete(membership)
            else:
                membership.user_id = canonical_user.id
                membership.updated_at = now
                canonical_memberships[membership.static_group_id] = membership

        canonical_rsvp_result = await session.execute(
            select(ScheduleRsvp).where(ScheduleRsvp.user_id == canonical_user.id)
        )
        canonical_rsvps = {
            rsvp.session_id: rsvp
            for rsvp in canonical_rsvp_result.scalars().all()
        }

        duplicate_rsvp_result = await session.execute(
            select(ScheduleRsvp).where(ScheduleRsvp.user_id == duplicate.id)
        )
        for rsvp in duplicate_rsvp_result.scalars().all():
            canonical_rsvp = canonical_rsvps.get(rsvp.session_id)
            if canonical_rsvp:
                if (_latest_timestamp(rsvp.updated_at, canonical_rsvp.updated_at) == rsvp.updated_at):
                    canonical_rsvp.status = rsvp.status
                    canonical_rsvp.note = rsvp.note
                    canonical_rsvp.updated_at = rsvp.updated_at
                await session.delete(rsvp)
            else:
                rsvp.user_id = canonical_user.id
                canonical_rsvps[rsvp.session_id] = rsvp

        canonical_availability_result = await session.execute(
            select(UserAvailability).where(UserAvailability.user_id == canonical_user.id)
        )
        canonical_availability = {
            (availability.static_group_id, availability.date): availability
            for availability in canonical_availability_result.scalars().all()
        }

        duplicate_availability_result = await session.execute(
            select(UserAvailability).where(UserAvailability.user_id == duplicate.id)
        )
        for availability in duplicate_availability_result.scalars().all():
            key = (availability.static_group_id, availability.date)
            canonical_row = canonical_availability.get(key)
            if canonical_row:
                merged_slots = sorted(
                    set(json.loads(canonical_row.slots)) | set(json.loads(availability.slots))
                )
                canonical_row.slots = json.dumps(merged_slots)
                canonical_row.updated_at = (
                    _latest_timestamp(canonical_row.updated_at, availability.updated_at) or now
                )
                await session.delete(availability)
            else:
                availability.user_id = canonical_user.id
                availability.updated_at = now
                canonical_availability[key] = availability

        await session.delete(duplicate)

    await session.flush()
    return canonical_user


async def _get_or_create_user(session: AsyncSession, user_data: dict) -> User:
    result = await session.execute(
        select(User).where(User.discord_id == user_data["discord_id"])
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc).isoformat()

    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            discord_id=user_data["discord_id"],
            discord_username=user_data["discord_username"],
            discord_discriminator=None,
            discord_avatar=None,
            display_name=user_data["display_name"],
            is_admin=False,
            created_at=now,
            updated_at=now,
            last_login_at=now,
        )
        session.add(user)
        await session.flush()
    else:
        user.discord_username = user_data["discord_username"]
        user.display_name = user_data["display_name"]
        user.last_login_at = now
        user.updated_at = now

    return await _merge_duplicate_dev_users(session, user, user_data)


async def _ensure_dev_static(session: AsyncSession, owner: User) -> StaticGroup:
    result = await session.execute(
        select(StaticGroup).where(StaticGroup.share_code == DEV_SHARE_CODE)
    )
    group = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()

    if group is None:
        group = StaticGroup(
            id=str(uuid.uuid4()),
            name=DEV_STATIC_NAME,
            owner_id=owner.id,
            share_code=DEV_SHARE_CODE,
            is_public=False,
            created_at=now,
            updated_at=now,
        )
        session.add(group)
    elif group.owner_id != owner.id:
        group.owner_id = owner.id
        group.updated_at = now

    owner_membership_result = await session.execute(
        select(Membership).where(
            Membership.user_id == owner.id,
            Membership.static_group_id == group.id,
        )
    )
    owner_membership = owner_membership_result.scalar_one_or_none()

    if owner_membership is None:
        session.add(
            Membership(
                id=str(uuid.uuid4()),
                user_id=owner.id,
                static_group_id=group.id,
                role=MemberRole.OWNER.value,
                joined_at=now,
                updated_at=now,
            )
        )
    else:
        owner_membership.role = MemberRole.OWNER.value
        owner_membership.updated_at = now

    await session.flush()

    return group


async def _ensure_membership(
    session: AsyncSession, user: User, group: StaticGroup, role: MemberRole
) -> None:
    result = await session.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.static_group_id == group.id,
        )
    )
    if result.scalar_one_or_none() is None:
        now = datetime.now(timezone.utc).isoformat()
        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=user.id,
            static_group_id=group.id,
            role=role.value,
            joined_at=now,
            updated_at=now,
        )
        session.add(membership)
        await session.flush()


def _set_auth_cookies(response: Response, user_id: str) -> dict:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        path="/",
    )

    return {"access_token": access_token, "refresh_token": refresh_token}


@router.api_route("/login/{user_index}", methods=["GET", "POST"])
async def dev_login(
    user_index: int,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Log in as a dev test user (0=Owner, 1=Member).

    Creates the user, a test static, and membership if they don't exist.
    Sets httpOnly auth cookies identical to real Discord OAuth flow.
    """
    _require_dev_mode()

    if user_index < 0 or user_index >= len(DEV_USERS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"user_index must be 0-{len(DEV_USERS) - 1}",
        )

    owner = await _get_or_create_user(session, DEV_USERS[0])
    group = await _ensure_dev_static(session, owner)

    if user_index == 0:
        user = owner
    elif user_index == 2:
        # Applicant: create user but NO membership (for testing join requests)
        user = await _get_or_create_user(session, DEV_USERS[user_index])
    else:
        user = await _get_or_create_user(session, DEV_USERS[user_index])
        await _ensure_membership(session, user, group, MemberRole.MEMBER)

    # Make the dev static public + discoverable so join requests can be tested
    if not group.is_public or not group.settings or not group.settings.get("discovery", {}).get("enabled"):
        group.is_public = True
        group.settings = {
            **(group.settings or {}),
            "discovery": {
                **(group.settings or {}).get("discovery", {}),
                "enabled": True,
                "recruitmentStatus": "open",
                "description": "Dev test static — discoverable for join request testing",
            },
        }

    await session.commit()

    role_label = {0: "owner", 1: "member", 2: "applicant (no membership)"}.get(user_index, "member")
    tokens = _set_auth_cookies(response, user.id)

    return {
        "message": f"Logged in as {DEV_USERS[user_index]['discord_username']}",
        "user_id": user.id,
        "username": DEV_USERS[user_index]["discord_username"],
        "role": role_label,
        "static_group_id": group.id,
        "share_code": DEV_SHARE_CODE,
        "frontend_url": f"{settings.frontend_url}/group/{DEV_SHARE_CODE}",
        "discover_url": f"{settings.frontend_url}/discover",
        "access_token": tokens["access_token"],
    }


@router.get("/status")
async def dev_auth_status() -> dict:
    """Check if dev auth mode is active."""
    _require_dev_mode()
    return {
        "dev_auth_mode": True,
        "users": [
            {"index": i, "username": u["discord_username"], "role": {0: "owner", 1: "member", 2: "applicant"}.get(i, "member")}
            for i, u in enumerate(DEV_USERS)
        ],
        "static_share_code": DEV_SHARE_CODE,
    }
