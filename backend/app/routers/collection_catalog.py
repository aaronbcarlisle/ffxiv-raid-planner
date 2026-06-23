"""API router for the collection catalog (read-only for members, sync for admins)"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.collection_catalog_item import CollectionCatalogItem
from ..schemas.collection_catalog import AuditEntry, CatalogAuditReport, CatalogItemResponse, CatalogSyncResult, DtAuditDetail, VerifiedIdImportResult, VerifiedIdMapping
from ..services.catalog_audit_service import get_catalog_audit
from ..services.catalog_id_import_service import import_verified_ids
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


@router.get("/admin/collection-catalog/audit", response_model=CatalogAuditReport)
async def catalog_audit(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CatalogAuditReport:
    """Admin-only: report plugin sync readiness for all catalog items."""
    if not current_user.is_admin:
        from ..permissions import Forbidden
        raise Forbidden("Admin access required")

    report = await get_catalog_audit(session)
    return CatalogAuditReport(
        total=report["total"],
        plugin_ready_mounts=report["plugin_ready_mounts"],
        manual_only_mounts=report["manual_only_mounts"],
        plugin_ready_tokens=report["plugin_ready_tokens"],
        manual_only_tokens=report["manual_only_tokens"],
        by_category={k: AuditEntry(**v) for k, v in report["by_category"].items()},
        by_expansion={k: AuditEntry(**v) for k, v in report["by_expansion"].items()},
        dt_detail=DtAuditDetail(**report["dt_detail"]),
    )


@router.post("/admin/collection-catalog/import-verified-ids", response_model=VerifiedIdImportResult)
async def import_catalog_verified_ids(
    mappings: list[VerifiedIdMapping],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> VerifiedIdImportResult:
    """
    Admin-only: ingest a list of verified game ID mappings from the plugin Lumina resolver
    and idempotently update catalog rows.

    Only entries with confidence==\"exact\" are processed.
    game_mount_id and token_item_id are never overwritten if already set.
    """
    if not current_user.is_admin:
        from ..permissions import Forbidden
        raise Forbidden("Admin access required")

    result = await import_verified_ids(session, mappings)
    logger.info(
        "catalog_id_import_complete",
        updated=result.updated,
        already_set=result.already_set,
        skipped=result.skipped,
        errors=len(result.errors),
    )
    return result


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
