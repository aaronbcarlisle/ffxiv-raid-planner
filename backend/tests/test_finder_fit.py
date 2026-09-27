"""Unit tests for `services/finder_fit` (Stage 4 SF1a, Task 1). Pure: no session."""

from datetime import UTC, datetime

import pytest

from app.services.availability_layering import TemplateDay
from app.services.finder_fit import (
    RecruitEntry,
    ViewerJob,
    best_match_key,
    compute_fit_v2,
    compute_role_fit,
    compute_schedule_fit,
    in_day_group,
    listing_day_codes,
    recruit_entries,
    role_for_job,
    viewer_display_zone,
)
from app.services.fit_score import _compute_overall

NOW = datetime(2026, 6, 3, 12, tzinfo=UTC)  # a Wednesday; New York on EDT, London on BST
NY = "America/New_York"
LONDON = "Europe/London"


def _slots(start: str, end: str) -> list[str]:
    """Half-hour slots from `start` to `end` inclusive."""
    h, m = (int(x) for x in start.split(":"))
    eh, em = (int(x) for x in end.split(":"))
    out = []
    while (h, m) <= (eh, em):
        out.append(f"{h:02d}:{m:02d}")
        h, m = (h, 30) if m == 0 else (h + 1, 0)
    return out


def _day(code: str, slots: list[str], tz: str = NY) -> TemplateDay:
    return TemplateDay(user_id="viewer", day_of_week=code, slots=tuple(slots), timezone=tz)


def _listing(days, start: str | None = "20:00", end: str | None = "23:00", tz=NY, **extra) -> dict:
    listing = {"scheduleDays": days, "scheduleStartTime": start, "scheduleEndTime": end}
    if tz is not ...:
        listing["timezone"] = tz
    listing.update(extra)
    return listing


def _schedule(days, listing, *, now=NOW, display_zone=NY) -> dict:
    return compute_schedule_fit(days, listing, now=now, display_zone=display_zone)


def _expect(day: str, local_day, local_start, local_end, coverage) -> dict:
    return {
        "day": day, "local_day": local_day, "local_start": local_start,
        "local_end": local_end, "coverage": coverage,
    }


# ---------------------------------------------------------------------------
# Days and roles
# ---------------------------------------------------------------------------


def test_listing_day_codes():
    assert listing_day_codes(["Friday", "saturday", "SU", "Mon", "Friday"]) == ["FR", "SA", "SU"]
    assert listing_day_codes(None) == []
    assert listing_day_codes(["", 5, "Funday"]) == []


@pytest.mark.parametrize(
    ("job", "role"),
    [("war", "tank"), ("SGE", "healer"), ("VPR", "melee"), ("DNC", "ranged"), ("PCT", "caster"),
     ("XYZ", None), (None, None)],
)
def test_role_for_job(job, role):
    assert role_for_job(job) == role


def test_in_day_group():
    assert in_day_group("weekends", ["FR"]) is False
    assert in_day_group("weeknights", ["FR"]) is True
    assert in_day_group("weekends", ["FR", "SA"]) is True
    assert in_day_group("weekends", []) is False
    assert in_day_group("anything", ["SA"]) is False


# ---------------------------------------------------------------------------
# recruit_entries (R-SF-D)
# ---------------------------------------------------------------------------


def test_recruiting_roles_win_over_legacy_fields():
    listing = {
        "recruitingRoles": [{"role": "tank", "priority": "needed", "jobs": ["pld"]}],
        "neededRoles": ["melee"],
        "neededJobs": ["DRG"],
    }
    assert recruit_entries(listing) == [RecruitEntry("tank", "needed", ("PLD",))]


def test_legacy_fields_map_like_init_recruiting_roles():
    listing = {"neededRoles": ["melee"], "neededJobs": ["DRG", "WHM"]}
    assert recruit_entries(listing) == [
        RecruitEntry("melee", "needed", ("DRG",)),
        RecruitEntry("healer", "needed", ("WHM",)),
    ]


