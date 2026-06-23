"""
Catalog audit service.

Reports plugin sync readiness across catalog items.

Definitions:
  plugin_ready_mount  — category=mount AND game_mount_id IS NOT NULL
  plugin_ready_token  — token_item_id IS NOT NULL (applicable to any category)
  manual_only         — no game_mount_id (for mounts) or no token_item_id (for tokens)

Dawntrail mounts are reported separately because their IDs have not yet been
verified from Mount.exd / Item.exd via Lumina.
"""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem


async def get_catalog_audit(session: AsyncSession) -> dict:
    """
    Return plugin sync readiness counts.

    Result shape:
      {
        "total": int,
        "plugin_ready_mounts": int,   # mounts with game_mount_id
        "manual_only_mounts": int,    # mounts without game_mount_id
        "plugin_ready_tokens": int,   # rows with token_item_id
        "manual_only_tokens": int,    # rows without token_item_id (but have token_name)
        "by_category": {
          "<category>": {
            "total": int,
            "plugin_ready_mount": int,
            "manual_only_mount": int,
            "plugin_ready_token": int,
            "manual_only_token": int,
          }
        },
        "by_expansion": {
          "<expansion>": {
            "total": int,
            "plugin_ready_mount": int,
            "manual_only_mount": int,
            "plugin_ready_token": int,
            "manual_only_token": int,
          }
        },
        "dt_detail": {
          "total_mounts": int,
          "plugin_ready_mounts": int,
          "manual_only_mounts": int,
          "total_tokens": int,
          "plugin_ready_tokens": int,
          "manual_only_tokens": int,
          "missing_mount_ids": ["<name>", ...],
          "missing_token_ids": ["<name>", ...],
        },
      }
    """
    result = await session.execute(
        select(
            CollectionCatalogItem.id,
            CollectionCatalogItem.name,
            CollectionCatalogItem.category,
            CollectionCatalogItem.expansion,
            CollectionCatalogItem.game_mount_id,
            CollectionCatalogItem.token_item_id,
            CollectionCatalogItem.token_name,
        ).where(CollectionCatalogItem.is_active.is_(True))
    )
    rows = result.all()

    cat_totals: dict[str, int] = defaultdict(int)
    cat_ready_mount: dict[str, int] = defaultdict(int)
    cat_ready_token: dict[str, int] = defaultdict(int)
    cat_has_token: dict[str, int] = defaultdict(int)

    exp_totals: dict[str, int] = defaultdict(int)
    exp_ready_mount: dict[str, int] = defaultdict(int)
    exp_ready_token: dict[str, int] = defaultdict(int)
    exp_has_token: dict[str, int] = defaultdict(int)

    dt_mounts_total = 0
    dt_mounts_ready = 0
    dt_tokens_total = 0
    dt_tokens_ready = 0
    dt_missing_mount: list[str] = []
    dt_missing_token: list[str] = []

    for _, name, category, expansion, game_mount_id, token_item_id, token_name in rows:
        exp_key = expansion or "unknown"
        cat_totals[category] += 1
        exp_totals[exp_key] += 1

        if game_mount_id is not None:
            cat_ready_mount[category] += 1
            exp_ready_mount[exp_key] += 1

        has_token_name = bool(token_name)
        if has_token_name:
            cat_has_token[category] += 1
            exp_has_token[exp_key] += 1
        if token_item_id is not None:
            cat_ready_token[category] += 1
            exp_ready_token[exp_key] += 1

        # DT detail
        if expansion == "dt" and category == "mount":
            dt_mounts_total += 1
            if game_mount_id is not None:
                dt_mounts_ready += 1
            else:
                dt_missing_mount.append(name)

        if expansion == "dt" and has_token_name:
            dt_tokens_total += 1
            if token_item_id is not None:
                dt_tokens_ready += 1
            elif category == "mount":
                dt_missing_token.append(name)

    all_categories = sorted(cat_totals.keys())
    by_category = {
        cat: {
            "total": cat_totals[cat],
            "plugin_ready_mount": cat_ready_mount[cat],
            "manual_only_mount": cat_totals[cat] - cat_ready_mount[cat],
            "plugin_ready_token": cat_ready_token[cat],
            "manual_only_token": cat_has_token[cat] - cat_ready_token[cat],
        }
        for cat in all_categories
    }

    all_expansions = sorted(exp_totals.keys())
    by_expansion = {
        exp: {
            "total": exp_totals[exp],
            "plugin_ready_mount": exp_ready_mount[exp],
            "manual_only_mount": exp_totals[exp] - exp_ready_mount[exp],
            "plugin_ready_token": exp_ready_token[exp],
            "manual_only_token": exp_has_token[exp] - exp_ready_token[exp],
        }
        for exp in all_expansions
    }

    mount_total = cat_totals.get("mount", 0)
    mount_ready = cat_ready_mount.get("mount", 0)
    token_has = sum(cat_has_token.values())
    token_ready = sum(cat_ready_token.values())

    return {
        "total": sum(cat_totals.values()),
        "plugin_ready_mounts": mount_ready,
        "manual_only_mounts": mount_total - mount_ready,
        "plugin_ready_tokens": token_ready,
        "manual_only_tokens": token_has - token_ready,
        "by_category": by_category,
        "by_expansion": by_expansion,
        "dt_detail": {
            "total_mounts": dt_mounts_total,
            "plugin_ready_mounts": dt_mounts_ready,
            "manual_only_mounts": dt_mounts_total - dt_mounts_ready,
            "total_tokens": dt_tokens_total,
            "plugin_ready_tokens": dt_tokens_ready,
            "manual_only_tokens": dt_tokens_total - dt_tokens_ready,
            "missing_mount_ids": dt_missing_mount,
            "missing_token_ids": dt_missing_token,
        },
    }
