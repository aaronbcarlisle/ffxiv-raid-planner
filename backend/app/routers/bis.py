"""BiS Import Router - Fetches gear sets from external tools"""

import re
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/bis", tags=["bis"])

# Cache for XIVAPI item lookups (in-memory, simple)
_item_cache: dict[int, dict] = {}


class GearSlotData(BaseModel):
    """Data for a single gear slot from BiS import"""
    slot: str
    source: str  # 'raid' or 'tome'
    itemId: Optional[int] = None
    itemName: Optional[str] = None
    itemLevel: Optional[int] = None


class BiSImportResponse(BaseModel):
    """Response from BiS import endpoint"""
    name: str
    job: str
    slots: list[GearSlotData]


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


def extract_bis_path(url_or_uuid: str) -> tuple[str, str | None]:
    """
    Extract identifier from various XIVGear URL formats.

    Returns:
        tuple of (identifier, type) where type is:
        - None for UUID/shortlink
        - "bis" for curated BiS path (e.g., "drg/current")
    """
    # Check for curated BiS format: bis|job|tier or bis/job/tier
    bis_match = re.search(r'(?:page=)?bis[|%7C/](\w+)[|%7C/](\w+)', url_or_uuid, re.IGNORECASE)
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

    # URL format: https://xivgear.app/?page=sl|{uuid}
    page_match = re.search(r'page=sl[|%7C]([a-f0-9-]+)', url_or_uuid, re.IGNORECASE)
    if page_match:
        return page_match.group(1), None

    # Try to extract any UUID-like string
    any_uuid = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', url_or_uuid, re.IGNORECASE)
    if any_uuid:
        return any_uuid.group(1), None

    raise ValueError(f"Could not extract UUID or BiS path from: {url_or_uuid}")


async def fetch_item_from_xivapi(item_id: int) -> dict:
    """Fetch item details from XIVAPI beta with caching"""
    if item_id in _item_cache:
        return _item_cache[item_id]

    async with httpx.AsyncClient() as client:
        try:
            # Use XIVAPI beta which has current patch data
            response = await client.get(
                f"https://beta.xivapi.com/api/1/sheet/Item/{item_id}",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                fields = data.get("fields", {})
                # Beta API has nested structure for LevelItem
                level_item = fields.get("LevelItem", {})
                level = level_item.get("value", 0) if isinstance(level_item, dict) else 0
                result = {
                    "id": item_id,
                    "name": fields.get("Name", "Unknown"),
                    "level": level,
                }
                _item_cache[item_id] = result
                return result
        except Exception:
            pass

    return {"id": item_id, "name": "Unknown", "level": 0}


def determine_source(item_name: str, item_level: int, slot: str) -> str:
    """
    Determine if item is raid or tome based on item name patterns.

    For current tier (7.2 - AAC Cruiserweight Savage):
    - Savage: 790 armor, 795 weapon (name: "Grand Champion's...")
    - Tome: 780 unaugmented, 790 augmented (name: "Aug. Bygone Brass...")

    Key insight: Only tome gear can be augmented in FFXIV, so "Aug." prefix = tome.
    """
    if not item_name or item_name == "Unknown":
        return "raid"  # Unknown, default to raid

    item_name_lower = item_name.lower()

    # DEFINITIVE CHECK: "Aug." prefix means augmented tome gear
    # Only tomestone gear can be augmented, so this is 100% reliable
    if item_name_lower.startswith("aug.") or item_name_lower.startswith("augmented"):
        return "tome"

    # Savage/raid gear patterns (check these first - they're more specific)
    raid_patterns = [
        "grand champion",  # 7.2 savage
        "archeo kingdom",  # 7.1 savage
        "ascension",       # 6.x savage
        "asphodelos",      # 6.0 savage
        "abyssos",         # 6.2 savage
        "anabaseios",      # 6.4 savage
        "diadochos",       # Other savage
    ]

    for pattern in raid_patterns:
        if pattern in item_name_lower:
            return "raid"

    # Tomestone gear patterns (base names without Aug. prefix)
    tome_patterns = [
        "bygone",        # 7.2 tome gear
        "quetzalli",     # 7.1 tome gear
        "credendum",     # 6.x tome gear
        "lunar envoy",   # 6.4 tome
        "rinascita",     # 6.2 tome
        "moonward",      # 6.0 tome
        "radiant",       # Other tome
    ]

    for pattern in tome_patterns:
        if pattern in item_name_lower:
            return "tome"

    # Fallback to item level heuristic (for older/unknown gear)
    if item_level <= 0:
        return "raid"

    # For weapon, higher threshold
    if slot == "weapon":
        return "raid" if item_level >= 795 else "tome"

    # For armor/accessories: in current tier, 790 could be either
    # Default to raid for high iLvl unknown items
    return "raid" if item_level >= 790 else "tome"


async def fetch_bis_from_github(job: str, tier: str) -> dict:
    """Fetch curated BiS data from the static-bis-sets GitHub repo."""
    url = f"https://raw.githubusercontent.com/xiv-gear-planner/static-bis-sets/main/{job}/{tier}.json"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=15.0)
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach GitHub: {e}")

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
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://api.xivgear.app/shortlink/{uuid}",
                timeout=15.0
            )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="XIVGear API timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach XIVGear: {e}")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Gear set not found")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"XIVGear API error: {response.status_code}")

    try:
        return response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid response from XIVGear")


@router.get("/xivgear/{uuid_or_url:path}", response_model=BiSImportResponse)
async def fetch_xivgear_bis(uuid_or_url: str):
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
        # Shortlink format: multiple sets, use first one
        first_set = data["sets"][0]
        items_data = first_set.get("items", {})
        if first_set.get("name"):
            set_name = first_set["name"]
    elif "items" in data:
        # GitHub format or single-set shortlink: items at root
        items_data = data["items"]

    if not items_data:
        raise HTTPException(status_code=400, detail="No gear items found in set")

    # Build slot data with item lookups
    slots: list[GearSlotData] = []

    for xivgear_slot, our_slot in XIVGEAR_SLOT_MAP.items():
        item_data = items_data.get(xivgear_slot)

        if item_data and "id" in item_data:
            item_id = item_data["id"]
            # Fetch item details from XIVAPI
            item_info = await fetch_item_from_xivapi(item_id)

            source = determine_source(item_info["name"], item_info["level"], our_slot)

            slots.append(GearSlotData(
                slot=our_slot,
                source=source,
                itemId=item_id,
                itemName=item_info["name"],
                itemLevel=item_info["level"],
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
