"""Discord Guild Scheduled Events integration (V2 — official bot, per-link mirror).

Mirrors ScheduleSession events into Discord. Clean recurring sessions use one
native Discord recurring scheduled event; sessions with app-side exceptions use
concrete rolling-window mirrors so edited/cancelled occurrences stay accurate.

Token resolution order (first found wins):
  1. App-level DISCORD_BOT_TOKEN env var (official bot, preferred)
  2. Per-static ScheduleSettings.discord_bot_token (legacy self-hosted bot)

If neither is set, all operations are no-ops.

Discord API reference:
  POST   /guilds/{guild}/scheduled-events
  PATCH  /guilds/{guild}/scheduled-events/{event_id}
  DELETE /guilds/{guild}/scheduled-events/{event_id}

Privacy level 2 = GUILD_ONLY.
Entity type   3 = EXTERNAL (event without a specific voice channel).
Status        1 = SCHEDULED.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import select

from ..config import get_settings
from ..logging_config import get_logger
from ..models.schedule import ScheduleDiscordMirror, ScheduleException, ScheduleSession, ScheduleSettings, StaticDiscordLink
from ..models.static_group import StaticGroup
from ..services.recurrence import OccurrenceSpec, _parse_rrule, generate_occurrences, next_occurrence

logger = get_logger(__name__)

_DISCORD_API = "https://discord.com/api/v10"
_ROLLING_WINDOW_DAYS = 28  # 4 weeks
_ENTITY_TYPE_EXTERNAL = 3
_PRIVACY_GUILD_ONLY = 2
_MAX_BANNER_BYTES = 10 * 1024 * 1024  # 10 MB guard

# Discord permission bits for scheduled-event creation.
# CREATE_EVENTS (1<<44) is the modern granular permission — sufficient to create
# and manage the bot's own events.  MANAGE_EVENTS (1<<33) is the older, broader
# flag that also lets the bot edit events created by others (not needed here).
_PERM_MANAGE_EVENTS = 1 << 33
_PERM_CREATE_EVENTS = 1 << 44
_SYNCABLE_LINK_STATUSES = {"connected", "permission_missing"}


# ──────────────────────────────────────────────────────────────────────────────
# Token resolution
# ──────────────────────────────────────────────────────────────────────────────


def _resolve_bot_token(settings_row: ScheduleSettings | None) -> str:
    """Return the bot token to use: env var first, per-static fallback."""
    app_token = get_settings().discord_bot_token
    if app_token:
        return app_token
    if settings_row and getattr(settings_row, "discord_bot_token", None):
        return settings_row.discord_bot_token  # type: ignore[return-value]
    return ""


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
# Permission checking
# ──────────────────────────────────────────────────────────────────────────────


async def check_bot_permissions(guild_id: str, bot_token: str) -> dict[str, Any]:
    """Check whether the bot is in the guild and has event-creation permissions.

    Returns a dict with keys: ok (bool), has_manage_events (bool), error (str).
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Resolve the bot's own user ID — Discord API v10 requires a real snowflake,
            # not the "@me" shorthand, on the guild members endpoint.
            me_resp = await client.get(
                f"{_DISCORD_API}/users/@me",
                headers=_auth_headers(bot_token),
            )
            if me_resp.status_code != 200:
                return {"ok": False, "has_manage_events": False, "error": f"Could not resolve bot user: HTTP {me_resp.status_code}"}
            bot_user_id: str = me_resp.json()["id"]

            # Fetch the bot's member record in the guild
            resp = await client.get(
                f"{_DISCORD_API}/guilds/{guild_id}/members/{bot_user_id}",
                headers=_auth_headers(bot_token),
            )
            if resp.status_code == 404:
                return {"ok": False, "has_manage_events": False, "error": "Bot is not a member of this guild"}
            if resp.status_code != 200:
                return {"ok": False, "has_manage_events": False, "error": f"HTTP {resp.status_code}"}

            member = resp.json()
            role_ids: list[str] = member.get("roles", [])

            # Fetch the guild to get role permission bits
            guild_resp = await client.get(
                f"{_DISCORD_API}/guilds/{guild_id}",
                headers=_auth_headers(bot_token),
            )
            if guild_resp.status_code != 200:
                # Assume permissions are fine if we can't verify — don't block the link
                return {"ok": True, "has_manage_events": True, "error": ""}

            guild = guild_resp.json()
            roles_by_id: dict[str, int] = {
                r["id"]: int(r.get("permissions", 0))
                for r in guild.get("roles", [])
            }

            # Compute effective permissions for the bot
            effective: int = roles_by_id.get(guild_id, 0)  # @everyone role has same ID as guild
            for rid in role_ids:
                effective |= roles_by_id.get(rid, 0)

            has_manage = (
                bool(effective & _PERM_MANAGE_EVENTS)
                or bool(effective & _PERM_CREATE_EVENTS)
                or bool(effective & (1 << 3))  # ADMINISTRATOR
            )
            return {"ok": True, "has_manage_events": has_manage, "error": ""}

        except httpx.RequestError as exc:
            return {"ok": False, "has_manage_events": False, "error": str(exc)}


