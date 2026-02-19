"""Test data factories for creating test fixtures"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot, User, LootLogEntry, WeeklyAssignment


async def create_user(
    session: AsyncSession,
    *,
    discord_id: str | None = None,
    discord_username: str = "testuser",
    discord_avatar: str | None = None,
) -> User:
    """Create a test user."""
    user = User(
        id=str(uuid.uuid4()),
        discord_id=discord_id or str(uuid.uuid4())[:20],
        discord_username=discord_username,
        discord_discriminator=None,
        discord_avatar=discord_avatar,
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
    gear: list | None = None,
    tome_weapon: dict | None = None,
) -> SnapshotPlayer:
    """Create a player in a tier snapshot.

    Args:
        gear: Optional pre-populated gear array. Defaults to empty list.
        tome_weapon: Optional tome weapon status dict. Defaults to unpursued state.

    Note: gear and tome_weapon use native Python types (list/dict) rather than
    JSON strings because SQLAlchemy's JSON column type handles serialization
    automatically.
    """
    player = SnapshotPlayer(
        id=str(uuid.uuid4()),
        tier_snapshot_id=tier_snapshot.id,
        name=name,
        job=job,
        role=role,
        position=position,
        sort_order=sort_order,
        configured=configured,
        gear=gear if gear is not None else [],
        tome_weapon=tome_weapon if tome_weapon is not None else {"pursuing": False, "hasItem": False, "isAugmented": False},
        is_substitute=False,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(player)
    await session.flush()
    return player


async def create_loot_log_entry(
    session: AsyncSession,
    tier_snapshot: TierSnapshot,
    recipient_player: SnapshotPlayer,
    created_by: User,
    *,
    week_number: int = 1,
    floor: str = "M9S",
    item_slot: str = "head",
    method: str = "drop",
    notes: str | None = None,
    weapon_job: str | None = None,
    is_extra: bool = False,
) -> LootLogEntry:
    """Create a loot log entry for testing."""
    entry = LootLogEntry(
        tier_snapshot_id=tier_snapshot.id,
        week_number=week_number,
        floor=floor,
        item_slot=item_slot,
        recipient_player_id=recipient_player.id,
        method=method,
        notes=notes,
        weapon_job=weapon_job,
        is_extra=is_extra,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=created_by.id,
    )
    session.add(entry)
    await session.flush()
    return entry


async def create_weekly_assignment(
    session: AsyncSession,
    static_group: StaticGroup,
    tier_snapshot: TierSnapshot,
    *,
    week: int = 1,
    floor: str = "M9S",
    slot: str = "head",
    player: SnapshotPlayer | None = None,
    sort_order: int = 0,
    did_not_drop: bool = False,
) -> WeeklyAssignment:
    """Create a weekly assignment for testing."""
    assignment = WeeklyAssignment(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        tier_id=tier_snapshot.tier_id,
        week=week,
        floor=floor,
        slot=slot,
        player_id=player.id if player else None,
        sort_order=sort_order,
        did_not_drop=did_not_drop,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(assignment)
    await session.flush()
    return assignment


def _generate_share_code() -> str:
    """Generate a random 6-character share code."""
    import random
    import string

    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))
