"""
Plugin collection sync service.

Matches plugin-reported mount ownership and token counts to active CollectionGoals
and updates RewardParticipantState records for the authenticated user.

Ownership matching (strict):
  Requires a stable game_mount_id match (Mount.exd row ID from plugin payload).
  source_duty_key is NOT used for ownership — it is ambiguous when catalog entries
  share the same duty (e.g. mount + orchestrion both keyed to "dt-valigarmanda").
  Mounts without a mount_id in the payload are counted in skipped_no_id.

Token matching:
  token_item_id first (Item.exd row ID), then token_name string fallback.
  Token count updates are safe without stable IDs (they don't set ownership).

Collision rules:
  - Manual "Pass" (source=manual, state=pass) is never overwritten by plugin
  - Plugin only sets state to "have" when owned=True; never downgrades existing state
  - Token counts are always updated from plugin (no lock on token_count)

The collection record (S2a-1): the user's main's record (`resolve_main_targets`),
written through the record door in sync mode. The farm rows go through the row
door (`write_row`), stamped with the member and the channel. The counters count
farm rows only; record writes are not counted (R-S1-17).
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_goal import CollectionGoal
from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.reward_participant_state import RewardParticipantState
from ..models.membership import Membership, MemberRole
from ..models.user import User
from ..schemas.plugin_collections import CollectionSyncResult, PluginCollectionSyncPayload
from .collection_records import (
    RECORD_WRITE_SYNC,
    UNSET,
    RecordTarget,
    resolve_main_targets,
    write_record,
    write_row,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()



async def sync_collection_states(
    session: AsyncSession,
    user: User,
    payload: PluginCollectionSyncPayload,
    *,
    actor_user_id: str,
    via: str,
) -> CollectionSyncResult:
    """Apply a plugin sync for `user`; `actor_user_id` and `via` stamp the record writes."""
    now = _now()
    result = CollectionSyncResult(synced_at=now)

    # Only update goals in groups where user is an active non-viewer member
    membership_result = await session.execute(
        select(Membership.static_group_id).where(
            Membership.user_id == user.id,
            Membership.role != MemberRole.VIEWER,
        )
    )
    group_ids = [r[0] for r in membership_result.all()]

    # ── Mount ownership (goal updates — requires group membership) ────────────
    # Ownership (Have) requires a stable game_mount_id match.
    # source_duty_key is NOT used here — it cannot distinguish mount from
    # orchestrion when multiple catalog entries share the same duty key.
    if group_ids:
        for mount_item in payload.mounts:
            if not mount_item.owned:
                continue  # Never downgrade existing state for unowned mounts

            if mount_item.mount_id is None:
                # No stable ID in payload — cannot safely confirm ownership
                result.skipped_no_id += 1
                continue

            id_result = await session.execute(
                select(CollectionCatalogItem).where(
                    CollectionCatalogItem.game_mount_id == mount_item.mount_id,
                    CollectionCatalogItem.category == "mount",
                )
            )
            catalog_items = id_result.scalars().all()

            if not catalog_items:
                result.skipped_no_id += 1
                continue

            for catalog_item in catalog_items:
                goals_result = await session.execute(
                    select(CollectionGoal).where(
                        CollectionGoal.catalog_item_id == catalog_item.id,
                        CollectionGoal.static_group_id.in_(group_ids),
                        CollectionGoal.status != "complete",
                    )
                )
                for goal in goals_result.scalars().all():
                    updated, locked = await _upsert_state(
                        session, goal, user.id, "have", now, actor_user_id=actor_user_id, via=via
                    )
                    if locked:
                        result.skipped_locked += 1
                    elif updated:
                        result.states_updated += 1
                    else:
                        result.states_unchanged += 1

    # ── Token / currency counts (goal updates — requires group membership) ────
    if group_ids:
        for token_item in payload.currencies:
            matched_goals: list[CollectionGoal] = []

            # Primary: match via catalog token_item_id from Item.exd
            if token_item.item_id is not None:
                catalog_by_id_result = await session.execute(
                    select(CollectionCatalogItem).where(
                        CollectionCatalogItem.token_item_id == token_item.item_id,
                    )
                )
                token_catalogs = catalog_by_id_result.scalars().all()
                for tc in token_catalogs:
                    goals_by_catalog = await session.execute(
                        select(CollectionGoal).where(
                            CollectionGoal.catalog_item_id == tc.id,
                            CollectionGoal.static_group_id.in_(group_ids),
                            CollectionGoal.status != "complete",
                        )
                    )
                    matched_goals.extend(goals_by_catalog.scalars().all())

            # Fallback: match by token_name string
            if not matched_goals and token_item.token_name:
                name_result = await session.execute(
                    select(CollectionGoal).where(
                        CollectionGoal.token_name == token_item.token_name,
                        CollectionGoal.static_group_id.in_(group_ids),
                        CollectionGoal.status != "complete",
                    )
                )
                matched_goals = name_result.scalars().all()

            for goal in matched_goals:
                updated = await _update_token_count(
                    session, goal, user.id, token_item.count, now, actor_user_id=actor_user_id, via=via
                )
                if updated:
                    result.token_counts_updated += 1

    # ── PlayerCollectionSnapshot sync ─────────────────────────────────────────
    # After updating goal states, also persist factual ownership to the player's
    # record so the suggestion engine can use it across all goals/statics.
    await _sync_snapshots(session, user, payload, now, actor_user_id=actor_user_id, via=via)

    await session.commit()
    return result


async def _write_sync_record(
    session: AsyncSession,
    target: RecordTarget,
    catalog_item_id: str,
    *,
    now: str,
    actor_user_id: str,
    via: str,
    ownership: str | None,
    token_count: int | None,
) -> None:
    """One plugin-reported fact on the target's record, written through the door."""
    await write_record(
        session,
        target,
        catalog_item_id,
        actor_user_id=actor_user_id,
        via=via,
        mode=RECORD_WRITE_SYNC,
        now=now,
        ownership=ownership,
        token_count=token_count,
        source="plugin",
        confidence="high",
    )


