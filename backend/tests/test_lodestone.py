"""Tests for Lodestone search and sync behavior."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import MemberRole
from app.services.tomestone_provider import (
    TomestoneProvider,
    _is_likely_character_avatar_url,
    _normalize_tomestone_gear_list,
    tomestone_profile_to_xivapi_payload,
)
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
        mock_settings.tomestone_api_token = ""
        yield mock_settings


@pytest.fixture()
def xivapi_unavailable():
    """Mock XIVAPI as unavailable so Tomestone-only tests fall through correctly."""
    fail_response = _mock_http_response(502, {"message": "Lodestone unavailable"})
    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(fail_response)):
        yield


def _mock_http_response(
    status_code: int,
    payload=None,
    json_error: Exception | None = None,
    *,
    text: str = "",
    headers: dict[str, str] | None = None,
):
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    response.headers = headers or {}
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


def _mock_http_client_error(exc: Exception):
    client = AsyncMock()
    client.get.side_effect = exc
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


class _TomestoneSettings:
    def __init__(self, token: str = ""):
        self.tomestone_api_token = token


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


LODESTONE_IDENTITY_HTML = """
<!doctype html>
<html>
  <head>
    <title>Lylarai Ivalice | FINAL FANTASY XIV, The Lodestone</title>
    <meta property="og:title" content="Lylarai Ivalice | FINAL FANTASY XIV, The Lodestone">
    <meta property="og:image" content="https://img.finalfantasyxiv.com/lds/promo/banner.png">
  </head>
  <body>
    <p class="frame__chara__title">Goddess of Magic</p>
    <img class="frame__chara__face" src="https://lds-img.finalfantasyxiv.com/h/F/character-face.png">
    <p class="frame__chara__name">Lylarai Ivalice</p>
    <p class="frame__chara__world"><i data-tooltip="Home World"></i>Tonberry [Elemental]</p>
  </body>
