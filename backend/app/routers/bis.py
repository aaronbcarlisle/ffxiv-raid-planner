"""BiS Import Router - Fetches gear sets from external tools"""

import asyncio
import re
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..cache import xivapi_item_cache
from ..constants import VALID_JOBS
from ..logging_config import get_logger
from ..rate_limit import RATE_LIMITS, limiter

router = APIRouter(prefix="/api/bis", tags=["bis"])
logger = get_logger(__name__)

# Valid tier names for BiS import (prevents path traversal)
VALID_TIERS = frozenset({
    "current",    # Current savage tier
    "fru",        # Futures Rewritten (Ultimate)
    "top",        # The Omega Protocol (Ultimate)
    "dsr",        # Dragonsong's Reprise (Ultimate)
    "tea",        # The Epic of Alexander (Ultimate)
    "ucob",       # The Unending Coil of Bahamut (Ultimate)
    "uwu",        # The Weapon's Refrain (Ultimate)
})


class MateriaSlot(BaseModel):
    """A single materia slot on an item"""
    itemId: int
    itemName: str
    stat: Optional[str] = None   # e.g., "Critical Hit"
    tier: Optional[int] = None   # e.g., 12
    icon: Optional[str] = None


class GearSlotData(BaseModel):
    """Data for a single gear slot from BiS import"""
    slot: str
    source: str  # 'raid', 'tome', 'base_tome', or 'crafted'
    itemId: Optional[int] = None
    itemName: Optional[str] = None
    itemLevel: Optional[int] = None
    itemIcon: Optional[str] = None  # Full icon URL from XIVAPI
    itemStats: Optional[dict[str, int]] = None  # Base stats (e.g., {"Strength": 847, "Vitality": 943})
    materia: list[MateriaSlot] = []  # Melded materia


class BiSImportResponse(BaseModel):
    """Response from BiS import endpoint"""
    name: str
    job: str
    slots: list[GearSlotData]


class BiSPreset(BaseModel):
    """A single BiS preset option"""
    name: str
    index: int  # Display order index
    uuid: Optional[str] = None  # XIVGear shortlink UUID (for shortlink presets)
    setIndex: Optional[int] = None  # Set index within the XIVGear sheet
    githubIndex: Optional[int] = None  # Set index in GitHub tier file (for GitHub presets)
    githubTier: Optional[str] = None  # GitHub tier name (e.g., "current", "fru", "top")
    description: Optional[str] = None  # Optional description from The Balance
    category: Optional[str] = None  # 'savage', 'ultimate', or 'prog'
    gcd: Optional[str] = None  # GCD tier (e.g., "2.50")


class BiSPresetsResponse(BaseModel):
    """Available BiS presets for a job"""
    job: str
    presets: list[BiSPreset]


# Local preset cache (loaded from file)
_local_presets: Optional[dict] = None


def load_local_presets() -> dict:
    """Load local BiS presets from JSON file."""
    global _local_presets
    if _local_presets is not None:
        return _local_presets

    import json
    from pathlib import Path

    preset_file = Path(__file__).parent.parent / "data" / "local_bis_presets.json"
    if preset_file.exists():
        try:
            with open(preset_file, "r") as f:
                _local_presets = json.load(f)
        except Exception:
            _local_presets = {}
    else:
        _local_presets = {}

    return _local_presets


# XIVGear slot names to our slot names
XIVGEAR_SLOT_MAP = {
    "Weapon": "weapon",
    "Head": "head",
    "Body": "body",
    "Hand": "hands",
    "Legs": "legs",
    "Feet": "feet",
    "Ears": "earring",
    "Neck": "necklace",
    "Wrist": "bracelet",
    "RingLeft": "ring1",
    "RingRight": "ring2",
}

# Etro slot names to our slot names
ETRO_SLOT_MAP = {
    "weapon": "weapon",
    "head": "head",
    "body": "body",
    "hands": "hands",
    "legs": "legs",
    "feet": "feet",
    "ears": "earring",
    "neck": "necklace",
    "wrists": "bracelet",
    "fingerL": "ring1",
    "fingerR": "ring2",
}

