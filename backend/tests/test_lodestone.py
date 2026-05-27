"""Tests for Lodestone search and sync behavior."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import MemberRole
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
)


@pytest.fixture(autouse=True)
def lodestone_settings():
    with patch("app.routers.lodestone.settings") as mock_settings:
        mock_settings.environment = "development"
        mock_settings.dev_lodestone_mock = False
        yield mock_settings


def _mock_http_response(status_code: int, payload=None, json_error: Exception | None = None):
    response = MagicMock()
    response.status_code = status_code
    if json_error is not None:
        response.json.side_effect = json_error
    else:
        response.json.return_value = payload
    return response


def _mock_http_client(response):
    client = AsyncMock()
    client.get.return_value = response
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


def _gear_slot(
    *,
    slot: str,
    bis_source: str,
    item_id: int,
    item_level: int,
    item_name: str,
    current_source: str = "crafted",
    has_item: bool = False,
    is_augmented: bool = False,
    item_icon: str | None = None,
):
    return {
        "slot": slot,
        "bisSource": bis_source,
        "itemId": item_id,
        "itemLevel": item_level,
        "itemName": item_name,
        "itemIcon": item_icon,
        "currentSource": current_source,
        "hasItem": has_item,
        "isAugmented": is_augmented,
    }


@pytest.mark.asyncio
async def test_successful_lodestone_sync_updates_equipped_state(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            ),
            _gear_slot(
                slot="head",
                bis_source="raid",
                item_id=1002,
                item_level=790,
                item_name="Cruiserweight Champion's Helm",
            ),
        ],
    )

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Mock Raider",
                "Server": "Gilgamesh",
                "Avatar": "https://example.test/mock-raider.png",
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 1001},
                        "Head": {"ID": 1002},
                    }
                }
            }
        },
    )

    async def lookup(item_id: int):
        if item_id == 1001:
            return {"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}
        return {"id": 1002, "name": "Cruiserweight Champion's Helm", "level": 790, "icon": "head.png"}

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=AsyncMock(side_effect=lookup)),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999001",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["lodestoneId"] == "999001"
    assert payload["updatedSlots"] == 2
    assert payload["gear"][0]["hasItem"] is True
    assert payload["gear"][0]["currentSource"] == "savage"
    assert payload["gear"][1]["hasItem"] is True
    assert payload["gear"][1]["currentSource"] == "savage"

    await session.refresh(player)
    assert player.lodestone_id == "999001"
    assert player.last_sync is not None
    assert player.gear[0]["hasItem"] is True
    assert player.gear[1]["currentSource"] == "savage"


@pytest.mark.asyncio
async def test_dev_mock_search_preview_and_sync(
    client,
    session,
    test_user,
    auth_headers,
    lodestone_settings,
):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=200001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )

    lodestone_settings.dev_lodestone_mock = True

    status_response = await client.get("/api/lodestone/status", headers=auth_headers)
    search_response = await client.get(
        "/api/lodestone/search?name=Mock%20Raider",
        headers=auth_headers,
    )
    preview_response = await client.get(
        "/api/lodestone/character/910001",
        headers=auth_headers,
    )
    sync_response = await client.post(
        f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=910001",
        headers=auth_headers,
    )

    assert status_response.status_code == 200
    assert status_response.json()["mockMode"] is True
    assert "Mock Raider" in status_response.json()["mockSearchNames"]

    assert search_response.status_code == 200
    search_payload = search_response.json()
    assert search_payload["results"][0]["name"] == "Mock Raider"
    assert search_payload["results"][0]["server"] == "Gilgamesh"

    assert preview_response.status_code == 200
    preview_payload = preview_response.json()
    assert preview_payload["name"] == "Mock Raider"
    assert preview_payload["server"] == "Gilgamesh"
    assert preview_payload["gear"][0]["itemName"] == "Cruiserweight Champion's Spear"

    assert sync_response.status_code == 200
    await session.refresh(player)
    assert player.lodestone_id == "910001"


@pytest.mark.asyncio
async def test_worse_gear_clears_stale_has_item_state(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
                current_source="savage",
                has_item=True,
            )
        ],
    )

    response = _mock_http_response(
        200,
        {
            "Character": {
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 2001},
                    }
                }
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 2001, "name": "Agonist's Spear", "level": 770, "icon": "crafted.png"}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999002",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["gear"][0]["hasItem"] is False
    assert payload["gear"][0]["currentSource"] == "crafted"
    assert payload["gear"][0]["isAugmented"] is False

    await session.refresh(player)
    assert player.gear[0]["hasItem"] is False
    assert player.gear[0]["currentSource"] == "crafted"


@pytest.mark.asyncio
async def test_missing_gearset_does_not_stamp_last_sync(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )

    response = _mock_http_response(200, {"Character": {"Name": "Missing Gear"}})

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999003",
            headers=auth_headers,
        )

    assert sync_response.status_code == 502
    assert sync_response.json()["detail"] == "Character gear is unavailable from Lodestone"

    await session.refresh(player)
    assert player.lodestone_id is None
    assert player.last_sync is None


@pytest.mark.asyncio
async def test_malformed_xivapi_json_returns_controlled_error(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )

    response = _mock_http_response(200, json_error=ValueError("bad json"))

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999004",
            headers=auth_headers,
        )

    assert sync_response.status_code == 502
    assert sync_response.json()["detail"] == "Invalid response from XIVAPI"

    await session.refresh(player)
    assert player.lodestone_id is None
    assert player.last_sync is None


@pytest.mark.asyncio
async def test_item_lookup_failure_preserves_useful_current_source(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
                current_source="savage",
                has_item=True,
            )
        ],
    )

    response = _mock_http_response(
        200,
        {
            "Character": {
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 1001},
                    }
                }
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 1001, "name": "Unknown", "level": 0, "icon": None}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999005",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["gear"][0]["currentSource"] == "savage"
    assert payload["gear"][0]["hasItem"] is True

    await session.refresh(player)
    assert player.gear[0]["currentSource"] == "savage"
    assert player.gear[0]["hasItem"] is True
    assert player.last_sync is not None


@pytest.mark.asyncio
async def test_member_can_sync_their_own_player_only(client, session, test_user, test_user_2, auth_headers_user2):
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )
    player.user_id = test_user_2.id

    response = _mock_http_response(
        200,
        {
            "Character": {
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 1001},
                    }
                }
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999006",
            headers=auth_headers_user2,
        )

    assert sync_response.status_code == 200


@pytest.mark.asyncio
async def test_member_cannot_sync_another_players_card(client, session, test_user, test_user_2, auth_headers_user2):
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )
    player.user_id = test_user.id

    sync_response = await client.post(
        f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999007",
        headers=auth_headers_user2,
    )

    assert sync_response.status_code == 403
    assert sync_response.json()["detail"] == "Members can only sync their own player"


@pytest.mark.asyncio
async def test_unauthenticated_user_gets_401_for_sync(client, session, test_user):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )

    sync_response = await client.post(
        f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999008",
    )

    assert sync_response.status_code == 401
