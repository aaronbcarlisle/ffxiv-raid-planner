#!/usr/bin/env python3
"""
Backfill GCD data for presets that are missing it.
Fetches gear from XIVGear, stats from XIVAPI, and calculates GCD.
"""

import json
import asyncio
import httpx
import re
from pathlib import Path

PRESETS_FILE = Path("/home/serapis/projects/ffxiv-raid-planner/backend/app/data/local_bis_presets.json")

# Level 100 stat calculations
LEVEL_MOD = 420
LEVEL_DIV = 2780
BASE_GCD = 2500  # milliseconds

# Jobs that use Spell Speed vs Skill Speed
SPELL_SPEED_JOBS = {'WHM', 'SCH', 'AST', 'SGE', 'BLM', 'SMN', 'RDM', 'PCT'}
# All others use Skill Speed

# Cache for XIVAPI item lookups
item_cache: dict[int, dict] = {}

def calculate_gcd(speed: int) -> str:
    """Calculate GCD from speed stat (SkS or SpS)."""
    # GCD formula: floor(floor(2500 * (1000 - floor(130 * (speed - 420) / 2780)) / 1000) * 100) / 100
    # Simplified: GCD = 2.5 * (1 - 0.130 * (speed - 420) / 2780)

    speed_mod = 130 * (speed - LEVEL_MOD) // LEVEL_DIV
    gcd_ms = (BASE_GCD * (1000 - speed_mod)) // 1000
    gcd_sec = gcd_ms / 1000

    # Round to 2 decimal places
    return f"{gcd_sec:.2f}"

async def fetch_item_stats(client: httpx.AsyncClient, item_id: int) -> dict:
    """Fetch item stats from XIVAPI beta."""
    if item_id in item_cache:
        return item_cache[item_id]

    try:
        resp = await client.get(
            f"https://beta.xivapi.com/api/1/sheet/Item/{item_id}",
            timeout=10.0
        )
        if resp.status_code == 200:
            data = resp.json()
            fields = data.get('fields', {})

            # Extract base stats
            stats = {}
            base_params = fields.get('BaseParam', [])
            base_values = fields.get('BaseParamValue', [])

            for i, param in enumerate(base_params):
                if param and isinstance(param, dict):
                    param_fields = param.get('fields', {})
                    stat_name = param_fields.get('Name', '')
                    if stat_name and i < len(base_values):
                        stats[stat_name] = base_values[i]

            item_cache[item_id] = stats
            return stats
    except Exception as e:
        print(f"  Error fetching item {item_id}: {e}")

    return {}

async def fetch_xivgear_set(client: httpx.AsyncClient, uuid: str, set_index: int = 0) -> dict | None:
    """Fetch gear set from XIVGear shortlink."""
    try:
        resp = await client.get(
            f"https://api.xivgear.app/shortlink/{uuid}",
            timeout=15.0
        )
        if resp.status_code != 200:
            return None

        data = resp.json()

        # Check for single-set format (items at root level)
        if 'items' in data and data.get('items'):
            return {'items': data['items'], 'name': data.get('name', '')}

        # Multi-set format
        sets = data.get('sets', [])
        actual_sets = [s for s in sets if not s.get('isSeparator')]

        if set_index < len(actual_sets):
            return actual_sets[set_index]
        elif actual_sets:
            return actual_sets[0]
    except Exception as e:
        print(f"  Error fetching XIVGear {uuid}: {e}")

    return None

async def fetch_github_set(client: httpx.AsyncClient, job: str, tier: str, set_index: int = 0) -> dict | None:
    """Fetch gear set from GitHub static-bis-sets."""
    try:
        url = f"https://raw.githubusercontent.com/xiv-gear-planner/static-bis-sets/main/{job}/{tier}.json"
        resp = await client.get(url, timeout=15.0)
        if resp.status_code != 200:
            return None

        data = resp.json()
        sets = data.get('sets', [])
        actual_sets = [s for s in sets if not s.get('isSeparator')]

        if set_index < len(actual_sets):
            return actual_sets[set_index]
        elif actual_sets:
            return actual_sets[0]
    except Exception as e:
        print(f"  Error fetching GitHub {job}/{tier}: {e}")

    return None