def extract_bis_path(url_or_uuid: str) -> tuple[str, str | None]:
    """
    Extract identifier from various XIVGear URL formats.

    Returns:
        tuple of (identifier, type) where type is:
        - None for UUID/shortlink
        - "bis" for curated BiS path (e.g., "drg/current")
    """
    # Check for curated BiS format: bis|job|tier or bis/job/tier (pipe may be URL-encoded as %7C)
    bis_match = re.search(r'(?:page=)?bis(?:\||%7C|/)(\w+)(?:\||%7C|/)(\w+)', url_or_uuid, re.IGNORECASE)
    if bis_match:
        job = bis_match.group(1).lower()
        tier = bis_match.group(2).lower()
        return f"{job}/{tier}", "bis"

    # Already a UUID (with or without dashes)
    uuid_pattern = r'^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$'
    if re.match(uuid_pattern, url_or_uuid, re.IGNORECASE):
        return url_or_uuid, None

    # URL format: https://xivgear.app/share/{uuid}
    share_match = re.search(r'xivgear\.app/share/([a-f0-9-]+)', url_or_uuid, re.IGNORECASE)
    if share_match:
        return share_match.group(1), None

    # URL format: https://xivgear.app/?page=sl|{uuid} (pipe may be URL-encoded as %7C)
    page_match = re.search(r'page=sl(?:\||%7C)([a-f0-9-]+)', url_or_uuid, re.IGNORECASE)
    if page_match:
        return page_match.group(1), None

    # Try to extract any UUID-like string
    any_uuid = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', url_or_uuid, re.IGNORECASE)
    if any_uuid:
        return any_uuid.group(1), None

    raise ValueError(f"Could not extract UUID or BiS path from: {url_or_uuid}")


def build_icon_url(icon_data: dict) -> str | None:
    """Build XIVAPI icon URL from icon path data."""
    if not icon_data or not isinstance(icon_data, dict):
        return None

    path = icon_data.get("path", "")
    if not path:
        return None

    # Extract folder and icon ID from path like "ui/icon/031000/031676.tex"
    # URL format: https://xivapi.com/i/031000/031676.png
    import re
    match = re.search(r'ui/icon/(\d+)/(\d+)', path)
    if match:
        folder, icon_id = match.groups()
        return f"https://xivapi.com/i/{folder}/{icon_id}.png"

    return None


def extract_item_stats(fields: dict) -> dict[str, int]:
    """Extract base stats from XIVAPI item fields."""
    stats = {}
    base_params = fields.get("BaseParam", [])
    base_values = fields.get("BaseParamValue", [])

    # Relevant combat stats we care about
    relevant_stats = {
        "Strength", "Dexterity", "Vitality", "Intelligence", "Mind",
        "Critical Hit", "Determination", "Direct Hit Rate",
        "Skill Speed", "Spell Speed", "Tenacity", "Piety"
    }

    for i, param in enumerate(base_params):
        if not param or not isinstance(param, dict):
            continue

        param_fields = param.get("fields", {})
        stat_name = param_fields.get("Name", "")

        if stat_name in relevant_stats and i < len(base_values):
            value = base_values[i]
            if value and value > 0:
                stats[stat_name] = value

    return stats


