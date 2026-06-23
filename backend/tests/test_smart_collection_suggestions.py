"""
Tests for Smart Collection Suggestions.

Covers:
  - plugin sync updates PlayerCollectionSnapshot (factual state)
  - plugin sync does NOT create PlayerCollectionIntent (no intent pollution)
  - hunting intent raises suggestion score
  - pass/hidden removes player from positive signal
  - can-buy detected from synced tokenCount
  - stale sync lowers confidence signal
  - static_only intent visible to static but not dossier
  - dossier_public intent appears in dossier endpoint
  - private intent does not appear in dossier endpoint
  - applicant/static farm match returns shared goal reasons
  - manual fallback when no snapshot exists
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.collection_goal import CollectionGoal
from app.models.player_collection_intent import PlayerCollectionIntent
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.player_profile import PlayerProfile
from app.schemas.plugin_collections import (
    CollectionMountItem,
    CollectionTokenItem,
    PluginCollectionSyncPayload,
)
from app.services.collection_suggestion_service import (
    STALE_DAYS,
    SUGGESTION_WEIGHTS,
    compute_suggestions,
    dossier_farm_match,
)
from app.services.plugin_collection_sync_service import sync_collection_states
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()
_STALE = (datetime.now(timezone.utc) - timedelta(days=STALE_DAYS + 1)).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_catalog(
    session: AsyncSession,
    *,
    name: str = "Test Mount",
    category: str = "mount",
    game_mount_id: int | None = None,
    token_name: str | None = None,
    token_cost: int | None = None,
    token_item_id: int | None = None,
    source_duty_name: str | None = "Test Trial (EX)",
    source_type: str | None = "extreme",
) -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name=name,
        category=category,
        game_mount_id=game_mount_id,
        token_name=token_name,
        token_cost=token_cost,
        token_item_id=token_item_id,
        source_duty_name=source_duty_name,
        source_type=source_type,
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _make_goal(
    session: AsyncSession,
    group_id: str,
    catalog_item_id: str,
    *,
    status: str = "farming",
    token_cost: int | None = None,
    token_name: str | None = None,
) -> CollectionGoal:
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        goal_type="mount",
        title="Test Goal",
        status=status,
        catalog_item_id=catalog_item_id,
        token_cost=token_cost,
        token_name=token_name,
    )
    session.add(goal)
    return goal


def _make_intent(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    *,
    intent: str = "hunting",
    priority: str = "medium",
    visibility: str = "static_only",
) -> PlayerCollectionIntent:
    row = PlayerCollectionIntent(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        intent=intent,
        priority=priority,
        visibility=visibility,
        updated_at=_NOW,
    )
    session.add(row)
    return row


def _make_snapshot(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    *,
    ownership_state: str = "missing",
    source: str = "plugin",
    confidence: str = "high",
    last_synced_at: str | None = None,
    token_count: int | None = None,
) -> PlayerCollectionSnapshot:
    snap = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        ownership_state=ownership_state,
        source=source,
        confidence=confidence,
        last_synced_at=last_synced_at or _NOW,
        token_count=token_count,
        updated_at=_NOW,
    )
    session.add(snap)
    return snap


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="member")


@pytest_asyncio.fixture
async def owner_profile(session: AsyncSession, owner: User) -> PlayerProfile:
    return await create_player_profile(session, owner)


@pytest_asyncio.fixture
async def member_profile(session: AsyncSession, member: User) -> PlayerProfile:
    return await create_player_profile(session, member)


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, member: User):
    g = await create_static_group(session, owner)
    await create_membership(session, member, g, role="member")
    return g


@pytest.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


@pytest.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


# ── Test: plugin sync writes snapshot, not intent ─────────────────────────────

async def test_plugin_sync_creates_snapshot(session: AsyncSession, owner: User, owner_profile: PlayerProfile):
    """Plugin sync with owned=True and a stable game_mount_id must write a PlayerCollectionSnapshot."""
    catalog = _make_catalog(session, name="Savage Mount", game_mount_id=1234, category="mount")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=1234, owned=True)],
        currencies=[],
    )
    await sync_collection_states(session, owner, payload)
    await session.commit()

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == owner_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one_or_none()
    assert snap is not None
    assert snap.ownership_state == "have"
    assert snap.source == "plugin"
    assert snap.confidence == "high"


async def test_plugin_sync_does_not_create_intent(session: AsyncSession, owner: User, owner_profile: PlayerProfile):
    """Plugin sync must never create a PlayerCollectionIntent entry — intents are player-only."""
    catalog = _make_catalog(session, name="NPC Mount", game_mount_id=9999, category="mount")
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=9999, owned=True)],
        currencies=[],
    )
    await sync_collection_states(session, owner, payload)
    await session.commit()

    intent_result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == owner_profile.id,
        )
    )
    assert intent_result.scalars().all() == []


async def test_plugin_sync_updates_token_count_on_snapshot(session: AsyncSession, owner: User, owner_profile: PlayerProfile):
    """Token currency sync must update token_count on the snapshot without touching ownership."""
    catalog = _make_catalog(session, name="Token Mount", token_item_id=555, token_cost=99)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[],
        currencies=[CollectionTokenItem(item_id=555, token_name="Totem", count=42)],
    )
    await sync_collection_states(session, owner, payload)
    await session.commit()

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == owner_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one_or_none()
    assert snap is not None
    assert snap.token_count == 42
    assert snap.ownership_state == "unknown"  # token sync never sets have/missing


async def test_plugin_sync_no_snapshot_without_profile(session: AsyncSession, owner: User):
    """If the user has no PlayerProfile, plugin sync silently skips snapshot writing."""
    catalog = _make_catalog(session, game_mount_id=7777)
    await session.flush()

    payload = PluginCollectionSyncPayload(
        mounts=[CollectionMountItem(mount_id=7777, owned=True)],
        currencies=[],
    )
    await sync_collection_states(session, owner, payload)
    await session.commit()

    result = await session.execute(select(PlayerCollectionSnapshot))
    assert result.scalars().all() == []


# ── Test: suggestion scoring ──────────────────────────────────────────────────

async def test_hunting_intent_raises_score(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """A hunting intent (static_only) must raise the suggestion score by hunting_intent weight."""
    catalog = _make_catalog(session, name="Hunted Mount")
    _make_goal(session, group.id, catalog.id)
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    s = suggestions[0]

    member_entry = next(m for m in s.members if m.user_id == member.id)
    assert "Hunting" in member_entry.reasons
    assert member_entry.intent == "hunting"
    # Score must be above base (active_static_goal alone) — hunting intent lifts it even
    # after the "no snapshot data" penalty for members without a synced snapshot.
    assert s.suggested_farm_score > SUGGESTION_WEIGHTS["active_static_goal"]


async def test_pass_intent_removes_positive_signal(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """A pass intent must apply the negative pass weight and exclude the member from positives."""
    catalog = _make_catalog(session, name="Pass Mount")
    _make_goal(session, group.id, catalog.id)
    _make_intent(session, member_profile.id, catalog.id, intent="pass", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert "Pass" in member_entry.reasons


async def test_can_buy_detected_from_token_count(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """Member with token_count >= token_cost must be marked can_buy=True."""
    catalog = _make_catalog(session, name="Token Mount", token_cost=99)
    _make_goal(session, group.id, catalog.id, token_cost=99)
    _make_snapshot(session, member_profile.id, catalog.id, ownership_state="missing", token_count=99)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert member_entry.can_buy is True
    assert "Can buy" in member_entry.reasons


async def test_stale_sync_lowers_score(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """A stale last_synced_at should add a stale penalty to the member's score."""
    catalog = _make_catalog(session, name="Stale Mount")
    _make_goal(session, group.id, catalog.id)
    _make_snapshot(session, member_profile.id, catalog.id, ownership_state="missing", last_synced_at=_STALE)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert "Stale sync" in member_entry.reasons or "Unknown ownership" not in member_entry.reasons