</html>
"""


@pytest.mark.asyncio
async def test_tomestone_provider_disabled_without_token():
    provider = TomestoneProvider(_TomestoneSettings())

    result = await provider.fetch_profile_by_id(14112966)

    assert provider.enabled is False
    assert result.available is False
    assert result.error == "disabled"


@pytest.mark.asyncio
async def test_tomestone_provider_uses_bearer_token_without_exposing_it():
    response = _mock_http_response(
        200,
        {
            "name": "Lylarai Ivalice",
            "server": "Tonberry",
            "avatar": "https://example.test/avatar.png",
            "gear": [{"id": 123}],
        },
    )
    client = _mock_http_client(response)
    fixture_credential = "".join(["placeholder", "-credential"])
    provider = TomestoneProvider(_TomestoneSettings(fixture_credential))

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=client):
        result = await provider.fetch_profile_by_id(14112966)

    assert result.available is True
    assert result.character is not None
    assert result.character["name"] == "Lylarai Ivalice"
    assert result.character["server"] == "Tonberry"
    assert result.character["avatar"] == "https://example.test/avatar.png"
    assert result.character["has_gear"] is True

    _, kwargs = client.get.call_args
    assert kwargs["headers"]["Authorization"] == f"Bearer {fixture_credential}"
    assert "Authorization" not in (result.raw or {})


@pytest.mark.asyncio
async def test_live_search_private_403_returns_dev_error_code(client, auth_headers):
    response = _mock_http_response(
        403,
        {
            "Error": True,
            "Subject": "XIVAPI ERROR",
            "Message": "This page is private: /lodestone/character",
            "Ex": "Lodestone\\Exceptions\\LodestonePrivateException",
            "ExCode": 403,
        },
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 502
    assert search_response.json()["detail"] == "upstream_private"


@pytest.mark.asyncio
async def test_live_search_generic_403_returns_unavailable_dev_error_code(client, auth_headers):
    response = _mock_http_response(403, {"message": "forbidden"})

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 502
    assert search_response.json()["detail"] == "upstream_unavailable"


@pytest.mark.asyncio
async def test_live_search_timeout_returns_dev_error_code(client, auth_headers):
    import httpx

    with patch(
        "app.routers.lodestone.httpx.AsyncClient",
        return_value=_mock_http_client_error(httpx.TimeoutException("slow")),
    ):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 504
    assert search_response.json()["detail"] == "upstream_timeout"


@pytest.mark.asyncio
async def test_live_search_bad_json_returns_dev_error_code(client, auth_headers):
    response = _mock_http_response(200, json_error=ValueError("bad json"))

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 502
    assert search_response.json()["detail"] == "upstream_bad_response"


@pytest.mark.asyncio
async def test_live_search_missing_results_returns_dev_error_code(client, auth_headers):
    response = _mock_http_response(200, {"Pagination": {"ResultsTotal": 0}})

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 502
    assert search_response.json()["detail"] == "upstream_bad_response"


@pytest.mark.asyncio
async def test_live_search_no_results_returns_empty_list(client, auth_headers):
    response = _mock_http_response(
        200,
        {"Results": [], "Pagination": {"ResultsTotal": 0}},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=DefinitelyTypoNoResults&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 200
    assert search_response.json() == {"results": [], "total": 0}


@pytest.mark.asyncio
async def test_character_preview_by_numeric_id_works(client, auth_headers):
    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Lylarai Ivalice",
                "Server": "Tonberry",
                "Avatar": "https://example.test/character-avatar-lylarai.png",
                "GearSet": {"Gear": {"MainHand": {"ID": 1001}}},
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
        preview_response = await client.get("/api/lodestone/character/12345678", headers=auth_headers)

    assert preview_response.status_code == 200
    payload = preview_response.json()
    assert payload["lodestoneId"] == 12345678
    assert payload["name"] == "Lylarai Ivalice"
    assert payload["server"] == "Tonberry"
    assert payload["gear"][0]["itemName"] == "Cruiserweight Champion's Spear"


@pytest.mark.asyncio
async def test_tomestone_profile_by_id_can_power_character_preview(
    client,
    auth_headers,
    lodestone_settings,
):
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    response = _mock_http_response(
        200,
        {
            "id": 14122967,
            "name": "Lylarai Ivalice",
            "server": "Tonberry",
            "avatar": "https://example.test/character-avatar-lylarai.png",
            "gear": [
                {"slot": "weapon", "itemId": 1001},
            ],
        },
    )

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}),
        ),
    ):
        preview_response = await client.get("/api/lodestone/character/14122967", headers=auth_headers)

    assert preview_response.status_code == 200
    payload = preview_response.json()
    assert payload["lodestoneId"] == 14122967
    assert payload["name"] == "Lylarai Ivalice"
    assert payload["server"] == "Tonberry"
    assert payload["avatar"] == "https://example.test/character-avatar-lylarai.png"
    assert payload["gear"][0]["itemName"] == "Cruiserweight Champion's Spear"


@pytest.mark.asyncio
async def test_tomestone_identity_only_profile_returns_identity_only_preview(
    client,
    auth_headers,
    lodestone_settings,
):
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(
        200,
        {
            "id": 14112967,
            "name": "Lylarai Ivalice",
            "server": "Tonberry",
            "avatar": "https://example.test/character-avatar-lylarai.png",
        },
    )
    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)):
        preview_response = await client.get("/api/lodestone/character/14122968", headers=auth_headers)

    assert preview_response.status_code == 200
    payload = preview_response.json()
    assert payload["name"] == "Lylarai Ivalice"
    assert payload["server"] == "Tonberry"
    assert payload["avatar"] == "https://example.test/character-avatar-lylarai.png"
    assert payload["gearAvailable"] is False
    assert payload["identityOnly"] is True
    assert payload["source"] == "tomestone_identity"
    assert payload["gear"] == []


@pytest.mark.asyncio
async def test_tomestone_auth_failure_falls_back_without_leaking_token(
    client,
    auth_headers,
    lodestone_settings,
):
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(403, {"error": "forbidden"})
    xivapi_response = _mock_http_response(500, {"message": "Cannot get Lodestone character data"})

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(xivapi_response)),
    ):
        preview_response = await client.get("/api/lodestone/character/14122969", headers=auth_headers)

    assert preview_response.status_code == 502
    assert preview_response.json()["detail"] == "upstream_character_unavailable"
    assert "placeholder-provider-key" not in str(preview_response.json())


@pytest.mark.asyncio
async def test_tomestone_unknown_payload_falls_back_safely(
    client,
    auth_headers,
    lodestone_settings,
):
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(200, {"unexpected": True})
    xivapi_response = _mock_http_response(500, {"message": "Cannot get Lodestone character data"})

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(xivapi_response)),
    ):
        preview_response = await client.get("/api/lodestone/character/14122970", headers=auth_headers)

    assert preview_response.status_code == 502
    assert preview_response.json()["detail"] == "upstream_character_unavailable"


@pytest.mark.asyncio
async def test_tomestone_identity_only_link_stores_identity_without_gear_sync(
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
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
                current_source="crafted",
                has_item=False,
                is_augmented=False,
            )
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(
        200,
        {
            "id": 14122971,
            "name": "Identity Only Raider",
            "server": "Tonberry",
            "avatar": "https://example.test/character-avatar-identity-only.png",
        },
    )

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=14122971",
            headers=auth_headers,
        )

    assert link_response.status_code == 200
    payload = link_response.json()
    assert payload["lodestoneName"] == "Identity Only Raider"
    assert payload["lodestoneServer"] == "Tonberry"
    assert payload["lodestoneAvatarUrl"] == "https://example.test/character-avatar-identity-only.png"
    assert payload["gearAvailable"] is False
    assert payload["identityOnly"] is True
    assert payload["source"] == "tomestone_identity"

    await session.refresh(player)
    assert player.lodestone_id == "14122971"
    assert player.lodestone_name == "Identity Only Raider"
    assert player.lodestone_avatar_url == "https://example.test/character-avatar-identity-only.png"
    assert player.last_sync is None
    assert player.gear[0]["hasItem"] is False
    assert player.gear[0]["currentSource"] == "crafted"
    assert player.gear[0]["isAugmented"] is False


@pytest.mark.asyncio
async def test_tomestone_profile_by_name_can_power_search(
    client,
    auth_headers,
    lodestone_settings,
):
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    response = _mock_http_response(
        200,
        {
            "id": 14112968,
            "name": "Lylarai Ivalice",
            "server": "Tonberry",
            "avatar": "https://example.test/character-avatar-lylarai.png",
        },
    )

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        search_response = await client.get(
            "/api/lodestone/search?name=Lylarai%20Ivalice&server=Tonberry",
            headers=auth_headers,
        )

    assert search_response.status_code == 200
    assert search_response.json() == {
        "results": [
            {
                "lodestoneId": 14112968,
                "name": "Lylarai Ivalice",
                "server": "Tonberry",
                "avatar": "https://example.test/character-avatar-lylarai.png",
            }
        ],
        "total": 1,
    }


@pytest.mark.asyncio
async def test_character_preview_upstream_403_returns_controlled_error(client, auth_headers):
    response = _mock_http_response(
        403,
        {
            "Error": True,
            "Message": "This page is private: /lodestone/character/87654321",
            "Ex": "Lodestone\\Exceptions\\LodestonePrivateException",
        },
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        preview_response = await client.get("/api/lodestone/character/87654321", headers=auth_headers)

    assert preview_response.status_code == 502
    assert preview_response.json()["detail"] == "upstream_character_unavailable"


@pytest.mark.asyncio
async def test_character_preview_upstream_500_returns_character_unavailable(client, auth_headers):
    response = _mock_http_response(500, {"message": "Cannot get Lodestone character data"})

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        preview_response = await client.get("/api/lodestone/character/14112966", headers=auth_headers)

    assert preview_response.status_code == 502
    assert preview_response.json()["detail"] == "upstream_character_unavailable"


@pytest.mark.asyncio
async def test_direct_lodestone_identity_fallback_links_identity_only(client, session, test_user, auth_headers):
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
                current_source="crafted",
                has_item=False,
                is_augmented=False,
            )
        ],
    )

    response = _mock_http_response(
        200,
        text=LODESTONE_IDENTITY_HTML,
        headers={"content-type": "text/html; charset=UTF-8"},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert link_response.status_code == 200
    payload = link_response.json()
    assert payload["lodestoneId"] == "14112966"
    assert payload["lodestoneName"] == "Lylarai Ivalice"
    assert payload["lodestoneServer"] == "Tonberry"
    assert payload["lodestoneAvatarUrl"] == "https://lds-img.finalfantasyxiv.com/h/F/character-face.png"
    assert payload["gearSyncAvailable"] is False

    await session.refresh(player)
    assert player.lodestone_id == "14112966"
    assert player.lodestone_name == "Lylarai Ivalice"
    assert player.lodestone_server == "Tonberry"
    assert player.lodestone_avatar_url == "https://lds-img.finalfantasyxiv.com/h/F/character-face.png"
    assert player.last_sync is None
    assert player.gear[0]["hasItem"] is False
    assert player.gear[0]["currentSource"] == "crafted"
    assert player.gear[0]["isAugmented"] is False


@pytest.mark.asyncio
async def test_direct_lodestone_identity_rejects_generic_avatar_image(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(session, tier)

    html = LODESTONE_IDENTITY_HTML.replace(
        '<img class="frame__chara__face" src="https://lds-img.finalfantasyxiv.com/h/F/character-face.png">',
        "",
    )
    response = _mock_http_response(
        200,
        text=html,
        headers={"content-type": "text/html; charset=UTF-8"},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert link_response.status_code == 200
    assert link_response.json()["lodestoneAvatarUrl"] is None

    await session.refresh(player)
    assert player.lodestone_avatar_url is None
    assert player.last_sync is None


@pytest.mark.asyncio
async def test_direct_lodestone_identity_invalid_id_rejected(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(session, tier)

    link_response = await client.post(
        f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=not-a-number",
        headers=auth_headers,
    )

    assert link_response.status_code == 422


@pytest.mark.asyncio
async def test_direct_lodestone_identity_404_returns_controlled_error(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(session, tier)

    response = _mock_http_response(
        404,
        text="<html><title>FINAL FANTASY XIV, The Lodestone</title></html>",
        headers={"content-type": "text/html; charset=UTF-8"},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=999999999",
            headers=auth_headers,
        )

    assert link_response.status_code == 404
    assert link_response.json()["detail"] == "Character not found on Lodestone"


@pytest.mark.asyncio
async def test_direct_lodestone_identity_unexpected_html_returns_controlled_error(client, session, test_user, auth_headers):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(session, tier)

    response = _mock_http_response(
        200,
        text="<html><title>Unexpected</title><body>captcha</body></html>",
        headers={"content-type": "text/html; charset=UTF-8"},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert link_response.status_code == 502
    assert link_response.json()["detail"] == "lodestone_bad_response"


@pytest.mark.asyncio
async def test_direct_lodestone_identity_malformed_html_does_not_wipe_existing_identity(
    client,
    session,
    test_user,
    auth_headers,
):
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(session, tier)
    player.lodestone_id = "14112966"
    player.lodestone_name = "Existing Raider"
    player.lodestone_server = "Gilgamesh"
    player.lodestone_avatar_url = "https://example.test/existing.png"

    response = _mock_http_response(
        200,
        text="<html><title>Missing identity</title></html>",
        headers={"content-type": "text/html; charset=UTF-8"},
    )

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        link_response = await client.post(
            f"/api/lodestone/identity/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert link_response.status_code == 502
    assert link_response.json()["detail"] == "lodestone_bad_response"

    await session.refresh(player)
    assert player.lodestone_name == "Existing Raider"
    assert player.lodestone_server == "Gilgamesh"
    assert player.lodestone_avatar_url == "https://example.test/existing.png"
    assert player.last_sync is None


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
                "Avatar": "https://example.test/character-avatar-mock-raider.png",
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
    assert payload["lodestoneName"] == "Mock Raider"
    assert payload["lodestoneServer"] == "Gilgamesh"
    assert payload["lodestoneAvatarUrl"] == "https://example.test/character-avatar-mock-raider.png"
    assert payload["updatedSlots"] == 2
    assert payload["gear"][0]["hasItem"] is True
    assert payload["gear"][0]["currentSource"] == "savage"
    assert payload["gear"][1]["hasItem"] is True
    assert payload["gear"][1]["currentSource"] == "savage"

    await session.refresh(player)
    assert player.lodestone_id == "999001"
    assert player.lodestone_name == "Mock Raider"
    assert player.lodestone_server == "Gilgamesh"
    assert player.lodestone_avatar_url == "https://example.test/character-avatar-mock-raider.png"
    assert player.last_sync is not None
    assert player.gear[0]["hasItem"] is True
    assert player.gear[1]["currentSource"] == "savage"


@pytest.mark.asyncio
async def test_tomestone_profile_can_power_full_sync(
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
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            )
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    response = _mock_http_response(
        200,
        {
            "id": 14112969,
            "name": "Tomestone Raider",
            "world": "Tonberry",
            "avatarUrl": "https://example.test/character-avatar-tomestone-raider.png",
            "job": {"abbreviation": "DRG", "level": 100},
            "equipment": {
                "weapon": {"item_id": 1001},
            },
        },
    )

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=14112969",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["lodestoneName"] == "Tomestone Raider"
    assert payload["lodestoneServer"] == "Tonberry"
    assert payload["lodestoneAvatarUrl"] == "https://example.test/character-avatar-tomestone-raider.png"
    assert payload["gear"][0]["hasItem"] is True

    await session.refresh(player)
    assert player.lodestone_id == "14112969"
    assert player.lodestone_name == "Tomestone Raider"
    assert player.gear[0]["hasItem"] is True


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
    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])

    with patch("app.services.tomestone_provider.httpx.AsyncClient") as tomestone_client:
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

    tomestone_client.assert_not_called()

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

    # XIVAPI bad JSON → caught, falls through to Tomestone (disabled) → both fail
    assert sync_response.status_code == 502

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
async def test_missing_avatar_does_not_crash_sync(client, session, test_user, auth_headers):
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

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "No Avatar Raider",
                "Server": "Gilgamesh",
                "GearSet": {"Gear": {"MainHand": {"ID": 1001}}},
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
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999009",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["lodestoneName"] == "No Avatar Raider"
    assert payload["lodestoneServer"] == "Gilgamesh"
    assert payload["lodestoneAvatarUrl"] is None


@pytest.mark.asyncio
async def test_malformed_avatar_data_preserves_existing_cached_avatar(client, session, test_user, auth_headers):
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
    player.lodestone_avatar_url = "https://example.test/existing-avatar.png"

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Malformed Avatar Raider",
                "Server": "Gilgamesh",
                "Avatar": {"url": "not-a-string"},
                "GearSet": {"Gear": {"MainHand": {"ID": 1001}}},
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
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=999010",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    assert sync_response.json()["lodestoneAvatarUrl"] == "https://example.test/existing-avatar.png"


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


# ---------------------------------------------------------------------------
# Unit tests for Tomestone provider normalization
# ---------------------------------------------------------------------------

# Real Tomestone payload shape: gear is a positional list under
# profile.currentGearSetAndAttributes.gearSet.gear
# Each item: {"item": {"id": <int>, "name": "...", "itemLevel": <int>, "icon": "...", ...}}
_TOMESTONE_REAL_SHAPE_PAYLOAD = {
    "name": "Lylarai Ivalice",
    "world": "Tonberry",
    "avatarUrl": "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg",
    "profile": {
        "currentGearSetAndAttributes": {
            "gearSet": {
                "gear": [
                    # 0 MainHand
                    {"item": {"id": 44091, "name": "Warg Sword of Fending", "itemLevel": 730, "icon": "https://assets.tomestone.gg/i/044000/044091.png", "categoryName": "Sword", "categoryId": 1}},
                    # 1 Head
                    {"item": {"id": 44101, "name": "Warg Helm of Fending", "itemLevel": 730, "icon": "https://assets.tomestone.gg/i/044000/044101.png", "categoryName": "Head", "categoryId": 34}},
                    # 2 Body
                    {"item": {"id": 44102, "name": "Warg Mail of Fending", "itemLevel": 730, "icon": None, "categoryName": "Body", "categoryId": 35}},
                    # 3 Hands
                    {"item": {"id": 44103, "name": "Warg Gauntlets of Fending", "itemLevel": 730, "icon": None, "categoryName": "Hands", "categoryId": 37}},
                    # 4 Legs
                    {"item": {"id": 44104, "name": "Warg Breeches of Fending", "itemLevel": 730, "icon": None, "categoryName": "Legs", "categoryId": 36}},
                    # 5 Feet
                    {"item": {"id": 44105, "name": "Warg Sollerets of Fending", "itemLevel": 730, "icon": None, "categoryName": "Feet", "categoryId": 38}},
                    # 6 Earrings
                    {"item": {"id": 44111, "name": "Warg Earrings of Fending", "itemLevel": 730, "icon": None, "categoryName": "Earrings", "categoryId": 41}},
                    # 7 Necklace
                    {"item": {"id": 44112, "name": "Warg Necklace of Fending", "itemLevel": 730, "icon": None, "categoryName": "Necklace", "categoryId": 40}},
                    # 8 Bracelets
                    {"item": {"id": 44113, "name": "Warg Bracelets of Fending", "itemLevel": 730, "icon": None, "categoryName": "Bracelets", "categoryId": 42}},
                    # 9 Ring1
                    {"item": {"id": 44114, "name": "Warg Ring of Fending", "itemLevel": 730, "icon": None, "categoryName": "Ring", "categoryId": 43}},
                    # 10 Ring2
                    {"item": {"id": 44115, "name": "Warg Ring of Fending", "itemLevel": 730, "icon": None, "categoryName": "Ring", "categoryId": 43}},
                    # 11 Soul Crystal — must be skipped
                    {"item": {"id": 10337, "name": "Soul of the Paladin", "itemLevel": 30, "icon": None, "categoryName": "Soul Crystal", "categoryId": 62}},
                ]
            }
        }
    },
}


def test_tomestone_real_shape_gear_normalization():
    """Positional gear list from Tomestone's deep path normalizes to XIVAPI Gear dict."""
    payload = tomestone_profile_to_xivapi_payload(_TOMESTONE_REAL_SHAPE_PAYLOAD, fallback_lodestone_id=14112966)
    assert payload is not None

    char = payload["Character"]
    assert char["Name"] == "Lylarai Ivalice"
    assert char["Server"] == "Tonberry"

    gear = char["GearSet"]["Gear"]
    assert isinstance(gear, dict)
    assert "MainHand" in gear
    assert gear["MainHand"]["ID"] == 44091
    assert gear["MainHand"]["Icon"] == "https://assets.tomestone.gg/i/044000/044091.png"
    assert "Head" in gear
    assert gear["Head"]["ID"] == 44101
    assert "Ring1" in gear
    assert gear["Ring1"]["ID"] == 44114
    assert "Ring2" in gear
    assert gear["Ring2"]["ID"] == 44115
    # Soul Crystal must not appear
    assert len(gear) == 11