def build_icon_url_from_id(icon_id: int | str, high_res: bool = False) -> str | None:
    """Build XIVAPI icon URL from icon ID.

    Args:
        icon_id: Icon ID (e.g., 31676 or "t/31676")
        high_res: If True, use high-resolution version (_hr1 suffix)

    Examples:
        31676 -> /i/031000/031676.png
        31676, high_res=True -> /i/031000/031676_hr1.png
    """
    if not icon_id:
        return None
    try:
        icon_num = int(str(icon_id).lstrip("t/"))
        # Calculate folder (floor to nearest 1000)
        folder = (icon_num // 1000) * 1000
        suffix = "_hr1" if high_res else ""
        return f"https://xivapi.com/i/{folder:06d}/{icon_num:06d}{suffix}.png"
    except (ValueError, TypeError):
        return None


# Materia stat name mappings (from materia names to stat names)
MATERIA_STAT_MAP = {
    "savage aim": "Critical Hit",
    "savage might": "Determination",
    "heavens' eye": "Direct Hit Rate",
    "quickarm": "Skill Speed",
    "quicktongue": "Spell Speed",
    "battledance": "Tenacity",
    "piety": "Piety",
}

# Roman numeral to integer mapping (ordered longest to shortest for matching)
ROMAN_NUMERALS = [
    ("XV", 15), ("XIV", 14), ("XIII", 13), ("XII", 12), ("XI", 11),
    ("X", 10), ("IX", 9), ("VIII", 8), ("VII", 7), ("VI", 6),
    ("V", 5), ("IV", 4), ("III", 3), ("II", 2), ("I", 1),
]


def parse_materia_name(name: str) -> tuple[str | None, int | None]:
    """
    Parse materia name to extract stat type and tier.

    Examples:
        "Savage Might Materia XII" -> ("Determination", 12)
        "Heavens' Eye Materia X" -> ("Direct Hit Rate", 10)

    Returns:
        Tuple of (stat_name, tier) or (None, None) if parsing fails.
    """
    if not name:
        return None, None

    # Lowercase for matching
    name_lower = name.lower()

    # Extract tier from end (e.g., "Materia XII")
    # Iterate longest to shortest to avoid matching "I" when "XII" is present
    tier = None
    for numeral, value in ROMAN_NUMERALS:
        if name_lower.endswith(f" {numeral.lower()}"):
            tier = value
            break

    # Extract stat from beginning
    stat = None
    for pattern, stat_name in MATERIA_STAT_MAP.items():
        if pattern in name_lower:
            stat = stat_name
            break

    return stat, tier


async def fetch_materia_from_garland(materia_id: int) -> MateriaSlot | None:
    """
    Fetch materia details from Garland Tools API with caching.

    Returns a MateriaSlot or None if fetch fails.
    """
    cache_key = f"materia_{materia_id}"

    # Check cache first
    cached = await xivapi_item_cache.get(cache_key)
    if cached:
        return MateriaSlot(**cached)

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                f"https://www.garlandtools.org/db/doc/item/en/3/{materia_id}.json",
                timeout=10.0
            )
            # Reject redirects to prevent SSRF
            if 300 <= response.status_code < 400:
                logger.warning("garland_materia_unexpected_redirect", item_id=materia_id, status=response.status_code)
                return None
            if response.status_code == 200:
                data = response.json()
                item = data.get("item", {})
                name = item.get("name", "Unknown Materia")

                # Parse stat and tier from name
                stat, tier = parse_materia_name(name)

                # Get high-res icon for materia
                icon_path = item.get("icon", "")
                icon_url = build_icon_url_from_id(icon_path, high_res=True)

                result = MateriaSlot(
                    itemId=materia_id,
                    itemName=name,
                    stat=stat,
                    tier=tier,
                    icon=icon_url,
                )

                # Cache the result
                await xivapi_item_cache.set(cache_key, result.model_dump())
                logger.debug("garland_materia_cached", item_id=materia_id, name=name)
                return result
        except Exception as e:
            logger.warning("garland_materia_fetch_error", item_id=materia_id, error=str(e))

    return None


