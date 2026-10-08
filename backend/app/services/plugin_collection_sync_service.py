"""
Plugin collection sync service.

Matches plugin-reported mount ownership and token counts to catalog items and
to the active CollectionGoals of the user's non-viewer statics, then hands the
facts to `apply_sync` (collection_records.py), which writes the farm rows and
the character record under R-S1-17's one rule.

Ownership matching (strict):
  Requires a stable game_mount_id match (Mount.exd row ID from plugin payload).
  source_duty_key is NOT used for ownership — it is ambiguous when catalog entries
  share the same duty (e.g. mount + orchestrion both keyed to "dt-valigarmanda").
  Mounts without a mount_id in the payload are counted in skipped_no_id.

Token matching:
  token_item_id first (Item.exd row ID), then a name fallback: goals by their
  own token_name for the rows, catalog items by token_name for the record.
  Token count updates are safe without stable IDs (they don't set ownership).

Which character, and which statics (R-S1-17):
  The payload's characterName and characterWorld pick one of the user's own
  characters (`match_sync_character`). Matched: that character's record, and
  rows only in the statics whose chain names it. Null, "Unknown", unmatched or
  ambiguous: rows in every non-viewer static and the main's record, else the
  profile-level row (B6); no profile, no record.

Collision rule (one for rows and record, in `apply_sync`):
  - A sync only raises ownership to Have; it never lowers (unowned mounts are no news)
  - A sync never changes a Pass row, whatever its source: every Pass came from a person
  - A token count is the newest write

The counters count farm rows only; record writes are not counted (vet M-6).
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.collection_goal import CollectionGoal
from ..models.membership import MemberRole, Membership
from ..models.user import User
from ..schemas.plugin_collections import (
    CollectionSyncResult,
    CollectionTokenItem,
    PluginCollectionSyncPayload,
)
from .collection_records import SyncChange, SyncRowChange, apply_sync


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _mount_catalog_items(session: AsyncSession, mount_id: int) -> list[CollectionCatalogItem]:
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.game_mount_id == mount_id,
            CollectionCatalogItem.category == "mount",
        )
    )
    return list(result.scalars().all())


async def _token_catalog_items(
    session: AsyncSession, token_item: CollectionTokenItem, *, by_name: bool
) -> list[CollectionCatalogItem]:
    """Catalog items for a token: by `token_item_id`, or (`by_name`) by `token_name`."""
    if by_name:
        clause = CollectionCatalogItem.token_name == token_item.token_name
    else:
        clause = CollectionCatalogItem.token_item_id == token_item.item_id
    result = await session.execute(select(CollectionCatalogItem).where(clause))
    return list(result.scalars().all())


async def _open_goals(
    session: AsyncSession,
    group_ids: list[str],
    *,
    catalog_item_ids: list[str] | None = None,
    token_name: str | None = None,
) -> list[CollectionGoal]:
    """The non-complete goals of `group_ids` on the items, or named like the token."""
    if not group_ids or not (catalog_item_ids or token_name):
        return []
    query = select(CollectionGoal).where(
        CollectionGoal.static_group_id.in_(group_ids),
        CollectionGoal.status != "complete",
    )
    if catalog_item_ids:
        query = query.where(CollectionGoal.catalog_item_id.in_(catalog_item_ids))
    else:
        query = query.where(CollectionGoal.token_name == token_name)
    result = await session.execute(query)
    return list(result.scalars().all())


async def sync_collection_states(
    session: AsyncSession,
    user: User,
    payload: PluginCollectionSyncPayload,
    *,
    actor_user_id: str,
    via: str,
) -> CollectionSyncResult:
    """Apply a plugin sync for `user`; `actor_user_id` and `via` stamp the writes."""
    now = _now()
    result = CollectionSyncResult(synced_at=now)

    # Rows are written only in statics where the user is an active non-viewer member.
    membership_result = await session.execute(
        select(Membership.static_group_id).where(
            Membership.user_id == user.id,
            Membership.role != MemberRole.VIEWER,
        )
    )
    group_ids = [r[0] for r in membership_result.all()]

    changes: list[SyncChange] = []
    row_changes: list[SyncRowChange] = []

    # ── Mount ownership ───────────────────────────────────────────────────────
    # Ownership (Have) requires a stable game_mount_id match.
    # source_duty_key is NOT used here — it cannot distinguish mount from
    # orchestrion when multiple catalog entries share the same duty key.
    for mount_item in payload.mounts:
        if not mount_item.owned:
            continue  # A sync never lowers: an unowned mount is no news

        if mount_item.mount_id is None:
            # No stable ID in payload — cannot safely confirm ownership
            result.skipped_no_id += 1
            continue

        catalog_items = await _mount_catalog_items(session, mount_item.mount_id)
        if not catalog_items:
            result.skipped_no_id += 1
            continue

        for catalog_item in catalog_items:
            changes.append(SyncChange(catalog_item.id, owned=True))
            for goal in await _open_goals(session, group_ids, catalog_item_ids=[catalog_item.id]):
                row_changes.append(SyncRowChange(goal.id, goal.static_group_id, owned=True))

    # ── Token / currency counts ───────────────────────────────────────────────
    for token_item in payload.currencies:
        if token_item.item_id is None and not token_item.token_name:
            continue

        by_id: list[CollectionCatalogItem] = []
        if token_item.item_id is not None:
            by_id = await _token_catalog_items(session, token_item, by_name=False)

        # Rows: the goals on the id-matched items, else the goals named like the token.
        goals = await _open_goals(session, group_ids, catalog_item_ids=[c.id for c in by_id])
        if not goals and token_item.token_name:
            goals = await _open_goals(session, group_ids, token_name=token_item.token_name)
        for goal in goals:
            row_changes.append(
                SyncRowChange(goal.id, goal.static_group_id, token_count=token_item.count)
            )

        # The record: the id-matched items, else the items named like the token.
        record_items = by_id
        if not record_items and token_item.token_name:
            record_items = await _token_catalog_items(session, token_item, by_name=True)
        for catalog_item in record_items:
            # No ownership: a count never changes it.
            changes.append(SyncChange(catalog_item.id, token_count=token_item.count))

    outcome = await apply_sync(
        session,
        user_id=user.id,
        character_name=payload.character_name,
        character_world=payload.character_world,
        static_group_ids=group_ids,
        changes=changes,
        row_changes=row_changes,
        actor_user_id=actor_user_id,
        via=via,
        now=now,
    )
    result.states_updated = outcome.rows_updated
    result.states_unchanged = outcome.rows_unchanged
    result.skipped_locked = outcome.rows_locked
    result.token_counts_updated = outcome.counts_updated

    await session.commit()
    return result
