"""
Background task: sync FFXIV Collect catalog once on startup.

Runs 5 seconds after the server starts so the server is fully ready.
If FFXIV Collect rows already exist in the DB, the sync is skipped
(subsequent syncs are admin-triggered via POST /api/admin/collection-catalog/sync).

Total sync timeout: 90 seconds. If the FFXIV Collect API is slow or down,
the sync fails gracefully and internal-curated data remains available.
"""

import asyncio
import logging

from ..database import get_session
from ..services.catalog_import_service import is_collect_sync_needed, sync_from_ffxiv_collect

logger = logging.getLogger(__name__)

_STARTUP_DELAY_SECONDS = 5
_SYNC_TIMEOUT_SECONDS = 90


async def catalog_sync_loop() -> None:
    """Single-shot background task: sync FFXIV Collect if not already done."""
    await asyncio.sleep(_STARTUP_DELAY_SECONDS)

    try:
        async for session in get_session():
            needed = await is_collect_sync_needed(session)
            break
    except Exception as exc:
        logger.warning("catalog_sync_check_failed", error=str(exc))
        return

    if not needed:
        logger.info("catalog_sync_skipped", reason="ffxiv_collect rows already present")
        return

    logger.info("catalog_sync_starting", timeout=_SYNC_TIMEOUT_SECONDS)
    try:
        async for session in get_session():
            counts = await asyncio.wait_for(
                sync_from_ffxiv_collect(session),
                timeout=_SYNC_TIMEOUT_SECONDS,
            )
            logger.info("catalog_sync_complete", counts=counts)
            break
    except asyncio.TimeoutError:
        logger.warning(
            "catalog_sync_timeout",
            timeout=_SYNC_TIMEOUT_SECONDS,
            message="FFXIV Collect sync timed out — internal curated data is still available",
        )
    except asyncio.CancelledError:
        logger.info("catalog_sync_cancelled")
        raise
    except Exception as exc:
        logger.warning(
            "catalog_sync_failed",
            error=str(exc),
            message="FFXIV Collect sync failed — internal curated data is still available",
        )
