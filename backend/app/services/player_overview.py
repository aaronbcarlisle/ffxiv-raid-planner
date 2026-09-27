"""Service for the Player Hub "Needs you" overview (PH2).

`build_player_overview` returns the caller's per-static summaries, scoped to
exactly the statics `get_user_static_groups` returns (every membership role,
including viewer). Linked-only statics (a `SnapshotPlayer.user_id` link with
no membership) are never queried here.

The summaries (`statics`) and the action items (`rsvp_pending`, `loot_priority`)
share one set of batched loads — the static-id set, active tiers, sessions +
exceptions + the caller's RSVPs, active-tier players, the earned ledger, the
material log and the loot log — computed once per request in `_load_context`,
filtered by `.in_()` over the static-id set rather than looped per static, so
the query count stays fixed regardless of how many statics the caller
belongs to (R-PH2-D). The builders below only read the `_OverviewContext`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import structlog
from pydantic import ValidationError
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    LootLogEntry,
    MaterialLogEntry,
    MemberRole,
    PageLedgerEntry,
    ScheduleException,
    ScheduleRsvp,
    ScheduleSession,
    SnapshotPlayer,
    StaticGroup,
    TierSnapshot,
)
from ..models.membership import Membership
from ..permissions import get_user_static_groups
from ..schemas.player_overview import (
    OverviewActionItem,
    OverviewNextSession,
    OverviewStatic,
    PlayerOverviewResponse,
)
from .loot_context import (
    TIER_FLOOR_NAMES,
    calculate_week_number,
    effective_priority_settings,
    material_entry_to_priority_dict,
    player_to_priority_dict,
    tier_floor_names,
)
from .priority_calculator import (
    FLOOR_UPGRADE_MATERIALS,
    calculate_floor_priority,
    get_effective_priority_mode,
)
from .recurrence import OccurrenceSpec, next_occurrence

logger = structlog.get_logger(__name__)

# The `rsvp_pending` window: `now < start <= now + RSVP_WINDOW` (R-PH2-F).
RSVP_WINDOW = timedelta(days=7)

# Floors whose drops the calculator models; floor 4 (the weapon) is skipped
# because this port omits the per-job weapon priority lists the calculator
# needs for it (`loot_context.py` carries no weapon-priority equivalent) (R-PH2-G).
_LOOT_FLOORS = (1, 2, 3)

# Must match frontend/src/utils/lootFairness.ts RING_SLOTS: a ring drop counts as
# logged when a row for any of these slots exists at the week and floor.
_RING_SLOTS = frozenset({"ring", "ring1", "ring2"})

# Display labels for the calculator's drop keys (R-PH2-G).
_DROP_LABELS: dict[str, str] = {
    "earring": "Earring",
    "necklace": "Necklace",
    "bracelet": "Bracelet",
    "ring": "Ring",
    "head": "Head",
    "hands": "Hands",
    "feet": "Feet",
    "body": "Body",
    "legs": "Legs",
    "glaze": "Glaze",
    "twine": "Twine",
    "solvent": "Solvent",
    "universal_tomestone": "Universal Tomestone",
}

_MAX_LISTED_DROPS = 3


@dataclass
class _OverviewContext:
    """Batched, static-id-scoped data for one request, computed once by `_load_context`."""

    now: datetime
    user_id: str
    groups_and_memberships: list[tuple[StaticGroup, Membership]]
    active_tier_by_static_id: dict[str, TierSnapshot] = field(default_factory=dict)
    sessions_by_static_id: dict[str, list[ScheduleSession]] = field(default_factory=dict)
    exceptions_by_session_id: dict[str, list[ScheduleException]] = field(default_factory=dict)
    players_by_tier_id: dict[str, list[SnapshotPlayer]] = field(default_factory=dict)
    week_by_tier_id: dict[str, int] = field(default_factory=dict)
    earned_floors_by_tier_id: dict[str, set[str]] = field(default_factory=dict)
    # Session ids the caller has any RSVP row for (status irrelevant, R-PH2-F).
    rsvp_session_ids: set[str] = field(default_factory=set)
    # The whole material log of each active tier (the calculator's input).
    material_log_by_tier_id: dict[str, list[MaterialLogEntry]] = field(default_factory=dict)
    # Active tiers with >= 1 loot-log row in any week (the enhanced-scoring gate).
    tier_ids_with_loot_log: set[str] = field(default_factory=set)
    # Loot-log rows at each active tier's current week (the "logged" check).
    week_loot_by_tier_id: dict[str, list[LootLogEntry]] = field(default_factory=dict)


def _parse_occurrence_start(value: str, *, session_id: str) -> datetime | None:
    """Parse an occurrence's `start_time` to an aware UTC datetime.

    A naive value is read as UTC. A value that doesn't parse is skipped (a
    session's stored `start_time`/`override_start_time` is an unvalidated
    string, `schemas/schedule.py:74,165`) rather than raised, so a single bad
    row can never 500 the endpoint. Shared by `nextSession` and (Task 2)
    `rsvp_pending`.
    """
    try:
        parsed = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        logger.warning(
            "player_overview_unparseable_occurrence_start",
            session_id=session_id,
            value=value,
        )
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


async def _load_context(session: AsyncSession, user_id: str, now: datetime) -> _OverviewContext:
    """Batch-load everything the summaries (and Task 2's action items) need.

    Every query below is filtered by `.in_()` over the caller's static-id set,
    never looped per static, so the statement count is the same for one
    static as for many (R-PH2-D).
    """
    groups_and_memberships = await get_user_static_groups(session, user_id)
    ctx = _OverviewContext(now=now, user_id=user_id, groups_and_memberships=groups_and_memberships)

    static_ids = [group.id for group, _membership in groups_and_memberships]
    ctx.sessions_by_static_id = {sid: [] for sid in static_ids}
    if not static_ids:
        return ctx

    tiers_result = await session.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id.in_(static_ids),
            TierSnapshot.is_active.is_(True),
        )
    )
    active_tiers = list(tiers_result.scalars().all())
    ctx.active_tier_by_static_id = {tier.static_group_id: tier for tier in active_tiers}
    active_tier_ids = [tier.id for tier in active_tiers]
    ctx.week_by_tier_id = {tier.id: calculate_week_number(tier) for tier in active_tiers}

    sessions_result = await session.execute(
        select(ScheduleSession).where(ScheduleSession.static_group_id.in_(static_ids))
    )
    all_sessions = list(sessions_result.scalars().all())
    for sess in all_sessions:
        ctx.sessions_by_static_id.setdefault(sess.static_group_id, []).append(sess)

    session_ids = [sess.id for sess in all_sessions]
    if session_ids:
        exceptions_result = await session.execute(
            select(ScheduleException).where(ScheduleException.session_id.in_(session_ids))
        )
        for exc in exceptions_result.scalars().all():
            ctx.exceptions_by_session_id.setdefault(exc.session_id, []).append(exc)

        rsvp_result = await session.execute(
            select(ScheduleRsvp.session_id).where(
                ScheduleRsvp.session_id.in_(session_ids),
                ScheduleRsvp.user_id == user_id,
            )
        )
        ctx.rsvp_session_ids = set(rsvp_result.scalars().all())

    if active_tier_ids:
        players_result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.tier_snapshot_id.in_(active_tier_ids))
        )
        for player in players_result.scalars().all():
            ctx.players_by_tier_id.setdefault(player.tier_snapshot_id, []).append(player)

        ctx.earned_floors_by_tier_id = {tier_id: set() for tier_id in active_tier_ids}
        ledger_result = await session.execute(
            select(PageLedgerEntry).where(
                PageLedgerEntry.tier_snapshot_id.in_(active_tier_ids),
                PageLedgerEntry.transaction_type == "earned",
            )
        )
        for entry in ledger_result.scalars().all():
            if entry.week_number == ctx.week_by_tier_id.get(entry.tier_snapshot_id):
                ctx.earned_floors_by_tier_id.setdefault(entry.tier_snapshot_id, set()).add(entry.floor)

        material_result = await session.execute(
            select(MaterialLogEntry).where(MaterialLogEntry.tier_snapshot_id.in_(active_tier_ids))
        )
        for material in material_result.scalars().all():
            ctx.material_log_by_tier_id.setdefault(material.tier_snapshot_id, []).append(material)

        logged_tiers_result = await session.execute(
            select(LootLogEntry.tier_snapshot_id)
            .where(LootLogEntry.tier_snapshot_id.in_(active_tier_ids))
            .distinct()
        )
        ctx.tier_ids_with_loot_log = set(logged_tiers_result.scalars().all())

        # One statement for every tier's current-week rows: an OR of
        # (tier, week) pairs rather than a query per tier (R-PH2-D).
        week_loot_result = await session.execute(
            select(LootLogEntry).where(
                or_(
                    *[
                        and_(
                            LootLogEntry.tier_snapshot_id == tier_id,
                            LootLogEntry.week_number == week,
                        )
                        for tier_id, week in ctx.week_by_tier_id.items()
                    ]
                )
            )
        )
        for loot in week_loot_result.scalars().all():
            ctx.week_loot_by_tier_id.setdefault(loot.tier_snapshot_id, []).append(loot)

    return ctx


def _next_occurrence_for(ctx: _OverviewContext, sess: ScheduleSession) -> OccurrenceSpec | None:
    """`next_occurrence(after=now)` for one session with its exceptions applied."""
    exceptions_map = {
        exc.occurrence_date: exc for exc in ctx.exceptions_by_session_id.get(sess.id, [])
    }
    return next_occurrence(
        sess.start_time,
        sess.end_time,
        sess.recurrence_rule if sess.is_recurring else None,
        after=ctx.now,
        exceptions=exceptions_map,
        session_title=sess.title,
        timezone_name=sess.timezone,
    )


def _compute_next_session(ctx: _OverviewContext, static_id: str) -> OverviewNextSession | None:
    """The earliest `next_occurrence(after=now)` over all of a static's sessions.

    Every session counts regardless of `track_availability` (R-PH2-E); a
    `None` occurrence, one whose `start_time` doesn't parse, or one an edited
    override moved to or before `now` is skipped.
    """
    best_start: datetime | None = None
    best_session: ScheduleSession | None = None
    best_title = ""

    for sess in ctx.sessions_by_static_id.get(static_id, []):
        occ = _next_occurrence_for(ctx, sess)
        if occ is None:
            continue
        parsed = _parse_occurrence_start(occ.start_time, session_id=sess.id)
        if parsed is None:
            continue
        # An `edited` override can move an occurrence before `now`: recurrence
        # filters on the original slot, then applies `override_start_time`.
        if parsed <= ctx.now:
            continue
        if best_start is None or parsed < best_start:
            best_start = parsed
            best_session = sess
            best_title = occ.title

    if best_start is None or best_session is None:
        return None
    return OverviewNextSession(
        session_id=best_session.id,
        title=best_title,
        starts_at=best_start.isoformat(),
    )


def _compute_floors_cleared(ctx: _OverviewContext, active_tier: TierSnapshot | None) -> int | None:
    """Distinct known tier floors (`TIER_FLOOR_NAMES`) with an `earned` ledger row at the current week.

    `None` unless the active tier is a savage tier whose `tier_id` is a known
    key of `TIER_FLOOR_NAMES` (director F12: the generic `F1S…` fallback never
    matches a logged floor name). The ledger accepts any floor string, so an
    unknown floor never counts.
    """
    if active_tier is None:
        return None
    if active_tier.content_type != "savage":
        return None
    if active_tier.tier_id not in TIER_FLOOR_NAMES:
        return None
    known_floors = set(TIER_FLOOR_NAMES[active_tier.tier_id])
    return len(ctx.earned_floors_by_tier_id.get(active_tier.id, set()) & known_floors)


def _compute_avg_bis_pct(ctx: _OverviewContext, active_tier: TierSnapshot | None) -> int | None:
    """`round(100 × obtained / total)` under `bisSlotTotals`' rule (rosterReadiness.ts).

    The active roster is configured and not a substitute; a BiS slot has a
    non-null `bisSource`; obtained means `hasItem`. `None` when there is no
    active tier or no BiS slots at all.
    """
    if active_tier is None:
        return None

    obtained = 0
    total = 0
    for player in ctx.players_by_tier_id.get(active_tier.id, []):
        if not player.configured or player.is_substitute:
            continue
        for slot in player.gear or []:
            if slot.get("bisSource") is None:
                continue
            total += 1
            if slot.get("hasItem"):
                obtained += 1

    if total == 0:
        return None
    # Python's round() is banker's rounding; floor(x + 0.5) matches JS Math.round.
    return math.floor((100 * obtained / total) + 0.5)


def _build_rsvp_items(
    ctx: _OverviewContext, group: StaticGroup, membership: Membership
) -> list[tuple[datetime, OverviewActionItem]]:
    """`rsvp_pending` items for one static, each paired with its parsed start (R-PH2-F).

    Viewers never RSVP, and neither do sessions with `track_availability` off.
    An item needs the next occurrence to fall in `now < start <= now + 7 days`
    (both bounds explicit: an `edited` override can move the next occurrence
    into the past or past the window) and no RSVP row by the caller, of any
    status, on the series.
    """
    if membership.role == MemberRole.VIEWER.value:
        return []

    window_end = ctx.now + RSVP_WINDOW
    items: list[tuple[datetime, OverviewActionItem]] = []
    for sess in ctx.sessions_by_static_id.get(group.id, []):
        if not sess.track_availability:
            continue
        if sess.id in ctx.rsvp_session_ids:
            continue
        occ = _next_occurrence_for(ctx, sess)
        if occ is None:
            continue
        start = _parse_occurrence_start(occ.start_time, session_id=sess.id)
        if start is None:
            continue
        if not (ctx.now < start <= window_end):
            continue
        items.append(
            (
                start,
                OverviewActionItem(
                    type="rsvp_pending",
                    static_id=group.id,
                    static_name=group.name,
                    title=f"RSVP for {occ.title}",
                    detail="No response yet",
                    href=f"/group/{group.share_code}?tab=schedule&sessionId={sess.id}",
                    starts_at=start.isoformat(),
                ),
            )
        )
    return items


def _is_drop_logged(
    key: str,
    *,
    is_material: bool,
    floor_name: str,
    week_loot: list[LootLogEntry],
    week_materials: list[MaterialLogEntry],
) -> bool:
    """The `utils/lootFairness.ts:30-44` rule: any row of any method at (week, floor, drop)."""
    if is_material:
        return any(e.floor == floor_name and e.material_type == key for e in week_materials)
    if key == "ring":
        return any(e.floor == floor_name and e.item_slot in _RING_SLOTS for e in week_loot)
    return any(e.floor == floor_name and e.item_slot == key for e in week_loot)


def _build_loot_item(ctx: _OverviewContext, group: StaticGroup) -> OverviewActionItem | None:
    """The `loot_priority` item for one static, or `None` (R-PH2-G).

    The Hub claims "#1" only where this ranking must match the Loot tab's
    Queues view: savage tier with a known `tier_id`, the client-effective
    settings, no enhanced scoring in effect, not disabled / manual-planning,
    floors 1-3 only, the caller strictly first, and the drop unlogged this week.
    """
    tier = ctx.active_tier_by_static_id.get(group.id)
    if tier is None or tier.content_type != "savage" or tier.tier_id not in TIER_FLOOR_NAMES:
        return None

    roster = sorted(
        (p for p in ctx.players_by_tier_id.get(tier.id, []) if p.configured and not p.is_substitute),
        key=lambda p: p.sort_order,
    )
    caller_player_ids = {p.id for p in roster if p.user_id == ctx.user_id}
    if not caller_player_ids:
        return None

    try:
        effective = effective_priority_settings(group.settings)
    except ValidationError as exc:
        # A blob the static-group response itself could not serialize; never 500 the Hub over it.
        logger.warning("player_overview_invalid_settings_blob", static_id=group.id, error=str(exc))
        return None

    if get_effective_priority_mode(effective) in ("disabled", "manual-planning"):
        return None
    # The Loot tab's condition: enableEnhancedScoring === true && lootLog.length > 0.
    if effective.get("enableEnhancedScoring") is True and tier.id in ctx.tier_ids_with_loot_log:
        return None

    players = [player_to_priority_dict(p) for p in roster]
    material_rows = ctx.material_log_by_tier_id.get(tier.id, [])
    material_log = [material_entry_to_priority_dict(e) for e in material_rows]
    week = ctx.week_by_tier_id[tier.id]
    week_loot = ctx.week_loot_by_tier_id.get(tier.id, [])
    week_materials = [e for e in material_rows if e.week_number == week]
    floor_names = tier_floor_names(tier.tier_id)

    drops: list[str] = []
    for floor in _LOOT_FLOORS:
        floor_name = floor_names[floor - 1]
        material_keys = FLOOR_UPGRADE_MATERIALS.get(floor, [])
        ranking = calculate_floor_priority(players, floor, effective, material_log)
        for key, entries in ranking.items():
            if not entries:
                continue
            if entries[0]["playerId"] not in caller_player_ids:
                continue
            # Strictly first: a tie is not #1 (the tie order need not match the Loot tab).
            if len(entries) > 1 and entries[1]["score"] >= entries[0]["score"]:
                continue
            if _is_drop_logged(
                key,
                is_material=key in material_keys,
                floor_name=floor_name,
                week_loot=week_loot,
                week_materials=week_materials,
            ):
                continue
            drops.append(f"{floor_name} {_DROP_LABELS.get(key, key)}")

    if not drops:
        return None

    count = len(drops)
    detail = " · ".join(drops[:_MAX_LISTED_DROPS])
    if count > _MAX_LISTED_DROPS:
        detail += f" · +{count - _MAX_LISTED_DROPS} more"
    noun = "drop" if count == 1 else "drops"
    return OverviewActionItem(
        type="loot_priority",
        static_id=group.id,
        static_name=group.name,
        title=f"You're first in line for {count} {noun}",
        detail=detail,
        href=f"/group/{group.share_code}?tab=gear",
        starts_at=None,
    )


async def build_player_overview(
    session: AsyncSession, user_id: str, now: datetime
) -> PlayerOverviewResponse:
    """Build the caller's Player Hub overview: per-static summaries + action items.

    `now` must be timezone-aware UTC. Action items are `rsvp_pending` by
    start ascending, then `loot_priority` by static name, case-insensitive,
    with no cap (R-PH2-H).
    """
    ctx = await _load_context(session, user_id, now)

    statics: list[OverviewStatic] = []
    rsvp_items: list[tuple[datetime, OverviewActionItem]] = []
    loot_items: list[OverviewActionItem] = []
    for group, membership in ctx.groups_and_memberships:
        active_tier = ctx.active_tier_by_static_id.get(group.id)
        statics.append(
            OverviewStatic(
                id=group.id,
                share_code=group.share_code,
                name=group.name,
                role=membership.role,
                tier_id=active_tier.tier_id if active_tier else None,
                member_count=group.member_count,
                next_session=_compute_next_session(ctx, group.id),
                floors_cleared=_compute_floors_cleared(ctx, active_tier),
                avg_bis_pct=_compute_avg_bis_pct(ctx, active_tier),
            )
        )
        rsvp_items.extend(_build_rsvp_items(ctx, group, membership))
        loot_item = _build_loot_item(ctx, group)
        if loot_item is not None:
            loot_items.append(loot_item)

    rsvp_items.sort(key=lambda pair: pair[0])
    loot_items.sort(key=lambda item: item.static_name.casefold())
    action_items = [item for _start, item in rsvp_items] + loot_items

    return PlayerOverviewResponse(statics=statics, action_items=action_items)