def test_legacy_jobs_are_de_duplicated_in_both_branches():
    listing = {"neededRoles": ["melee"], "neededJobs": ["DRG", "drg", "WHM", "WHM", "DRG"]}
    assert recruit_entries(listing) == [
        RecruitEntry("melee", "needed", ("DRG",)),
        RecruitEntry("healer", "needed", ("WHM",)),
    ]


def test_legacy_only_jobs_and_unknown_role_string():
    assert recruit_entries({"neededJobs": ["BRD", "MCH"]}) == [
        RecruitEntry("ranged", "needed", ("BRD", "MCH")),
    ]
    assert recruit_entries({"neededRoles": ["dps"], "neededJobs": ["XYZ"]}) == []
    assert recruit_entries({}) == []


def test_dps_entry_dropped_and_priority_normalised():
    listing = {
        "recruitingRoles": [
            {"role": "dps", "priority": "needed", "jobs": []},
            {"role": "healer", "priority": "whatever", "jobs": []},
            {"role": "caster", "priority": "nice_to_have"},
            "not a dict",
        ]
    }
    assert recruit_entries(listing) == [
        RecruitEntry("healer", "needed", ()),
        RecruitEntry("caster", "nice_to_have", ()),
    ]


# ---------------------------------------------------------------------------
# compute_role_fit (R-SF-D)
# ---------------------------------------------------------------------------

ENTRIES = [
    RecruitEntry("melee", "needed", ()),
    RecruitEntry("melee", "needed", ("DRG",)),
    RecruitEntry("healer", "nice_to_have", ()),
]
DRG_MAIN = ViewerJob("DRG", "melee", True)
WHM_MAIN = ViewerJob("WHM", "healer", True)
DRG_ALT = ViewerJob("DRG", "melee", False)
PLD_MAIN = ViewerJob("PLD", "tank", True)


def test_role_fit_main_hits_needed():
    fit = compute_role_fit([DRG_MAIN], ENTRIES, None)
    assert fit["status"] == "match"
    assert fit["is_main"] is True
    assert fit["matched_job"] == "DRG"
    assert fit["matched_role"] == "melee"
    assert fit["priority"] == "needed"


def test_role_fit_alt_hits_needed():
    fit = compute_role_fit([WHM_MAIN, DRG_ALT], ENTRIES, None)
    assert fit["status"] == "partial"
    assert fit["priority"] == "needed"
    assert fit["matched_job"] == "DRG"
    assert fit["is_main"] is False


def test_role_fit_main_hits_nice_to_have():
    fit = compute_role_fit([WHM_MAIN], ENTRIES, None)
    assert fit["status"] == "partial"
    assert fit["priority"] == "nice_to_have"
    assert fit["matched_job"] == "WHM"
    assert fit["is_main"] is True


def test_role_fit_none_and_unknown():
    assert compute_role_fit([PLD_MAIN], ENTRIES, None)["status"] == "none"
    assert compute_role_fit([DRG_MAIN], [], None)["status"] == "unknown"
    assert compute_role_fit([], ENTRIES, None)["status"] == "unknown"


def test_role_fit_role_only_entry_matches_any_job_of_the_role():
    sam = [ViewerJob("SAM", "melee", True)]
    role_only = [RecruitEntry("melee", "needed", ())]
    drg_only = [RecruitEntry("melee", "needed", ("DRG",))]
    assert compute_role_fit(sam, role_only, None)["status"] == "match"
    assert compute_role_fit(sam, drg_only, None)["status"] == "none"


def test_role_fit_as_role():
    fit = compute_role_fit([PLD_MAIN], [RecruitEntry("melee", "needed", ("DRG",))], "melee")
    assert fit["status"] == "match"
    assert fit["matched_role"] == "melee"
    assert fit["matched_job"] is None
    assert fit["as_role"] == "melee"
    assert compute_role_fit([PLD_MAIN], ENTRIES, "tank")["status"] == "none"
    assert compute_role_fit([PLD_MAIN], ENTRIES, "healer")["status"] == "partial"
    assert compute_role_fit([PLD_MAIN], [], "melee")["status"] == "unknown"


# ---------------------------------------------------------------------------
# compute_schedule_fit (R-SF-C)
# ---------------------------------------------------------------------------


