"""API router for Lodestone character search and gear sync."""

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..cache import xivapi_item_cache
from ..config import get_settings
from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.snapshot_player import SnapshotPlayer
from ..models.tier_snapshot import TierSnapshot
from ..models.user import User
from ..permissions import require_membership
from ..rate_limit import RATE_LIMITS, limiter
from ..schemas.user import CamelModel
from .bis import build_icon_url_from_id, fetch_item_from_garland

router = APIRouter(prefix="/api/lodestone", tags=["lodestone"])
logger = get_logger(__name__)
settings = get_settings()

XIVAPI_BASE = "https://xivapi.com"
MOCK_RAIDER_AVATAR_URL = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E"
    "%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E"
    "%3Cstop stop-color='%2314b8a6'/%3E%3Cstop offset='1' stop-color='%230f172a'/%3E"
    "%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='18' fill='url(%23g)'/%3E"
    "%3Ccircle cx='48' cy='36' r='16' fill='%23e6fffb'/%3E"
    "%3Cpath d='M22 82c5-19 17-29 26-29s21 10 26 29' fill='%23e6fffb'/%3E"
    "%3Cpath d='M30 20l8 9M66 20l-8 9' stroke='%23f8fafc' stroke-width='5' stroke-linecap='round'/%3E"
    "%3C/svg%3E"
)
MOCK_BROKEN_AVATAR_URL = "/images/lodestone/mock-avatar-missing.svg"
LODESTONE_SLOT_MAP = {
    "MainHand": "weapon",
    "Head": "head",
    "Body": "body",
    "Hands": "hands",
    "Legs": "legs",
    "Feet": "feet",
    "Earrings": "earring",
    "Necklace": "necklace",
    "Bracelets": "bracelet",
    "Ring1": "ring1",
    "Ring2": "ring2",
}

MOCK_ITEM_DETAILS: dict[int, dict[str, Any]] = {
    200001: {
        "id": 200001,
        "name": "Cruiserweight Champion's Spear",
        "level": 795,
        "icon": build_icon_url_from_id(31676),
    },
    200002: {
        "id": 200002,
        "name": "Cruiserweight Champion's Helm",
        "level": 790,
        "icon": build_icon_url_from_id(31624),
    },
    200003: {
        "id": 200003,
        "name": "Cruiserweight Champion's Armor",
        "level": 790,
        "icon": build_icon_url_from_id(31626),
    },
    200004: {
        "id": 200004,
        "name": "Cruiserweight Champion's Gauntlets",
        "level": 790,
        "icon": build_icon_url_from_id(31629),
    },
    200005: {
        "id": 200005,
        "name": "Cruiserweight Champion's Trousers",
        "level": 790,
        "icon": build_icon_url_from_id(31628),
    },
    200006: {
        "id": 200006,
        "name": "Cruiserweight Champion's Sabatons",
        "level": 790,
        "icon": build_icon_url_from_id(31630),
    },
    200007: {
        "id": 200007,
        "name": "Cruiserweight Champion's Earrings",
        "level": 790,
        "icon": build_icon_url_from_id(31633),
    },
    200008: {
        "id": 200008,
        "name": "Cruiserweight Champion's Necklace",
        "level": 790,
        "icon": build_icon_url_from_id(31632),
    },
    200009: {
        "id": 200009,
        "name": "Cruiserweight Champion's Bracelets",
        "level": 790,
        "icon": build_icon_url_from_id(31634),
    },
    200010: {
        "id": 200010,
        "name": "Cruiserweight Champion's Ring",
        "level": 790,
        "icon": build_icon_url_from_id(31635),
    },
    210001: {
        "id": 210001,
        "name": "Agonist's Spear",
        "level": 770,
        "icon": build_icon_url_from_id(31676),
    },
    210002: {
        "id": 210002,
        "name": "Agonist's Helm",
        "level": 770,
        "icon": build_icon_url_from_id(31624),
    },
    210003: {
        "id": 210003,
        "name": "Agonist's Armor",
        "level": 770,
        "icon": build_icon_url_from_id(31626),
    },
    210004: {
        "id": 210004,
        "name": "Agonist's Gauntlets",
        "level": 770,
        "icon": build_icon_url_from_id(31629),
    },
    210005: {
        "id": 210005,
        "name": "Agonist's Trousers",
        "level": 770,
        "icon": build_icon_url_from_id(31628),
    },
    210006: {
        "id": 210006,
        "name": "Agonist's Sabatons",
        "level": 770,
        "icon": build_icon_url_from_id(31630),
    },
    210007: {
        "id": 210007,
        "name": "Agonist's Earrings",
        "level": 770,
        "icon": build_icon_url_from_id(31633),
    },
    210008: {
        "id": 210008,
        "name": "Agonist's Necklace",
        "level": 770,
        "icon": build_icon_url_from_id(31632),
    },
    210009: {
        "id": 210009,
        "name": "Agonist's Bracelets",
        "level": 770,
        "icon": build_icon_url_from_id(31634),
    },
    210010: {
        "id": 210010,
        "name": "Agonist's Ring",
        "level": 770,
        "icon": build_icon_url_from_id(31635),
    },
}

