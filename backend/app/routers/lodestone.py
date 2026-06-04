"""API router for Lodestone character search and gear sync."""

import asyncio
import html
import json
import re
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
from ..models.player_character import PlayerCharacter
from ..models.player_gear_snapshot import PlayerGearSnapshot
from ..models.player_job_profile import PlayerJobProfile
from ..models.player_profile import PlayerProfile
from ..models.snapshot_player import SnapshotPlayer
from ..models.tier_snapshot import TierSnapshot
from ..models.user import User
from ..permissions import require_membership
from ..rate_limit import RATE_LIMITS, limiter
from ..schemas.user import CamelModel
from ..services.tomestone_provider import get_tomestone_provider, tomestone_profile_to_xivapi_payload
from .bis import build_icon_url_from_id, fetch_item_from_garland

router = APIRouter(prefix="/api/lodestone", tags=["lodestone"])
logger = get_logger(__name__)
settings = get_settings()

XIVAPI_BASE = "https://xivapi.com"
LODESTONE_BASE = "https://na.finalfantasyxiv.com"
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
    gear_available: bool = True
    identity_only: bool = False
    source: str = "xivapi"
    refresh_attempted: bool = False
    refresh_status: str | None = None


class SyncResult(CamelModel):
    """Result of a gear sync operation."""

    updated_slots: int
    # Number of gear slots where the currently equipped item matches the BiS target.
    # Distinct from updatedSlots (which is change count) and from total slot count.
    bis_matched_count: int = 0
    lodestone_id: str
    last_sync: str
    lodestone_name: str | None = None
    lodestone_server: str | None = None
    lodestone_avatar_url: str | None = None
    gear: list[dict[str, Any]]
    sync_source: str = "xivapi"
    synced_job: str | None = None
    payload_changed: bool = True
    job_mismatch_warning: str | None = None
    refresh_attempted: bool = False
    refresh_status: str | None = None
    warnings: list[str] = []


class IdentityLinkResult(CamelModel):
    """Result of linking Lodestone identity without syncing gear."""

    lodestone_id: str
    lodestone_name: str
    lodestone_server: str
    lodestone_avatar_url: str | None = None
    gear_sync_available: bool = False
    gear_available: bool = False
    identity_only: bool = True
    source: str = "lodestone_identity"
    message: str = "Lodestone identity linked"


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


def _text_from_html_fragment(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", "", fragment)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_meta_content(markup: str, property_name: str) -> str | None:
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(property_name)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(property_name)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, markup, re.IGNORECASE)
        if match:
            value = html.unescape(match.group(1)).strip()
            return value or None
    return None


def _is_likely_character_avatar_url(url: Any) -> bool:
    if not isinstance(url, str):
        return False

    value = url.strip()
    if not value:
        return False

    if value.startswith("data:image/"):
        return True

    lowered = value.lower()
    if not lowered.startswith(("http://", "https://", "/")):
        return False

    generic_markers = [
        "banner",
        "facebook",
        "ogp",
        "opengraph",
        "social",
        "twitter",
        "logo",
        "news",
        "topics",
        "promo",
        "promotion",
        "patch",
        "expansion",
        "dawntrail",
        "endwalker",
        "shadowbringers",
        "stormblood",
        "heavensward",
        "realm-reborn",
        "site-image",
        "share",
    ]
    if any(marker in lowered for marker in generic_markers):
        return False

    character_markers = [
        "lds-img.finalfantasyxiv.com/h/",
        "img.finalfantasyxiv.com/lds/",
        "img2.finalfantasyxiv.com/f/",
        "character",
        "avatar",
        "portrait",
        "face",
        "chara",
    ]
    return any(marker in lowered for marker in character_markers)


def _sanitize_avatar_url(url: Any) -> str | None:
    if not _is_likely_character_avatar_url(url):
        return None
    return str(url).strip()