def test_schedule_same_zone_full_partial_conflict():
    listing = _listing(["Friday"])
    fit = _schedule([_day("FR", _slots("20:00", "22:30"))], listing)
    assert fit["status"] == "match"
    assert fit["basis"] == "time"
    assert fit["nights"] == [_expect("FR", "FR", "20:00", "23:00", "full")]

    fit = _schedule([_day("FR", _slots("20:00", "22:00"))], listing)
    assert fit["status"] == "partial"
    assert fit["nights"][0]["coverage"] == "part"

    fit = _schedule([_day("MO", _slots("20:00", "22:30"))], listing)
    assert fit["status"] == "conflict"
    assert fit["nights"][0]["coverage"] == "none"


def test_schedule_cross_zone_london_viewer():
    fit = _schedule(
        [_day("SA", _slots("01:00", "03:30"), LONDON)], _listing(["Friday"]), display_zone=LONDON
    )
    assert fit["status"] == "match"
    night = fit["nights"][0]
    assert (night["day"], night["local_day"], night["local_start"]) == ("FR", "SA", "01:00")


def test_schedule_window_crossing_midnight():
    days = [_day("FR", _slots("22:00", "23:30")), _day("SA", _slots("00:00", "00:30"))]
    fit = _schedule(days, _listing(["Friday"], "22:00", "01:00"))
    assert fit["status"] == "match"
    assert fit["nights"][0]["local_end"] == "01:00"


def test_schedule_viewer_east_next_local_day():
    fit = _schedule(
        [_day("SA", _slots("09:00", "11:30"), "Asia/Tokyo")],
        _listing(["Friday"]),
        display_zone="Asia/Tokyo",
    )
    assert fit["status"] == "match"
    assert fit["nights"][0]["local_day"] == "SA"


def test_schedule_window_spanning_two_local_days():
    days = [_day("FR", ["23:00", "23:30"], LONDON), _day("SA", _slots("00:00", "01:30"), LONDON)]
    fit = _schedule(days, _listing(["Friday"], "18:00", "21:00"), display_zone=LONDON)
    assert fit["status"] == "match"
    assert fit["nights"] == [_expect("FR", "FR", "23:00", "02:00", "full")]


def test_schedule_dst_listing_switches_before_viewer():
    days = [_day("SA", _slots("01:00", "03:30"), LONDON)]
    listing = _listing(["Friday"])
    before = _schedule(days, listing, now=datetime(2026, 3, 4, 12, tzinfo=UTC), display_zone=LONDON)
    assert before["status"] == "match"
    assert before["nights"][0]["local_start"] == "01:00"
    # 2026-03-10: New York is on EDT since 03-08; London stays on GMT until 03-29,
    # so the same raid is now 00:00-03:00 London and the template misses its first hour.
    after = _schedule(days, listing, now=datetime(2026, 3, 10, 12, tzinfo=UTC), display_zone=LONDON)
    assert after["status"] == "partial"
    assert after["nights"][0]["local_start"] == "00:00"
    assert after["nights"][0]["coverage"] == "part"


def test_schedule_nepal_quarter_hour_offset_floors_to_half_hour():
    fit = _schedule(
        [_day("SA", _slots("05:30", "08:30"), "Asia/Kathmandu")],
        _listing(["Friday"]),
        display_zone="Asia/Kathmandu",
    )
    assert fit["status"] == "match"
    assert (fit["nights"][0]["local_start"], fit["nights"][0]["local_end"]) == ("05:45", "08:45")


def test_schedule_rows_in_two_zones_convert_in_their_own_zone():
    # The Sunday 01:00 London row covers the Saturday 20:00 New York night only when
    # it is read in London time (Sunday 00:00 UTC); read as New York it would be Sunday 05:00 UTC.
    days = [_day("FR", _slots("20:00", "22:30"), NY), _day("SU", _slots("01:00", "03:30"), LONDON)]
    rows = [(NY, "2026-05-01T00:00:00+00:00"), (LONDON, "2026-05-02T00:00:00+00:00")]
    display = viewer_display_zone(rows, None)
    assert display == LONDON
    fit = _schedule(days, _listing(["Friday", "Saturday"]), display_zone=display)
    assert fit["status"] == "match"
    assert [(n["local_day"], n["local_start"]) for n in fit["nights"]] == [
        ("SA", "01:00"), ("SU", "01:00"),
    ]


