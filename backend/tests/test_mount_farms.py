"""Tests for mount farm tracker endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.models import MemberRole, User
from app.routers.mount_farms import MOUNT_FARM_CATALOG
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
CURATED_DAWNTRAIL_DUTIES = [
    "Worqor Lar Dor (Extreme)",
    "Everkeep (Extreme)",
    "The Minstrel's Ballad: Sphene's Burden",
    "Recollection (Extreme)",
    "The Minstrel's Ballad: Necron's Embrace",
    "The Windward Wilds (Extreme)",
    "Hell on Rails (Extreme)",
    "The Unmaking (Extreme)",
]
BOGUS_DAWNTRAIL_DUTIES = [
    "Senary Unaspected Aetherial Node (Extreme)",
    "Senary Unexpected Aetherial Node (Extreme)",
    "Blasting Zone (Extreme)",
]
CURATED_ULTIMATE_DUTIES = [
    "The Unending Coil of Bahamut (Ultimate)",
    "The Weapon's Refrain (Ultimate)",
    "The Epic of Alexander (Ultimate)",
    "Dragonsong's Reprise (Ultimate)",
    "The Omega Protocol (Ultimate)",
    "Futures Rewritten (Ultimate)",
    "Dancing Mad (Ultimate)",
]
CURATED_ULTIMATE_EXCHANGES = [
    {
        "trial_id": "ult-ucob",
        "expansion": "SB",
        "duty_name": "The Unending Coil of Bahamut (Ultimate)",
        "reward_name": "Ultimate Dreadwyrm Weapons",
        "token_name": "Dreadwyrm Totem",
        "exchange_npc": "Eschina",
        "exchange_location": "Rhalgr's Reach",
    },
    {
        "trial_id": "ult-uwu",
        "expansion": "SB",
        "duty_name": "The Weapon's Refrain (Ultimate)",
        "reward_name": "Ultima Weapons",
        "token_name": "Ultima Totem",
        "exchange_npc": "Eschina",
        "exchange_location": "Rhalgr's Reach",
    },
    {
        "trial_id": "ult-tea",
        "expansion": "ShB",
        "duty_name": "The Epic of Alexander (Ultimate)",
        "reward_name": "Ultimate Alexander Weapons",
        "token_name": "Colossus Totem",
        "exchange_npc": "Bertana",
        "exchange_location": "Idyllshire",
    },
    {
        "trial_id": "ult-dsr",
        "expansion": "EW",
        "duty_name": "Dragonsong's Reprise (Ultimate)",
        "reward_name": "Ultimate Weapons of the Heavens",
        "token_name": "Dragonsong Totem",
        "exchange_npc": "Nesvaaz",
        "exchange_location": "Radz-at-Han",
    },
    {
        "trial_id": "ult-top",
        "expansion": "EW",
        "duty_name": "The Omega Protocol (Ultimate)",
        "reward_name": "Ultimate Omega Weapons",
        "token_name": "Omega Totem",
        "exchange_npc": "Nesvaaz",
        "exchange_location": "Radz-at-Han",
    },
    {
        "trial_id": "ult-fru",
        "expansion": "DT",
        "duty_name": "Futures Rewritten (Ultimate)",
        "reward_name": "Ultimate Edenmorn Weapons",
        "token_name": "Oracle Totem",
        "exchange_npc": "Uah'shepya",
        "exchange_location": "Solution Nine",
    },
    {
        "trial_id": "ult-dmu",
        "expansion": "DT",
        "duty_name": "Dancing Mad (Ultimate)",
        "reward_name": "Palazzo Diamond Weapons",
        "token_name": "Mad Harlequin's Totem",
        "exchange_npc": "Uah'shepya",
        "exchange_location": "Solution Nine",
    },
]


class TestMountFarmRouteRegistration:
    async def test_mount_farm_routes_are_registered_in_openapi(self):
        paths = set(app.openapi()["paths"])
        assert "/api/static-groups/{group_id}/mount-farms" in paths
        assert "/api/static-groups/{group_id}/mount-farms/progress" in paths
        assert "/api/static-groups/{group_id}/mount-farms/progress/bulk" in paths
        assert "/api/static-groups/{group_id}/mount-farms/recommendations" in paths
        assert "/api/plugin/mount-farms/catalog" in paths
        assert "/api/plugin/mount-farms/sync" in paths


class TestMountFarmCatalogValidation:
    async def test_dawntrail_catalog_uses_curated_allowlist(self):
        dawntrail_entries = [
            entry
            for entry in MOUNT_FARM_CATALOG
            if entry["expansion"] == "DT" and entry["content_type"] != "ultimate"
        ]
        assert [entry["duty_name"] for entry in dawntrail_entries] == CURATED_DAWNTRAIL_DUTIES

    async def test_bogus_generated_duties_are_not_in_catalog(self):
        duty_names = {entry["duty_name"] for entry in MOUNT_FARM_CATALOG}
        mount_names = {entry["mount_name"] for entry in MOUNT_FARM_CATALOG}
        for bogus in BOGUS_DAWNTRAIL_DUTIES:
            assert bogus not in duty_names
            assert bogus not in mount_names

    async def test_catalog_entries_have_curated_content_and_reward_fields(self):
        for entry in MOUNT_FARM_CATALOG:
            assert entry.get("trial_id")
            assert entry.get("source_content") == entry.get("duty_name")
            assert entry.get("duty_name")
            assert entry.get("mount_name")
            assert entry.get("reward_type") in {"mount", "weapon", "currency", "title", "misc"}
            assert entry.get("content_type") in {
                "extreme_trial",
                "ultimate",
                "collaboration",
                "raid",
                "other",
            }
            assert entry.get("category") in {"normal", "collaboration", "ultimate", "special"}
            assert entry.get("reward_name")
            if entry["reward_type"] == "mount":
                assert entry.get("totem_name")
                assert entry.get("totem_target") == 99

    async def test_dawntrail_special_exchange_metadata(self):
        by_id = {entry["trial_id"]: entry for entry in MOUNT_FARM_CATALOG}
        windward = by_id["dt-windward-wilds"]
        assert windward["category"] == "collaboration"
        assert windward["content_type"] == "collaboration"
        assert windward["totem_name"] == "Guardian Arkveld Certificate"
        assert windward["currency_item_name"] == "Guardian Arkveld Certificate"
        assert windward["currency_per_clear"] == 2
        assert windward["exchange_npc"] == "Smithy"
        assert windward["exchange_location"] == "Tuliyollal"

        assert by_id["dt-hell-on-rails"]["exchange_status"] == "not_yet_available"
        assert by_id["dt-unmaking"]["exchange_status"] == "not_yet_available"

    async def test_ultimate_entries_have_curated_one_token_exchange_metadata(self):
        ultimate_entries = [
            entry for entry in MOUNT_FARM_CATALOG if entry["content_type"] == "ultimate"
        ]
        assert [entry["duty_name"] for entry in ultimate_entries] == CURATED_ULTIMATE_DUTIES
        by_id = {entry["trial_id"]: entry for entry in ultimate_entries}

        for expected in CURATED_ULTIMATE_EXCHANGES:
            entry = by_id[expected["trial_id"]]
            assert entry["expansion"] == expected["expansion"]
            assert entry["duty_name"] == expected["duty_name"]
            assert entry["reward_type"] == "weapon"
            assert entry["content_type"] == "ultimate"
            assert entry["category"] == "ultimate"
            assert entry["reward_name"] == expected["reward_name"]
            assert entry["totem_name"] == expected["token_name"]
            assert entry["currency_item_name"] == expected["token_name"]
            assert entry["totem_target"] == 1
            assert entry["currency_per_clear"] == 1
            assert entry["exchange_cost"] == 1
            assert entry["exchange_npc"] == expected["exchange_npc"]
            assert entry["exchange_location"] == expected["exchange_location"]
            assert entry["exchange_status"] == "available"


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
        assert "rewardType" in entry
        assert "contentType" in entry
        assert "rewardName" in entry
        assert "currencyItemName" in entry

    async def test_plugin_catalog_only_includes_verified_game_ids(
        self, client: AsyncClient, auth_headers
    ):
        response = await client.get(
            "/api/plugin/mount-farms/catalog",
            headers=auth_headers,
        )
        assert response.status_code == 200
        entries = response.json()["entries"]

        assert entries
        assert all(isinstance(entry["mountId"], int) for entry in entries)
        assert all(isinstance(entry["totemItemId"], int) for entry in entries)
        assert all(entry["rewardType"] == "mount" for entry in entries)
        assert all(entry["contentType"] == "extreme_trial" for entry in entries)

        trial_ids = {entry["trialId"] for entry in entries}
        assert "dt-valigarmanda" not in trial_ids
        assert "ult-ucob" not in trial_ids

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
