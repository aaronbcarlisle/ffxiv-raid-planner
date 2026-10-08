"""Correctness tests for the plugin collection sync service.

Covers:
  - Manual Pass is never overwritten by plugin sync
  - Token count update does not change existing state
  - Category filter prevents wrong reward being marked as Have
  - Cross-static: user can't update goals in groups they don't belong to
  - last_manual_override_at is set when participant state is manually edited
  - game_mount_id matching: mount identified by stable ID only (source_duty_key NOT used for ownership)
  - source_duty_key alone does NOT set Have (critical safety test)
  - token_item_id matching: token identified by stable item ID, not just name
  - game_mount_id collision: wrong mount ID does not match
  - token count update creates "want" state, not "have"
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.collection_goal import CollectionGoal
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.reward_participant_state import RewardParticipantState
from app.services.collection_records import merged_participants
from app.services.plugin_collection_sync_service import sync_collection_states
from app.services.provenance import LOGGED_VIA_API_KEY
from app.schemas.plugin_collections import (
    CollectionMountItem,
    CollectionTokenItem,
    PluginCollectionSyncPayload,
)
from tests.factories import (
    create_claimed_card,
    create_membership,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()
# A clock no sync can produce: what a row or record carried before the sync.
_OLD = "2000-01-01T00:00:00+00:00"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _catalog_item(
    session: AsyncSession,
    *,
    name: str,
    category: str,
    expansion: str | None = None,
    source_duty_key: str | None = None,
    token_name: str | None = None,
    game_mount_id: int | None = None,
    token_item_id: int | None = None,
) -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        expansion=expansion,
        external_source="internal",
        source_duty_key=source_duty_key,
        token_name=token_name,
        game_mount_id=game_mount_id,
        token_item_id=token_item_id,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _goal(session: AsyncSession, *, group_id: str, catalog_item_id: str | None = None, token_name: str | None = None, goal_type: str = "mount", status: str = "farming") -> CollectionGoal:
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        goal_type=goal_type,
        title="Test Goal",
        status=status,
        catalog_item_id=catalog_item_id,
        token_name=token_name,
        created_at=_NOW,
        updated_at=_NOW,
    )
    session.add(goal)
    return goal


def _state(session: AsyncSession, *, goal_id: str, user_id: str, group_id: str, state: str, source: str) -> RewardParticipantState:
    row = RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id=goal_id,
        user_id=user_id,
        static_group_id=group_id,
        state=state,
        source=source,
        updated_at=_NOW,
    )
    session.add(row)
    return row


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="pcs_member", discord_username="pcs_member")


@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_id="pcs_outsider", discord_username="pcs_outsider")


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="pcs_owner", discord_username="pcs_owner")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, member: User):
    g = await create_static_group(session, owner)
    await create_membership(session, member, g, role=MemberRole.MEMBER)
    await session.flush()
    return g


@pytest_asyncio.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


@pytest_asyncio.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


# ── 1. Manual Pass is never overwritten ──────────────────────────────────────


async def test_plugin_does_not_overwrite_manual_pass(session: AsyncSession, member: User, group):
    # Catalog must have game_mount_id so the plugin can find it (source_duty_key is not used for ownership)
    catalog = _catalog_item(
        session,
        name="Wings of Ruin",
        category="mount",
        source_duty_key="dt-valigarmanda",
        game_mount_id=777,
    )
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()
    existing = _state(session, goal_id=goal.id, user_id=member.id, group_id=group.id, state="pass", source="manual")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=777, owned=True)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    assert result.skipped_locked == 1
    assert result.states_updated == 0

    await session.refresh(existing)
    assert existing.state == "pass"
    assert existing.source == "manual"


# ── 2. Token count update does not change Pass state ─────────────────────────


async def test_token_count_does_not_change_pass_state(session: AsyncSession, member: User, group):
    goal = _goal(session, group_id=group.id, goal_type="token", token_name="Skyruin Totem", status="farming")
    await session.flush()
    existing = _state(session, goal_id=goal.id, user_id=member.id, group_id=group.id, state="pass", source="manual")
    existing.token_count = 3
    await session.flush()

    payload = PluginCollectionSyncPayload(
        currencies=[CollectionTokenItem(token_name="Skyruin Totem", count=12)],
    )
    await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    await session.refresh(existing)
    assert existing.state == "pass"
    assert existing.source == "manual"
    assert existing.token_count == 12


# ── 3. Category filter: mount owned → only mount category is marked ───────────


async def test_mount_owned_does_not_mark_orchestrion(session: AsyncSession, member: User, group):
    # Mount catalog item has game_mount_id; orchestrion does NOT — plugin only processes mounts
    mount_cat = _catalog_item(
        session,
        name="Wings of Ruin",
        category="mount",
        source_duty_key="dt-valigarmanda",
        game_mount_id=888,
    )
    music_cat = _catalog_item(
        session,
        name="Valigarmanda's Theme",
        category="orchestrion",
        source_duty_key="dt-valigarmanda",
        # No game_mount_id — orchestrion is not detectable via plugin
    )
    await session.flush()
    mount_goal = _goal(session, group_id=group.id, catalog_item_id=mount_cat.id, goal_type="mount")
    music_goal = _goal(session, group_id=group.id, catalog_item_id=music_cat.id, goal_type="orchestrion")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=888, owned=True)],
    )
    await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    mount_state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == mount_goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    mount_state = mount_state_r.scalar_one_or_none()
    assert mount_state is not None and mount_state.state == "have"

    music_state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == music_goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    assert music_state_r.scalar_one_or_none() is None


# ── 4. Cross-static: can't update goals in another group ─────────────────────


async def test_plugin_cannot_update_other_groups_goals(session: AsyncSession, outsider: User, group):
    catalog = _catalog_item(session, name="Wings of Ruin", category="mount", source_duty_key="dt-valigarmanda", game_mount_id=333)
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    # outsider is not a member of group — function returns early, no goals matched
    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=333, owned=True)],
    )
    result = await sync_collection_states(
        session, outsider, payload, actor_user_id=outsider.id, via=LOGGED_VIA_API_KEY
    )

    assert result.states_updated == 0

    state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == outsider.id,
        )
    )
    assert state_r.scalar_one_or_none() is None


# ── 5. Complete goals are not updated ────────────────────────────────────────


async def test_plugin_skips_complete_goals(session: AsyncSession, member: User, group):
    catalog = _catalog_item(session, name="Wings of Ruin", category="mount", source_duty_key="dt-valigarmanda", game_mount_id=555)
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id, status="complete")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=555, owned=True)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    assert result.states_updated == 0
    state_r = await session.execute(
        select(RewardParticipantState).where(RewardParticipantState.goal_id == goal.id)
    )
    assert state_r.scalar_one_or_none() is None


# ── 6. last_manual_override_at is set on manual participant edit ──────────────


async def test_manual_edit_sets_last_manual_override_at(
    async_client: AsyncClient, session: AsyncSession, member: User, owner: User, group, member_headers, owner_headers
):
    create_resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Valigarmanda Mount", "status": "farming"},
        headers=owner_headers,
    )
    assert create_resp.status_code == 201
    goal_id = create_resp.json()["id"]

    patch_resp = await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal_id}/participants",
        json={"state": "pass"},
        headers=member_headers,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["last_manual_override_at"] is not None
    assert data["source"] == "manual"


# ── 7. game_mount_id matching: stable ID beats source_duty_key ───────────────


async def test_mount_matched_by_game_mount_id(session: AsyncSession, member: User, group):
    # Catalog item with game_mount_id=282 (EW Zodiark Lynx) and no source_duty_key match
    catalog = _catalog_item(
        session,
        name="Lynx of Fallen Shadow",
        category="mount",
        source_duty_key="ew-zodiark",
        game_mount_id=282,
    )
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    # Plugin sends mount_id=282 (no trial_id needed — ID is sufficient)
    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=282, owned=True)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    assert result.states_updated == 1
    state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    state = state_r.scalar_one_or_none()
    assert state is not None and state.state == "have"


async def test_wrong_game_mount_id_does_not_match(session: AsyncSession, member: User, group):
    # Catalog has game_mount_id=282; plugin reports mount_id=999 — should not match
    catalog = _catalog_item(
        session,
        name="Lynx of Fallen Shadow",
        category="mount",
        source_duty_key="ew-zodiark",
        game_mount_id=282,
    )
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=999, owned=True)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    assert result.states_updated == 0


# ── 8. token_item_id matching: stable item ID beats token_name ───────────────


async def test_token_matched_by_item_id(session: AsyncSession, member: User, group):
    # Catalog item with token_item_id=36810 (EW Zodiark totem)
    catalog = _catalog_item(
        session,
        name="Lynx of Fallen Shadow",
        category="mount",
        token_name="Zodiark Totem",
        token_item_id=36810,
        game_mount_id=282,
    )
    await session.flush()
    # Goal with catalog_item_id (token count tracked against the mount goal)
    goal = _goal(
        session,
        group_id=group.id,
        catalog_item_id=catalog.id,
        token_name="Zodiark Totem",
        goal_type="mount",
    )
    await session.flush()

    # Plugin sends item_id=36810 with a count; token_name absent (ID-only path)
    payload = PluginCollectionSyncPayload(
        currencies=[CollectionTokenItem(item_id=36810, count=45)],
    )
    await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    state = state_r.scalar_one_or_none()
    assert state is not None and state.token_count == 45


# ── 9. source_duty_key alone MUST NOT set Have (critical safety test) ────────


async def test_ownership_not_set_without_stable_id(session: AsyncSession, member: User, group):
    """A catalog entry with source_duty_key but no game_mount_id cannot be matched
    for ownership — only stable game IDs from Mount.exd are trusted for Have state."""
    catalog = _catalog_item(
        session,
        name="Wings of Ruin",
        category="mount",
        source_duty_key="dt-valigarmanda",
        # game_mount_id intentionally omitted — DT ID not yet verified
    )
    await session.flush()
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    # Plugin sends trial_id only — no stable mount_id
    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(trial_id="dt-valigarmanda", owned=True)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    assert result.states_updated == 0
    assert result.skipped_no_id == 1

    state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    assert state_r.scalar_one_or_none() is None


# ── 10. Token count update creates "want" state, not "have" ──────────────────


async def test_token_count_update_does_not_set_have(session: AsyncSession, member: User, group):
    """Token inventory sync must never set ownership (Have) state."""
    catalog = _catalog_item(
        session,
        name="Lynx of Fallen Shadow",
        category="mount",
        token_name="Zodiark Totem",
        token_item_id=36810,
        game_mount_id=282,
    )
    await session.flush()
    goal = _goal(
        session,
        group_id=group.id,
        catalog_item_id=catalog.id,
        token_name="Zodiark Totem",
        goal_type="mount",
    )
    await session.flush()

    payload = PluginCollectionSyncPayload(
        currencies=[CollectionTokenItem(item_id=36810, count=99)],
    )
    await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    state_r = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == member.id,
        )
    )
    state = state_r.scalar_one_or_none()
    assert state is not None
    assert state.token_count == 99
    assert state.state != "have"  # token sync must not set Have


# ── 11. The counters count farm rows only (R-S1-17, vet M-6) ─────────────────


async def test_record_writes_are_not_counted(session: AsyncSession, member: User, group):
    """One mount and one count reach a farm row AND the main's record: each counter reads 1."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Counter Main", is_main=True)
    catalog = _catalog_item(
        session,
        name="Counted Mount",
        category="mount",
        token_name="Counter Totem",
        game_mount_id=4501,
        token_item_id=4502,
    )
    await session.flush()
    _goal(session, group_id=group.id, catalog_item_id=catalog.id, token_name="Counter Totem")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=4501, owned=True)],
        currencies=[CollectionTokenItem(item_id=4502, count=30)],
    )
    result = await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )

    counters = (
        result.states_updated,
        result.states_unchanged,
        result.token_counts_updated,
        result.skipped_locked,
    )
    assert counters == (1, 0, 1, 0)
    record = (await session.execute(select(PlayerCollectionSnapshot))).scalar_one()
    assert (record.character_id, record.ownership_state, record.token_count) == (
        main.id,
        "have",
        30,
    )


