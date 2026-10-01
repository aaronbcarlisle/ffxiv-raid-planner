"""Test data factories for creating test fixtures"""

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ApiKey,
    Membership,
    MemberRole,
    MaterialLogEntry,
    Notification,
    PageLedgerEntry,
    PlayerGoal,
    ScheduleException,
    ScheduleRsvp,
    ScheduleSession,
    SnapshotPlayer,
    StaticGroup,
    TierSnapshot,
    User,
    LootLogEntry,
    WeeklyAssignment,
)
from app.models.availability import UserAvailability
from app.models.bis_target_set import BiSTargetSet
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.collection_goal import CollectionGoal
from app.models.invitation import Invitation
from app.models.join_request import JoinRequest
from app.models.personal_availability import PersonalAvailabilityTemplate
from app.models.player_character import PlayerCharacter
from app.models.player_job_profile import PlayerJobProfile
from app.models.player_profile import PlayerProfile
from app.models.reward_drop_log import RewardDropLog
from app.models.reward_participant_state import RewardParticipantState
from app.models.split_clear import SplitClearAssignment
from app.models.static_character_registration import StaticCharacterRegistration
from app.models.static_content_suggestion import StaticContentSuggestion
from app.models.static_objective_goal import StaticObjectiveGoal


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
    settings: dict | None = None,
) -> StaticGroup:
    """Create a test static group with owner membership."""
    group = StaticGroup(
        id=str(uuid.uuid4()),
        name=name,
        owner_id=owner.id,
        share_code=share_code or _generate_share_code(),
        is_public=is_public,
        settings=settings,
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
        role=role.value if isinstance(role, MemberRole) else role,
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
    created_at: str | None = None,
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
        created_at=created_at if created_at is not None else datetime.now(timezone.utc).isoformat(),
        created_by_user_id=created_by.id,
    )
    session.add(entry)
    await session.flush()
    return entry


async def create_page_ledger_entry(
    session: AsyncSession,
    tier_snapshot: TierSnapshot,
    player: SnapshotPlayer,
    created_by: User,
    *,
    week_number: int = 1,
    floor: str = "M9S",
    book_type: str = "I",
    transaction_type: str = "earned",
    quantity: int = 1,
    notes: str | None = None,
) -> PageLedgerEntry:
    """Create a page ledger entry for testing."""
    entry = PageLedgerEntry(
        tier_snapshot_id=tier_snapshot.id,
        player_id=player.id,
        week_number=week_number,
        floor=floor,
        book_type=book_type,
        transaction_type=transaction_type,
        quantity=quantity,
        notes=notes,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=created_by.id,
    )
    session.add(entry)
    await session.flush()
    return entry


async def create_material_log_entry(
    session: AsyncSession,
    tier_snapshot: TierSnapshot,
    recipient_player: SnapshotPlayer,
    created_by: User,
    *,
    week_number: int = 1,
    floor: str = "M9S",
    material_type: str = "twine",
    slot_augmented: str | None = None,
    method: str = "drop",
    notes: str | None = None,
) -> MaterialLogEntry:
    """Create a material log entry for testing."""
    entry = MaterialLogEntry(
        tier_snapshot_id=tier_snapshot.id,
        week_number=week_number,
        floor=floor,
        material_type=material_type,
        recipient_player_id=recipient_player.id,
        slot_augmented=slot_augmented,
        method=method,
        notes=notes,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=created_by.id,
    )
    session.add(entry)
    await session.flush()
    return entry


