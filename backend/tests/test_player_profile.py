"""Tests for the solo player profile, character linking, gear snapshots, and job profiles."""

from sqlalchemy import select

import pytest
import pytest_asyncio

from app.models import User
from app.models.player_gear_snapshot import PlayerGearSnapshot


@pytest.mark.asyncio
class TestPlayerProfile:
    """Tests for GET/PUT /api/player/profile."""

    async def test_get_profile_creates_if_missing(self, client, auth_headers):
        """First GET auto-creates a profile with private visibility."""
        response = await client.get("/api/player/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["visibility"] == "private"
        assert data["bio"] is None
        assert data["characters"] == []
        assert data["jobProfiles"] == []

    async def test_get_profile_idempotent(self, client, auth_headers):
        """Multiple GETs return the same profile."""
        r1 = await client.get("/api/player/profile", headers=auth_headers)
        r2 = await client.get("/api/player/profile", headers=auth_headers)
        assert r1.json()["id"] == r2.json()["id"]

    async def test_update_profile_visibility(self, client, auth_headers):
        """Can update visibility to shareable."""
        await client.get("/api/player/profile", headers=auth_headers)
        response = await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "shareable"},
        )
        assert response.status_code == 200
        assert response.json()["visibility"] == "shareable"

    async def test_update_profile_bio(self, client, auth_headers):
        """Can update bio."""
        await client.get("/api/player/profile", headers=auth_headers)
        response = await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"bio": "DNC main, looking for a static!"},
        )
        assert response.status_code == 200
        assert response.json()["bio"] == "DNC main, looking for a static!"

    async def test_update_profile_invalid_visibility(self, client, auth_headers):
        """Rejects invalid visibility values."""
        await client.get("/api/player/profile", headers=auth_headers)
        response = await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "public_marketplace"},
        )
        assert response.status_code == 400

    async def test_profile_requires_auth(self, client):
        """Profile endpoints require authentication."""
        response = await client.get("/api/player/profile")
        assert response.status_code == 401


