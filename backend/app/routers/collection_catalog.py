"""API router for the collection catalog (read-only for members, sync for admins)"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.collection_catalog_item import CollectionCatalogItem
from ..schemas.collection_catalog import CatalogItemResponse, CatalogSyncResult
from ..services.catalog_import_service import (
    is_catalog_seeded,
    seed_from_internal,
    sync_from_ffxiv_collect,
)

router = APIRouter(prefix="/api", tags=["collection-catalog"])
logger = get_logger(__name__)


@router.get("/collection-catalog", response_model=list[CatalogItemResponse])
async def list_catalog_items(
    category: str | None = Query(None, description="Filter by category (mount, minion, orchestrion, …)"),
    expansion: str | None = Query(None, description="Filter by expansion (dt, ew, shb, …)"),
    source_type: str | None = Query(None, description="Filter by source type (extreme, ultimate, …)"),
    session: AsyncSession = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> list[CatalogItemResponse]:
    """
    List catalog items. Auto-seeds from internal curated data on first call
    if the catalog is empty.

    Deduplication: when both an internal (curated) row and an ffxiv_collect row
    exist for the same item (same name + category), only the internal/curated
    row is returned. Preference order: is_curated=True > external_source='internal'.
    """
    if not await is_catalog_seeded(session):
        count = await seed_from_internal(session)
        logger.info("catalog_auto_seeded", count=count)

    stmt = select(CollectionCatalogItem).where(CollectionCatalogItem.is_active == True)  # noqa: E712
    if category:
        stmt = stmt.where(CollectionCatalogItem.category == category)
    if expansion:
        stmt = stmt.where(CollectionCatalogItem.expansion == expansion)
    if source_type:
        stmt = stmt.where(CollectionCatalogItem.source_type == source_type)

    # Sort: curated/internal first, then by expansion (newest first), then alphabetically
    stmt = stmt.order_by(
        CollectionCatalogItem.is_curated.desc(),
        (CollectionCatalogItem.external_source == "internal").desc(),
        CollectionCatalogItem.expansion.desc().nulls_last(),
        CollectionCatalogItem.patch.desc().nulls_last(),
        CollectionCatalogItem.name,
    )

    result = await session.execute(stmt)
    items = list(result.scalars().all())

    # Deduplicate: when both internal and ffxiv_collect rows exist for the same
    # (name.lower(), category), keep only the first occurrence (highest priority).
    seen: set[tuple[str, str]] = set()
    unique: list[CollectionCatalogItem] = []
    for item in items:
        key = (item.name.lower().strip(), item.category)
        if key not in seen:
            seen.add(key)
            unique.append(item)

    return [CatalogItemResponse.model_validate(item) for item in unique]


@router.post("/admin/collection-catalog/sync", response_model=CatalogSyncResult)
async def sync_catalog(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CatalogSyncResult:
    """Admin-only: pull latest data from FFXIV Collect API and update catalog."""
    if not current_user.is_admin:
        from ..permissions import Forbidden
        raise Forbidden("Admin access required")

    try:
        counts = await sync_from_ffxiv_collect(session)
        logger.info("catalog_synced_from_api", counts=counts)
        return CatalogSyncResult(synced_from_api=True, counts=counts)
    except Exception as exc:
        logger.error("catalog_sync_failed", error=str(exc))
        return CatalogSyncResult(synced_from_api=False, error=str(exc))


@router.post("/admin/collection-catalog/seed", response_model=CatalogSyncResult)
async def seed_catalog(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CatalogSyncResult:
    """Admin-only: (re-)seed catalog from internal curated data."""
    if not current_user.is_admin:
        from ..permissions import Forbidden
        raise Forbidden("Admin access required")

    count = await seed_from_internal(session)
    logger.info("catalog_seeded_manually", count=count)
    return CatalogSyncResult(seeded=True, counts={"internal": count})