MOCK_CHARACTER_PAYLOADS: dict[int, dict[str, Any]] = {
    910001: {
        "Character": {
            "ID": 910001,
            "Name": "Mock Raider",
            "Server": "Gilgamesh",
            "Avatar": MOCK_RAIDER_AVATAR_URL,
            "Portrait": None,
            "GearSet": {
                "Class": {"Abbreviation": "DRG"},
                "Level": 100,
                "Gear": {
                    "MainHand": {"ID": 200001},
                    "Head": {"ID": 200002},
                    "Body": {"ID": 200003},
                    "Hands": {"ID": 200004},
                    "Legs": {"ID": 200005},
                    "Feet": {"ID": 200006},
                    "Earrings": {"ID": 200007},
                    "Necklace": {"ID": 200008},
                    "Bracelets": {"ID": 200009},
                    "Ring1": {"ID": 200010},
                    "Ring2": {"ID": 200010},
                },
            },
        },
    },
    910002: {
        "Character": {
            "ID": 910002,
            "Name": "Mock Recovering Raider",
            "Server": "Gilgamesh",
            "Avatar": MOCK_BROKEN_AVATAR_URL,
            "Portrait": None,
            "GearSet": {
                "Class": {"Abbreviation": "DRG"},
                "Level": 100,
                "Gear": {
                    "MainHand": {"ID": 210001},
                    "Head": {"ID": 210002},
                    "Body": {"ID": 210003},
                    "Hands": {"ID": 210004},
                    "Legs": {"ID": 210005},
                    "Feet": {"ID": 210006},
                    "Earrings": {"ID": 210007},
                    "Necklace": {"ID": 210008},
                    "Bracelets": {"ID": 210009},
                    "Ring1": {"ID": 210010},
                },
            },
        },
    },
    910003: {
        "Character": {
            "ID": 910003,
            "Name": "Mock Unavailable Gear",
            "Server": "Gilgamesh",
            "Avatar": None,
            "Portrait": None,
            "GearSet": {
                "Class": {"Abbreviation": "WHM"},
                "Level": 100,
                "Gear": {},
            },
        },
    },
}

MOCK_SEARCH_NAMES = [
    "Mock Raider",
    "Mock Recovering Raider",
    "Mock Unavailable Gear",
]


class CharacterSearchResult(CamelModel):
    """A single character from Lodestone search."""

    lodestone_id: int
    name: str
    server: str
    avatar: str | None = None


class CharacterSearchResponse(CamelModel):
    """Response from character search."""

    results: list[CharacterSearchResult]
    total: int


class LodestoneDevStatusResponse(CamelModel):
    """Development-only Lodestone mock status."""

    mock_mode: bool
    mock_search_names: list[str]


