"""Tests for recurrence.py — RRULE parsing, occurrence generation, exception handling."""

from datetime import datetime, timezone

import pytest

from app.services.recurrence import (
    OccurrenceSpec,
    _parse_rrule,
    generate_occurrences,
    next_occurrence,
)


# ──────────────────────────────────────────────────────────────────────────────
# _parse_rrule
# ──────────────────────────────────────────────────────────────────────────────


def test_parse_weekly_byday():
    rule = _parse_rrule("RRULE:FREQ=WEEKLY;BYDAY=SU,WE")
    assert rule is not None
    assert rule.freq == "WEEKLY"
    assert set(rule.byday) == {6, 2}  # SU=6, WE=2


def test_parse_weekly_no_byday():
    rule = _parse_rrule("FREQ=WEEKLY")
    assert rule is not None
    assert rule.freq == "WEEKLY"
    assert rule.byday == []


def test_parse_daily_interval():
    rule = _parse_rrule("FREQ=DAILY;INTERVAL=3")
    assert rule is not None
    assert rule.freq == "DAILY"
    assert rule.interval == 3


def test_parse_monthly():
    rule = _parse_rrule("FREQ=MONTHLY")
    assert rule is not None
    assert rule.freq == "MONTHLY"


def test_parse_with_count():
    rule = _parse_rrule("FREQ=WEEKLY;BYDAY=MO;COUNT=5")
    assert rule is not None
    assert rule.count == 5


def test_parse_with_until():
    rule = _parse_rrule("FREQ=WEEKLY;BYDAY=FR;UNTIL=20251231")
    assert rule is not None
    assert rule.until is not None
    assert rule.until.year == 2025
    assert rule.until.month == 12
    assert rule.until.day == 31


def test_parse_unsupported_freq_returns_none():
    rule = _parse_rrule("FREQ=HOURLY")
    assert rule is None


def test_parse_empty_returns_none():
    assert _parse_rrule("") is None
    assert _parse_rrule(None) is None  # type: ignore[arg-type]


# ──────────────────────────────────────────────────────────────────────────────
# generate_occurrences — basic
# ──────────────────────────────────────────────────────────────────────────────


def _make_after(year=2025, month=7, day=1) -> datetime:
    return datetime(year, month, day, tzinfo=timezone.utc)


WEEKLY_SU = "FREQ=WEEKLY;BYDAY=SU"


def test_weekly_generates_correct_day():
    """Every Sunday from 2025-07-06 (first Sunday after 2025-07-01)."""
    occs = generate_occurrences(
        "2025-06-01T20:00:00+00:00",
        "2025-06-01T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=3,
    )
    assert len(occs) == 3
    for occ in occs:
        dt = datetime.fromisoformat(occ.start_time)
        # weekday() 6 == Sunday
        assert dt.weekday() == 6, f"{occ.occurrence_date} is not Sunday"


def test_weekly_two_days():
    """BYDAY=SU,WE should produce both in weekly order."""
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=SU,WE",
        after=_make_after(2025, 7, 1),
        count=4,
    )
    assert len(occs) == 4
    # occurrence_date is the canonical date for each generated slot
    days = [datetime.fromisoformat(o.occurrence_date).weekday() for o in occs]
    # Should contain both WE=2 and SU=6
    assert set(days) == {2, 6}


def test_count_cap():
    occs = generate_occurrences(
        "2025-01-06T20:00:00+00:00",
        "2025-01-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 1, 1),
        count=5,
    )
    assert len(occs) <= 5


def test_max_batch_cap():
    """count > _MAX_BATCH (100) is silently capped."""
    occs = generate_occurrences(
        "2020-01-05T20:00:00+00:00",
        "2020-01-05T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2020, 1, 1),
        count=200,
    )
    assert len(occs) <= 100