def _extract_lodestone_avatar(markup: str) -> str | None:
    image_candidates: list[str] = []
    for match in re.finditer(r"<img\b[^>]+>", markup, re.IGNORECASE):
        tag = match.group(0)
        lowered = tag.lower()
        if not any(marker in lowered for marker in ["frame__chara", "character", "avatar", "portrait", "face", "chara"]):
            continue
        src_match = re.search(r'\b(?:src|data-src)=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if src_match:
            image_candidates.append(html.unescape(src_match.group(1)).strip())

    image_candidates.append(_extract_meta_content(markup, "og:image") or "")

    for candidate in image_candidates:
        sanitized = _sanitize_avatar_url(candidate)
        if sanitized:
            return sanitized
    return None


def _extract_lodestone_identity(lodestone_id: int, markup: str) -> dict[str, str | None]:
    lowered = markup.lower()
    if any(marker in lowered for marker in ["captcha", "cloudflare", "access denied", "automated"]):
        raise HTTPException(status_code=502, detail="lodestone_bad_response")

    name_match = re.search(
        r'class=["\'][^"\']*frame__chara__name[^"\']*["\'][^>]*>(.*?)<',
        markup,
        re.IGNORECASE | re.DOTALL,
    )
    name = _text_from_html_fragment(name_match.group(1)) if name_match else None

    world_match = re.search(
        r'class=["\'][^"\']*frame__chara__world[^"\']*["\'][^>]*>(.*?)</p>',
        markup,
        re.IGNORECASE | re.DOTALL,
    )
    world_text = _text_from_html_fragment(world_match.group(1)) if world_match else None
    server = None
    if world_text:
        server_match = re.match(r"(.+?)(?:\s*\[[^\]]+\])?$", world_text)
        server = server_match.group(1).strip() if server_match else world_text.strip()

    if not name:
        og_title = _extract_meta_content(markup, "og:title")
        if og_title and "|" in og_title:
            name = og_title.split("|", 1)[0].strip()

    avatar = _extract_lodestone_avatar(markup)

    if not name or not server:
        logger.warning(
            "lodestone_identity_parse_failed",
            lodestone_id=lodestone_id,
            has_name=bool(name),
            has_server=bool(server),
            has_avatar=bool(avatar),
        )
        raise HTTPException(status_code=502, detail="lodestone_bad_response")

    return {
        "lodestone_name": name,
        "lodestone_server": server,
        "lodestone_avatar_url": avatar,
        "source": "lodestone_identity",
    }


async def _fetch_lodestone_identity(lodestone_id: int) -> dict[str, str | None]:
    upstream_url = f"{LODESTONE_BASE}/lodestone/character/{lodestone_id}/"
    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                upstream_url,
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "User-Agent": "ffxiv-raid-planner/identity-link",
                },
                timeout=15.0,
            )
        except httpx.TimeoutException:
            logger.warning(
                "lodestone_identity_fetch_failed",
                lodestone_id=lodestone_id,
                upstream_url=upstream_url,
                status_code=None,
                error_type="timeout",
            )
            raise HTTPException(status_code=504, detail="lodestone_timeout")
        except httpx.RequestError as exc:
            logger.warning(
                "lodestone_identity_fetch_failed",
                lodestone_id=lodestone_id,
                upstream_url=upstream_url,
                status_code=None,
                error_type=exc.__class__.__name__,
            )
            raise HTTPException(status_code=502, detail="lodestone_unavailable")

    if response.status_code == 404:
        logger.warning(
            "lodestone_identity_fetch_failed",
            lodestone_id=lodestone_id,
            upstream_url=upstream_url,
            status_code=response.status_code,
            error_type="not_found",
        )
        raise HTTPException(status_code=404, detail="Character not found on Lodestone")

    if response.status_code == 403:
        logger.warning(
            "lodestone_identity_fetch_failed",
            lodestone_id=lodestone_id,
            upstream_url=upstream_url,
            status_code=response.status_code,
            error_type="forbidden",
        )
        raise HTTPException(status_code=502, detail="lodestone_unavailable")

    if response.status_code != 200:
        logger.warning(
            "lodestone_identity_fetch_failed",
            lodestone_id=lodestone_id,
            upstream_url=upstream_url,
            status_code=response.status_code,
            error_type="unexpected_status",
        )
        raise HTTPException(status_code=502, detail="lodestone_unavailable")

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type.lower():
        logger.warning(
            "lodestone_identity_fetch_failed",
            lodestone_id=lodestone_id,
            upstream_url=upstream_url,
            status_code=response.status_code,
            error_type="unexpected_content_type",
        )
        raise HTTPException(status_code=502, detail="lodestone_bad_response")

    return _extract_lodestone_identity(lodestone_id, response.text)