class EquippedGearSlot(CamelModel):
    """A single equipped gear piece from Lodestone."""

    slot: str
    item_id: int | None = None
    item_name: str | None = None
    item_level: int = 0
    item_icon: str | None = None
    current_source: str = "unknown"


class CharacterGearResponse(CamelModel):
    """Character profile with currently equipped gear."""

    lodestone_id: int
    name: str
    server: str
    avatar: str | None = None
    portrait: str | None = None
    active_job: str | None = None
    active_job_level: int | None = None
    gear: list[EquippedGearSlot]


class SyncResult(CamelModel):
    """Result of a gear sync operation."""

    updated_slots: int
    lodestone_id: str
    last_sync: str
    lodestone_name: str | None = None
    lodestone_server: str | None = None
    lodestone_avatar_url: str | None = None
    gear: list[dict[str, Any]]


def classify_current_source(item_name: str, item_level: int, slot: str) -> str:
    """Classify an equipped item into a current gear source category."""
    if not item_name or item_level <= 0:
        return "unknown"

    name_lower = item_name.lower()

    if name_lower.startswith("aug.") or name_lower.startswith("augmented"):
        return "tome_up"

    raid_patterns = [
        "grand champion",
        "cruiserweight champion",
        "light-heavyweight champion",
        "ascension",
        "asphodelos",
        "abyssos",
        "anabaseios",
    ]
    for pattern in raid_patterns:
        if pattern in name_lower:
            return "savage"

    crafted_patterns = [
        "agonist",
        "archeo kingdom",
        "diadochos",
        "rinascita",
        "classical",
        "pactmaker",
    ]
    for pattern in crafted_patterns:
        if pattern in name_lower:
            return "crafted"

    relic_patterns = ["manderville", "amazing", "majestic", "lodestar"]
    for pattern in relic_patterns:
        if pattern in name_lower:
            return "relic"

    tome_patterns = [
        "quetzalli",
        "neo kingdom",
        "credendum",
        "lunar envoy",
        "moonward",
        "radiant",
    ]
    for pattern in tome_patterns:
        if pattern in name_lower:
            return "tome"

    catchup_patterns = ["archeo kingdom", "ascend"]
    for pattern in catchup_patterns:
        if pattern in name_lower:
            return "catchup"

    normal_patterns = [
        "light-heavyweight",
        "cruiserweight",
    ]
    for pattern in normal_patterns:
        if pattern in name_lower and "champion" not in name_lower:
            return "normal"

    if slot == "weapon":
        if item_level >= 795:
            return "savage"
        if item_level >= 790:
            return "tome_up"
        if item_level >= 785:
            return "tome"
        if item_level >= 775:
            return "relic"
        if item_level >= 770:
            return "crafted"
        if item_level >= 765:
            return "normal"
    else:
        if item_level >= 790:
            return "savage"
        if item_level >= 780:
            return "tome"
        if item_level >= 770:
            return "crafted"
        if item_level >= 760:
            return "normal"

    if item_level > 0:
        return "prep"

    return "unknown"


def _is_dev_lodestone_mock_enabled() -> bool:
    return settings.environment == "development" and settings.dev_lodestone_mock


def _coerce_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _has_known_item_details(item_info: dict[str, Any]) -> bool:
    return bool(
        item_info.get("name")
        and item_info.get("name") != "Unknown"
        and _coerce_int(item_info.get("level"))
    )


def _fallback_icon_url(item_data: Any) -> str | None:
    if not isinstance(item_data, dict):
        return None

    icon_id = (
        item_data.get("IconID")
        or item_data.get("Icon")
        or item_data.get("icon")
    )
    if icon_id is None:
        return None

    return build_icon_url_from_id(icon_id)


