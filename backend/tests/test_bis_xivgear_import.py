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


@pytest.mark.asyncio
async def test_etro_pld_offhand_imports_and_no_phantom_for_others(client):
    """Etro's offHand key maps to 'offhand'; a set WITHOUT one emits no
    offhand placeholder (both assertions against the bis.py etro loop)."""

    async def item_lookup(item_id: int):
        return {"id": item_id, "name": f"Item {item_id}", "level": 795, "icon": "i.png", "stats": {}}

    pld_data = {"name": "PLD Set", "jobAbbrev": "PLD", "weapon": 60001, "offHand": 60002, "head": 60003, "materia": {}}
    with (
        patch("app.routers.bis.fetch_bis_from_etro", new=AsyncMock(return_value=pld_data)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get("/api/bis/etro/464585cc-099f-4438-b442-6d15723db90f")
    assert response.status_code == 200, response.json()
    slots = response.json()["slots"]
    offhand = next(s for s in slots if s["slot"] == "offhand")
    assert offhand["itemId"] == 60002

    drg_data = {"name": "DRG Set", "jobAbbrev": "DRG", "weapon": 60001, "head": 60003, "materia": {}}
    with (
        patch("app.routers.bis.fetch_bis_from_etro", new=AsyncMock(return_value=drg_data)),
        patch("app.routers.bis.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        response = await client.get("/api/bis/etro/464585cc-099f-4438-b442-6d15723db90f")
    assert response.status_code == 200
    assert all(s["slot"] != "offhand" for s in response.json()["slots"])


@pytest.mark.asyncio
async def test_bis_targets_etro_copy_also_skips_offhand_placeholder():
    """The DUPLICATED etro loop in bis_targets.py gets the same behavior —
    a fix in one copy is not a fix in the other (director-flagged trap)."""
    from app.routers.bis_targets import _fetch_slots_etro

    async def item_lookup(item_id: int):
        return {"id": item_id, "name": f"Item {item_id}", "level": 795, "icon": "i.png", "stats": {}}

    with (
        patch("app.routers.bis_targets.fetch_bis_from_etro", new=AsyncMock(
            return_value={"name": "PLD Set", "weapon": 60001, "offHand": 60002, "materia": {}}
        )),
        patch("app.routers.bis_targets.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        slots = await _fetch_slots_etro("https://etro.gg/gearset/464585cc-099f-4438-b442-6d15723db90f")
    offhand = [s for s in slots if s["slot"] == "offhand"]
    assert len(offhand) == 1 and offhand[0]["itemId"] == 60002

    with (
        patch("app.routers.bis_targets.fetch_bis_from_etro", new=AsyncMock(
            return_value={"name": "DRG Set", "weapon": 60001, "materia": {}}
        )),
        patch("app.routers.bis_targets.fetch_item_from_garland", new=AsyncMock(side_effect=item_lookup)),
    ):
        slots = await _fetch_slots_etro("https://etro.gg/gearset/464585cc-099f-4438-b442-6d15723db90f")
    assert all(s["slot"] != "offhand" for s in slots)