def _payload_has_usable_gear(data: dict[str, Any]) -> bool:
    char = data.get("Character")
    if not isinstance(char, dict):
        return False

    gear_set = char.get("GearSet")
    if not isinstance(gear_set, dict):
        return False

    gear_items = gear_set.get("Gear")
    if not isinstance(gear_items, dict):
        return False

    return any(
        isinstance(item, dict) and _coerce_int(item.get("ID"))
        for item in gear_items.values()
    )


async def _fetch_tomestone_character_payload(
    lodestone_id: int, *, no_cache: bool = False, skip_refresh: bool = False,
) -> dict[str, Any] | None:
    provider = get_tomestone_provider(settings)
    if not provider.enabled:
        return None

    result = await provider.fetch_profile_by_id(lodestone_id, no_cache=no_cache, skip_refresh=skip_refresh)
    if not result.available or result.raw is None:
        return None

    payload = tomestone_profile_to_xivapi_payload(result.raw, fallback_lodestone_id=lodestone_id)
    if payload is None:
        logger.warning(
            "tomestone_character_payload_unusable",
            lodestone_id=lodestone_id,
            reason="unrecognized_shape",
        )
        return None

    has_gear = _payload_has_usable_gear(payload)
    payload["__source"] = "tomestone" if has_gear else "tomestone_identity"
    logger.info(
        "tomestone_character_payload_ready",
        lodestone_id=lodestone_id,
        has_gear=has_gear,
    )
    if settings.debug:
        char = payload.get("Character") or {}
        gear_set = char.get("GearSet") or {}
        gear = gear_set.get("Gear") or {}
        logger.debug(
            "tomestone_payload_shape",
            lodestone_id=lodestone_id,
            character_keys=sorted(str(k) for k in char.keys()),
            gear_slot_count=len(gear) if isinstance(gear, dict) else 0,
        )
    return payload


async def _fetch_tomestone_identity(lodestone_id: int) -> dict[str, str | None] | None:
    payload = await _fetch_tomestone_character_payload(lodestone_id)
    if not payload:
        return None

    character = payload.get("Character")
    if not isinstance(character, dict):
        return None

    name = str(character.get("Name") or "").strip()
    server = str(character.get("Server") or "").strip()
    avatar = _sanitize_avatar_url(character.get("Avatar")) or _sanitize_avatar_url(character.get("Portrait"))
    if not name or not server:
        return None

    return {
        "lodestone_name": name,
        "lodestone_server": server,
        "lodestone_avatar_url": avatar,
        "source": "tomestone_identity",
    }