@pytest.mark.asyncio
class TestPlayerCharacter:
    """Tests for character linking endpoints."""

    async def test_link_character(self, client, auth_headers):
        """Can link a new character."""
        response = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
                "dataCenter": "Aether",
                "isMain": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Character"
        assert data["server"] == "Gilgamesh"
        assert data["isMain"] is True

    async def test_list_characters(self, client, auth_headers):
        """Can list linked characters."""
        await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        response = await client.get("/api/player/characters", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 1

    async def test_duplicate_character_rejected(self, client, auth_headers):
        """Cannot link the same character twice."""
        payload = {
            "lodestoneId": "12345",
            "name": "Test Character",
            "server": "Gilgamesh",
        }
        await client.post("/api/player/characters", headers=auth_headers, json=payload)
        response = await client.post(
            "/api/player/characters", headers=auth_headers, json=payload
        )
        assert response.status_code == 409

    async def test_link_adopts_plugin_provisioned_character(self, client, auth_headers):
        """Website link adopts a plugin-provisioned character (same name + world,
        no Lodestone id yet) instead of creating a duplicate."""
        # Plugin auto-provisions a character via a gear sync (no prior link).
        sync = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Dupe Guard",
                "characterWorld": "Gilgamesh",
                "job": "WHM",
                "gear": [{
                    "slot": "weapon", "hasItem": True, "currentSource": "savage",
                    "isAugmented": False, "itemId": 100001, "itemName": "W",
                    "itemLevel": 730, "itemIcon": None, "materia": [],
                }],
                "source": "plugin",
            },
        )
        assert sync.status_code == 200, sync.text

        # Website link with the real Lodestone id for the same character.
        link = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "99999",
                "name": "Dupe Guard",
                "server": "Gilgamesh",
                "dataCenter": "Aether",
                "isMain": True,
            },
        )
        assert link.status_code == 201, link.text

        # Exactly one character, now carrying the verified Lodestone id.
        chars = (await client.get("/api/player/characters", headers=auth_headers)).json()
        assert len(chars) == 1
        assert chars[0]["lodestoneId"] == "99999"

    async def test_set_main_character(self, client, auth_headers):
        """Setting a new character as main unsets the previous main."""
        r1 = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "111",
                "name": "Char One",
                "server": "Gilgamesh",
                "isMain": True,
            },
        )
        r2 = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "222",
                "name": "Char Two",
                "server": "Gilgamesh",
                "isMain": True,
            },
        )
        assert r2.status_code == 201
        assert r2.json()["isMain"] is True

        chars = (await client.get("/api/player/characters", headers=auth_headers)).json()
        mains = [c for c in chars if c["isMain"]]
        assert len(mains) == 1
        assert mains[0]["name"] == "Char Two"

    async def test_unlink_character(self, client, auth_headers):
        """Can unlink a character."""
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]
        response = await client.delete(
            f"/api/player/characters/{char_id}", headers=auth_headers
        )
        assert response.status_code == 204

        chars = (await client.get("/api/player/characters", headers=auth_headers)).json()
        assert len(chars) == 0

    async def test_cannot_access_other_users_character(
        self, client, auth_headers, auth_headers_user2
    ):
        """User 2 cannot access User 1's character."""
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]

        # User 2 tries to update User 1's character
        response = await client.put(
            f"/api/player/characters/{char_id}",
            headers=auth_headers_user2,
            json={"isMain": False},
        )
        assert response.status_code == 404

    async def test_update_character(self, client, auth_headers):
        """Can update character details."""
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Old Name",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]
        response = await client.put(
            f"/api/player/characters/{char_id}",
            headers=auth_headers,
            json={"name": "New Name", "dataCenter": "Aether"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"
        assert response.json()["dataCenter"] == "Aether"


@pytest.mark.asyncio
class TestPlayerJobProfile:
    """Tests for job profile CRUD."""

    async def test_create_job_profile(self, client, auth_headers):
        """Can create a job profile."""
        response = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={
                "job": "DNC",
                "role": "ranged",
                "priority": "main",
                "readiness": "ready",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["job"] == "DNC"
        assert data["role"] == "ranged"
        assert data["priority"] == "main"
        assert data["readiness"] == "ready"

    async def test_list_job_profiles(self, client, auth_headers):
        """Can list job profiles."""
        await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "priority": "main"},
        )
        await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "BRD", "role": "ranged", "priority": "preferred_alt"},
        )
        response = await client.get("/api/player/jobs", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_duplicate_job_rejected(self, client, auth_headers):
        """Cannot create two profiles for the same job."""
        payload = {"job": "DNC", "role": "ranged"}
        await client.post("/api/player/jobs", headers=auth_headers, json=payload)
        response = await client.post(
            "/api/player/jobs", headers=auth_headers, json=payload
        )
        assert response.status_code == 409

    async def test_main_uniqueness(self, client, auth_headers):
        """Only one job can be main — setting a new main demotes the previous."""
        await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "priority": "main"},
        )
        await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "BRD", "role": "ranged", "priority": "main"},
        )
        jobs = (await client.get("/api/player/jobs", headers=auth_headers)).json()
        mains = [j for j in jobs if j["priority"] == "main"]
        assert len(mains) == 1
        assert mains[0]["job"] == "BRD"

    async def test_update_job_profile(self, client, auth_headers):
        """Can update priority and readiness."""
        r = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "priority": "flex"},
        )
        job_id = r.json()["id"]
        response = await client.put(
            f"/api/player/jobs/{job_id}",
            headers=auth_headers,
            json={"priority": "main", "readiness": "ready", "notes": "Best DNC NA"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["priority"] == "main"
        assert data["readiness"] == "ready"
        assert data["notes"] == "Best DNC NA"

    async def test_delete_job_profile(self, client, auth_headers):
        """Can delete a job profile."""
        r = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged"},
        )
        job_id = r.json()["id"]
        response = await client.delete(
            f"/api/player/jobs/{job_id}", headers=auth_headers
        )
        assert response.status_code == 204

        jobs = (await client.get("/api/player/jobs", headers=auth_headers)).json()
        assert len(jobs) == 0

    async def test_invalid_job_rejected(self, client, auth_headers):
        """Rejects invalid job abbreviations."""
        response = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "ZZZ", "role": "tank"},
        )
        assert response.status_code == 400

    async def test_invalid_role_rejected(self, client, auth_headers):
        """Rejects invalid role values."""
        response = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "dps"},
        )
        assert response.status_code == 400

    async def test_invalid_priority_rejected(self, client, auth_headers):
        """Rejects invalid priority values."""
        response = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "priority": "super_main"},
        )
        assert response.status_code == 400

    async def test_invalid_readiness_rejected(self, client, auth_headers):
        """Rejects invalid readiness values."""
        response = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "readiness": "amazing"},
        )
        assert response.status_code == 400

    async def test_cannot_access_other_users_job(
        self, client, auth_headers, auth_headers_user2
    ):
        """User 2 cannot update User 1's job profile."""
        r = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged"},
        )
        job_id = r.json()["id"]

        response = await client.put(
            f"/api/player/jobs/{job_id}",
            headers=auth_headers_user2,
            json={"priority": "main"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestGearSnapshots:
    """Tests for gear snapshot endpoints."""

    async def test_list_gear_snapshots_empty(self, client, auth_headers):
        """Returns empty list when no snapshots exist."""
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]
        response = await client.get(
            f"/api/player/characters/{char_id}/gear", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_cannot_access_other_users_gear(
        self, client, auth_headers, auth_headers_user2
    ):
        """User 2 cannot access User 1's gear snapshots."""
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]
        response = await client.get(
            f"/api/player/characters/{char_id}/gear",
            headers=auth_headers_user2,
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestPluginPlayerGearSync:
    """Tests for POST /api/plugin/player/gear-sync."""

    async def test_plugin_sync_unlinked_character_auto_provisions(self, client, auth_headers):
        """An unlinked in-game character is auto-provisioned on first sync."""
        response = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Unknown Character",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [{
                    "slot": "weapon", "hasItem": True, "currentSource": "savage",
                    "isAugmented": False, "itemId": 100001, "itemName": "Lance",
                    "itemLevel": 730, "itemIcon": None, "materia": [],
                }],
            },
        )
        assert response.status_code == 200, response.text

        chars = (await client.get("/api/player/characters", headers=auth_headers)).json()
        assert any(c["name"] == "Unknown Character" for c in chars)

    async def test_plugin_sync_empty_gear_returns_422(self, client, auth_headers):
        """Empty gear payload is rejected even though the character is provisioned."""
        response = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Empty Gear Guy",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [],
            },
        )
        assert response.status_code == 422

    async def test_plugin_sync_creates_snapshot(self, client, auth_headers):
        """Plugin sync creates a gear snapshot for a linked character."""
        # Link character first
        await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )

        # Sync gear
        response = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [
                    {
                        "slot": "weapon",
                        "hasItem": True,
                        "currentSource": "savage",
                        "itemId": 200001,
                        "itemName": "Cruiserweight Champion's Spear",
                        "itemLevel": 795,
                    },
                    {
                        "slot": "head",
                        "hasItem": True,
                        "currentSource": "tome_up",
                        "itemId": 200002,
                        "itemName": "Aug. Quetzalli Helm",
                        "itemLevel": 790,
                    },
                ],
                "source": "plugin",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job"] == "DRG"
        assert data["source"] == "plugin"
        assert data["slotCount"] == 2

    async def test_plugin_sync_rejects_empty_payload_without_updating_timestamp(
        self, client, session, auth_headers,
    ):
        """Plugin sync must not mark old gear as freshly synced when no gear arrives."""
        await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )

        fresh = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [
                    {
                        "slot": "weapon",
                        "currentSource": "savage",
                        "itemId": 200001,
                        "itemName": "Cruiserweight Champion's Spear",
                        "itemLevel": 795,
                    },
                ],
                "source": "plugin",
            },
        )
        assert fresh.status_code == 200
        snapshot_id = fresh.json()["snapshotId"]

        before = await session.execute(
            select(PlayerGearSnapshot).where(PlayerGearSnapshot.id == snapshot_id)
        )
        before_snapshot = before.scalar_one()
        before_synced_at = before_snapshot.synced_at
        before_gear = before_snapshot.gear

        empty = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [],
                "source": "plugin",
            },
        )
        assert empty.status_code == 422
        assert "no saved gear was updated" in empty.json()["detail"].lower()

        session.expire_all()
        after = await session.execute(
            select(PlayerGearSnapshot).where(PlayerGearSnapshot.id == snapshot_id)
        )
        after_snapshot = after.scalar_one()
        assert after_snapshot.synced_at == before_synced_at
        assert after_snapshot.gear == before_gear

    async def test_plugin_sync_stores_each_job_without_overwriting_other_jobs(
        self, client, session, auth_headers,
    ):
        """Plugin uploads are keyed by character + job, so alt job gear stays separate."""
        character_response = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        character_id = character_response.json()["id"]

        brd = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "BRD",
                "gear": [
                    {
                        "slot": "weapon",
                        "currentSource": "savage",
                        "itemId": 300001,
                        "itemName": "Skyruin Bow",
                        "itemLevel": 735,
                    },
                ],
                "source": "plugin",
            },
        )
        mch = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "MCH",
                "gear": [
                    {
                        "slot": "weapon",
                        "currentSource": "crafted",
                        "itemId": 300002,
                        "itemName": "Ceremonial Arquebus",
                        "itemLevel": 720,
                    },
                ],
                "source": "plugin",
            },
        )
        assert brd.status_code == 200
        assert mch.status_code == 200

        snapshots = await session.execute(
            select(PlayerGearSnapshot).where(PlayerGearSnapshot.character_id == character_id)
        )
        by_job = {snapshot.job: snapshot for snapshot in snapshots.scalars().all()}
        assert set(by_job) == {"BRD", "MCH"}
        assert by_job["BRD"].gear[0]["equippedItemName"] == "Skyruin Bow"
        assert by_job["MCH"].gear[0]["equippedItemName"] == "Ceremonial Arquebus"

    async def test_plugin_sync_invalid_job_rejected(self, client, auth_headers):
        """Rejects invalid job in plugin sync."""
        await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "Test Character",
                "server": "Gilgamesh",
            },
        )
        response = await client.post(
            "/api/plugin/player/gear-sync",
            headers=auth_headers,
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "job": "ZZZ",
                "gear": [],
            },
        )
        assert response.status_code == 400

    async def test_plugin_sync_requires_auth(self, client):
        """Plugin sync requires authentication."""
        response = await client.post(
            "/api/plugin/player/gear-sync",
            json={
                "characterName": "Test",
                "characterWorld": "Gilgamesh",
                "job": "DRG",
                "gear": [],
            },
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestPlayerGoals:
    """Tests for player goal CRUD (collection hunting + personal goals)."""

    async def test_create_collection_goal(self, client, auth_headers):
        """Can create a mount farm collection goal."""
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={
                "title": "Farm Valigarmanda mount",
                "goalType": "mount_farm",
                "sourceContent": "Worqor Lar Dor (Extreme)",
                "sourceItem": "Valigarmanda Totem",
                "currentCount": 42,
                "targetCount": 99,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Farm Valigarmanda mount"
        assert data["goalType"] == "mount_farm"
        assert data["status"] == "active"
        assert data["currentCount"] == 42
        assert data["targetCount"] == 99
        assert data["sourceContent"] == "Worqor Lar Dor (Extreme)"
        assert data["sourceItem"] == "Valigarmanda Totem"

    async def test_create_personal_goal(self, client, auth_headers):
        """Can create a personal checklist goal."""
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={
                "title": "Clear all Savage floors",
                "goalType": "personal",
                "description": "Week 1 clear goal for M1S-M4S",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["goalType"] == "personal"
        assert data["description"] == "Week 1 clear goal for M1S-M4S"
        assert data["targetCount"] is None

    async def test_list_goals(self, client, auth_headers):
        """Can list all goals."""
        await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Goal A", "goalType": "mount_farm"},
        )
        await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Goal B", "goalType": "personal"},
        )
        response = await client.get("/api/player/goals", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_list_goals_filtered_by_type(self, client, auth_headers):
        """Can filter goals by goal_type."""
        await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Mount goal", "goalType": "mount_farm"},
        )
        await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Personal goal", "goalType": "personal"},
        )
        response = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers
        )
        assert response.status_code == 200
        goals = response.json()
        assert len(goals) == 1
        assert goals[0]["goalType"] == "mount_farm"

    async def test_update_goal(self, client, auth_headers):
        """Can update goal count, status, and title."""
        r = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={
                "title": "Farm totems",
                "goalType": "totem_farm",
                "currentCount": 10,
                "targetCount": 99,
            },
        )
        goal_id = r.json()["id"]
        response = await client.put(
            f"/api/player/goals/{goal_id}",
            headers=auth_headers,
            json={"currentCount": 55, "title": "Farm totems (updated)"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["currentCount"] == 55
        assert data["title"] == "Farm totems (updated)"

    async def test_complete_goal(self, client, auth_headers):
        """Can set status to completed."""
        r = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Get mount", "goalType": "mount_farm"},
        )
        goal_id = r.json()["id"]
        response = await client.put(
            f"/api/player/goals/{goal_id}",
            headers=auth_headers,
            json={"status": "completed"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

    async def test_delete_goal(self, client, auth_headers):
        """Can delete a goal."""
        r = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Temp goal", "goalType": "personal"},
        )
        goal_id = r.json()["id"]
        response = await client.delete(
            f"/api/player/goals/{goal_id}", headers=auth_headers
        )
        assert response.status_code == 204

        goals = (await client.get("/api/player/goals", headers=auth_headers)).json()
        assert len(goals) == 0

    async def test_cannot_access_other_users_goals(
        self, client, auth_headers, auth_headers_user2
    ):
        """User 2 cannot access User 1's goals."""
        r = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "My goal", "goalType": "personal"},
        )
        goal_id = r.json()["id"]

        response = await client.put(
            f"/api/player/goals/{goal_id}",
            headers=auth_headers_user2,
            json={"status": "completed"},
        )
        assert response.status_code == 404

        response = await client.delete(
            f"/api/player/goals/{goal_id}", headers=auth_headers_user2
        )
        assert response.status_code == 404

    async def test_invalid_goal_type_rejected(self, client, auth_headers):
        """Rejects invalid goal_type."""
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Bad goal", "goalType": "invalid_type"},
        )
        assert response.status_code == 400

    async def test_invalid_status_rejected(self, client, auth_headers):
        """Rejects invalid status."""
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Bad goal", "goalType": "personal", "status": "invalid"},
        )
        assert response.status_code == 400

    async def test_linked_job_validated(self, client, auth_headers):
        """Rejects invalid job code."""
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers,
            json={"title": "Goal", "goalType": "gear", "linkedJob": "ZZZ"},
        )
        assert response.status_code == 400

    async def test_linked_character_must_belong_to_user(
        self, client, auth_headers, auth_headers_user2
    ):
        """Cannot link another user's character to a goal."""
        # User 1 links a character
        r = await client.post(
            "/api/player/characters",
            headers=auth_headers,
            json={
                "lodestoneId": "12345",
                "name": "User1 Char",
                "server": "Gilgamesh",
            },
        )
        char_id = r.json()["id"]

        # User 2 tries to use User 1's character
        response = await client.post(
            "/api/player/goals",
            headers=auth_headers_user2,
            json={
                "title": "Steal char",
                "goalType": "personal",
                "linkedCharacterId": char_id,
            },
        )
        assert response.status_code == 400

    async def test_goals_require_auth(self, client):
        """Goal endpoints require authentication."""
        response = await client.get("/api/player/goals")
        assert response.status_code == 401