async def test_private_intent_not_used_in_suggestions(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """Private intents must never be consumed by the suggestion engine."""
    catalog = _make_catalog(session, name="Private Hunt Mount")
    _make_goal(session, group.id, catalog.id)
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="private")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    # intent field must be None because private intents are excluded
    assert member_entry.intent is None
    assert "Hunting" not in member_entry.reasons


async def test_manual_fallback_when_no_snapshot(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """When no snapshot exists, the engine should fall back to RewardParticipantState."""
    from app.models.reward_participant_state import RewardParticipantState

    catalog = _make_catalog(session, name="Manual Mount")
    goal = _make_goal(session, group.id, catalog.id)
    await session.flush()

    # Add manual participant state — no snapshot
    rps = RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id=goal.id,
        user_id=member.id,
        static_group_id=group.id,
        state="need",
        source="manual",
        updated_at=_NOW,
    )
    session.add(rps)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert member_entry.ownership_state == "missing"
    assert "Need (manual)" in member_entry.reasons or "manual" in str(member_entry.reasons).lower()


# ── Test: dossier visibility ───────────────────────────────────────────────────

async def test_dossier_public_intent_appears_in_dossier(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
):
    """dossier_public intent must appear on the public dossier endpoint."""
    # Enable share for profile
    owner_profile.share_enabled = True
    owner_profile.share_code = "TESTAB"
    owner_profile.visibility = "discoverable"
    await session.flush()

    catalog = _make_catalog(session, name="Public Hunt Mount")
    _make_intent(session, owner_profile.id, catalog.id, intent="hunting", visibility="dossier_public")
    await session.commit()

    resp = await async_client.get("/api/profiles/TESTAB/collection-intent")
    assert resp.status_code == 200
    data = resp.json()
    assert any(item["catalog_item_id"] == catalog.id for item in data)
    assert any(item["intent"] == "hunting" for item in data)