async def fetch_item_from_garland(item_id: int) -> dict:
    """Fetch item details from Garland Tools API with caching."""
    cache_key = str(item_id)

    # Check cache first
    cached = await xivapi_item_cache.get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            # Use Garland Tools API which has current patch data
            response = await client.get(
                f"https://www.garlandtools.org/db/doc/item/en/3/{item_id}.json",
                timeout=10.0
            )
            # Reject redirects to prevent SSRF
            if 300 <= response.status_code < 400:
                logger.warning("garland_unexpected_redirect", item_id=item_id, status=response.status_code)
                return {"id": item_id, "name": "Unknown", "level": 0, "icon": None, "stats": {}}
            if response.status_code == 200:
                data = response.json()
                item = data.get("item", {})

                # Extract item level
                level = item.get("ilvl", 0)

                # Extract icon URL from icon path (e.g., "t/31676")
                icon_path = item.get("icon", "")
                icon_url = build_icon_url_from_id(icon_path)

                # Extract base stats from attr dict
                attr = item.get("attr", {})
                stats = {}
                relevant_stats = {
                    "Strength", "Dexterity", "Vitality", "Intelligence", "Mind",
                    "Critical Hit", "Determination", "Direct Hit Rate",
                    "Skill Speed", "Spell Speed", "Tenacity", "Piety"
                }
                for stat_name, value in attr.items():
                    if stat_name in relevant_stats and isinstance(value, (int, float)) and value > 0:
                        stats[stat_name] = int(value)

                result = {
                    "id": item_id,
                    "name": item.get("name", "Unknown"),
                    "level": level,
                    "icon": icon_url,
                    "stats": stats,
                }
                await xivapi_item_cache.set(cache_key, result)
                logger.debug("garland_item_cached", item_id=item_id, name=result["name"])
                return result
        except Exception as e:
            logger.warning("garland_fetch_error", item_id=item_id, error=str(e))

    return {"id": item_id, "name": "Unknown", "level": 0, "icon": None, "stats": {}}


def determine_source(item_name: str, item_level: int, slot: str) -> str:
    """
    Determine if item is raid, tome (augmented), base_tome (unaugmented), or crafted.

    Typical tier item level relationships (armor/weapon):
    - Savage: highest tier iLv (e.g., 790/795)
    - Tome (augmented): same as savage (e.g., 790/795), name starts with "Aug."
    - Base Tome (unaugmented): 10 iLv below (e.g., 780/785)
    - Crafted: 20 iLv below savage (e.g., 770)

    Key insight: Only tome gear can be augmented in FFXIV.
    - "Aug." prefix = tome (augmented version is BiS, needs augmentation)
    - Tome gear WITHOUT "Aug." prefix = base_tome (base version is BiS, no augmentation needed)
    """
    if not item_name or item_name == "Unknown":
        return "raid"  # Unknown, default to raid

    item_name_lower = item_name.lower()

    # DEFINITIVE CHECK: "Aug." prefix means augmented tome gear
    # Only tomestone gear can be augmented, so this is 100% reliable
    # Return "tome" which indicates augmentation IS required
    if item_name_lower.startswith("aug.") or item_name_lower.startswith("augmented"):
        return "tome"

    # Crafted gear patterns (pentamelded HQ gear)
    # These are recognizable by tier-specific naming conventions
    # NOTE: Keep in sync with frontend/src/utils/bisSourceDetection.ts
    crafted_patterns = [
        "claro-",      # 7.4 crafted (placeholder - update when known)
        "agonist",     # 7.2 crafted
        "archeo kingdom",  # 7.0 crafted (careful: sometimes confused with savage)
        "diadochos",   # 6.4 crafted
        "rinascita",   # 6.2 crafted (careful: could be tome)
        "classical",   # 6.0 crafted
        "pactmaker",   # 6.x crafted
    ]

    # Note: Some gear names can overlap between crafted and other categories
    # We prioritize by checking crafted item levels first

    # Savage/raid gear patterns (check these - they're more specific)
    raid_patterns = [
        "grand champion",      # 7.4 savage
        "cruiserweight champion",  # 7.2 savage
        "light-heavyweight champion",  # 7.0 savage
        "ascension",           # 6.x savage
        "asphodelos",          # 6.0 savage
        "abyssos",             # 6.2 savage
        "anabaseios",          # 6.4 savage
    ]

    for pattern in raid_patterns:
        if pattern in item_name_lower:
            return "raid"

    # Tomestone gear patterns (base names without Aug. prefix)
    # These return "base_tome" since they don't have the Aug. prefix,
    # meaning the BiS is the base version that doesn't need augmentation
    # NOTE: Keep in sync with frontend/src/utils/bisSourceDetection.ts
    tome_patterns = [
        "bygone",        # 7.4 tome gear (placeholder - update when known)
        "quetzalli",     # 7.2 tome gear
        "neo kingdom",   # 7.0 tome gear
        "credendum",     # 6.x tome gear
        "lunar envoy",   # 6.4 tome
        "moonward",      # 6.0 tome
        "radiant",       # Other tome
    ]

    for pattern in tome_patterns:
        if pattern in item_name_lower:
            # Base tome gear (no Aug. prefix) = base_tome
            return "base_tome"

    # Check for crafted patterns
    for pattern in crafted_patterns:
        if pattern in item_name_lower:
            # Verify by item level (crafted is typically 20 iLv below savage)
            # Current tier: 770 crafted, 790 savage, 780 tome
            if item_level > 0 and item_level <= 780:
                return "crafted"
            # If iLv is higher, it's probably been confused with raid/tome
            break

    # Item level-based detection for unlisted gear
    if item_level <= 0:
        return "raid"

    # Current tier iLv thresholds (7.4: savage=790/795, tome=780/785, crafted=770)
    # Only classify as crafted if iLv is in the current crafted range (765-770)
    # Old tier gear (e.g., 630, 710) should fall through to base_tome default
    # This prevents false positives on legacy BiS sets
    if 765 <= item_level <= 770:
        return "crafted"

    # For weapon, higher threshold
    if slot == "weapon":
        # 795 = savage, 790 = augmented tome (needs aug), 785 = base tome
        if item_level >= 795:
            return "raid"
        elif item_level >= 790:
            return "tome"  # Augmented tome weapon
        else:
            return "base_tome"

    # For armor/accessories: 790 = savage or augmented tome, 780 = base tome
    # Note: Augmented tome is already caught above by the "Aug." prefix check (line 317-318)
    # So any iLv 790 item reaching here that doesn't match patterns is assumed to be raid
    if item_level >= 790:
        return "raid"
    return "base_tome"


