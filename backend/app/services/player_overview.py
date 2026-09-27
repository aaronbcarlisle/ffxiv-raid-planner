"""Service for the Player Hub "Needs you" overview (PH2).

`build_player_overview` returns the caller's per-static summaries, scoped to
exactly the statics `get_user_static_groups` returns (every membership role,
including viewer). Linked-only statics (a `SnapshotPlayer.user_id` link with
no membership) are never queried here.

Task 1 builds the summaries (`statics`) and leaves `action_items` empty. The
batched loads below — the static-id set, active tiers, sessions + exceptions,
and active-tier players — are computed once per request in `_load_context`,
filtered by `.in_()` over the static-id set rather than looped per static, so
the query count stays fixed regardless of how many statics the caller
belongs to. Task 2's `rsvp_pending` and `loot_priority` builders take the same
`_OverviewContext` and extend `_load_context` with their own batches (RSVPs,
material log, loot log) rather than re-querying what is already here.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    PageLedgerEntry,
    ScheduleException,
    ScheduleSession,
    SnapshotPlayer,
    StaticGroup,
    TierSnapshot,
)
from ..models.membership import Membership
from ..permissions import get_user_static_groups
from ..schemas.player_overview import (
    OverviewNextSession,
    OverviewStatic,
    PlayerOverviewResponse,
)
from .loot_context import TIER_FLOOR_NAMES, calculate_week_number
from .recurrence import next_occurrence

logger = structlog.get_logger(__name__)


@dataclass
class _OverviewContext:
    """Batched, static-id-scoped data for one request, computed once by `_load_context`."""

    now: datetime
    groups_and_memberships: list[tuple[StaticGroup, Membership]]
    active_tier_by_static_id: dict[str, TierSnapshot] = field(default_factory=dict)
    sessions_by_static_id: dict[str, list[ScheduleSession]] = field(default_factory=dict)
    exceptions_by_session_id: dict[str, list[ScheduleException]] = field(default_factory=dict)
    players_by_tier_id: dict[str, list[SnapshotPlayer]] = field(default_factory=dict)
    week_by_tier_id: dict[str, int] = field(default_factory=dict)
    earned_floors_by_tier_id: dict[str, set[str]] = field(default_factory=dict)


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
    ctx = _OverviewContext(now=now, groups_and_memberships=groups_and_memberships)

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

    return ctx


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
        exceptions_map = {
            exc.occurrence_date: exc for exc in ctx.exceptions_by_session_id.get(sess.id, [])
        }
        occ = next_occurrence(
            sess.start_time,
            sess.end_time,
            sess.recurrence_rule if sess.is_recurring else None,
            after=ctx.now,
            exceptions=exceptions_map,
            session_title=sess.title,
            timezone_name=sess.timezone,
        )
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


async def build_player_overview(
    session: AsyncSession, user_id: str, now: datetime
) -> PlayerOverviewResponse:
    """Build the caller's Player Hub overview: per-static summaries + action items.

    `now` must be timezone-aware UTC. Task 1 leaves `action_items` empty;
    Task 2 populates it from the same `_OverviewContext`.
    """
    ctx = await _load_context(session, user_id, now)

    statics: list[OverviewStatic] = []
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

    return PlayerOverviewResponse(statics=statics, action_items=[])
