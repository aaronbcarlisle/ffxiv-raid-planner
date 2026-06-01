"""Tests for static discovery API"""

import pytest
from httpx import AsyncClient

from app.models import User
from tests.factories import create_static_group, create_user, create_membership


def _discovery_settings(
    *,
    enabled: bool = True,
    recruitment_status: str = "open",
    description: str | None = "We raid on weekends",
    intensity: str | None = "midcore",
    languages: list[str] | None = None,
    data_center: str | None = "Aether",
    server: str | None = "Jenova",
    timezone: str | None = "America/New_York",
    needed_roles: list[str] | None = None,
    needed_jobs: list[str] | None = None,
    schedule_days: list[str] | None = None,
    schedule_start_time: str | None = "20:00",
    schedule_end_time: str | None = "23:00",
) -> dict:
    return {
        "discovery": {
            "enabled": enabled,
            "recruitmentStatus": recruitment_status,
            "description": description,
            "intensity": intensity,
            "languages": languages or ["en"],
            "dataCenter": data_center,
            "server": server,
            "timezone": timezone,
            "neededRoles": needed_roles or ["tank", "healer"],
            "neededJobs": needed_jobs or ["WAR", "WHM"],
            "scheduleDays": schedule_days or ["Saturday", "Sunday"],
            "scheduleStartTime": schedule_start_time,
            "scheduleEndTime": schedule_end_time,
        }
    }


ENDPOINT = "/api/discovery/statics"


# --- Visibility / opt-in tests ---


@pytest.mark.asyncio
async def test_private_static_excluded(client: AsyncClient, session, test_user: User):
    """Private statics never appear even with discovery enabled."""
    await create_static_group(
        session, test_user, is_public=False, settings=_discovery_settings(enabled=True)
    )
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_public_without_discovery_excluded(client: AsyncClient, session, test_user: User):
    """Public static without discovery opt-in is excluded."""
    await create_static_group(session, test_user, is_public=True)
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_public_with_discovery_disabled_excluded(client: AsyncClient, session, test_user: User):
    """Public static with discovery.enabled=false is excluded."""
    await create_static_group(
        session, test_user, is_public=True, settings=_discovery_settings(enabled=False)
    )
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_public_opted_in_included(client: AsyncClient, session, test_user: User):
    """Public static with discovery.enabled=true appears."""
    await create_static_group(
        session, test_user, name="Discoverable Static",
        is_public=True, settings=_discovery_settings(enabled=True),
    )
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Discoverable Static"


@pytest.mark.asyncio
async def test_no_auth_required(client: AsyncClient, session, test_user: User):
    """Discovery endpoint works without auth headers."""
    await create_static_group(
        session, test_user, is_public=True, settings=_discovery_settings(),
    )
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


# --- Filter tests ---