def test_tomestone_soul_crystal_position_is_skipped():
    """Position 11 (Soul Crystal) is excluded from normalized gear."""
    gear_list = [
        {"item": {"id": 44091, "name": "Sword", "itemLevel": 730, "categoryName": "Sword"}},
        *[{} for _ in range(9)],  # positions 1-9 empty
        {},  # position 10 empty
        # position 11 Soul Crystal
        {"item": {"id": 10337, "name": "Soul of the Paladin", "itemLevel": 30, "categoryName": "Soul Crystal"}},
    ]
    result = _normalize_tomestone_gear_list(gear_list)
    assert "MainHand" in result
    assert result["MainHand"]["ID"] == 44091
    # No Soul Crystal key (position 11 not in TOMESTONE_GEAR_POSITION_SLOTS)
    assert all("soul" not in k.lower() for k in result)


def test_tomestone_img2_avatar_url_is_accepted():
    """img2.finalfantasyxiv.com/f/ URLs must pass the avatar URL validator."""
    avatar_url = "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg"
    assert _is_likely_character_avatar_url(avatar_url) is True


def test_tomestone_img2_portrait_url_is_accepted():
    """img2.finalfantasyxiv.com/f/ portrait URLs must also pass the validator."""
    portrait_url = "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_640x873.jpg"
    assert _is_likely_character_avatar_url(portrait_url) is True


