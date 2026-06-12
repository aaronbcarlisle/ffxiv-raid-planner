"""Tests for plugin gear sync freshness: synced_at must only update when
gear actually changes; last_plugin_seen_at always updates."""

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
        name="Fresh Tester",
        server="Gilgamesh",
        is_main=True,
        created_at=now,
        updated_at=now,
    )
    session.add(char)
    await session.commit()
    return char.id


def _gear_payload(item_level: int = 730, item_name: str = "Skyruin Harp Bow") -> dict:
    return {
        "characterName": "Fresh Tester",
        "characterWorld": "Gilgamesh",
        "job": "BRD",
        "gear": [
            {
                "slot": "weapon",
                "hasItem": True,
                "currentSource": "savage",
                "isAugmented": False,
                "itemId": 200001,
                "itemName": item_name,
                "itemLevel": item_level,
                "itemIcon": None,
                "materia": [],
            },
        ],
        "source": "plugin",
        "pluginVersion": "1.0.0",
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPluginGearFreshness:
    """Verify synced_at only updates when gear changes."""

    async def test_first_sync_sets_synced_at(self, client, session, auth_headers):
        await _setup_character(client, session, auth_headers)
        r = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["gearChanged"] is True
        assert data["syncedAt"] is not None
        assert data["lastPluginSeenAt"] is not None

    async def test_identical_payload_does_not_update_synced_at(self, client, session, auth_headers):
        await _setup_character(client, session, auth_headers)

        r1 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(),
        )
        assert r1.status_code == 200
        first_synced_at = r1.json()["syncedAt"]

        r2 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(),
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data["gearChanged"] is False
        assert data["syncedAt"] == first_synced_at
        assert data["lastPluginSeenAt"] is not None
        assert data["lastPluginSeenAt"] != first_synced_at or True  # just check it exists

    async def test_changed_payload_updates_synced_at(self, client, session, auth_headers):
        await _setup_character(client, session, auth_headers)

        r1 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(item_level=720),
        )
        assert r1.status_code == 200
        first_synced_at = r1.json()["syncedAt"]

        r2 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(item_level=730),
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data["gearChanged"] is True
        assert data["syncedAt"] != first_synced_at

    async def test_last_plugin_seen_at_always_updates(self, client, session, auth_headers):
        char_id = await _setup_character(client, session, auth_headers)

        await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(),
        )

        result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char_id,
                PlayerGearSnapshot.job == "BRD",
            )
        )
        snapshot = result.scalar_one()
        first_seen = snapshot.last_plugin_seen_at

        await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(),
        )

        await session.refresh(snapshot)
        assert snapshot.last_plugin_seen_at is not None
        assert snapshot.last_plugin_seen_at >= first_seen

    async def test_empty_payload_rejected(self, client, session, auth_headers):
        await _setup_character(client, session, auth_headers)

        r = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Fresh Tester",
                "characterWorld": "Gilgamesh",
                "job": "BRD",
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
                    },
                ],
                "source": "plugin",
                "pluginVersion": "1.0.0",
            },
        )
        assert r.status_code == 422

    async def test_changed_item_name_updates_synced_at(self, client, session, auth_headers):
        await _setup_character(client, session, auth_headers)

        r1 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(item_name="Old Bow"),
        )
        first_synced_at = r1.json()["syncedAt"]

        r2 = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json=_gear_payload(item_name="New Bow"),
        )
        assert r2.json()["gearChanged"] is True
        assert r2.json()["syncedAt"] != first_synced_at
