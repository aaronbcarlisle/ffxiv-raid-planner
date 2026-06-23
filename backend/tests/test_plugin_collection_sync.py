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
from app.models.reward_participant_state import RewardParticipantState
from app.services.plugin_collection_sync_service import sync_collection_states
from app.schemas.plugin_collections import (
    CollectionMountItem,
    CollectionTokenItem,
    PluginCollectionSyncPayload,
)
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()


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
    result = await sync_collection_states(session, member, payload)

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
    await sync_collection_states(session, member, payload)

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
    await sync_collection_states(session, member, payload)

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
    result = await sync_collection_states(session, outsider, payload)

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
    result = await sync_collection_states(session, member, payload)

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
    result = await sync_collection_states(session, member, payload)

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
    result = await sync_collection_states(session, member, payload)

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
    await sync_collection_states(session, member, payload)

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
    result = await sync_collection_states(session, member, payload)

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
    await sync_collection_states(session, member, payload)

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
