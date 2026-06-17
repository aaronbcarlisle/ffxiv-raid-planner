"""Lightweight RRULE occurrence generator for schedule sessions.

Parses iCal RRULE strings (subset: FREQ, INTERVAL, BYDAY, COUNT, UNTIL) and
generates concrete datetime occurrences from a DTSTART.

Supported FREQ values: WEEKLY, DAILY, MONTHLY
Extended coverage (BYDAY, INTERVAL, COUNT, UNTIL) keeps the door open for
daily and monthly without requiring a full iCal library.

This module never raises on malformed RRULE input — it returns an empty list
and logs a warning so callers are never broken by bad data.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from ..logging_config import get_logger

logger = get_logger(__name__)

# iCal weekday name → Python weekday number (Monday=0 … Sunday=6)
_BYDAY_MAP = {
    "MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6,
}

_MAX_BATCH = 100  # Safety ceiling for a single generation call


@dataclass
class OccurrenceSpec:
    """A single generated occurrence, with optional exception overrides applied."""

    occurrence_date: str          # ISO date, e.g. "2025-07-06"
    start_time: str               # ISO datetime (inherited or overridden)
    end_time: str                 # ISO datetime (inherited or overridden)
    title: str
    description: Optional[str]
    banner_url: Optional[str]
    banner_key: Optional[str]
    banner_source_type: Optional[str]
    is_cancelled: bool = False
    is_exception: bool = False    # True when any exception field is applied
    exception_id: Optional[str] = None


@dataclass
class _RRule:
    freq: str = "WEEKLY"
    interval: int = 1
    byday: list[int] = field(default_factory=list)   # list of weekday ints
    count: Optional[int] = None
    until: Optional[datetime] = None


def _parse_rrule(rrule_str: str) -> Optional[_RRule]:
    """Parse an iCal RRULE string into an _RRule dataclass.

    Returns None on unrecognised or unsupported input.
    """
    if not rrule_str:
        return None

    # Strip optional RRULE: prefix
    text = rrule_str.strip()
    if text.upper().startswith("RRULE:"):
        text = text[6:]

    parts: dict[str, str] = {}
    for token in text.split(";"):
        if "=" in token:
            k, _, v = token.partition("=")
            parts[k.upper()] = v

    freq = parts.get("FREQ", "WEEKLY").upper()
    if freq not in ("WEEKLY", "DAILY", "MONTHLY"):
        logger.warning("recurrence_unsupported_freq", freq=freq)
        return None

    try:
        interval = int(parts.get("INTERVAL", "1"))
    except ValueError:
        interval = 1

    byday: list[int] = []
    if "BYDAY" in parts:
        for day_token in parts["BYDAY"].split(","):
            # Strip optional ordinal prefix (+1MO, -1FR …)
            day_abbr = re.sub(r"[+-]?\d*", "", day_token.strip()).upper()
            if day_abbr in _BYDAY_MAP:
                byday.append(_BYDAY_MAP[day_abbr])

    count: Optional[int] = None
    if "COUNT" in parts:
        try:
            count = int(parts["COUNT"])
        except ValueError:
            pass

    until: Optional[datetime] = None
    if "UNTIL" in parts:
        raw = parts["UNTIL"]
        try:
            # Accept YYYYMMDDTHHMMSSZ or YYYYMMDD
            if "T" in raw:
                dt = datetime.strptime(raw.rstrip("Z"), "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
            else:
                dt = datetime.strptime(raw, "%Y%m%d").replace(tzinfo=timezone.utc)
            until = dt
        except ValueError:
            pass

    return _RRule(freq=freq, interval=interval, byday=byday, count=count, until=until)


def _advance(current: datetime, rule: _RRule) -> list[datetime]:
    """Return the candidate datetimes after `current` for one step of the rule."""
    if rule.freq == "DAILY":
        return [current + timedelta(days=rule.interval)]

    if rule.freq == "MONTHLY":
        # Same day-of-month, next month(s)
        m = current.month + rule.interval
        y = current.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        import calendar
        day = min(current.day, calendar.monthrange(y, m)[1])
        return [current.replace(year=y, month=m, day=day)]

    # WEEKLY — advance by interval weeks, then collect BYDAY hits in that week
    base = current + timedelta(weeks=rule.interval)
    if not rule.byday:
        return [base]

    week_start = base - timedelta(days=base.weekday())
    candidates = sorted(
        week_start + timedelta(days=wd) for wd in rule.byday
    )
    # Return only candidates strictly after current
    return [c for c in candidates if c > current]


def generate_occurrences(
    session_start: str,
    session_end: str,
    rrule_str: str,
    *,
    after: Optional[datetime] = None,
    count: int = 20,
    exceptions: Optional[dict[str, object]] = None,
    session_title: str = "",
    session_description: Optional[str] = None,
    session_banner_url: Optional[str] = None,
    session_banner_key: Optional[str] = None,
    session_banner_source_type: Optional[str] = None,
) -> list[OccurrenceSpec]:
    """Generate up to `count` upcoming occurrences for a recurring session.

    Args:
        session_start:  ISO datetime of the series start (serves as DTSTART).
        session_end:    ISO datetime of the first occurrence's end.
        rrule_str:      iCal RRULE string, e.g. "RRULE:FREQ=WEEKLY;BYDAY=SU,WE"
        after:          Only return occurrences strictly after this datetime.
                        Defaults to now (UTC).
        count:          Maximum occurrences to return (capped at _MAX_BATCH).
        exceptions:     Dict of occurrence_date → ScheduleException ORM row.
        session_title, session_description, session_banner_*: Series defaults.

    Returns:
        List of OccurrenceSpec (excluding cancelled occurrences).
    """
    if exceptions is None:
        exceptions = {}

    rule = _parse_rrule(rrule_str)
    if rule is None:
        return []

    count = min(count, _MAX_BATCH)
    if after is None:
        after = datetime.now(timezone.utc)

    try:
        dtstart = datetime.fromisoformat(session_start)
        dtend = datetime.fromisoformat(session_end)
    except (ValueError, TypeError) as exc:
        logger.warning("recurrence_invalid_dtstart", error=str(exc))
        return []

    if dtstart.tzinfo is None:
        dtstart = dtstart.replace(tzinfo=timezone.utc)
    if dtend.tzinfo is None:
        dtend = dtend.replace(tzinfo=timezone.utc)

    duration = dtend - dtstart

    # Build BYDAY seeds for WEEKLY: find all BYDAY hits in the start week first
    if rule.freq == "WEEKLY" and rule.byday:
        week_start = dtstart - timedelta(days=dtstart.weekday())
        seed_hits = sorted(
            week_start + timedelta(days=wd) for wd in rule.byday
        )
        # Prime with the first hit at or after dtstart
        candidates_queue = [h for h in seed_hits if h >= dtstart]
        if not candidates_queue:
            # All hits this week are before dtstart — advance one interval
            candidates_queue = _advance(dtstart, rule)
    else:
        candidates_queue = [dtstart]

    results: list[OccurrenceSpec] = []
    generated_count = 0
    iterations = 0
    max_iterations = count * 60  # guard against infinite loops

    while len(results) < count and iterations < max_iterations:
        iterations += 1

        if not candidates_queue:
            break

        current = candidates_queue.pop(0)

        # Respect UNTIL / COUNT limits from the rule itself
        if rule.until and current > rule.until:
            break
        if rule.count is not None and generated_count >= rule.count:
            break

        generated_count += 1

        occurrence_date = current.date().isoformat()
        exc = exceptions.get(occurrence_date)

        is_cancelled = exc is not None and getattr(exc, "type", None) == "cancelled"
        is_exception = exc is not None

        if not is_cancelled and current > after:
            # Apply any edited overrides
            occ_start = current.isoformat()
            occ_end = (current + duration).isoformat()
            title = session_title
            description = session_description
            banner_url = session_banner_url
            banner_key = session_banner_key
            banner_source_type = session_banner_source_type
            exc_id = None

            if exc and getattr(exc, "type", None) == "edited":
                exc_id = getattr(exc, "id", None)
                if getattr(exc, "override_start_time", None):
                    occ_start = exc.override_start_time
                if getattr(exc, "override_end_time", None):
                    occ_end = exc.override_end_time
                if getattr(exc, "override_title", None):
                    title = exc.override_title
                if getattr(exc, "override_description", None):
                    description = exc.override_description
                if getattr(exc, "override_banner_url", None):
                    banner_url = exc.override_banner_url
                if getattr(exc, "override_banner_key", None):
                    banner_key = exc.override_banner_key

            results.append(OccurrenceSpec(
                occurrence_date=occurrence_date,
                start_time=occ_start,
                end_time=occ_end,
                title=title,
                description=description,
                banner_url=banner_url,
                banner_key=banner_key,
                banner_source_type=banner_source_type,
                is_cancelled=False,
                is_exception=is_exception,
                exception_id=exc_id,
            ))

        # Advance the queue
        if rule.freq == "WEEKLY" and rule.byday and candidates_queue and candidates_queue[0] > current:
            # Still have hits in this week's batch
            pass
        else:
            next_batch = _advance(current, rule)
            candidates_queue.extend(next_batch)
            candidates_queue.sort()

    return results


def next_occurrence(
    session_start: str,
    session_end: str,
    rrule_str: Optional[str],
    *,
    after: Optional[datetime] = None,
    exceptions: Optional[dict[str, object]] = None,
    session_title: str = "",
    session_description: Optional[str] = None,
    session_banner_url: Optional[str] = None,
    session_banner_key: Optional[str] = None,
    session_banner_source_type: Optional[str] = None,
) -> Optional[OccurrenceSpec]:
    """Return the single next upcoming occurrence, or None.

    For non-recurring sessions, returns the session start itself if it's in
    the future and not cancelled.
    """
    if after is None:
        after = datetime.now(timezone.utc)

    if not rrule_str:
        # Non-recurring: check if start_time is in the future
        try:
            dtstart = datetime.fromisoformat(session_start)
            if dtstart.tzinfo is None:
                dtstart = dtstart.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return None

        if dtstart <= after:
            return None

        occ_date = dtstart.date().isoformat()
        exc = (exceptions or {}).get(occ_date)
        if exc and getattr(exc, "type", None) == "cancelled":
            return None

        return OccurrenceSpec(
            occurrence_date=occ_date,
            start_time=session_start,
            end_time=session_end,
            title=session_title,
            description=session_description,
            banner_url=session_banner_url,
            banner_key=session_banner_key,
            banner_source_type=session_banner_source_type,
        )

    results = generate_occurrences(
        session_start, session_end, rrule_str,
        after=after,
        count=1,
        exceptions=exceptions,
        session_title=session_title,
        session_description=session_description,
        session_banner_url=session_banner_url,
        session_banner_key=session_banner_key,
        session_banner_source_type=session_banner_source_type,
    )
    return results[0] if results else None
