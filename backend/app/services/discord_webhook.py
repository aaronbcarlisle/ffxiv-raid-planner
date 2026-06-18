"""Discord webhook service.

Two distinct uses:
  1. Error alerts — sent via DiscordWebhookService using the global
     DISCORD_WEBHOOK_URL setting.  Rate-limited, no auth exposure risk.
  2. Session announcements / reminders — sent via schedule.py using a
     per-group webhook URL stored in ScheduleSettings.  The URL/token is
     never logged or exposed to the frontend.

Webhook limitations vs. a full Discord bot:
  - Can POST and EDIT (if message ID is stored) messages.
  - Cannot listen to reactions, buttons, or any Gateway events.
  - Discord reaction/button RSVP sync requires a future Bot/Gateway
    integration and is explicitly out of scope for PR3.

Message editing:
  Session create POSTs with ``?wait=true`` to capture the Discord message ID,
  which is stored in ``schedule_discord_messages``.  Subsequent RSVP or session
  changes PATCH that message instead of posting a new one.  A content hash
  (``last_rsvp_hash``) skips the edit when nothing visible changed.

  If the original message was deleted (Discord returns 404 on PATCH), one
  replacement message is POSTed and the mapping is updated.

  Recurring sessions use a single summary message (``occurrence_start_time``
  is NULL) because occurrence-specific RSVP is not yet supported.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from ..config import get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()

# ── Session announcement helpers ────────────────────────────────────────────

# Discord embed colour — teal accent (#14b8a6)
_EMBED_COLOR = 0x14B8A6

_BYDAY_FULL: dict[str, str] = {
    "MO": "Monday",
    "TU": "Tuesday",
    "WE": "Wednesday",
    "TH": "Thursday",
    "FR": "Friday",
    "SA": "Saturday",
    "SU": "Sunday",
}

_RSVP_LABELS: dict[str, tuple[str, str]] = {
    "available": ("✅", "Available"),
    "tentative": ("🟡", "Tentative"),
    "unavailable": ("❌", "Unavailable"),
    "no_response": ("⬜", "No response"),
}

_JOB_CATEGORY: dict[str, str] = {
    "PLD": "Tank", "WAR": "Tank", "DRK": "Tank", "GNB": "Tank",
    "WHM": "Pure Healer", "AST": "Pure Healer",
    "SCH": "Shield Healer", "SGE": "Shield Healer",
    "MNK": "Melee", "DRG": "Melee", "NIN": "Melee",
    "SAM": "Melee", "RPR": "Melee", "VPR": "Melee",
    "BRD": "Physical Ranged", "MCH": "Physical Ranged", "DNC": "Physical Ranged",
    "BLM": "Caster", "SMN": "Caster", "RDM": "Caster", "PCT": "Caster",
}


def job_category(job: str | None) -> str | None:
    if not job:
        return None
    return _JOB_CATEGORY.get(job.upper())


@dataclass
class PlayerDetail:
    """Lightweight player info for webhook payloads — no internal IDs."""

    name: str
    position: str | None = None
    job: str | None = None

    def format_line(self) -> str:
        parts = []
        if self.position:
            parts.append(self.position)
        if self.job:
            cat = job_category(self.job)
            parts.append(f"{self.job}" + (f" ({cat})" if cat else ""))
        label = " / ".join(parts) if parts else None
        if label:
            return f"• {self.name} — {label}"
        return f"• {self.name}"


@dataclass
class SessionAnnouncementData:
    """Plain-data input for building a session announcement or reminder payload.

    Uses plain types (not ORM objects) to keep the builder testable without
    any database setup.
    """

    session_title: str
    start_iso: str
    end_iso: str
    static_group_name: str
    session_url: str
    # RSVP counts keyed by status string:
    # "available", "tentative", "unavailable", "no_response"
    rsvp_counts: dict[str, int] = field(default_factory=dict)
    # Total non-viewer member count — used to derive no-response count.
    total_member_count: int = 8
    session_description: str | None = None
    recurrence_summary: str | None = None
    unavailable_players: list[PlayerDetail] = field(default_factory=list)
    tentative_players: list[PlayerDetail] = field(default_factory=list)
    mention_target: str = "none"
    mention_role_id: str | None = None
    track_availability: bool = True
    discord_event_url: str | None = None


def build_schedule_session_url(base_url: str, share_code: str, session_id: str | None = None) -> str:
    """Build a public schedule URL, optionally deep-linking a session."""
    url = f"{base_url.rstrip('/')}/group/{share_code}?tab=schedule"
    if session_id:
        url = f"{url}&sessionId={session_id}"
    return url


def _mention_payload(mention_target: str = "none", mention_role_id: str | None = None) -> tuple[str, dict[str, Any]]:
    if mention_target == "here":
        return "@here", {"parse": ["everyone"]}
    if mention_target == "role" and mention_role_id:
        return f"<@&{mention_role_id}>", {"parse": [], "roles": [mention_role_id]}
    return "", {"parse": []}


def _recurrence_rule_to_text(rule: str | None) -> str | None:
    """Convert an iCal RRULE string to a human-readable summary.

    Handles ``FREQ=WEEKLY;BYDAY=SA`` and similar forms.
    Returns ``None`` for unknown/empty rules.

    Examples::
        'FREQ=WEEKLY;BYDAY=SA'        → 'Repeats weekly on Saturday'
        'FREQ=WEEKLY;BYDAY=SA,SU'     → 'Repeats weekly on Saturday, Sunday'
    """
    if not rule:
        return None
    parts = dict(p.split("=", 1) for p in rule.upper().split(";") if "=" in p)
    freq = parts.get("FREQ", "")
    if freq != "WEEKLY":
        return None
    byday = parts.get("BYDAY", "")
    if not byday:
        return "Repeats weekly"
    day_keys = [d.strip() for d in byday.split(",")]
    day_names = [_BYDAY_FULL.get(k, k) for k in day_keys]
    return "Repeats weekly on " + ", ".join(day_names)


def _next_occurrence_iso(start_iso: str, recurrence_rule: str | None) -> str:
    """Return the ISO timestamp of the next upcoming occurrence.

    For a non-recurring session returns ``start_iso`` unchanged.
    For a weekly recurring session, advances ``start_iso`` by 7-day
    increments until the result is in the future (UTC).

    If the start cannot be parsed, ``start_iso`` is returned as-is.
    """
    dt = _parse_dt(start_iso)
    if dt is None:
        return start_iso
    if not recurrence_rule:
        return start_iso
    parts = dict(p.split("=", 1) for p in recurrence_rule.upper().split(";") if "=" in p)
    if parts.get("FREQ") != "WEEKLY":
        return start_iso
    now = datetime.now(timezone.utc)
    while dt <= now:
        dt += timedelta(weeks=1)
    return dt.isoformat()


def compute_rsvp_hash(rsvp_counts: dict[str, int]) -> str:
    """Return a short SHA-256 hex digest of the RSVP counts.

    Used to detect whether the RSVP state changed between two webhook fires
    so that unchanged states can skip a Discord EDIT call.
    """
    canonical = json.dumps(rsvp_counts, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def compute_announcement_hash(data: SessionAnnouncementData) -> str:
    """Hash the full announcement content for change detection.

    Covers RSVP counts, player lists, title, description, and times so
    that any visible change triggers a Discord edit.
    """
    parts = {
        "title": data.session_title,
        "start": data.start_iso,
        "end": data.end_iso,
        "desc": data.session_description or "",
        "rsvp": data.rsvp_counts,
        "total": data.total_member_count,
        "unavail": [(p.name, p.position, p.job) for p in data.unavailable_players],
        "tent": [(p.name, p.position, p.job) for p in data.tentative_players],
        "track_availability": data.track_availability,
    }
    canonical = json.dumps(parts, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def _parse_dt(iso: str) -> datetime | None:
    """Parse an ISO timestamp, tolerating Z suffix."""
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def _format_duration(start: datetime, end: datetime) -> str:
    total_minutes = max(0, int((end - start).total_seconds() / 60))
    hours, minutes = divmod(total_minutes, 60)
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def _format_rsvp_summary(rsvp_counts: dict[str, int], total_member_count: int) -> str:
    """Build a compact RSVP status line for a Discord embed field."""
    available = rsvp_counts.get("available", 0)
    tentative = rsvp_counts.get("tentative", 0)
    unavailable = rsvp_counts.get("unavailable", 0)
    responded = available + tentative + unavailable
    no_response = max(0, total_member_count - responded)

    parts = []
    for status, (emoji, label) in _RSVP_LABELS.items():
        count = rsvp_counts.get(status, 0) if status != "no_response" else no_response
        parts.append(f"{emoji} {count} {label}")

    return " · ".join(parts)


def compute_subs_needed(rsvp_counts: dict[str, int], total_member_count: int) -> int:
    """Return how many subs are needed based on confirmed available RSVPs.

    Only "available" status counts as confirmed present. Tentative and
    no-response are uncertain and do not reduce the sub count.
    """
    if total_member_count <= 0:
        return 0
    return max(0, total_member_count - rsvp_counts.get("available", 0))


def _format_subs_needed_detail(unavailable_players: list[PlayerDetail], subs_count: int) -> str:
    """Build a subs-needed field value with role/job detail when available."""
    if not unavailable_players:
        slot_word = "slot" if subs_count == 1 else "slots"
        return f"{subs_count} {slot_word} short"

    lines = []
    for p in unavailable_players:
        parts = []
        if p.position:
            parts.append(p.position)
        cat = job_category(p.job)
        if cat:
            parts.append(cat)
        elif p.position:
            pass
        if parts:
            lines.append("• " + " / ".join(parts))

    if lines:
        return "\n".join(lines)

    slot_word = "slot" if subs_count == 1 else "slots"
    return f"{subs_count} {slot_word} short"


def build_session_announcement_payload(data: SessionAnnouncementData) -> dict[str, Any]:
    """Build the full Discord webhook POST payload for a session announcement.

    Returns a dict suitable for JSON-encoding in a webhook POST body.
    The payload uses Discord's rich embed format with:
      - Discord timestamps (<t:UNIX:F> and <t:UNIX:R>)
      - Session duration
      - RSVP summary (available / tentative / unavailable / no-response)
      - Sub-needed warning when party is short
      - Planner deep-link
    """
    start_dt = _parse_dt(data.start_iso)
    end_dt = _parse_dt(data.end_iso)

    fields: list[dict[str, Any]] = []

    if start_dt is not None:
        start_unix = int(start_dt.timestamp())
        fields.append({
            "name": "When",
            "value": f"<t:{start_unix}:F>\n<t:{start_unix}:R>",
            "inline": True,
        })

    if start_dt is not None and end_dt is not None and end_dt > start_dt:
        fields.append({
            "name": "Duration",
            "value": _format_duration(start_dt, end_dt),
            "inline": True,
        })

    if data.track_availability:
        fields.append({
            "name": "RSVP",
            "value": _format_rsvp_summary(data.rsvp_counts, data.total_member_count),
            "inline": False,
        })
    else:
        fields.append({
            "name": "Availability",
            "value": "Availability not required",
            "inline": False,
        })

    if data.recurrence_summary:
        fields.append({
            "name": "Recurrence",
            "value": data.recurrence_summary,
            "inline": True,
        })

    if data.track_availability and data.unavailable_players:
        lines = "\n".join(p.format_line() for p in data.unavailable_players)
        fields.append({
            "name": "❌ Cannot make it",
            "value": lines[:1024],
            "inline": False,
        })

    if data.track_availability and data.tentative_players:
        lines = "\n".join(p.format_line() for p in data.tentative_players)
        fields.append({
            "name": "❔ Tentative",
            "value": lines[:1024],
            "inline": False,
        })

    subs_needed = compute_subs_needed(data.rsvp_counts, data.total_member_count)
    if data.track_availability and subs_needed > 0:
        fields.append({
            "name": "⚠️ Subs needed",
            "value": _format_subs_needed_detail(data.unavailable_players, subs_needed),
            "inline": False,
        })

    if data.discord_event_url:
        fields.append({
            "name": "Discord Event",
            "value": f"[Open event]({data.discord_event_url})",
            "inline": True,
        })

    embed: dict[str, Any] = {
        "title": data.session_title,
        "url": data.session_url,
        "color": _EMBED_COLOR,
        "fields": fields,
        "footer": {"text": data.static_group_name},
    }

    if data.session_description:
        embed["description"] = data.session_description[:1024]

    mention, allowed_mentions = _mention_payload(data.mention_target, data.mention_role_id)
    link_parts = []
    if data.discord_event_url:
        link_parts.append(f"[Open Discord Event]({data.discord_event_url})")
    link_parts.append(f"[RSVP / details]({data.session_url})")
    content = " · ".join(link_parts)
    if mention:
        content = f"{mention}\n{content}"

    return {
        "embeds": [embed],
        "content": content,
        "allowed_mentions": allowed_mentions,
    }


def build_cancelled_payload(data: SessionAnnouncementData) -> dict[str, Any]:
    """Build a Discord webhook payload for a cancelled/deleted session.

    Posts a minimal embed with a ~~struck-through~~ title and a
    ❌ Cancelled field so the thread is clearly marked without needing
    to delete the original message (which would require storing thread IDs).
    """
    embed: dict[str, Any] = {
        "title": f"~~{data.session_title}~~",
        "url": data.session_url,
        "color": 0x5C5C5C,  # Neutral grey
        "fields": [{"name": "Status", "value": "❌ Cancelled", "inline": True}],
        "footer": {"text": data.static_group_name},
    }
    mention, allowed_mentions = _mention_payload(data.mention_target, data.mention_role_id)
    content = f"~~[View in planner]({data.session_url})~~"
    if mention:
        content = f"{mention}\n{content}"

    return {
        "embeds": [embed],
        "content": content,
        "allowed_mentions": allowed_mentions,
    }


def build_test_reminder_payload(
    static_group_name: str,
    planner_url: str,
    share_code: str,
    mention_target: str = "none",
    mention_role_id: str | None = None,
) -> dict[str, Any]:
    """Build a sample payload for the test-reminder button.

    Shows the embed format and confirms the webhook is connected.
    Does not use real session data.
    """
    now = datetime.now(timezone.utc)
    session_url = build_schedule_session_url(planner_url, share_code)
    sample = SessionAnnouncementData(
        session_title=f"{static_group_name} — Raid Night (Test)",
        start_iso=now.isoformat(),
        end_iso=now.replace(hour=(now.hour + 3) % 24).isoformat(),
        static_group_name=static_group_name,
        session_url=session_url,
        rsvp_counts={"available": 6, "tentative": 1, "unavailable": 1},
        total_member_count=8,
        session_description=(
            "This is a test reminder — your Discord webhook is connected. "
            "Real reminders will include actual session and RSVP data."
        ),
        mention_target=mention_target,
        mention_role_id=mention_role_id,
    )
    return build_session_announcement_payload(sample)


class DiscordWebhookService:
    """Sends error alerts to a Discord webhook channel."""

    def __init__(self) -> None:
        self._rate_limit: dict[str, float] = {}  # fingerprint -> last_sent_timestamp
        self._rate_limit_seconds = 3600  # 1 hour per fingerprint

    @property
    def webhook_url(self) -> str | None:
        return getattr(settings, "discord_webhook_url", None)

    async def send_error_alert(
        self,
        fingerprint: str,
        message: str,
        count: int,
        affected_users: int,
        severity: str = "error",
    ) -> None:
        """Send an error alert to Discord. Rate-limited per fingerprint."""
        if not self.webhook_url:
            return

        # Rate limit: max 1 per fingerprint per hour
        now = datetime.now(timezone.utc).timestamp()
        last_sent = self._rate_limit.get(fingerprint, 0)
        if now - last_sent < self._rate_limit_seconds:
            return
        self._rate_limit[fingerprint] = now

        # Clean old entries (prevent memory leak)
        cutoff = now - self._rate_limit_seconds
        self._rate_limit = {
            fp: ts for fp, ts in self._rate_limit.items() if ts > cutoff
        }

        color = 0xFF0000 if severity == "critical" else 0xFFA500  # Red or orange

        embed = {
            "title": f"{'Red circle' if severity == 'critical' else 'Orange circle'} Error Alert",
            "description": message[:200],
            "color": color,
            "fields": [
                {"name": "Occurrences", "value": str(count), "inline": True},
                {"name": "Affected Users", "value": str(affected_users), "inline": True},
                {"name": "Severity", "value": severity.upper(), "inline": True},
                {
                    "name": "Fingerprint",
                    "value": f"`{fingerprint[:16]}...`",
                    "inline": False,
                },
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.webhook_url,
                    json={"embeds": [embed]},
                    timeout=10.0,
                )
                if response.status_code not in (200, 204):
                    logger.warning(
                        "discord_webhook_failed",
                        status=response.status_code,
                        fingerprint=fingerprint,
                    )
        except Exception as e:
            logger.warning(
                "discord_webhook_error", error=str(e), fingerprint=fingerprint
            )


# Singleton instance
discord_webhook = DiscordWebhookService()
