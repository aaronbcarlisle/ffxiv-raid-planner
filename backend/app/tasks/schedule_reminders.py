"""Background task for automatic schedule Discord reminders."""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import async_session_maker
from ..logging_config import get_logger
from ..models import Membership, MemberRole, SnapshotPlayer, StaticGroup, TierSnapshot
from ..models.schedule import ScheduleReminderDelivery, ScheduleRsvp, ScheduleSession, ScheduleSettings
from ..services.discord_webhook import (
    PlayerDetail,
    SessionAnnouncementData,
    _recurrence_rule_to_text,
    build_schedule_session_url,
    build_session_announcement_payload,
)
from ..services.schedule_webhooks import post_schedule_webhook, resolve_schedule_webhook

settings = get_settings()
logger = get_logger(__name__)

POLL_INTERVAL_SECONDS = 60
STARTUP_DELAY_SECONDS = 30
REMINDER_GRACE_MINUTES = 10
MAX_SESSIONS_PER_CYCLE = 300

BYDAY_TO_WEEKDAY = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4,
    "SA": 5,
    "SU": 6,
}


@dataclass(frozen=True)
class ReminderPreset:
    reminder_type: str
    minutes_before: int
    settings_attr: str


REMINDER_PRESETS = (
    ReminderPreset("at_start", 0, "enable_at_start_reminder"),
    ReminderPreset("15m", 15, "enable_15m_reminder"),
    ReminderPreset("1h", 60, "enable_1h_reminder"),
    ReminderPreset("6h", 360, "enable_6h_reminder"),
    ReminderPreset("12h", 720, "enable_12h_reminder"),
    ReminderPreset("24h", 1440, "enable_24h_reminder"),
)


def _parse_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _session_zone(session: ScheduleSession) -> ZoneInfo:
    try:
        return ZoneInfo(session.timezone)
    except ZoneInfoNotFoundError:
        logger.warning("schedule_reminder_invalid_timezone", session_id=session.id, timezone=session.timezone)
        return ZoneInfo("UTC")


def _parse_byday(rule: str | None) -> list[str]:
    if not rule:
        return []
    parts = dict(part.split("=", 1) for part in rule.upper().split(";") if "=" in part)
    if parts.get("FREQ") != "WEEKLY":
        return []
    return [day for day in parts.get("BYDAY", "").split(",") if day in BYDAY_TO_WEEKDAY]


def _combine_local(day: date, local_time: time, zone: ZoneInfo) -> datetime:
    return datetime.combine(
        day,
        time(
            hour=local_time.hour,
            minute=local_time.minute,
            second=local_time.second,
            microsecond=local_time.microsecond,
        ),
        tzinfo=zone,
    )


def _candidate_occurrences(session: ScheduleSession, now: datetime) -> list[datetime]:
    base_start = _parse_datetime(session.start_time)
    if base_start is None:
        return []

    if not session.is_recurring:
        return [base_start]

    zone = _session_zone(session)
    base_local = base_start.astimezone(zone)
    now_local = now.astimezone(zone)
    bydays = _parse_byday(session.recurrence_rule)
    if not bydays:
        return [base_start]

    week_start = now_local.date() - timedelta(days=now_local.weekday())
    occurrences: list[datetime] = []
    for week_offset in (-1, 0, 1):
        week = week_start + timedelta(days=7 * week_offset)
        for byday in bydays:
            local_day = week + timedelta(days=BYDAY_TO_WEEKDAY[byday])
            occurrence_local = _combine_local(local_day, base_local.timetz(), zone)
            occurrence_utc = occurrence_local.astimezone(timezone.utc)
            if occurrence_utc >= base_start:
                occurrences.append(occurrence_utc)

    return sorted(set(occurrences))


def _enabled_presets(row: ScheduleSettings) -> list[ReminderPreset]:
    return [preset for preset in REMINDER_PRESETS if bool(getattr(row, preset.settings_attr, False))]


def _due_reminders(
    row: ScheduleSettings,
    session: ScheduleSession,
    now: datetime,
) -> list[tuple[ReminderPreset, datetime]]:
    grace = timedelta(minutes=REMINDER_GRACE_MINUTES)
    due: list[tuple[ReminderPreset, datetime]] = []
    for occurrence in _candidate_occurrences(session, now):
        for preset in _enabled_presets(row):
            due_at = occurrence - timedelta(minutes=preset.minutes_before)
            if due_at <= now < due_at + grace:
                due.append((preset, occurrence))
    return due


async def _member_count(db, group_id: str) -> int:
    result = await db.execute(
        select(Membership.id).where(
            Membership.static_group_id == group_id,
            Membership.role != MemberRole.VIEWER.value,
        )
    )
    return len(result.scalars().all())


async def _player_map(db, group_id: str) -> dict[str, SnapshotPlayer]:
    tier_result = await db.execute(
        select(TierSnapshot.id).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.is_active.is_(True),
        )
    )
    tier_id = tier_result.scalar_one_or_none()
    if not tier_id:
        return {}

    player_result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.tier_snapshot_id == tier_id,
            SnapshotPlayer.user_id.isnot(None),
        )
    )
    return {player.user_id: player for player in player_result.scalars().all()}


