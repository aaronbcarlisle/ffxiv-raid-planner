"""Tests for GET /api/player/overview and services.player_overview.build_player_overview."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MemberRole
from app.services.loot_context import calculate_week_number
from app.services.player_overview import build_player_overview
from tests.factories import (
    create_loot_log_entry,
    create_material_log_entry,
    create_membership,
    create_page_ledger_entry,
    create_schedule_exception,
    create_schedule_rsvp,
    create_schedule_session,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=timezone.utc)


def _gear_slot(slot: str, *, bis_source: str | None = "raid", has_item: bool = False) -> dict:
    return {"slot": slot, "bisSource": bis_source, "hasItem": has_item}


# ==================== Route-level ====================


async def test_overview_requires_auth(client):
    response = await client.get("/api/player/overview")
    assert response.status_code == 401


async def test_overview_route_returns_camel_case_wire_json(
    client, session: AsyncSession, test_user,
):
    # The route builds its own `now` from the real clock, so this session's
    # start must be relative to the real clock rather than the fixed NOW used
    # by the service-level tests below.
    real_now = datetime.now(timezone.utc)
    group = await create_static_group(session, test_user, name="Wire Static")
    tier = await create_tier_snapshot(session, group)
    sched = await create_schedule_session(
        session, group, test_user,
        start_time=(real_now + timedelta(days=1)).isoformat(),
        end_time=(real_now + timedelta(days=1, hours=2)).isoformat(),
    )
    await session.commit()

    response = await client.get("/api/player/overview", headers=_auth_headers(test_user))
    assert response.status_code == 200
    body = response.json()
    assert "statics" in body and "actionItems" in body
    row = body["statics"][0]
    assert "shareCode" in row and row["shareCode"] == group.share_code
    assert "tierId" in row and row["tierId"] == tier.tier_id
    assert row["nextSession"]["startsAt"]
    assert "sessionId" in row["nextSession"]
    assert row["nextSession"]["sessionId"] == sched.id


def _auth_headers(user) -> dict[str, str]:
    from app.auth_utils import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ==================== Scoping (R-PH2-A) ====================


async def test_overview_only_includes_caller_memberships(session: AsyncSession):
    caller = await create_user(session, discord_username="caller")
    other_user = await create_user(session, discord_username="other")

    own_group = await create_static_group(session, caller, name="Mine")

    # Another user's static, unrelated to the caller.
    other_group = await create_static_group(session, other_user, name="Not Mine")
    other_tier = await create_tier_snapshot(session, other_group)
    await create_schedule_session(session, other_group, other_user)

    # A linked-only static: the caller is a SnapshotPlayer.user_id link, no membership.
    linked_group = await create_static_group(session, other_user, name="Linked Only")
    linked_tier = await create_tier_snapshot(session, linked_group)
    linked_player = await create_snapshot_player(session, linked_tier, name="CallerChar")
    linked_player.user_id = caller.id
    await session.flush()

    # A viewer membership on a third static.
    viewer_group = await create_static_group(session, other_user, name="Viewer Static")
    await create_membership(session, caller, viewer_group, role=MemberRole.VIEWER)

    result = await build_player_overview(session, caller.id, NOW)
    ids = {s.id for s in result.statics}
    assert own_group.id in ids
    assert viewer_group.id in ids
    assert other_group.id not in ids
    assert linked_group.id not in ids

    viewer_row = next(s for s in result.statics if s.id == viewer_group.id)
    assert viewer_row.role == "viewer"

    # Sanity: nothing about the excluded statics leaked in.
    assert other_tier.id not in {s.tier_id for s in result.statics if s.tier_id}
    assert linked_tier.id not in {s.tier_id for s in result.statics if s.tier_id}


async def test_overview_member_count(session: AsyncSession):
    caller = await create_user(session, discord_username="caller")
    member2 = await create_user(session, discord_username="member2")
    group = await create_static_group(session, caller)
    await create_membership(session, member2, group, role=MemberRole.MEMBER)

    result = await build_player_overview(session, caller.id, NOW)
    row = result.statics[0]
    assert row.member_count == 2


# ==================== tierId / no-tier nulls (R-PH2-E) ====================


async def test_overview_tier_id_from_active_tier_only(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    await create_tier_snapshot(session, group, tier_id="aac-cruiserweight", is_active=False)
    active = await create_tier_snapshot(session, group, tier_id="aac-heavyweight", is_active=True)

    result = await build_player_overview(session, caller.id, NOW)
    row = result.statics[0]
    assert row.tier_id == active.tier_id


async def test_overview_no_tier_nulls_summary_fields(session: AsyncSession):
    caller = await create_user(session)
    await create_static_group(session, caller)

    result = await build_player_overview(session, caller.id, NOW)
    row = result.statics[0]
    assert row.tier_id is None
    assert row.floors_cleared is None
    assert row.avg_bis_pct is None


# ==================== nextSession (R-PH2-E, parsing) ====================


async def test_next_session_one_off_future(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    sched = await create_schedule_session(
        session, group, caller,
        title="Prog Night",
        start_time=(NOW + timedelta(days=2)).isoformat(),
        end_time=(NOW + timedelta(days=2, hours=2)).isoformat(),
    )

    result = await build_player_overview(session, caller.id, NOW)
    next_sess = result.statics[0].next_session
    assert next_sess is not None
    assert next_sess.session_id == sched.id
    assert next_sess.title == "Prog Night"
    assert next_sess.starts_at == (NOW + timedelta(days=2)).isoformat()


async def test_next_session_past_one_off_is_null(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    await create_schedule_session(
        session, group, caller,
        start_time=(NOW - timedelta(days=2)).isoformat(),
        end_time=(NOW - timedelta(days=2, hours=-2)).isoformat(),
    )

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].next_session is None


async def test_next_session_weekly_series_two_weeks_before_now(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    base_start = NOW - timedelta(days=14)
    await create_schedule_session(
        session, group, caller,
        title="Weekly Raid",
        start_time=base_start.isoformat(),
        end_time=(base_start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="RRULE:FREQ=WEEKLY",
    )

    result = await build_player_overview(session, caller.id, NOW)
    next_sess = result.statics[0].next_session
    assert next_sess is not None
    assert next_sess.starts_at == (NOW + timedelta(days=7)).isoformat()


async def test_next_session_cancelled_occurrence_falls_to_next(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    base_start = NOW - timedelta(days=14)
    sched = await create_schedule_session(
        session, group, caller,
        start_time=base_start.isoformat(),
        end_time=(base_start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="RRULE:FREQ=WEEKLY",
    )
    first_occurrence = NOW + timedelta(days=7)
    await create_schedule_exception(
        session, sched, caller,
        occurrence_date=first_occurrence.date().isoformat(),
        type="cancelled",
    )

    result = await build_player_overview(session, caller.id, NOW)
    next_sess = result.statics[0].next_session
    assert next_sess is not None
    assert next_sess.starts_at == (NOW + timedelta(days=14)).isoformat()


async def test_next_session_picks_earlier_of_two(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    later = await create_schedule_session(
        session, group, caller,
        title="Later",
        start_time=(NOW + timedelta(days=5)).isoformat(),
        end_time=(NOW + timedelta(days=5, hours=2)).isoformat(),
    )
    earlier = await create_schedule_session(
        session, group, caller,
        title="Earlier",
        start_time=(NOW + timedelta(days=1)).isoformat(),
        end_time=(NOW + timedelta(days=1, hours=2)).isoformat(),
    )

    result = await build_player_overview(session, caller.id, NOW)
    next_sess = result.statics[0].next_session
    assert next_sess.session_id == earlier.id
    assert later.id != next_sess.session_id


async def test_next_session_naive_start_time_read_as_utc(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    naive_start = (NOW + timedelta(days=3)).replace(tzinfo=None)
    await create_schedule_session(
        session, group, caller,
        start_time=naive_start.isoformat(),
        end_time=(naive_start + timedelta(hours=2)).isoformat(),
    )

    result = await build_player_overview(session, caller.id, NOW)
    next_sess = result.statics[0].next_session
    assert next_sess is not None
    assert next_sess.starts_at == (NOW + timedelta(days=3)).isoformat()
    assert next_sess.starts_at.endswith("+00:00")


async def test_next_session_edited_override_before_now_is_null(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    # Weekly series whose original next occurrence (before any override) is ~now + 2 days.
    base_start = NOW - timedelta(days=5)
    sched = await create_schedule_session(
        session, group, caller,
        start_time=base_start.isoformat(),
        end_time=(base_start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="RRULE:FREQ=WEEKLY",
    )
    original_next = NOW + timedelta(days=2)
    await create_schedule_exception(
        session, sched, caller,
        occurrence_date=original_next.date().isoformat(),
        type="edited",
        override_start_time=(NOW - timedelta(hours=1)).isoformat(),
    )

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].next_session is None


async def test_next_session_unparseable_occurrence_skipped_returns_200(
    client, session: AsyncSession, test_user,
):
    group = await create_static_group(session, test_user)
    base_start = NOW - timedelta(hours=23, minutes=59)
    sched = await create_schedule_session(
        session, group, test_user,
        start_time=base_start.isoformat(),
        end_time=(base_start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="RRULE:FREQ=DAILY",
    )
    bad_occurrence_date = (NOW + timedelta(hours=1)).date().isoformat()
    await create_schedule_exception(
        session, sched, test_user,
        occurrence_date=bad_occurrence_date,
        type="edited",
        override_start_time="not-a-real-date",
    )
    await session.commit()

    # Direct service call, with the fixed NOW: the bad occurrence is skipped, no next session.
    result = await build_player_overview(session, test_user.id, NOW)
    assert result.statics[0].next_session is None

    # And the route never 500s over it either (route uses the real clock, so
    # this just proves the endpoint tolerates bad exception data end-to-end).
    response = await client.get("/api/player/overview", headers=_auth_headers(test_user))
    assert response.status_code == 200


# ==================== floorsCleared (R-PH2-E) ====================


async def test_floors_cleared_counts_distinct_floors(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group, tier_id="aac-heavyweight", content_type="savage")
    player = await create_snapshot_player(session, tier)
    week = calculate_week_number(tier)

    # Two earned rows on the same floor count once.
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M9S", transaction_type="earned")
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M9S", transaction_type="earned")
    # A second floor.
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M10S", transaction_type="earned")
    # Ignored: spent, and a different week.
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M11S", transaction_type="spent")
    await create_page_ledger_entry(session, tier, player, caller, week_number=week + 1, floor="M12S", transaction_type="earned")

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].floors_cleared == 2


async def test_floors_cleared_ignores_unknown_floor(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group, tier_id="aac-heavyweight", content_type="savage")
    player = await create_snapshot_player(session, tier)
    week = calculate_week_number(tier)

    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M9S", transaction_type="earned")
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M10S", transaction_type="earned")
    # A stale/invalid floor for this tier (not in TIER_FLOOR_NAMES["aac-heavyweight"]).
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M13S", transaction_type="earned")

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].floors_cleared == 2


async def test_floors_cleared_null_for_ultimate(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group, tier_id="aac-heavyweight", content_type="ultimate")
    player = await create_snapshot_player(session, tier)
    week = calculate_week_number(tier)
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="M9S", transaction_type="earned")

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].floors_cleared is None


async def test_floors_cleared_null_for_unknown_tier_id(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group, tier_id="some-future-tier", content_type="savage")
    player = await create_snapshot_player(session, tier)
    week = calculate_week_number(tier)
    await create_page_ledger_entry(session, tier, player, caller, week_number=week, floor="F1S", transaction_type="earned")

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].floors_cleared is None


# ==================== avgBisPct (R-PH2-E) ====================


async def test_avg_bis_pct_hand_computed_and_rounding(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group)

    # Player 1: 4 BiS slots, 3 obtained.
    await create_snapshot_player(
        session, tier, name="P1",
        gear=[
            _gear_slot("head", has_item=True),
            _gear_slot("body", has_item=True),
            _gear_slot("hands", has_item=True),
            _gear_slot("legs", has_item=False),
        ],
    )
    # Player 2: 4 BiS slots, 2 obtained, plus one non-BiS slot (bisSource None) that must not count.
    await create_snapshot_player(
        session, tier, name="P2",
        gear=[
            _gear_slot("feet", has_item=True),
            _gear_slot("earring", has_item=True),
            _gear_slot("necklace", has_item=False),
            _gear_slot("bracelet", has_item=False),
            _gear_slot("offhand", bis_source=None, has_item=True),
        ],
    )
    # Substitute: configured, would otherwise count, must be excluded.
    sub = await create_snapshot_player(
        session, tier, name="Sub", sort_order=2, configured=True,
        gear=[_gear_slot("head", has_item=True)],
    )
    sub.is_substitute = True
    await session.flush()
    # Unconfigured: must be excluded.
    unconfigured = await create_snapshot_player(
        session, tier, name="Bench", sort_order=3, configured=False,
        gear=[_gear_slot("head", has_item=True)],
    )
    assert unconfigured.configured is False

    # Total BiS slots = 4 + 4 = 8; obtained = 3 + 2 = 5 -> 62.5% -> rounds to 63.
    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].avg_bis_pct == 63


async def test_avg_bis_pct_excludes_substitute(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group)
    await create_snapshot_player(
        session, tier, name="Active",
        gear=[_gear_slot("head", has_item=True), _gear_slot("body", has_item=False)],
    )
    sub = await create_snapshot_player(
        session, tier, name="Sub", sort_order=1,
        gear=[_gear_slot("head", has_item=False)] * 10,
    )
    sub.is_substitute = True
    await session.flush()

    result = await build_player_overview(session, caller.id, NOW)
    # Only the active player's 1/2 slots count -> 50%, not dragged down by the substitute.
    assert result.statics[0].avg_bis_pct == 50


async def test_avg_bis_pct_total_zero_is_null(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group)
    await create_snapshot_player(session, tier, gear=[_gear_slot("head", bis_source=None)])

    result = await build_player_overview(session, caller.id, NOW)
    assert result.statics[0].avg_bis_pct is None


# ==================== Query budget (R-PH2-D) ====================


async def _seed_static_with_tier_and_session(session: AsyncSession, caller, *, name: str) -> None:
    """A static with an active tier, a player and a session, so every guarded batch runs."""
    group = await create_static_group(session, caller, name=name)
    tier = await create_tier_snapshot(session, group)
    player = await create_snapshot_player(session, tier, gear=[_gear_slot("head")])
    player.user_id = caller.id
    await create_schedule_session(
        session, group, caller,
        start_time=(NOW + timedelta(days=1)).isoformat(),
        end_time=(NOW + timedelta(days=1, hours=2)).isoformat(),
    )
    await session.flush()


async def test_query_budget_constant_across_static_count(session: AsyncSession, engine):
    caller = await create_user(session)
    await _seed_static_with_tier_and_session(session, caller, name="Solo")

    def _make_counter():
        counts = {"n": 0}

        def _count(conn, cursor, statement, parameters, context, executemany):
            counts["n"] += 1

        return counts, _count

    counts_one, listener_one = _make_counter()
    event.listen(engine.sync_engine, "before_cursor_execute", listener_one)
    try:
        await build_player_overview(session, caller.id, NOW)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", listener_one)

    await _seed_static_with_tier_and_session(session, caller, name="Second")
    await _seed_static_with_tier_and_session(session, caller, name="Third")

    counts_three, listener_three = _make_counter()
    event.listen(engine.sync_engine, "before_cursor_execute", listener_three)
    try:
        await build_player_overview(session, caller.id, NOW)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", listener_three)

    assert counts_one["n"] == counts_three["n"]


# Keep create_schedule_rsvp and create_material_log_entry exercised so the new
# factories (added for Task 2's reuse) are proven working under this task too.


async def test_factories_schedule_rsvp_and_material_log_entry_smoke(session: AsyncSession):
    caller = await create_user(session)
    group = await create_static_group(session, caller)
    tier = await create_tier_snapshot(session, group)
    player = await create_snapshot_player(session, tier)
    sched = await create_schedule_session(session, group, caller)

    rsvp = await create_schedule_rsvp(session, sched, caller, status="yes")
    assert rsvp.session_id == sched.id
    assert rsvp.user_id == caller.id

    material = await create_material_log_entry(session, tier, player, caller, material_type="twine")
    assert material.tier_snapshot_id == tier.id
    assert material.recipient_player_id == player.id


# ==================== Action items: shared helpers ====================


def _rsvp_items(result):
    return [item for item in result.action_items if item.type == "rsvp_pending"]


def _loot_items(result):
    return [item for item in result.action_items if item.type == "loot_priority"]


async def _one_off_session(session, group, user, start: datetime, **kwargs):
    return await create_schedule_session(
        session, group, user,
        start_time=start.isoformat(),
        end_time=(start + timedelta(hours=2)).isoformat(),
        **kwargs,
    )


async def _weekly_series_next_in_two_days(session, group, user):
    """A weekly series whose occurrences are NOW-12d, NOW-5d, NOW+2d, NOW+9d, ..."""
    base_start = NOW - timedelta(days=12)
    return await create_schedule_session(
        session, group, user,
        start_time=base_start.isoformat(),
        end_time=(base_start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="RRULE:FREQ=WEEKLY",
    )


async def _seed_loot_static(
    session,
    caller,
    *,
    name: str = "Loot Static",
    settings: dict | None = None,
    tier_id: str = "aac-heavyweight",
    content_type: str = "savage",
    caller_role: str = "melee",
    caller_job: str = "DRG",
    other_role: str = "healer",
    other_job: str = "WHM",
    caller_slots: tuple[str, ...] = ("earring", "head"),
    other_slots: tuple[str, ...] = ("earring", "head"),
    link_caller: bool = True,
    caller_configured: bool = True,
    caller_substitute: bool = False,
):
    """A savage static owned by `caller` with the caller's player and one other player.

    Every slot listed is a raid BiS slot not yet obtained, so it is both a
    "need" for that drop and part of the weighted-need score. The caller's
    player is named to sort FIRST on the calculator's name tie-break, so a tie
    at the top can only be rejected by the strict-first check, never by luck.

    Score arithmetic (role-based mode, default advanced options):
      role_priority = (5 - index of role in lootPriority) * 25
      need          = sum of slot weights of unobtained slots * 10
                      (earring/necklace/bracelet/ring 0.8, head/hands/feet 1.0,
                       body/legs 1.5, weapon 3.0)
      score         = role_priority + need
    """
    group = await create_static_group(session, caller, name=name, settings=settings)
    tier = await create_tier_snapshot(session, group, tier_id=tier_id, content_type=content_type)
    caller_player = await create_snapshot_player(
        session, tier, name="Aaa Caller", job=caller_job, role=caller_role, sort_order=0,
        configured=caller_configured, gear=[_gear_slot(slot) for slot in caller_slots],
    )
    if link_caller:
        caller_player.user_id = caller.id
    caller_player.is_substitute = caller_substitute
    other_player = await create_snapshot_player(
        session, tier, name="Zzz Other", job=other_job, role=other_role, sort_order=1,
        gear=[_gear_slot(slot) for slot in other_slots],
    )
    await session.flush()
    return group, tier, caller_player, other_player


# ==================== rsvp_pending (R-PH2-F) ====================


class TestRsvpPending:
    async def test_item_shape_for_session_in_window(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller, name="Shape Static")
        sched = await _one_off_session(
            session, group, caller, NOW + timedelta(hours=1), title="Prog Night",
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _rsvp_items(result)
        assert len(items) == 1
        item = items[0]
        assert item.type == "rsvp_pending"
        assert item.static_id == group.id
        assert item.static_name == "Shape Static"
        assert item.title == "RSVP for Prog Night"
        assert item.detail == "No response yet"
        assert item.starts_at == (NOW + timedelta(hours=1)).isoformat()
        assert item.href == f"/group/{group.share_code}?tab=schedule&sessionId={sched.id}"

    @pytest.mark.parametrize(
        ("offset", "expected"),
        [
            pytest.param(timedelta(hours=1), 1, id="plus_1h"),
            pytest.param(timedelta(0), 0, id="exactly_now"),
            pytest.param(timedelta(minutes=-1), 0, id="minus_1min"),
            pytest.param(timedelta(days=7, minutes=-1), 1, id="7d_minus_1min"),
            pytest.param(timedelta(days=7), 1, id="exactly_7d"),
            pytest.param(timedelta(days=7, minutes=1), 0, id="7d_plus_1min"),
        ],
    )
    async def test_window_edges(self, session: AsyncSession, offset, expected):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        await _one_off_session(session, group, caller, NOW + offset)

        result = await build_player_overview(session, caller.id, NOW)
        assert len(_rsvp_items(result)) == expected

    @pytest.mark.parametrize("status", ["available", "tentative", "unavailable"])
    async def test_existing_rsvp_of_any_status_suppresses_item(self, session: AsyncSession, status):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        sched = await _one_off_session(session, group, caller, NOW + timedelta(days=1))
        await create_schedule_rsvp(session, sched, caller, status=status)

        result = await build_player_overview(session, caller.id, NOW)
        assert _rsvp_items(result) == []

    async def test_another_users_rsvp_keeps_callers_item(self, session: AsyncSession):
        caller = await create_user(session, discord_username="caller")
        member2 = await create_user(session, discord_username="member2")
        group = await create_static_group(session, caller)
        await create_membership(session, member2, group, role=MemberRole.MEMBER)
        sched = await _one_off_session(session, group, caller, NOW + timedelta(days=1))
        await create_schedule_rsvp(session, sched, member2, status="available")

        result = await build_player_overview(session, caller.id, NOW)
        assert len(_rsvp_items(result)) == 1

    async def test_track_availability_false_suppresses_item(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        await _one_off_session(
            session, group, caller, NOW + timedelta(days=1), track_availability=False,
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _rsvp_items(result) == []

    async def test_viewer_membership_gets_no_item(self, session: AsyncSession):
        caller = await create_user(session, discord_username="caller")
        owner = await create_user(session, discord_username="owner")
        group = await create_static_group(session, owner)
        await create_membership(session, caller, group, role=MemberRole.VIEWER)
        await _one_off_session(session, group, owner, NOW + timedelta(days=1))

        result = await build_player_overview(session, caller.id, NOW)
        assert result.statics[0].id == group.id  # the static itself is still listed
        assert _rsvp_items(result) == []

    async def test_weekly_series_uses_next_occurrence(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        await _weekly_series_next_in_two_days(session, group, caller)

        result = await build_player_overview(session, caller.id, NOW)
        items = _rsvp_items(result)
        assert len(items) == 1
        assert items[0].starts_at == (NOW + timedelta(days=2)).isoformat()

    async def test_weekly_series_cancelled_next_falls_outside_window(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        sched = await _weekly_series_next_in_two_days(session, group, caller)
        await create_schedule_exception(
            session, sched, caller,
            occurrence_date=(NOW + timedelta(days=2)).date().isoformat(),
            type="cancelled",
        )

        # The occurrence after the cancelled one is NOW + 9d: outside the window.
        result = await build_player_overview(session, caller.id, NOW)
        assert _rsvp_items(result) == []

    @pytest.mark.parametrize(
        "moved_to",
        [
            pytest.param(timedelta(days=8), id="moved_past_window"),
            pytest.param(timedelta(hours=-1), id="moved_into_past"),
        ],
    )
    async def test_edited_occurrence_moved_out_of_window(self, session: AsyncSession, moved_to):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        sched = await _weekly_series_next_in_two_days(session, group, caller)
        await create_schedule_exception(
            session, sched, caller,
            occurrence_date=(NOW + timedelta(days=2)).date().isoformat(),
            type="edited",
            override_start_time=(NOW + moved_to).isoformat(),
            override_end_time=(NOW + moved_to + timedelta(hours=2)).isoformat(),
        )

        # next_occurrence still returns the NOW + 2d slot, with the override start
        # applied; only the explicit window bounds keep it out.
        result = await build_player_overview(session, caller.id, NOW)
        assert _rsvp_items(result) == []

    async def test_daily_series_yields_exactly_one_item(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller)
        base_start = NOW - timedelta(days=2, hours=-1)  # occurrences at ..., NOW+1h, NOW+1d+1h, ...
        await create_schedule_session(
            session, group, caller,
            start_time=base_start.isoformat(),
            end_time=(base_start + timedelta(hours=2)).isoformat(),
            is_recurring=True,
            recurrence_rule="RRULE:FREQ=DAILY",
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _rsvp_items(result)
        assert len(items) == 1
        assert items[0].starts_at == (NOW + timedelta(hours=1)).isoformat()

    async def test_non_member_static_session_is_ignored(self, session: AsyncSession):
        caller = await create_user(session, discord_username="caller")
        other = await create_user(session, discord_username="other")
        other_group = await create_static_group(session, other)
        await _one_off_session(session, other_group, other, NOW + timedelta(days=1))

        result = await build_player_overview(session, caller.id, NOW)
        assert result.statics == []
        assert result.action_items == []

    async def test_ordered_by_starts_at_across_statics(self, session: AsyncSession):
        caller = await create_user(session)
        later_named = await create_static_group(session, caller, name="Zeta Static")
        earlier_named = await create_static_group(session, caller, name="Alpha Static")
        await _one_off_session(session, later_named, caller, NOW + timedelta(days=1))
        await _one_off_session(session, earlier_named, caller, NOW + timedelta(days=3))

        result = await build_player_overview(session, caller.id, NOW)
        assert [item.static_name for item in _rsvp_items(result)] == ["Zeta Static", "Alpha Static"]


# ==================== loot_priority (R-PH2-G) ====================


class TestLootPriority:
    async def test_lists_drops_in_floor_order_with_exact_shape(self, session: AsyncSession):
        caller = await create_user(session)
        # Caller melee: (5-0)*25 = 125 + (0.8 + 1.0)*10 = 18 -> 143.
        # Other healer: (5-4)*25 = 25 + 18 -> 43. Caller strictly first on earring and head.
        group, _tier, _cp, _op = await _seed_loot_static(session, caller, name="Loot Static")

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        item = items[0]
        assert item.type == "loot_priority"
        assert item.static_id == group.id
        assert item.static_name == "Loot Static"
        assert item.title == "You're first in line for 2 drops"
        assert item.detail == "M9S Earring · M10S Head"
        assert item.href == f"/group/{group.share_code}?tab=gear"
        assert "week=" not in item.href
        assert item.starts_at is None

    async def test_settings_none_ranks_with_client_default_role_order(self, session: AsyncSession):
        caller = await create_user(session)
        # settings=None (the common case). Client default lootPriority is
        # melee, caster, ranged, tank, healer:
        #   caller caster: (5-1)*25 = 100 + 0.8*10 = 8 -> 108
        #   other ranged:  (5-2)*25 =  75 + 8         ->  83   -> caller strictly first.
        # Under the schema default (melee, ranged, caster, ...) ranged would be 100
        # vs caster 83 (other first); under the raw {} blob both would be 8 (a tie).
        await _seed_loot_static(
            session, caller,
            caller_role="caster", caller_job="PCT", other_role="ranged", other_job="BRD",
            caller_slots=("earring",), other_slots=("earring",),
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].detail == "M9S Earring"

    async def test_partial_blob_is_filled_with_schema_defaults(self, session: AsyncSession):
        caller = await create_user(session)
        # A stored blob with only hideSetupBanners is served with every schema
        # default filled, so lootPriority becomes melee, RANGED, CASTER, tank, healer:
        #   caller ranged: (5-1)*25 = 100 + 8 -> 108
        #   other caster:  (5-2)*25 =  75 + 8 ->  83   -> caller strictly first.
        # Under the client default order the caster would be first and no item built.
        await _seed_loot_static(
            session, caller,
            settings={"hideSetupBanners": True},
            caller_role="ranged", caller_job="BRD", other_role="caster", other_job="PCT",
            caller_slots=("earring",), other_slots=("earring",),
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].detail == "M9S Earring"

    @pytest.mark.parametrize("method", ["drop", "book"])
    async def test_logged_drop_of_any_method_is_excluded(self, session: AsyncSession, method):
        caller = await create_user(session)
        _group, tier, _cp, other_player = await _seed_loot_static(session, caller)
        await create_loot_log_entry(
            session, tier, other_player, caller,
            week_number=calculate_week_number(tier), floor="M9S", item_slot="earring", method=method,
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].title == "You're first in line for 1 drop"
        assert items[0].detail == "M10S Head"

    async def test_drop_logged_previous_week_is_still_listed(self, session: AsyncSession):
        caller = await create_user(session)
        _group, tier, _cp, other_player = await _seed_loot_static(session, caller)
        # Back-date the tier so the current week is 3 (the log rejects week 0).
        tier.week_start_date = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        await session.flush()
        week = calculate_week_number(tier)
        assert week == 3
        await create_loot_log_entry(
            session, tier, other_player, caller,
            week_number=week - 1, floor="M9S", item_slot="earring", method="drop",
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result)[0].detail == "M9S Earring · M10S Head"

    async def test_ring_listed_when_unlogged(self, session: AsyncSession):
        caller = await create_user(session)
        # ring1 0.8 + head 1.0 -> the same 143 vs 43 as the earring fixture.
        await _seed_loot_static(
            session, caller, caller_slots=("ring1", "head"), other_slots=("ring1", "head"),
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result)[0].detail == "M9S Ring · M10S Head"

    @pytest.mark.parametrize("logged_slot", ["ring1", "ring2"])
    async def test_ring_logged_as_either_ring_slot_is_excluded(self, session: AsyncSession, logged_slot):
        caller = await create_user(session)
        _group, tier, _cp, other_player = await _seed_loot_static(
            session, caller, caller_slots=("ring1", "head"), other_slots=("ring1", "head"),
        )
        await create_loot_log_entry(
            session, tier, other_player, caller,
            week_number=calculate_week_number(tier), floor="M9S", item_slot=logged_slot,
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result)[0].detail == "M10S Head"

    async def test_material_drop_listed_then_logging_it_removes_it(self, session: AsyncSession):
        caller = await create_user(session)
        group = await create_static_group(session, caller, name="Glaze Static")
        tier = await create_tier_snapshot(session, group, tier_id="aac-heavyweight", content_type="savage")
        # A tome earring needing augmentation: floor 2 ranks "glaze" for the
        # caller. No raid-source slots at all, so this is the only drop -- the
        # sole test that reaches the `is_material=True` branch of `_is_drop_logged`.
        caller_player = await create_snapshot_player(
            session, tier, name="Caller", job="DRG", role="melee", sort_order=0,
            gear=[{"slot": "earring", "bisSource": "tome", "hasItem": True, "isAugmented": False}],
        )
        caller_player.user_id = caller.id
        await session.flush()

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].detail == "M10S Glaze"

        # slot_augmented is set so `get_priority_for_upgrade_material`'s own
        # "received" bookkeeping (which only counts entries with a falsy
        # `slotAugmented`) does NOT already drop the caller from the ranking:
        # the removal below must come from `_is_drop_logged`'s material
        # branch, not from that upstream received-count subtraction.
        week = calculate_week_number(tier)
        await create_material_log_entry(
            session, tier, caller_player, caller,
            material_type="glaze", floor="M10S", week_number=week, slot_augmented="earring",
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_unknown_tier_id_yields_none(self, session: AsyncSession):
        caller = await create_user(session)
        await _seed_loot_static(session, caller, tier_id="some-future-tier")

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_tie_at_top_yields_none(self, session: AsyncSession):
        caller = await create_user(session)
        # Both melee with the same need: 143 vs 143. The name tie-break puts
        # "Aaa Caller" first, so only the strict-first check rejects this.
        await _seed_loot_static(session, caller, other_role="melee", other_job="MNK")

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_other_player_strictly_first_yields_none(self, session: AsyncSession):
        caller = await create_user(session)
        # Caller healer: 25 + 18 = 43. Other melee: 125 + 18 = 143. Other first.
        await _seed_loot_static(
            session, caller, caller_role="healer", caller_job="WHM", other_role="melee", other_job="DRG",
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    @pytest.mark.parametrize(
        "settings",
        [
            pytest.param({"prioritySettings": {"mode": "manual-planning"}}, id="manual_planning"),
            pytest.param({"priorityMode": "disabled"}, id="disabled"),
        ],
    )
    async def test_manual_planning_and_disabled_modes_yield_none(self, session: AsyncSession, settings):
        caller = await create_user(session)
        await _seed_loot_static(session, caller, settings=settings)

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_enhanced_scoring_gates_on_any_loot_log_row(self, session: AsyncSession):
        caller = await create_user(session)
        _group, tier, _cp, other_player = await _seed_loot_static(
            session, caller, settings={"enableEnhancedScoring": True},
        )

        # No rows yet: enhanced scoring is not in effect on the Loot tab either.
        result = await build_player_overview(session, caller.id, NOW)
        assert len(_loot_items(result)) == 1

        # Any row, any week or floor, and the Loot tab switches to enhanced scoring.
        await create_loot_log_entry(
            session, tier, other_player, caller, week_number=1, floor="M11S", item_slot="body",
        )
        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    @pytest.mark.parametrize(
        ("configured", "substitute"),
        [pytest.param(False, False, id="unconfigured"), pytest.param(True, True, id="substitute")],
    )
    async def test_substitute_or_unconfigured_caller_yields_none(
        self, session: AsyncSession, configured, substitute,
    ):
        caller = await create_user(session)
        await _seed_loot_static(
            session, caller, caller_configured=configured, caller_substitute=substitute,
        )

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_no_linked_player_yields_none(self, session: AsyncSession):
        caller = await create_user(session)
        await _seed_loot_static(session, caller, link_caller=False)

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_ultimate_tier_yields_none(self, session: AsyncSession):
        caller = await create_user(session)
        await _seed_loot_static(session, caller, content_type="ultimate")

        result = await build_player_overview(session, caller.id, NOW)
        assert _loot_items(result) == []

    async def test_floor_four_weapon_never_appears(self, session: AsyncSession):
        caller = await create_user(session)
        # Caller melee needs weapon + earring: 125 + (3.0 + 0.8)*10 = 163.
        # Other healer needs earring: 25 + 8 = 33. The weapon need counts toward
        # the score but floor 4 is never listed.
        await _seed_loot_static(
            session, caller, caller_slots=("weapon", "earring"), other_slots=("earring",),
        )

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].title == "You're first in line for 1 drop"
        assert items[0].detail == "M9S Earring"

    async def test_more_than_three_drops_truncates_and_pluralizes(self, session: AsyncSession):
        caller = await create_user(session)
        five = ("earring", "necklace", "bracelet", "head", "hands")
        # Caller melee: 125 + (0.8*3 + 1.0*2)*10 = 44 -> 169. Other healer: 25 + 44 = 69.
        await _seed_loot_static(session, caller, caller_slots=five, other_slots=five)

        result = await build_player_overview(session, caller.id, NOW)
        items = _loot_items(result)
        assert len(items) == 1
        assert items[0].title == "You're first in line for 5 drops"
        assert items[0].detail == "M9S Earring · M9S Necklace · M9S Bracelet · +2 more"


# ==================== Order (R-PH2-H) ====================


async def test_action_items_rsvp_by_time_then_loot_by_static_name(session: AsyncSession):
    # Named so SQLite's BINARY collation (which get_user_static_groups orders
    # by) puts "Beta" ('B'=66) before "alpha" ('a'=97) -- the opposite of the
    # casefolded loot_items order this test exercises -- so a deleted
    # loot_items.sort actually changes the asserted order (see the regression
    # this replaced: both statics named with the same leading-case order left
    # this assertion true whether or not the sort ran).
    caller = await create_user(session)
    beta, _t1, _c1, _o1 = await _seed_loot_static(session, caller, name="Beta")
    alpha, _t2, _c2, _o2 = await _seed_loot_static(session, caller, name="alpha")
    await _one_off_session(session, beta, caller, NOW + timedelta(days=1))
    await _one_off_session(session, alpha, caller, NOW + timedelta(days=3))

    result = await build_player_overview(session, caller.id, NOW)
    assert [(item.type, item.static_name) for item in result.action_items] == [
        ("rsvp_pending", "Beta"),
        ("rsvp_pending", "alpha"),
        ("loot_priority", "alpha"),
        ("loot_priority", "Beta"),
    ]