async def _fetch_xivapi_json(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float,
    not_found_detail: str | None,
    service_label: str,
    log_context: dict[str, Any] | None = None,
    dev_error_codes: bool = False,
) -> dict[str, Any]:
    upstream_url = f"{XIVAPI_BASE}{path}"
    safe_context = log_context or {}

    def controlled_detail(code: str, message: str) -> str:
        if dev_error_codes and settings.environment != "production":
            return code
        return message

    is_character_endpoint = path.startswith("/character/") and path != "/character/search"

    def log_failure(
        reason: str,
        *,
        status_code: int | None = None,
        error: str | None = None,
        error_type: str | None = None,
    ) -> None:
        logger.warning(
            "xivapi_live_request_failed",
            reason=reason,
            upstream_url=upstream_url,
            path=path,
            status_code=status_code,
            service_label=service_label,
            **({"error_type": error_type} if error_type else {}),
            **safe_context,
            **({"error": error} if error else {}),
        )

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                upstream_url,
                params=params,
                timeout=timeout,
            )
        except httpx.TimeoutException:
            log_failure("timeout")
            raise HTTPException(
                status_code=504,
                detail=controlled_detail(
                    "upstream_timeout",
                    f"{service_label} timed out. Lodestone may be slow right now.",
                ),
            )
        except httpx.RequestError as exc:
            log_failure("request_error", error=exc.__class__.__name__)
            raise HTTPException(
                status_code=502,
                detail=controlled_detail("upstream_unavailable", "Unable to reach XIVAPI"),
            )

    if 300 <= response.status_code < 400:
        log_failure("unexpected_redirect", status_code=response.status_code)
        raise HTTPException(
            status_code=502,
            detail=controlled_detail(
                "upstream_bad_response",
                "External service returned an unexpected redirect",
            ),
        )

    if response.status_code == 403:
        is_private_response = False
        try:
            error_payload = response.json()
            if isinstance(error_payload, dict):
                message = str(error_payload.get("Message") or "")
                exception_name = str(error_payload.get("Ex") or "")
                is_private_response = (
                    "private" in message.lower()
                    or "LodestonePrivateException" in exception_name
                )
        except Exception:
            is_private_response = False

        if is_character_endpoint:
            log_failure(
                "upstream_character_unavailable",
                status_code=response.status_code,
                error_type="upstream_character_unavailable",
            )
            raise HTTPException(
                status_code=502,
                detail=controlled_detail(
                    "upstream_character_unavailable",
                    f"{service_label} is unavailable right now",
                ),
            )

        log_failure(
            "forbidden_private" if is_private_response else "forbidden",
            status_code=response.status_code,
        )
        raise HTTPException(
            status_code=502,
            detail=controlled_detail(
                "upstream_private" if is_private_response else "upstream_unavailable",
                f"{service_label} is unavailable right now",
            ),
        )

    if response.status_code == 404 and not_found_detail:
        log_failure("not_found", status_code=response.status_code)
        raise HTTPException(status_code=404, detail=not_found_detail)

    if response.status_code >= 500:
        if is_character_endpoint:
            log_failure(
                "upstream_character_unavailable",
                status_code=response.status_code,
                error_type="upstream_character_unavailable",
            )
            raise HTTPException(
                status_code=502,
                detail=controlled_detail(
                    "upstream_character_unavailable",
                    f"{service_label} is temporarily unavailable",
                ),
            )

        log_failure("server_error", status_code=response.status_code)
        raise HTTPException(
            status_code=502,
            detail=controlled_detail("upstream_unavailable", f"{service_label} is temporarily unavailable"),
        )

    if response.status_code != 200:
        log_failure("unexpected_status", status_code=response.status_code)
        raise HTTPException(
            status_code=502,
            detail=controlled_detail("upstream_unavailable", f"XIVAPI error: {response.status_code}"),
        )

    try:
        data = response.json()
    except Exception:
        log_failure("bad_json", status_code=response.status_code)
        raise HTTPException(
            status_code=502,
            detail=controlled_detail("upstream_bad_response", "Invalid response from XIVAPI"),
        )

    if not isinstance(data, dict):
        log_failure("missing_payload", status_code=response.status_code)
        raise HTTPException(
            status_code=502,
            detail=controlled_detail("upstream_bad_response", "Invalid response from XIVAPI"),
        )

    return data