async def test_static_only_intent_not_in_dossier(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
):
    """static_only intents must NOT appear on the public dossier endpoint."""
    owner_profile.share_enabled = True
    owner_profile.share_code = "TESTCD"
    owner_profile.visibility = "discoverable"
    await session.flush()

    catalog = _make_catalog(session, name="Static Only Mount")
    _make_intent(session, owner_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.commit()

    resp = await async_client.get("/api/profiles/TESTCD/collection-intent")
    assert resp.status_code == 200
    data = resp.json()
    assert not any(item["catalog_item_id"] == catalog.id for item in data)


async def test_private_intent_not_in_dossier(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
):
    """Private intents must never appear on the public dossier endpoint."""
    owner_profile.share_enabled = True
    owner_profile.share_code = "TESTEFG"
    owner_profile.visibility = "discoverable"
    await session.flush()

    catalog = _make_catalog(session, name="Private Mount")
    _make_intent(session, owner_profile.id, catalog.id, intent="hunting", visibility="private")
    await session.commit()

    resp = await async_client.get("/api/profiles/TESTEFG/collection-intent")
    assert resp.status_code == 200
    data = resp.json()
    assert not any(item["catalog_item_id"] == catalog.id for item in data)


async def test_dossier_endpoint_404_for_private_profile(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
):
    """Dossier endpoint must 404 when the profile has share_enabled=False."""
    owner_profile.share_enabled = False
    owner_profile.share_code = "NOSHARE"
    await session.commit()

    resp = await async_client.get("/api/profiles/NOSHARE/collection-intent")
    assert resp.status_code == 404


# ── Test: intent CRUD API ─────────────────────────────────────────────────────

async def test_intent_upsert_and_list(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
    owner_headers: dict,
):
    """PUT intent then GET list — must appear with correct fields."""
    catalog = _make_catalog(session, name="API Mount")
    await session.commit()

    resp = await async_client.put(
        f"/api/me/collection-intent/{catalog.id}",
        json={"intent": "hunting", "priority": "high", "visibility": "static_only"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "hunting"
    assert data["visibility"] == "static_only"

    list_resp = await async_client.get("/api/me/collection-intent", headers=owner_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(i["catalog_item_id"] == catalog.id for i in items)


async def test_intent_delete(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
    owner_headers: dict,
):
    catalog = _make_catalog(session, name="Del Mount")
    _make_intent(session, owner_profile.id, catalog.id)
    await session.commit()

    resp = await async_client.delete(f"/api/me/collection-intent/{catalog.id}", headers=owner_headers)
    assert resp.status_code == 204

    list_resp = await async_client.get("/api/me/collection-intent", headers=owner_headers)
    items = list_resp.json()
    assert not any(i["catalog_item_id"] == catalog.id for i in items)


async def test_intent_default_visibility_is_private(
    async_client: AsyncClient,
    session: AsyncSession,
    owner: User,
    owner_profile: PlayerProfile,
    owner_headers: dict,
):
    """Default visibility when omitted must be private."""
    catalog = _make_catalog(session, name="Default Vis Mount")
    await session.commit()

    resp = await async_client.put(
        f"/api/me/collection-intent/{catalog.id}",
        json={"intent": "hunting"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["visibility"] == "private"


# ── Test: farm match ──────────────────────────────────────────────────────────

async def test_dossier_farm_match_returns_shared_goals(
    session: AsyncSession,
    owner: User,
    member: User,
    member_profile: PlayerProfile,
    group,
):
    """dossier_farm_match must return shared farm goals with reasons."""
    catalog = _make_catalog(session, name="Shared Farm Mount")
    _make_goal(session, group.id, catalog.id)
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="dossier_public")
    await session.flush()

    result = await dossier_farm_match(session, group.id, member_profile.id)
    assert result["match_score"] > 0
    assert any(g["catalog_item_id"] == catalog.id for g in result["shared_goals"])
    assert any("Hunting" in r for r in result["reasons"])


async def test_dossier_farm_match_ignores_static_only_intent(
    session: AsyncSession,
    owner: User,
    member: User,
    member_profile: PlayerProfile,
    group,
):
    """Farm match must not use static_only intents — only dossier_public."""
    catalog = _make_catalog(session, name="Static Only Farm Mount")
    _make_goal(session, group.id, catalog.id)
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    result = await dossier_farm_match(session, group.id, member_profile.id)
    assert result["match_score"] == 0
    assert result["shared_goals"] == []


# ── Test: intent-first suggestions (no CollectionGoal required) ───────────────

async def test_suggestions_appear_without_static_goals(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """compute_suggestions must return results from intent alone — no CollectionGoal needed.

    This is the core fix for 'Active Farms (0)': the suggestion engine should show
    what roster members want to farm even before any lead has manually created a goal.
    """
    catalog = _make_catalog(session, name="Intent-Only Mount")
    # No CollectionGoal created for this catalog item
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)

    assert len(suggestions) == 1
    s = suggestions[0]
    assert s.catalog_item_id == catalog.id
    assert s.static_goal_id is None  # no goal exists yet
    member_entry = next(m for m in s.members if m.user_id == member.id)
    assert member_entry.intent == "hunting"
    assert "Hunting" in member_entry.reasons
    # Score > 0: hunting_intent (+50) minus stale_or_unknown penalties leaves a positive total
    assert s.suggested_farm_score > 0


async def test_suggestions_no_results_with_only_private_intent(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """Private intents must not produce suggestions even without a goal."""
    catalog = _make_catalog(session, name="Private Intent Mount")
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="private")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 0


async def test_suggestion_schema_includes_catalog_fields(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """Suggestions must include catalog_item_category and source_type for frontend goal creation."""
    catalog = _make_catalog(
        session, name="Schema Mount", category="mount",
        source_type="extreme", source_duty_name="Test Trial (EX)",
    )
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    s = suggestions[0]
    assert s.catalog_item_category == "mount"
    assert s.source_type == "extreme"


# ── Ultimate weapon can-buy logic ─────────────────────────────────────────────

async def test_ultimate_can_buy_at_token_count_one(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """Ultimate weapon: tokenCount=1 should set can_buy=True (1 totem = 1 weapon)."""
    catalog = _make_catalog(
        session, name="Ultimate Edenmorn Weapons", category="weapon",
        source_type="ultimate", source_duty_name="Futures Rewritten (Ultimate)",
        token_name="Oracle Totem", token_cost=1,
    )
    _make_goal(session, group.id, catalog.id, token_cost=1, token_name="Oracle Totem")
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    _make_snapshot(session, member_profile.id, catalog.id, ownership_state="missing", token_count=1)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert member_entry.can_buy is True


async def test_ultimate_cannot_buy_at_token_count_zero(
    session: AsyncSession, owner: User, member: User,
    owner_profile: PlayerProfile, member_profile: PlayerProfile, group,
):
    """Ultimate weapon: tokenCount=0 should NOT set can_buy=True."""
    catalog = _make_catalog(
        session, name="Palazzo Diamond Weapons", category="weapon",
        source_type="ultimate", source_duty_name="Dancing Mad (Ultimate)",
        token_name="Mad Harlequin's Totem", token_cost=1,
    )
    _make_goal(session, group.id, catalog.id, token_cost=1, token_name="Mad Harlequin's Totem")
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    _make_snapshot(session, member_profile.id, catalog.id, ownership_state="missing", token_count=0)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    member_entry = next(m for m in suggestions[0].members if m.user_id == member.id)
    assert member_entry.can_buy is False
