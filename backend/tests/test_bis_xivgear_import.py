"""Tests for XIVGear URL import and multi-set selection."""

from unittest.mock import AsyncMock, patch
from urllib.parse import quote

import pytest

MULTI_SET_DATA = {
    "name": "WHM Sheet",
    "job": "WHM",
    "sets": [
        {"isSeparator": True, "name": "Savage"},
        {
            "name": "2.44 Savage BiS",
            "items": {"Weapon": {"id": 101, "materia": []}},
        },
        {
            "name": "2.29 High DPS",
            "items": {"Weapon": {"id": 202, "materia": []}},
        },
    ],
}


def _xivgear_url(extra: str = "") -> str:
    return f"https://xivgear.app/?page=sl|73551d94-354a-4e30-9205-5d52d2efaf3f{extra}"


@pytest.mark.asyncio
async def test_xivgear_url_import_lists_multiple_set_options(client):
    """A multi-set XIVGear sheet should ask the UI to pick a set first."""
    with (
        patch(
            "app.routers.bis.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=MULTI_SET_DATA),
        ),
        patch("app.routers.bis.try_fetch_xivgear_full_data", new=AsyncMock(return_value=None)),
    ):
        response = await client.get(f"/api/bis/xivgear/{quote(_xivgear_url(), safe='')}")

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["requiresSelection"] is True
    assert data["slots"] == []
    assert [option["index"] for option in data["setOptions"]] == [1, 2]
    assert data["setOptions"][1]["name"] == "2.29 High DPS"
    assert data["setOptions"][1]["gcd"] == "2.29"


@pytest.mark.asyncio
async def test_xivgear_url_import_uses_selected_set(client):
    """Selected set indexes should import that exact set instead of the first set."""

    async def item_lookup(item_id: int):
        return {
            "id": item_id,
            "name": f"Imported Weapon {item_id}",
            "level": 790,
            "icon": f"weapon-{item_id}.png",
            "stats": {},
        }

    with (
        patch(
            "app.routers.bis.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=MULTI_SET_DATA),
        ),
        patch("app.routers.bis.try_fetch_xivgear_full_data", new=AsyncMock(return_value=None)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get(
            f"/api/bis/xivgear/{quote(_xivgear_url('&onlySetIndex=2'), safe='')}"
        )

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["requiresSelection"] is False
    assert data["selectedSetIndex"] == 2
    assert data["name"] == "2.29 High DPS"
    weapon = next(slot for slot in data["slots"] if slot["slot"] == "weapon")
    assert weapon["itemId"] == 202


@pytest.mark.asyncio
async def test_xivgear_url_import_falls_back_when_full_data_unavailable(client):
    """Base data should still import when derived /fulldata labels are unavailable."""

    async def item_lookup(item_id: int):
        return {
            "id": item_id,
            "name": f"Imported Weapon {item_id}",
            "level": 790,
            "icon": f"weapon-{item_id}.png",
            "stats": {},
        }

    with (
        patch(
            "app.routers.bis.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=MULTI_SET_DATA),
        ),
        patch("app.routers.bis.try_fetch_xivgear_full_data", new=AsyncMock(return_value=None)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get(
            f"/api/bis/xivgear/{quote(_xivgear_url(), safe='')}?set_index=1"
        )

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["selectedSetIndex"] == 1
    weapon = next(slot for slot in data["slots"] if slot["slot"] == "weapon")
    assert weapon["itemId"] == 101


PLD_SET_DATA = {
    "name": "PLD Sheet",
    "job": "PLD",
    "sets": [
        {
            "name": "Savage BiS",
            "items": {
                "Weapon": {"id": 49658, "materia": []},
                "OffHand": {"id": 49679, "materia": []},
                "Head": {"id": 49680, "materia": []},
            },
        },
    ],
}


@pytest.mark.asyncio
async def test_xivgear_pld_offhand_imports_to_offhand_slot(client):
    """A PLD set's OffHand item lands in the 'offhand' slot on the weapon iLv ladder."""

    async def item_lookup(item_id: int):
        return {
            "id": item_id,
            "name": f"Item {item_id}",
            "level": 795,
            "icon": f"i-{item_id}.png",
            "stats": {},
        }

    with (
        patch(
            "app.routers.bis.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=PLD_SET_DATA),
        ),
        patch("app.routers.bis.try_fetch_xivgear_full_data", new=AsyncMock(return_value=None)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get(
            f"/api/bis/xivgear/{quote(_xivgear_url(), safe='')}"
        )

    assert response.status_code == 200, response.json()
    slots = response.json()["slots"]
    offhand = next(s for s in slots if s["slot"] == "offhand")
    assert offhand["itemId"] == 49679
    assert offhand["source"] == "raid"  # 795 on the WEAPON ladder = raid


@pytest.mark.asyncio
async def test_xivgear_non_shield_set_emits_no_offhand_placeholder(client):
    """A set WITHOUT an OffHand item must not mint a phantom raid shield target."""

    async def item_lookup(item_id: int):
        return {
            "id": item_id,
            "name": f"Item {item_id}",
            "level": 790,
            "icon": f"i-{item_id}.png",
            "stats": {},
        }

    with (
        patch(
            "app.routers.bis.fetch_bis_from_xivgear_url",
            new=AsyncMock(return_value=MULTI_SET_DATA),
        ),
        patch("app.routers.bis.try_fetch_xivgear_full_data", new=AsyncMock(return_value=None)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get(
            f"/api/bis/xivgear/{quote(_xivgear_url('&onlySetIndex=1'), safe='')}"
        )

    assert response.status_code == 200, response.json()
    slots = response.json()["slots"]
    assert all(s["slot"] != "offhand" for s in slots)
    # Empty non-offhand slots still get their raid placeholder (unchanged).
    assert any(s["slot"] == "head" and s.get("itemId") is None for s in slots)
