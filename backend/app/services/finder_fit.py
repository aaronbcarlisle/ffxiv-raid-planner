"""Static Finder V2 fit engine (Stage 4 SF1a).

Pure: no session and no I/O. `routers/discovery.py` loads the viewer's inputs
once per request and calls these per listing.

- Schedule fit is per raid night (spec SF-2, plan R-SF-C): the listing's window
  is placed on each weekday's next occurrence in the listing's own zone (so DST
  applies as it will on raid night), stepped in UTC in 30-minute slots, and
  tested against the viewer's typical week expanded by the PH3 pipe
  (`expand_personal_templates`), so per-row zones, DST and bad rows behave
  exactly as the availability pipe does. Minutes floor to :00/:30 on both sides
  so :15/:45 zone offsets (Nepal, Chatham) still compare.
- Role fit reads `recruitingRoles`, or maps the legacy `neededRoles`/
  `neededJobs` the way the listing form's `initRecruitingRoles` does (R-SF-D).
- The tier reuses `fit_score._compute_overall` (imported, not copied) with one
  V2-only cap: schedule `partial` caps `strong`/`good` at `partial` (R-SF-G,
  OWNER-1). V1's `fitSummary` is untouched.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta, tzinfo
from typing import Any

from .availability_layering import (
    WEEKDAY_CODES,
    TemplateDay,
    expand_personal_templates,
    load_zone,
    parse_slot,
    weekday_code,
)
from .discord_webhook import job_category
from .fit_score import _compute_overall

ROLE_KEYS = ("tank", "healer", "melee", "ranged", "caster")
WEEKENDS = frozenset({"SA", "SU"})
WEEKNIGHTS = frozenset({"MO", "TU", "WE", "TH", "FR"})
TIER_RANK = {"strong": 0, "good": 1, "partial": 2, "unknown": 3, "weak": 4}

_CATEGORY_ROLE: dict[str, str] = {
    "Tank": "tank",
    "Pure Healer": "healer",
    "Shield Healer": "healer",
    "Melee": "melee",
    "Physical Ranged": "ranged",
    "Caster": "caster",
}
_LONG_DAY_CODE: dict[str, str] = {
    "monday": "MO",
    "tuesday": "TU",
    "wednesday": "WE",
    "thursday": "TH",
    "friday": "FR",
    "saturday": "SA",
    "sunday": "SU",
}
_STEP = timedelta(minutes=30)


# ---------------------------------------------------------------------------
# Days and roles
# ---------------------------------------------------------------------------


def role_for_job(job: str | None) -> str | None:
    """`job_category()` folded onto the five role keys; unknown job -> None (R-SF-D)."""
    category = job_category(job)
    if category is None:
        return None
    return _CATEGORY_ROLE.get(category)


def listing_day_codes(days: list[str] | None) -> list[str]:
    """Long names (any case) and iCal codes -> iCal codes, order kept, de-duplicated (R-SF-B)."""
    if not isinstance(days, list):
        return []
    codes: list[str] = []
    for raw in days:
        if not isinstance(raw, str):
            continue
        key = raw.strip()
        code = key.upper() if key.upper() in WEEKDAY_CODES else _LONG_DAY_CODE.get(key.lower())
        if code is not None and code not in codes:
            codes.append(code)
    return codes


def in_day_group(day_group: str, codes: list[str]) -> bool:
    """True when any code falls in the group; an empty list never does (R-SF-F)."""
    if day_group == "weekends":
        group = WEEKENDS
    elif day_group == "weeknights":
        group = WEEKNIGHTS
    else:
        return False
    return any(code in group for code in codes)


# ---------------------------------------------------------------------------
# Role fit (R-SF-D)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ViewerJob:
    job: str
    role: str | None
    is_main: bool


@dataclass(frozen=True)
class RecruitEntry:
    role: str | None
    priority: str  # "needed" | "nice_to_have"
    jobs: tuple[str, ...]  # upper-case


def recruit_entries(listing: dict) -> list[RecruitEntry]:
    """`recruitingRoles` when it is a non-empty list, else the legacy mapping."""
    raw = listing.get("recruitingRoles")
    if isinstance(raw, list) and raw:
        entries: list[RecruitEntry] = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            role = entry.get("role")
            if role not in ROLE_KEYS:
                continue
            priority = "nice_to_have" if entry.get("priority") == "nice_to_have" else "needed"
            jobs_raw = entry.get("jobs")
            jobs = (
                tuple(job.upper() for job in jobs_raw if isinstance(job, str))
                if isinstance(jobs_raw, list)
                else ()
            )
            entries.append(RecruitEntry(role=role, priority=priority, jobs=jobs))
        return entries

    # Legacy: the way DiscoveryTab.tsx's initRecruitingRoles seeds the form.
    needed_roles = listing.get("neededRoles")
    needed_jobs = listing.get("neededJobs")
    roles: list[str] = []
    for raw_role in needed_roles if isinstance(needed_roles, list) else []:
        if isinstance(raw_role, str):
            role = raw_role.strip().lower()
            if role in ROLE_KEYS and role not in roles:
                roles.append(role)
    jobs = [
        job.upper()
        for job in (needed_jobs if isinstance(needed_jobs, list) else [])
        if isinstance(job, str)
    ]
    by_role: dict[str, list[str]] = {
        role: [job for job in jobs if role_for_job(job) == role] for role in roles
    }
    order = list(roles)
    for job in jobs:
        role = role_for_job(job)
        if role is None or role in roles:
            continue
        if role not in by_role:
            by_role[role] = []
            order.append(role)
        if job not in by_role[role]:
            by_role[role].append(job)
    return [RecruitEntry(role=role, priority="needed", jobs=tuple(by_role[role])) for role in order]


def _hits(job: ViewerJob, entry: RecruitEntry) -> bool:
    if entry.jobs:
        return job.job.upper() in entry.jobs
    return job.role == entry.role


def compute_role_fit(
    jobs: list[ViewerJob], entries: list[RecruitEntry], as_role: str | None
) -> dict:
    """Role fit with the viewer's jobs (main first), or as a role override (R-SF-D)."""
    result: dict[str, Any] = {
        "status": "unknown",
        "matched_job": None,
        "matched_role": None,
        "priority": None,
        "is_main": False,
        "as_role": as_role,
    }
    if not entries:
        return result

    if as_role:
        result["matched_role"] = as_role
        if any(e.role == as_role and e.priority == "needed" for e in entries):
            result.update(status="match", priority="needed")
        elif any(e.role == as_role and e.priority == "nice_to_have" for e in entries):
            result.update(status="partial", priority="nice_to_have")
        else:
            result["status"] = "none"
        return result

    if not jobs:
        return result

    main = next((job for job in jobs if job.is_main), jobs[0])
    needed = [e for e in entries if e.priority == "needed"]
    nice = [e for e in entries if e.priority == "nice_to_have"]

    for entry in needed:
        if _hits(main, entry):
            result.update(
                status="match", matched_job=main.job, matched_role=entry.role,
                priority="needed", is_main=True,
            )
            return result
    for job in jobs:
        if job is main:
            continue
        for entry in needed:
            if _hits(job, entry):
                result.update(
                    status="partial", matched_job=job.job, matched_role=entry.role,
                    priority="needed", is_main=False,
                )
                return result
    for job in jobs:
        for entry in nice:
            if _hits(job, entry):
                result.update(
                    status="partial", matched_job=job.job, matched_role=entry.role,
                    priority="nice_to_have", is_main=job is main,
                )
                return result
    result["status"] = "none"
    return result


