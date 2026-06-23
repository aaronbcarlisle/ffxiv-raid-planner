"""
Legacy mount farm bridge — adapts MountFarmProgress rows for the suggestion engine.

MountFarmProgress is a static-scoped, pre-profile-era model that tracked per-member
mount/totem progress inside a single static's farm page. This bridge exposes those
wants/owned/token signals to compute_suggestions without any destructive migration.

Privacy contract:
  - Data is always static-scoped (MountFarmProgress.static_group_id filters it).
  - Never used in dossier endpoints — dossier_farm_match queries PlayerCollectionIntent
    directly and must NOT call this bridge.
  - PlayerCollectionIntent (if present) takes priority over wants_mount.
  - PlayerCollectionSnapshot (if present) takes priority over has_mount / totem_count.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.mount_farm_progress import MountFarmProgress


@dataclass
class LegacyFarmSignal:
    has_mount: bool
    wants_mount: bool
    totem_count: int
    totem_cost: int | None = field(default=None)


async def get_legacy_farm_signals(
    session: AsyncSession,
    static_group_id: str,
    user_ids: Sequence[str],
) -> tuple[dict[tuple[str, str], LegacyFarmSignal], set[str]]:
    """
    Read MountFarmProgress for the static, resolve trial_id → catalog_item_id, and
    return per-(user_id, catalog_item_id) signal data alongside newly-surfaced catalog IDs.

    Returns:
        signal_map: (user_id, catalog_item_id) → LegacyFarmSignal
        extra_catalog_ids: catalog item IDs not already in the caller's candidate set
            that should be added because a member has wants_mount=True or has_mount=True
    """
    if not user_ids:
        return {}, set()

    mfp_result = await session.execute(
        select(MountFarmProgress).where(
            MountFarmProgress.static_group_id == static_group_id,
            MountFarmProgress.user_id.in_(user_ids),
        )
    )
    mfp_rows: list[MountFarmProgress] = list(mfp_result.scalars().all())
    if not mfp_rows:
        return {}, set()

    trial_ids = {r.trial_id for r in mfp_rows}

    # Resolve trial_id → catalog item(s) via source_duty_key
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.source_duty_key.in_(trial_ids),
            CollectionCatalogItem.category == "mount",
        )
    )
    catalog_items = list(catalog_result.scalars().all())

    trial_to_catalog: dict[str, list[CollectionCatalogItem]] = {}
    for c in catalog_items:
        if c.source_duty_key:
            trial_to_catalog.setdefault(c.source_duty_key, []).append(c)

    signal_map: dict[tuple[str, str], LegacyFarmSignal] = {}
    extra_catalog_ids: set[str] = set()

    for row in mfp_rows:
        items = trial_to_catalog.get(row.trial_id, [])
        for catalog_item in items:
            # Only include rows with positive signals. wants_mount=False is treated
            # as neutral (same as having no legacy row) — not as an explicit pass.
            if not row.wants_mount and not row.has_mount:
                continue

            key = (row.user_id, catalog_item.id)
            signal_map[key] = LegacyFarmSignal(
                has_mount=row.has_mount,
                wants_mount=row.wants_mount,
                totem_count=row.totem_count,
                totem_cost=catalog_item.token_cost,
            )
            # Surface to candidate set only when member actively wants the mount
            if row.wants_mount and not row.has_mount:
                extra_catalog_ids.add(catalog_item.id)

    return signal_map, extra_catalog_ids