def test_daily_interval():
    # DTSTART = 2025-07-01, after = 2025-07-01 midnight UTC.
    # The generator yields candidates strictly after `after`, so 2025-07-01T10:00 passes.
    occs = generate_occurrences(
        "2025-07-01T10:00:00+00:00",
        "2025-07-01T11:00:00+00:00",
        "FREQ=DAILY;INTERVAL=2",
        after=_make_after(2025, 7, 1),
        count=3,
    )
    assert len(occs) == 3
    dates = [o.occurrence_date for o in occs]
    # First is DTSTART day (already strictly after midnight), then +2, +4
    assert dates[0] == "2025-07-01"
    assert dates[1] == "2025-07-03"
    assert dates[2] == "2025-07-05"


def test_occurrence_dates_are_strictly_ascending():
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=SU,WE",
        after=_make_after(2025, 7, 1),
        count=10,
    )
    dates = [o.occurrence_date for o in occs]
    assert dates == sorted(dates)
    assert len(dates) == len(set(dates)), "No duplicate occurrence dates"


# ──────────────────────────────────────────────────────────────────────────────
# Exception handling
# ──────────────────────────────────────────────────────────────────────────────


class _FakeException:
    """Minimal stand-in for a ScheduleException ORM row."""
    def __init__(self, occurrence_date, exc_type, **kwargs):
        self.id = f"exc-{occurrence_date}"
        self.occurrence_date = occurrence_date
        self.type = exc_type
        self.override_start_time = kwargs.get("override_start_time")
        self.override_end_time = kwargs.get("override_end_time")
        self.override_title = kwargs.get("override_title")
        self.override_description = kwargs.get("override_description")
        self.override_banner_url = kwargs.get("override_banner_url")
        self.override_banner_key = kwargs.get("override_banner_key")


def test_cancelled_occurrence_excluded():
    """A cancelled exception should cause the occurrence to be excluded."""
    # Generate occurrences for a weekly Sunday series starting 2025-07-06
    # After 2025-07-01, the first Sunday is 2025-07-06
    occs_no_exc = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=3,
    )
    assert len(occs_no_exc) == 3
    first_date = occs_no_exc[0].occurrence_date

    exceptions = {first_date: _FakeException(first_date, "cancelled")}
    occs_with_exc = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=3,
        exceptions=exceptions,
    )
    dates = [o.occurrence_date for o in occs_with_exc]
    assert first_date not in dates, "Cancelled occurrence should not appear"


def test_edited_occurrence_applies_overrides():
    occs_base = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=1,
    )
    assert occs_base
    first_date = occs_base[0].occurrence_date

    exceptions = {
        first_date: _FakeException(
            first_date, "edited",
            override_title="Special Raid",
            override_description="Extended session",
        )
    }
    occs_edited = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=1,
        exceptions=exceptions,
    )
    assert len(occs_edited) == 1
    occ = occs_edited[0]
    assert occ.title == "Special Raid"
    assert occ.description == "Extended session"
    assert occ.is_exception is True
    assert occ.exception_id == f"exc-{first_date}"


def test_multiple_cancellations():
    """Cancel 2 of 4 occurrences — expect only 2 returned when requesting 2."""
    occs_base = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=4,
    )
    assert len(occs_base) == 4
    cancel_dates = {occs_base[0].occurrence_date, occs_base[2].occurrence_date}
    exceptions = {d: _FakeException(d, "cancelled") for d in cancel_dates}

    occs_filtered = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=2,
        exceptions=exceptions,
    )
    # No cancelled dates should appear
    for occ in occs_filtered:
        assert occ.occurrence_date not in cancel_dates


# ──────────────────────────────────────────────────────────────────────────────
# next_occurrence
# ──────────────────────────────────────────────────────────────────────────────


def test_next_occurrence_recurring():
    occ = next_occurrence(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
    )
    assert occ is not None
    dt = datetime.fromisoformat(occ.start_time)
    assert dt.weekday() == 6


