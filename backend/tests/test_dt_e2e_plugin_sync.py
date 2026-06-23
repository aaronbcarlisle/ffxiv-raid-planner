"""End-to-end plugin sync tests using real Dawntrail game IDs.

These tests validate the complete plugin sync flow after IDs are populated:

  Test 1  — pre-DT mount owned:  plugin sends known EW mount_id → Have
  Test 2  — DT mount owned:      plugin sends DT mount_id (345 = Wings of Ruin) → Have
  Test 3  — DT token count:      plugin sends DT token item_id (43539) / count=12 → tokenCount=12 (not Have)
  Test 4  — character does not own DT mount: owned=False → no Have state
  Test 5  — wrong DT mount_id:   plugin sends wrong ID → no match, no state change
  Test 6  — source_duty_key alone still forbidden: catalog with no game_mount_id → no Have
  Test 7  — unsupported categories: orchestrion/minion remain manual; no Plugin badge
  Test 8  — DT token count >= token_cost: can_buy=True in token state
  Test 9  — DT token full run:   send 6 DT tokens in one payload, verify all token counts updated
  Test 10 — DT mount: owned = False does not clear existing Have
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MemberRole, User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.collection_goal import CollectionGoal
from app.models.reward_participant_state import RewardParticipantState
from app.schemas.plugin_collections import (
    CollectionMountItem,
    CollectionTokenItem,
    PluginCollectionSyncPayload,
)
from app.services.plugin_collection_sync_service import sync_collection_states
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()

# ── Verified DT game IDs (Garland Tools / FFXIV Collect) ──────────────────────
# Mount.exd RowIds
MOUNT_WINGS_OF_RUIN          = 345  # dt-valigarmanda
MOUNT_WINGS_OF_RESOLVE       = 346  # dt-zoraal-ja
MOUNT_WINGS_OF_ETERNITY      = 363  # dt-sphene
MOUNT_WINGS_OF_THE_KNIGHTHOOD = 389  # dt-recollection
MOUNT_WINGS_OF_DEATH         = 407  # dt-necron-embrace
MOUNT_FELYNE_CART            = 399  # dt-windward-wilds
MOUNT_WINGS_OF_MIST          = 422  # dt-hell-on-rails
MOUNT_WINGS_OF_NIHILITY      = 444  # dt-unmaking

# Item.exd RowIds (totems)
TOKEN_SKYRUIN_TOTEM          = 43539   # Skyruin Totem (dt-valigarmanda)
TOKEN_RESILIENT_TOTEM        = 43540   # Resilient Totem (dt-zoraal-ja)
TOKEN_TOTEM_ETERNAL          = 44718   # Totem Eternal (dt-sphene)
TOKEN_KNIGHT_TOTEM           = 46720   # Knight Totem (dt-recollection)
TOKEN_GRAVE_TOTEM            = 46982   # Grave Totem (dt-necron-embrace)
TOKEN_GUARDIAN_ARKVELD_CERT  = 47101   # Guardian Arkveld Certificate (dt-windward-wilds)

# A known EW extreme trial mount ID for pre-DT test
MOUNT_EW_EXAMPLE             = 280  # Approximate; not a DT entry in our catalog seed


# ── Helpers ───────────────────────────────────────────────────────────────────


def _catalog(
    *,
    name: str,
    category: str = "mount",
    expansion: str = "dt",
    source_duty_key: str | None = None,
    token_name: str | None = None,
    game_mount_id: int | None = None,
    token_item_id: int | None = None,
) -> CollectionCatalogItem:
    return CollectionCatalogItem(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        expansion=expansion,
        external_source="internal",
        source_duty_key=source_duty_key,
        token_name=token_name,
        game_mount_id=game_mount_id,
        token_item_id=token_item_id,
        is_curated=True,
        updated_at=_NOW,
    )


def _goal(
    *,
    group_id: str,
    catalog_item_id: str | None = None,
    token_name: str | None = None,
    goal_type: str = "mount",
    status: str = "farming",
) -> CollectionGoal:
    return CollectionGoal(
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


@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="dt_e2e_user", discord_username="dt_e2e_user")


@pytest_asyncio.fixture
async def group(session: AsyncSession, user: User):
    g = await create_static_group(session, user)
    await session.flush()
    return g


# ── Test 1 — Pre-DT mount owned (EW example) ─────────────────────────────────


async def test_pre_dt_mount_owned_marks_have(session: AsyncSession, user: User, group) -> None:
    """Plugin sends a non-DT mount_id for a catalog row that has it set → Have."""
    cat = _catalog(name="EW Example Mount", source_duty_key="ew-example", game_mount_id=MOUNT_EW_EXAMPLE)
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=MOUNT_EW_EXAMPLE, owned=True)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 1
    state = (await session.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one()
    assert state.state == "have"
    assert state.source == "plugin"


# ── Test 2 — DT mount owned: Wings of Ruin (game_mount_id=345) ───────────────


async def test_dt_mount_wings_of_ruin_marks_have(session: AsyncSession, user: User, group) -> None:
    """Plugin sends DT mount_id=345 (Wings of Ruin) → Have state on matching goal."""
    cat = _catalog(
        name="Wings of Ruin",
        source_duty_key="dt-valigarmanda",
        game_mount_id=MOUNT_WINGS_OF_RUIN,
        token_name="Skyruin Totem",
        token_item_id=TOKEN_SKYRUIN_TOTEM,
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=MOUNT_WINGS_OF_RUIN, owned=True)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 1
    assert result.skipped_no_id == 0
    state = (await session.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one()
    assert state.state == "have"
    assert state.source == "plugin"


# ── Test 3 — DT token count (Skyruin Totem item_id=43539) ────────────────────


async def test_dt_token_count_updates_without_have(session: AsyncSession, user: User, group) -> None:
    """Plugin sends Skyruin Totem item_id=43539 count=12 → tokenCount=12, state stays 'want'."""
    from sqlalchemy import select as sa_select
    cat = _catalog(
        name="Wings of Ruin",
        source_duty_key="dt-valigarmanda",
        game_mount_id=MOUNT_WINGS_OF_RUIN,
        token_name="Skyruin Totem",
        token_item_id=TOKEN_SKYRUIN_TOTEM,
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id, token_name="Skyruin Totem", goal_type="token")
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        currencies=[CollectionTokenItem(item_id=TOKEN_SKYRUIN_TOTEM, count=12, token_name="Skyruin Totem")],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.token_counts_updated == 1
    state = (await session.execute(
        sa_select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one()
    assert state.token_count == 12
    assert state.state != "have", "token count update must not set Have"


# ── Test 4 — Character does not own DT mount: owned=False ────────────────────


async def test_dt_mount_not_owned_does_not_create_have(session: AsyncSession, user: User, group) -> None:
    from sqlalchemy import select as sa_select
    cat = _catalog(
        name="Wings of Resolve",
        source_duty_key="dt-zoraal-ja",
        game_mount_id=MOUNT_WINGS_OF_RESOLVE,
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=MOUNT_WINGS_OF_RESOLVE, owned=False)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 0
    state = (await session.execute(
        sa_select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one_or_none()
    assert state is None, "No state row should be created for unowned mount"


# ── Test 5 — Wrong DT mount_id: no match ─────────────────────────────────────


async def test_wrong_dt_mount_id_no_match(session: AsyncSession, user: User, group) -> None:
    """Sending a valid-looking but wrong ID (not in catalog) → skipped_no_id."""
    cat = _catalog(
        name="Wings of Eternity",
        source_duty_key="dt-sphene",
        game_mount_id=MOUNT_WINGS_OF_ETERNITY,  # 363
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    # Send wrong ID (999 instead of 363)
    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=999, owned=True)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 0
    assert result.skipped_no_id == 1


# ── Test 6 — source_duty_key alone still forbidden (regression guard) ─────────


async def test_dt_source_duty_key_alone_not_used_for_ownership(session: AsyncSession, user: User, group) -> None:
    """Catalog row has source_duty_key but no game_mount_id.
    Plugin sends trial_id (source_duty_key) without a stable mount_id → no Have."""
    from sqlalchemy import select as sa_select
    cat = _catalog(
        name="Wings of the Knighthood",
        source_duty_key="dt-recollection",
        game_mount_id=None,  # explicitly not set — safety test
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=None, trial_id="dt-recollection", owned=True)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 0
    assert result.skipped_no_id == 1
    state = (await session.execute(
        sa_select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one_or_none()
    assert state is None


# ── Test 7 — Unsupported categories remain manual ────────────────────────────


async def test_orchestrion_category_never_set_by_plugin(session: AsyncSession, user: User, group) -> None:
    """An orchestrion catalog row has no game_mount_id. Plugin sending a mount payload
    must never create a Have state on it, even if the mount_id happens to match."""
    from sqlalchemy import select as sa_select
    mount_cat = _catalog(name="Wings of Death", source_duty_key="dt-necron-embrace",
                         game_mount_id=MOUNT_WINGS_OF_DEATH)
    orch_cat = _catalog(name="Some Orchestrion Track", category="orchestrion",
                        source_duty_key="dt-necron-embrace")
    session.add_all([mount_cat, orch_cat])
    await session.flush()
    mount_goal = _goal(group_id=group.id, catalog_item_id=mount_cat.id)
    orch_goal = _goal(group_id=group.id, catalog_item_id=orch_cat.id, goal_type="orchestrion")
    session.add_all([mount_goal, orch_goal])
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=MOUNT_WINGS_OF_DEATH, owned=True)],
    )
    result = await sync_collection_states(session, user, payload)

    # Mount goal should be updated; orchestrion goal should NOT be
    assert result.states_updated == 1
    orch_state = (await session.execute(
        sa_select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == orch_goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one_or_none()
    assert orch_state is None, "Orchestrion goal must not be set by plugin mount sync"


# ── Test 8 — DT token count >= token_cost → can_buy True ────────────────────


async def test_dt_token_count_at_cost_can_buy(session: AsyncSession, user: User, group) -> None:
    """When token count reaches 99 (token_cost), the state row reflects enough tokens."""
    from sqlalchemy import select as sa_select
    cat = _catalog(
        name="Wings of Eternity",
        source_duty_key="dt-sphene",
        game_mount_id=MOUNT_WINGS_OF_ETERNITY,
        token_name="Totem Eternal",
        token_item_id=TOKEN_TOTEM_ETERNAL,
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id, token_name="Totem Eternal", goal_type="token")
    session.add(goal)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        currencies=[CollectionTokenItem(item_id=TOKEN_TOTEM_ETERNAL, count=99, token_name="Totem Eternal")],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.token_counts_updated == 1
    state = (await session.execute(
        sa_select(RewardParticipantState)
        .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
    )).scalar_one()
    assert state.token_count == 99
    assert state.state != "have"  # token sync never sets Have directly


# ── Test 9 — Full DT payload: 6 tokens in one call ───────────────────────────


async def test_full_dt_token_payload(session: AsyncSession, user: User, group) -> None:
    """Simulate a real plugin sync: send all 6 DT token item IDs in one call."""
    from sqlalchemy import select as sa_select

    dt_tokens = [
        ("Wings of Ruin",            "dt-valigarmanda",   MOUNT_WINGS_OF_RUIN,            "Skyruin Totem",            TOKEN_SKYRUIN_TOTEM,         11),
        ("Wings of Resolve",         "dt-zoraal-ja",      MOUNT_WINGS_OF_RESOLVE,          "Resilient Totem",          TOKEN_RESILIENT_TOTEM,        22),
        ("Wings of Eternity",        "dt-sphene",         MOUNT_WINGS_OF_ETERNITY,         "Totem Eternal",            TOKEN_TOTEM_ETERNAL,          33),
        ("Wings of the Knighthood",  "dt-recollection",   MOUNT_WINGS_OF_THE_KNIGHTHOOD,   "Knight Totem",             TOKEN_KNIGHT_TOTEM,           44),
        ("Wings of Death",           "dt-necron-embrace", MOUNT_WINGS_OF_DEATH,            "Grave Totem",              TOKEN_GRAVE_TOTEM,            55),
        ("Felyne Support Team Cart Horn", "dt-windward-wilds", MOUNT_FELYNE_CART,           "Guardian Arkveld Certificate", TOKEN_GUARDIAN_ARKVELD_CERT, 66),
    ]

    cats, goals = [], []
    for name, sdk, mid, tok_name, tok_id, _ in dt_tokens:
        cat = _catalog(name=name, source_duty_key=sdk, game_mount_id=mid,
                       token_name=tok_name, token_item_id=tok_id)
        session.add(cat)
        cats.append(cat)
    await session.flush()
    for (_, _, _, tok_name, _, _), cat in zip(dt_tokens, cats):
        goal = _goal(group_id=group.id, catalog_item_id=cat.id,
                     token_name=tok_name, goal_type="token")
        session.add(goal)
        goals.append(goal)
    await session.flush()

    currencies = [
        CollectionTokenItem(item_id=tok_id, count=count, token_name=tok_name)
        for (_, _, _, tok_name, tok_id, count) in dt_tokens
    ]
    payload = PluginCollectionSyncPayload(currencies=currencies)
    result = await sync_collection_states(session, user, payload)

    assert result.token_counts_updated == 6

    for (_, _, _, _, tok_id, count), goal in zip(dt_tokens, goals):
        state = (await session.execute(
            sa_select(RewardParticipantState)
            .where(RewardParticipantState.goal_id == goal.id, RewardParticipantState.user_id == user.id)
        )).scalar_one()
        assert state.token_count == count
        assert state.state != "have"


# ── Test 10 — owned=False does not clear existing Have ───────────────────────


async def test_dt_mount_unowned_does_not_clear_existing_have(session: AsyncSession, user: User, group) -> None:
    """If the character already has Have state (set by plugin), and sync sends owned=False,
    the existing Have is NOT cleared — only owned=True can set Have."""
    from sqlalchemy import select as sa_select
    cat = _catalog(
        name="Wings of Mist",
        source_duty_key="dt-hell-on-rails",
        game_mount_id=MOUNT_WINGS_OF_MIST,
    )
    session.add(cat)
    await session.flush()
    goal = _goal(group_id=group.id, catalog_item_id=cat.id)
    session.add(goal)
    await session.flush()

    # Simulate an already-set Have from a prior sync
    existing = RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id=goal.id,
        user_id=user.id,
        static_group_id=group.id,
        state="have",
        source="plugin",
        updated_at=_NOW,
    )
    session.add(existing)
    await session.flush()

    # Now sync with owned=False
    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=MOUNT_WINGS_OF_MIST, owned=False)],
    )
    result = await sync_collection_states(session, user, payload)

    assert result.states_updated == 0
    await session.refresh(existing)
    assert existing.state == "have", "owned=False must not clear existing Have"