async def _fetch_character_payload(
    lodestone_id: int,
    *,
    require_usable_gear: bool,
    dev_error_codes: bool = False,
    no_cache: bool = False,
    skip_refresh: bool = False,
) -> dict[str, Any]:
    if _is_dev_lodestone_mock_enabled():
        data = MOCK_CHARACTER_PAYLOADS.get(lodestone_id)
        if data is None:
            raise HTTPException(status_code=404, detail="Character not found on Lodestone")
        data = {**data, "__source": "dev_mock"}
    else:
        # Try Tomestone first (when token configured), fall back to XIVAPI.
        tomestone_data = await _fetch_tomestone_character_payload(lodestone_id, no_cache=no_cache, skip_refresh=skip_refresh)
        if tomestone_data and (_payload_has_usable_gear(tomestone_data) or not require_usable_gear):
            data = tomestone_data
        else:
            data = await _fetch_xivapi_json(
                f"/character/{lodestone_id}",
                timeout=20.0,
                not_found_detail="Character not found on Lodestone",
                service_label="Lodestone character data",
                log_context={"lodestone_id": lodestone_id},
                dev_error_codes=dev_error_codes,
            )
            data["__source"] = "xivapi"

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
    # Use Garland data when available; fall back to Tomestone-sourced name/level
    # (stored as "Name"/"ItemLevel" in item_data by _normalize_tomestone_gear_list)
    item_name = (
        item_info.get("name")
        if lookup_succeeded
        else (item_data.get("Name") if isinstance(item_data, dict) else None)
    )
    item_level = (
        _coerce_int(item_info.get("level"))
        or (
            _coerce_int(item_data.get("ItemLevel"))
            if isinstance(item_data, dict)
            else 0
        )
        or 0
    )
    item_icon = item_info.get("icon") or _fallback_icon_url(item_data)
    current_source = (
        classify_current_source(item_name, item_level, slot_name)
        if item_name and item_level
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
    display_name = resolved["item_name"] or "Unavailable item details"

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
    """Determine whether the player has obtained their BiS item for this slot.

    Semantics (in priority order):
    1. No equipped item → never complete.
    2. No BiS target configured (bisSource unset) → never complete.
    3. BiS has a specific item ID → exact ID match required.
       The item ID comes from the gear payload directly, so a failed Garland
       lookup does not prevent a match as long as the raw ID is present.
    4. BiS has no specific item ID (manual bisSource-only config) → fall back
       to source + item level matching. This preserves behaviour for manual BiS
       configurations where the user chose a source category without importing
       a specific item from xivgear/etro.
    """
    if not equipped or not equipped.get("has_equipped_item"):
        return False

    bis_source = gear_slot.get("bisSource")
    if not bis_source:
        # No BiS target configured — this slot cannot be complete.
        return False

    expected_item_id = _coerce_int(gear_slot.get("itemId"))
    equipped_item_id = _coerce_int(equipped.get("item_id"))

    if expected_item_id:
        # BiS has a specific item ID: exact match only.
        # If the equipped item has no resolved ID, we cannot confirm a match.
        return bool(equipped_item_id and expected_item_id == equipped_item_id)

    # No specific BiS item ID configured: fall back to source + item level matching.
    current_source = equipped.get("current_source", "unknown")
    if not _source_satisfies_bis(bis_source, current_source):
        return False

    bis_item_level = _coerce_int(gear_slot.get("itemLevel")) or 0
    equipped_item_level = _coerce_int(equipped.get("item_level")) or 0
    return not bis_item_level or equipped_item_level >= bis_item_level


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

    tomestone_provider = get_tomestone_provider(settings)
    if server.strip() and tomestone_provider.enabled:
        tomestone_result = await tomestone_provider.fetch_profile_by_name(server, name)
        if tomestone_result.available and tomestone_result.raw is not None:
            tomestone_payload = tomestone_profile_to_xivapi_payload(tomestone_result.raw)
            if tomestone_payload:
                character = tomestone_payload["Character"]
                lodestone_id = _coerce_int(character.get("ID"))
                if lodestone_id:
                    return CharacterSearchResponse(
                        results=[
                            CharacterSearchResult(
                                lodestone_id=lodestone_id,
                                name=str(character.get("Name") or "Unknown"),
                                server=str(character.get("Server") or "Unknown"),
                                avatar=_sanitize_avatar_url(character.get("Avatar")),
                            )
                        ],
                        total=1,
                    )
        elif tomestone_result.available and tomestone_result.error == "not_found":
            return CharacterSearchResponse(results=[], total=0)

    data = await _fetch_xivapi_json(
        "/character/search",
        params={"name": name, **({"server": server} if server else {})},
        timeout=15.0,
        not_found_detail=None,
        service_label="Lodestone search",
        log_context={"character_name": name, "server": server or None},
        dev_error_codes=True,
    )

    results_data = data.get("Results")
    if not isinstance(results_data, list):
        logger.warning(
            "xivapi_live_search_malformed_payload",
            reason="missing_results",
            upstream_url=f"{XIVAPI_BASE}/character/search",
            path="/character/search",
            character_name=name,
            server=server or None,
        )
        raise HTTPException(
            status_code=502,
            detail="upstream_bad_response" if settings.environment != "production" else "Invalid response from XIVAPI",
        )

    results = []
    for char in results_data:
        if not isinstance(char, dict):
            continue
        results.append(
            CharacterSearchResult(
                lodestone_id=_coerce_int(char.get("ID")) or 0,
                name=str(char.get("Name") or "Unknown"),
                server=str(char.get("Server") or "Unknown"),
                avatar=_sanitize_avatar_url(char.get("Avatar")),
            )
        )

    pagination = data.get("Pagination", {})
    total = (
        _coerce_int(pagination.get("ResultsTotal"))
        if isinstance(pagination, dict)
        else None
    )

    if not results:
        logger.info(
            "xivapi_live_search_no_results",
            upstream_url=f"{XIVAPI_BASE}/character/search",
            path="/character/search",
            character_name=name,
            server=server or None,
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
    force_refresh: bool = Query(False, description="Bypass local cache and fetch fresh data"),
    current_user: User = Depends(get_current_user),
):
    """Fetch a character's currently equipped gear from Lodestone via XIVAPI."""
    cache_key = f"lodestone_char_{lodestone_id}"
    if not force_refresh:
        cached = await xivapi_item_cache.get(cache_key)
        if cached:
            return CharacterGearResponse(**cached)

    refresh_attempted = False
    refresh_status = None
    if force_refresh:
        provider = get_tomestone_provider(settings)
        if provider.enabled:
            refresh_status = await provider.refresh_character(lodestone_id)
            refresh_attempted = True
            if refresh_status == "refresh_queued":
                import asyncio as _asyncio
                await _asyncio.sleep(2)

    data = await _fetch_character_payload(
        lodestone_id,
        require_usable_gear=False,
        dev_error_codes=True,
        no_cache=force_refresh,
        skip_refresh=refresh_attempted,
    )
    char = data["Character"]
    source = str(data.get("__source") or "xivapi")
    gear_set = char.get("GearSet", {}) if isinstance(char.get("GearSet"), dict) else {}
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set.get("Gear"), dict) else {}

    equipped_slots, _ = await _build_equipped_slots(gear_items)

    active_class = gear_set.get("Class", {}) if isinstance(gear_set, dict) else {}
    active_job = active_class.get("Abbreviation") if isinstance(active_class, dict) else None
    gear_available = _payload_has_usable_gear(data) and bool(equipped_slots)

    result = CharacterGearResponse(
        lodestone_id=lodestone_id,
        name=str(char.get("Name") or "Unknown"),
        server=str(char.get("Server") or "Unknown"),
        avatar=_sanitize_avatar_url(char.get("Avatar")),
        portrait=_sanitize_avatar_url(char.get("Portrait")),
        active_job=active_job,
        active_job_level=_coerce_int(gear_set.get("Level")) if isinstance(gear_set, dict) else None,
        gear=equipped_slots if gear_available else [],
        gear_available=gear_available,
        identity_only=not gear_available,
        source=source,
        refresh_attempted=refresh_attempted,
        refresh_status=refresh_status,
    )

    await xivapi_item_cache.set(cache_key, result.model_dump(), ttl=300)
    return result