# ── 12. R-S1-17: one rule for rows and records (E2) ──────────────────────────


async def _row_of(
    session: AsyncSession, goal: CollectionGoal, user: User
) -> RewardParticipantState | None:
    """The member's row for the goal, read back from the database."""
    result = await session.execute(
        select(RewardParticipantState)
        .where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user.id,
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _records(session: AsyncSession) -> list[PlayerCollectionSnapshot]:
    """Every record, read back from the database."""
    result = await session.execute(
        select(PlayerCollectionSnapshot).execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


def _old_row(
    session: AsyncSession,
    *,
    goal: CollectionGoal,
    user: User,
    state: str,
    source: str = "manual",
    writer: User | None = None,
    token_count: int | None = None,
) -> RewardParticipantState:
    """A row written at `_OLD` by `writer` (None: a pre-S2a-1 row), with its clocks set."""
    row = _state(
        session,
        goal_id=goal.id,
        user_id=user.id,
        group_id=goal.static_group_id,
        state=state,
        source=source,
    )
    row.token_count = token_count
    row.updated_at = _OLD
    row.state_changed_at = _OLD
    row.token_count_updated_at = _OLD if token_count is not None else None
    row.updated_by_user_id = None if writer is None else writer.id
    row.updated_via = None if writer is None else "web"
    return row


def _old_record(
    session: AsyncSession,
    *,
    profile,
    character,
    catalog,
    ownership: str,
    token_count: int | None = None,
) -> PlayerCollectionSnapshot:
    """A record written at `_OLD` by a person (manual, medium)."""
    record = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=character.id,
        catalog_item_id=catalog.id,
        ownership_state=ownership,
        token_count=token_count,
        source="manual",
        confidence="medium",
        updated_at=_OLD,
        state_changed_at=_OLD,
        token_count_updated_at=_OLD if token_count is not None else None,
    )
    session.add(record)
    return record


async def _mount_catalog(
    session: AsyncSession, *, game_mount_id: int, token_item_id: int | None = None
) -> CollectionCatalogItem:
    catalog = _catalog_item(
        session,
        name=f"Rule Mount {game_mount_id}",
        category="mount",
        game_mount_id=game_mount_id,
        token_item_id=token_item_id,
    )
    await session.flush()
    return catalog


async def _sync(session: AsyncSession, member: User, payload: PluginCollectionSyncPayload):
    return await sync_collection_states(
        session, member, payload, actor_user_id=member.id, via=LOGGED_VIA_API_KEY
    )


async def test_sync_never_changes_a_pass_row_a_seeded_player_hub_pass_included(
    session: AsyncSession, member: User, group
):
    """Every Pass came from a person: the row is locked whatever its source; the record rises."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Pass Main", is_main=True)
    catalog = await _mount_catalog(session, game_mount_id=4601)
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()
    _old_row(session, goal=goal, user=member, state="pass", source="player_hub")
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(mounts=[CollectionMountItem(mount_id=4601, owned=True)]),
    )

    assert (result.skipped_locked, result.states_updated, result.states_unchanged) == (1, 0, 0)
    row = await _row_of(session, goal, member)
    assert (row.state, row.source, row.updated_at, row.updated_by_user_id, row.updated_via) == (
        "pass",
        "player_hub",
        _OLD,
        None,
        None,
    )
    (record,) = await _records(session)
    assert (record.character_id, record.ownership_state) == (main.id, "have")


async def test_sync_re_raises_a_members_un_have(session: AsyncSession, member: User, group):
    """The game is the truth for ownership: a person's un-Have, row and record, rises again."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Unhave Main", is_main=True)
    catalog = await _mount_catalog(session, game_mount_id=4602)
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()
    _old_row(session, goal=goal, user=member, state="need", writer=member)
    _old_record(session, profile=profile, character=main, catalog=catalog, ownership="missing")
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(
            character_name="Unhave Main", mounts=[CollectionMountItem(mount_id=4602, owned=True)]
        ),
    )

    assert result.states_updated == 1
    row = await _row_of(session, goal, member)
    assert (row.state, row.source, row.state_changed_at) == ("have", "plugin", result.synced_at)
    assert (row.updated_by_user_id, row.updated_via) == (member.id, "api_key")
    (record,) = await _records(session)
    assert (record.ownership_state, record.source, record.confidence) == ("have", "plugin", "high")
    assert record.state_changed_at == result.synced_at
    assert (record.updated_by_user_id, record.updated_via) == (member.id, "api_key")