async def calculate_set_gcd(client: httpx.AsyncClient, gear_set: dict, job: str) -> str | None:
    """Calculate GCD for a gear set by fetching item stats."""
    items = gear_set.get('items', {})
    if not items:
        return None

    # Determine which speed stat to use
    speed_stat = 'Spell Speed' if job.upper() in SPELL_SPEED_JOBS else 'Skill Speed'

    total_speed = 0

    # Fetch stats for all items
    for slot_name, item_data in items.items():
        if not item_data or not isinstance(item_data, dict):
            continue

        item_id = item_data.get('id')
        if not item_id:
            continue

        stats = await fetch_item_stats(client, item_id)
        if speed_stat in stats:
            total_speed += stats[speed_stat]

    # Add base speed (420 at level 100)
    # If no speed on gear, total_speed will be 0, resulting in base 2.50 GCD
    total_speed += LEVEL_MOD

    return calculate_gcd(total_speed)

async def backfill_preset_gcd(client: httpx.AsyncClient, job: str, preset: dict) -> str | None:
    """Try to backfill GCD for a single preset."""
    uuid = preset.get('uuid')
    github_tier = preset.get('githubTier')
    github_index = preset.get('githubIndex', 0)
    set_index = preset.get('setIndex', 0)

    gear_set = None

    if uuid:
        gear_set = await fetch_xivgear_set(client, uuid, set_index)
    elif github_tier:
        gear_set = await fetch_github_set(client, job.lower(), github_tier, github_index)

    if not gear_set:
        return None

    return await calculate_set_gcd(client, gear_set, job)

def normalize_name_with_gcd(preset: dict, gcd: str) -> str:
    """Generate normalized display name with GCD."""
    category = preset.get('category', 'savage')
    original_name = preset.get('originalName', '')
    github_tier = preset.get('githubTier', '')

    # Extract unique descriptor
    # Remove common words and any existing GCD mention
    descriptor = original_name
    for word in ['bis', 'best-in-slot', 'best in slot', 'savage', 'current', 'set']:
        descriptor = re.sub(rf'(?i)\b{word}\b[:\-,\s]*', ' ', descriptor)

    # Remove GCD patterns
    descriptor = re.sub(r'\b\d\.\d{2}\b[\s,\-]*', ' ', descriptor)
    descriptor = re.sub(r'\s+', ' ', descriptor).strip()
    descriptor = re.sub(r'^[\-:,\s]+|[\-:,\s]+$', '', descriptor)

    # Build name
    if category == 'ultimate':
        ultimate_names = {'fru': 'FRU', 'top': 'TOP', 'dsr': 'DSR', 'tea': 'TEA', 'ucob': 'UCoB', 'uwu': 'UWU'}
        ult_name = ultimate_names.get(github_tier, github_tier.upper() if github_tier else 'Ultimate')
        base = f"{gcd} {ult_name} BiS"
    else:
        base = f"{gcd} Savage BiS"

    if descriptor and descriptor.lower() not in ['', 'true', 'no', ':']:
        return f"{base} ({descriptor})"
    return base

async def main():
    with open(PRESETS_FILE, 'r') as f:
        data = json.load(f)

    updates = []

    async with httpx.AsyncClient() as client:
        for job_key, job_data in data.items():
            if job_key == '_meta':
                continue

            presets = job_data.get('presets', [])
            job_updates = 0

            for preset in presets:
                # Skip if already has GCD
                if preset.get('gcd'):
                    continue

                # Only backfill Savage presets for now (faster)
                if preset.get('category') != 'savage':
                    continue

                print(f"Fetching GCD for {job_key.upper()}: {preset.get('displayName')}")

                gcd = await backfill_preset_gcd(client, job_key, preset)

                if gcd:
                    preset['gcd'] = gcd
                    new_name = normalize_name_with_gcd(preset, gcd)
                    old_name = preset.get('displayName', '')
                    preset['displayName'] = new_name
                    updates.append((job_key.upper(), old_name, new_name, gcd))
                    job_updates += 1
                    print(f"  -> {gcd} GCD")
                else:
                    print(f"  -> Could not determine GCD")

                # Small delay to avoid rate limiting
                await asyncio.sleep(0.1)

            if job_updates:
                print(f"{job_key.upper()}: Updated {job_updates} presets")

    # Save
    with open(PRESETS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n=== Summary ===")
    print(f"Updated {len(updates)} presets with GCD")

    if updates:
        print("\nSample updates:")
        for job, old, new, gcd in updates[:10]:
            print(f"  {job}: '{old}' -> '{new}'")

if __name__ == '__main__':
    asyncio.run(main())