# ---------------------------------------------------------------------------
# Schedule fit (R-SF-C)
# ---------------------------------------------------------------------------


def _has_valid_slot(day: TemplateDay) -> bool:
    return any(parse_slot(slot) is not None for slot in day.slots)


def has_typical_week(template_days: list[TemplateDay]) -> bool:
    """True when a template row holds at least one valid "HH:MM" slot (R-SF-E `missing`)."""
    return any(_has_valid_slot(day) for day in template_days)


def viewer_display_zone(rows: list[tuple[str, str]], viewer_tz: str | None) -> str | None:
    """The newest loadable template zone, else a loadable `viewer_tz`, else None (OWNER-2).

    `rows` are `(timezone, updated_at)` per template row; ties on `updated_at`
    go to the first row in input order.
    """
    best: tuple[str, str] | None = None
    for zone_name, updated_at in rows:
        if not isinstance(zone_name, str) or load_zone(zone_name) is None:
            continue
        stamp = updated_at if isinstance(updated_at, str) else ""
        if best is None or stamp > best[0]:
            best = (stamp, zone_name)
    if best is not None:
        return best[1]
    if isinstance(viewer_tz, str) and viewer_tz and load_zone(viewer_tz) is not None:
        return viewer_tz
    return None


def _next_occurrence(today: date, code: str) -> date:
    return today + timedelta(days=(WEEKDAY_CODES.index(code) - today.weekday()) % 7)


