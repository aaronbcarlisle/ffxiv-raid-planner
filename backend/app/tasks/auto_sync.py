"""Background task for periodic Lodestone gear auto-sync.

Iterates statics with auto_sync_enabled, finds linked players due for a re-sync,
and refreshes their gear from the upstream provider. Runs in-process alongside the
web server — no separate worker needed.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import async_session_maker
from ..logging_config import get_logger
from ..models.snapshot_player import SnapshotPlayer
from ..models.static_group import StaticGroup
from ..models.tier_snapshot import TierSnapshot
from ..services.gear_sync import sync_player_gear_from_provider

logger = get_logger(__name__)

# How often the loop wakes up to check for due syncs (minutes).
POLL_INTERVAL_MINUTES = 15

# Delay between individual player syncs to respect upstream rate limits (~10/min).
INTER_PLAYER_DELAY_SECONDS = 3.0

# Maximum players to sync in a single poll cycle (safety cap).
MAX_PLAYERS_PER_CYCLE = 200


def _parse_settings(raw: Any) -> dict[str, Any]:
    """Safely parse the group settings JSON."""
    if isinstance(raw, dict):
        return raw
    return {}


def _is_due(last_sync: str | None, interval_hours: int) -> bool:
    """Return True if the player hasn't been synced within the interval."""
    if not last_sync:
        return True
    try:
        last_dt = datetime.fromisoformat(last_sync)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=interval_hours)
        return last_dt < cutoff
    except (ValueError, TypeError):
        return True


async def run_auto_sync_cycle() -> None:
    """Single pass: find all due players across all opted-in statics and sync them."""
    synced = 0
    skipped = 0
    failed = 0

    async with async_session_maker() as session:
        # Find all statics with auto_sync enabled.
        result = await session.execute(select(StaticGroup))
        all_groups = result.scalars().all()

        opted_in: list[tuple[StaticGroup, int]] = []
        for group in all_groups:
            settings = _parse_settings(group.settings)
            if settings.get("autoSyncEnabled"):
                interval = int(settings.get("autoSyncIntervalHours", 8))
                opted_in.append((group, interval))

        if not opted_in:
            return

        logger.info("auto_sync_cycle_start", groups=len(opted_in))

        for group, interval_hours in opted_in:
            # Find the active tier and its players with linked lodestone IDs.
            tier_result = await session.execute(
                select(TierSnapshot)
                .where(
                    TierSnapshot.static_group_id == group.id,
                    TierSnapshot.is_active.is_(True),
                )
                .options(selectinload(TierSnapshot.players))
                .limit(1)
            )
            tier = tier_result.scalar_one_or_none()
            if not tier:
                continue

            linked_players = [
                p for p in tier.players
                if p.lodestone_id and p.lodestone_id.strip()
            ]

            for player in linked_players:
                if synced >= MAX_PLAYERS_PER_CYCLE:
                    logger.warning(
                        "auto_sync_cycle_cap_reached",
                        cap=MAX_PLAYERS_PER_CYCLE,
                    )
                    break

                lodestone_id = int(player.lodestone_id)

                if not _is_due(player.last_sync, interval_hours):
                    skipped += 1
                    continue

                try:
                    await sync_player_gear_from_provider(
                        player,
                        lodestone_id,
                        source_prefix="auto_",
                    )
                    await session.flush()
                    synced += 1
                except Exception as exc:
                    logger.warning(
                        "auto_sync_player_failed",
                        player_id=player.id,
                        lodestone_id=lodestone_id,
                        error=str(exc),
                        group_id=group.id,
                    )
                    failed += 1
                    # Don't let one player failure break the whole batch.
                    await session.rollback()
                    # Re-fetch the session state after rollback.
                    async with async_session_maker() as session:
                        pass
                    break  # Move to the next group after rollback.

                # Rate-limit between players.
                await asyncio.sleep(INTER_PLAYER_DELAY_SECONDS)

        # Commit all successful syncs.
        try:
            await session.commit()
        except Exception as exc:
            logger.error("auto_sync_commit_failed", error=str(exc))
            await session.rollback()

    if synced or failed:
        logger.info(
            "auto_sync_cycle_complete",
            synced=synced,
            skipped=skipped,
            failed=failed,
        )


async def auto_sync_loop() -> None:
    """Run auto-sync on a repeating interval."""
    # Wait a bit after startup before the first cycle.
    await asyncio.sleep(60)

    while True:
        try:
            await run_auto_sync_cycle()
        except Exception as exc:
            logger.error("auto_sync_loop_error", error=str(exc))
        await asyncio.sleep(POLL_INTERVAL_MINUTES * 60)