@pytest.mark.asyncio
class TestProfileSharing:
    """Tests for profile sharing, share codes, and public profile view."""

    async def test_profile_starts_with_sharing_disabled(self, client, auth_headers):
        """New profile has sharing off and no share code."""
        response = await client.get("/api/player/profile", headers=auth_headers)
        data = response.json()
        assert data["shareEnabled"] is False
        assert data["shareCode"] is None

    async def test_enable_sharing_generates_code(self, client, auth_headers):
        """Enabling share generates a share code."""
        await client.get("/api/player/profile", headers=auth_headers)
        response = await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"shareEnabled": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["shareEnabled"] is True
        assert data["shareCode"] is not None
        assert len(data["shareCode"]) == 8

    async def test_disable_sharing_keeps_code(self, client, auth_headers):
        """Disabling share keeps the code but disables access."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"shareEnabled": True},
        )
        response = await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"shareEnabled": False},
        )
        data = response.json()
        assert data["shareEnabled"] is False
        assert data["shareCode"] is not None

    async def test_rotate_share_code(self, client, auth_headers):
        """Rotating generates a new code."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"shareEnabled": True},
        )
        r1 = await client.get("/api/player/profile", headers=auth_headers)
        old_code = r1.json()["shareCode"]

        response = await client.post(
            "/api/player/profile/rotate-share-code",
            headers=auth_headers,
        )
        assert response.status_code == 200
        new_code = response.json()["shareCode"]
        assert new_code != old_code
        assert len(new_code) == 8

    async def test_public_profile_viewable_when_shareable(self, client, auth_headers):
        """Shared profile is visible when shareable + sharing enabled."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "shareable", "shareEnabled": True},
        )
        profile = (await client.get("/api/player/profile", headers=auth_headers)).json()
        share_code = profile["shareCode"]

        response = await client.get(f"/api/player/profile/share/{share_code}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "characters" in data
        assert "jobProfiles" in data

    async def test_private_profile_returns_404(self, client, auth_headers):
        """Private profile is not accessible even with valid share code."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "private", "shareEnabled": True},
        )
        profile = (await client.get("/api/player/profile", headers=auth_headers)).json()
        share_code = profile["shareCode"]

        response = await client.get(f"/api/player/profile/share/{share_code}")
        assert response.status_code == 404

    async def test_disabled_sharing_returns_404(self, client, auth_headers):
        """Disabled sharing returns 404 even with valid code."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "shareable", "shareEnabled": True},
        )
        profile = (await client.get("/api/player/profile", headers=auth_headers)).json()
        share_code = profile["shareCode"]

        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"shareEnabled": False},
        )

        response = await client.get(f"/api/player/profile/share/{share_code}")
        assert response.status_code == 404

    async def test_invalid_share_code_returns_404(self, client):
        """Invalid share code returns 404."""
        response = await client.get("/api/player/profile/share/BADCODE1")
        assert response.status_code == 404

    async def test_public_response_excludes_private_fields(self, client, auth_headers):
        """Public profile does not include userId, visibility, goals, or job notes."""
        await client.get("/api/player/profile", headers=auth_headers)
        await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "DNC", "role": "ranged", "notes": "secret notes"},
        )
        await client.put(
            "/api/player/profile",
            headers=auth_headers,
            json={"visibility": "shareable", "shareEnabled": True},
        )
        profile = (await client.get("/api/player/profile", headers=auth_headers)).json()
        share_code = profile["shareCode"]

        response = await client.get(f"/api/player/profile/share/{share_code}")
        data = response.json()
        assert "userId" not in data
        assert "visibility" not in data
        assert "shareCode" not in data
        assert "shareEnabled" not in data
        # Job notes should be stripped
        for jp in data["jobProfiles"]:
            assert jp["notes"] is None