def test_tomestone_identity_only_when_no_current_gear_set():
    """Payload without currentGearSetAndAttributes produces valid identity fields but no gear."""
    payload = {
        "name": "Lylarai Ivalice",
        "world": "Tonberry",
        "avatar": "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg",
        "profile": {},
    }
    result = tomestone_profile_to_xivapi_payload(payload, fallback_lodestone_id=14112966)
    assert result is not None
    char = result["Character"]
    assert char["Name"] == "Lylarai Ivalice"
    assert char["Server"] == "Tonberry"
    # No gear items
    gear = char["GearSet"]["Gear"]
    assert gear == {}


def test_tomestone_real_shape_avatar_comes_through():
    """Avatar URL from real Tomestone shape (img2 domain) is preserved through normalization."""
    payload = tomestone_profile_to_xivapi_payload(_TOMESTONE_REAL_SHAPE_PAYLOAD, fallback_lodestone_id=14112966)
    assert payload is not None
    char = payload["Character"]
    assert char["Avatar"] == "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg"


@pytest.mark.asyncio
async def test_tomestone_real_shape_can_power_full_sync(
    client,
    session,
    test_user,
    auth_headers,
    lodestone_settings,
):
    """End-to-end sync using real Tomestone API response shape reaches gear sync."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=44091,
                item_level=730,
                item_name="Warg Sword of Fending",
            )
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(200, _TOMESTONE_REAL_SHAPE_PAYLOAD)

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 44091, "name": "Warg Sword of Fending", "level": 730, "icon": "weapon.png"}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["lodestoneName"] == "Lylarai Ivalice"
    assert payload["lodestoneServer"] == "Tonberry"
    assert payload["lodestoneAvatarUrl"] == "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg"
    assert payload["gear"][0]["hasItem"] is True

    await session.refresh(player)
    assert player.lodestone_id == "14112966"
    assert player.lodestone_name == "Lylarai Ivalice"
    assert player.lodestone_avatar_url == "https://img2.finalfantasyxiv.com/f/acabee91a9ab596d0a26a5932c752f79_7bb6b1e488f0e4f01c5314d010b60f31fc0_96x96.jpg"
    assert player.gear[0]["hasItem"] is True


# ---------------------------------------------------------------------------
# Gear sync semantics — BiS matching, equipped item fields, bis_matched_count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_wrong_item_id_at_right_ilvl_does_not_mark_has_item(
    client, session, test_user, auth_headers
):
    """If the equipped item has a different ID than the BiS target, hasItem must be False.

    This guards against the old loose ilvl-match behaviour where any savage item
    at the right item level was treated as 'has BiS'.
    """
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
                current_source="crafted",
                has_item=False,
            )
        ],
    )

    # Player is wearing item 9999 (same ilvl, different item — e.g. wrong job weapon).
    response = _mock_http_response(
        200,
        {
            "Character": {
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 9999},
                    }
                }
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(
                return_value={"id": 9999, "name": "Wrong Job Spear", "level": 795, "icon": "other.png"}
            ),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990010",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    # Item ID mismatch → not BiS-complete despite matching ilvl.
    assert payload["gear"][0]["hasItem"] is False
    assert payload["gear"][0]["currentSource"] == "savage"
    assert payload["bisMatchedCount"] == 0

    await session.refresh(player)
    assert player.gear[0]["hasItem"] is False


@pytest.mark.asyncio
async def test_no_bis_source_configured_does_not_mark_has_item(
    client, session, test_user, auth_headers
):
    """Slots without a bisSource target should never be marked complete regardless of equipped gear."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    # Slot with no bisSource (empty string simulates unconfigured slot)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            {
                "slot": "weapon",
                "bisSource": "",
                "itemId": None,
                "itemLevel": 795,
                "itemName": "Cruiserweight Champion's Spear",
                "itemIcon": None,
                "currentSource": "crafted",
                "hasItem": False,
                "isAugmented": False,
            }
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
            new=AsyncMock(
                return_value={"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}
            ),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990011",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    # No bisSource → not complete even though item is equipped.
    assert payload["gear"][0]["hasItem"] is False
    assert payload["bisMatchedCount"] == 0


@pytest.mark.asyncio
async def test_equipped_item_fields_stored_separately_from_bis_target(
    client, session, test_user, auth_headers
):
    """Sync must store equippedItemId/Level/Name/Icon without touching BiS target fields."""
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
                current_source="crafted",
                has_item=False,
            )
        ],
    )

    # Player is wearing item 9999 (not their BiS target).
    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Equipped Fields Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 9999},
                    }
                },
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(
                return_value={"id": 9999, "name": "Wrong Job Spear", "level": 770, "icon": "other.png"}
            ),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990012",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    slot = payload["gear"][0]

    # BiS target fields preserved.
    assert slot["itemId"] == 1001
    assert slot["itemName"] == "Cruiserweight Champion's Spear"
    assert slot["itemLevel"] == 795
    assert slot["bisSource"] == "raid"
    assert slot["hasItem"] is False

    # Currently equipped item recorded separately.
    assert slot["equippedItemId"] == 9999
    assert slot["equippedItemName"] == "Wrong Job Spear"
    assert slot["equippedItemLevel"] == 770

    await session.refresh(player)
    g = player.gear[0]
    assert g["itemId"] == 1001
    assert g["equippedItemId"] == 9999
    assert g["equippedItemName"] == "Wrong Job Spear"