# ──────────────────────────────────────────────────────────────────────────────
# Banner handling
# ──────────────────────────────────────────────────────────────────────────────


async def _fetch_banner_data_uri(banner_url: str) -> tuple[Optional[str], Optional[str]]:
    """Download an image URL and return a base64 data URI for the Discord API.

    Returns (data_uri, error). The caller decides whether a missing banner
    should make the mirror retryable.
    """
    if banner_url.startswith("data:image/"):
        try:
            header, encoded = banner_url.split(",", 1)
        except ValueError:
            return None, "image rejected: malformed data URL"
        if ";base64" not in header:
            return None, "image rejected: data URL must be base64 encoded"
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            return None, "image rejected: invalid base64 data"
        if len(raw) > _MAX_BANNER_BYTES:
            return None, "image rejected: file is larger than 10 MB"
        return banner_url, None

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(banner_url, follow_redirects=True)
        if resp.status_code != 200:
            return None, f"image fetch failed: HTTP {resp.status_code}"
        content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()
        if not content_type.startswith("image/"):
            return None, f"image rejected: unsupported content type {content_type}"
        raw = resp.content
        if len(raw) > _MAX_BANNER_BYTES:
            logger.warning("discord_banner_too_large", url=banner_url, size=len(raw))
            return None, "image rejected: file is larger than 10 MB"
        b64 = base64.b64encode(raw).decode()
        return f"data:{content_type};base64,{b64}", None
    except Exception as exc:
        logger.warning("discord_banner_fetch_failed", url=banner_url, error=str(exc))
        return None, f"image fetch failed: {exc}"


def _banner_hash(banner_url: Optional[str]) -> Optional[str]:
    if not banner_url:
        return None
    return hashlib.sha256(banner_url.encode()).hexdigest()[:32]


# ──────────────────────────────────────────────────────────────────────────────
# Payload builder
# ──────────────────────────────────────────────────────────────────────────────


def _to_discord_ts(iso: str) -> str:
    """Convert an ISO datetime string to Discord's required UTC format."""
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _rrule_to_discord_recurrence(rrule_str: str, dtstart_iso: str) -> Optional[dict[str, Any]]:
    """Convert our RRULE string to a Discord recurrence_rule object.

    Discord frequency:   0=YEARLY  1=MONTHLY  2=WEEKLY  3=DAILY
    Discord by_weekday:  0=Mon … 6=Sun  (identical to our _BYDAY_MAP)

    Returns None if the RRULE is unsupported or malformed.
    """
    rule = _parse_rrule(rrule_str)
    if rule is None:
        return None

    freq_map = {"YEARLY": 0, "MONTHLY": 1, "WEEKLY": 2, "DAILY": 3}
    freq_int = freq_map.get(rule.freq)
    if freq_int is None:
        return None

    recurrence: dict[str, Any] = {
        "start": _to_discord_ts(dtstart_iso),
        "end": None,
        "frequency": freq_int,
        "interval": rule.interval,
    }

    if rule.byday:
        recurrence["by_weekday"] = rule.byday

    if rule.count:
        recurrence["count"] = rule.count

    if rule.until:
        recurrence["end"] = rule.until.strftime("%Y-%m-%dT%H:%M:%SZ")

    return recurrence


