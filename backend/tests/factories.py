"""Test data factories for creating test fixtures"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User


async def create_user(
    session: AsyncSession,
    *,
    discord_id: str | None = None,
    discord_username: str = "testuser",
    discord_avatar: str | None = None,
    email: str | None = None,
) -> User:
    """Create a test user."""
    user = User(
        id=str(uuid.uuid4()),
        discord_id=discord_id or str(uuid.uuid4())[:20],
        discord_username=discord_username,
        discord_discriminator=None,
        discord_avatar=discord_avatar,
        email=email,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(user)
    await session.flush()
    return user


async def create_static_group(
    session: AsyncSession,
    owner: User,
    *,
    name: str = "Test Static",
    share_code: str | None = None,
    is_public: bool = False,
) -> StaticGroup:
    """Create a test static group with owner membership."""
    group = StaticGroup(
        id=str(uuid.uuid4()),
        name=name,
        owner_id=owner.id,
        share_code=share_code or _generate_share_code(),
        is_public=is_public,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(group)

    # Create owner membership
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=owner.id,
        static_group_id=group.id,
        role=MemberRole.OWNER.value,
        joined_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(membership)

    await session.flush()
    return group


async def create_membership(
    session: AsyncSession,
    user: User,
    static_group: StaticGroup,
    *,
    role: MemberRole = MemberRole.MEMBER,
) -> Membership:
    """Create a membership for a user in a static group."""
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=user.id,
        static_group_id=static_group.id,
        role=role.value,
        joined_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(membership)
    await session.flush()
    return membership


async def create_tier_snapshot(
    session: AsyncSession,
    static_group: StaticGroup,
    *,
    tier_id: str = "aac-heavyweight",
    content_type: str = "savage",
    is_active: bool = True,
) -> TierSnapshot:
    """Create a tier snapshot for a static group."""
    tier = TierSnapshot(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        tier_id=tier_id,
        content_type=content_type,
        is_active=is_active,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(tier)
    await session.flush()
    return tier


async def create_snapshot_player(
    session: AsyncSession,
    tier_snapshot: TierSnapshot,
    *,
    name: str = "Test Player",
    job: str = "DRG",
    role: str = "melee",
    position: str | None = "M1",
    sort_order: int = 0,
    configured: bool = True,
) -> SnapshotPlayer:
    """Create a player in a tier snapshot."""
    player = SnapshotPlayer(
        id=str(uuid.uuid4()),
        tier_snapshot_id=tier_snapshot.id,
        name=name,
        job=job,
        role=role,
        position=position,
        sort_order=sort_order,
        configured=configured,
        gear=[],  # Empty gear array as JSON
        tome_weapon={"pursuing": False, "hasItem": False, "isAugmented": False},
        is_substitute=False,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(player)
    await session.flush()
    return player


def _generate_share_code() -> str:
    """Generate a random 6-character share code."""
    import random
    import string

    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))
