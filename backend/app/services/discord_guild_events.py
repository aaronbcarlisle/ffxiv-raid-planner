"""Discord Guild Scheduled Events integration (V1 rolling mirror).

Manages a rolling 4-week window of Discord Guild Scheduled Events that mirror
ScheduleSession occurrences.  Requires discord_bot_token + discord_guild_id to
be set on the group's ScheduleSettings row; without them, all operations are
no-ops.

Discord API reference:
  POST   /guilds/{guild}/scheduled-events
  PATCH  /guilds/{guild}/scheduled-events/{event_id}
  DELETE /guilds/{guild}/scheduled-events/{event_id}

Privacy level 2 = GUILD_ONLY (required for non-Stage channels).
Entity type   3 = EXTERNAL (event without a specific voice channel).
Status        1 = SCHEDULED, 2 = ACTIVE, 3 = COMPLETED, 4 = CANCELED.
"""

from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from ..logging_config import get_logger
from ..models.schedule import ScheduleDiscordMirror, ScheduleException, ScheduleSession, ScheduleSettings
from ..services.recurrence import OccurrenceSpec, generate_occurrences, next_occurrence

logger = get_logger(__name__)

_DISCORD_API = "https://discord.com/api/v10"
_ROLLING_WINDOW_DAYS = 28  # 4 weeks
_ENTITY_TYPE_EXTERNAL = 3
_PRIVACY_GUILD_ONLY = 2
_MAX_BANNER_BYTES = 10 * 1024 * 1024  # 10 MB guard


# ──────────────────────────────────────────────────────────────────────────────
# Low-level Discord API helpers
# ──────────────────────────────────────────────────────────────────────────────


def _auth_headers(bot_token: str) -> dict[str, str]:
    return {"Authorization": f"Bot {bot_token}", "Content-Type": "application/json"}


async def _create_guild_event(
    bot_token: str,
    guild_id: str,
    payload: dict[str, Any],
    *,
    timeout: float = 15.0,
) -> tuple[bool, dict[str, Any], str]:
    """POST a new Guild Scheduled Event.  Returns (ok, body, error)."""
    url = f"{_DISCORD_API}/guilds/{guild_id}/scheduled-events"
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(url, headers=_auth_headers(bot_token), json=payload)
            if resp.status_code in (200, 201):
                return True, resp.json(), ""
            return False, {}, f"HTTP {resp.status_code}: {resp.text[:200]}"
        except httpx.RequestError as exc:
            return False, {}, str(exc)


async def _update_guild_event(
    bot_token: str,
    guild_id: str,
    event_id: str,
    payload: dict[str, Any],
    *,
    timeout: float = 15.0,
) -> tuple[bool, dict[str, Any], str]:
    """PATCH an existing Guild Scheduled Event."""
    url = f"{_DISCORD_API}/guilds/{guild_id}/scheduled-events/{event_id}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.patch(url, headers=_auth_headers(bot_token), json=payload)
            if resp.status_code == 200:
                return True, resp.json(), ""
            return False, {}, f"HTTP {resp.status_code}: {resp.text[:200]}"
        except httpx.RequestError as exc:
            return False, {}, str(exc)


async def _delete_guild_event(
    bot_token: str,
    guild_id: str,
    event_id: str,
    *,
    timeout: float = 10.0,
) -> tuple[bool, str]:
    """DELETE a Guild Scheduled Event."""
    url = f"{_DISCORD_API}/guilds/{guild_id}/scheduled-events/{event_id}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.delete(url, headers=_auth_headers(bot_token))
            if resp.status_code in (200, 204):
                return True, ""
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        except httpx.RequestError as exc:
            return False, str(exc)


# ──────────────────────────────────────────────────────────────────────────────
# Banner handling
# ──────────────────────────────────────────────────────────────────────────────


