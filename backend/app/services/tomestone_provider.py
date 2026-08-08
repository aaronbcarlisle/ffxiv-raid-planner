"""Experimental backend-only Tomestone character provider.

This provider is intentionally optional. It is disabled unless
TOMESTONE_API_TOKEN is present in backend environment settings.
"""

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from ..config import Settings
from ..logging_config import get_logger

logger = get_logger(__name__)

TOMESTONE_BASE_URL = "https://tomestone.gg"


@dataclass(frozen=True)
class TomestoneProbeResult:
    """Normalized Tomestone response shape for provider investigation."""

    provider: str
    available: bool
    character: dict[str, Any] | None = None
    raw: dict[str, Any] | None = None
    error: str | None = None


LODESTONE_SLOT_MAP = {
    "mainhand": "MainHand",
    "main_hand": "MainHand",
    "weapon": "MainHand",
    "offhand": "OffHand",
    "off_hand": "OffHand",
    "shield": "OffHand",
    "head": "Head",
    "body": "Body",
    "chest": "Body",
    "hands": "Hands",
    "gloves": "Hands",
    "legs": "Legs",
    "pants": "Legs",
    "feet": "Feet",
    "boots": "Feet",
    "earrings": "Earrings",
    "earring": "Earrings",
    "necklace": "Necklace",
    "neck": "Necklace",
    "bracelets": "Bracelets",
    "bracelet": "Bracelets",
    "ring1": "Ring1",
    "ring_1": "Ring1",
    "left_ring": "Ring1",
    "ring2": "Ring2",
    "ring_2": "Ring2",
    "right_ring": "Ring2",
}

# Tomestone gear entries carry the item's UI category (categoryId/categoryName).
# Armor, accessory, and shield categories map 1:1 to slots. Weapon categories
# vary per job ("Gladiator's Arm", "Machinist's Arm", ...) so the main hand is
# recognized by list position 0 instead. Soul Crystal entries are skipped.
# Verified live 2026-08-08: non-shield jobs omit the off-hand entry (12
# entries); shield jobs insert it at position 6 (13 entries), which is why
# position-based mapping shifted every accessory before the category rewrite.
TOMESTONE_CATEGORY_SLOTS: dict[int, str] = {
    # 11 IS Shield in FFXIV's ItemUICategory (confirmed against both the live
    # capture and XIVAPI's sheet) — maps to the planner's OffHand slot.
    11: "OffHand",
    34: "Head",
    35: "Body",
    37: "Hands",
    36: "Legs",
    38: "Feet",
    41: "Earrings",
    40: "Necklace",
    42: "Bracelets",
}
TOMESTONE_RING_CATEGORY_ID = 43
TOMESTONE_SKIPPED_CATEGORY_IDS = {62}  # Soul Crystal

# Fallback when categoryId is absent — same slots, keyed by lowercased categoryName.
TOMESTONE_CATEGORY_NAME_SLOTS: dict[str, str] = {
    "shield": "OffHand",
    "head": "Head",
    "body": "Body",
    "hands": "Hands",
    "legs": "Legs",
    "feet": "Feet",
    "earrings": "Earrings",
    "necklace": "Necklace",
    "bracelets": "Bracelets",
}