@pytest.mark.asyncio
async def test_equipped_item_fields_cleared_when_slot_not_returned_by_lodestone(
    client, session, test_user, auth_headers
):
    """When Lodestone omits a slot from the GearSet, stale equippedItem* fields must be cleared.

    A player may have had a weapon equipped during a previous sync.  If the next
    sync response does not include MainHand (e.g. Lodestone reports only the
    head slot), the weapon slot must have its equippedItem* fields removed so
    the UI does not show stale equipped-gear data.
    """
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    # Both slots have stale equipped-item fields from a previous sync.
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            {
                "slot": "weapon",
                "bisSource": "raid",
                "itemId": 1001,
                "itemLevel": 795,
                "itemName": "Cruiserweight Champion's Spear",
                "itemIcon": None,
                "currentSource": "savage",
                "hasItem": True,
                "isAugmented": False,
                "equippedItemId": 1001,
                "equippedItemLevel": 795,
                "equippedItemName": "Cruiserweight Champion's Spear",
                "equippedItemIcon": None,
            },
            {
                "slot": "head",
                "bisSource": "raid",
                "itemId": 1002,
                "itemLevel": 790,
                "itemName": "Cruiserweight Champion's Helm",
                "itemIcon": None,
                "currentSource": "crafted",
                "hasItem": False,
                "isAugmented": False,
            },
        ],
    )

    # New sync: Lodestone reports the Head item but NOT MainHand.
    # With a real Head item present the endpoint proceeds to the sync loop,
    # at which point the weapon slot finds no equipped data and must be cleared.
    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Partial Gear Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Gear": {
                        "Head": {"ID": 1002},
                    }
                },
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(
                return_value={"id": 1002, "name": "Cruiserweight Champion's Helm", "level": 790, "icon": "head.png"}
            ),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990013",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    gear = sync_response.json()["gear"]
    weapon_slot = next(s for s in gear if s["slot"] == "weapon")
    head_slot = next(s for s in gear if s["slot"] == "head")

    # Weapon: Lodestone didn't report it → stale equipped fields cleared.
    assert weapon_slot["hasItem"] is False
    assert weapon_slot.get("equippedItemId") is None
    assert weapon_slot.get("equippedItemName") is None

    # Head: Lodestone reported it → equipped fields populated (ID 1002 == BiS 1002 → hasItem True).
    assert head_slot["hasItem"] is True
    assert head_slot.get("equippedItemId") == 1002

    await session.refresh(player)
    weapon_db = next(g for g in player.gear if g["slot"] == "weapon")
    assert "equippedItemId" not in weapon_db
    assert "equippedItemName" not in weapon_db