async def _bridge_player_gear_snapshot(
    session: AsyncSession,
    user_id: str,
    lodestone_id_str: str,
    synced_job: str | None,
    gear: list[dict],
    avg_ilvl: int,
    source: str,
    now: str,
) -> None:
    """Bridge: when static roster gear syncs, also update the user's
    player-level gear snapshot if they have a linked character matching
    the same Lodestone ID. Fails silently on any error."""
    if not synced_job:
        return

    import uuid

    result = await session.execute(
        select(PlayerCharacter)
        .join(PlayerProfile)
        .where(
            PlayerProfile.user_id == user_id,
            PlayerCharacter.lodestone_id == lodestone_id_str,
        )
    )
    character = result.scalar_one_or_none()
    if not character:
        return

    job_upper = synced_job.upper()
    solo_gear = []
    for slot in gear:
        solo_gear.append({
            "slot": slot.get("slot"),
            "currentSource": slot.get("currentSource", "unknown"),
            "hasItem": False,
            "isAugmented": False,
            "equippedItemId": slot.get("equippedItemId"),
            "equippedItemName": slot.get("equippedItemName"),
            "equippedItemLevel": slot.get("equippedItemLevel", 0),
            "equippedItemIcon": slot.get("equippedItemIcon"),
            "itemLevel": slot.get("equippedItemLevel", 0),
        })

    snap_result = await session.execute(
        select(PlayerGearSnapshot).where(
            PlayerGearSnapshot.character_id == character.id,
            PlayerGearSnapshot.job == job_upper,
        )
    )
    snapshot = snap_result.scalar_one_or_none()

    bridge_source = "roster_sync"

    if snapshot:
        snapshot.gear = solo_gear
        snapshot.avg_item_level = avg_ilvl
        snapshot.source = bridge_source
        snapshot.synced_at = now
        snapshot.updated_at = now
    else:
        snapshot = PlayerGearSnapshot(
            id=str(uuid.uuid4()),
            character_id=character.id,
            job=job_upper,
            gear=solo_gear,
            avg_item_level=avg_ilvl,
            source=bridge_source,
            synced_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(snapshot)

    await session.flush()

    # Auto-link to matching job profile
    jp_result = await session.execute(
        select(PlayerJobProfile).where(
            PlayerJobProfile.profile_id == character.profile_id,
            PlayerJobProfile.job == job_upper,
        )
    )
    job_profile = jp_result.scalar_one_or_none()
    if job_profile:
        job_profile.gear_snapshot_id = snapshot.id
        job_profile.updated_at = now

    logger.info(
        "player_gear_bridge_synced",
        user_id=user_id,
        character_id=character.id,
        job=job_upper,
        avg_ilvl=avg_ilvl,
    )


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

    previous_gear = [dict(gear_slot) for gear_slot in _normalize_player_gear(player.gear)]
    previous_avg_ilvl = 0
    prev_ilvl_slots = [g for g in previous_gear if (g.get("equippedItemLevel") or 0) > 0]
    if prev_ilvl_slots:
        previous_avg_ilvl = round(
            sum(g["equippedItemLevel"] for g in prev_ilvl_slots) / len(prev_ilvl_slots)
        )

    data = await _fetch_character_payload(
        resolved_lodestone_id,
        require_usable_gear=True,
        dev_error_codes=True,
        no_cache=True,
    )
    character = data["Character"]
    sync_source = str(data.get("__source") or "xivapi")
    gear_set = character.get("GearSet", {})
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set, dict) else {}

    active_class = gear_set.get("Class", {}) if isinstance(gear_set, dict) else {}
    synced_job = active_class.get("Abbreviation") if isinstance(active_class, dict) else None

    _, equipped_by_slot = await _build_equipped_slots(gear_items)

    current_gear = [dict(gear_slot) for gear_slot in previous_gear]
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
            # Clear any previously stored equipped item details.
            gear_slot.pop("equippedItemId", None)
            gear_slot.pop("equippedItemLevel", None)
            gear_slot.pop("equippedItemName", None)
            gear_slot.pop("equippedItemIcon", None)
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
            # Store currently equipped item details separately from BiS target fields.
            # These are display-only — they do not affect BiS completion logic.
            if equipped.get("has_equipped_item"):
                gear_slot["equippedItemId"] = equipped.get("item_id")
                gear_slot["equippedItemLevel"] = equipped.get("item_level")
                gear_slot["equippedItemName"] = equipped.get("item_name")
                gear_slot["equippedItemIcon"] = equipped.get("item_icon")

        if gear_slot != previous_state:
            updated_count += 1

    bis_matched_count = sum(1 for s in current_gear if s.get("hasItem"))
    payload_changed = updated_count > 0
    now = datetime.now(timezone.utc).isoformat()
    lodestone_name = str(character.get("Name") or "") or None
    lodestone_server = str(character.get("Server") or "") or None
    avatar_value = character.get("Avatar")
    existing_avatar_url = getattr(player, "lodestone_avatar_url", None)
    lodestone_avatar_url = _sanitize_avatar_url(avatar_value) or existing_avatar_url

    new_avg_ilvl = 0
    new_ilvl_slots = [
        g for g in current_gear if (g.get("equippedItemLevel") or 0) > 0
    ]
    if new_ilvl_slots:
        new_avg_ilvl = round(
            sum(g["equippedItemLevel"] for g in new_ilvl_slots) / len(new_ilvl_slots)
        )

    job_mismatch_warning = None
    player_job = player.job
    if synced_job and player_job and synced_job.upper() != player_job.upper():
        job_mismatch_warning = (
            f"Synced gear appears to be for {synced_job}, but this player is set as "
            f"{player_job}. Lodestone may still be showing a previous gearset."
        )

    sync_warnings: list[str] = []
    if job_mismatch_warning:
        sync_warnings.append(f"job_mismatch: {synced_job} vs {player_job}")
    if previous_avg_ilvl > 0 and new_avg_ilvl > 0 and new_avg_ilvl < previous_avg_ilvl:
        sync_warnings.append(
            f"lower_avg_ilvl: upstream {new_avg_ilvl} vs stored {previous_avg_ilvl}"
        )
    missing_slots = sum(
        1 for g in current_gear
        if g.get("slot") and not equipped_by_slot.get(g["slot"])
    )
    if missing_slots:
        sync_warnings.append(f"missing_upstream_slots: {missing_slots}")
    stored_name = getattr(player, "lodestone_name", None)
    stored_server = getattr(player, "lodestone_server", None)
    if stored_server and lodestone_server and stored_server.lower().strip() != lodestone_server.lower().strip():
        sync_warnings.append(
            f"upstream_identity_mismatch: expected server {stored_server}, got {lodestone_server}"
        )
    if stored_name and lodestone_name and stored_name.lower().strip() != lodestone_name.lower().strip():
        sync_warnings.append(
            f"upstream_identity_mismatch: expected name {stored_name}, got {lodestone_name}"
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
    if hasattr(player, "last_sync_source"):
        player.last_sync_source = sync_source
    if hasattr(player, "last_synced_job"):
        player.last_synced_job = synced_job

    await session.flush()

    # --- Auto-sync bridge: update player-level gear snapshot if user has
    # a matching linked character in their solo profile. ---
    if player.user_id:
        try:
            await _bridge_player_gear_snapshot(
                session, player.user_id, str(resolved_lodestone_id),
                synced_job, current_gear, new_avg_ilvl, sync_source, now,
            )
        except Exception:
            logger.warning(
                "player_gear_bridge_failed",
                user_id=player.user_id,
                lodestone_id=resolved_lodestone_id,
            )

    await session.commit()

    logger.info(
        "lodestone_sync_complete",
        player_id=player_id,
        lodestone_id=resolved_lodestone_id,
        lodestone_name=lodestone_name,
        lodestone_server=lodestone_server,
        sync_source=sync_source,
        synced_job=synced_job,
        player_job=player_job,
        previous_avg_ilvl=previous_avg_ilvl,
        new_avg_ilvl=new_avg_ilvl,
        updated_slots=updated_count,
        payload_changed=payload_changed,
        job_mismatch=bool(job_mismatch_warning),
        sync_timestamp=now,
    )

    return SyncResult(
        updated_slots=updated_count,
        bis_matched_count=bis_matched_count,
        lodestone_id=str(resolved_lodestone_id),
        last_sync=now,
        lodestone_name=lodestone_name,
        lodestone_server=lodestone_server,
        lodestone_avatar_url=lodestone_avatar_url,
        gear=current_gear,
        sync_source=sync_source,
        synced_job=synced_job,
        payload_changed=payload_changed,
        job_mismatch_warning=job_mismatch_warning,
        warnings=sync_warnings,
    )


@router.post("/identity/{group_id}/{player_id}", response_model=IdentityLinkResult)
@limiter.limit(RATE_LIMITS["external_api"])
async def link_player_identity(
    request: Request,
    group_id: str,
    player_id: str,
    lodestone_id: int = Query(..., description="Numeric Lodestone character ID"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Link Lodestone identity from the public profile page without syncing gear."""
    membership = await require_membership(session, current_user.id, group_id)
    if membership.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot link Lodestone identity")

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
        raise HTTPException(status_code=403, detail="Members can only link their own player")

    identity = await _fetch_tomestone_identity(lodestone_id)
    if identity is None:
        identity = await _fetch_lodestone_identity(lodestone_id)
    elif not identity.get("lodestone_avatar_url"):
        try:
            lodestone_identity = await _fetch_lodestone_identity(lodestone_id)
            if lodestone_identity.get("lodestone_avatar_url"):
                identity["lodestone_avatar_url"] = lodestone_identity["lodestone_avatar_url"]
        except HTTPException:
            pass
    now = datetime.now(timezone.utc).isoformat()

    player.lodestone_id = str(lodestone_id)
    player.updated_at = now
    # Intentionally do not touch gear or last_sync: this is not a gear sync.
    if hasattr(player, "lodestone_name"):
        player.lodestone_name = identity["lodestone_name"]
    if hasattr(player, "lodestone_server"):
        player.lodestone_server = identity["lodestone_server"]
    if hasattr(player, "lodestone_avatar_url") and identity.get("lodestone_avatar_url"):
        player.lodestone_avatar_url = identity["lodestone_avatar_url"]

    await session.flush()
    await session.commit()

    logger.info(
        "lodestone_identity_link_complete",
        player_id=player_id,
        lodestone_id=lodestone_id,
    )

    return IdentityLinkResult(
        lodestone_id=str(lodestone_id),
        lodestone_name=identity["lodestone_name"],
        lodestone_server=identity["lodestone_server"],
        lodestone_avatar_url=identity.get("lodestone_avatar_url"),
        source=str(identity.get("source") or "lodestone_identity"),
    )