async def test_sync_count_is_the_newest_write_over_a_leads_older_count(
    session: AsyncSession, member: User, owner: User, group
):
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Count Main", is_main=True)
    catalog = await _mount_catalog(session, game_mount_id=4603, token_item_id=4604)
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()
    _old_row(session, goal=goal, user=member, state="need", writer=owner, token_count=5)
    _old_record(
        session,
        profile=profile,
        character=main,
        catalog=catalog,
        ownership="unknown",
        token_count=5,
    )
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(
            character_name="Count Main", currencies=[CollectionTokenItem(item_id=4604, count=12)]
        ),
    )

    assert (result.token_counts_updated, result.states_updated) == (1, 0)
    row = await _row_of(session, goal, member)
    assert (row.state, row.token_count, row.token_count_updated_at) == (
        "need",
        12,
        result.synced_at,
    )
    (record,) = await _records(session)
    assert (record.token_count, record.token_count_updated_at, record.ownership_state) == (
        12,
        result.synced_at,
        "unknown",
    )


async def test_matched_sync_leaves_a_leads_correction_in_another_static_alone(
    session: AsyncSession, member: User, owner: User, group
):
    """Criterion 6: rows go only where the chain is the matched character, so the static whose
    card is the alt keeps the lead's correction and still reads it through its own chain."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Sync Main", is_main=True)
    alt = await create_player_character(session, profile, name="Sync Alt", is_main=False)
    await create_claimed_card(session, group, member, main)
    alt_static = await create_static_group(session, owner, name="Alt Static")
    await create_membership(session, member, alt_static, role=MemberRole.MEMBER)
    await create_claimed_card(session, alt_static, member, alt)
    catalog = await _mount_catalog(session, game_mount_id=4605)
    main_goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    alt_goal = _goal(session, group_id=alt_static.id, catalog_item_id=catalog.id)
    await session.flush()
    _old_row(session, goal=main_goal, user=member, state="need", writer=owner)
    _old_row(session, goal=alt_goal, user=member, state="need", writer=owner)
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(
            character_name="Sync Main", mounts=[CollectionMountItem(mount_id=4605, owned=True)]
        ),
    )

    assert (result.states_updated, result.states_unchanged, result.skipped_locked) == (1, 0, 0)
    raised = await _row_of(session, main_goal, member)
    assert (raised.state, raised.updated_by_user_id) == ("have", member.id)
    kept = await _row_of(session, alt_goal, member)
    assert (kept.state, kept.updated_at, kept.updated_by_user_id, kept.updated_via) == (
        "need",
        _OLD,
        owner.id,
        "web",
    )
    (record,) = await _records(session)
    assert (record.character_id, record.ownership_state) == (main.id, "have")
    merged = await merged_participants(
        session,
        static_group_id=alt_static.id,
        rows=[kept],
        catalog_item_by_goal={alt_goal.id: catalog.id},
    )
    assert (merged[kept.id].state, merged[kept.id].state_from_record, merged[kept.id].record) == (
        "need",
        False,
        None,
    )


async def test_matched_sync_counts_the_one_row_it_writes_and_not_the_record(
    session: AsyncSession, member: User, group
):
    """vet M-6: the record and one static's row are written; `statesUpdated` reads 1."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Counted Main", is_main=True)
    await create_claimed_card(session, group, member, main)
    catalog = await _mount_catalog(session, game_mount_id=4606)
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(
            character_name="Counted Main", mounts=[CollectionMountItem(mount_id=4606, owned=True)]
        ),
    )

    assert (result.states_updated, result.states_unchanged, result.skipped_locked) == (1, 0, 0)
    assert (await _row_of(session, goal, member)).state == "have"
    (record,) = await _records(session)
    assert (record.character_id, record.ownership_state) == (main.id, "have")


async def test_a_record_only_change_counts_nothing(session: AsyncSession, member: User, group):
    """vet M-6: the matched character is the alt, the only static's card is the main: the alt's
    record is written, no row is, and every counter reads 0."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Card Main", is_main=True)
    alt = await create_player_character(session, profile, name="Synced Alt", is_main=False)
    await create_claimed_card(session, group, member, main)
    catalog = await _mount_catalog(session, game_mount_id=4607, token_item_id=4608)
    goal = _goal(session, group_id=group.id, catalog_item_id=catalog.id)
    await session.flush()

    result = await _sync(
        session,
        member,
        PluginCollectionSyncPayload(
            character_name="Synced Alt",
            mounts=[CollectionMountItem(mount_id=4607, owned=True)],
            currencies=[CollectionTokenItem(item_id=4608, count=9)],
        ),
    )

    counters = (
        result.states_updated,
        result.states_unchanged,
        result.token_counts_updated,
        result.skipped_locked,
    )
    assert counters == (0, 0, 0, 0)
    assert await _row_of(session, goal, member) is None
    (record,) = await _records(session)
    assert (record.character_id, record.ownership_state, record.token_count) == (alt.id, "have", 9)