class TomestoneProvider:
    """Small wrapper around Tomestone's authenticated character API."""

    def __init__(self, settings: Settings):
        self._token = (settings.tomestone_api_token or "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self._token)

    def _headers(self, *, no_cache: bool = False) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._token}",
        }
        if no_cache:
            headers["Cache-Control"] = "no-cache"
        return headers

    async def refresh_character(self, lodestone_id: int) -> str:
        """Ask Tomestone to re-crawl a character.

        The /character/update/{id} endpoint is a website action (not an API
        endpoint). It must be called with browser-like headers — sending the
        API Bearer token or Accept: application/json causes it to fail or
        return the wrong response.

        Returns a status string: refreshed, refresh_queued, not_supported,
        upstream_unavailable, rate_limited, forbidden, bad_response.
        """
        if not self.enabled:
            return "not_supported"

        url = f"{TOMESTONE_BASE_URL}/character/update/{lodestone_id}"
        # Browser-like headers — this is a website endpoint, not the API.
        refresh_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "ffxiv-raid-planner/gear-sync",
        }
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(
                    url,
                    headers=refresh_headers,
                    timeout=15.0,
                )
        except httpx.TimeoutException:
            logger.warning("tomestone_refresh_failed", lodestone_id=lodestone_id, reason="timeout")
            return "upstream_unavailable"
        except httpx.RequestError as exc:
            logger.warning("tomestone_refresh_failed", lodestone_id=lodestone_id, reason=exc.__class__.__name__)
            return "upstream_unavailable"

        if response.status_code == 200:
            # Tomestone gates the update endpoint behind a human-verification
            # cookie ("tomestone_human_verified").  When that cookie is absent
            # the server still returns 200 but with a bot-check page instead
            # of actually queuing a refresh.  Detect this so callers don't
            # mistakenly believe a refresh was triggered.
            body = response.text.lower()
            if "human" in body and "bot" in body and "cookie" in body:
                logger.info(
                    "tomestone_refresh_blocked_bot_gate",
                    lodestone_id=lodestone_id,
                )
                return "not_supported"
            logger.info("tomestone_refresh_triggered", lodestone_id=lodestone_id)
            return "refresh_queued"
        if response.status_code == 429:
            logger.warning("tomestone_refresh_failed", lodestone_id=lodestone_id, reason="rate_limited", status_code=429)
            return "rate_limited"
        if response.status_code in {401, 403}:
            logger.warning("tomestone_refresh_failed", lodestone_id=lodestone_id, reason="forbidden", status_code=response.status_code)
            return "forbidden"

        logger.warning("tomestone_refresh_failed", lodestone_id=lodestone_id, reason="bad_response", status_code=response.status_code)
        return "bad_response"

    async def fetch_profile_by_id(
        self, lodestone_id: int, *, no_cache: bool = False, skip_refresh: bool = False,
    ) -> TomestoneProbeResult:
        if not self.enabled:
            return TomestoneProbeResult(provider="tomestone", available=False, error="disabled")

        if no_cache and not skip_refresh:
            refresh_status = await self.refresh_character(lodestone_id)
            if refresh_status == "refresh_queued":
                import asyncio
                await asyncio.sleep(2)

        return await self._fetch_json(
            f"/api/character/profile/{lodestone_id}",
            log_context={"lookup": "id", "lodestone_id": lodestone_id},
            no_cache=no_cache,
        )

    async def fetch_profile_by_name(self, server: str, name: str) -> TomestoneProbeResult:
        if not self.enabled:
            return TomestoneProbeResult(provider="tomestone", available=False, error="disabled")

        encoded_server = quote(server.strip(), safe="")
        encoded_name = quote(name.strip(), safe="")
        return await self._fetch_json(
            f"/api/character/profile/{encoded_server}/{encoded_name}",
            log_context={"lookup": "name", "server": server, "character_name": name},
        )

    async def _fetch_json(
        self, path: str, *, log_context: dict[str, Any], no_cache: bool = False,
    ) -> TomestoneProbeResult:
        url = f"{TOMESTONE_BASE_URL}{path}"
        try:
            async with httpx.AsyncClient(follow_redirects=False) as client:
                response = await client.get(url, headers=self._headers(no_cache=no_cache), timeout=15.0)
        except httpx.TimeoutException:
            logger.warning("tomestone_provider_failed", reason="timeout", path=path, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=False, error="timeout")
        except httpx.RequestError as exc:
            logger.warning(
                "tomestone_provider_failed",
                reason="request_error",
                path=path,
                error=exc.__class__.__name__,
                **log_context,
            )
            return TomestoneProbeResult(provider="tomestone", available=False, error="unavailable")

        if response.status_code == 404:
            logger.info("tomestone_provider_not_found", path=path, status_code=response.status_code, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=True, error="not_found")

        if response.status_code in {401, 403}:
            logger.warning("tomestone_provider_failed", reason="auth_failed", path=path, status_code=response.status_code, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=False, error="auth_failed")

        if response.status_code != 200:
            logger.warning("tomestone_provider_failed", reason="unexpected_status", path=path, status_code=response.status_code, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=False, error="bad_status")

        try:
            payload = response.json()
        except Exception:
            logger.warning("tomestone_provider_failed", reason="bad_json", path=path, status_code=response.status_code, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=False, error="bad_json")

        if not isinstance(payload, dict):
            logger.warning("tomestone_provider_failed", reason="bad_payload", path=path, status_code=response.status_code, **log_context)
            return TomestoneProbeResult(provider="tomestone", available=False, error="bad_payload")

        return TomestoneProbeResult(
            provider="tomestone",
            available=True,
            character=_summarize_character_payload(payload),
            raw=payload,
        )


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
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