@pytest.mark.parametrize(
    "listing",
    [
        _listing(["Friday"], start=None),
        _listing(["Friday"], tz="America"),
        _listing(["Friday"], tz=...),
        _listing(["Friday"], tz=None),
        _listing(["Friday"], tz=5),
    ],
)
def test_schedule_day_basis_fallbacks(listing):
    fit = _schedule([_day("FR", _slots("20:00", "22:30"))], listing)
    assert fit["basis"] == "day"
    assert fit["status"] == "match"
    assert fit["nights"] == [
        {"day": "FR", "local_day": None, "local_start": None, "local_end": None, "coverage": "full"}
    ]
    assert _schedule([_day("MO", ["20:00"])], listing)["status"] == "conflict"


def test_schedule_day_basis_partial_and_no_days():
    fit = _schedule([_day("FR", ["20:00"])], _listing(["Friday", "Saturday"], start=None))
    assert fit["status"] == "partial"
    assert [n["coverage"] for n in fit["nights"]] == ["full", "none"]
    assert _schedule([_day("FR", ["20:00"])], _listing([])) == {
        "status": "unknown", "basis": "day", "nights": [],
    }


def test_schedule_only_empty_template_rows_is_unknown():
    fit = _schedule([_day("FR", []), _day("SA", ["nope"])], _listing(["Friday"]), display_zone=None)
    assert fit == {"status": "unknown", "basis": "day", "nights": []}
    # An empty row still names its zone, so local times are shown with no coverage.
    fit = _schedule([_day("FR", [])], _listing(["Friday"]), display_zone=NY)
    assert fit["status"] == "unknown"
    assert fit["nights"] == [_expect("FR", "FR", "20:00", "23:00", None)]


def test_viewer_display_zone_order():
    rows = [(NY, "2026-05-01T00:00:00+00:00"), (LONDON, "2026-05-02T00:00:00+00:00")]
    assert viewer_display_zone(rows, "Australia/Sydney") == LONDON
    unloadable = [("Not/AZone", "2026-05-02T00:00:00+00:00")]
    assert viewer_display_zone(unloadable, "Australia/Sydney") == "Australia/Sydney"
    assert viewer_display_zone([], "Australia/Sydney") == "Australia/Sydney"
    assert viewer_display_zone([], "Not/AZone") is None
    assert viewer_display_zone([], None) is None
    # Ties go to the first row in input order.
    assert viewer_display_zone([(LONDON, "2026-05-01"), (NY, "2026-05-01")], None) == LONDON


def test_schedule_no_template_gives_local_times_without_coverage():
    listing = _listing(["Friday"], "19:00", "22:00")
    fit = _schedule([], listing, display_zone="Australia/Sydney")
    assert fit["status"] == "unknown"
    assert fit["basis"] == "day"
    assert fit["nights"] == [_expect("FR", "SA", "09:00", "12:00", None)]
    assert _schedule([], listing, display_zone=None)["nights"] == []


# ---------------------------------------------------------------------------
# compute_fit_v2 (R-SF-G)
# ---------------------------------------------------------------------------

ZERO_GOALS = {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}
UNKNOWN = {"status": "unknown"}


def _role(status: str, **extra) -> dict:
    base = {"status": status, "matched_job": None, "matched_role": None, "priority": None,
            "is_main": False, "as_role": None}
    base.update(extra)
    return base


def _sched(status: str, basis: str = "time") -> dict:
    return {"status": status, "basis": basis, "nights": []}


def _fit(role, schedule, goals=ZERO_GOALS, comms=UNKNOWN, bis=UNKNOWN, missing=()) -> dict:
    return compute_fit_v2(
        role_fit=_role(role), schedule_fit=_sched(schedule), goal_counts=goals,
        comms_fit=comms, bis_fit=bis, missing=list(missing),
    )


