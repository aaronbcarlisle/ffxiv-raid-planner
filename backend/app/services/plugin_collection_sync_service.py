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
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_goal import CollectionGoal
from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile
from ..models.reward_participant_state import RewardParticipantState
from ..models.membership import Membership, MemberRole
from ..models.user import User
from ..schemas.plugin_collections import CollectionSyncResult, PluginCollectionSyncPayload


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()



async def sync_collection_states(
    session: AsyncSession,
    user: User,
    payload: PluginCollectionSyncPayload,
) -> CollectionSyncResult:
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
                    updated, locked = await _upsert_state(session, goal, user.id, "have", now)
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
                updated = await _update_token_count(session, goal, user.id, token_item.count, now)
                if updated:
                    result.token_counts_updated += 1

    # ── PlayerCollectionSnapshot sync ─────────────────────────────────────────
    # After updating goal states, also persist factual ownership to the player's
    # profile snapshot so the suggestion engine can use it across all goals/statics.
    await _sync_snapshots(session, user, payload, now)

    await session.commit()
    return result


async def _sync_snapshots(
    session: AsyncSession,
    user: User,
    payload: PluginCollectionSyncPayload,
    now: str,
) -> None:
    """Write PlayerCollectionSnapshot entries from plugin-reported facts.

    Only writes "have" state for mounts confirmed via stable game_mount_id.
    Never writes intent or preference data.
    Never writes "missing" state — absence of evidence is not evidence of absence.
    Updates token_count on existing snapshots when token data is present.
    """
    # Resolve to PlayerProfile (may not exist for users without a Hub profile)
    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None:
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
            await _upsert_snapshot(
                session,
                profile_id=profile.id,
                catalog_item_id=catalog_item.id,
                ownership_state="have",
                source="plugin",
                confidence="high",
                now=now,
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
            await _upsert_snapshot(
                session,
                profile_id=profile.id,
                catalog_item_id=catalog_item.id,
                ownership_state=None,  # Don't change ownership — just update count
                source="plugin",
                confidence="high",
                now=now,
                token_count=token_item.count,
            )


async def _upsert_snapshot(
    session: AsyncSession,
    *,
    profile_id: str,
    catalog_item_id: str,
    ownership_state: str | None,
    source: str,
    confidence: str,
    now: str,
    token_count: int | None = None,
) -> None:
    existing_result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == profile_id,
            PlayerCollectionSnapshot.catalog_item_id == catalog_item_id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is None:
        snap = PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            catalog_item_id=catalog_item_id,
            ownership_state=ownership_state or "unknown",
            token_count=token_count,
            source=source,
            confidence=confidence,
            last_synced_at=now,
            updated_at=now,
        )
        session.add(snap)
        return

    # Only upgrade ownership, never downgrade (have stays have)
    if ownership_state == "have" and existing.ownership_state != "have":
        existing.ownership_state = "have"
        existing.confidence = confidence
    if token_count is not None:
        existing.token_count = token_count
    existing.source = source
    existing.last_synced_at = now
    existing.updated_at = now


async def _upsert_state(
    session: AsyncSession,
    goal: CollectionGoal,
    user_id: str,
    new_state: str,
    now: str,
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
        new_row = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal.id,
            user_id=user_id,
            static_group_id=goal.static_group_id,
            state=new_state,
            source="plugin",
            last_synced_at=now,
            updated_at=now,
        )
        session.add(new_row)
        return True, False

    # Manual "Pass" is protected — plugin must not overwrite it
    if existing.state == "pass" and existing.source == "manual":
        return False, True

    # Already confirmed from plugin — just refresh timestamp
    if existing.state == new_state and existing.source == "plugin":
        existing.last_synced_at = now
        return False, False

    existing.state = new_state
    existing.source = "plugin"
    existing.last_synced_at = now
    existing.updated_at = now
    return True, False


async def _update_token_count(
    session: AsyncSession,
    goal: CollectionGoal,
    user_id: str,
    count: int,
    now: str,
) -> bool:
    """Update token count for a participant. Returns True if the count changed."""
    existing_result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user_id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is None:
        new_row = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal.id,
            user_id=user_id,
            static_group_id=goal.static_group_id,
            state="want",
            source="plugin",
            token_count=count,
            last_synced_at=now,
            updated_at=now,
        )
        session.add(new_row)
        return True

    if existing.token_count == count:
        return False

    existing.token_count = count
    existing.last_synced_at = now
    existing.updated_at = now
    return True
