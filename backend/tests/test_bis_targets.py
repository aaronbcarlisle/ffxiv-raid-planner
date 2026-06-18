"""Tests for the shared /api/bis-targets CRUD endpoints.

Covers player-hub context (owner_type='player_job_profile') and verifies
permission enforcement (other users cannot modify someone else's targets).
Roster context tests require SnapshotPlayer + group membership and are
covered in test_bis_targets_roster.py.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest


MULTI_SET_XIVGEAR_DATA = {
    "name": "WHM Sheet",
    "job": "WHM",
    "sets": [
        {"isSeparator": True, "name": "Savage"},
        {"name": "2.44 Savage BiS", "items": {"Weapon": {"id": 101}}},
        {"name": "2.29 High DPS", "items": {"Weapon": {"id": 202}}},
    ],
}


@pytest.mark.asyncio
class TestBisTargetsPlayerHub:
    """Tests for player_job_profile owner_type via /api/bis-targets."""

    async def _create_job_profile(self, client, auth_headers) -> str:
        await client.get("/api/player/profile", headers=auth_headers)
        r = await client.post(
            "/api/player/jobs",
            headers=auth_headers,
            json={"job": "SAM", "role": "melee", "priority": "main", "readiness": "ready"},
        )
        assert r.status_code == 201, r.json()
        return r.json()["id"]

    async def test_list_empty(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert r.status_code == 200
        assert r.json() == []

    async def test_create_and_list(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "player_job_profile",
                "ownerId": jp_id,
                "name": "Savage week-1",
                "purpose": "savage",
                "sourceType": "xivgear",
                "externalUrl": "https://xivgear.app/share/test-uuid",
                "importStatus": "linked_only",
                "patch": "7.2",
            },
        )
        assert cr.status_code == 201, cr.json()
        data = cr.json()
        assert data["name"] == "Savage week-1"
        assert data["ownerType"] == "player_job_profile"
        assert data["ownerId"] == jp_id
        assert data["job"] == "SAM"
        assert data["patch"] == "7.2"
        assert data["isActive"] is False

        # appears in list
        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert len(lr.json()) == 1

    async def test_update(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": "Prog"},
        )
        tid = cr.json()["id"]
        ur = await client.patch(
            f"/api/bis-targets/{tid}",
            headers=auth_headers,
            json={"name": "Updated", "patch": "7.25"},
        )
        assert ur.status_code == 200
        assert ur.json()["name"] == "Updated"
        assert ur.json()["patch"] == "7.25"

    async def test_delete(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": "Temp"},
        )
        tid = cr.json()["id"]
        dr = await client.delete(f"/api/bis-targets/{tid}", headers=auth_headers)
        assert dr.status_code == 204
        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert lr.json() == []

    async def test_set_active_only_one(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        t1 = (await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": "Prog"},
        )).json()["id"]
        t2 = (await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": "Farm"},
        )).json()["id"]

        r = await client.post(f"/api/bis-targets/{t2}/set-active", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["isActive"] is True

        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        by_id = {t["id"]: t for t in lr.json()}
        assert by_id[t1]["isActive"] is False
        assert by_id[t2]["isActive"] is True

    async def test_cannot_access_other_users_target(
        self, client, auth_headers, auth_headers_user2
    ):
        """User 2 cannot list or modify user 1's player hub BiS targets."""
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": "Private"},
        )
        tid = cr.json()["id"]

        # User 2 tries to list — 404 (profile not found, treated same as access denied)
        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers_user2,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert lr.status_code == 404

        # User 2 tries to delete
        dr = await client.delete(f"/api/bis-targets/{tid}", headers=auth_headers_user2)
        assert dr.status_code in (403, 404)

        # User 2 tries to set-active
        ar = await client.post(
            f"/api/bis-targets/{tid}/set-active", headers=auth_headers_user2
        )
        assert ar.status_code in (403, 404)

    async def test_invalid_purpose_rejected(self, client, auth_headers):
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "player_job_profile",
                "ownerId": jp_id,
                "name": "Bad",
                "purpose": "not_valid",
            },
        )
        assert r.status_code == 422

    async def test_invalid_owner_type_rejected(self, client, auth_headers):
        r = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "not_a_real_type",
                "ownerId": "some-id",
                "name": "Bad",
            },
        )
        assert r.status_code == 422

    async def test_linked_only_external_url_persisted(self, client, auth_headers):
        """linked_only targets persist the URL but claim no item comparison."""
        jp_id = await self._create_job_profile(client, auth_headers)
        r = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "player_job_profile",
                "ownerId": jp_id,
                "name": "Linked Set",
                "sourceType": "etro",
                "externalUrl": "https://etro.gg/gearset/test-uuid",
                "importStatus": "linked_only",
            },
        )
        assert r.status_code == 201
        data = r.json()
        assert data["importStatus"] == "linked_only"
        assert data["externalUrl"] == "https://etro.gg/gearset/test-uuid"
        assert data["itemsJson"] is None  # no item data for linked_only

    async def test_multi_target_multiple_allowed(self, client, auth_headers):
        """Multiple targets can coexist; only one is active at a time."""
        jp_id = await self._create_job_profile(client, auth_headers)
        for name in ("Savage BiS", "Farm Set", "Comfort Set"):
            await client.post(
                "/api/bis-targets",
                headers=auth_headers,
                json={"ownerType": "player_job_profile", "ownerId": jp_id, "name": name},
            )

        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert len(lr.json()) == 3
        active_count = sum(1 for t in lr.json() if t["isActive"])
        assert active_count <= 1

    async def test_xivgear_multi_set_target_requires_selected_set(self, client, auth_headers):
        """Linked XIVGear sheets with multiple sets must not import an arbitrary set."""
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "player_job_profile",
                "ownerId": jp_id,
                "name": "WHM Sheet",
                "sourceType": "xivgear",
                "externalUrl": "https://xivgear.app/?page=sl|73551d94-354a-4e30-9205-5d52d2efaf3f",
                "importStatus": "linked_only",
            },
        )
        tid = cr.json()["id"]

        with patch(
            "app.routers.bis_targets.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=MULTI_SET_XIVGEAR_DATA),
        ):
            response = await client.post(f"/api/bis-targets/{tid}/import", headers=auth_headers)

        assert response.status_code == 400
        assert "multiple sets" in response.json()["detail"]

        lr = await client.get(
            "/api/bis-targets",
            headers=auth_headers,
            params={"ownerType": "player_job_profile", "ownerId": jp_id},
        )
        assert lr.json()[0]["importStatus"] == "import_failed"

    async def test_xivgear_selected_set_target_populates_items_json(self, client, auth_headers):
        """The selected XIVGear set should populate the imported target gear data."""
        jp_id = await self._create_job_profile(client, auth_headers)
        cr = await client.post(
            "/api/bis-targets",
            headers=auth_headers,
            json={
                "ownerType": "player_job_profile",
                "ownerId": jp_id,
                "name": "WHM High DPS",
                "sourceType": "xivgear",
                "externalUrl": (
                    "https://xivgear.app/?page=sl|73551d94-354a-4e30-9205-5d52d2efaf3f"
                    "&selectedIndex=2"
                ),
                "importStatus": "linked_only",
            },
        )
        tid = cr.json()["id"]

        async def build_slots(items_data):
            assert items_data["Weapon"]["id"] == 202
            slot = {
                "slot": "weapon",
                "source": "raid",
                "itemId": 202,
                "itemName": "Imported Weapon 202",
                "itemLevel": 790,
                "itemIcon": "weapon-202.png",
                "itemStats": None,
                "materia": [],
            }
            return [SimpleNamespace(model_dump=lambda: slot)]

        with (
            patch(
                "app.routers.bis_targets.fetch_bis_from_xivgear_url",
                new=AsyncMock(return_value=MULTI_SET_XIVGEAR_DATA),
            ),
            patch("app.routers.bis_targets.build_xivgear_slots", new=AsyncMock(side_effect=build_slots)),
        ):
            response = await client.post(f"/api/bis-targets/{tid}/import", headers=auth_headers)

        assert response.status_code == 200, response.json()
        data = response.json()
        assert data["importStatus"] == "imported"
        assert data["itemsJson"]["slots"][0]["itemId"] == 202