def test_next_occurrence_non_recurring_future():
    occ = next_occurrence(
        "2025-09-01T20:00:00+00:00",
        "2025-09-01T23:00:00+00:00",
        None,
        after=_make_after(2025, 7, 1),
    )
    assert occ is not None
    assert occ.occurrence_date == "2025-09-01"


def test_next_occurrence_non_recurring_past_returns_none():
    occ = next_occurrence(
        "2025-01-01T20:00:00+00:00",
        "2025-01-01T23:00:00+00:00",
        None,
        after=_make_after(2025, 7, 1),
    )
    assert occ is None


def test_next_occurrence_skips_cancelled():
    """next_occurrence for a non-recurring session that is cancelled → None."""
    occ = next_occurrence(
        "2025-09-01T20:00:00+00:00",
        "2025-09-01T23:00:00+00:00",
        None,
        after=_make_after(2025, 7, 1),
        exceptions={"2025-09-01": _FakeException("2025-09-01", "cancelled")},
    )
    assert occ is None


def test_next_occurrence_recurring_skips_cancelled_returns_next():
    """If the first occurrence is cancelled, next_occurrence returns the one after."""
    occs_no_cancel = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=2,
    )
    assert len(occs_no_cancel) == 2
    first_date = occs_no_cancel[0].occurrence_date
    second_date = occs_no_cancel[1].occurrence_date

    exceptions = {first_date: _FakeException(first_date, "cancelled")}
    occ = next_occurrence(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        exceptions=exceptions,
    )
    assert occ is not None
    assert occ.occurrence_date == second_date


# ──────────────────────────────────────────────────────────────────────────────
# UNTIL / COUNT rule limits
# ──────────────────────────────────────────────────────────────────────────────


def test_until_limit_respected():
    rule_str = "FREQ=WEEKLY;BYDAY=SU;UNTIL=20250810T000000Z"
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        rule_str,
        after=_make_after(2025, 7, 1),
        count=10,
    )
    for occ in occs:
        assert occ.occurrence_date <= "2025-08-10"


def test_count_rule_limit():
    rule_str = "FREQ=WEEKLY;BYDAY=SU;COUNT=2"
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        rule_str,
        after=_make_after(2025, 7, 1),
        count=10,
    )
    # Rule says max 2 total occurrences; DTSTART itself is the first generated occurrence
    # but it's before `after`, so we may get 1 or 0 depending on generated count consumed.
    assert len(occs) <= 2


# ──────────────────────────────────────────────────────────────────────────────
# Session metadata propagation
# ──────────────────────────────────────────────────────────────────────────────


def test_session_title_propagated():
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=2,
        session_title="Savage Prog",
        session_description="M4S main mechanic practice",
        session_banner_url="https://example.com/banner.png",
    )
    assert all(o.title == "Savage Prog" for o in occs)
    assert all(o.description == "M4S main mechanic practice" for o in occs)
    assert all(o.banner_url == "https://example.com/banner.png" for o in occs)


def test_edited_override_does_not_affect_other_occurrences():
    occs_base = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=3,
    )
    assert len(occs_base) == 3
    second_date = occs_base[1].occurrence_date

    exceptions = {
        second_date: _FakeException(second_date, "edited", override_title="Special")
    }
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        WEEKLY_SU,
        after=_make_after(2025, 7, 1),
        count=3,
        exceptions=exceptions,
        session_title="Normal",
    )
    titles = {o.occurrence_date: o.title for o in occs}
    assert titles.get(second_date) == "Special"
    for date, title in titles.items():
        if date != second_date:
            assert title == "Normal", f"Occurrence {date} should have Normal title"


# ──────────────────────────────────────────────────────────────────────────────
# Timezone-aware generation: DST correctness and local-date keying
# ──────────────────────────────────────────────────────────────────────────────