@pytest.mark.asyncio
async def test_bis_matched_count_reflects_only_matching_bis_slots(
    client, session, test_user, auth_headers
):
    """bisMatchedCount must equal the number of slots where the equipped item matches the BiS target."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            # weapon: player has their BiS (ID 1001)
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=1001,
                item_level=795,
                item_name="Cruiserweight Champion's Spear",
            ),
            # head: player has a different item (ID 9999, not BiS 1002)
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
                "Name": "Partial BiS Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Gear": {
                        "MainHand": {"ID": 1001},  # matches BiS
                        "Head": {"ID": 9999},       # does not match BiS 1002
                    }
                },
            }
        },
    )

    async def lookup(item_id: int):
        if item_id == 1001:
            return {"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}
        return {"id": 9999, "name": "Some Other Helm", "level": 790, "icon": "head.png"}

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=AsyncMock(side_effect=lookup)),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990014",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["gear"][0]["hasItem"] is True   # weapon matches
    assert payload["gear"][1]["hasItem"] is False  # head does not match
    assert payload["bisMatchedCount"] == 1


# ---------------------------------------------------------------------------
# Tomestone full-sync: equippedItem* persistence
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tomestone_sync_writes_equipped_item_fields(
    client, session, test_user, auth_headers, lodestone_settings
):
    """Tomestone full sync must write equippedItemId/Level/Name/Icon to each matched gear slot.

    The modal preview uses GET /lodestone/character/{id} (require_usable_gear=False)
    and correctly shows Tomestone current gear.  The sync POST path must use
    the same Tomestone data and persist equippedItem* into the player.gear JSON.
    """
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=44091,
                item_level=730,
                item_name="Warg Sword of Fending",
            ),
            _gear_slot(
                slot="earring",
                bis_source="raid",
                item_id=44111,
                item_level=730,
                item_name="Warg Earrings of Fending",
            ),
            _gear_slot(
                slot="bracelet",
                bis_source="raid",
                item_id=44113,
                item_level=730,
                item_name="Warg Bracelets of Fending",
            ),
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(200, _TOMESTONE_REAL_SHAPE_PAYLOAD)

    garland_data = {
        44091: {"id": 44091, "name": "Warg Sword of Fending", "level": 730, "icon": "sword.png"},
        44111: {"id": 44111, "name": "Warg Earrings of Fending", "level": 730, "icon": "earring.png"},
        44113: {"id": 44113, "name": "Warg Bracelets of Fending", "level": 730, "icon": "bracelet.png"},
    }

    async def mock_garland(item_id: int):
        return garland_data.get(item_id, {"id": item_id, "name": "Unknown", "level": 0, "icon": None})

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=AsyncMock(side_effect=mock_garland)),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200, sync_response.json()
    gear = sync_response.json()["gear"]

    weapon = next(g for g in gear if g["slot"] == "weapon")
    earring = next(g for g in gear if g["slot"] == "earring")
    bracelet = next(g for g in gear if g["slot"] == "bracelet")

    # BiS target fields must be preserved
    assert weapon["itemId"] == 44091
    assert weapon["itemName"] == "Warg Sword of Fending"
    assert weapon["itemLevel"] == 730

    # Currently equipped fields must be written — these are the fields under test
    assert weapon["equippedItemId"] == 44091, f"equippedItemId not set for weapon: {weapon}"
    assert weapon["equippedItemName"] == "Warg Sword of Fending"
    assert weapon["equippedItemLevel"] == 730

    # Accessory slot mapping: Earrings → earring, Bracelets → bracelet
    assert earring["equippedItemId"] == 44111, f"equippedItemId not set for earring: {earring}"
    assert bracelet["equippedItemId"] == 44113, f"equippedItemId not set for bracelet: {bracelet}"

    # DB persistence: re-reading from DB must also have equippedItemId
    await session.refresh(player)
    db_weapon = next(g for g in player.gear if g["slot"] == "weapon")
    assert db_weapon.get("equippedItemId") == 44091, f"equippedItemId not persisted to DB: {db_weapon}"


@pytest.mark.asyncio
async def test_tomestone_sync_equipped_fields_when_garland_fails(
    client, session, test_user, auth_headers, lodestone_settings
):
    """When Garland lookup fails for a Tomestone item, equipped fields fall back to Tomestone's own name/level."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=44091,
                item_level=730,
                item_name="Warg Sword of Fending",
            ),
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(200, _TOMESTONE_REAL_SHAPE_PAYLOAD)

    # Garland always fails for new-patch items
    async def garland_unknown(item_id: int):
        return {"id": item_id, "name": "Unknown", "level": 0, "icon": None}

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=AsyncMock(side_effect=garland_unknown)),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200, sync_response.json()
    gear = sync_response.json()["gear"]
    weapon = next(g for g in gear if g["slot"] == "weapon")

    # Even when Garland fails, Tomestone's own name/level must be used
    assert weapon["equippedItemId"] == 44091, f"equippedItemId not set when Garland fails: {weapon}"
    assert weapon["equippedItemName"] == "Warg Sword of Fending", f"equippedItemName should come from Tomestone"
    assert weapon["equippedItemLevel"] == 730, f"equippedItemLevel should come from Tomestone"