async def _fetch_banner_data_uri(banner_url: str) -> Optional[str]:
    """Download an image URL and return a base64 data URI for the Discord API.

    Returns None on failure (soft — banner is optional).
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(banner_url, follow_redirects=True)
        if resp.status_code != 200:
            return None
        content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()
        if not content_type.startswith("image/"):
            return None
        raw = resp.content
        if len(raw) > _MAX_BANNER_BYTES:
            logger.warning("discord_banner_too_large", url=banner_url, size=len(raw))
            return None
        b64 = base64.b64encode(raw).decode()
        return f"data:{content_type};base64,{b64}"
    except Exception as exc:
        logger.warning("discord_banner_fetch_failed", url=banner_url, error=str(exc))
        return None


def _banner_hash(banner_url: Optional[str]) -> Optional[str]:
    if not banner_url:
        return None
    return hashlib.sha256(banner_url.encode()).hexdigest()[:32]


# ──────────────────────────────────────────────────────────────────────────────
# Payload builder
# ──────────────────────────────────────────────────────────────────────────────


def _build_event_payload(
    occ: OccurrenceSpec,
    *,
    image_data_uri: Optional[str] = None,
) -> dict[str, Any]:
    """Build the Discord Guild Scheduled Event create/update payload."""
    # Discord expects ISO 8601 with Z suffix
    def _to_discord_ts(iso: str) -> str:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    payload: dict[str, Any] = {
        "name": occ.title or "Raid Session",
        "scheduled_start_time": _to_discord_ts(occ.start_time),
        "scheduled_end_time": _to_discord_ts(occ.end_time),
        "entity_type": _ENTITY_TYPE_EXTERNAL,
        "privacy_level": _PRIVACY_GUILD_ONLY,
        "entity_metadata": {"location": "FFXIV"},
    }
    if occ.description:
        payload["description"] = occ.description[:1000]
    if image_data_uri:
        payload["image"] = image_data_uri
    return payload


# ──────────────────────────────────────────────────────────────────────────────
# Mirror window management
# ──────────────────────────────────────────────────────────────────────────────


async def sync_session_mirror(
    *,
    session: ScheduleSession,
    settings: ScheduleSettings,
    mirrors: list[ScheduleDiscordMirror],
    exceptions: dict[str, ScheduleException],
    db_add: Any,          # session.add callable
    db_delete: Any,       # session.delete callable
    now: Optional[datetime] = None,
) -> list[str]:
    """Sync the rolling 4-week mirror for one ScheduleSession.

    Creates missing Discord events, updates changed ones, deletes events that
    are now cancelled or have rolled outside the window.

    Args:
        session:    The ScheduleSession ORM row.
        settings:   ScheduleSettings for the static group (must have bot_token + guild_id).
        mirrors:    Existing ScheduleDiscordMirror rows for this session.
        exceptions: Dict occurrence_date → ScheduleException for this session.
        db_add:     SQLAlchemy session.add (for new mirrors).
        db_delete:  SQLAlchemy session.delete (for stale mirrors).
        now:        Current time (defaults to utcnow).

    Returns:
        List of human-readable status strings for logging/debugging.
    """
    if not settings.discord_bot_token or not settings.discord_guild_id:
        return ["skipped: no bot token or guild id configured"]

    bot_token: str = settings.discord_bot_token
    guild_id: str = settings.discord_guild_id

    if now is None:
        now = datetime.now(timezone.utc)

    window_end = now + timedelta(days=_ROLLING_WINDOW_DAYS)
    now_iso = now.isoformat()
    log: list[str] = []

    # Generate occurrences in the rolling window (max 20 per session)
    occ_kwargs = dict(
        session_title=session.title,
        session_description=session.description,
        session_banner_url=getattr(session, "banner_url", None),
        session_banner_key=getattr(session, "banner_key", None),
        session_banner_source_type=getattr(session, "banner_source_type", None),
    )

    if session.is_recurring and session.recurrence_rule:
        upcoming = generate_occurrences(
            session.start_time, session.end_time, session.recurrence_rule,
            after=now - timedelta(hours=1),  # include events starting very soon
            count=20,
            exceptions=exceptions,
            **occ_kwargs,
        )
        # Filter to window
        upcoming = [o for o in upcoming if _occ_start_dt(o) <= window_end]
    else:
        occ = next_occurrence(
            session.start_time, session.end_time, None,
            after=now - timedelta(hours=1),
            exceptions=exceptions,
            **occ_kwargs,
        )
        upcoming = [occ] if occ and _occ_start_dt(occ) <= window_end else []

    upcoming_dates = {o.occurrence_date for o in upcoming}

    # Index existing mirrors by occurrence_date
    mirror_map: dict[str, ScheduleDiscordMirror] = {
        m.occurrence_date or "__single__": m for m in mirrors
    }
    single_key = "__single__" if not session.is_recurring else None

    # ── Delete mirrors no longer in the window or cancelled ──────────────────
    for key, mirror in list(mirror_map.items()):
        real_date = mirror.occurrence_date
        if real_date not in upcoming_dates:
            if mirror.discord_scheduled_event_id:
                ok, err = await _delete_guild_event(bot_token, guild_id, mirror.discord_scheduled_event_id)
                if ok:
                    log.append(f"deleted discord event for {real_date}")
                else:
                    log.append(f"failed to delete discord event for {real_date}: {err}")
            db_delete(mirror)

    # ── Create / update mirrors for each upcoming occurrence ─────────────────
    for occ in upcoming:
        date_key = occ.occurrence_date
        mirror = mirror_map.get(date_key)

        banner_url = occ.banner_url
        new_hash = _banner_hash(banner_url)
        image_data_uri: Optional[str] = None

        if mirror is None:
            # New occurrence — create Discord event
            if banner_url:
                image_data_uri = await _fetch_banner_data_uri(banner_url)

            payload = _build_event_payload(occ, image_data_uri=image_data_uri)
            ok, body, err = await _create_guild_event(bot_token, guild_id, payload)

            new_mirror = ScheduleDiscordMirror(
                id=_new_id(),
                session_id=session.id,
                occurrence_date=occ.occurrence_date,
                discord_guild_id=guild_id,
                discord_scheduled_event_id=body.get("id", "") if ok else "",
                sync_status="synced" if ok else "failed",
                last_synced_at=now_iso if ok else None,
                last_error=err if not ok else None,
                banner_hash_synced=new_hash if (ok and image_data_uri) else None,
                created_at=now_iso,
                updated_at=now_iso,
            )
            db_add(new_mirror)
            log.append(f"created discord event for {date_key}: {'ok' if ok else err}")

        else:
            # Existing mirror — check if update needed
            if mirror.sync_status == "failed" or _needs_update(mirror, occ, new_hash):
                if banner_url and new_hash != mirror.banner_hash_synced:
                    image_data_uri = await _fetch_banner_data_uri(banner_url)

                payload = _build_event_payload(occ, image_data_uri=image_data_uri)
                event_id = mirror.discord_scheduled_event_id

                if event_id:
                    ok, _, err = await _update_guild_event(bot_token, guild_id, event_id, payload)
                else:
                    ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                    if ok:
                        mirror.discord_scheduled_event_id = body.get("id", "")

                mirror.sync_status = "synced" if ok else "failed"
                mirror.last_synced_at = now_iso if ok else mirror.last_synced_at
                mirror.last_error = err if not ok else None
                if ok and image_data_uri:
                    mirror.banner_hash_synced = new_hash
                mirror.updated_at = now_iso
                log.append(f"updated discord event for {date_key}: {'ok' if ok else err}")
            else:
                log.append(f"no change for {date_key}")

    return log


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _occ_start_dt(occ: OccurrenceSpec) -> datetime:
    dt = datetime.fromisoformat(occ.start_time)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _needs_update(mirror: ScheduleDiscordMirror, occ: OccurrenceSpec, new_hash: Optional[str]) -> bool:
    """Return True if the Discord event needs to be re-synced."""
    # Always update if banner changed
    if new_hash != mirror.banner_hash_synced:
        return True
    # Can't detect title/time changes without storing them — update conservatively
    # if last_synced_at is None (never synced) or older than 6 h
    if not mirror.last_synced_at:
        return True
    try:
        last = datetime.fromisoformat(mirror.last_synced_at)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - last
        return age.total_seconds() > 6 * 3600
    except ValueError:
        return True


def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())
