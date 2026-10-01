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
  - Preserves higher visibility (dossier_public > static_only > private).
  - Writes the collection record only for the member's own edit (S2a-1, R-S1-10):
    the record the chain names for them in this static, through the record door
    as a person's write (`player_hub`, medium), so it can lower a plugin Have and
    stores a count (Q1). A lead's edit for another member writes the intent only.

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
from ..models.player_profile import PlayerProfile
from .collection_records import RECORD_WRITE_PERSON, resolve_record_targets, write_record
from .player_profile_service import get_or_create_profile

# Intents that represent an explicit opt-out — bridge must not overwrite them.
_PASS_INTENTS = frozenset({"pass", "hidden"})
# Intent visibility priority — higher index = higher visibility
_VIS_RANK = {"private": 0, "static_only": 1, "dossier_public": 2}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_or_create_profile(session: AsyncSession, user_id: str) -> str:
    """Return the profile id for user_id, auto-creating a minimal profile if absent."""
    profile = await get_or_create_profile(session, user_id)
    return profile.id


async def write_through_from_mount_farm(
    session: AsyncSession,
    *,
    group_id: str,
    user_id: str,
    trial_id: str,
    wants_mount: bool | None,
    has_mount: bool | None,
    totem_count: int | None,
    actor_user_id: str,
    via: str,
) -> None:
    """Mirror a MountFarmProgress update into the shared collection model.

    All parameters may be None when the caller did not change that field.
    This function only writes intent/record for the fields that were updated.
    `actor_user_id` is the caller and `via` the route's `logged_via(request)`.
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
    await _write_own_records(
        session,
        [
            _RecordEdit(user_id, catalog_item.id, has_mount, totem_count)
            for catalog_item in catalog_items
        ],
        group_id=group_id,
        actor_user_id=actor_user_id,
        via=via,
    )


# ── Bulk variant (batches the profile, catalog and intent lookups) ───────────

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
    *,
    group_id: str,
    actor_user_id: str,
    via: str,
) -> None:
    """Batch mirror for bulk MountFarmProgress updates.

    Batches the profile, catalog and intent lookups into 3 queries, plus one
    race-safe get-or-create per user who has no profile yet. That extra work is
    bounded by the number of *new* users in a single bulk update -- normally
    zero, since profiles are created once per account and then reused. Only the
    caller's own rows reach a record (R-S1-10), so the record writes resolve
    one target.
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
    for uid in missing_users:
        # Same race as the single-profile path: a concurrent request may create
        # this profile between the batch read above and the insert below.
        profile = await get_or_create_profile(session, uid)
        profile_by_user[uid] = profile.id

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

    # Apply intent logic per update
    for upd in updates:
        pid = profile_by_user.get(upd.user_id)
        if not pid:
            continue
        for item in catalogs_by_trial.get(upd.trial_id, []):
            key = (pid, item.id)
            _apply_intent(session, pid, item.id, upd.wants_mount, intent_map.get(key))

    await _write_own_records(
        session,
        [
            _RecordEdit(upd.user_id, item.id, upd.has_mount, upd.totem_count)
            for upd in updates
            for item in catalogs_by_trial.get(upd.trial_id, [])
        ],
        group_id=group_id,
        actor_user_id=actor_user_id,
        via=via,
    )


# ── The record (S2a-1, R-S1-10) ───────────────────────────────────────────────

@dataclass(frozen=True)
class _RecordEdit:
    """One mount-farm edit's record fields for one catalog item."""

    user_id: str
    catalog_item_id: str
    has_mount: bool | None
    totem_count: int | None


def _ownership(has_mount: bool | None) -> str | None:
    """`has_mount` as a record ownership; None leaves the ownership alone."""
    if has_mount is None:
        return None
    return "have" if has_mount else "missing"


async def _write_own_records(
    session: AsyncSession,
    edits: list[_RecordEdit],
    *,
    group_id: str,
    actor_user_id: str,
    via: str,
) -> None:
    """Write the caller's own edits to the record the chain names for them in this static.

    Only an edit whose target is the caller reaches a record: a lead's edit for
    another member stops at that member's farm row and intent (R-S1-10). Each
    write is a person's write through the door, so it can lower a plugin Have
    and stores a count (Q1). An edit with neither field set writes nothing.
    """
    own = [
        edit
        for edit in edits
        if edit.user_id == actor_user_id
        and (edit.has_mount is not None or edit.totem_count is not None)
    ]
    if not own:
        return
    targets = await resolve_record_targets(session, {(group_id, edit.user_id) for edit in own})
    now = _now()
    for edit in own:
        await write_record(
            session,
            targets[(group_id, edit.user_id)],
            edit.catalog_item_id,
            actor_user_id=actor_user_id,
            via=via,
            mode=RECORD_WRITE_PERSON,
            now=now,
            ownership=_ownership(edit.has_mount),
            token_count=edit.totem_count,
            source="player_hub",
            confidence="medium",
        )


# ── Intent helpers ────────────────────────────────────────────────────────────

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