def _derive_source_from_bis(bis_source: str | None) -> str:
    if bis_source == "raid":
        return "savage"
    if bis_source == "tome":
        return "tome_up"
    if bis_source == "base_tome":
        return "tome"
    if bis_source == "crafted":
        return "crafted"
    return "unknown"


def _source_satisfies_bis(bis_source: str | None, current_source: str) -> bool:
    if bis_source == "raid":
        return current_source == "savage"
    if bis_source == "tome":
        return current_source == "tome_up"
    if bis_source == "base_tome":
        return current_source in {"tome", "tome_up"}
    if bis_source == "crafted":
        return current_source == "crafted"
    return False


def _mock_search(name: str, server: str) -> CharacterSearchResponse:
    name_lower = name.lower().strip()
    server_lower = server.lower().strip()
    results = []

    for lodestone_id, payload in MOCK_CHARACTER_PAYLOADS.items():
        char = payload["Character"]
        if name_lower and name_lower not in char["Name"].lower():
            continue
        if server_lower and server_lower != char["Server"].lower():
            continue

        results.append(
            CharacterSearchResult(
                lodestone_id=lodestone_id,
                name=char["Name"],
                server=char["Server"],
                avatar=char.get("Avatar"),
            )
        )

    return CharacterSearchResponse(results=results, total=len(results))


async def _fetch_xivapi_json(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float,
    not_found_detail: str | None,
    service_label: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{XIVAPI_BASE}{path}",
                params=params,
                timeout=timeout,
            )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"{service_label} timed out. Lodestone may be slow right now.",
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach XIVAPI: {exc}",
            )

    if 300 <= response.status_code < 400:
        logger.warning("xivapi_unexpected_redirect", path=path, status=response.status_code)
        raise HTTPException(
            status_code=502,
            detail="External service returned an unexpected redirect",
        )

    if response.status_code == 403:
        raise HTTPException(
            status_code=502,
            detail=f"{service_label} is unavailable right now",
        )

    if response.status_code == 404 and not_found_detail:
        raise HTTPException(status_code=404, detail=not_found_detail)

    if response.status_code >= 500:
        raise HTTPException(
            status_code=502,
            detail=f"{service_label} is temporarily unavailable",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"XIVAPI error: {response.status_code}",
        )

    try:
        data = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    return data


async def _fetch_character_payload(
    lodestone_id: int,
    *,
    require_usable_gear: bool,
) -> dict[str, Any]:
    if _is_dev_lodestone_mock_enabled():
        data = MOCK_CHARACTER_PAYLOADS.get(lodestone_id)
        if data is None:
            raise HTTPException(status_code=404, detail="Character not found on Lodestone")
    else:
        data = await _fetch_xivapi_json(
            f"/character/{lodestone_id}",
            timeout=20.0,
            not_found_detail="Character not found on Lodestone",
            service_label="Lodestone character data",
        )

    char = data.get("Character")
    if not isinstance(char, dict):
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    gear_set = char.get("GearSet")
    if gear_set is None:
        if require_usable_gear:
            raise HTTPException(status_code=502, detail="Character gear is unavailable from Lodestone")
        return data

    if not isinstance(gear_set, dict):
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    gear_items = gear_set.get("Gear", {})
    if gear_items is None:
        if require_usable_gear:
            raise HTTPException(status_code=502, detail="Character gear is unavailable from Lodestone")
        return data

    if not isinstance(gear_items, dict):
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    if require_usable_gear and not any(
        isinstance(item, dict) and _coerce_int(item.get("ID"))
        for item in gear_items.values()
    ):
        raise HTTPException(status_code=502, detail="Character gear is unavailable from Lodestone")

    return data