def _floor_slot(slot: str) -> str:
    hours, minutes = slot.split(":")
    return f"{hours}:{'30' if int(minutes) >= 30 else '00'}"


def _floor_time(moment: datetime) -> str:
    return f"{moment:%H}:{'30' if moment.minute >= 30 else '00'}"


def _night(
    code: str,
    start: datetime | None,
    end: datetime | None,
    display: tzinfo | None,
    coverage: str | None,
) -> dict:
    if start is None or end is None or display is None:
        return {
            "day": code, "local_day": None, "local_start": None, "local_end": None,
            "coverage": coverage,
        }
    local_start = start.astimezone(display)
    local_end = end.astimezone(display)
    return {
        "day": code,
        "local_day": weekday_code(local_start.date()),
        "local_start": local_start.strftime("%H:%M"),
        "local_end": local_end.strftime("%H:%M"),
        "coverage": coverage,
    }


def _status(nights: list[dict]) -> str:
    coverage = [night["coverage"] for night in nights]
    if coverage and all(c == "full" for c in coverage):
        return "match"
    if any(c in ("full", "part") for c in coverage):
        return "partial"
    return "conflict"


def compute_schedule_fit(
    template_days: list[TemplateDay],
    listing: dict,
    *,
    now: datetime,
    display_zone: str | None,
) -> dict:
    """Per-night schedule fit: `{status, basis, nights}` (R-SF-C, SF-2)."""
    codes = listing_day_codes(listing.get("scheduleDays"))
    if not codes:
        return {"status": "unknown", "basis": "day", "nights": []}

    start = parse_slot(listing.get("scheduleStartTime"))
    end = parse_slot(listing.get("scheduleEndTime"))
    zone_name = listing.get("timezone")
    zone = load_zone(zone_name) if isinstance(zone_name, str) and zone_name else None
    display = (
        load_zone(display_zone) if isinstance(display_zone, str) and display_zone else None
    )

    windows: list[tuple[str, datetime, datetime]] = []
    if start is not None and end is not None and zone is not None:
        today = now.astimezone(zone).date()
        for code in codes:
            occurrence = _next_occurrence(today, code)
            window_start = datetime.combine(occurrence, start, tzinfo=zone)
            window_end = datetime.combine(occurrence, end, tzinfo=zone)
            if window_end <= window_start:
                window_end += timedelta(days=1)
            windows.append((code, window_start, window_end))

    if not has_typical_week(template_days):
        nights = (
            [_night(code, s, e, display, None) for code, s, e in windows]
            if windows and display is not None
            else []
        )
        return {"status": "unknown", "basis": "day", "nights": nights}

    if not windows:
        covered = {day.day_of_week for day in template_days if _has_valid_slot(day)}
        nights = [
            _night(code, None, None, None, "full" if code in covered else "none")
            for code in codes
        ]
        return {"status": _status(nights), "basis": "day", "nights": nights}

    first = min(s for _, s, _ in windows).date()
    last = max(e for _, _, e in windows).date()
    free = expand_personal_templates(
        days=template_days, start=first - timedelta(days=1), end=last + timedelta(days=2)
    )
    free_set = {
        (utc_date, _floor_slot(slot)) for (_, utc_date), slots in free.items() for slot in slots
    }

    nights = []
    for code, s, e in windows:
        moment, end_utc = s.astimezone(UTC), e.astimezone(UTC)
        total = hits = 0
        while moment < end_utc:
            total += 1
            if (moment.date().isoformat(), _floor_time(moment)) in free_set:
                hits += 1
            moment += _STEP
        coverage = "full" if total and hits == total else "part" if hits else "none"
        nights.append(_night(code, s, e, display or UTC, coverage))
    return {"status": _status(nights), "basis": "time", "nights": nights}