def _shift_end_time(session: ScheduleSession, occurrence: datetime) -> str:
    start = _parse_datetime(session.start_time)
    end = _parse_datetime(session.end_time)
    if start is None or end is None:
        return session.end_time
    return (occurrence + (end - start)).isoformat()


def _announcement_data(
    session: ScheduleSession,
    group: StaticGroup,
    occurrence: datetime,
    member_count: int,
    player_map: dict[str, SnapshotPlayer],
    mention_target: str,
    mention_role_id: str | None,
) -> SessionAnnouncementData:
    rsvp_counts: dict[str, int] = {}
    unavailable_players: list[PlayerDetail] = []
    tentative_players: list[PlayerDetail] = []

    for rsvp in session.rsvps:
        rsvp_counts[rsvp.status] = rsvp_counts.get(rsvp.status, 0) + 1
        player = player_map.get(rsvp.user_id)
        detail = PlayerDetail(
            name=player.name if player else (rsvp.user.discord_username if rsvp.user else "Unknown"),
            position=player.position if player else None,
            job=player.job if player and player.job else None,
        )
        if rsvp.status == "unavailable":
            unavailable_players.append(detail)
        elif rsvp.status == "tentative":
            tentative_players.append(detail)

    return SessionAnnouncementData(
        session_title=session.title,
        start_iso=occurrence.isoformat(),
        end_iso=_shift_end_time(session, occurrence),
        static_group_name=group.name,
        session_url=build_schedule_session_url(settings.public_app_base_url, group.share_code, session.id),
        rsvp_counts=rsvp_counts,
        total_member_count=member_count,
        session_description=session.description,
        recurrence_summary=_recurrence_rule_to_text(session.recurrence_rule),
        unavailable_players=unavailable_players,
        tentative_players=tentative_players,
        mention_target=mention_target,
        mention_role_id=mention_role_id,
        track_availability=getattr(session, "track_availability", True),
    )


async def _already_sent(db, session_id: str, reminder_type: str, occurrence_start_time: str) -> bool:
    result = await db.execute(
        select(ScheduleReminderDelivery.id).where(
            ScheduleReminderDelivery.session_id == session_id,
            ScheduleReminderDelivery.reminder_type == reminder_type,
            ScheduleReminderDelivery.occurrence_start_time == occurrence_start_time,
        )
    )
    return result.scalar_one_or_none() is not None


async def run_schedule_reminder_cycle(now: datetime | None = None) -> int:
    """Send all automatic schedule reminders that are due right now."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    sent = 0

    async with async_session_maker() as db:
        settings_result = await db.execute(
            select(ScheduleSettings).where(ScheduleSettings.webhook_url.isnot(None))
        )
        settings_rows = settings_result.scalars().all()

        for row in settings_rows:
            destination = resolve_schedule_webhook(row)
            presets = _enabled_presets(row)
            if not destination or not presets:
                continue

            group = await db.get(StaticGroup, row.static_group_id)
            if not group:
                continue

            sessions_result = await db.execute(
                select(ScheduleSession)
                .where(ScheduleSession.static_group_id == row.static_group_id)
                .options(selectinload(ScheduleSession.rsvps).selectinload(ScheduleRsvp.user))
                .limit(MAX_SESSIONS_PER_CYCLE)
            )
            sessions = sessions_result.scalars().all()
            if not sessions:
                continue

            member_count = await _member_count(db, row.static_group_id)
            players = await _player_map(db, row.static_group_id)

            for schedule_session in sessions:
                for preset, occurrence in _due_reminders(row, schedule_session, now):
                    occurrence_iso = occurrence.isoformat()
                    if await _already_sent(db, schedule_session.id, preset.reminder_type, occurrence_iso):
                        continue

                    data = _announcement_data(
                        schedule_session,
                        group,
                        occurrence,
                        member_count,
                        players,
                        destination.mention_target,
                        destination.mention_role_id,
                    )
                    payload = build_session_announcement_payload(data)
                    ok, status_code, delivery_error = await post_schedule_webhook(
                        destination, payload, timeout=10.0
                    )
                    if not ok:
                        logger.warning(
                            "schedule_reminder_delivery_failed",
                            group_id=row.static_group_id,
                            session_id=schedule_session.id,
                            reminder_type=preset.reminder_type,
                            occurrence_start_time=occurrence_iso,
                            http_status=status_code,
                            error=delivery_error,
                        )
                        continue

                    db.add(
                        ScheduleReminderDelivery(
                            id=str(uuid.uuid4()),
                            session_id=schedule_session.id,
                            reminder_type=preset.reminder_type,
                            occurrence_start_time=occurrence_iso,
                            sent_at=now.isoformat(),
                        )
                    )
                    try:
                        await db.commit()
                    except IntegrityError:
                        await db.rollback()
                        continue

                    sent += 1
                    logger.info(
                        "schedule_reminder_sent",
                        group_id=row.static_group_id,
                        session_id=schedule_session.id,
                        reminder_type=preset.reminder_type,
                        occurrence_start_time=occurrence_iso,
                    )

    return sent


async def schedule_reminder_loop() -> None:
    """Run schedule reminders on a repeating interval."""
    await asyncio.sleep(STARTUP_DELAY_SECONDS)

    while True:
        try:
            await run_schedule_reminder_cycle()
        except Exception as exc:
            logger.error("schedule_reminder_loop_error", error=str(exc))
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