async def _resolve_equipped_item(
    item_id: int,
    slot_name: str,
    item_data: dict[str, Any],
) -> dict[str, Any]:
    if _is_dev_lodestone_mock_enabled():
        item_info = MOCK_ITEM_DETAILS.get(item_id, {"id": item_id, "name": "Unknown", "level": 0, "icon": None})
    else:
        item_info = await fetch_item_from_garland(item_id)

    lookup_succeeded = _has_known_item_details(item_info)
    item_name = item_info.get("name") if lookup_succeeded else None
    item_level = _coerce_int(item_info.get("level")) or 0
    item_icon = item_info.get("icon") or _fallback_icon_url(item_data)
    current_source = (
        classify_current_source(item_name, item_level, slot_name)
        if lookup_succeeded and item_name
        else "unknown"
    )

    return {
        "item_id": item_id,
        "item_name": item_name,
        "item_level": item_level,
        "item_icon": item_icon,
        "current_source": current_source,
        "lookup_succeeded": lookup_succeeded,
    }


async def _build_slot_snapshot(
    lodestone_slot: str,
    our_slot: str,
    gear_items: dict[str, Any],
) -> tuple[EquippedGearSlot, dict[str, Any] | None]:
    item_data = gear_items.get(lodestone_slot)
    item_id = _coerce_int(item_data.get("ID")) if isinstance(item_data, dict) else None
    if not item_id:
        return EquippedGearSlot(slot=our_slot), None

    resolved = await _resolve_equipped_item(item_id, our_slot, item_data)
    display_name = resolved["item_name"] if resolved["lookup_succeeded"] else "Unavailable item details"

    return (
        EquippedGearSlot(
            slot=our_slot,
            item_id=item_id,
            item_name=display_name,
            item_level=resolved["item_level"],
            item_icon=resolved["item_icon"],
            current_source=resolved["current_source"],
        ),
        {
            **resolved,
            "has_equipped_item": True,
        },
    )


async def _build_equipped_slots(
    gear_items: dict[str, Any],
) -> tuple[list[EquippedGearSlot], dict[str, dict[str, Any]]]:
    tasks = [
        _build_slot_snapshot(lodestone_slot, our_slot, gear_items)
        for lodestone_slot, our_slot in LODESTONE_SLOT_MAP.items()
    ]
    results = await asyncio.gather(*tasks)

    equipped_slots: list[EquippedGearSlot] = []
    equipped_lookup: dict[str, dict[str, Any]] = {}
    for slot_result, resolved in results:
        equipped_slots.append(slot_result)
        if resolved:
            equipped_lookup[slot_result.slot] = resolved

    return equipped_slots, equipped_lookup


def _normalize_player_gear(raw_gear: Any) -> list[dict[str, Any]]:
    if isinstance(raw_gear, str):
        try:
            parsed = json.loads(raw_gear)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []

    if isinstance(raw_gear, list):
        return raw_gear

    return []


def _calculate_has_item(
    gear_slot: dict[str, Any],
    equipped: dict[str, Any] | None,
) -> bool:
    if not equipped or not equipped.get("has_equipped_item"):
        return False

    expected_item_id = _coerce_int(gear_slot.get("itemId"))
    equipped_item_id = _coerce_int(equipped.get("item_id"))
    bis_source = gear_slot.get("bisSource")
    current_source = equipped.get("current_source", "unknown")
    bis_item_level = _coerce_int(gear_slot.get("itemLevel")) or 0
    equipped_item_level = _coerce_int(equipped.get("item_level")) or 0

    if expected_item_id and equipped_item_id and expected_item_id == equipped_item_id:
        return True

    if _source_satisfies_bis(bis_source, current_source):
        return True

    if bis_source == "raid" and bis_item_level and equipped_item_level >= bis_item_level and current_source != "unknown":
        return True

    if not expected_item_id and bis_item_level and equipped_item_level >= bis_item_level and current_source != "unknown":
        return True

    return False


def _calculate_is_augmented(
    gear_slot: dict[str, Any],
    equipped: dict[str, Any] | None,
    has_item: bool,
) -> bool:
    if not has_item or not equipped or not equipped.get("has_equipped_item"):
        return False

    expected_item_id = _coerce_int(gear_slot.get("itemId"))
    equipped_item_id = _coerce_int(equipped.get("item_id"))
    current_source = equipped.get("current_source", "unknown")

    if gear_slot.get("bisSource") == "tome" and expected_item_id and equipped_item_id == expected_item_id:
        return True

    return current_source == "tome_up"