@pytest.mark.asyncio
async def test_tomestone_sync_equipped_fields_via_tier_api(
    client, session, test_user, auth_headers, lodestone_settings
):
    """After Tomestone sync, the tier API must return non-null equippedItemId in GearSlotStatus."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            _gear_slot(
                slot="weapon",
                bis_source="raid",
                item_id=44091,
                item_level=730,
                item_name="Warg Sword of Fending",
            ),
        ],
    )

    lodestone_settings.tomestone_api_token = "".join(["placeholder", "-provider", "-key"])
    tomestone_response = _mock_http_response(200, _TOMESTONE_REAL_SHAPE_PAYLOAD)

    with (
        patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(tomestone_response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 44091, "name": "Warg Sword of Fending", "level": 730, "icon": "sword.png"}),
        ),
    ):
        sync_resp = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=14112966",
            headers=auth_headers,
        )
    assert sync_resp.status_code == 200

    # Fetch tier via API and confirm equippedItemId is not null
    tier_resp = await client.get(
        f"/api/static-groups/{group.id}/tiers/{tier.id}",
        headers=auth_headers,
    )
    assert tier_resp.status_code == 200
    players = tier_resp.json()["players"]
    player_data = next(p for p in players if p["id"] == player.id)
    weapon = next(g for g in player_data["gear"] if g["slot"] == "weapon")

    assert weapon["equippedItemId"] == 44091, f"tier API returned null equippedItemId: {weapon}"
    assert weapon["equippedItemName"] == "Warg Sword of Fending"
    assert weapon["equippedItemLevel"] == 730


# ---------------------------------------------------------------------------
# Sync diagnostics — payload_changed, job mismatch, sync metadata
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unchanged_payload_reports_no_change(client, session, test_user, auth_headers):
    """When synced gear matches what's already stored, payloadChanged is False."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[
            {
                "slot": "weapon",
                "bisSource": "raid",
                "itemId": 1001,
                "itemLevel": 795,
                "itemName": "Cruiserweight Champion's Spear",
                "itemIcon": None,
                "currentSource": "savage",
                "hasItem": True,
                "isAugmented": False,
                "equippedItemId": 1001,
                "equippedItemLevel": 795,
                "equippedItemName": "Cruiserweight Champion's Spear",
                "equippedItemIcon": "weapon.png",
            }
        ],
    )

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Same Gear Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Class": {"Abbreviation": "DRG"},
                    "Gear": {"MainHand": {"ID": 1001}},
                },
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
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990020",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["payloadChanged"] is False
    assert payload["updatedSlots"] == 0
    assert payload["syncSource"] == "xivapi"
    assert payload["syncedJob"] == "DRG"