async def fetch_bis_from_github(job: str, tier: str) -> dict:
    """Fetch curated BiS data from the static-bis-sets GitHub repo.

    Args:
        job: Job abbreviation (must be in VALID_JOBS)
        tier: Tier name (must be in VALID_TIERS)

    Raises:
        HTTPException: 400 if job/tier invalid, 404 if not found, 502 on fetch error
    """
    # Validate job and tier against whitelist to prevent path traversal
    job_lower = job.lower()
    tier_lower = tier.lower()

    if job_lower not in VALID_JOBS:
        logger.warning("invalid_bis_job", job=job)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid job abbreviation: {job.upper()}. Valid jobs: {', '.join(sorted(j.upper() for j in VALID_JOBS))}"
        )

    if tier_lower not in VALID_TIERS:
        logger.warning("invalid_bis_tier", tier=tier)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier: {tier}. Valid tiers: {', '.join(sorted(VALID_TIERS))}"
        )

    url = f"https://raw.githubusercontent.com/xiv-gear-planner/static-bis-sets/main/{job_lower}/{tier_lower}.json"

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(url, timeout=15.0)
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach GitHub: {e}")

    # Reject redirects to prevent SSRF
    if 300 <= response.status_code < 400:
        logger.warning("github_unexpected_redirect", url=url, status=response.status_code)
        raise HTTPException(status_code=502, detail="External service returned unexpected redirect")

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"BiS set not found for {job.upper()}/{tier}. Check job abbreviation and tier name."
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"GitHub error: {response.status_code}")

    try:
        return response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid BiS data from GitHub")


async def fetch_bis_from_shortlink(uuid: str) -> dict:
    """Fetch gear set from XIVGear shortlink API."""
    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                f"https://api.xivgear.app/shortlink/{uuid}",
                timeout=15.0
            )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="XIVGear API timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach XIVGear: {e}")

    # Reject redirects to prevent SSRF
    if 300 <= response.status_code < 400:
        logger.warning("xivgear_unexpected_redirect", uuid=uuid, status=response.status_code)
        raise HTTPException(status_code=502, detail="External service returned unexpected redirect")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Gear set not found")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"XIVGear API error: {response.status_code}")

    try:
        return response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid response from XIVGear")