def _summarize_character_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Best-effort summary for investigation without assuming final schema."""
    character = payload.get("character") if isinstance(payload.get("character"), dict) else payload
    profile = character.get("profile") if isinstance(character.get("profile"), dict) else {}
    gear = (
        character.get("gear")
        or character.get("gearset")
        or character.get("gear_set")
        or character.get("equipment")
        or profile.get("gear")
        or _extract_tomestone_current_gear(profile)
    )

    return {
        "name": _first_present(character, "name", "Name") or _first_present(profile, "name", "Name"),
        "server": (
            _first_present(character, "server", "world", "Server", "World")
            or _first_present(profile, "server", "world", "Server", "World")
        ),
        "avatar": _sanitize_avatar_url(
            _first_present(character, "avatar", "avatar_url", "avatarUrl", "Avatar")
            or _first_present(profile, "avatar", "avatar_url", "avatarUrl", "Avatar")
        ),
        "portrait": _sanitize_avatar_url(
            _first_present(character, "portrait", "portrait_url", "portraitUrl", "Portrait")
            or _first_present(profile, "portrait", "portrait_url", "portraitUrl", "Portrait")
        ),
        "has_gear": isinstance(gear, (dict, list)) and bool(gear),
        "gear_container_type": type(gear).__name__ if gear is not None else None,
        "sample_keys": sorted(str(key) for key in character.keys())[:20],
    }


def tomestone_profile_to_xivapi_payload(payload: dict[str, Any], *, fallback_lodestone_id: int | None = None) -> dict[str, Any] | None:
    """Convert common Tomestone profile shapes into the existing Lodestone payload shape.

    Tomestone's public OpenAPI schema does not document response fields, so this
    remains intentionally best-effort and falls back to existing providers when
    the shape is not recognizable.
    """
    if not isinstance(payload, dict):
        return None

    character = payload.get("character") if isinstance(payload.get("character"), dict) else payload
    profile = character.get("profile") if isinstance(character.get("profile"), dict) else {}

    lodestone_id = _first_present(
        character,
        "lodestone_id",
        "lodestoneId",
        "lodestone",
        "id",
        "ID",
    ) or _first_present(profile, "lodestone_id", "lodestoneId", "lodestone", "id", "ID")
    name = _first_present(character, "name", "Name") or _first_present(profile, "name", "Name")
    server = (
        _first_present(character, "server", "world", "Server", "World")
        or _first_present(profile, "server", "world", "Server", "World")
    )
    avatar = (
        _first_present(character, "avatar", "avatar_url", "avatarUrl", "Avatar")
        or _first_present(profile, "avatar", "avatar_url", "avatarUrl", "Avatar")
    )
    portrait = (
        _first_present(character, "portrait", "portrait_url", "portraitUrl", "Portrait")
        or _first_present(profile, "portrait", "portrait_url", "portraitUrl", "Portrait")
    )

    if not name or not server:
        return None

    gear = _extract_gear_container(character, profile)
    # Tomestone's deep gear path returns a positional list with no slot names;
    # use position-based normalization when shallow normalization yields nothing.
    gear_items = _normalize_gear_items(gear)
    if not gear_items and isinstance(gear, list):
        gear_items = _normalize_tomestone_gear_list(gear)
    active_job, active_level = _extract_active_job(character, profile)

    return {
        "Character": {
            "ID": _coerce_int(lodestone_id) or fallback_lodestone_id,
            "Name": str(name),
            "Server": str(server),
            "Avatar": _sanitize_avatar_url(avatar),
            "Portrait": _sanitize_avatar_url(portrait),
            "GearSet": {
                "Class": {"Abbreviation": active_job} if active_job else {},
                "Level": active_level,
                "Gear": gear_items,
            },
        }
    }


def _extract_tomestone_current_gear(profile: dict[str, Any]) -> list[Any] | None:
    """Navigate Tomestone's deep gear path: profile.currentGearSetAndAttributes.gearSet.gear.

    Returns the positional gear list when found, or None when the path is absent.
    Items in the list have no slot names — callers must classify entries by item
    category via _normalize_tomestone_gear_list.
    """
    if not isinstance(profile, dict):
        return None
    current_attrs = profile.get("currentGearSetAndAttributes")
    if not isinstance(current_attrs, dict):
        return None
    gear_set = current_attrs.get("gearSet")
    if not isinstance(gear_set, dict):
        return None
    gear = gear_set.get("gear")
    if isinstance(gear, list) and gear:
        return gear
    return None


def _normalize_tomestone_gear_list(gear_list: list[Any]) -> dict[str, dict[str, Any]]:
    """Convert Tomestone's positional gear list into XIVAPI Gear dict shape.

    Entries are classified by item category rather than list position: shield
    jobs (PLD) get an off-hand entry inserted mid-list, which shifted every
    accessory under the old fixed-position mapping. The main hand is always
    the position-0 entry (weapon categories vary per job). Shield and Soul
    Crystal entries are skipped. Unknown categories (crafter tools, future
    slots) are skipped rather than misfiled.
    """
    normalized: dict[str, dict[str, Any]] = {}
    ring_count = 0

    for position, raw_slot in enumerate(gear_list):
        if not isinstance(raw_slot, dict):
            continue
        item = raw_slot.get("item")
        if not isinstance(item, dict):
            continue
        item_id = _coerce_int(item.get("id") or item.get("itemId") or item.get("item_id"))
        if not item_id:
            continue

        category_id = _coerce_int(item.get("categoryId"))
        category_name = (item.get("categoryName") or "").strip().lower()

        if category_id in TOMESTONE_SKIPPED_CATEGORY_IDS or category_name == "soul crystal":
            continue

        # Position 0 is the main hand, but only when the entry isn't already a
        # recognized armor/accessory category — Tomestone omits absent entries,
        # so an unexpected list head must not be misfiled as the weapon.
        # Weapon categories vary per job and appear in none of the maps, so
        # real weapons always fall through to this claim.
        is_known_gear_category = (
            category_id in TOMESTONE_CATEGORY_SLOTS
            or category_id == TOMESTONE_RING_CATEGORY_ID
            or category_name in TOMESTONE_CATEGORY_NAME_SLOTS
            or category_name == "ring"
        )
        if position == 0 and not is_known_gear_category:
            slot_name = "MainHand"
        elif category_id == TOMESTONE_RING_CATEGORY_ID or category_name == "ring":
            ring_count += 1
            if ring_count > 2:
                continue
            slot_name = "Ring1" if ring_count == 1 else "Ring2"
        elif category_id in TOMESTONE_CATEGORY_SLOTS:
            slot_name = TOMESTONE_CATEGORY_SLOTS[category_id]
        elif category_name in TOMESTONE_CATEGORY_NAME_SLOTS:
            slot_name = TOMESTONE_CATEGORY_NAME_SLOTS[category_name]
        else:
            # Unknown category (crafter secondary tools, facewear, future slots)
            continue

        icon = item.get("icon")
        item_name = item.get("name")
        item_level = item.get("itemLevel") or item.get("item_level")
        normalized[slot_name] = {
            "ID": item_id,
            **({"Icon": icon} if icon else {}),
            **({"Name": item_name} if item_name else {}),
            **({"ItemLevel": item_level} if item_level else {}),
        }

    return normalized


def _extract_gear_container(character: dict[str, Any], profile: dict[str, Any]) -> Any:
    for container in (character, profile):
        for key in ("gear", "gearset", "gear_set", "equipment", "items"):
            value = container.get(key)
            if value:
                return value
    # Fall back to Tomestone's deep path (positional list)
    return _extract_tomestone_current_gear(profile)


def _extract_active_job(character: dict[str, Any], profile: dict[str, Any]) -> tuple[str | None, int | None]:
    for container in (character, profile):
        job = container.get("job")
        if isinstance(job, dict):
            return (
                _first_present(job, "abbreviation", "abbr", "code", "name"),
                _coerce_int(_first_present(job, "level", "Level")),
            )
        if isinstance(job, str):
            return job, _coerce_int(_first_present(container, "level", "job_level", "jobLevel"))

        active_class = container.get("class") or container.get("classJob") or container.get("class_job")
        if isinstance(active_class, dict):
            return (
                _first_present(active_class, "abbreviation", "abbr", "code", "name"),
                _coerce_int(_first_present(active_class, "level", "Level")),
            )

    return None, None


def _normalize_gear_items(gear: Any) -> dict[str, dict[str, Any]]:
    if isinstance(gear, dict):
        iterable = gear.items()
    elif isinstance(gear, list):
        iterable = enumerate(gear)
    else:
        return {}

    normalized: dict[str, dict[str, Any]] = {}
    ring_count = 0

    for raw_slot, raw_item in iterable:
        if not isinstance(raw_item, dict):
            continue

        slot_name = _extract_slot_name(raw_slot, raw_item)
        lodestone_slot = LODESTONE_SLOT_MAP.get(slot_name.lower().replace(" ", "_").replace("-", "_"))
        if not lodestone_slot and "ring" in slot_name.lower():
            ring_count += 1
            lodestone_slot = "Ring1" if ring_count == 1 else "Ring2"
        if not lodestone_slot:
            continue

        item_id = _coerce_int(
            _first_present(raw_item, "item_id", "itemId", "itemID", "lodestone_id", "lodestoneId", "id", "ID")
        )
        if not item_id:
            nested_item = raw_item.get("item") if isinstance(raw_item.get("item"), dict) else {}
            item_id = _coerce_int(
                _first_present(nested_item, "item_id", "itemId", "itemID", "lodestone_id", "lodestoneId", "id", "ID")
            )
        if not item_id:
            continue

        icon = _first_present(raw_item, "icon", "icon_url", "iconUrl", "Icon")
        if not icon and isinstance(raw_item.get("item"), dict):
            icon = _first_present(raw_item["item"], "icon", "icon_url", "iconUrl", "Icon")

        normalized[lodestone_slot] = {
            "ID": item_id,
            **({"Icon": icon} if icon else {}),
        }

    return normalized


def _extract_slot_name(raw_slot: Any, raw_item: dict[str, Any]) -> str:
    slot_value = _first_present(raw_item, "slot", "slot_name", "slotName", "name", "equipmentSlot")
    if isinstance(slot_value, dict):
        slot_value = _first_present(slot_value, "name", "key", "slot")
    if slot_value:
        return str(slot_value)
    return str(raw_slot)


def _coerce_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def get_tomestone_provider(settings: Settings) -> TomestoneProvider:
    return TomestoneProvider(settings)