async def _sync_snapshots(
    session: AsyncSession,
    user: User,
    payload: PluginCollectionSyncPayload,
    now: str,
    *,
    actor_user_id: str,
    via: str,
) -> None:
    """Write the user's main's record from plugin-reported facts (sync mode).

    Only writes "have" state for mounts confirmed via stable game_mount_id.
    Never writes intent or preference data.
    Never writes "missing" state — absence of evidence is not evidence of absence.
    Sets token_count when token data is present.
    A user with no profile gets no record (no profile is created).
    """
    target = (await resolve_main_targets(session, [user.id]))[user.id]
    if target.profile_id is None:
        return

    # ── Mount ownership ───────────────────────────────────────────────────────
    for mount_item in payload.mounts:
        if not mount_item.owned or mount_item.mount_id is None:
            continue

        id_result = await session.execute(
            select(CollectionCatalogItem).where(
                CollectionCatalogItem.game_mount_id == mount_item.mount_id,
                CollectionCatalogItem.category == "mount",
            )
        )
        for catalog_item in id_result.scalars().all():
            await _write_sync_record(
                session,
                target,
                catalog_item.id,
                now=now,
                actor_user_id=actor_user_id,
                via=via,
                ownership="have",
                token_count=None,
            )

    # ── Token counts ──────────────────────────────────────────────────────────
    for token_item in payload.currencies:
        if token_item.item_id is None and not token_item.token_name:
            continue

        catalog_items: list[CollectionCatalogItem] = []
        if token_item.item_id is not None:
            id_result = await session.execute(
                select(CollectionCatalogItem).where(
                    CollectionCatalogItem.token_item_id == token_item.item_id,
                )
            )
            catalog_items = list(id_result.scalars().all())

        if not catalog_items and token_item.token_name:
            name_result = await session.execute(
                select(CollectionCatalogItem).where(
                    CollectionCatalogItem.token_name == token_item.token_name,
                )
            )
            catalog_items = list(name_result.scalars().all())

        for catalog_item in catalog_items:
            # No ownership: a count never changes it.
            await _write_sync_record(
                session,
                target,
                catalog_item.id,
                now=now,
                actor_user_id=actor_user_id,
                via=via,
                ownership=None,
                token_count=token_item.count,
            )


async def _upsert_state(
    session: AsyncSession,
    goal: CollectionGoal,
    user_id: str,
    new_state: str,
    now: str,
    *,
    actor_user_id: str,
    via: str,
) -> tuple[bool, bool]:
    """Upsert a participant state from plugin data.

    Returns (updated: bool, locked: bool).
    locked=True when the row is a manual Pass and cannot be overwritten.
    """
    existing_result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user_id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is None:
        await write_row(
            session,
            row=None,
            goal_id=goal.id,
            static_group_id=goal.static_group_id,
            user_id=user_id,
            actor_user_id=actor_user_id,
            via=via,
            now=now,
            state=new_state,
            source="plugin",
            last_synced_at=now,
        )
        return True, False

    # Manual "Pass" is protected — plugin must not overwrite it
    if existing.state == "pass" and existing.source == "manual":
        return False, True

    # Already confirmed from plugin — just refresh timestamp
    if existing.state == new_state and existing.source == "plugin":
        existing.last_synced_at = now
        return False, False

    await write_row(
        session,
        row=existing,
        goal_id=goal.id,
        static_group_id=goal.static_group_id,
        user_id=user_id,
        actor_user_id=actor_user_id,
        via=via,
        now=now,
        state=new_state,
        source="plugin",
        last_synced_at=now,
    )
    return True, False


async def _update_token_count(
    session: AsyncSession,
    goal: CollectionGoal,
    user_id: str,
    count: int,
    now: str,
    *,
    actor_user_id: str,
    via: str,
) -> bool:
    """Update token count for a participant. Returns True if the count changed."""
    existing_result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user_id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None and existing.token_count == count:
        return False

    # A new row starts at "want", sourced from the plugin; an existing row keeps its state.
    await write_row(
        session,
        row=existing,
        goal_id=goal.id,
        static_group_id=goal.static_group_id,
        user_id=user_id,
        actor_user_id=actor_user_id,
        via=via,
        now=now,
        token_count=count,
        last_synced_at=now,
        source="plugin" if existing is None else UNSET,
    )
    return True
