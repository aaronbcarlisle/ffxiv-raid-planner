"""Layer personal availability templates under dated availability rows.

Player Hub PH3, spec §10.1 (H-9 as amended): with `include_templates` on, the
availability range endpoint fills each current non-viewer member's dates that
have no dated row from the member's personal weekly template. Template slots
are local "HH:MM" wall times in the row's saved IANA timezone; they are
converted here to UTC per local date, mirroring the grid's `localSlotToUtc`,
so a slot that crosses midnight lands on the neighbouring UTC date.

This module is pure: it touches no session and is unit-tested directly.
Existence decides (R-PH3-C): a dated row - empty or not - blocks the template
for that user and date; a template day that yields no slots emits nothing.
Bad template rows never raise (R-PH3-B): an unknown zone is read as UTC and an
unparseable slot is skipped, each with one warning, because template `slots`
and `timezone` are never validated on write and a read endpoint every member
uses must not 500 on one bad row.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..models.availability import UserAvailability
from ..schemas.schedule import UserAvailabilityResponse

# Stdlib logging (not structlog) so pytest's `caplog` sees the warnings; the
# structlog config prints straight to stdout (`logging_config.py`).
logger = logging.getLogger(__name__)

WEEKDAY_CODES = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")  # date.weekday() -> iCal BYDAY

_SLOT_RE = re.compile(r"^([0-9]{2}):([0-9]{2})$")


@dataclass(frozen=True)
class TemplateDay:
    user_id: str
    day_of_week: str  # "MO".."SU"
    slots: tuple[str, ...]  # local "HH:MM", already json-parsed
    timezone: str  # IANA name from the row; unknown -> UTC


def weekday_code(day: date) -> str:
    """iCal BYDAY code for a calendar date (Monday -> "MO")."""
    return WEEKDAY_CODES[day.weekday()]


def parse_slot(slot: object) -> time | None:
    """Strict "HH:MM" with 0 <= HH < 24 and 0 <= MM < 60; anything else -> None."""
    if not isinstance(slot, str):
        return None
    match = _SLOT_RE.match(slot)
    if match is None:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if hours > 23 or minutes > 59:
        return None
    return time(hours, minutes)


def load_zone(name: str) -> tzinfo | None:
    """`ZoneInfo(name)`, or None when the name is unusable.

    `ZoneInfo("America")` raises PermissionError on Windows and
    IsADirectoryError on Linux (both OSError); an unknown key raises
    ZoneInfoNotFoundError; an unnormalized key raises ValueError.
    """
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return None


def expand_personal_templates(
    *, days: list[TemplateDay], start: date, end: date
) -> dict[tuple[str, str], list[str]]:
    """(user_id, utc_iso_date) -> sorted, de-duplicated UTC "HH:MM" slots inside [start, end].

    Each template day is expanded over every local date from `start - 1 day`
    to `end + 1 day` whose weekday matches (the +-1 day window covers UTC-12
    to UTC+14), each local wall time is converted to UTC, and only UTC dates
    inside [start, end] are kept. A nonexistent local time (spring-forward
    gap) is whatever `zoneinfo` gives for `fold=0`, which matches JS
    `new Date(local)`; the gap hour and the hour after it map to one UTC
    slot, hence the de-dup. The repeated fall-back hour takes its first
    occurrence and does not duplicate.
    """
    expanded: dict[tuple[str, str], list[str]] = defaultdict(list)
    zones: dict[str, tzinfo] = {}
    first_local = start - timedelta(days=1)
    last_local = end + timedelta(days=1)

    for day in days:
        zone = zones.get(day.timezone)
        if zone is None:
            loaded = load_zone(day.timezone)
            if loaded is None:
                logger.warning(
                    "personal availability template has unknown timezone %r (user %s); "
                    "reading as UTC",
                    day.timezone,
                    day.user_id,
                )
                loaded = timezone.utc
            zone = zones[day.timezone] = loaded

        parsed: list[time] = []
        bad_slots: list[object] = []
        for slot in day.slots:
            wall_time = parse_slot(slot)
            if wall_time is None:
                bad_slots.append(slot)
            else:
                parsed.append(wall_time)
        if bad_slots:
            logger.warning(
                "personal availability template has unparseable slots %r (user %s, %s); "
                "skipping them",
                bad_slots,
                day.user_id,
                day.day_of_week,
            )
        if not parsed:
            continue

        local_date = first_local
        while local_date <= last_local:
            if weekday_code(local_date) == day.day_of_week:
                for wall_time in parsed:
                    local = datetime.combine(local_date, wall_time, tzinfo=zone)
                    utc = local.astimezone(timezone.utc)
                    utc_date = utc.date()
                    if start <= utc_date <= end:
                        expanded[(day.user_id, utc_date.isoformat())].append(
                            utc.strftime("%H:%M")
                        )
            local_date += timedelta(days=1)

    return {key: sorted(set(slots)) for key, slots in expanded.items()}


def layer_availability(
    *,
    dates: list[str],
    members: list[tuple[str, str | None]],
    dated_rows: list[UserAvailability],
    personal: dict[tuple[str, str], list[str]],
) -> dict[str, list[UserAvailabilityResponse]]:
    """Build the endpoint's `by_date` map: dated rows first, then derived rows.

    `dates` is every ISO date in the range, ascending. `members` is the
    current non-viewer memberships as `(user_id, username)` in endpoint order.
    `dated_rows` is today's query result for any user (members or not);
    `personal` is `expand_personal_templates()`'s result. For each date: every
    dated row in input order (`source="dated"`, its own id), then, for each
    member in `members` order with no dated row on that date and non-empty
    personal slots, one derived row (`id=None`, `source="personal_template"`).
    Dates with nothing get no entry.
    """
    by_date: dict[str, list[UserAvailabilityResponse]] = defaultdict(list)
    dated_keys: set[tuple[str, str]] = set()

    for row in dated_rows:
        slots = json.loads(row.slots) if isinstance(row.slots, str) else row.slots
        by_date[row.date].append(
            UserAvailabilityResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.discord_username if row.user else None,
                date=row.date,
                slots=slots,
                source="dated",
            )
        )
        dated_keys.add((row.user_id, row.date))

    for date_str in dates:
        for user_id, username in members:
            if (user_id, date_str) in dated_keys:
                continue
            slots = personal.get((user_id, date_str))
            if not slots:
                continue
            by_date[date_str].append(
                UserAvailabilityResponse(
                    id=None,
                    user_id=user_id,
                    username=username,
                    date=date_str,
                    slots=list(slots),
                    source="personal_template",
                )
            )

    return dict(by_date)