@router.get("/search", response_model=CharacterSearchResponse)
@limiter.limit(RATE_LIMITS["external_api"])
async def search_characters(
    request: Request,
    name: str = Query(..., min_length=2, description="Character name"),
    server: str = Query("", description="Server name (optional)"),
    current_user: User = Depends(get_current_user),
):
    """Search for FFXIV characters on Lodestone via XIVAPI."""
    if _is_dev_lodestone_mock_enabled():
        return _mock_search(name, server)

    data = await _fetch_xivapi_json(
        "/character/search",
        params={"name": name, **({"server": server} if server else {})},
        timeout=15.0,
        not_found_detail=None,
        service_label="Lodestone search",
    )

    results_data = data.get("Results", [])
    if not isinstance(results_data, list):
        raise HTTPException(status_code=502, detail="Invalid response from XIVAPI")

    results = []
    for char in results_data:
        if not isinstance(char, dict):
            continue
        results.append(
            CharacterSearchResult(
                lodestone_id=_coerce_int(char.get("ID")) or 0,
                name=str(char.get("Name") or "Unknown"),
                server=str(char.get("Server") or "Unknown"),
                avatar=char.get("Avatar"),
            )
        )

    pagination = data.get("Pagination", {})
    total = (
        _coerce_int(pagination.get("ResultsTotal"))
        if isinstance(pagination, dict)
        else None
    )

    return CharacterSearchResponse(results=results, total=total or len(results))


@router.get("/status", response_model=LodestoneDevStatusResponse)
async def get_lodestone_dev_status(
    current_user: User = Depends(get_current_user),
):
    """Report local Lodestone mock mode only when it is explicitly enabled."""
    _ = current_user
    if not _is_dev_lodestone_mock_enabled():
        raise HTTPException(status_code=404, detail="Not found")

    return LodestoneDevStatusResponse(
        mock_mode=True,
        mock_search_names=MOCK_SEARCH_NAMES,
    )


@router.get("/character/{lodestone_id}", response_model=CharacterGearResponse)
@limiter.limit(RATE_LIMITS["external_api"])
async def get_character_gear(
    request: Request,
    lodestone_id: int,
    current_user: User = Depends(get_current_user),
):
    """Fetch a character's currently equipped gear from Lodestone via XIVAPI."""
    cache_key = f"lodestone_char_{lodestone_id}"
    cached = await xivapi_item_cache.get(cache_key)
    if cached:
        return CharacterGearResponse(**cached)

    data = await _fetch_character_payload(lodestone_id, require_usable_gear=False)
    char = data["Character"]
    gear_set = char.get("GearSet", {}) if isinstance(char.get("GearSet"), dict) else {}
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set.get("Gear"), dict) else {}

    equipped_slots, _ = await _build_equipped_slots(gear_items)

    active_class = gear_set.get("Class", {}) if isinstance(gear_set, dict) else {}
    active_job = active_class.get("Abbreviation") if isinstance(active_class, dict) else None

    result = CharacterGearResponse(
        lodestone_id=lodestone_id,
        name=str(char.get("Name") or "Unknown"),
        server=str(char.get("Server") or "Unknown"),
        avatar=char.get("Avatar"),
        portrait=char.get("Portrait"),
        active_job=active_job,
        active_job_level=_coerce_int(gear_set.get("Level")) if isinstance(gear_set, dict) else None,
        gear=equipped_slots,
    )

    await xivapi_item_cache.set(cache_key, result.model_dump(), ttl=300)
    return result


