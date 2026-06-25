"""
Collection suggestion service.

Computes smart farm suggestions for a static group by combining:
  - Active CollectionGoals (what the static is/wants to farm)
  - PlayerCollectionSnapshot (factual ownership: have/missing/unknown)
  - PlayerCollectionIntent (hunting/interested/pass/hidden + visibility)
  - RewardParticipantState (existing manual/plugin states for goals)
  - Token counts and costs (can-buy detection)

Outputs are computed on-demand — nothing is stored. The service only reads
static_only and dossier_public intents; private intents are never consulted.

Scoring weights are declared as a single config dict so they can be tuned
without touching component code.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.collection_goal import CollectionGoal
from ..models.membership import Membership, MemberRole
from ..models.player_collection_intent import PlayerCollectionIntent
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile
from ..models.reward_participant_state import RewardParticipantState
from ..models.user import User
from ..schemas.player_collection import MemberSuggestionEntry, StaticCollectionSuggestion
from .legacy_mount_farm_bridge import LegacyFarmSignal, get_legacy_farm_signals

# ── Scoring weights ────────────────────────────────────────────────────────────
# Single place to tune — never hardcoded in callers or UI.

SUGGESTION_WEIGHTS: dict[str, float] = {
    "hunting_intent":        50.0,
    "legacy_wants_mount":    35.0,  # wants_mount=True in MountFarmProgress (lower than explicit intent)
    "missing_from_snapshot": 40.0,
    "active_static_goal":    30.0,
    "can_buy_soon":          25.0,
    "high_priority_intent":  20.0,
    "fresh_sync":            10.0,
    "pass_or_hidden":       -50.0,
    "stale_or_unknown":     -20.0,
    "manual_only":          -10.0,
}

STALE_DAYS = 7
CAN_BUY_FRACTION = 0.8  # token_count >= max(1, token_cost * 0.8) → "can buy soon"


def _is_stale(last_synced_at: str | None) -> bool:
    if not last_synced_at:
        return True
    try:
        synced = datetime.fromisoformat(last_synced_at)
        if synced.tzinfo is None:
            synced = synced.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - synced > timedelta(days=STALE_DAYS)
    except ValueError:
        return True


def _score_member(
    *,
    snapshot: PlayerCollectionSnapshot | None,
    intent: PlayerCollectionIntent | None,
    participant: RewardParticipantState | None,
    legacy: LegacyFarmSignal | None,
    token_cost: int | None,
) -> tuple[float, list[str]]:
    """Return (score_delta, reasons[]) for one member against one catalog item.

    Priority order for authority:
      intent > legacy wants_mount (intent is explicit; legacy is implicit static-scoped)
      snapshot > legacy has_mount / totem_count (snapshot from plugin is higher confidence)
    """
    score = 0.0
    reasons: list[str] = []
    w = SUGGESTION_WEIGHTS

    # ── Explicit intent (highest authority) ───────────────────────────────────
    if intent is not None:
        if intent.intent == "hunting":
            score += w["hunting_intent"]
            reasons.append("Hunting")
            if intent.priority == "high":
                score += w["high_priority_intent"]
                reasons.append("High priority")
        elif intent.intent == "interested":
            reasons.append("Interested")
        elif intent.intent in ("pass", "hidden"):
            score += w["pass_or_hidden"]
            reasons.append("Pass" if intent.intent == "pass" else "Hidden")
            return score, reasons  # short-circuit
    elif legacy is not None:
        # No explicit intent — fall back to legacy wants_mount signal.
        # wants_mount=True: positive hunting signal.
        # wants_mount=False is filtered out in get_legacy_farm_signals so never reaches here.
        if legacy.wants_mount and not legacy.has_mount:
            score += w["legacy_wants_mount"]
            reasons.append("Hunting (legacy)")

    # ── Factual snapshot ──────────────────────────────────────────────────────
    if snapshot is not None:
        if snapshot.ownership_state == "have":
            reasons.append("Have")
            return score, reasons
        if snapshot.ownership_state == "missing":
            score += w["missing_from_snapshot"]
            reasons.append("Missing")
        else:
            score += w["stale_or_unknown"]
            reasons.append("Unknown ownership")

        if snapshot.source == "plugin":
            if not _is_stale(snapshot.last_synced_at):
                score += w["fresh_sync"]
                reasons.append("Synced")
            else:
                score += w["stale_or_unknown"]
                reasons.append("Stale sync")
        else:
            score += w["manual_only"]
            reasons.append("Manual")

        # Can-buy from snapshot token_count (plugin is most authoritative)
        if token_cost and snapshot.token_count is not None:
            if snapshot.token_count >= token_cost:
                score += w["can_buy_soon"]
                reasons.append("Can buy")
            elif snapshot.token_count >= max(1, int(token_cost * CAN_BUY_FRACTION)):
                score += w["can_buy_soon"] * 0.5
                reasons.append("Almost can buy")

    elif legacy is not None:
        # No snapshot — use legacy ownership/token data
        if legacy.has_mount:
            reasons.append("Have (legacy)")
            return score, reasons
        # Missing (participating in the farm, doesn't have it yet)
        score += w["missing_from_snapshot"] * 0.6  # lower confidence than plugin snapshot
        reasons.append("Missing (legacy)")
        score += w["manual_only"]

        # Can-buy from legacy totem_count
        eff_cost = legacy.totem_cost or token_cost
        if eff_cost and legacy.totem_count > 0:
            if legacy.totem_count >= eff_cost:
                score += w["can_buy_soon"]
                reasons.append("Can buy (legacy)")
            elif legacy.totem_count >= max(1, int(eff_cost * CAN_BUY_FRACTION)):
                score += w["can_buy_soon"] * 0.5
                reasons.append("Almost can buy (legacy)")

    elif participant is not None:
        # Fall back to RewardParticipantState when no snapshot or legacy data
        if participant.state == "have":
            reasons.append("Have (manual)")
            return score, reasons
        if participant.state == "pass":
            score += w["pass_or_hidden"]
            reasons.append("Pass (manual)")
            return score, reasons
        if participant.state in ("need", "want"):
            score += w["missing_from_snapshot"] * 0.6
            reasons.append(f"{participant.state.capitalize()} (manual)")
        if not _is_stale(participant.last_synced_at):
            score += w["fresh_sync"]
        score += w["manual_only"]

        if token_cost and participant.token_count is not None:
            if participant.token_count >= token_cost:
                score += w["can_buy_soon"]
                reasons.append("Can buy")
    else:
        # No data at all — unknown, penalise gently
        score += w["stale_or_unknown"]
        reasons.append("No data")

    return score, reasons


async def compute_suggestions(
    session: AsyncSession,
    static_group_id: str,
    requesting_user: User,
    *,
    only_active: bool = True,
) -> list[StaticCollectionSuggestion]:
    """
    Compute smart farm suggestions for a static group.

    Intent-first: candidate catalog items come from opted-in PlayerCollectionIntent
    rows (static_only / dossier_public) across all roster members, PLUS any items
    referenced by active CollectionGoals. This means suggestions appear even when
    no CollectionGoal has been manually created yet.

    Visibility contract:
      - Only static_only and dossier_public intents are read.
      - private intents are never accessed.
      - token_count included only when intent visibility is static_only/dossier_public.

    Returns a list sorted by descending suggested_farm_score.
    """
    # ── Members ────────────────────────────────────────────────────────────────
    member_result = await session.execute(
        select(Membership.user_id).where(
            Membership.static_group_id == static_group_id,
            Membership.role != MemberRole.VIEWER,
        )
    )
    member_user_ids = [r[0] for r in member_result.all()]
    if not member_user_ids:
        return []

    # ── User display names ─────────────────────────────────────────────────────
    users_result = await session.execute(
        select(User).where(User.id.in_(member_user_ids))
    )
    user_map: dict[str, User] = {u.id: u for u in users_result.scalars().all()}

    # ── Profiles (user → profile) ──────────────────────────────────────────────
    profiles_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id.in_(member_user_ids))
    )
    profile_map: dict[str, PlayerProfile] = {}
    profile_by_user: dict[str, str] = {}  # user_id → profile_id
    for p in profiles_result.scalars().all():
        profile_map[p.id] = p
        profile_by_user[p.user_id] = p.id

    profile_ids = list(profile_map.keys())

    # ── Intents — queried first (intent-first) ─────────────────────────────────
    # Drives candidate item list even when no CollectionGoals exist.
    intent_rows: list[PlayerCollectionIntent] = []
    if profile_ids:
        intent_result = await session.execute(
            select(PlayerCollectionIntent).where(
                PlayerCollectionIntent.profile_id.in_(profile_ids),
                PlayerCollectionIntent.visibility.in_(["static_only", "dossier_public"]),
            )
        )
        intent_rows = intent_result.scalars().all()
    intent_map: dict[tuple[str, str], PlayerCollectionIntent] = {
        (i.profile_id, i.catalog_item_id): i for i in intent_rows
    }

    # ── Active collection goals ────────────────────────────────────────────────
    goal_query = select(CollectionGoal).where(
        CollectionGoal.static_group_id == static_group_id,
        CollectionGoal.catalog_item_id.isnot(None),
    )
    if only_active:
        goal_query = goal_query.where(CollectionGoal.status != "complete")
    goals_result = await session.execute(goal_query)
    goals = goals_result.scalars().all()
    # (catalog_item_id → goal) — at most one active goal per item
    goal_by_catalog: dict[str, CollectionGoal] = {
        g.catalog_item_id: g for g in goals if g.catalog_item_id
    }
    goal_ids = [g.id for g in goals]

    # ── Legacy mount farm signals (static-scoped, read-only adapter) ──────────
    # Adds MountFarmProgress data as lower-authority fallback signals.
    # Never used in dossier contexts (dossier_farm_match has its own path).
    legacy_signal_map, legacy_catalog_ids = await get_legacy_farm_signals(
        session, static_group_id, member_user_ids
    )

    # ── Candidate catalog items = intent items ∪ goal items ∪ legacy items ───
    catalog_item_ids: set[str] = {i.catalog_item_id for i in intent_rows}
    catalog_item_ids |= set(goal_by_catalog.keys())
    catalog_item_ids |= legacy_catalog_ids
    if not catalog_item_ids:
        return []

    # ── Catalog items ──────────────────────────────────────────────────────────
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.id.in_(catalog_item_ids)
        )
    )
    catalog_map: dict[str, CollectionCatalogItem] = {
        c.id: c for c in catalog_result.scalars().all()
    }

    # ── Snapshots (profile × item) ─────────────────────────────────────────────
    snapshot_rows: list[PlayerCollectionSnapshot] = []
    if profile_ids:
        snap_result = await session.execute(
            select(PlayerCollectionSnapshot).where(
                PlayerCollectionSnapshot.profile_id.in_(profile_ids),
                PlayerCollectionSnapshot.catalog_item_id.in_(catalog_item_ids),
            )
        )
        snapshot_rows = snap_result.scalars().all()
    snapshot_map: dict[tuple[str, str], PlayerCollectionSnapshot] = {
        (s.profile_id, s.catalog_item_id): s for s in snapshot_rows
    }

    # ── Participant states (for goals that exist) ──────────────────────────────
    participant_map: dict[tuple[str, str], RewardParticipantState] = {}
    if goal_ids:
        part_result = await session.execute(
            select(RewardParticipantState).where(
                RewardParticipantState.goal_id.in_(goal_ids),
                RewardParticipantState.user_id.in_(member_user_ids),
            )
        )
        participant_map = {
            (p.goal_id, p.user_id): p for p in part_result.scalars().all()
        }

    # ── Build suggestions per catalog item ────────────────────────────────────
    suggestions: list[StaticCollectionSuggestion] = []

    for item_id in catalog_item_ids:
        catalog_item = catalog_map.get(item_id)
        if not catalog_item:
            continue

        goal = goal_by_catalog.get(item_id)
        token_cost = (goal.token_cost if goal else None) or catalog_item.token_cost
        item_score = SUGGESTION_WEIGHTS["active_static_goal"] if goal else 0.0
        member_entries: list[MemberSuggestionEntry] = []

        for user_id in member_user_ids:
            profile_id = profile_by_user.get(user_id)
            snapshot = snapshot_map.get((profile_id, item_id)) if profile_id else None
            intent = intent_map.get((profile_id, item_id)) if profile_id else None
            participant = participant_map.get((goal.id, user_id)) if goal else None
            legacy = legacy_signal_map.get((user_id, item_id))
            user = user_map.get(user_id)

            member_score, reasons = _score_member(
                snapshot=snapshot,
                intent=intent,
                participant=participant,
                legacy=legacy,
                token_cost=token_cost,
            )
            item_score += member_score

            # Determine display values — snapshot > legacy > participant > unknown
            if snapshot is not None:
                ownership_state = snapshot.ownership_state
                token_count = snapshot.token_count
                confidence = snapshot.confidence
                can_buy = bool(token_cost and token_count is not None and token_count >= token_cost)
                display_intent = intent.intent if intent else None
            elif legacy is not None:
                ownership_state = "have" if legacy.has_mount else "missing"
                token_count = legacy.totem_count if legacy.totem_count > 0 else None
                confidence = "low"
                eff_cost = legacy.totem_cost or token_cost
                can_buy = bool(eff_cost and legacy.totem_count >= eff_cost)
                # Show intent from explicit intent if present, else from legacy wants_mount
                display_intent = (intent.intent if intent else ("hunting" if legacy.wants_mount else None))
            elif participant is not None:
                _pstate_map = {"have": "have", "need": "missing", "want": "missing", "pass": "have"}
                ownership_state = _pstate_map.get(participant.state, "unknown")
                token_count = participant.token_count
                confidence = "low"
                can_buy = bool(token_cost and token_count is not None and token_count >= token_cost)
                display_intent = intent.intent if intent else None
            else:
                ownership_state = "unknown"
                token_count = None
                confidence = "low"
                can_buy = False
                display_intent = intent.intent if intent else None

            member_entries.append(MemberSuggestionEntry(
                user_id=user_id,
                display_name=user.discord_username if user else None,
                ownership_state=ownership_state,
                intent=display_intent,
                token_count=token_count,
                can_buy=can_buy,
                confidence=confidence,
                reasons=reasons,
            ))

        suggestions.append(StaticCollectionSuggestion(
            catalog_item_id=item_id,
            catalog_item_name=catalog_item.name,
            catalog_item_category=catalog_item.category,
            expansion=catalog_item.expansion,
            source_duty_name=catalog_item.source_duty_name,
            source_type=catalog_item.source_type,
            static_goal_id=goal.id if goal else None,
            suggested_farm_score=round(item_score, 2),
            reason_summary=_reason_summary(member_entries),
            members=member_entries,
        ))

    suggestions.sort(key=lambda s: s.suggested_farm_score, reverse=True)
    return suggestions


def _reason_summary(members: list[MemberSuggestionEntry]) -> str:
    hunting = [m.display_name or m.user_id for m in members if m.intent == "hunting"]
    missing = [m.display_name or m.user_id for m in members if m.ownership_state == "missing" and m.intent not in ("pass", "hidden")]
    can_buy = [m.display_name or m.user_id for m in members if m.can_buy and m.ownership_state != "have"]

    parts: list[str] = []
    if hunting:
        parts.append(f"Hunting: {', '.join(hunting[:3])}")
    if missing and not hunting:
        parts.append(f"Missing: {', '.join(missing[:3])}")
    if can_buy:
        parts.append(f"Can buy: {', '.join(can_buy[:2])}")
    return " · ".join(parts) if parts else "No strong signals"


# ── Dossier farm match ─────────────────────────────────────────────────────────

async def dossier_farm_match(
    session: AsyncSession,
    static_group_id: str,
    applicant_profile_id: str,
) -> dict[str, Any]:
    """
    Match a dossier applicant's public hunting list against a static's active farms.

    Only dossier_public intents are used. Returns a match score and shared goals.
    """
    # Active goals for this static
    goals_result = await session.execute(
        select(CollectionGoal).where(
            CollectionGoal.static_group_id == static_group_id,
            CollectionGoal.status != "complete",
            CollectionGoal.catalog_item_id.isnot(None),
        )
    )
    goals = goals_result.scalars().all()
    static_item_ids = {g.catalog_item_id for g in goals if g.catalog_item_id}

    if not static_item_ids:
        return {"match_score": 0, "shared_goals": [], "reasons": []}

    # Applicant's public hunting intents
    intents_result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == applicant_profile_id,
            PlayerCollectionIntent.visibility == "dossier_public",
            PlayerCollectionIntent.intent.in_(["hunting", "interested"]),
        )
    )
    intents = intents_result.scalars().all()
    applicant_item_ids = {i.catalog_item_id for i in intents}
    intent_by_item = {i.catalog_item_id: i for i in intents}

    shared_ids = static_item_ids & applicant_item_ids
    if not shared_ids:
        return {"match_score": 0, "shared_goals": [], "reasons": []}

    # Load catalog items for names
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(CollectionCatalogItem.id.in_(shared_ids))
    )
    catalog_map = {c.id: c for c in catalog_result.scalars().all()}

    shared_goals = []
    score = 0
    reasons = []
    for item_id in shared_ids:
        item = catalog_map.get(item_id)
        intent = intent_by_item.get(item_id)
        if not item:
            continue
        weight = 2 if (intent and intent.intent == "hunting") else 1
        score += weight
        shared_goals.append({
            "catalog_item_id": item_id,
            "name": item.name,
            "category": item.category,
            "source_duty_name": item.source_duty_name,
            "applicant_intent": intent.intent if intent else "interested",
        })
        reasons.append(f"Hunting {item.name}" if (intent and intent.intent == "hunting") else f"Interested in {item.name}")

    shared_goals.sort(key=lambda x: x["applicant_intent"] == "hunting", reverse=True)

    return {
        "match_score": score,
        "shared_goals": shared_goals,
        "reasons": reasons,
    }
