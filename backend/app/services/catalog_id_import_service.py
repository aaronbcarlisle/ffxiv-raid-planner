"""
Service: import verified game IDs into the collection catalog.

Accepts a list of VerifiedIdMapping entries (produced by the plugin Lumina resolver
or manually verified) and idempotently writes game_mount_id / token_item_id into
CollectionCatalogItem rows matched by source_duty_key + category=mount.

Rules:
- Only entries with confidence == "exact" are processed.
- game_mount_id is only set when the column is currently NULL (never overwrite).
- token_item_id is only set when the column is currently NULL (never overwrite).
- A row that already has both IDs set is counted as already_set and skipped.
- Rows not found by source_duty_key are counted as skipped with a logged reason.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging_config import get_logger
from ..models.collection_catalog_item import CollectionCatalogItem
from ..schemas.collection_catalog import VerifiedIdImportResult, VerifiedIdMapping

logger = get_logger(__name__)


async def import_verified_ids(
    session: AsyncSession,
    mappings: list[VerifiedIdMapping],
) -> VerifiedIdImportResult:
    result = VerifiedIdImportResult()

    for mapping in mappings:
        # Only trust exact confidence — ambiguous/none never write IDs
        if mapping.confidence != "exact":
            result.skipped += 1
            logger.debug(
                "catalog_id_import_skipped_confidence",
                source_duty_key=mapping.source_duty_key,
                confidence=mapping.confidence,
            )
            continue

        if not mapping.source_duty_key:
            result.skipped += 1
            logger.warning("catalog_id_import_missing_key", reward_name=mapping.reward_name)
            continue

        # Fetch all mount catalog rows for this duty key
        stmt = select(CollectionCatalogItem).where(
            CollectionCatalogItem.source_duty_key == mapping.source_duty_key,
            CollectionCatalogItem.category == "mount",
            CollectionCatalogItem.is_active == True,  # noqa: E712
        )
        rows = list((await session.execute(stmt)).scalars().all())

        if not rows:
            result.skipped += 1
            logger.warning(
                "catalog_id_import_no_row",
                source_duty_key=mapping.source_duty_key,
                reward_name=mapping.reward_name,
            )
            result.errors.append(
                f"No catalog row found for source_duty_key={mapping.source_duty_key!r}"
            )
            continue

        for row in rows:
            mount_id_changed = False
            token_id_changed = False

            # game_mount_id: only set when currently NULL
            if mapping.game_mount_id is not None and row.game_mount_id is None:
                row.game_mount_id = mapping.game_mount_id
                mount_id_changed = True

            # token_item_id: only set when currently NULL
            if mapping.token_item_id is not None and row.token_item_id is None:
                row.token_item_id = mapping.token_item_id
                token_id_changed = True

            if mount_id_changed or token_id_changed:
                result.updated += 1
                logger.info(
                    "catalog_id_import_updated",
                    source_duty_key=mapping.source_duty_key,
                    reward_name=mapping.reward_name,
                    game_mount_id=row.game_mount_id,
                    token_item_id=row.token_item_id,
                    verified_by=mapping.verified_by,
                )
            else:
                result.already_set += 1
                logger.debug(
                    "catalog_id_import_already_set",
                    source_duty_key=mapping.source_duty_key,
                    reward_name=mapping.reward_name,
                )

    await session.flush()
    return result