@pytest.mark.asyncio
async def test_provider_failure_does_not_wipe_gear(client, session, test_user, auth_headers):
    """When provider returns a 502, existing gear remains untouched."""
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

    response = _mock_http_response(502, {"message": "Bad Gateway"})

    with patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990021",
            headers=auth_headers,
        )

    assert sync_response.status_code == 502

    await session.refresh(player)
    assert player.gear[0]["hasItem"] is True
    assert player.gear[0]["currentSource"] == "savage"
    assert player.last_sync is None


@pytest.mark.asyncio
async def test_job_mismatch_warning_when_synced_job_differs(client, session, test_user, auth_headers):
    """When synced gear job differs from player's assigned job, a warning is returned."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        job="DRG",
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

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Job Swap Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Class": {"Abbreviation": "BRD"},
                    "Gear": {"MainHand": {"ID": 9999}},
                },
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch(
            "app.routers.lodestone.fetch_item_from_garland",
            new=AsyncMock(return_value={"id": 9999, "name": "Some Bow", "level": 770, "icon": "bow.png"}),
        ),
    ):
        sync_response = await client.post(
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990022",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["syncedJob"] == "BRD"
    assert payload["jobMismatchWarning"] is not None
    assert "BRD" in payload["jobMismatchWarning"]
    assert "DRG" in payload["jobMismatchWarning"]

    await session.refresh(player)
    assert player.last_synced_job == "BRD"
    assert player.last_sync_source == "xivapi"


@pytest.mark.asyncio
async def test_successful_sync_stores_metadata(client, session, test_user, auth_headers):
    """Successful sync persists syncSource and syncedJob on the player."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        job="DRG",
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

    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Metadata Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Class": {"Abbreviation": "DRG"},
                    "Gear": {"MainHand": {"ID": 1001}},
                },
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
            f"/api/lodestone/sync/{group.id}/{player.id}?lodestone_id=990023",
            headers=auth_headers,
        )

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["syncSource"] == "xivapi"
    assert payload["syncedJob"] == "DRG"
    assert payload["lastSync"] is not None
    assert payload["jobMismatchWarning"] is None
    assert payload["payloadChanged"] is True

    await session.refresh(player)
    assert player.last_sync is not None
    assert player.last_sync_source == "xivapi"
    assert player.last_synced_job == "DRG"


@pytest.mark.asyncio
async def test_force_refresh_bypasses_character_cache(client, auth_headers):
    """force_refresh=true on character endpoint bypasses the 5-minute cache."""
    response = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Fresh Data Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Class": {"Abbreviation": "WAR"},
                    "Gear": {"MainHand": {"ID": 1001}},
                },
            }
        },
    )

    garland_mock = AsyncMock(
        return_value={"id": 1001, "name": "Cruiserweight Champion's Spear", "level": 795, "icon": "weapon.png"}
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=garland_mock),
    ):
        # First call — populates cache
        resp1 = await client.get("/api/lodestone/character/990024", headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["name"] == "Fresh Data Raider"

    # Change the upstream response
    response2 = _mock_http_response(
        200,
        {
            "Character": {
                "Name": "Updated Data Raider",
                "Server": "Gilgamesh",
                "GearSet": {
                    "Class": {"Abbreviation": "WAR"},
                    "Gear": {"MainHand": {"ID": 1001}},
                },
            }
        },
    )

    with (
        patch("app.routers.lodestone.httpx.AsyncClient", return_value=_mock_http_client(response2)),
        patch("app.routers.lodestone.fetch_item_from_garland", new=garland_mock),
    ):
        # Without force_refresh — returns cached "Fresh Data Raider"
        resp2 = await client.get("/api/lodestone/character/990024", headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["name"] == "Fresh Data Raider"

        # With force_refresh — bypasses cache, gets "Updated Data Raider"
        resp3 = await client.get("/api/lodestone/character/990024?force_refresh=true", headers=auth_headers)
        assert resp3.status_code == 200
        assert resp3.json()["name"] == "Updated Data Raider"
