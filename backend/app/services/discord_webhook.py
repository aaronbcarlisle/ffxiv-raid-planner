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
  Editing a previously-posted message requires storing the webhook message ID
  (returned by Discord on POST).  No ``schedule_discord_messages`` table
  exists yet (needs a migration).  The payload builders below are ready; only
  the persistence layer is missing.  Proposed future schema::

      schedule_discord_messages (
        id                 UUID PK,
        session_id         FK → schedule_sessions UNIQUE,
        static_group_id    FK → static_groups,
        webhook_message_id TEXT NOT NULL,
        webhook_thread_id  TEXT NULL,
        last_posted_at     TEXT,
        last_edited_at     TEXT,
        last_rsvp_hash     TEXT,   -- hash of RSVP state to detect changes
        created_at         TEXT,
        updated_at         TEXT,
      )
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()

# ── Session announcement helpers ────────────────────────────────────────────

# Discord embed colour — teal accent (#14b8a6)
_EMBED_COLOR = 0x14B8A6

_RSVP_LABELS: dict[str, tuple[str, str]] = {
    "available": ("✅", "Available"),
    "tentative": ("🟡", "Tentative"),
    "unavailable": ("❌", "Unavailable"),
    "no_response": ("⬜", "No response"),
}


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

    fields.append({
        "name": "RSVP",
        "value": _format_rsvp_summary(data.rsvp_counts, data.total_member_count),
        "inline": False,
    })

    subs_needed = compute_subs_needed(data.rsvp_counts, data.total_member_count)
    if subs_needed > 0:
        slot_word = "slot" if subs_needed == 1 else "slots"
        fields.append({
            "name": "⚠️ Subs needed",
            "value": f"{subs_needed} {slot_word} short",
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

    return {
        "embeds": [embed],
        "content": f"[View in planner]({data.session_url})",
    }


def build_test_reminder_payload(
    static_group_name: str,
    planner_url: str,
    share_code: str,
) -> dict[str, Any]:
    """Build a sample payload for the test-reminder button.

    Shows the embed format and confirms the webhook is connected.
    Does not use real session data.
    """
    now = datetime.now(timezone.utc)
    session_url = f"{planner_url}/group/{share_code}?tab=schedule"
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
