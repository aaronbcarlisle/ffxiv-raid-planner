"""Tests for POST /api/plugin/player/batch-gear-sync.

Verifies:
- Multi-job upsert from one call.
- Freshness: synced_at only updates on change; last_plugin_seen_at always.
- Empty gearsets are skipped, not stored.
- Jobs absent from payload are not touched.
- Duplicate jobs in payload (shouldn't happen after plugin dedup, but handled).
- Unknown character returns 404.
- Old single-job endpoint still works alongside this one.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player_character import PlayerCharacter
from app.models.player_gear_snapshot import PlayerGearSnapshot
from app.models.player_profile import PlayerProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_character(client: AsyncClient, session: AsyncSession, headers: dict) -> str:
    """Create profile + character, return character ID."""
    await client.get("/api/player/profile", headers=headers)
    result = await session.execute(select(PlayerProfile))
    profile = result.scalars().first()

    now = datetime.now(timezone.utc).isoformat()
    char = PlayerCharacter(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        lodestone_id=str(uuid.uuid4())[:8],
        name="Batch Tester",
        server="Gilgamesh",
        is_main=True,
        created_at=now,
        updated_at=now,
    )
    session.add(char)
    await session.commit()
    return char.id


def _slot(slot: str = "weapon", item_level: int = 730, item_name: str = "Test Weapon", item_id: int = 100001) -> dict:
    return {
        "slot": slot,
        "hasItem": True,
        "currentSource": "savage",
        "isAugmented": False,
        "itemId": item_id,
        "itemName": item_name,
        "itemLevel": item_level,
        "itemIcon": None,
        "materia": [],
    }


def _gearset(job: str, item_level: int = 730, gearset_index: int = 0, item_name: str = "Test Weapon") -> dict:
    return {
        "gearsetIndex": gearset_index,
        "gearsetName": f"{job} Raid",
        "job": job,
        "classJobId": 23,
        "gear": [_slot(item_level=item_level, item_name=item_name)],
    }


def _batch_payload(gearsets: list[dict]) -> dict:
    return {
        "characterName": "Batch Tester",
        "characterWorld": "Gilgamesh",
        "gearsets": gearsets,
        "source": "plugin",
        "pluginVersion": "1.0.0",
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestPluginBatchGearsetSync:

    async def test_multi_job_upsert(self, client, session, auth_headers):
        """Two different jobs in one call both get snapshots created."""
        await _setup_character(client, session, auth_headers)

        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD"), _gearset("DRG")]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["totalSynced"] == 2
        assert len(data["syncedJobs"]) == 2
        jobs = {j["job"] for j in data["syncedJobs"]}
        assert "BRD" in jobs
        assert "DRG" in jobs
        for j in data["syncedJobs"]:
            assert j["gearChanged"] is True

    async def test_identical_payload_no_synced_at_change(self, client, session, auth_headers):
        """Identical payload: gearChanged=False, last_plugin_seen_at still updates."""
        char_id = await _setup_character(client, session, auth_headers)

        r1 = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD")]),
        )
        assert r1.status_code == 200

        result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char_id,
                PlayerGearSnapshot.job == "BRD",
            )
        )
        snap = result.scalar_one()
        first_synced_at = snap.synced_at
        first_seen = snap.last_plugin_seen_at

        r2 = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD")]),
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data["syncedJobs"][0]["gearChanged"] is False

        await session.refresh(snap)
        assert snap.synced_at == first_synced_at
        assert snap.last_plugin_seen_at >= first_seen

    async def test_changed_payload_updates_synced_at(self, client, session, auth_headers):
        """Changed item level causes synced_at to advance."""
        char_id = await _setup_character(client, session, auth_headers)

        await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD", item_level=720)]),
        )

        result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char_id,
                PlayerGearSnapshot.job == "BRD",
            )
        )
        snap = result.scalar_one()
        first_synced_at = snap.synced_at

        await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD", item_level=730)]),
        )
        await session.refresh(snap)
        assert snap.synced_at > first_synced_at

    async def test_empty_gearset_skipped(self, client, session, auth_headers):
        """Gearset with no actual items is skipped (not upserted)."""
        char_id = await _setup_character(client, session, auth_headers)

        empty_gearset = {
            "gearsetIndex": 0,
            "gearsetName": "Empty",
            "job": "BRD",
            "classJobId": 23,
            "gear": [
                {
                    "slot": "weapon",
                    "hasItem": False,
                    "currentSource": "unknown",
                    "isAugmented": False,
                    "itemId": None,
                    "itemName": None,
                    "itemLevel": 0,
                    "itemIcon": None,
                    "materia": [],
                }
            ],
        }
        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([empty_gearset]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["totalSynced"] == 0

        result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char_id,
                PlayerGearSnapshot.job == "BRD",
            )
        )
        assert result.scalar_one_or_none() is None

    async def test_absent_job_not_touched(self, client, session, auth_headers):
        """Jobs absent from the payload keep their existing snapshot unchanged."""
        char_id = await _setup_character(client, session, auth_headers)

        # Create a DRG snapshot via the old single-job endpoint
        await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Batch Tester",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [_slot(item_level=725, item_name="Lance")],
                "source": "plugin",
            },
        )

        result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char_id,
                PlayerGearSnapshot.job == "DRG",
            )
        )
        drg_snap = result.scalar_one()
        drg_synced_before = drg_snap.synced_at
        drg_seen_before = drg_snap.last_plugin_seen_at

        # Batch sync only BRD — DRG is not in the payload
        await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD")]),
        )

        await session.refresh(drg_snap)
        assert drg_snap.synced_at == drg_synced_before
        assert drg_snap.last_plugin_seen_at == drg_seen_before

    async def test_unknown_character_returns_404(self, client, session, auth_headers):
        """Character not linked to the user returns 404."""
        await client.get("/api/player/profile", headers=auth_headers)

        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Nobody Here",
                "characterWorld": "Ultros",
                "gearsets": [_gearset("BRD")],
                "source": "plugin",
            },
        )
        assert r.status_code == 404

    async def test_empty_gearsets_list_rejected(self, client, session, auth_headers):
        """Empty gearsets array returns 422."""
        await _setup_character(client, session, auth_headers)

        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([]),
        )
        assert r.status_code == 422

    async def test_old_single_job_endpoint_still_works(self, client, session, auth_headers):
        """The original /gear-sync endpoint still functions correctly."""
        await _setup_character(client, session, auth_headers)

        r = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Batch Tester",
                "characterWorld": "Gilgamesh",
                "job": "BRD",
                "gear": [_slot(item_level=730)],
                "source": "plugin",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["job"] == "BRD"
        assert data["gearChanged"] is True

    async def test_null_item_level_accepted(self, client, session, auth_headers):
        """Plugin sends itemLevel: null for empty slots — backend must accept it (not 422)."""
        await _setup_character(client, session, auth_headers)

        full_gearset = {
            "gearsetIndex": 0,
            "gearsetName": "BRD with empty slots",
            "job": "BRD",
            "classJobId": 23,
            "gear": [
                # Equipped slot — has all fields
                _slot("weapon", item_level=730, item_name="Skyruin Harp Bow", item_id=44185),
                # Empty slots — plugin sends itemLevel: null
                # Empty slots — plugin sends itemLevel: null AND materia: null
                {"slot": "head", "hasItem": False, "currentSource": "unknown",
                 "isAugmented": False, "itemId": None, "itemName": None, "itemLevel": None,
                 "itemIcon": None, "materia": None},
                {"slot": "body", "hasItem": False, "currentSource": "unknown",
                 "isAugmented": False, "itemId": None, "itemName": None, "itemLevel": None,
                 "itemIcon": None, "materia": None},
            ],
        }
        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([full_gearset]),
        )
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.text}"
        data = r.json()
        assert data["totalSynced"] == 1
        assert data["syncedJobs"][0]["job"] == "BRD"
        assert data["syncedJobs"][0]["gearChanged"] is True

    async def test_total_unchanged_count(self, client, session, auth_headers):
        """totalUnchanged reflects jobs where gear was identical."""
        await _setup_character(client, session, auth_headers)

        # First sync
        await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD"), _gearset("DRG")]),
        )

        # Second sync: BRD same, DRG different
        r = await client.post(
            "/api/plugin/player/batch-gear-sync",
            headers=auth_headers,
            json=_batch_payload([_gearset("BRD"), _gearset("DRG", item_level=735)]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["totalSynced"] == 2
        assert data["totalUnchanged"] == 1
        brd_result = next(j for j in data["syncedJobs"] if j["job"] == "BRD")
        drg_result = next(j for j in data["syncedJobs"] if j["job"] == "DRG")
        assert brd_result["gearChanged"] is False
        assert drg_result["gearChanged"] is True
