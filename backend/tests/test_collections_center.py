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

import importlib.util
import uuid
from datetime import datetime, timezone
from pathlib import Path

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
    create_player_character,
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
    character_id: str | None = None,
) -> PlayerCollectionSnapshot:
    snap = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        character_id=character_id,
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


async def test_manual_missing_lowers_a_plugin_confirmed_have(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile, headers: dict
):
    """Q1 (owner-accepted, S2a-1): a person's PUT of 'missing' lowers a plugin 'have'.

    This test used to pin the opposite (the Hub refused to lower a plugin Have).
    The person/sync rule (R-S1-7) lets only a person un-mark a Have, until the
    plugin's next sync reports it again.
    """
    item = _catalog_item(session, name="Plugin Owned", category="mount")
    _snapshot(session, profile.id, item.id, ownership_state="have", source="plugin")
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-snapshot/{item.id}",
        json={"ownership_state": "missing"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["ownership_state"] == "missing"
    assert r.json()["source"] == "manual"


async def test_manual_count_is_stored_on_a_plugin_row(
    async_client: AsyncClient, session: AsyncSession, profile: PlayerProfile, headers: dict
):
    """Q1: a count sent to the Hub is the newest write, plugin row or not."""
    item = _catalog_item(session, name="Plugin Count", category="mount")
    _snapshot(
        session, profile.id, item.id, ownership_state="missing", source="plugin", token_count=2,
    )
    await session.commit()

    r = await async_client.put(
        f"/api/me/collection-snapshot/{item.id}",
        json={"ownership_state": "missing", "token_count": 9},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["token_count"] == 9


# ── Records per character (S2a-1a·2 B1, R-S1-11) ──────────────────────────────

async def _snapshot_rows(
    session: AsyncSession, profile: PlayerProfile
) -> list[PlayerCollectionSnapshot]:
    """Every snapshot row of the profile, read back from the database."""
    result = await session.execute(
        select(PlayerCollectionSnapshot)
        .where(PlayerCollectionSnapshot.profile_id == profile.id)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


@pytest_asyncio.fixture
async def main_and_alt(session: AsyncSession, profile: PlayerProfile):
    main = await create_player_character(session, profile, name="Main Char", is_main=True)
    alt = await create_player_character(session, profile, name="Alt Char", is_main=False)
    return main, alt


def _put(client: AsyncClient, item, headers: dict, body: dict, character_id: str | None = None):
    url = f"/api/me/collection-snapshot/{item.id}"
    if character_id is not None:
        url += f"?character_id={character_id}"
    return client.put(url, json=body, headers=headers)


async def test_put_without_a_character_writes_the_mains_row(
    async_client: AsyncClient, session: AsyncSession, profile, headers, main_and_alt
):
    main, alt = main_and_alt
    item = _catalog_item(session, name="Mount M")
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have"})

    assert r.status_code == 200, r.text
    assert r.json()["character_id"] == main.id
    rows = await _snapshot_rows(session, profile)
    assert [(row.character_id, row.ownership_state) for row in rows] == [(main.id, "have")]


async def test_put_with_the_alts_id_writes_the_alts_row_and_leaves_the_mains(
    async_client: AsyncClient, session: AsyncSession, profile, headers, main_and_alt
):
    main, alt = main_and_alt
    item = _catalog_item(session, name="Mount A")
    _snapshot(
        session, profile.id, item.id, ownership_state="have", source="manual", character_id=main.id,
    )
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "missing"}, alt.id)

    assert r.status_code == 200, r.text
    assert r.json()["character_id"] == alt.id
    by_character = {row.character_id: row for row in await _snapshot_rows(session, profile)}
    assert by_character[alt.id].ownership_state == "missing"
    assert by_character[main.id].ownership_state == "have"  # untouched
    assert len(by_character) == 2


async def test_put_with_another_users_character_is_404_and_writes_nothing(
    async_client: AsyncClient, session: AsyncSession, profile, headers, other_user, main_and_alt
):
    """R-S1-16: the row stays CALLER_SCOPED; the character must be the caller's."""
    other_profile = await create_player_profile(session, other_user)
    theirs = await create_player_character(session, other_profile, name="Theirs", is_main=True)
    item = _catalog_item(session, name="Mount X")
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have"}, theirs.id)

    assert r.status_code == 404
    assert r.json()["detail"] == "Character not found"
    assert await _snapshot_rows(session, profile) == []
    assert await _snapshot_rows(session, other_profile) == []


async def test_put_with_an_unknown_character_is_404_even_with_no_profile(
    async_client: AsyncClient, session: AsyncSession, headers
):
    item = _catalog_item(session, name="Mount N")
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have"}, str(uuid.uuid4()))

    assert r.status_code == 404
    count = await session.execute(select(PlayerCollectionSnapshot))
    assert count.scalars().all() == []


async def test_put_with_no_character_on_file_writes_the_profile_level_row(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    item = _catalog_item(session, name="Mount P")
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have"})

    assert r.status_code == 200, r.text
    assert r.json()["character_id"] is None
    rows = await _snapshot_rows(session, profile)
    assert [(row.character_id, row.ownership_state) for row in rows] == [(None, "have")]


async def test_put_records_who_wrote_and_when_the_state_changed(
    async_client: AsyncClient, session: AsyncSession, user, profile, headers, main_and_alt
):
    item = _catalog_item(session, name="Mount W")
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have", "token_count": 3})

    assert r.status_code == 200, r.text
    (row,) = await _snapshot_rows(session, profile)
    assert row.updated_by_user_id == user.id
    assert row.updated_via == "web"
    assert row.state_changed_at == row.updated_at
    assert row.token_count_updated_at == row.updated_at
    assert (row.source, row.confidence) == ("manual", "medium")


async def test_a_have_put_over_a_plugin_have_relabels_it_manual_medium(
    async_client: AsyncClient, session: AsyncSession, profile, headers, main_and_alt
):
    """M5 at the Hub: the same relabel today's route does on every `have` write."""
    main, _ = main_and_alt
    item = _catalog_item(session, name="Mount R")
    _snapshot(
        session, profile.id, item.id, ownership_state="have", source="plugin", character_id=main.id,
    )
    await session.commit()

    r = await _put(async_client, item, headers, {"ownership_state": "have"})

    assert r.status_code == 200, r.text
    assert (r.json()["ownership_state"], r.json()["source"], r.json()["confidence"]) == (
        "have", "manual", "medium",
    )


async def test_gets_return_the_default_mains_values_and_the_picked_characters(
    async_client: AsyncClient, session: AsyncSession, profile, headers, main_and_alt
):
    main, alt = main_and_alt
    item = _catalog_item(session, name="Mount G")
    _snapshot(
        session, profile.id, item.id,
        ownership_state="have",
        source="plugin",
        token_count=11,
        character_id=main.id,
    )
    _snapshot(
        session, profile.id, item.id,
        ownership_state="missing",
        source="manual",
        token_count=4,
        character_id=alt.id,
    )
    await session.commit()

    async def catalog(query: str = "") -> dict:
        r = await async_client.get(f"/api/me/collection-catalog{query}", headers=headers)
        assert r.status_code == 200, r.text
        return next(e for e in r.json() if e["catalog_item_id"] == item.id)

    async def snapshots(query: str = "") -> list[dict]:
        r = await async_client.get(f"/api/me/collection-snapshots{query}", headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    default = await catalog()
    assert (default["ownership_state"], default["token_count"]) == ("have", 11)
    picked = await catalog(f"?character_id={alt.id}")
    assert (picked["ownership_state"], picked["token_count"]) == ("missing", 4)

    (mains,) = await snapshots()
    assert (mains["character_id"], mains["ownership_state"]) == (main.id, "have")
    (alts,) = await snapshots(f"?character_id={alt.id}")
    assert (alts["character_id"], alts["ownership_state"]) == (alt.id, "missing")


async def test_gets_with_another_users_character_are_404(
    async_client: AsyncClient, session: AsyncSession, profile, headers, other_user, main_and_alt
):
    other_profile = await create_player_profile(session, other_user)
    theirs = await create_player_character(session, other_profile, name="Theirs", is_main=True)
    _catalog_item(session, name="Mount Z")
    await session.commit()

    for path in ("/api/me/collection-catalog", "/api/me/collection-snapshots"):
        r = await async_client.get(f"{path}?character_id={theirs.id}", headers=headers)
        assert r.status_code == 404, path
        assert r.json()["detail"] == "Character not found"


async def test_a_main_with_only_a_profile_level_row_serves_it_and_the_put_adopts_it(
    async_client: AsyncClient, session: AsyncSession, profile, headers, main_and_alt
):
    """vet I-5: an un-backfilled dev DB still shows Profile > Collections."""
    main, _ = main_and_alt
    item = _catalog_item(session, name="Mount F")
    _snapshot(session, profile.id, item.id, ownership_state="have", source="plugin", token_count=6)
    await session.commit()

    catalog = await async_client.get("/api/me/collection-catalog", headers=headers)
    entry = next(e for e in catalog.json() if e["catalog_item_id"] == item.id)
    assert (entry["ownership_state"], entry["token_count"]) == ("have", 6)
    snapshots = await async_client.get("/api/me/collection-snapshots", headers=headers)
    assert [(s["ownership_state"], s["token_count"]) for s in snapshots.json()] == [("have", 6)]

    r = await _put(async_client, item, headers, {"ownership_state": "missing"})

    assert r.status_code == 200, r.text
    rows = await _snapshot_rows(session, profile)
    assert [(row.character_id, row.ownership_state) for row in rows] == [(main.id, "missing")]


async def test_the_catalog_reads_the_same_before_and_after_the_character_backfill(
    async_client: AsyncClient, session: AsyncSession, engine, profile, headers, main_and_alt
):
    """(b) survives: the migration's backfill moves rows to the main without changing the view."""
    main, _ = main_and_alt
    have = _catalog_item(session, name="Mount B1")
    counted = _catalog_item(session, name="Mount B2")
    _snapshot(session, profile.id, have.id, ownership_state="have", source="plugin")
    _snapshot(
        session, profile.id, counted.id, ownership_state="missing", source="manual", token_count=7,
    )
    await session.commit()

    before = (await async_client.get("/api/me/collection-catalog", headers=headers)).json()
    spec = importlib.util.spec_from_file_location(
        "s2a1_backfill_for_center",
        Path(__file__).resolve().parent.parent
        / "alembic" / "versions" / "n7o8p9q0r1s2_add_character_records.py",
    )
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    async with engine.begin() as conn:
        given = await conn.run_sync(migration._backfill_snapshot_characters)
    assert given == 2
    session.expire_all()
    after = (await async_client.get("/api/me/collection-catalog", headers=headers)).json()

    assert after == before
    assert {row.character_id for row in await _snapshot_rows(session, profile)} == {main.id}


# ── Adoption and unlink (R-S1-6, Q4) ──────────────────────────────────────────

_LINK = {
    "lodestoneId": "55501",
    "name": "First Char",
    "server": "Gilgamesh",
    "dataCenter": "Aether",
}
_GEAR_SYNC = {
    "characterName": "Plugin Char",
    "characterWorld": "Gilgamesh",
    "job": "WHM",
    "gear": [{
        "slot": "weapon", "hasItem": True, "currentSource": "savage",
        "isAugmented": False, "itemId": 100001, "itemName": "W",
        "itemLevel": 730, "itemIcon": None, "materia": [],
    }],
    "source": "plugin",
}


async def test_link_character_adopts_the_profile_level_rows(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    item = _catalog_item(session, name="Mount L")
    _snapshot(session, profile.id, item.id, ownership_state="have", source="plugin", token_count=5)
    await session.commit()

    r = await async_client.post("/api/player/characters", json=_LINK, headers=headers)

    assert r.status_code == 201, r.text
    (row,) = await _snapshot_rows(session, profile)
    assert (row.character_id, row.ownership_state, row.token_count) == (r.json()["id"], "have", 5)
    catalog = await async_client.get("/api/me/collection-catalog", headers=headers)
    entry = next(e for e in catalog.json() if e["catalog_item_id"] == item.id)
    assert (entry["ownership_state"], entry["token_count"]) == ("have", 5)


async def test_plugin_provisioning_adopts_the_profile_level_rows(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    item = _catalog_item(session, name="Mount PP")
    _snapshot(session, profile.id, item.id, ownership_state="have", source="plugin", token_count=2)
    await session.commit()

    r = await async_client.post("/api/plugin/player/gear-sync", json=_GEAR_SYNC, headers=headers)

    assert r.status_code == 200, r.text
    (row,) = await _snapshot_rows(session, profile)
    assert row.character_id == r.json()["characterId"]
    assert (row.ownership_state, row.token_count) == ("have", 2)


async def test_a_second_character_does_not_take_the_first_ones_rows(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    """Adoption is for a profile with no character; a later alt starts empty."""
    first = await async_client.post("/api/player/characters", json=_LINK, headers=headers)
    assert first.status_code == 201, first.text
    item = _catalog_item(session, name="Mount S")
    await session.commit()
    put = await _put(async_client, item, headers, {"ownership_state": "have"})
    assert put.status_code == 200, put.text

    synced = await async_client.post(
        "/api/plugin/player/gear-sync", json=_GEAR_SYNC, headers=headers
    )

    assert synced.status_code == 200, synced.text
    assert synced.json()["characterId"] != first.json()["id"]
    (row,) = await _snapshot_rows(session, profile)
    assert row.character_id == first.json()["id"]


async def _two_characters_with_rows(session, profile):
    """Main and alt, each holding rows for A (main: have, alt: missing) and B (alt only)."""
    main = await create_player_character(session, profile, name="Main Char", is_main=True)
    alt = await create_player_character(session, profile, name="Alt Char", is_main=False)
    a = _catalog_item(session, name="Mount UA")
    b = _catalog_item(session, name="Mount UB")
    _snapshot(
        session, profile.id, a.id, ownership_state="have", source="manual", character_id=main.id,
    )
    _snapshot(
        session, profile.id, a.id, ownership_state="missing", source="manual", character_id=alt.id,
    )
    _snapshot(
        session, profile.id, b.id, ownership_state="have", source="manual", character_id=alt.id,
    )
    await session.commit()
    return main, alt


async def test_unlinking_an_alt_deletes_its_rows_and_keeps_the_mains(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    """vet I-1: SQLite enforces no FKs here, so only the explicit delete passes."""
    main, alt = await _two_characters_with_rows(session, profile)

    r = await async_client.delete(f"/api/player/characters/{alt.id}", headers=headers)

    assert r.status_code == 204, r.text
    rows = await _snapshot_rows(session, profile)
    assert [(row.character_id, row.ownership_state) for row in rows] == [(main.id, "have")]


async def test_unlinking_the_main_of_a_profile_with_an_alt_deletes_the_mains_rows(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    main, alt = await _two_characters_with_rows(session, profile)

    r = await async_client.delete(f"/api/player/characters/{main.id}", headers=headers)

    assert r.status_code == 204, r.text
    rows = await _snapshot_rows(session, profile)
    assert {row.character_id for row in rows} == {alt.id}
    assert len(rows) == 2


async def test_unlinking_the_last_character_turns_its_rows_profile_level(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    only = await create_player_character(session, profile, name="Only Char", is_main=True)
    item = _catalog_item(session, name="Mount UL")
    _snapshot(
        session, profile.id, item.id,
        ownership_state="have",
        source="manual",
        token_count=3,
        character_id=only.id,
    )
    await session.commit()

    r = await async_client.delete(f"/api/player/characters/{only.id}", headers=headers)

    assert r.status_code == 204, r.text
    (row,) = await _snapshot_rows(session, profile)
    assert (row.character_id, row.ownership_state, row.token_count) == (None, "have", 3)
    catalog = await async_client.get("/api/me/collection-catalog", headers=headers)
    entry = next(e for e in catalog.json() if e["catalog_item_id"] == item.id)
    assert entry["ownership_state"] == "have"


async def test_unlinking_the_last_character_over_a_stray_profile_level_row_keeps_the_characters(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    only = await create_player_character(session, profile, name="Only Char", is_main=True)
    item = _catalog_item(session, name="Mount US")
    _snapshot(
        session, profile.id, item.id, ownership_state="have", source="manual", character_id=only.id,
    )
    _snapshot(session, profile.id, item.id, ownership_state="missing", source="manual")
    await session.commit()

    r = await async_client.delete(f"/api/player/characters/{only.id}", headers=headers)

    assert r.status_code == 204, r.text
    (row,) = await _snapshot_rows(session, profile)
    assert (row.character_id, row.ownership_state) == (None, "have")  # the character's wins


async def test_unlink_then_relink_keeps_the_collection(
    async_client: AsyncClient, session: AsyncSession, profile, headers
):
    only = await create_player_character(session, profile, name="Only Char", is_main=True)
    item = _catalog_item(session, name="Mount UR")
    _snapshot(
        session, profile.id, item.id, ownership_state="have", source="manual", character_id=only.id,
    )
    await session.commit()

    await async_client.delete(f"/api/player/characters/{only.id}", headers=headers)
    relinked = await async_client.post("/api/player/characters", json=_LINK, headers=headers)

    assert relinked.status_code == 201, relinked.text
    (row,) = await _snapshot_rows(session, profile)
    assert (row.character_id, row.ownership_state) == (relinked.json()["id"], "have")


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