@pytest.mark.parametrize(
    ("role", "schedule", "goals", "comms", "bis", "expected"),
    [
        ("match", "match", {**ZERO_GOALS, "aligned": 1}, UNKNOWN, UNKNOWN, "strong"),
        ("unknown", "unknown", ZERO_GOALS, UNKNOWN, UNKNOWN, "unknown"),
        ("none", "match", ZERO_GOALS, UNKNOWN, UNKNOWN, "weak"),
        ("partial", "unknown", ZERO_GOALS, UNKNOWN, UNKNOWN, "good"),
        ("unknown", "conflict", ZERO_GOALS, UNKNOWN, UNKNOWN, "weak"),
        ("unknown", "unknown", ZERO_GOALS, UNKNOWN, {"status": "partial"}, "partial"),
    ],
)
def test_tier_parity_with_compute_overall(role, schedule, goals, comms, bis, expected):
    fit = _fit(role, schedule, goals, comms, bis)
    assert fit["tier"] == expected
    assert fit["tier"] == _compute_overall(
        goals, {"status": role}, {"status": schedule}, comms, bis
    )


def test_schedule_partial_caps_the_tier():
    def overall(role: str) -> str:
        return _compute_overall(
            ZERO_GOALS, {"status": role}, {"status": "partial"}, UNKNOWN, UNKNOWN
        )

    assert overall("match") == "strong"
    assert _fit("match", "partial")["tier"] == "partial"
    assert overall("partial") == "good"
    assert _fit("partial", "partial")["tier"] == "partial"
    assert _fit("none", "partial")["tier"] == "weak"
    assert _fit("unknown", "partial", {**ZERO_GOALS, "aligned": 2})["tier"] == "partial"


def test_reasons_order_and_omission():
    fit = compute_fit_v2(
        role_fit=_role("partial", matched_job="DRG", matched_role="melee", priority="needed"),
        schedule_fit=_sched("match"),
        goal_counts={"aligned": 2, "partial": 1, "conflicts": 0, "missing": 3},
        comms_fit=UNKNOWN,
        bis_fit={"status": "ready"},
        missing=["template"],
    )
    assert [(r["kind"], r["status"]) for r in fit["reasons"]] == [
        ("role", "partial"), ("schedule", "match"), ("goals", "match"), ("bis", "match"),
    ]
    assert fit["reasons"][0]["params"] == {
        "status": "partial", "matchedJob": "DRG", "matchedRole": "melee", "priority": "needed",
        "isMain": False, "asRole": None,
    }
    assert fit["reasons"][1]["params"] == {"basis": "time"}
    assert fit["reasons"][2]["params"] == {"aligned": 2, "partial": 1, "conflicts": 0, "missing": 3}
    assert fit["missing"] == ["template"]

    fit = compute_fit_v2(
        role_fit=_role("none"), schedule_fit=_sched("unknown", "day"),
        goal_counts={"aligned": 1, "partial": 0, "conflicts": 1, "missing": 0},
        comms_fit={"status": "conflict"}, bis_fit={"status": "partial"}, missing=[],
    )
    assert [(r["kind"], r["status"]) for r in fit["reasons"]] == [
        ("role", "conflict"), ("goals", "conflict"), ("comms", "conflict"), ("bis", "partial"),
    ]

    fit = _fit("unknown", "unknown", {**ZERO_GOALS, "partial": 1}, {"status": "partial"})
    assert [(r["kind"], r["status"]) for r in fit["reasons"]] == [
        ("goals", "partial"), ("comms", "partial"),
    ]
    assert _fit("unknown", "unknown")["reasons"] == []


def test_best_match_key_ordering():
    def reasons(n: int) -> list[dict]:
        return [{"kind": "role", "status": "match"}] * n + [{"kind": "bis", "status": "partial"}]

    keys = [
        best_match_key("weak", reasons(5)),
        best_match_key("unknown", reasons(0)),
        best_match_key("partial", reasons(0)),
        best_match_key("good", reasons(3)),
        best_match_key("strong", reasons(1)),
        best_match_key("strong", reasons(2)),
    ]
    assert sorted(keys) == list(reversed(keys))
    assert best_match_key("strong", reasons(2)) == (0, -2)
