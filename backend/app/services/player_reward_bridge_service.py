"""
Player Reward Bridge — write-through adapter for Player Hub Reward Farms.

When a user toggles reward state in the legacy MountFarmProgress UI this service
mirrors that signal into the shared PlayerCollectionIntent / PlayerCollectionSnapshot
models so Static Suggestions and dossier matching can use it.

Contract:
  - The primary write to MountFarmProgress happens BEFORE calling this service.
  - This service is best-effort: if there is no matching CollectionCatalogItem the
    service exits silently — the legacy row is still the source of truth and the
    legacy bridge adapter will surface it.
  - If no PlayerProfile exists for the user one is auto-created with private
    visibility so the write-through can proceed.
  - Never exposes private data: new intents default to static_only visibility.
  - Never overrides an explicit pass/hidden intent with a hunting signal.
  - Never overrides a plugin-confirmed snapshot.ownership_state.
  - Preserves higher visibility (dossier_public > static_only > private).

Called from:
  - PATCH /api/static-groups/{group_id}/mount-farms/progress
  - PUT  /api/static-groups/{group_id}/mount-farms/progress/bulk
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.player_collection_intent import PlayerCollectionIntent
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile

# Intents that represent an explicit opt-out — bridge must not overwrite them.
_PASS_INTENTS = frozenset({"pass", "hidden"})
# Intent visibility priority — higher index = higher visibility
_VIS_RANK = {"private": 0, "static_only": 1, "dossier_public": 2}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_or_create_profile(session: AsyncSession, user_id: str) -> str:
    """Return the profile id for user_id, auto-creating a minimal profile if absent."""
    result = await session.execute(
        select(PlayerProfile.id).where(PlayerProfile.user_id == user_id)
    )
    profile_id: str | None = result.scalar_one_or_none()
    if profile_id is not None:
        return profile_id

    now = _now()
    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user_id,
        visibility="private",
        share_enabled=False,
        created_at=now,
        updated_at=now,
    )
    session.add(profile)
    await session.flush()  # populate id without committing the outer transaction
    return profile.id


async def write_through_from_mount_farm(
    session: AsyncSession,
    *,
    user_id: str,
    trial_id: str,
    wants_mount: bool | None,
    has_mount: bool | None,
    totem_count: int | None,
) -> None:
    """Mirror a MountFarmProgress update into the shared collection model.

    All parameters may be None when the caller did not change that field.
    This function only writes intent/snapshot for the fields that were updated.
    """
    profile_id = await _get_or_create_profile(session, user_id)

    # A trial_id maps to CollectionCatalogItem.source_duty_key.
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.source_duty_key == trial_id,
            CollectionCatalogItem.category == "mount",
            CollectionCatalogItem.is_active.is_(True),
        )
    )
    catalog_items: list[CollectionCatalogItem] = list(catalog_result.scalars().all())
    if not catalog_items:
        return

    for catalog_item in catalog_items:
        await _write_intent(session, profile_id, catalog_item.id, wants_mount)
        await _write_snapshot(session, profile_id, catalog_item.id, has_mount, totem_count)


# ── Bulk variant (batches all lookups into 4 queries total) ──────────────────

@dataclass
class _BulkUpdate:
    user_id: str
    trial_id: str
    wants_mount: bool | None
    has_mount: bool | None
    totem_count: int | None


async def write_through_bulk_from_mount_farm(
    session: AsyncSession,
    updates: list[_BulkUpdate],
) -> None:
    """Batch mirror for bulk MountFarmProgress updates.

    Reduces N×4 individual queries to 4 batch queries regardless of update count.
    """
    if not updates:
        return

    unique_user_ids = list({u.user_id for u in updates})
    unique_trial_ids = list({u.trial_id for u in updates})

    # Batch 1: profiles (auto-create missing ones)
    profile_rows = (await session.execute(
        select(PlayerProfile.id, PlayerProfile.user_id).where(
            PlayerProfile.user_id.in_(unique_user_ids)
        )
    )).all()
    profile_by_user: dict[str, str] = {row.user_id: row.id for row in profile_rows}

    missing_users = [uid for uid in unique_user_ids if uid not in profile_by_user]
    if missing_users:
        now = _now()
        for uid in missing_users:
            pid = str(uuid.uuid4())
            profile = PlayerProfile(
                id=pid,
                user_id=uid,
                visibility="private",
                share_enabled=False,
                created_at=now,
                updated_at=now,
            )
            session.add(profile)
            profile_by_user[uid] = pid
        await session.flush()

    # Batch 2: catalog items by trial_id
    catalog_rows = (await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.source_duty_key.in_(unique_trial_ids),
            CollectionCatalogItem.category == "mount",
            CollectionCatalogItem.is_active.is_(True),
        )
    )).scalars().all()
    # trial_id → list of catalog items (usually 1, occasionally more)
    catalogs_by_trial: dict[str, list[CollectionCatalogItem]] = {}
    for item in catalog_rows:
        catalogs_by_trial.setdefault(item.source_duty_key, []).append(item)

    # Build the full set of (profile_id, catalog_item_id) pairs we'll need
    pairs: list[tuple[str, str]] = []
    for upd in updates:
        pid = profile_by_user.get(upd.user_id)
        if not pid:
            continue
        for item in catalogs_by_trial.get(upd.trial_id, []):
            pairs.append((pid, item.id))

    if not pairs:
        return

    # Batch 3: existing intents
    intent_rows = (await session.execute(
        select(PlayerCollectionIntent).where(
            tuple_(
                PlayerCollectionIntent.profile_id,
                PlayerCollectionIntent.catalog_item_id,
            ).in_(pairs)
        )
    )).scalars().all()
    intent_map: dict[tuple[str, str], PlayerCollectionIntent] = {
        (i.profile_id, i.catalog_item_id): i for i in intent_rows
    }

    # Batch 4: existing snapshots
    snapshot_rows = (await session.execute(
        select(PlayerCollectionSnapshot).where(
            tuple_(
                PlayerCollectionSnapshot.profile_id,
                PlayerCollectionSnapshot.catalog_item_id,
            ).in_(pairs)
        )
    )).scalars().all()
    snapshot_map: dict[tuple[str, str], PlayerCollectionSnapshot] = {
        (s.profile_id, s.catalog_item_id): s for s in snapshot_rows
    }

    # Apply write logic per update
    for upd in updates:
        pid = profile_by_user.get(upd.user_id)
        if not pid:
            continue
        for item in catalogs_by_trial.get(upd.trial_id, []):
            key = (pid, item.id)
            _apply_intent(session, pid, item.id, upd.wants_mount, intent_map.get(key))
            _apply_snapshot(session, pid, item.id, upd.has_mount, upd.totem_count, snapshot_map.get(key))


# ── Shared write helpers (sync — operate on already-loaded objects) ───────────

async def _write_intent(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    wants_mount: bool | None,
) -> None:
    if wants_mount is None or not wants_mount:
        return
    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile_id,
            PlayerCollectionIntent.catalog_item_id == catalog_item_id,
        )
    )
    _apply_intent(session, profile_id, catalog_item_id, wants_mount, result.scalar_one_or_none())


async def _write_snapshot(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    has_mount: bool | None,
    totem_count: int | None,
) -> None:
    if has_mount is None and totem_count is None:
        return
    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == profile_id,
            PlayerCollectionSnapshot.catalog_item_id == catalog_item_id,
        )
    )
    _apply_snapshot(session, profile_id, catalog_item_id, has_mount, totem_count, result.scalar_one_or_none())


def _apply_intent(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    wants_mount: bool | None,
    intent: PlayerCollectionIntent | None,
) -> None:
    """Apply hunting signal to an intent object (or create one if absent)."""
    if wants_mount is None or not wants_mount:
        return

    if intent is not None:
        if intent.intent in _PASS_INTENTS:
            return
        existing_rank = _VIS_RANK.get(intent.visibility, 0)
        intent.intent = "hunting"
        if existing_rank < _VIS_RANK["static_only"]:
            intent.visibility = "static_only"
        intent.updated_at = _now()
    else:
        session.add(PlayerCollectionIntent(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            catalog_item_id=catalog_item_id,
            intent="hunting",
            priority="medium",
            visibility="static_only",
            updated_at=_now(),
        ))


def _apply_snapshot(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    has_mount: bool | None,
    totem_count: int | None,
    snapshot: PlayerCollectionSnapshot | None,
) -> None:
    """Apply ownership/token update to a snapshot object (or create one if absent)."""
    if has_mount is None and totem_count is None:
        return

    now = _now()

    if snapshot is None:
        ownership_state = "unknown"
        if has_mount is True:
            ownership_state = "have"
        elif has_mount is False:
            ownership_state = "missing"
        session.add(PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            catalog_item_id=catalog_item_id,
            ownership_state=ownership_state,
            token_count=totem_count,
            source="player_hub",
            confidence="medium",
            updated_at=now,
        ))
        return

    is_plugin = snapshot.source == "plugin"

    if has_mount is True:
        snapshot.ownership_state = "have"
        snapshot.source = "player_hub"
        snapshot.confidence = "medium"
    elif has_mount is False:
        if not (is_plugin and snapshot.ownership_state == "have"):
            snapshot.ownership_state = "missing"
            if not is_plugin:
                snapshot.source = "player_hub"

    if totem_count is not None and not is_plugin:
        snapshot.token_count = totem_count

    snapshot.updated_at = now
