"""Tests for solo player hub smart sync: collection suggestions, static
recommendations, manual gear sync fallback, and plugin→solo goal bridge."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from app.models.mount_farm_progress import MountFarmProgress
from app.models.player_character import PlayerCharacter
from app.models.player_goal import PlayerGoal
from app.models.player_job_profile import PlayerJobProfile
from app.models.player_profile import PlayerProfile
from tests.factories import create_membership, create_static_group, create_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_profile(client: AsyncClient, headers: dict) -> dict:
    r = await client.get("/api/player/profile", headers=headers)
    assert r.status_code == 200
    return r.json()


async def _link_character(
    client: AsyncClient, headers: dict,
    *, lodestone_id: str = "12345", name: str = "Test Char", server: str = "Gilgamesh",
) -> dict:
    r = await client.post(
        "/api/player/characters", headers=headers,
        json={"lodestoneId": lodestone_id, "name": name, "server": server},
    )
    assert r.status_code == 201
    return r.json()


async def _add_job(
    client: AsyncClient, headers: dict,
    *, job: str = "DNC", role: str = "ranged", priority: str = "main",
) -> dict:
    r = await client.post(
        "/api/player/jobs", headers=headers,
        json={"job": job, "role": role, "priority": priority},
    )
    assert r.status_code == 201
    return r.json()


async def _add_job_direct(
    session: AsyncSession, profile_id: str,
    *, job: str = "DNC", role: str = "ranged", priority: str = "main",
) -> PlayerJobProfile:
    """Insert a job profile directly, bypassing rate limits."""
    now = datetime.now(timezone.utc).isoformat()
    jp = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        job=job.upper(),
        role=role.lower(),
        priority=priority,
        readiness="unknown",
        created_at=now,
        updated_at=now,
    )
    session.add(jp)
    await session.flush()
    return jp


async def _link_character_direct(
    session: AsyncSession, profile_id: str,
    *, lodestone_id: str = "99999", name: str = "Test Char",
    server: str = "Gilgamesh", is_main: bool = True,
) -> PlayerCharacter:
    """Insert a character directly, bypassing rate limits."""
    now = datetime.now(timezone.utc).isoformat()
    char = PlayerCharacter(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        lodestone_id=lodestone_id,
        name=name,
        server=server,
        is_main=is_main,
        created_at=now,
        updated_at=now,
    )
    session.add(char)
    await session.flush()
    return char


async def _create_mount_progress(
    session: AsyncSession, user: User, group_id: str,
    *, trial_id: str, totem_count: int = 0, has_mount: bool = False,
) -> MountFarmProgress:
    now = datetime.now(timezone.utc).isoformat()
    progress = MountFarmProgress(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        user_id=user.id,
        trial_id=trial_id,
        has_mount=has_mount,
        wants_mount=True,
        totem_count=totem_count,
        ownership_source="plugin",
        totem_source="plugin",
        last_plugin_sync_at=now,
        updated_at=now,
        updated_by_id=user.id,
    )
    session.add(progress)
    await session.flush()
    return progress


async def _create_goal(
    session: AsyncSession, profile_id: str,
    *, trial_id: str, goal_type: str = "mount_farm",
) -> PlayerGoal:
    now = datetime.now(timezone.utc).isoformat()
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        title=f"Goal for {trial_id}",
        goal_type=goal_type,
        status="active",
        source_content=trial_id,
        current_count=0,
        created_at=now,
        updated_at=now,
    )
    session.add(goal)
    await session.flush()
    return goal


# ---------------------------------------------------------------------------
# Collection suggestions tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCollectionSuggestions:
    """Tests for GET /api/player/collection-suggestions."""

    async def test_returns_empty_when_no_progress(self, client, auth_headers):
        await _create_profile(client, auth_headers)
        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["suggestions"] == []

    async def test_suggests_from_user_progress(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)
        await _create_mount_progress(
            session, test_user, test_group.id,
            trial_id="dt-valigarmanda", totem_count=42,
        )
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        assert r.status_code == 200
        suggestions = r.json()["suggestions"]
        assert len(suggestions) == 1
        assert suggestions[0]["trialId"] == "dt-valigarmanda"
        assert suggestions[0]["currentCount"] == 42
        assert suggestions[0]["source"] == "static_sync"

    async def test_does_not_suggest_existing_goals(
        self, client, session, test_user, test_group, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        profile_id = profile["id"]
        await _create_mount_progress(
            session, test_user, test_group.id,
            trial_id="dt-valigarmanda", totem_count=42,
        )
        await _create_goal(session, profile_id, trial_id="dt-valigarmanda")
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["suggestions"] == []

    async def test_skips_zero_progress(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)
        await _create_mount_progress(
            session, test_user, test_group.id,
            trial_id="dt-valigarmanda", totem_count=0, has_mount=False,
        )
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["suggestions"] == []

    async def test_includes_owned_mount(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)
        await _create_mount_progress(
            session, test_user, test_group.id,
            trial_id="dt-valigarmanda", totem_count=0, has_mount=True,
        )
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        suggestions = r.json()["suggestions"]
        assert len(suggestions) == 1
        assert suggestions[0]["hasMount"] is True

    async def test_does_not_expose_other_users_data(
        self, client, session, test_user, test_user_2, test_group,
        auth_headers, auth_headers_user2,
    ):
        """User 2's mount farm progress should not appear in User 1's suggestions."""
        await _create_profile(client, auth_headers)
        await _create_profile(client, auth_headers_user2)
        await _create_mount_progress(
            session, test_user_2, test_group.id,
            trial_id="dt-valigarmanda", totem_count=50,
        )
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        assert r.json()["suggestions"] == []

    async def test_deduplicates_by_trial_id(
        self, client, session, test_user, auth_headers,
    ):
        """If user has progress in multiple groups for the same trial, only one suggestion."""
        await _create_profile(client, auth_headers)
        group1 = await create_static_group(session, test_user, name="Group 1")
        group2 = await create_static_group(session, test_user, name="Group 2")
        await _create_mount_progress(
            session, test_user, group1.id,
            trial_id="dt-valigarmanda", totem_count=20,
        )
        await _create_mount_progress(
            session, test_user, group2.id,
            trial_id="dt-valigarmanda", totem_count=42,
        )
        await session.commit()

        r = await client.get("/api/player/collection-suggestions", headers=auth_headers)
        suggestions = r.json()["suggestions"]
        assert len(suggestions) == 1
        assert suggestions[0]["currentCount"] == 42

    async def test_requires_auth(self, client):
        r = await client.get("/api/player/collection-suggestions")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Suggested statics tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestSuggestedStatics:
    """Tests for GET /api/player/suggested-statics."""

    async def test_returns_empty_with_no_job_profiles(self, client, auth_headers):
        await _create_profile(client, auth_headers)
        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["suggestions"] == []

    async def test_matches_by_needed_jobs(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="DNC", role="ranged")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="Recruiting Static",
            is_public=True,
            settings={
                "discovery": {
                    "enabled": True,
                    "recruitmentStatus": "open",
                    "neededJobs": ["DNC", "BRD"],
                    "neededRoles": [],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        suggestions = r.json()["suggestions"]
        matched = [s for s in suggestions if s["name"] == "Recruiting Static"]
        assert len(matched) == 1
        assert "DNC" in matched[0]["matchingJobs"]

    async def test_matches_by_needed_roles(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="WAR", role="tank")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="Need Tank",
            is_public=True,
            settings={
                "discovery": {
                    "enabled": True,
                    "recruitmentStatus": "open",
                    "neededJobs": [],
                    "neededRoles": ["tank"],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        suggestions = r.json()["suggestions"]
        matched = [s for s in suggestions if s["name"] == "Need Tank"]
        assert len(matched) == 1
        assert "tank" in matched[0]["matchingRoles"]

    async def test_excludes_closed_recruitment(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="DNC", role="ranged")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="Closed Static",
            is_public=True,
            settings={
                "discovery": {
                    "enabled": True,
                    "recruitmentStatus": "closed",
                    "neededJobs": ["DNC"],
                    "neededRoles": [],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        names = [s["name"] for s in r.json()["suggestions"]]
        assert "Closed Static" not in names

    async def test_excludes_private_statics(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="DNC", role="ranged")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="Private Static",
            is_public=False,
            settings={
                "discovery": {
                    "enabled": True,
                    "recruitmentStatus": "open",
                    "neededJobs": ["DNC"],
                    "neededRoles": [],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        names = [s["name"] for s in r.json()["suggestions"]]
        assert "Private Static" not in names

    async def test_excludes_disabled_discovery(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="DNC", role="ranged")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="No Discovery",
            is_public=True,
            settings={
                "discovery": {
                    "enabled": False,
                    "recruitmentStatus": "open",
                    "neededJobs": ["DNC"],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        names = [s["name"] for s in r.json()["suggestions"]]
        assert "No Discovery" not in names

    async def test_no_match_when_jobs_dont_overlap(
        self, client, session, test_user, test_user_2, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _add_job_direct(session, profile["id"], job="DNC", role="ranged")
        await session.commit()

        await create_static_group(
            session, test_user_2, name="Need Healer Only",
            is_public=True,
            settings={
                "discovery": {
                    "enabled": True,
                    "recruitmentStatus": "open",
                    "neededJobs": ["WHM", "AST"],
                    "neededRoles": ["healer"],
                },
            },
        )
        await session.commit()

        r = await client.get("/api/player/suggested-statics", headers=auth_headers)
        names = [s["name"] for s in r.json()["suggestions"]]
        assert "Need Healer Only" not in names

    async def test_requires_auth(self, client):
        r = await client.get("/api/player/suggested-statics")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Manual gear sync fallback tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestManualGearSyncFallback:
    """Tests for manual job fallback in POST /api/player/characters/{id}/sync-gear."""

    async def test_manual_job_fallback_stores_snapshot(
        self, client, session, auth_headers, monkeypatch,
    ):
        """When active job detection fails, providing a job stores gear under that job."""
        profile = await _create_profile(client, auth_headers)
        char_obj = await _link_character_direct(session, profile["id"], lodestone_id="99999")
        await session.commit()
        char = {"id": char_obj.id}

        fake_payload = {
            "Character": {
                "Name": "Test Char",
                "Server": "Gilgamesh",
                "Avatar": None,
                "GearSet": {
                    "Class": {},
                    "Gear": {},
                },
            },
            "__source": "xivapi",
        }

        async def mock_fetch(*args, **kwargs):
            return fake_payload

        monkeypatch.setattr(
            "app.routers.lodestone._fetch_character_payload",
            mock_fetch,
        )
        async def mock_build_equipped(*args, **kwargs):
            return ([], {
                "weapon": {
                    "has_equipped_item": True,
                    "current_source": "unknown",
                    "item_id": 200001,
                    "item_name": "Fallback Bow",
                    "item_level": 710,
                    "item_icon": None,
                },
            })

        monkeypatch.setattr(
            "app.routers.lodestone._build_equipped_slots",
            mock_build_equipped,
        )

        r = await client.post(
            f"/api/player/characters/{char['id']}/sync-gear",
            headers=auth_headers,
            json={"job": "DNC"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["job"] == "DNC"
        assert data["source"] == "manual"
        assert data["slotCount"] == 1

    async def test_manual_job_fallback_does_not_update_empty_payload(
        self, client, session, auth_headers, monkeypatch,
    ):
        """Manual fallback must not create a fresh timestamp without gear data."""
        profile = await _create_profile(client, auth_headers)
        char_obj = await _link_character_direct(session, profile["id"], lodestone_id="99996")
        await session.commit()
        char = {"id": char_obj.id}

        fake_payload = {
            "Character": {
                "Name": "Test Char",
                "Server": "Gilgamesh",
                "Avatar": None,
                "GearSet": {
                    "Class": {},
                    "Gear": {},
                },
            },
            "__source": "xivapi",
        }

        async def mock_fetch(*args, **kwargs):
            return fake_payload

        async def mock_build_equipped(*args, **kwargs):
            return ([], {})

        monkeypatch.setattr("app.routers.lodestone._fetch_character_payload", mock_fetch)
        monkeypatch.setattr("app.routers.lodestone._build_equipped_slots", mock_build_equipped)

        r = await client.post(
            f"/api/player/characters/{char['id']}/sync-gear",
            headers=auth_headers,
            json={"job": "DNC"},
        )
        assert r.status_code == 422
        assert "no saved gear was updated" in r.json()["detail"].lower()

    async def test_no_job_returns_422(
        self, client, session, auth_headers, monkeypatch,
    ):
        """When active job detection fails and no manual job provided, returns 422."""
        profile = await _create_profile(client, auth_headers)
        char_obj = await _link_character_direct(session, profile["id"], lodestone_id="99998")
        await session.commit()
        char = {"id": char_obj.id}

        fake_payload = {
            "Character": {
                "Name": "Test Char",
                "Server": "Gilgamesh",
                "Avatar": None,
                "GearSet": {
                    "Class": {},
                    "Gear": {},
                },
            },
            "__source": "xivapi",
        }

        async def mock_fetch(*args, **kwargs):
            return fake_payload

        monkeypatch.setattr(
            "app.routers.lodestone._fetch_character_payload",
            mock_fetch,
        )

        r = await client.post(
            f"/api/player/characters/{char['id']}/sync-gear",
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "active job" in r.json()["detail"].lower()
        assert "manually" in r.json()["detail"].lower()

    async def test_invalid_manual_job_rejected(
        self, client, session, auth_headers, monkeypatch,
    ):
        """Invalid manual job code is rejected with 400."""
        profile = await _create_profile(client, auth_headers)
        char_obj = await _link_character_direct(session, profile["id"], lodestone_id="99997")
        await session.commit()
        char = {"id": char_obj.id}

        fake_payload = {
            "Character": {
                "Name": "Test Char",
                "Server": "Gilgamesh",
                "Avatar": None,
                "GearSet": {"Class": {}, "Gear": {}},
            },
            "__source": "xivapi",
        }

        async def mock_fetch(*args, **kwargs):
            return fake_payload

        monkeypatch.setattr(
            "app.routers.lodestone._fetch_character_payload",
            mock_fetch,
        )

        r = await client.post(
            f"/api/player/characters/{char['id']}/sync-gear",
            headers=auth_headers,
            json={"job": "ZZZ"},
        )
        assert r.status_code == 400

    async def test_manual_source_is_valid(
        self, client, session, auth_headers, monkeypatch,
    ):
        """The 'manual' source value is accepted by the gear snapshot model."""
        from app.models.player_gear_snapshot import VALID_SYNC_SOURCES

        assert "manual" in VALID_SYNC_SOURCES


# ---------------------------------------------------------------------------
# Plugin mount sync → solo PlayerGoal bridge tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPluginMountGoalBridge:
    """Tests for _bridge_mount_farm_goals creating/updating solo PlayerGoals."""

    async def test_plugin_sync_creates_goal_for_owned_mount(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)

        r = await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
                ],
                "totems": [],
                "source": "plugin",
            },
        )
        assert r.status_code == 200

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        goal_list = goals.json()
        matching = [g for g in goal_list if g["sourceContent"] == "dt-valigarmanda"]
        assert len(matching) == 1
        assert matching[0]["status"] == "completed"

    async def test_plugin_sync_creates_goal_for_totem_progress(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)

        r = await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [],
                "totems": [
                    {"itemId": 44123, "trialId": "dt-valigarmanda", "count": 35},
                ],
                "source": "plugin",
            },
        )
        assert r.status_code == 200

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        goal_list = goals.json()
        matching = [g for g in goal_list if g["sourceContent"] == "dt-valigarmanda"]
        assert len(matching) == 1
        assert matching[0]["status"] == "active"
        assert matching[0]["currentCount"] == 35

    async def test_plugin_sync_updates_existing_goal_count(
        self, client, session, test_user, test_group, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _create_goal(session, profile["id"], trial_id="dt-valigarmanda")
        await session.commit()

        r = await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [],
                "totems": [
                    {"itemId": 44123, "trialId": "dt-valigarmanda", "count": 60},
                ],
                "source": "plugin",
            },
        )
        assert r.status_code == 200

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        goal_list = goals.json()
        matching = [g for g in goal_list if g["sourceContent"] == "dt-valigarmanda"]
        assert len(matching) == 1
        assert matching[0]["currentCount"] == 60

    async def test_plugin_sync_marks_goal_completed_on_mount_owned(
        self, client, session, test_user, test_group, auth_headers,
    ):
        profile = await _create_profile(client, auth_headers)
        await _create_goal(session, profile["id"], trial_id="dt-valigarmanda")
        await session.commit()

        r = await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
                ],
                "totems": [],
                "source": "plugin",
            },
        )
        assert r.status_code == 200

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        matching = [g for g in goals.json() if g["sourceContent"] == "dt-valigarmanda"]
        assert matching[0]["status"] == "completed"

    async def test_plugin_sync_does_not_create_goal_for_zero_progress(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)

        await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": False},
                ],
                "totems": [
                    {"itemId": 44123, "trialId": "dt-valigarmanda", "count": 0},
                ],
                "source": "plugin",
            },
        )

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        assert goals.json() == []

    async def test_plugin_sync_does_not_create_duplicate_goals(
        self, client, session, test_user, test_group, auth_headers,
    ):
        await _create_profile(client, auth_headers)

        payload = {
            "mounts": [
                {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
            ],
            "totems": [],
            "source": "plugin",
        }
        await client.post("/api/plugin/mount-farms/sync", headers=auth_headers, json=payload)
        await client.post("/api/plugin/mount-farms/sync", headers=auth_headers, json=payload)

        goals = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers,
        )
        matching = [g for g in goals.json() if g["sourceContent"] == "dt-valigarmanda"]
        assert len(matching) == 1

    async def test_plugin_sync_does_not_affect_other_users_goals(
        self, client, session, test_user, test_user_2, test_group,
        auth_headers, auth_headers_user2,
    ):
        """Plugin sync for User 1 does not touch User 2's goals."""
        await _create_profile(client, auth_headers)
        profile2 = await _create_profile(client, auth_headers_user2)
        await _create_goal(session, profile2["id"], trial_id="dt-valigarmanda")
        await session.commit()

        await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
                ],
                "totems": [],
                "source": "plugin",
            },
        )

        # User 2's goal should still be active (not marked completed by User 1's sync)
        goals_u2 = await client.get(
            "/api/player/goals?goal_type=mount_farm", headers=auth_headers_user2,
        )
        matching = [g for g in goals_u2.json() if g["sourceContent"] == "dt-valigarmanda"]
        assert len(matching) == 1
        assert matching[0]["status"] == "active"

    async def test_plugin_sync_skips_bridge_when_no_profile(
        self, client, session, test_user, test_group, auth_headers,
    ):
        """If user has no profile, plugin sync still succeeds (bridge is silently skipped)."""
        r = await client.post(
            "/api/plugin/mount-farms/sync",
            headers=auth_headers,
            json={
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
                ],
                "totems": [],
                "source": "plugin",
            },
        )
        assert r.status_code == 200
