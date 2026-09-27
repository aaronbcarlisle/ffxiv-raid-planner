"""Tests for GET /api/player/overview and services.player_overview.build_player_overview."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MemberRole
from app.services.loot_context import calculate_week_number
from app.services.player_overview import build_player_overview
from tests.factories import (
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
    assert sched.id  # sanity: session created


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


async def test_query_budget_constant_across_static_count(session: AsyncSession, engine):
    caller = await create_user(session)
    await create_static_group(session, caller, name="Solo")

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

    await create_static_group(session, caller, name="Second")
    await create_static_group(session, caller, name="Third")

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
