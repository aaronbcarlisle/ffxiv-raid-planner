#!/usr/bin/env python3
"""
One-time migration script to populate materia data for existing BiS imports.

This script:
1. Finds all players with a bisLink (XIVGear or Etro)
2. Re-fetches their BiS data to get materia information
3. Merges materia into existing gear data (preserving hasItem/isAugmented)
4. Updates the database

Usage:
    cd backend
    python scripts/migrate_materia.py

Environment:
    Requires DATABASE_URL to be set (or uses default from .env)

Safety:
    - Idempotent: safe to run multiple times
    - Non-destructive: only adds materia, doesn't change other gear fields
    - Rate limited: 0.5s delay between external API calls
"""

import asyncio
import re
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
    ETRO_SLOT_MAP,
    XIVGEAR_SLOT_MAP,
    MateriaSlot,
    extract_bis_path,
    extract_etro_uuid,
    fetch_bis_from_etro,
    fetch_bis_from_shortlink,
    fetch_materia_from_garland,
)
from app.logging_config import get_logger

logger = get_logger(__name__)

# Rate limit delay between API calls (seconds)
API_DELAY = 0.5


def parse_bis_link(bis_link: str) -> tuple[str, str] | None:
    """
    Parse a BiS link to determine source and identifier.

    Returns:
        Tuple of (source, identifier) where source is 'xivgear', 'etro', or 'curated'
        None if link format is not recognized

    Note: Curated presets (bis|job|tier) don't have materia data - they use
    static GitHub JSON which doesn't include user melds.
    """
    if not bis_link:
        return None

    bis_link = bis_link.strip()

    # Internal preset formats (stored by BiS import)
    # sl|{uuid} - Shortlink presets
    if bis_link.startswith("sl|"):
        uuid = bis_link[3:]  # Remove "sl|" prefix
        return ("xivgear", uuid)

    # bis|{job}|{tier}|{index} - Curated presets (no materia available)
    if bis_link.startswith("bis|"):
        # Curated presets use static GitHub JSON without user materia melds
        # Return "curated" so caller can skip gracefully
        return ("curated", bis_link)

    # XIVGear URL patterns
    if "xivgear.app" in bis_link:
        try:
            identifier, path_type = extract_bis_path(bis_link)
            if path_type == "bis":
                # Curated BiS URL (e.g., ?page=bis|drg|current) - no materia
                return ("curated", identifier)
            # Shortlink URL - has materia
            return ("xivgear", identifier)
        except ValueError:
            return None

    # Etro patterns
    if "etro.gg" in bis_link:
        try:
            uuid = extract_etro_uuid(bis_link)
            return ("etro", uuid)
        except ValueError:
            return None

    # Try as raw UUID (assume XIVGear shortlink)
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    if re.match(uuid_pattern, bis_link, re.IGNORECASE):
        return ("xivgear", bis_link)

    return None


async def fetch_materia_for_xivgear(identifier: str) -> dict[str, list[dict]]:
    """
    Fetch materia data from XIVGear.

    Returns:
        Dict mapping slot names to materia lists
    """
    data = await fetch_bis_from_shortlink(identifier)

    # Handle different data structures
    items_data = {}
    if "sets" in data and data["sets"]:
        sets = data["sets"]
        actual_sets = [s for s in sets if not s.get("isSeparator")]
        if actual_sets:
            items_data = actual_sets[0].get("items", {})
    elif "items" in data:
        items_data = data["items"]

    if not items_data:
        return {}

    # Extract materia for each slot
    slot_materia: dict[str, list[dict]] = {}

    for xivgear_slot, our_slot in XIVGEAR_SLOT_MAP.items():
        item_data = items_data.get(xivgear_slot)
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
            # Fetch materia details
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


