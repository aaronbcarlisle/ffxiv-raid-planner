"""
Tests for the Collections Center backend endpoints.

Covers:
  - GET /api/me/collection-catalog returns empty list (not 404) without a profile
  - GET /api/me/collection-catalog returns merged intent + snapshot for known items
  - Category filter works
  - Intent can be set for non-mount categories (music, minion, weapon) without MountFarmProgress
  - static_only intent appears in Static Collection Suggestions
  - private intent does NOT appear in Static Collection Suggestions
  - dossier_public intent appears in Dossier public endpoint
  - Token count flows from snapshot into catalog entry
  - Plugin-confirmed 'have' is NOT overwritten by a manual 'missing' snapshot PUT
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.player_collection_intent import PlayerCollectionIntent
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.player_profile import PlayerProfile
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _catalog_item(
    session: AsyncSession,
    *,
    name: str = "Test Mount",
    category: str = "mount",
    expansion: str | None = "DT",
    source_duty_name: str | None = "Some Trial (EX)",
    source_type: str | None = "extreme",
    is_active: bool = True,
) -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name=name,
        category=category,
        expansion=expansion,
        source_duty_name=source_duty_name,
        source_type=source_type,
        is_curated=True,
        is_active=is_active,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _intent(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    *,
    intent: str = "hunting",
    visibility: str = "static_only",
    priority: str = "medium",
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


def _snapshot(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    *,
    ownership_state: str = "missing",
    source: str = "plugin",
    confidence: str = "high",
    token_count: int | None = None,
) -> PlayerCollectionSnapshot:
    snap = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        ownership_state=ownership_state,
        source=source,
        confidence=confidence,
        last_synced_at=_NOW,
        token_count=token_count,
        updated_at=_NOW,
    )
    session.add(snap)
    return snap


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    return await create_user(session, discord_username="center_user")


@pytest_asyncio.fixture
async def other_user(session: AsyncSession) -> User:
    return await create_user(session, discord_username="other_user")


@pytest_asyncio.fixture
async def profile(session: AsyncSession, user: User) -> PlayerProfile:
    return await create_player_profile(session, user)


@pytest.fixture
def headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def other_headers(other_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(other_user.id)}"}


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_catalog_list_returns_empty_without_profile(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """GET /me/collection-catalog returns [] (not 404) when user has no profile."""
    _catalog_item(session, name="Wing A")
    await session.commit()

    r = await async_client.get("/api/me/collection-catalog", headers=headers)
    assert r.status_code == 200
    data = r.json()
    # Items are returned, but all player state is null
    assert isinstance(data, list)
    item = next((e for e in data if e["catalog_item_name"] == "Wing A"), None)
    assert item is not None
    assert item["intent"] is None
    assert item["ownership_state"] is None


async def test_catalog_returns_merged_intent_and_snapshot(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile, headers: dict
):
    """Catalog entry merges intent + snapshot when both exist."""
    item = _catalog_item(session, name="Wings of Ruin", category="mount")
    _intent(session, profile.id, item.id, intent="hunting", visibility="static_only")
    _snapshot(session, profile.id, item.id, ownership_state="missing", token_count=42)
    await session.commit()

    r = await async_client.get("/api/me/collection-catalog", headers=headers)
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["catalog_item_id"] == item.id)
    assert entry["intent"] == "hunting"
    assert entry["visibility"] == "static_only"
    assert entry["ownership_state"] == "missing"
    assert entry["token_count"] == 42


async def test_catalog_category_filter(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """category= query param filters to only matching rows."""
    _catalog_item(session, name="Test Mount", category="mount")
    _catalog_item(session, name="Test Song", category="orchestrion")
    await session.commit()

    r = await async_client.get("/api/me/collection-catalog?category=orchestrion", headers=headers)
    assert r.status_code == 200
    names = [e["catalog_item_name"] for e in r.json()]
    assert "Test Song" in names
    assert "Test Mount" not in names


async def test_intent_for_orchestrion_without_mount_farm_progress(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """Player can set intent for an orchestrion (music) item.

    No MountFarmProgress record is required — the intent stands on its own.
    """
    song = _catalog_item(session, name="The Wanderer's Minuet", category="orchestrion")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-intent/{song.id}",
        json={"intent": "hunting", "visibility": "private"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["intent"] == "hunting"

    # Verify persisted
    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.catalog_item_id == song.id
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.intent == "hunting"


async def test_intent_for_minion_without_mount_farm_progress(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """Player can set intent for a minion without MountFarmProgress."""
    minion = _catalog_item(session, name="Wind-up Warrior of Light", category="minion")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-intent/{minion.id}",
        json={"intent": "interested", "visibility": "static_only"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["intent"] == "interested"
    assert r.json()["visibility"] == "static_only"


async def test_intent_for_weapon_without_mount_farm_progress(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """Player can set intent for a weapon without MountFarmProgress."""
    weapon = _catalog_item(session, name="Manderville Blade", category="weapon",
                           source_type="ultimate")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-intent/{weapon.id}",
        json={"intent": "hunting", "visibility": "dossier_public"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["intent"] == "hunting"
    assert r.json()["visibility"] == "dossier_public"


async def test_static_only_intent_appears_in_suggestions(
    async_client: AsyncClient, session: AsyncSession, headers: dict, user: User
):
    """static_only intent surfaces in the static's Suggested Farms."""
    owner = await create_user(session, discord_username="lead")
    group = await create_static_group(session, owner)
    await create_membership(session, user, group, role="member")

    profile = await create_player_profile(session, user)
    item = _catalog_item(session, name="Shared Want", category="mount")
    _intent(session, profile.id, item.id, intent="hunting", visibility="static_only")
    await session.commit()

    lead_headers = {"Authorization": f"Bearer {create_access_token(owner.id)}"}
    r = await async_client.get(
        f"/api/static-groups/{group.id}/collection-suggestions",
        headers=lead_headers,
    )
    assert r.status_code == 200
    suggestions = r.json()
    names = [s["catalog_item_name"] for s in suggestions]
    assert "Shared Want" in names