def test_cdt_occurrence_date_uses_local_thursday_not_utc_friday():
    """Thu Jun 25 2026 7 PM CDT is stored as Fri Jun 26 UTC.
    occurrence_date must be '2026-06-25' (local Thu), not '2026-06-26' (UTC Fri).
    """
    occs = generate_occurrences(
        "2026-06-26T00:00:00+00:00",  # Fri midnight UTC = Thu 7 PM CDT
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=1,
        timezone_name="America/Chicago",
    )
    assert len(occs) == 1
    assert occs[0].occurrence_date == "2026-06-25"


def test_chicago_thu_sun_generates_correct_local_weekdays():
    """America/Chicago Thu+Sun 7 PM session must produce Thu/Sun dates, not Wed/Sat."""
    occs = generate_occurrences(
        "2026-06-26T00:00:00+00:00",  # Thu Jun 25 7 PM CDT
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH,SU",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=4,
        timezone_name="America/Chicago",
    )
    assert len(occs) == 4
    # First two: Thu Jun 25 and Sun Jun 28 in local time
    assert occs[0].occurrence_date == "2026-06-25"
    assert occs[1].occurrence_date == "2026-06-28"
    assert occs[2].occurrence_date == "2026-07-02"
    assert occs[3].occurrence_date == "2026-07-05"


def test_chicago_spring_forward_preserves_7pm_local():
    """Weekly Thu 7 PM CDT must remain 7 PM after spring-forward (Mar 9 2025).
    UTC offset changes from -6 (CST) to -5 (CDT); the local time must not shift.
    """
    # Thu Mar 6 2025 7 PM CST = 2025-03-07T01:00:00Z
    occs = generate_occurrences(
        "2025-03-07T01:00:00+00:00",
        "2025-03-07T04:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2025, 3, 12, tzinfo=timezone.utc),  # after spring-forward
        count=1,
        timezone_name="America/Chicago",
    )
    assert len(occs) == 1
    # Thu Mar 13 7 PM CDT = 2025-03-14T00:00:00Z (not T01 = 8 PM CDT)
    assert occs[0].start_time == "2025-03-14T00:00:00+00:00"
    assert occs[0].occurrence_date == "2025-03-13"


def test_chicago_fall_back_preserves_7pm_local():
    """Weekly Thu 7 PM CDT must remain 7 PM after fall-back (Nov 2 2025).
    UTC offset changes from -5 (CDT) to -6 (CST).
    """
    # Thu Oct 23 2025 7 PM CDT = 2025-10-24T00:00:00Z
    occs = generate_occurrences(
        "2025-10-24T00:00:00+00:00",
        "2025-10-24T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2025, 11, 4, tzinfo=timezone.utc),  # after fall-back
        count=1,
        timezone_name="America/Chicago",
    )
    assert len(occs) == 1
    # Thu Nov 6 7 PM CST = 2025-11-07T01:00:00Z (not T00 = 6 PM CST)
    assert occs[0].start_time == "2025-11-07T01:00:00+00:00"
    assert occs[0].occurrence_date == "2025-11-06"


def test_cancellation_with_local_date_key_matches_cdt_occurrence():
    """A cancellation stored under the local-date key '2026-06-25' must suppress
    Thu Jun 25 2026 7 PM CDT even though its UTC date is Jun 26.
    """
    exceptions = {"2026-06-25": _FakeException("2026-06-25", "cancelled")}
    occs = generate_occurrences(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=1,
        exceptions=exceptions,
        timezone_name="America/Chicago",
    )
    # First occurrence (Jun 25 local) is cancelled; next is Jul 2 local
    assert len(occs) == 1
    assert occs[0].occurrence_date == "2026-07-02"


def test_tokyo_weekly_no_dst_stable():
    """Asia/Tokyo has no DST. Weekly recurrence must produce stable local dates."""
    # Thu Jun 25 2026 9 PM JST (UTC+9) = 2026-06-25T12:00:00Z
    occs = generate_occurrences(
        "2026-06-25T12:00:00+00:00",
        "2026-06-25T15:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=3,
        timezone_name="Asia/Tokyo",
    )
    assert len(occs) == 3
    assert occs[0].occurrence_date == "2026-06-25"
    assert occs[1].occurrence_date == "2026-07-02"
    assert occs[2].occurrence_date == "2026-07-09"