def _build_event_payload(
    occ: OccurrenceSpec,
    *,
    image_data_uri: Optional[str] = None,
    description: Optional[str] = None,
    recurrence_rule: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Build the Discord Guild Scheduled Event create/update payload."""
    payload: dict[str, Any] = {
        "name": occ.title or "Raid Session",
        "scheduled_start_time": _to_discord_ts(occ.start_time),
        "scheduled_end_time": _to_discord_ts(occ.end_time),
        "entity_type": _ENTITY_TYPE_EXTERNAL,
        "privacy_level": _PRIVACY_GUILD_ONLY,
        "entity_metadata": {"location": "FFXIV"},
    }
    if description or occ.description:
        payload["description"] = (description or occ.description or "")[:1000]
    if image_data_uri:
        payload["image"] = image_data_uri
    if recurrence_rule:
        payload["recurrence_rule"] = recurrence_rule
    return payload


def _format_time_range(occ: OccurrenceSpec) -> str:
    try:
        start = datetime.fromisoformat(occ.start_time)
        end = datetime.fromisoformat(occ.end_time)
        return f"{start.strftime('%b %d, %Y %H:%M')} - {end.strftime('%H:%M %Z')}".strip()
    except ValueError:
        return f"{occ.start_time} - {occ.end_time}"


def _category_label(category: str | None) -> str:
    labels = {
        "raid": "Raid Event",
        "ultimate": "Ultimate",
        "farm": "Mount Farm",
        "reclear": "Reclear",
        "prog": "Progression",
        "social": "Social",
        "other": "Other",
    }
    return labels.get(category or "", "Raid Event")


def _planner_url(share_code: str | None, session_id: str) -> str | None:
    if not share_code:
        return None
    return f"{get_settings().public_app_base_url.rstrip('/')}/group/{share_code}?tab=schedule&sessionId={session_id}"


def _build_event_description(
    *,
    session: ScheduleSession,
    occ: OccurrenceSpec,
    static_group_name: str | None = None,
    static_share_code: str | None = None,
    discord_guild_name: str | None = None,
    native_recurring: bool = False,
) -> str:
    category = getattr(session, "category", None)
    content_name = getattr(session, "content_name", None)
    planner_url = _planner_url(static_share_code, session.id)
    header = f"{_category_label(category)}: {occ.title or session.title}"

    lines = [
        header,
        "",
        f"Time: {_format_time_range(occ)}",
    ]
    if session.is_recurring:
        if native_recurring:
            lines.append("Series: recurring XIVRaidPlanner event series.")
            lines.append("Discord uses one native recurring scheduled event for this series.")
        else:
            lines.append("Series: one occurrence in a recurring XIVRaidPlanner event series.")
            lines.append("Future occurrences mirror on a rolling 4-week window.")
    if category:
        lines.append(f"Type: {_category_label(category)}")
    if content_name:
        lines.append(f"Content: {content_name}")
    if static_group_name:
        lines.append(f"Static: {static_group_name}")
    if discord_guild_name:
        lines.append(f"Server: {discord_guild_name}")
    if occ.description:
        lines.extend(["", "Notes:", occ.description])
    if planner_url:
        lines.extend(["", "RSVP / full details:", planner_url])

    return "\n".join(lines)[:1000]


# ──────────────────────────────────────────────────────────────────────────────
# Mirror window management
# ──────────────────────────────────────────────────────────────────────────────


async def sync_session_mirror(
    *,
    session: ScheduleSession,
    settings: ScheduleSettings | None = None,
    discord_link: StaticDiscordLink | None = None,
    mirrors: list[ScheduleDiscordMirror],
    exceptions: dict[str, ScheduleException],
    db_add: Any,
    db_delete: Any,
    now: Optional[datetime] = None,
    static_group_name: str | None = None,
    static_share_code: str | None = None,
) -> list[str]:
    """Sync Discord Guild Scheduled Events for one ScheduleSession.

    The app event/series remains the source of truth. Clean recurring sessions
    sync as one native Discord recurring event. Series with app-side exceptions
    fall back to concrete rolling-window mirrors so edited/cancelled occurrences
    stay faithful.

    Token resolution:
      - If ``discord_link`` is provided and status == 'connected', uses the app
        bot token from DISCORD_BOT_TOKEN env var with discord_link.discord_guild_id.
      - Falls back to legacy settings.discord_bot_token + settings.discord_guild_id
        if the app token is not configured (self-hosted setups).
    """
    # Resolve guild_id and bot_token
    guild_id: str = ""
    bot_token: str = ""

    if discord_link and discord_link.status in _SYNCABLE_LINK_STATUSES:
        guild_id = discord_link.discord_guild_id
        bot_token = get_settings().discord_bot_token
        if not bot_token:
            logger.warning("discord_sync_skipped_no_app_token", group=session.static_group_id)

    if not guild_id or not bot_token:
        if settings and getattr(settings, "discord_bot_token", None) and getattr(settings, "discord_guild_id", None):
            bot_token = settings.discord_bot_token  # type: ignore[assignment]
            guild_id = settings.discord_guild_id  # type: ignore[assignment]

    if not guild_id or not bot_token:
        return ["skipped: no bot token or guild id configured"]

    if now is None:
        now = datetime.now(timezone.utc)

    now_iso = now.isoformat()
    log: list[str] = []

    if getattr(session, "mirror_to_discord", True) is False:
        for mirror in mirrors:
            if mirror.discord_scheduled_event_id:
                ok, err = await _delete_guild_event(bot_token, guild_id, mirror.discord_scheduled_event_id)
                log.append(f"deleted discord event for {mirror.occurrence_date}: {'ok' if ok else err}")
            db_delete(mirror)
        if not log:
            log.append("skipped: Discord Event mirror disabled for this session")
        return log

    occ_kwargs = dict(
        session_title=session.title,
        session_description=session.description,
        session_banner_url=getattr(session, "banner_url", None),
        session_banner_key=getattr(session, "banner_key", None),
        session_banner_source_type=getattr(session, "banner_source_type", None),
    )

    mirror_map: dict[str, ScheduleDiscordMirror] = {
        m.occurrence_date or "__single__": m for m in mirrors
    }

    # Prefer a native Discord recurring event for clean recurring sessions.
    # If occurrence exceptions exist, fall back to concrete app-generated
    # mirrors so edited/cancelled single occurrences remain faithful.
    if session.is_recurring and session.recurrence_rule and not exceptions:
        occ = next_occurrence(
            session.start_time,
            session.end_time,
            session.recurrence_rule,
            after=now - timedelta(hours=1),
            exceptions={},
            timezone_name=getattr(session, "timezone", None),
            **occ_kwargs,
        )
        recurrence_rule = _rrule_to_discord_recurrence(session.recurrence_rule, occ.start_time) if occ else None

        if occ and recurrence_rule:
            # Remove any stale concrete rolling-window mirrors for this series.
            for mirror in mirrors:
                if mirror.occurrence_date is None:
                    continue
                if mirror.discord_scheduled_event_id:
                    ok, err = await _delete_guild_event(bot_token, guild_id, mirror.discord_scheduled_event_id)
                    log.append(f"deleted discord event for {mirror.occurrence_date}: {'ok' if ok else err}")
                db_delete(mirror)

            native_mirrors = [m for m in mirrors if m.occurrence_date is None]
            mirror = native_mirrors[0] if native_mirrors else None
            for duplicate in native_mirrors[1:]:
                if duplicate.discord_scheduled_event_id:
                    ok, err = await _delete_guild_event(bot_token, guild_id, duplicate.discord_scheduled_event_id)
                    log.append(f"deleted duplicate recurring discord event: {'ok' if ok else err}")
                db_delete(duplicate)

            banner_url = occ.banner_url
            new_hash = _banner_hash(banner_url)
            image_data_uri = None
            banner_error = None
            event_description = _build_event_description(
                session=session,
                occ=occ,
                static_group_name=static_group_name,
                static_share_code=static_share_code,
                discord_guild_name=discord_link.discord_guild_name if discord_link else None,
                native_recurring=True,
            )

            if banner_url and (mirror is None or new_hash != mirror.banner_hash_synced):
                image_data_uri, banner_error = await _fetch_banner_data_uri(banner_url)

            payload = _build_event_payload(
                occ,
                image_data_uri=image_data_uri,
                description=event_description,
                recurrence_rule=recurrence_rule,
            )

            if mirror is None:
                ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                sync_ok = ok and banner_error is None
                new_mirror = ScheduleDiscordMirror(
                    id=_new_id(),
                    session_id=session.id,
                    occurrence_date=None,
                    discord_guild_id=guild_id,
                    discord_scheduled_event_id=body.get("id", "") if ok else "",
                    sync_status="synced" if sync_ok else "failed",
                    last_synced_at=now_iso if ok else None,
                    last_error=(banner_error if ok else err),
                    banner_hash_synced=new_hash if (ok and image_data_uri) else None,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
                db_add(new_mirror)
                log.append(f"created recurring discord event: {'ok' if sync_ok else (banner_error or err)}")
            else:
                event_id = mirror.discord_scheduled_event_id
                if event_id:
                    ok, _, err = await _update_guild_event(bot_token, guild_id, event_id, payload)
                    if not ok and ("Unknown Guild Scheduled Event" in err or "10070" in err):
                        ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                        if ok:
                            mirror.discord_scheduled_event_id = body.get("id", "")
                        sync_ok = ok and banner_error is None
                        mirror.sync_status = "synced" if sync_ok else "failed"
                        mirror.last_synced_at = now_iso if ok else mirror.last_synced_at
                        mirror.last_error = (banner_error if ok else err)
                        if ok and image_data_uri:
                            mirror.banner_hash_synced = new_hash
                        mirror.updated_at = now_iso
                        log.append(f"recreated recurring discord event: {'ok' if sync_ok else (banner_error or err)}")
                        return log
                else:
                    ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                    if ok:
                        mirror.discord_scheduled_event_id = body.get("id", "")
                sync_ok = ok and banner_error is None
                mirror.sync_status = "synced" if sync_ok else "failed"
                mirror.last_synced_at = now_iso if ok else mirror.last_synced_at
                mirror.last_error = (banner_error if ok else err)
                if ok and image_data_uri:
                    mirror.banner_hash_synced = new_hash
                mirror.updated_at = now_iso
                log.append(f"updated recurring discord event: {'ok' if sync_ok else (banner_error or err)}")

            return log

    # ── Concrete app occurrences in a rolling window ─────────────────────────
    window_end = now + timedelta(days=_ROLLING_WINDOW_DAYS)

    tz_name = getattr(session, "timezone", None)
    if session.is_recurring and session.recurrence_rule:
        upcoming = generate_occurrences(
            session.start_time,
            session.end_time,
            session.recurrence_rule,
            after=now - timedelta(hours=1),
            count=20,
            exceptions=exceptions,
            timezone_name=tz_name,
            **occ_kwargs,
        )
        upcoming = [occ for occ in upcoming if _occ_start_dt(occ) <= window_end]
    else:
        occ = next_occurrence(
            session.start_time, session.end_time, None,
            after=now - timedelta(hours=1),
            exceptions=exceptions,
            timezone_name=tz_name,
            **occ_kwargs,
        )
        upcoming = [occ] if occ and _occ_start_dt(occ) <= window_end else []

    upcoming_dates = {o.occurrence_date for o in upcoming}

    # Delete stale mirrors
    for key, mirror in list(mirror_map.items()):
        real_date = mirror.occurrence_date
        if real_date not in upcoming_dates:
            if mirror.discord_scheduled_event_id:
                ok, err = await _delete_guild_event(bot_token, guild_id, mirror.discord_scheduled_event_id)
                log.append(f"deleted discord event for {real_date}: {'ok' if ok else err}")
            db_delete(mirror)

    for occ in upcoming:
        date_key = occ.occurrence_date
        mirror = mirror_map.get(date_key)
        banner_url = occ.banner_url
        new_hash = _banner_hash(banner_url)
        image_data_uri = None
        banner_error = None
        event_description = _build_event_description(
            session=session,
            occ=occ,
            static_group_name=static_group_name,
            static_share_code=static_share_code,
            discord_guild_name=discord_link.discord_guild_name if discord_link else None,
        )

        if mirror is None:
            if banner_url:
                image_data_uri, banner_error = await _fetch_banner_data_uri(banner_url)
            payload = _build_event_payload(occ, image_data_uri=image_data_uri, description=event_description)
            ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
            sync_ok = ok and banner_error is None
            new_mirror = ScheduleDiscordMirror(
                id=_new_id(),
                session_id=session.id,
                occurrence_date=occ.occurrence_date,
                discord_guild_id=guild_id,
                discord_scheduled_event_id=body.get("id", "") if ok else "",
                sync_status="synced" if sync_ok else "failed",
                last_synced_at=now_iso if ok else None,
                last_error=(banner_error if ok else err),
                banner_hash_synced=new_hash if (ok and image_data_uri) else None,
                created_at=now_iso,
                updated_at=now_iso,
            )
            db_add(new_mirror)
            log.append(f"created discord event for {date_key}: {'ok' if sync_ok else (banner_error or err)}")
        else:
            if mirror.sync_status == "failed" or _needs_update(mirror, occ, new_hash):
                if banner_url and new_hash != mirror.banner_hash_synced:
                    image_data_uri, banner_error = await _fetch_banner_data_uri(banner_url)
                payload = _build_event_payload(occ, image_data_uri=image_data_uri, description=event_description)
                event_id = mirror.discord_scheduled_event_id
                if event_id:
                    ok, _, err = await _update_guild_event(bot_token, guild_id, event_id, payload)
                    if not ok and ("Unknown Guild Scheduled Event" in err or "10070" in err):
                        if banner_url:
                            image_data_uri, banner_error = await _fetch_banner_data_uri(banner_url)
                        payload = _build_event_payload(occ, image_data_uri=image_data_uri, description=event_description)
                        ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                        if ok:
                            mirror.discord_scheduled_event_id = body.get("id", "")
                        sync_ok = ok and banner_error is None
                        mirror.sync_status = "synced" if sync_ok else "failed"
                        mirror.last_synced_at = now_iso if ok else mirror.last_synced_at
                        mirror.last_error = (banner_error if ok else err)
                        if ok and image_data_uri:
                            mirror.banner_hash_synced = new_hash
                        mirror.updated_at = now_iso
                        log.append(f"recreated discord event for {date_key}: {'ok' if sync_ok else (banner_error or err)}")
                        continue
                else:
                    ok, body, err = await _create_guild_event(bot_token, guild_id, payload)
                    if ok:
                        mirror.discord_scheduled_event_id = body.get("id", "")
                sync_ok = ok and banner_error is None
                mirror.sync_status = "synced" if sync_ok else "failed"
                mirror.last_synced_at = now_iso if ok else mirror.last_synced_at
                mirror.last_error = (banner_error if ok else err)
                if ok and image_data_uri:
                    mirror.banner_hash_synced = new_hash
                mirror.updated_at = now_iso
                log.append(f"updated discord event for {date_key}: {'ok' if sync_ok else (banner_error or err)}")
            else:
                log.append(f"no change for {date_key}")

    return log


async def delete_session_mirrors(
    *,
    session: ScheduleSession,
    settings: ScheduleSettings | None = None,
    discord_link: StaticDiscordLink | None = None,
    mirrors: list[ScheduleDiscordMirror],
    db_delete: Any,
) -> list[str]:
    """Delete all Discord Guild Scheduled Events mirrored for a session."""
    guild_id = ""
    bot_token = ""

    if discord_link and discord_link.status in _SYNCABLE_LINK_STATUSES:
        guild_id = discord_link.discord_guild_id
        bot_token = get_settings().discord_bot_token

    if not guild_id or not bot_token:
        if settings and getattr(settings, "discord_bot_token", None) and getattr(settings, "discord_guild_id", None):
            bot_token = settings.discord_bot_token  # type: ignore[assignment]
            guild_id = settings.discord_guild_id  # type: ignore[assignment]

    log: list[str] = []
    for mirror in mirrors:
        if guild_id and bot_token and mirror.discord_scheduled_event_id:
            ok, err = await _delete_guild_event(bot_token, guild_id, mirror.discord_scheduled_event_id)
            log.append(f"deleted discord event for {mirror.occurrence_date}: {'ok' if ok else err}")
        db_delete(mirror)
    if not log:
        log.append("no discord mirrors to delete")
    return log


async def sync_group_sessions_for_discord_link(
    *,
    db: Any,
    group_id: str,
    discord_link: StaticDiscordLink,
    now: Optional[datetime] = None,
) -> list[str]:
    """Sync all existing sessions after a Discord server is linked.

    Linking the bot should produce visible Discord scheduled events for the
    current app schedule without requiring the user to discover a second manual
    sync action. Individual sync failures are recorded on mirror rows and do not
    stop the rest of the static's sessions from attempting delivery.
    """
    settings_result = await db.execute(
        select(ScheduleSettings).where(ScheduleSettings.static_group_id == group_id)
    )
    settings = settings_result.scalar_one_or_none()

    static_result = await db.execute(
        select(StaticGroup).where(StaticGroup.id == group_id)
    )
    static_group = static_result.scalar_one_or_none()

    session_result = await db.execute(
        select(ScheduleSession)
        .where(ScheduleSession.static_group_id == group_id)
        .order_by(ScheduleSession.start_time.asc())
    )
    sessions = session_result.scalars().all()

    actions: list[str] = []
    for session in sessions:
        exc_result = await db.execute(
            select(ScheduleException).where(ScheduleException.session_id == session.id)
        )
        exceptions = {exc.occurrence_date: exc for exc in exc_result.scalars().all()}

        mirror_result = await db.execute(
            select(ScheduleDiscordMirror).where(ScheduleDiscordMirror.session_id == session.id)
        )
        mirrors = list(mirror_result.scalars().all())

        try:
            session_actions = await sync_session_mirror(
                session=session,
                settings=settings,
                discord_link=discord_link,
                mirrors=mirrors,
                exceptions=exceptions,
                db_add=db.add,
                db_delete=db.delete,
                now=now,
                static_group_name=static_group.name if static_group else None,
                static_share_code=static_group.share_code if static_group else None,
            )
            actions.extend(f"{session.title}: {action}" for action in session_actions)
        except Exception as exc:
            logger.warning(
                "discord_link_initial_sync_session_failed",
                group_id=group_id,
                session_id=session.id,
                error=str(exc),
            )
            actions.append(f"{session.title}: failed: {exc}")

    if not actions:
        actions.append("skipped: no sessions to sync")
    return actions


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
    if new_hash != mirror.banner_hash_synced:
        return True
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
