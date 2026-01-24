#!/usr/bin/env python3
"""
Migration script to fix bisLink setIndex and materia for multi-set shortlinks.

This script:
1. Finds all players with sl|uuid format (no setIndex) whose XIVGear links have multiple sets
2. Compares stored gear with each set to find which one matches
3. Updates the bisLink to include the correct setIndex (sl|uuid|N)
4. Re-fetches materia from the correct set and updates the gear

Usage:
    cd backend
    python scripts/migrate_bis_setindex.py

Environment:
    Requires DATABASE_URL to be set (or uses default from .env)

Safety:
    - Idempotent: safe to run multiple times
    - Only updates players where we can confidently match the set
    - Rate limited: 0.5s delay between external API calls
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.snapshot_player import SnapshotPlayer
from app.routers.bis import (
    XIVGEAR_SLOT_MAP,
    MateriaSlot,
    fetch_materia_from_garland,
)
from app.logging_config import get_logger

logger = get_logger(__name__)

# Rate limit delay between API calls (seconds)
API_DELAY = 0.5
# Shorter delay for Garland Tools calls within a single player's processing
GARLAND_API_DELAY = 0.1
# Minimum number of matching items required to confidently identify a set
MIN_MATCH_CONFIDENCE = 3


async def fetch_shortlink_data(uuid: str) -> dict | None:
    """Fetch data from XIVGear shortlink API."""
    url = f"https://api.xivgear.app/shortlink/{uuid}"

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(url, timeout=15.0)
        except (httpx.TimeoutException, httpx.RequestError) as e:
            logger.error(f"Failed to fetch shortlink {uuid}: {e}")
            return None

    # Reject redirects to prevent SSRF
    if 300 <= response.status_code < 400:
        logger.warning(f"Redirect response when fetching shortlink {uuid}: status {response.status_code}")
        return None

    if response.status_code != 200:
        logger.warning(f"Shortlink not found: {uuid} (status {response.status_code})")
        return None

    try:
        return response.json()
    except Exception:
        logger.error(f"Invalid JSON from shortlink: {uuid}")
        return None


def get_sets_from_data(data: dict) -> list[tuple[int, str, dict]]:
    """
    Extract sets from XIVGear data.

    Returns:
        List of (index, name, items_dict) tuples
    """
    sets = []

    if "sets" in data and data["sets"]:
        raw_sets = data["sets"]
        actual_index = 0
        for s in raw_sets:
            if s.get("isSeparator"):
                continue
            name = s.get("name", f"Set {actual_index}")
            items = s.get("items", {})
            sets.append((actual_index, name, items))
            actual_index += 1
    elif "items" in data:
        # Single set
        sets.append((0, data.get("name", "Default"), data["items"]))

    return sets


async def fetch_item_name(item_id: int) -> str | None:
    """Fetch item name from Garland Tools."""
    url = f"https://www.garlandtools.org/db/doc/item/en/3/{item_id}.json"

    async with httpx.AsyncClient(follow_redirects=False) as client:
        try:
            response = await client.get(url, timeout=10.0)
            # Reject redirects to prevent SSRF
            if 300 <= response.status_code < 400:
                logger.warning(f"Redirect response when fetching item {item_id}")
                return None
            if response.status_code == 200:
                data = response.json()
                return data.get("item", {}).get("name")
        except Exception as e:
            logger.debug(f"Failed to fetch item name for {item_id}: {e}")
    return None


async def find_matching_set(player_gear: list[dict], sets: list[tuple[int, str, dict]]) -> int | None:
    """
    Find which set matches the player's stored gear.

    Returns:
        Set index if found, None if no confident match
    """
    if len(sets) <= 1:
        return 0 if sets else None

    # Build a map of slot -> item name from player gear
    player_items = {}
    for gear_item in player_gear:
        slot = gear_item.get("slot")
        item_name = gear_item.get("itemName")
        if slot and item_name:
            player_items[slot] = item_name.lower()

    if not player_items:
        return None

    # Map XIVGear slots to our slots
    slot_map_reverse = {v: k for k, v in XIVGEAR_SLOT_MAP.items()}

    # For each set, fetch item names and compare
    best_match_index = None
    best_match_count = 0

    for set_index, set_name, set_items in sets:
        match_count = 0
        total_compared = 0

        for our_slot, player_item_name in player_items.items():
            xiv_slot = slot_map_reverse.get(our_slot)
            if not xiv_slot:
                continue

            set_item = set_items.get(xiv_slot, {})
            set_item_id = set_item.get("id") if isinstance(set_item, dict) else None

            if not set_item_id:
                continue

            # Fetch item name from Garland with rate limiting
            set_item_name = await fetch_item_name(set_item_id)
            await asyncio.sleep(GARLAND_API_DELAY)
            if not set_item_name:
                continue

            total_compared += 1

            if set_item_name.lower() == player_item_name:
                match_count += 1

        # Log comparison result
        logger.debug(f"  Set [{set_index}] '{set_name}': {match_count}/{total_compared} matches")

        if match_count > best_match_count:
            best_match_count = match_count
            best_match_index = set_index

    # Only return if we have a confident match
    if best_match_count >= MIN_MATCH_CONFIDENCE:
        return best_match_index

    return None


async def fetch_materia_for_set(set_items: dict) -> dict[str, list[dict]]:
    """
    Fetch materia data for a specific set.

    Returns:
        Dict mapping slot names to materia lists
    """
    slot_materia: dict[str, list[dict]] = {}

    for xivgear_slot, our_slot in XIVGEAR_SLOT_MAP.items():
        item_data = set_items.get(xivgear_slot)
        if not item_data:
            continue

        raw_materia = item_data.get("materia", [])
        if not raw_materia:
            continue

        # Extract IDs, filtering empty slots
        materia_ids = [
            m.get("id") if isinstance(m, dict) else m
            for m in raw_materia
        ]
        materia_ids = [mid for mid in materia_ids if mid and mid > 0]

        if materia_ids:
            materia_results = await asyncio.gather(
                *[fetch_materia_from_garland(mid) for mid in materia_ids],
                return_exceptions=True
            )
            materia_list = []
            for result in materia_results:
                if isinstance(result, MateriaSlot):
                    materia_list.append(result.model_dump())

            if materia_list:
                slot_materia[our_slot] = materia_list

    return slot_materia


async def migrate_player(session: AsyncSession, player: SnapshotPlayer) -> tuple[bool, str]:
    """
    Migrate a single player's bisLink and materia.

    Returns:
        Tuple of (was_updated, reason)
    """
    bis_link = player.bis_link
    if not bis_link or not bis_link.startswith("sl|"):
        return False, "not a shortlink"

    parts = bis_link.split("|")
    if len(parts) >= 3:
        return False, "already has setIndex"

    # Validate we have a UUID (protect against malformed 'sl|' entries)
    if len(parts) < 2 or not parts[1]:
        return False, "malformed shortlink (missing UUID)"

    uuid = parts[1]

    # Fetch XIVGear data
    data = await fetch_shortlink_data(uuid)
    if not data:
        return False, "failed to fetch shortlink"

    # Get sets
    sets = get_sets_from_data(data)
    if len(sets) <= 1:
        return False, "single set (no fix needed)"

    # Find matching set
    matching_index = await find_matching_set(player.gear or [], sets)
    if matching_index is None:
        return False, "could not determine matching set"

    # Get the matching set's items
    _, set_name, set_items = sets[matching_index]

    # Fetch materia for the correct set
    slot_materia = await fetch_materia_for_set(set_items)

    # Update gear with materia
    gear = player.gear or []
    materia_updated = False

    for gear_item in gear:
        slot = gear_item.get("slot")
        if slot in slot_materia:
            # Update materia (replace existing)
            gear_item["materia"] = slot_materia[slot]
            materia_updated = True

    # Build new bisLink with setIndex
    new_bis_link = f"sl|{uuid}|{matching_index}"

    # Update the player record
    await session.execute(
        update(SnapshotPlayer)
        .where(SnapshotPlayer.id == player.id)
        .values(
            bis_link=new_bis_link,
            gear=gear,
            updated_at=datetime.now(timezone.utc).isoformat()
        )
    )

    materia_str = " + materia" if materia_updated else ""
    return True, f"set [{matching_index}] '{set_name}'{materia_str}"


async def run_migration():
    """Run the bisLink setIndex migration."""
    print("=" * 70)
    print("BiS Link SetIndex Migration")
    print("=" * 70)
    print()

    async with async_session_maker() as session:
        # Find all players with sl| bisLinks that don't have setIndex
        result = await session.execute(
            select(SnapshotPlayer)
            .where(SnapshotPlayer.bis_link.like("sl|%"))
        )
        players = result.scalars().all()

        # Filter to only those without setIndex (2 parts only)
        players = [p for p in players if len(p.bis_link.split("|")) == 2]

        print(f"Found {len(players)} players with sl|uuid format (no setIndex)")
        print()

        if not players:
            print("No players to migrate.")
            return

        updated_count = 0
        skipped_count = 0
        error_count = 0
        batch_size = 10  # Commit every N players for resilience

        for i, player in enumerate(players, 1):
            print(f"[{i}/{len(players)}] {player.name} ({player.job})")

            try:
                was_updated, reason = await migrate_player(session, player)
                if was_updated:
                    print(f"    -> Updated: {reason}")
                    updated_count += 1
                else:
                    print(f"    -> Skipped: {reason}")
                    skipped_count += 1
            except Exception as e:
                logger.error(f"Error migrating player {player.id}: {e}")
                print(f"    -> Error: {e}")
                error_count += 1

            # Commit in batches for resilience (script is idempotent, safe to re-run)
            if i % batch_size == 0:
                await session.commit()
                print(f"    [Committed batch {i // batch_size}]")

            # Rate limit
            if i < len(players):
                await asyncio.sleep(API_DELAY)

        # Commit any remaining changes
        await session.commit()

        print()
        print("=" * 70)
        print("Migration Complete")
        print("=" * 70)
        print(f"  Updated: {updated_count}")
        print(f"  Skipped: {skipped_count}")
        print(f"  Errors:  {error_count}")
        print()


if __name__ == "__main__":
    asyncio.run(run_migration())