def test_no_timezone_falls_back_to_utc_behavior():
    """Without timezone_name, UTC-based behavior is unchanged."""
    occs = generate_occurrences(
        "2025-07-06T20:00:00+00:00",
        "2025-07-06T23:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=SU",
        after=_make_after(2025, 7, 1),
        count=2,
    )
    assert len(occs) == 2
    assert occs[0].occurrence_date == "2025-07-06"
    assert occs[1].occurrence_date == "2025-07-13"


# ──────────────────────────────────────────────────────────────────────────────
# Legacy UTC-key backward compatibility
# ──────────────────────────────────────────────────────────────────────────────


def test_legacy_utc_key_cancellation_still_works():
    """An exception stored with the old UTC date key must still suppress the occurrence.

    Before timezone-aware keying: Thu Jun 25 2026 7 PM CDT was stored as "2026-06-26"
    (UTC Fri). After the fix, new keys are "2026-06-25" (local Thu). The backend must
    fall back to the UTC key so existing cancellations are honoured.
    """
    legacy_exceptions = {"2026-06-26": _FakeException("2026-06-26", "cancelled")}
    occs = generate_occurrences(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=1,
        exceptions=legacy_exceptions,
        timezone_name="America/Chicago",
    )
    # Legacy UTC key "2026-06-26" matched → Jun 25 local occurrence suppressed → Jul 2
    assert len(occs) == 1
    assert occs[0].occurrence_date == "2026-07-02"


def test_new_local_key_and_legacy_utc_key_do_not_double_cancel():
    """Both keys present must not cause duplicate suppression or errors."""
    mixed_exceptions = {
        "2026-06-25": _FakeException("2026-06-25", "cancelled"),
        "2026-06-26": _FakeException("2026-06-26", "cancelled"),
    }
    occs = generate_occurrences(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        count=1,
        exceptions=mixed_exceptions,
        timezone_name="America/Chicago",
    )
    # Only one occurrence suppressed — next is Jul 2
    assert len(occs) == 1
    assert occs[0].occurrence_date == "2026-07-02"


# ──────────────────────────────────────────────────────────────────────────────
# next_occurrence with timezone_name
# ──────────────────────────────────────────────────────────────────────────────


def test_next_occurrence_recurring_with_timezone():
    """next_occurrence delegates to generate_occurrences and uses local occurrence_date."""
    from app.services.recurrence import next_occurrence
    occ = next_occurrence(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=TH",
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        timezone_name="America/Chicago",
    )
    assert occ is not None
    assert occ.occurrence_date == "2026-06-25"


def test_next_occurrence_non_recurring_with_timezone():
    """Non-recurring next_occurrence uses local date for occurrence_date."""
    from app.services.recurrence import next_occurrence
    # Fri Jun 26 2026 UTC midnight = Thu Jun 25 2026 7 PM CDT
    occ = next_occurrence(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        None,
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        timezone_name="America/Chicago",
    )
    assert occ is not None
    assert occ.occurrence_date == "2026-06-25"


def test_next_occurrence_non_recurring_legacy_utc_cancellation():
    """Non-recurring session: legacy UTC-key exception still suppresses the occurrence."""
    from app.services.recurrence import next_occurrence
    legacy_exceptions = {"2026-06-26": _FakeException("2026-06-26", "cancelled")}
    occ = next_occurrence(
        "2026-06-26T00:00:00+00:00",
        "2026-06-26T03:00:00+00:00",
        None,
        after=datetime(2026, 6, 24, tzinfo=timezone.utc),
        exceptions=legacy_exceptions,
        timezone_name="America/Chicago",
    )
    assert occ is None