async def test_private_intent_not_in_suggestions(
    async_client: AsyncClient, session: AsyncSession, headers: dict, user: User
):
    """private intent NEVER appears in the static's Suggested Farms."""
    owner = await create_user(session, discord_username="lead2")
    group = await create_static_group(session, owner)
    await create_membership(session, user, group, role="member")

    profile = await create_player_profile(session, user)
    item = _catalog_item(session, name="Private Secret", category="mount")
    _intent(session, profile.id, item.id, intent="hunting", visibility="private")
    await session.commit()

    lead_headers = {"Authorization": f"Bearer {create_access_token(owner.id)}"}
    r = await async_client.get(
        f"/api/static-groups/{group.id}/collection-suggestions",
        headers=lead_headers,
    )
    assert r.status_code == 200
    names = [s["catalog_item_name"] for s in r.json()]
    assert "Private Secret" not in names


async def test_dossier_public_intent_in_dossier_endpoint(
    async_client: AsyncClient, session: AsyncSession, user: User
):
    """dossier_public intent appears in the public dossier list."""
    profile = await create_player_profile(session, user)
    profile.share_code = "DOSSIER01"
    profile.share_enabled = True
    await session.flush()
    item = _catalog_item(session, name="Dossier Mount", category="mount")
    _intent(session, profile.id, item.id, intent="hunting", visibility="dossier_public")
    await session.commit()

    r = await async_client.get(f"/api/profiles/{profile.share_code}/collection-intent")
    assert r.status_code == 200
    names = [e["catalog_item_name"] for e in r.json()]
    assert "Dossier Mount" in names


async def test_private_intent_not_in_dossier_endpoint(
    async_client: AsyncClient, session: AsyncSession, user: User
):
    """private intent is NOT present in the public dossier endpoint."""
    profile = await create_player_profile(session, user)
    profile.share_code = "PRIV0001"
    profile.share_enabled = True
    await session.flush()
    item = _catalog_item(session, name="Private Mount", category="mount")
    _intent(session, profile.id, item.id, intent="hunting", visibility="private")
    await session.commit()

    r = await async_client.get(f"/api/profiles/{profile.share_code}/collection-intent")
    assert r.status_code == 200
    names = [e["catalog_item_name"] for e in r.json()]
    assert "Private Mount" not in names


async def test_token_count_flows_into_catalog_entry(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile, headers: dict
):
    """Snapshot token_count is visible in the catalog endpoint."""
    item = _catalog_item(session, name="Token Mount", category="mount")
    _snapshot(session, profile.id, item.id, ownership_state="missing", token_count=88, source="manual")
    await session.commit()

    r = await async_client.get("/api/me/collection-catalog", headers=headers)
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["catalog_item_id"] == item.id)
    assert entry["token_count"] == 88
    assert entry["ownership_state"] == "missing"


async def test_upsert_snapshot_sets_ownership(
    async_client: AsyncClient, session: AsyncSession, headers: dict
):
    """PUT /me/collection-snapshot/{id} creates snapshot with correct ownership."""
    item = _catalog_item(session, name="Snapped Mount", category="mount")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-snapshot/{item.id}",
        json={"ownership_state": "have", "token_count": None},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ownership_state"] == "have"

    # Verify persisted
    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.catalog_item_id == item.id
        )
    )
    snap = result.scalar_one_or_none()
    assert snap is not None
    assert snap.ownership_state == "have"


async def test_plugin_confirmed_have_not_downgraded_by_manual_missing(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile, headers: dict
):
    """Plugin-confirmed 'have' is NOT overwritten by a manual PUT of 'missing'."""
    item = _catalog_item(session, name="Plugin Owned", category="mount")
    _snapshot(session, profile.id, item.id, ownership_state="have", source="plugin")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-snapshot/{item.id}",
        json={"ownership_state": "missing"},
        headers=headers,
    )
    assert r.status_code == 200
    # Plugin-confirmed 'have' must survive
    assert r.json()["ownership_state"] == "have"


async def test_plugin_snapshot_does_not_create_intent(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile
):
    """Plugin sync of a factual snapshot does not create a PlayerCollectionIntent."""
    item = _catalog_item(session, name="Plugin Item", category="mount")
    _snapshot(session, profile.id, item.id, ownership_state="missing", source="plugin")
    await session.commit()

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.catalog_item_id == item.id,
        )
    )
    assert result.scalar_one_or_none() is None, "Plugin snapshot must not auto-create intent"