async def fetch_materia_for_etro(uuid: str) -> dict[str, list[dict]]:
    """
    Fetch materia data from Etro.

    Returns:
        Dict mapping slot names to materia lists
    """
    data = await fetch_bis_from_etro(uuid)

    etro_materia = data.get("materia", {})
    if not etro_materia:
        return {}

    slot_materia: dict[str, list[dict]] = {}

    for etro_slot, our_slot in ETRO_SLOT_MAP.items():
        item_id = data.get(etro_slot)
        if not item_id:
            continue

        # Handle ring slots - Etro uses item ID as key, with L/R suffix for rings
        materia_key = str(item_id)
        if our_slot == "ring1":
            materia_key = f"{item_id}L"
        elif our_slot == "ring2":
            materia_key = f"{item_id}R"

        slot_materia_data = etro_materia.get(materia_key, {})
        if not slot_materia_data:
            # Try without suffix for non-ring slots
            slot_materia_data = etro_materia.get(str(item_id), {})

        if not slot_materia_data:
            continue

        # Extract materia IDs from slot data
        materia_ids = [
            slot_materia_data.get(str(i))
            for i in range(1, 6)  # Etro uses 1-indexed slots
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


async def migrate_player(session: AsyncSession, player: SnapshotPlayer) -> bool:
    """
    Migrate a single player's gear to include materia.

    Returns:
        True if updated, False if skipped/failed
    """
    if not player.bis_link:
        return False

    parsed = parse_bis_link(player.bis_link)
    if not parsed:
        logger.warning(f"Could not parse bisLink for player {player.id}: {player.bis_link}")
        return False

    source, identifier = parsed

    # Curated presets don't have materia - they use static GitHub JSON
    if source == "curated":
        logger.info(f"Skipping curated preset for player {player.id} ({player.name}) - no materia available")
        return False

    try:
        if source == "xivgear":
            slot_materia = await fetch_materia_for_xivgear(identifier)
        elif source == "etro":
            slot_materia = await fetch_materia_for_etro(identifier)
        else:
            logger.warning(f"Unknown source '{source}' for player {player.id}")
            return False
    except (httpx.HTTPError, httpx.TimeoutException, ValueError, KeyError) as e:
        logger.error(f"Failed to fetch materia for player {player.id}: {e}")
        return False

    if not slot_materia:
        logger.info(f"No materia found for player {player.id} ({player.name})")
        return False

    # Update gear with materia
    gear = player.gear or []
    updated = False

    for gear_item in gear:
        slot = gear_item.get("slot")
        if slot in slot_materia:
            existing_materia = gear_item.get("materia", [])
            if not existing_materia:  # Only add if no materia exists
                gear_item["materia"] = slot_materia[slot]
                updated = True

    if updated:
        # Update the player record
        await session.execute(
            update(SnapshotPlayer)
            .where(SnapshotPlayer.id == player.id)
            .values(
                gear=gear,
                updated_at=datetime.now(timezone.utc).isoformat()
            )
        )
        logger.info(f"Updated materia for player {player.id} ({player.name})")

    return updated


async def run_migration():
    """Run the materia migration for all players with BiS links."""
    print("=" * 60)
    print("Materia Migration Script")
    print("=" * 60)
    print()

    async with async_session_maker() as session:
        # Find all players with bisLink
        result = await session.execute(
            select(SnapshotPlayer)
            .where(SnapshotPlayer.bis_link.isnot(None))
            .where(SnapshotPlayer.bis_link != "")
        )
        players = result.scalars().all()

        print(f"Found {len(players)} players with BiS links")
        print()

        if not players:
            print("No players to migrate.")
            return

        updated_count = 0
        skipped_count = 0
        error_count = 0

        for i, player in enumerate(players, 1):
            print(f"[{i}/{len(players)}] Processing: {player.name} ({player.job})")

            try:
                was_updated = await migrate_player(session, player)
                if was_updated:
                    updated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                logger.error(f"Error migrating player {player.id}: {e}")
                error_count += 1

            # Rate limit to avoid overwhelming external APIs
            if i < len(players):
                await asyncio.sleep(API_DELAY)

        # Commit all changes
        await session.commit()

        print()
        print("=" * 60)
        print("Migration Complete")
        print("=" * 60)
        print(f"  Updated: {updated_count}")
        print(f"  Skipped: {skipped_count}")
        print(f"  Errors:  {error_count}")
        print()


if __name__ == "__main__":
    asyncio.run(run_migration())