@pytest.mark.asyncio
async def test_filter_by_role(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Needs Tank", is_public=True,
        settings=_discovery_settings(needed_roles=["tank"]),
    )
    await create_static_group(
        session, test_user, name="Needs Healer", is_public=True,
        settings=_discovery_settings(needed_roles=["healer"]),
    )

    resp = await client.get(ENDPOINT, params={"role": "tank"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Needs Tank"


@pytest.mark.asyncio
async def test_filter_by_job(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Needs WAR", is_public=True,
        settings=_discovery_settings(needed_jobs=["WAR", "DRG"]),
    )
    await create_static_group(
        session, test_user, name="Needs WHM", is_public=True,
        settings=_discovery_settings(needed_jobs=["WHM"]),
    )

    resp = await client.get(ENDPOINT, params={"job": "DRG"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Needs WAR"


@pytest.mark.asyncio
async def test_filter_by_day(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Weekend", is_public=True,
        settings=_discovery_settings(schedule_days=["Saturday", "Sunday"]),
    )
    await create_static_group(
        session, test_user, name="Weekday", is_public=True,
        settings=_discovery_settings(schedule_days=["Tuesday", "Thursday"]),
    )

    resp = await client.get(ENDPOINT, params={"day": "Saturday"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Weekend"


@pytest.mark.asyncio
async def test_filter_by_timezone(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="EST", is_public=True,
        settings=_discovery_settings(timezone="America/New_York"),
    )
    await create_static_group(
        session, test_user, name="JST", is_public=True,
        settings=_discovery_settings(timezone="Asia/Tokyo"),
    )

    resp = await client.get(ENDPOINT, params={"timezone": "Asia/Tokyo"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "JST"


@pytest.mark.asyncio
async def test_filter_by_language(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="English", is_public=True,
        settings=_discovery_settings(languages=["en"]),
    )
    await create_static_group(
        session, test_user, name="Japanese", is_public=True,
        settings=_discovery_settings(languages=["ja"]),
    )

    resp = await client.get(ENDPOINT, params={"language": "ja"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Japanese"


@pytest.mark.asyncio
async def test_filter_by_intensity(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Casual", is_public=True,
        settings=_discovery_settings(intensity="casual"),
    )
    await create_static_group(
        session, test_user, name="Hardcore", is_public=True,
        settings=_discovery_settings(intensity="hardcore"),
    )

    resp = await client.get(ENDPOINT, params={"intensity": "hardcore"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Hardcore"


@pytest.mark.asyncio
async def test_filter_by_recruitment_status(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Open", is_public=True,
        settings=_discovery_settings(recruitment_status="open"),
    )
    await create_static_group(
        session, test_user, name="Closed", is_public=True,
        settings=_discovery_settings(recruitment_status="closed"),
    )

    resp = await client.get(ENDPOINT, params={"recruitmentStatus": "open"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Open"


@pytest.mark.asyncio
async def test_filter_by_data_center(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Aether", is_public=True,
        settings=_discovery_settings(data_center="Aether"),
    )
    await create_static_group(
        session, test_user, name="Primal", is_public=True,
        settings=_discovery_settings(data_center="Primal"),
    )

    resp = await client.get(ENDPOINT, params={"dataCenter": "Primal"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Primal"


@pytest.mark.asyncio
async def test_filter_by_server(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Jenova", is_public=True,
        settings=_discovery_settings(server="Jenova"),
    )
    await create_static_group(
        session, test_user, name="Gilgamesh", is_public=True,
        settings=_discovery_settings(server="Gilgamesh"),
    )

    resp = await client.get(ENDPOINT, params={"server": "Gilgamesh"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Gilgamesh"


# --- Response privacy tests ---


@pytest.mark.asyncio
async def test_response_excludes_private_fields(client: AsyncClient, session, test_user: User):
    """Discovery response must not leak internal IDs or private data."""
    await create_static_group(
        session, test_user, name="Public Static", is_public=True,
        settings=_discovery_settings(),
    )

    resp = await client.get(ENDPOINT)
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]

    assert "id" not in item
    assert "ownerId" not in item
    assert "owner_id" not in item
    assert "members" not in item
    assert "memberships" not in item
    assert "discordId" not in item
    assert "discord_id" not in item
    assert "notes" not in item
    assert "rsvp" not in item
    assert "gear" not in item
    assert "settings" not in item

    assert "name" in item
    assert "shareCode" in item
    assert "recruitmentStatus" in item


@pytest.mark.asyncio
async def test_response_dto_shape(client: AsyncClient, session, test_user: User):
    """Verify the exact shape of a discovery result item."""
    await create_static_group(
        session, test_user, name="Full Static", is_public=True,
        settings=_discovery_settings(
            description="Weekend raiders",
            needed_roles=["tank"],
            needed_jobs=["WAR"],
            schedule_days=["Saturday"],
            schedule_start_time="20:00",
            schedule_end_time="23:00",
            timezone="America/New_York",
            languages=["en"],
            intensity="midcore",
            data_center="Aether",
            server="Jenova",
        ),
    )

    resp = await client.get(ENDPOINT)
    item = resp.json()["items"][0]

    assert item["name"] == "Full Static"
    assert isinstance(item["shareCode"], str)
    assert item["recruitmentStatus"] == "open"
    assert item["description"] == "Weekend raiders"
    assert item["neededRoles"] == ["tank"]
    assert item["neededJobs"] == ["WAR"]
    assert item["scheduleDays"] == ["Saturday"]
    assert item["scheduleStartTime"] == "20:00"
    assert item["scheduleEndTime"] == "23:00"
    assert item["timezone"] == "America/New_York"
    assert item["languages"] == ["en"]
    assert item["intensity"] == "midcore"
    assert item["dataCenter"] == "Aether"
    assert item["server"] == "Jenova"
    assert isinstance(item["memberCount"], int)
    assert "lastUpdated" in item


# --- Member count test ---


@pytest.mark.asyncio
async def test_member_count_included(client: AsyncClient, session, test_user: User):
    """Member count reflects actual memberships."""
    group = await create_static_group(
        session, test_user, name="Team", is_public=True,
        settings=_discovery_settings(),
    )
    user2 = await create_user(session, discord_id="222", discord_username="user2")
    await create_membership(session, user2, group)

    resp = await client.get(ENDPOINT)
    item = resp.json()["items"][0]
    assert item["memberCount"] == 2  # owner + user2


# --- Malformed settings tests ---


@pytest.mark.asyncio
async def test_malformed_settings_no_crash(client: AsyncClient, session, test_user: User):
    """Groups with malformed settings are silently skipped."""
    await create_static_group(
        session, test_user, is_public=True, settings={"discovery": "not_a_dict"},
    )
    await create_static_group(
        session, test_user, is_public=True, settings={"discovery": {"enabled": "yes"}},
    )
    await create_static_group(
        session, test_user, is_public=True, settings={"unrelated": True},
    )
    await create_static_group(
        session, test_user, is_public=True, settings=None,
    )

    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_empty_result(client: AsyncClient):
    """Empty database returns empty result."""
    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


# --- Pagination tests ---


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient, session, test_user: User):
    for i in range(5):
        await create_static_group(
            session, test_user, name=f"Static {i}", is_public=True,
            settings=_discovery_settings(),
        )

    resp = await client.get(ENDPOINT, params={"limit": 2, "offset": 0})
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2

    resp2 = await client.get(ENDPOINT, params={"limit": 2, "offset": 4})
    data2 = resp2.json()
    assert data2["total"] == 5
    assert len(data2["items"]) == 1


# --- Case insensitive filter test ---


@pytest.mark.asyncio
async def test_filter_case_insensitive(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Test", is_public=True,
        settings=_discovery_settings(needed_roles=["Tank"], intensity="Midcore"),
    )

    resp = await client.get(ENDPOINT, params={"role": "tank"})
    assert resp.json()["total"] == 1

    resp2 = await client.get(ENDPOINT, params={"intensity": "midcore"})
    assert resp2.json()["total"] == 1


# --- Settings update via static group API tests ---


@pytest.mark.asyncio
async def test_owner_can_update_discovery_settings(
    client: AsyncClient, auth_headers: dict, test_group, session
):
    """Owner can set discovery settings through the group update endpoint."""
    # First make the group public
    resp = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"isPublic": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Set discovery settings
    discovery = {
        "enabled": True,
        "recruitmentStatus": "open",
        "description": "Looking for a tank!",
        "neededRoles": ["tank"],
    }
    resp = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"settings": {"discovery": discovery}},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Verify it appears in discovery
    resp = await client.get(ENDPOINT)
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["description"] == "Looking for a tank!"
    assert data["items"][0]["neededRoles"] == ["tank"]


@pytest.mark.asyncio
async def test_member_cannot_update_discovery_settings(
    client: AsyncClient, auth_headers_user2: dict, test_group, session, test_user_2
):
    """Member role cannot update group settings (including discovery)."""
    await create_membership(session, test_user_2, test_group)

    resp = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"settings": {"discovery": {"enabled": True, "recruitmentStatus": "open"}}},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_non_member_cannot_update_discovery_settings(
    client: AsyncClient, auth_headers_user2: dict, test_group
):
    """Non-member cannot update group settings."""
    resp = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"settings": {"discovery": {"enabled": True, "recruitmentStatus": "open"}}},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_private_static_not_in_discovery_even_with_settings(
    client: AsyncClient, auth_headers: dict, test_group
):
    """Private static with discovery enabled still excluded from discovery."""
    resp = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"settings": {"discovery": {"enabled": True, "recruitmentStatus": "open"}}},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    resp = await client.get(ENDPOINT)
    assert resp.json()["total"] == 0


# --- Discovery suggestions endpoint tests ---

SUGGESTIONS_URL = "/api/static-groups/{}/discovery/suggestions"


@pytest.mark.asyncio
async def test_owner_can_fetch_suggestions(
    client: AsyncClient, auth_headers: dict, test_group
):
    """Owner can fetch discovery suggestions."""
    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_member_cannot_fetch_suggestions(
    client: AsyncClient, auth_headers_user2: dict, test_group, session, test_user_2
):
    """Regular member cannot fetch suggestions."""
    await create_membership(session, test_user_2, test_group)
    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_non_member_cannot_fetch_suggestions(
    client: AsyncClient, auth_headers_user2: dict, test_group
):
    """Non-member cannot fetch suggestions."""
    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_suggestions_no_private_fields(
    client: AsyncClient, auth_headers: dict, test_group
):
    """Suggestions response must not leak private/member data."""
    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Must not contain any private fields
    for key in ["members", "memberships", "discordId", "discord_id",
                "notes", "rsvp", "gear", "ownerId", "owner_id",
                "userId", "user_id", "availability"]:
        assert key not in data, f"Suggestions leaked private field: {key}"


@pytest.mark.asyncio
async def test_suggestions_with_roster_gaps(
    client: AsyncClient, auth_headers: dict, test_group, session
):
    """Suggestions should infer needed roles from unconfigured roster slots."""
    from tests.factories import create_tier_snapshot, create_snapshot_player

    tier = await create_tier_snapshot(session, test_group)
    # Fill some positions, leave T2 and H2 empty
    await create_snapshot_player(session, tier, name="Tank1", job="WAR", role="tank", position="T1")
    await create_snapshot_player(session, tier, name="Healer1", job="WHM", role="healer", position="H1")
    await create_snapshot_player(session, tier, name="Melee1", job="DRG", role="melee", position="M1")
    await create_snapshot_player(session, tier, name="Melee2", job="NIN", role="melee", position="M2")
    await create_snapshot_player(session, tier, name="Ranged1", job="BRD", role="ranged", position="R1")
    await create_snapshot_player(session, tier, name="Ranged2", job="MCH", role="ranged", position="R2")

    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # T2 and H2 are missing, so tank and healer should be suggested
    assert "neededRoles" in data
    assert "tank" in data["neededRoles"]
    assert "healer" in data["neededRoles"]
    # melee/ranged should NOT be suggested since they're filled
    assert "melee" not in data["neededRoles"]
    assert "ranged" not in data["neededRoles"]


@pytest.mark.asyncio
async def test_suggestions_with_lodestone_server(
    client: AsyncClient, auth_headers: dict, test_group, session
):
    """Suggestions should infer server from lodestone-linked players."""
    from tests.factories import create_tier_snapshot, create_snapshot_player

    tier = await create_tier_snapshot(session, test_group)
    p1 = await create_snapshot_player(session, tier, name="P1", position="T1")
    p2 = await create_snapshot_player(session, tier, name="P2", position="H1")
    p3 = await create_snapshot_player(session, tier, name="P3", position="M1")

    # Set lodestone servers directly
    p1.lodestone_server = "Jenova"
    p2.lodestone_server = "Jenova"
    p3.lodestone_server = "Gilgamesh"
    await session.flush()

    resp = await client.get(
        SUGGESTIONS_URL.format(test_group.id),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Majority is Jenova
    assert data.get("server") == "Jenova"


# --- Text search tests ---


@pytest.mark.asyncio
async def test_text_search_by_name(client: AsyncClient, session, test_user: User):
    """Text query matches static name."""
    await create_static_group(
        session, test_user, name="Weekend Warriors", is_public=True,
        settings=_discovery_settings(description="Casual group"),
    )
    await create_static_group(
        session, test_user, name="Monday Misfits", is_public=True,
        settings=_discovery_settings(description="Midcore group"),
    )

    resp = await client.get(ENDPOINT, params={"q": "warriors"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Weekend Warriors"


@pytest.mark.asyncio
async def test_text_search_by_description(client: AsyncClient, session, test_user: User):
    """Text query matches description."""
    await create_static_group(
        session, test_user, name="Group A", is_public=True,
        settings=_discovery_settings(description="Looking for a dragoon main"),
    )
    await create_static_group(
        session, test_user, name="Group B", is_public=True,
        settings=_discovery_settings(description="Need healers"),
    )

    resp = await client.get(ENDPOINT, params={"q": "dragoon"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Group A"


@pytest.mark.asyncio
async def test_text_search_only_public_opted_in(client: AsyncClient, session, test_user: User):
    """Text search only returns public + opted-in statics."""
    # Private static with matching name
    await create_static_group(
        session, test_user, name="Secret Searchable", is_public=False,
        settings=_discovery_settings(enabled=True),
    )
    # Public but not opted in
    await create_static_group(
        session, test_user, name="Public Searchable", is_public=True,
        settings=_discovery_settings(enabled=False),
    )

    resp = await client.get(ENDPOINT, params={"q": "Searchable"})
    assert resp.json()["total"] == 0


# --- Sort tests ---


@pytest.mark.asyncio
async def test_sort_by_name(client: AsyncClient, session, test_user: User):
    await create_static_group(
        session, test_user, name="Zeta Squad", is_public=True,
        settings=_discovery_settings(),
    )
    await create_static_group(
        session, test_user, name="Alpha Team", is_public=True,
        settings=_discovery_settings(),
    )

    resp = await client.get(ENDPOINT, params={"sort": "name"})
    data = resp.json()
    assert data["total"] == 2
    assert data["items"][0]["name"] == "Alpha Team"
    assert data["items"][1]["name"] == "Zeta Squad"
