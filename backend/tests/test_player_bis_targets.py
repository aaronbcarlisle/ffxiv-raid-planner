"""Tests for player BiS target set CRUD endpoints."""

import pytest


@pytest.mark.asyncio
class TestPlayerBisTargets:
    """Tests for /api/player/jobs/{job_profile_id}/bis-targets endpoints."""

    async def _create_job_profile(self, client, auth_headers) -> str:
        """Helper: create a job profile and return its ID."""
        await client.get("/api/player/profile", headers=auth_headers)
        r = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "BRD", "role": "ranged", "priority": "main", "readiness": "ready"},
        )
        assert r.status_code == 201, r.json()
        return r.json()["id"]

    async def test_list_bis_targets_empty(self, client, auth_headers):
        """Empty list returned when no targets exist."""
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.get(f"/api/player/jobs/{jp_id}/bis-targets", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == []

    async def test_create_bis_target(self, client, auth_headers):
        """Creates a BiS target and returns it."""
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={
                "name": "Prog Set",
                "purpose": "savage",
                "sourceType": "xivgear",
                "externalUrl": "https://xivgear.app/share/test-uuid",
                "importStatus": "linked_only",
            },
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Prog Set"
        assert data["purpose"] == "savage"
        assert data["sourceType"] == "xivgear"
        assert data["isActive"] is False
        assert data["job"] == "BRD"

    async def test_list_returns_created_target(self, client, auth_headers):
        """Created targets appear in the list."""
        jp_id = await self._create_job_profile(client, auth_headers)
        await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Farm Set", "purpose": "farm", "sourceType": "manual"},
        )
        r = await client.get(f"/api/player/jobs/{jp_id}/bis-targets", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["name"] == "Farm Set"

    async def test_update_bis_target(self, client, auth_headers):
        """Updates name and purpose of an existing target."""
        jp_id = await self._create_job_profile(client, auth_headers)
        create_r = await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Old Name", "purpose": "prog", "sourceType": "manual"},
        )
        target_id = create_r.json()["id"]
        r = await client.put(
            f"/api/player/jobs/{jp_id}/bis-targets/{target_id}",
            headers=auth_headers,
            json={"name": "Updated Name", "purpose": "farm"},
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"
        assert r.json()["purpose"] == "farm"

    async def test_delete_bis_target(self, client, auth_headers):
        """Deletes a target; subsequent list is empty."""
        jp_id = await self._create_job_profile(client, auth_headers)
        create_r = await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Temp", "purpose": "custom", "sourceType": "manual"},
        )
        target_id = create_r.json()["id"]
        r = await client.delete(
            f"/api/player/jobs/{jp_id}/bis-targets/{target_id}",
            headers=auth_headers,
        )
        assert r.status_code == 204
        list_r = await client.get(f"/api/player/jobs/{jp_id}/bis-targets", headers=auth_headers)
        assert list_r.json() == []

    async def test_set_active_marks_only_one(self, client, auth_headers):
        """set-active marks exactly one target active, deactivating others."""
        jp_id = await self._create_job_profile(client, auth_headers)
        t1_id = (await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Prog", "purpose": "savage", "sourceType": "manual"},
        )).json()["id"]
        t2_id = (await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Farm", "purpose": "farm", "sourceType": "manual"},
        )).json()["id"]

        r = await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets/{t2_id}/set-active",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["isActive"] is True

        list_r = await client.get(f"/api/player/jobs/{jp_id}/bis-targets", headers=auth_headers)
        targets = {t["id"]: t for t in list_r.json()}
        assert targets[t1_id]["isActive"] is False
        assert targets[t2_id]["isActive"] is True

    async def test_profile_includes_bis_targets(self, client, auth_headers):
        """GET /api/player/profile returns bis_targets nested under job profiles."""
        jp_id = await self._create_job_profile(client, auth_headers)
        await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Endgame Set", "purpose": "savage", "sourceType": "xivgear"},
        )
        profile_r = await client.get("/api/player/profile", headers=auth_headers)
        assert profile_r.status_code == 200
        job_profiles = profile_r.json()["jobProfiles"]
        assert len(job_profiles) == 1
        assert len(job_profiles[0]["bisTargets"]) == 1
        assert job_profiles[0]["bisTargets"][0]["name"] == "Endgame Set"

    async def test_create_invalid_purpose_rejected(self, client, auth_headers):
        """Invalid purpose value returns 422."""
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.post(
            f"/api/player/jobs/{jp_id}/bis-targets",
            headers=auth_headers,
            json={"name": "Bad", "purpose": "not_a_purpose", "sourceType": "manual"},
        )
        assert r.status_code == 422