async def create_schedule_session(
    session: AsyncSession,
    static_group: StaticGroup,
    created_by: User,
    *,
    title: str = "Test Session",
    description: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    timezone_name: str = "UTC",
    is_recurring: bool = False,
    recurrence_rule: str | None = None,
    track_availability: bool = True,
) -> ScheduleSession:
    """Create a schedule session for testing.

    Defaults to a one-off session starting one day from now (still in the
    future for `next_occurrence` checks) unless `start_time`/`end_time` are
    given explicitly.
    """
    now = datetime.now(timezone.utc)
    default_start = (now.replace(microsecond=0) + timedelta(days=1)).isoformat()
    default_end = (now.replace(microsecond=0) + timedelta(days=1, hours=2)).isoformat()
    sched = ScheduleSession(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        created_by_id=created_by.id,
        title=title,
        description=description,
        start_time=start_time if start_time is not None else default_start,
        end_time=end_time if end_time is not None else default_end,
        timezone=timezone_name,
        is_recurring=is_recurring,
        recurrence_rule=recurrence_rule,
        track_availability=track_availability,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(sched)
    await session.flush()
    return sched


async def create_schedule_exception(
    session: AsyncSession,
    schedule_session: ScheduleSession,
    created_by: User,
    *,
    occurrence_date: str,
    type: str = "cancelled",
    override_start_time: str | None = None,
    override_end_time: str | None = None,
    override_title: str | None = None,
    cancellation_reason: str | None = None,
) -> ScheduleException:
    """Create a schedule exception (cancelled or edited occurrence) for testing."""
    exc = ScheduleException(
        id=str(uuid.uuid4()),
        session_id=schedule_session.id,
        occurrence_date=occurrence_date,
        type=type,
        override_start_time=override_start_time,
        override_end_time=override_end_time,
        override_title=override_title,
        cancellation_reason=cancellation_reason,
        created_by_id=created_by.id,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(exc)
    await session.flush()
    return exc


async def create_schedule_rsvp(
    session: AsyncSession,
    schedule_session: ScheduleSession,
    user: User,
    *,
    status: str = "yes",
    note: str | None = None,
) -> ScheduleRsvp:
    """Create an RSVP for a schedule session for testing."""
    rsvp = ScheduleRsvp(
        id=str(uuid.uuid4()),
        session_id=schedule_session.id,
        user_id=user.id,
        status=status,
        note=note,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(rsvp)
    await session.flush()
    return rsvp


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


async def create_player_profile(
    session: AsyncSession,
    user: User,
    *,
    visibility: str = "private",
) -> PlayerProfile:
    """Create a PlayerProfile for a user."""
    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        visibility=visibility,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(profile)
    await session.flush()
    return profile


async def create_player_character(
    session: AsyncSession,
    profile: PlayerProfile,
    *,
    name: str = "Test Character",
    server: str = "Tonberry",
    data_center: str = "Elemental",
    lodestone_id: str | None = None,
    is_main: bool = True,
) -> PlayerCharacter:
    """Create a PlayerCharacter linked to a PlayerProfile."""
    char = PlayerCharacter(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        lodestone_id=lodestone_id or str(uuid.uuid4())[:18],
        name=name,
        server=server,
        data_center=data_center,
        is_main=is_main,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(char)
    await session.flush()
    return char


async def create_player_job_profile(
    session: AsyncSession,
    profile: PlayerProfile,
    *,
    job: str = "DRG",
    role: str | None = None,
    priority: str = "flex",
) -> PlayerJobProfile:
    """Create a PlayerJobProfile for a PlayerProfile (`role=None` keeps the old "melee")."""
    job_profile = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        job=job,
        role=role if role is not None else "melee",
        priority=priority,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(job_profile)
    await session.flush()
    return job_profile


async def create_hub_bis_target_set(
    session: AsyncSession,
    profile: PlayerProfile,
    job_profile: PlayerJobProfile,
    *,
    is_active: bool = True,
    updated_at: str | None = None,
) -> BiSTargetSet:
    """Create a Hub (`owner_type="player_job_profile"`) BiS target set for testing."""
    now_iso = datetime.now(timezone.utc).isoformat()
    bis_set = BiSTargetSet(
        id=str(uuid.uuid4()),
        owner_type="player_job_profile",
        owner_id=job_profile.id,
        job_profile_id=job_profile.id,
        profile_id=profile.id,
        job=job_profile.job,
        name="Test BiS",
        items_json=None,
        is_active=is_active,
        created_at=now_iso,
        updated_at=updated_at if updated_at is not None else now_iso,
    )
    session.add(bis_set)
    await session.flush()
    return bis_set


async def create_static_character_registration(
    session: AsyncSession,
    static_group: StaticGroup,
    snapshot_player: SnapshotPlayer,
    *,
    player_character: PlayerCharacter | None = None,
    manual_character_name: str | None = None,
    manual_world: str | None = None,
    role_in_static: str = "alt",
    job: str | None = None,
    is_primary_for_static: bool = False,
    source: str = "manual",
) -> StaticCharacterRegistration:
    """Create a StaticCharacterRegistration for testing."""
    reg = StaticCharacterRegistration(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        snapshot_player_id=snapshot_player.id,
        player_character_id=player_character.id if player_character else None,
        manual_character_name=manual_character_name,
        manual_world=manual_world,
        role_in_static=role_in_static,
        job=job,
        is_primary_for_static=is_primary_for_static,
        source=source if not player_character else "player_hub",
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(reg)
    await session.flush()
    return reg


async def create_claimed_card(
    session: AsyncSession,
    static_group: StaticGroup,
    user: User,
    character: PlayerCharacter,
    tier: TierSnapshot | None = None,
) -> SnapshotPlayer:
    """Give `user` a claimed card with `character` registered on it as primary.

    The card goes in `tier`, or in a new tier of `static_group` when none is given.
    """
    if tier is None:
        tier = await create_tier_snapshot(session, static_group)
    card = await create_snapshot_player(session, tier, name=character.name)
    card.user_id = user.id
    await create_static_character_registration(
        session, static_group, card, player_character=character, is_primary_for_static=True
    )
    await session.flush()
    return card


async def create_user_availability(
    session: AsyncSession,
    static_group: StaticGroup,
    user: User,
    *,
    date: str,
    slots: list[str],
) -> UserAvailability:
    """Create a dated availability row (UTC "HH:MM" slots) for a user in a static."""
    row = UserAvailability(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        user_id=user.id,
        date=date,
        slots=json.dumps(slots),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(row)
    await session.flush()
    return row


async def create_personal_availability_template(
    session: AsyncSession,
    user: User,
    *,
    day_of_week: str,
    slots: list[str],
    timezone: str = "UTC",
) -> PersonalAvailabilityTemplate:
    """Create a personal weekly template day (local "HH:MM" slots in `timezone`)."""
    # `timezone` (the IANA name) shadows datetime.timezone here, hence UTC.
    template = PersonalAvailabilityTemplate(
        id=str(uuid.uuid4()),
        user_id=user.id,
        day_of_week=day_of_week,
        slots=json.dumps(slots),
        timezone=timezone,
        updated_at=datetime.now(UTC).isoformat(),
    )
    session.add(template)
    await session.flush()
    return template


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create_collection_goal(
    session: AsyncSession,
    static_group: StaticGroup,
    created_by: User,
    *,
    goal_type: str = "mount",
    title: str = "Test Farm",
    status: str = "farming",
) -> CollectionGoal:
    """Create a static collection (farm) goal."""
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        created_by_id=created_by.id,
        goal_type=goal_type,
        title=title,
        status=status,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(goal)
    await session.flush()
    return goal


async def create_participant_state(
    session: AsyncSession,
    goal: CollectionGoal,
    user: User,
    *,
    state: str = "need",
) -> RewardParticipantState:
    """Create a participant row on a collection goal."""
    row = RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id=goal.id,
        user_id=user.id,
        static_group_id=goal.static_group_id,
        state=state,
        source="manual",
        updated_at=_now_iso(),
    )
    session.add(row)
    await session.flush()
    return row


async def create_reward_drop(
    session: AsyncSession,
    goal: CollectionGoal,
    created_by: User,
    *,
    recipient: User | None = None,
) -> RewardDropLog:
    """Create a logged drop on a collection goal."""
    drop = RewardDropLog(
        id=str(uuid.uuid4()),
        goal_id=goal.id,
        static_group_id=goal.static_group_id,
        recipient_user_id=recipient.id if recipient else None,
        created_by_id=created_by.id,
        quantity=1,
        dropped_at=_now_iso(),
        created_at=_now_iso(),
    )
    session.add(drop)
    await session.flush()
    return drop


async def create_content_suggestion(
    session: AsyncSession,
    static_group: StaticGroup,
    suggested_by: User,
    *,
    category: str = "custom",
    title: str = "Test Suggestion",
    status: str = "open",
) -> StaticContentSuggestion:
    """Create an open content suggestion."""
    suggestion = StaticContentSuggestion(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        suggested_by_user_id=suggested_by.id,
        category=category,
        title=title,
        status=status,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(suggestion)
    await session.flush()
    return suggestion


async def create_objective_goal(
    session: AsyncSession,
    static_group: StaticGroup,
    created_by: User,
    *,
    category: str = "custom",
    title: str = "Test Objective",
    priority: str = "preferred",
) -> StaticObjectiveGoal:
    """Create a static objective goal."""
    goal = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        created_by_id=created_by.id,
        category=category,
        title=title,
        priority=priority,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(goal)
    await session.flush()
    return goal


async def create_invitation(
    session: AsyncSession,
    static_group: StaticGroup,
    created_by: User,
    *,
    role: str = "member",
) -> Invitation:
    """Create an active invitation."""
    invitation = Invitation(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        created_by_id=created_by.id,
        invite_code=uuid.uuid4().hex[:8].upper(),
        role=role,
        use_count=0,
        is_active=True,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(invitation)
    await session.flush()
    return invitation


async def create_join_request(
    session: AsyncSession,
    static_group: StaticGroup,
    requester: User,
    *,
    status: str = "pending",
) -> JoinRequest:
    """Create a join request (application) to a static."""
    request = JoinRequest(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        requester_user_id=requester.id,
        status=status,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(request)
    await session.flush()
    return request


async def create_split_clear_assignment(
    session: AsyncSession,
    static_group: StaticGroup,
    snapshot_player: SnapshotPlayer,
) -> SplitClearAssignment:
    """Create a split-clear assignment for a roster player."""
    assignment = SplitClearAssignment(
        id=str(uuid.uuid4()),
        static_group_id=static_group.id,
        snapshot_player_id=snapshot_player.id,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(assignment)
    await session.flush()
    return assignment


async def create_catalog_item(
    session: AsyncSession,
    *,
    name: str = "Test Mount",
    category: str = "mount",
) -> CollectionCatalogItem:
    """Create a collection catalog item."""
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        updated_at=_now_iso(),
    )
    session.add(item)
    await session.flush()
    return item


async def create_roster_bis_target_set(
    session: AsyncSession,
    static_group: StaticGroup,
    snapshot_player: SnapshotPlayer,
    created_by: User,
) -> BiSTargetSet:
    """Create a roster (`owner_type="roster_member_job"`) BiS target set."""
    bis_set = BiSTargetSet(
        id=str(uuid.uuid4()),
        owner_type="roster_member_job",
        owner_id=snapshot_player.id,
        snapshot_player_id=snapshot_player.id,
        group_id=static_group.id,
        job=snapshot_player.job,
        name="Roster BiS",
        created_by=created_by.id,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(bis_set)
    await session.flush()
    return bis_set


async def create_player_goal(
    session: AsyncSession,
    profile: PlayerProfile,
    *,
    title: str = "Probe goal",
    goal_type: str = "custom",
) -> PlayerGoal:
    """Create a personal (player hub) goal on a profile."""
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        title=title,
        goal_type=goal_type,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    session.add(goal)
    await session.flush()
    return goal


async def create_notification(
    session: AsyncSession,
    user: User,
    *,
    title: str = "Probe",
) -> Notification:
    """Create an unread notification for a user."""
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user.id,
        notification_type="application_accepted",
        title=title,
        is_read=False,
        created_at=_now_iso(),
    )
    session.add(notification)
    await session.flush()
    return notification


async def create_api_key(
    session: AsyncSession,
    user: User,
    *,
    name: str = "Probe key",
) -> ApiKey:
    """Create an active API key row. The hash is a dummy (sha256 of a uuid): revocation looks a
    key up by `id` and `user_id` only, and nothing authenticates with this row."""
    api_key = ApiKey(
        id=str(uuid.uuid4()),
        user_id=user.id,
        key_hash=hashlib.sha256(uuid.uuid4().bytes).hexdigest(),
        key_prefix="xrp_test",
        name=name,
        scopes=[],
        is_active=True,
        created_at=_now_iso(),
    )
    session.add(api_key)
    await session.flush()
    return api_key


def _generate_share_code() -> str:
    """Generate a random 6-character share code."""
    import random
    import string

    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))
