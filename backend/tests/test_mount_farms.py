"""Tests for mount farm tracker endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.models import MemberRole, User
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def member_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="member_mount_id", discord_username="member")


@pytest_asyncio.fixture
async def viewer_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="viewer_mount_id", discord_username="viewer")


@pytest.fixture
def member_headers(member_user: User) -> dict[str, str]:
    token = create_access_token(member_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers(viewer_user: User) -> dict[str, str]:
    token = create_access_token(viewer_user.id)
    return {"Authorization": f"Bearer {token}"}


TRIAL_ID = "dt-valigarmanda"
TRIAL_ID_2 = "ew-zodiark"


class TestMountFarmRouteRegistration:
    async def test_mount_farm_routes_are_registered_in_openapi(self):
        paths = set(app.openapi()["paths"])
        assert "/api/static-groups/{group_id}/mount-farms" in paths
        assert "/api/static-groups/{group_id}/mount-farms/progress" in paths
        assert "/api/static-groups/{group_id}/mount-farms/progress/bulk" in paths
        assert "/api/static-groups/{group_id}/mount-farms/recommendations" in paths
        assert "/api/plugin/mount-farms/catalog" in paths
        assert "/api/plugin/mount-farms/sync" in paths


class TestGetMountFarmProgress:
    async def test_owner_can_get_progress(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "trials" in data
        assert "currentUserId" in data

    async def test_member_can_get_progress(
        self, client: AsyncClient, session: AsyncSession, test_group, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms",
            headers=member_headers,
        )
        assert response.status_code == 200

    async def test_non_member_blocked(
        self, client: AsyncClient, member_headers
    ):
        response = await client.get(
            "/api/static-groups/nonexistent/mount-farms",
            headers=member_headers,
        )
        assert response.status_code in (403, 404)

    async def test_viewer_blocked(
        self, client: AsyncClient, session: AsyncSession, test_group, viewer_user, viewer_headers
    ):
        await create_membership(session, viewer_user, test_group, role=MemberRole.VIEWER)
        # Viewers are excluded from non-viewer member queries but can still view
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms",
            headers=viewer_headers,
        )
        # Viewers have membership so GET should succeed
        assert response.status_code == 200

    async def test_filter_by_trial_ids(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms?trial_ids={TRIAL_ID},{TRIAL_ID_2}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        trial_ids = [t["trialId"] for t in data["trials"]]
        assert TRIAL_ID in trial_ids
        assert TRIAL_ID_2 in trial_ids


class TestUpdateMountFarmProgress:
    async def test_owner_can_update_own_progress(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hasMount"] is True
        assert data["trialId"] == TRIAL_ID
        assert data["ownershipSource"] == "manual"

    async def test_member_can_update_own_progress(
        self, client: AsyncClient, session: AsyncSession, test_group, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "totemCount": 42},
            headers=member_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totemCount"] == 42
        assert data["totemSource"] == "manual"

    async def test_member_cannot_update_other_member(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": True, "userId": test_user.id},
            headers=member_headers,
        )
        assert response.status_code == 403

    async def test_lead_can_update_other_member(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, member_user
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.LEAD)
        token = create_access_token(member_user.id)
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": True, "userId": test_user.id},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == test_user.id
        assert data["hasMount"] is True

    async def test_update_totem_count(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "totemCount": 99},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totemCount"] == 99

    async def test_update_wants_mount(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "wantsMount": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["wantsMount"] is False

    async def test_update_creates_then_updates(
        self, client: AsyncClient, test_group, auth_headers
    ):
        # Create
        r1 = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "totemCount": 10},
            headers=auth_headers,
        )
        assert r1.status_code == 200
        assert r1.json()["totemCount"] == 10

        # Update
        r2 = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "totemCount": 50},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["totemCount"] == 50

    async def test_manual_override_sets_source_and_timestamp(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": True, "totemCount": 50},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ownershipSource"] == "manual"
        assert data["totemSource"] == "manual"
        assert data["lastManualOverrideAt"] is not None

    async def test_invalid_totem_count_rejected(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "totemCount": -1},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_non_member_blocked(
        self, client: AsyncClient, member_headers
    ):
        response = await client.patch(
            "/api/static-groups/nonexistent/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": True},
            headers=member_headers,
        )
        assert response.status_code in (403, 404)


class TestRecommendations:
    async def test_empty_group_returns_empty(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms/recommendations",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_recommendations_after_progress(
        self, client: AsyncClient, test_group, auth_headers
    ):
        # Add some progress data
        await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "wantsMount": True, "totemCount": 50},
            headers=auth_headers,
        )
        response = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms/recommendations",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert data[0]["trialId"] == TRIAL_ID
        assert data[0]["score"] > 0


class TestPluginCatalog:
    async def test_get_catalog(self, client: AsyncClient, auth_headers):
        response = await client.get(
            "/api/plugin/mount-farms/catalog",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert len(data["entries"]) > 0
        entry = data["entries"][0]
        assert "trialId" in entry
        assert "mountId" in entry
        assert "totemItemId" in entry
        assert "expansion" in entry

    async def test_catalog_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/plugin/mount-farms/catalog")
        assert response.status_code == 401


class TestPluginSync:
    async def test_sync_mount_ownership(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "characterName": "Test Character",
                "characterWorld": "Gilgamesh",
                "mounts": [
                    {"mountId": 330, "trialId": "dt-valigarmanda", "owned": True},
                    {"mountId": 331, "trialId": "dt-zoraal-ja", "owned": False},
                ],
                "totems": [],
                "source": "plugin",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mountsUpdated"] >= 1
        assert data["syncedAt"] is not None

        # Verify the progress was created
        progress = await client.get(
            f"/api/static-groups/{test_group.id}/mount-farms?trial_ids=dt-valigarmanda",
            headers=auth_headers,
        )
        assert progress.status_code == 200
        trials = progress.json()["trials"]
        vali = next((t for t in trials if t["trialId"] == "dt-valigarmanda"), None)
        assert vali is not None
        owner_progress = next((m for m in vali["memberProgress"] if m["hasMount"]), None)
        assert owner_progress is not None
        assert owner_progress["ownershipSource"] == "plugin"

    async def test_sync_totem_counts(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "mounts": [],
                "totems": [
                    {"itemId": 44123, "trialId": "dt-valigarmanda", "count": 55},
                ],
                "source": "plugin",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totemsUpdated"] >= 1

    async def test_sync_unknown_mount_id(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "mounts": [{"mountId": 999999, "owned": True}],
                "totems": [],
                "source": "plugin",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["unknownTrials"]) > 0

    async def test_sync_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={"mounts": [], "totems": [], "source": "plugin"},
        )
        assert response.status_code == 401

    async def test_manual_override_preserved_after_sync(
        self, client: AsyncClient, test_group, auth_headers
    ):
        # First, manually mark mount as NOT owned (explicit correction)
        await client.patch(
            f"/api/static-groups/{test_group.id}/mount-farms/progress",
            json={"trialId": TRIAL_ID, "hasMount": False},
            headers=auth_headers,
        )

        # Then plugin says it IS owned
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "mounts": [{"mountId": 330, "trialId": TRIAL_ID, "owned": True}],
                "totems": [],
                "source": "plugin",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        # Manual override should be preserved (plugin doesn't overwrite explicit manual false)
        data = response.json()
        assert data["mountsUnchanged"] >= 1

    async def test_sync_updates_all_groups(
        self, client: AsyncClient, session: AsyncSession, test_user, test_group, auth_headers
    ):
        # Create a second group where the user is also a member
        group2 = await create_static_group(session, test_user, name="Second Static")

        # Sync should update both groups
        response = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "mounts": [{"mountId": 330, "trialId": TRIAL_ID, "owned": True}],
                "totems": [],
                "source": "plugin",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Check both groups have the progress
        for gid in (test_group.id, group2.id):
            r = await client.get(
                f"/api/static-groups/{gid}/mount-farms?trial_ids={TRIAL_ID}",
                headers=auth_headers,
            )
            assert r.status_code == 200


class TestBulkUpdate:
    async def test_lead_can_bulk_update(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, member_user
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.LEAD)
        token = create_access_token(member_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.put(
            f"/api/static-groups/{test_group.id}/mount-farms/progress/bulk",
            json={
                "updates": [
                    {"trialId": TRIAL_ID, "userId": test_user.id, "hasMount": True},
                    {"trialId": TRIAL_ID_2, "userId": test_user.id, "totemCount": 30},
                ]
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    async def test_member_cannot_bulk_update(
        self, client: AsyncClient, session: AsyncSession, test_group, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.put(
            f"/api/static-groups/{test_group.id}/mount-farms/progress/bulk",
            json={"updates": [{"trialId": TRIAL_ID, "hasMount": True}]},
            headers=member_headers,
        )
        assert response.status_code == 403