# ---------------------------------------------------------------------------
# Tier, reasons, sort (R-SF-G)
# ---------------------------------------------------------------------------


def _role_params(role_fit: dict) -> dict:
    return {
        "status": role_fit["status"],
        "matchedJob": role_fit.get("matched_job"),
        "matchedRole": role_fit.get("matched_role"),
        "priority": role_fit.get("priority"),
        "isMain": bool(role_fit.get("is_main")),
        "asRole": role_fit.get("as_role"),
    }


def compute_fit_v2(
    *,
    role_fit: dict,
    schedule_fit: dict,
    goal_counts: dict,
    comms_fit: dict,
    bis_fit: dict,
    missing: list[str],
) -> dict:
    """`{tier, missing, role, schedule, reasons}`; the tier is `_compute_overall` plus the cap."""
    base = _compute_overall(
        goal_counts,
        {"status": role_fit["status"]},
        {"status": schedule_fit["status"]},
        comms_fit,
        bis_fit,
    )
    schedule_status = schedule_fit["status"]
    tier = "partial" if schedule_status == "partial" and base in ("strong", "good") else base

    reasons: list[dict] = []
    role_status = role_fit["status"]
    if role_status in ("match", "partial", "none"):
        reasons.append({
            "kind": "role",
            "status": "conflict" if role_status == "none" else role_status,
            "params": _role_params(role_fit),
        })
    if schedule_status in ("match", "partial", "conflict"):
        reasons.append({
            "kind": "schedule",
            "status": schedule_status,
            "params": {"basis": schedule_fit["basis"]},
        })
    if goal_counts.get("conflicts", 0) > 0:
        goal_status: str | None = "conflict"
    elif goal_counts.get("aligned", 0) > 0:
        goal_status = "match"
    elif goal_counts.get("partial", 0) > 0:
        goal_status = "partial"
    else:
        goal_status = None
    if goal_status is not None:
        reasons.append({
            "kind": "goals",
            "status": goal_status,
            "params": {
                key: goal_counts.get(key, 0)
                for key in ("aligned", "partial", "conflicts", "missing")
            },
        })
    comms_status = comms_fit.get("status")
    if comms_status in ("match", "partial", "conflict"):
        reasons.append({"kind": "comms", "status": comms_status, "params": {}})
    bis_status = bis_fit.get("status")
    if bis_status == "ready":
        reasons.append({"kind": "bis", "status": "match", "params": {}})
    elif bis_status == "partial":
        reasons.append({"kind": "bis", "status": "partial", "params": {}})

    return {
        "tier": tier,
        "missing": list(missing),
        "role": role_fit,
        "schedule": schedule_fit,
        "reasons": reasons,
    }


def best_match_key(tier: str, reasons: list[dict]) -> tuple[int, int]:
    """Sort key for `sort=best`: tier rank, then more `match` reasons first."""
    matches = sum(1 for reason in reasons if reason.get("status") == "match")
    return (TIER_RANK.get(tier, TIER_RANK["unknown"]), -matches)