@router.post("/sync/{group_id}/{player_id}", response_model=SyncResult)
@limiter.limit(RATE_LIMITS["external_api"])
async def sync_player_gear(
    request: Request,
    group_id: str,
    player_id: str,
    lodestone_id: int | None = Query(None, description="Lodestone ID (if not already linked)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Sync a player's current equipped gear from Lodestone."""
    membership = await require_membership(session, current_user.id, group_id)
    if membership.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot sync gear")

    result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == player_id,
            TierSnapshot.static_group_id == group_id,
        )
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if membership.role == "member" and player.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Members can only sync their own player")

    resolved_lodestone_id = lodestone_id or _coerce_int(player.lodestone_id)
    if not resolved_lodestone_id:
        raise HTTPException(status_code=400, detail="No Lodestone ID provided or linked")

    data = await _fetch_character_payload(resolved_lodestone_id, require_usable_gear=True)
    character = data["Character"]
    gear_set = character.get("GearSet", {})
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set, dict) else {}
    _, equipped_by_slot = await _build_equipped_slots(gear_items)

    current_gear = [dict(gear_slot) for gear_slot in _normalize_player_gear(player.gear)]
    updated_count = 0

    for gear_slot in current_gear:
        slot_name = gear_slot.get("slot")
        if not slot_name:
            continue

        equipped = equipped_by_slot.get(slot_name)
        previous_state = dict(gear_slot)
        existing_source = gear_slot.get("currentSource")
        exact_item_match = bool(
            equipped
            and _coerce_int(gear_slot.get("itemId"))
            and _coerce_int(gear_slot.get("itemId")) == _coerce_int(equipped.get("item_id"))
        )

        if not equipped:
            gear_slot["currentSource"] = "unknown"
            gear_slot["hasItem"] = False
            gear_slot["isAugmented"] = False
        else:
            next_source = equipped.get("current_source", "unknown")
            if next_source == "unknown":
                if exact_item_match:
                    next_source = _derive_source_from_bis(gear_slot.get("bisSource"))
                elif existing_source and existing_source != "unknown":
                    next_source = existing_source

            gear_slot["currentSource"] = next_source
            gear_slot["hasItem"] = _calculate_has_item(gear_slot, equipped)
            gear_slot["isAugmented"] = _calculate_is_augmented(
                gear_slot,
                {**equipped, "current_source": next_source},
                bool(gear_slot["hasItem"]),
            )

        if gear_slot != previous_state:
            updated_count += 1

    now = datetime.now(timezone.utc).isoformat()
    lodestone_name = str(character.get("Name") or "") or None
    lodestone_server = str(character.get("Server") or "") or None
    avatar_value = character.get("Avatar")
    existing_avatar_url = getattr(player, "lodestone_avatar_url", None)
    lodestone_avatar_url = (
        avatar_value.strip()
        if isinstance(avatar_value, str) and avatar_value.strip()
        else existing_avatar_url
    )

    player.gear = [dict(gear_slot) for gear_slot in current_gear]
    player.lodestone_id = str(resolved_lodestone_id)
    player.last_sync = now
    player.updated_at = now
    # These columns are supplied by the follow-up avatar schema. Guard them so
    # this router remains safe on local databases that only have lodestone_id.
    if hasattr(player, "lodestone_name"):
        player.lodestone_name = lodestone_name
    if hasattr(player, "lodestone_server"):
        player.lodestone_server = lodestone_server
    if hasattr(player, "lodestone_avatar_url"):
        player.lodestone_avatar_url = lodestone_avatar_url

    await session.flush()
    await session.commit()

    logger.info(
        "lodestone_sync_complete",
        player_id=player_id,
        lodestone_id=resolved_lodestone_id,
        updated_slots=updated_count,
    )

    return SyncResult(
        updated_slots=updated_count,
        lodestone_id=str(resolved_lodestone_id),
        last_sync=now,
        lodestone_name=lodestone_name,
        lodestone_server=lodestone_server,
        lodestone_avatar_url=lodestone_avatar_url,
        gear=current_gear,
    )
