"""
Catalog import service.

Two import paths:
1. seed_from_internal() — seeds from curated internal data (always safe to run)
2. sync_from_ffxiv_collect() — pulls from FFXIV Collect API and upserts
   (admin-triggered; applies internal overrides on top)
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem
from .catalog_data import ALL_CURATED_ITEMS, CuratedItem
from .ffxiv_collect_client import fetch_mounts, fetch_minions, fetch_orchestrion


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Internal seed ──────────────────────────────────────────────────────────────

async def seed_from_internal(session: AsyncSession) -> int:
    """
    Upsert all curated internal items. Safe to call on startup or first access.
    Returns count of items upserted.
    """
    count = 0
    for item in ALL_CURATED_ITEMS:
        await _upsert_catalog_item(
            session,
            external_source="internal",
            external_id=item["source_key"],
            name=item["name"],
            category=item["category"],
            expansion=item.get("expansion"),
            patch=item.get("patch"),
            source_text=item.get("source_text"),
            source_type=item.get("source_type"),
            source_duty_name=item.get("source_duty_name"),
            source_duty_key=item.get("source_duty_key"),
            token_name=item.get("token_name"),
            token_cost=item.get("token_cost"),
            is_curated=True,
        )
        count += 1
    await session.commit()
    return count


async def is_catalog_seeded(session: AsyncSession) -> bool:
    """Quick check — returns True if any curated items exist."""
    result = await session.execute(
        select(CollectionCatalogItem)
        .where(CollectionCatalogItem.external_source == "internal")
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def is_collect_sync_needed(session: AsyncSession) -> bool:
    """Returns True if minion or orchestrion categories have no entries (need FFXIV Collect sync)."""
    result = await session.execute(
        select(CollectionCatalogItem)
        .where(CollectionCatalogItem.category.in_(["minion", "orchestrion"]))
        .limit(1)
    )
    return result.scalar_one_or_none() is None


# ── FFXIV Collect sync ─────────────────────────────────────────────────────────

# Maps FFXIV Collect source type strings to internal categories
_SOURCE_TYPE_MAP: dict[str, str] = {
    "Extreme": "extreme",
    "Ultimate": "ultimate",
    "Savage": "savage",
    "Criterion": "criterion",
    "Alliance Raid": "chaotic_alliance",
    "Crafted": "crafted",
    "NPC": "other",
    "Achievement": "other",
    "Trial": "extreme",
    "Dungeon": "other",
    "Raid": "savage",
}

# Maps FFXIV Collect patch prefixes to expansion slugs
_EXPANSION_BY_PATCH: dict[str, str] = {
    "2.": "arr", "3.": "hw", "4.": "sb",
    "5.": "shb", "6.": "ew", "7.": "dt",
}


def _expansion_from_patch(patch: str | None) -> str | None:
    if not patch:
        return None
    for prefix, exp in _EXPANSION_BY_PATCH.items():
        if patch.startswith(prefix):
            return exp
    return None


def _extract_source_info(sources: list[dict[str, Any]]) -> tuple[str | None, str | None, str | None]:
    """Return (source_type, duty_name, source_text) from FFXIV Collect sources list."""
    for s in sources:
        stype = s.get("type", "")
        related = s.get("related_type", "")
        related_name = s.get("related", {}).get("name", "") if isinstance(s.get("related"), dict) else ""
        text = s.get("text", "")
        internal_type = _SOURCE_TYPE_MAP.get(stype) or _SOURCE_TYPE_MAP.get(related, "other")
        duty = related_name or stype
        return internal_type, duty or None, text or None
    return None, None, None


async def sync_from_ffxiv_collect(session: AsyncSession) -> dict[str, int]:
    """
    Fetch mounts, minions, and orchestrion from FFXIV Collect and upsert.
    Applies internal curated overrides on top of API data.
    Returns counts per category.
    """
    counts = {"mount": 0, "minion": 0, "orchestrion": 0}

    mount_data = await fetch_mounts()
    for item in mount_data:
        patch = item.get("patch", "")
        sources = item.get("sources", [])
        src_type, duty_name, src_text = _extract_source_info(sources)
        await _upsert_catalog_item(
            session,
            external_source="ffxiv_collect",
            external_id=str(item["id"]),
            name=item.get("name", "Unknown"),
            category="mount",
            expansion=_expansion_from_patch(patch),
            patch=patch or None,
            icon_url=item.get("icon"),
            image_url=item.get("image"),
            source_text=src_text,
            source_type=src_type,
            source_duty_name=duty_name,
            rarity_owned_percent=item.get("owned"),
            is_curated=False,
        )
        counts["mount"] += 1

    minion_data = await fetch_minions()
    for item in minion_data:
        patch = item.get("patch", "")
        sources = item.get("sources", [])
        src_type, duty_name, src_text = _extract_source_info(sources)
        await _upsert_catalog_item(
            session,
            external_source="ffxiv_collect",
            external_id=f"minion-{item['id']}",
            name=item.get("name", "Unknown"),
            category="minion",
            expansion=_expansion_from_patch(patch),
            patch=patch or None,
            icon_url=item.get("icon"),
            image_url=item.get("image"),
            source_text=src_text,
            source_type=src_type,
            source_duty_name=duty_name,
            rarity_owned_percent=item.get("owned"),
            is_curated=False,
        )
        counts["minion"] += 1

    orch_data = await fetch_orchestrion()
    for item in orch_data:
        patch = item.get("patch", "")
        sources = item.get("sources", [])
        src_type, duty_name, src_text = _extract_source_info(sources)
        await _upsert_catalog_item(
            session,
            external_source="ffxiv_collect",
            external_id=f"orch-{item['id']}",
            name=item.get("name", "Unknown"),
            category="orchestrion",
            expansion=_expansion_from_patch(patch),
            patch=patch or None,
            icon_url=item.get("icon"),
            source_text=src_text,
            source_type=src_type,
            source_duty_name=duty_name,
            rarity_owned_percent=item.get("owned"),
            is_curated=False,
        )
        counts["orchestrion"] += 1

    await session.commit()

    # Re-apply internal overrides after sync to ensure curated data isn't overwritten
    await seed_from_internal(session)

    return counts


# ── Core upsert ───────────────────────────────────────────────────────────────

async def _upsert_catalog_item(
    session: AsyncSession,
    *,
    external_source: str,
    external_id: str,
    name: str,
    category: str,
    expansion: str | None = None,
    patch: str | None = None,
    icon_url: str | None = None,
    image_url: str | None = None,
    source_text: str | None = None,
    source_type: str | None = None,
    source_duty_name: str | None = None,
    source_duty_key: str | None = None,
    token_name: str | None = None,
    token_cost: int | None = None,
    tradeable: bool | None = None,
    rarity_owned_percent: float | None = None,
    is_curated: bool = False,
) -> CollectionCatalogItem:
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.external_source == external_source,
            CollectionCatalogItem.external_id == external_id,
        )
    )
    item = result.scalar_one_or_none()

    now = _now()
    if item is None:
        item = CollectionCatalogItem(
            id=str(uuid.uuid4()),
            external_source=external_source,
            external_id=external_id,
            name=name,
            category=category,
            expansion=expansion,
            patch=patch,
            icon_url=icon_url,
            image_url=image_url,
            source_text=source_text,
            source_type=source_type,
            source_duty_name=source_duty_name,
            source_duty_key=source_duty_key,
            token_name=token_name,
            token_cost=token_cost,
            tradeable=tradeable,
            rarity_owned_percent=rarity_owned_percent,
            is_curated=is_curated,
            is_active=True,
            updated_at=now,
        )
        session.add(item)
    else:
        item.name = name
        item.category = category
        if expansion is not None:
            item.expansion = expansion
        if patch is not None:
            item.patch = patch
        if icon_url is not None:
            item.icon_url = icon_url
        if image_url is not None:
            item.image_url = image_url
        if source_text is not None:
            item.source_text = source_text
        if source_type is not None:
            item.source_type = source_type
        if source_duty_name is not None:
            item.source_duty_name = source_duty_name
        if source_duty_key is not None:
            item.source_duty_key = source_duty_key
        # Curated data always wins for token info
        if is_curated or token_name is not None:
            item.token_name = token_name
        if is_curated or token_cost is not None:
            item.token_cost = token_cost
        if rarity_owned_percent is not None:
            item.rarity_owned_percent = rarity_owned_percent
        if is_curated:
            item.is_curated = True
        item.is_active = True
        item.updated_at = now

    return item