def extract_etro_uuid(url_or_uuid: str) -> str:
    """
    Extract UUID from Etro URL or return UUID directly.

    Accepts:
    - UUID: 464585cc-099f-4438-b442-6d15723db90f
    - URL: https://etro.gg/gearset/464585cc-099f-4438-b442-6d15723db90f
    """
    # Already a UUID (with dashes)
    uuid_pattern = r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    if re.match(uuid_pattern, url_or_uuid, re.IGNORECASE):
        return url_or_uuid

    # URL format: https://etro.gg/gearset/{uuid}
    etro_match = re.search(r'etro\.gg/gearset/([a-f0-9-]+)', url_or_uuid, re.IGNORECASE)
    if etro_match:
        return etro_match.group(1)

    # Try to extract any UUID-like string
    any_uuid = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', url_or_uuid, re.IGNORECASE)
    if any_uuid:
        return any_uuid.group(1)

    raise ValueError(f"Could not extract UUID from Etro link: {url_or_uuid}")


async def fetch_bis_from_etro(uuid: str) -> dict:
    """Fetch gearset from Etro.gg API."""
    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(
                f"https://etro.gg/api/gearsets/{uuid}/",
                timeout=15.0
            )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Etro API timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach Etro: {e}")

    # Reject redirects to prevent SSRF
    if 300 <= response.status_code < 400:
        logger.warning("etro_unexpected_redirect", uuid=uuid, status=response.status_code)
        raise HTTPException(status_code=502, detail="External service returned unexpected redirect")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Gearset not found on Etro")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Etro API error: {response.status_code}")

    try:
        return response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid response from Etro")


@router.get("/presets/{job}", response_model=BiSPresetsResponse)
@limiter.limit(RATE_LIMITS["external_api"])
async def get_bis_presets(request: Request, job: str, category: Optional[str] = None):
    """
    Get available BiS presets for a job.

    Returns a list of curated BiS sets from The Balance.
    Checks local cache first (for jobs not in static-bis-sets repo),
    then falls back to GitHub (xiv-gear-planner/static-bis-sets).

    Local presets include uuid and setIndex for direct XIVGear import.
    GitHub presets use index for bis|{job}|current format.

    Args:
        job: Job abbreviation (e.g., "DRG", "WHM")
        category: Optional filter - 'savage', 'ultimate', or 'prog'
    """
    job_lower = job.lower()
    job_upper = job.upper()

    # Check local presets first
    local_data = load_local_presets()
    if job_lower in local_data:
        local_job_data = local_data[job_lower]
        local_presets_data = local_job_data.get("presets", [])
        if local_presets_data:
            presets: list[BiSPreset] = []
            for i, bis_set in enumerate(local_presets_data):
                # Apply category filter if specified
                preset_category = bis_set.get("category", "savage")
                if category and preset_category != category:
                    continue

                presets.append(BiSPreset(
                    name=bis_set.get("displayName", bis_set.get("originalName", f"Set {i + 1}")),
                    index=i,
                    uuid=bis_set.get("uuid"),
                    setIndex=bis_set.get("setIndex"),
                    githubIndex=bis_set.get("githubIndex"),
                    githubTier=bis_set.get("githubTier"),
                    description=bis_set.get("originalName"),  # Show original name as description
                    category=preset_category,
                    gcd=bis_set.get("gcd"),
                ))
            if presets:
                return BiSPresetsResponse(job=job_upper, presets=presets)

    # Fall back to GitHub (xiv-gear-planner/static-bis-sets)
    try:
        data = await fetch_bis_from_github(job_lower, "current")
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"No BiS presets found for job '{job_upper}'. Check the job abbreviation."
            )
        raise

    # Extract set names from the sets array
    presets: list[BiSPreset] = []
    sets = data.get("sets", [])

    for i, bis_set in enumerate(sets):
        # Skip separator entries
        if bis_set.get("isSeparator"):
            continue
        name = bis_set.get("name", f"Set {i + 1}")
        # GitHub presets are assumed to be savage (current tier)
        if category and category != "savage":
            continue
        # Use original array index (i) since fetch_xivgear_bis now uses original indices
        presets.append(BiSPreset(name=name, index=i, category="savage"))

    if not presets:
        raise HTTPException(
            status_code=404,
            detail=f"No BiS sets found for {job_upper}"
        )

    return BiSPresetsResponse(job=job_upper, presets=presets)


@router.get("/xivgear/{uuid_or_url:path}", response_model=BiSImportResponse)
@limiter.limit(RATE_LIMITS["external_api"])
async def fetch_xivgear_bis(request: Request, uuid_or_url: str, set_index: int = 0):
    """
    Fetch and parse a BiS set from XIVGear.app

    Accepts:
    - UUID: cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf
    - Share URL: https://xivgear.app/share/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf
    - Page URL: https://xivgear.app/?page=sl|cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf
    - Curated BiS: https://xivgear.app/?page=bis|drg|current (The Balance BiS)
    """
    try:
        identifier, path_type = extract_bis_path(uuid_or_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch data based on path type
    if path_type == "bis":
        # Curated BiS from GitHub (e.g., "drg/current")
        job_abbrev, tier = identifier.split("/")
        data = await fetch_bis_from_github(job_abbrev, tier)
        # GitHub format has items at root level and job field
        set_name = f"{job_abbrev.upper()} {tier.title()} BiS"
    else:
        # UUID shortlink
        data = await fetch_bis_from_shortlink(identifier)
        set_name = "Imported Set"

    # Extract set name and job from data (may override defaults)
    if "name" in data:
        set_name = data["name"]
    job = data.get("job", "Unknown")

    # Handle different data structures
    items_data = {}
    if "sets" in data and data["sets"]:
        # Multiple sets available - use set_index to select which one
        sets = data["sets"]

        # set_index is the ORIGINAL array index (from githubIndex in local presets)
        # We need to handle two cases:
        # 1. Original index mode: set_index points directly to a set in the original array
        # 2. If that's a separator or out of range, fall back to first non-separator

        selected_set = None
        if set_index < len(sets) and not sets[set_index].get("isSeparator"):
            # Direct access by original index
            selected_set = sets[set_index]
        else:
            # Fallback: find first non-separator set
            for s in sets:
                if not s.get("isSeparator"):
                    selected_set = s
                    break

        if selected_set:
            items_data = selected_set.get("items", {})
            if selected_set.get("name"):
                set_name = selected_set["name"]
    elif "items" in data:
        # Single-set format: items at root
        items_data = data["items"]

    if not items_data:
        raise HTTPException(status_code=400, detail="No gear items found in set")

    # Build slot data with item lookups
    slots: list[GearSlotData] = []

    for xivgear_slot, our_slot in XIVGEAR_SLOT_MAP.items():
        item_data = items_data.get(xivgear_slot)

        if item_data and "id" in item_data:
            item_id = item_data["id"]
            # Fetch item details from Garland Tools
            item_info = await fetch_item_from_garland(item_id)

            source = determine_source(item_info["name"], item_info["level"], our_slot)

            # Extract materia from item data
            # XIVGear stores materia as array of objects: [{"id": 33942}, {"id": 33942}]
            raw_materia = item_data.get("materia", [])
            materia_list: list[MateriaSlot] = []
            if raw_materia:
                # Extract IDs from materia objects, filtering out empty slots (id=-1)
                materia_ids = [
                    m.get("id") if isinstance(m, dict) else m
                    for m in raw_materia
                ]
                materia_ids = [mid for mid in materia_ids if mid and mid > 0]

                if materia_ids:
                    # Fetch materia details in parallel
                    materia_results = await asyncio.gather(
                        *[fetch_materia_from_garland(mid) for mid in materia_ids],
                        return_exceptions=True
                    )
                    for result in materia_results:
                        if isinstance(result, MateriaSlot):
                            materia_list.append(result)

            slots.append(GearSlotData(
                slot=our_slot,
                source=source,
                itemId=item_id,
                itemName=item_info["name"],
                itemLevel=item_info["level"],
                itemIcon=item_info.get("icon"),
                itemStats=item_info.get("stats") or None,
                materia=materia_list,
            ))
        else:
            # No item in this slot - default to raid
            slots.append(GearSlotData(
                slot=our_slot,
                source="raid",
            ))

    return BiSImportResponse(
        name=set_name,
        job=job,
        slots=slots,
    )


@router.get("/etro/{uuid_or_url:path}", response_model=BiSImportResponse)
@limiter.limit(RATE_LIMITS["external_api"])
async def fetch_etro_bis(request: Request, uuid_or_url: str):
    """
    Fetch and parse a BiS set from Etro.gg

    Accepts:
    - UUID: 464585cc-099f-4438-b442-6d15723db90f
    - URL: https://etro.gg/gearset/464585cc-099f-4438-b442-6d15723db90f
    """
    try:
        uuid = extract_etro_uuid(uuid_or_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = await fetch_bis_from_etro(uuid)

    # Extract set name and job
    set_name = data.get("name", "Etro Import")
    job = data.get("jobAbbrev", "Unknown")

    # Build slot data using existing Garland Tools lookups
    slots: list[GearSlotData] = []

    # Etro stores materia in a separate object keyed by item ID
    # Format: {"46457": {"1": 41772, "2": 41772}, ...}
    etro_materia = data.get("materia", {})

    for etro_slot, our_slot in ETRO_SLOT_MAP.items():
        item_id = data.get(etro_slot)

        if item_id:
            # Fetch item details from Garland Tools
            item_info = await fetch_item_from_garland(item_id)

            source = determine_source(item_info["name"], item_info["level"], our_slot)

            # Extract materia from Etro response
            # Materia is stored in a separate object keyed by item ID
            # For rings, Etro uses "46083L" and "46083R" suffixes
            materia_list: list[MateriaSlot] = []
            item_id_str = str(item_id)

            # Check for ring suffixes (Etro uses L/R for left/right rings)
            if our_slot == "ring1":
                materia_key = f"{item_id_str}L"
            elif our_slot == "ring2":
                materia_key = f"{item_id_str}R"
            else:
                materia_key = item_id_str

            item_materia = etro_materia.get(materia_key, {})
            if not item_materia and our_slot in ("ring1", "ring2"):
                # Fallback to plain item ID if suffix not found
                item_materia = etro_materia.get(item_id_str, {})

            if item_materia:
                # Extract materia IDs using explicit slot ordering (Etro uses 1-indexed keys)
                # Use range(1, 6) for consistent ordering instead of .values() which depends on insertion order
                materia_ids: list[int] = []
                for i in range(1, 6):
                    mid = item_materia.get(str(i))
                    if mid and isinstance(mid, int) and mid > 0:
                        materia_ids.append(mid)

                if materia_ids:
                    # Fetch materia details in parallel
                    materia_results = await asyncio.gather(
                        *[fetch_materia_from_garland(mid) for mid in materia_ids],
                        return_exceptions=True
                    )
                    for result in materia_results:
                        if isinstance(result, MateriaSlot):
                            materia_list.append(result)

            slots.append(GearSlotData(
                slot=our_slot,
                source=source,
                itemId=item_id,
                itemName=item_info["name"],
                itemLevel=item_info["level"],
                itemIcon=item_info.get("icon"),
                itemStats=item_info.get("stats") or None,
                materia=materia_list,
            ))
        else:
            # No item in this slot - default to raid
            slots.append(GearSlotData(
                slot=our_slot,
                source="raid",
            ))

    return BiSImportResponse(
        name=set_name,
        job=job,
        slots=slots,
    )
