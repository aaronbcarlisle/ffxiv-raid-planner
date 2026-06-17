"""Tests for Discord Guild Scheduled Event mirroring."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.schedule import ScheduleDiscordMirror, ScheduleException, ScheduleSession, StaticDiscordLink
from app.services.discord_guild_events import sync_session_mirror

pytestmark = pytest.mark.asyncio


def _session() -> ScheduleSession:
    return ScheduleSession(
        id="session-1",
        static_group_id="group-1",
        created_by_id="user-1",
        title="Weekly Prog",
        start_time="2099-07-05T12:00:00+00:00",
        end_time="2099-07-05T15:00:00+00:00",
        timezone="UTC",
        is_recurring=True,
        recurrence_rule="FREQ=WEEKLY;BYDAY=SU",
    )


def _link() -> StaticDiscordLink:
    return StaticDiscordLink(
        id="link-1",
        static_group_id="group-1",
        discord_guild_id="guild-1",
        discord_guild_name="Color's server",
        linked_by_user_id="user-1",
        status="connected",
    )


async def test_recurring_mirror_uses_native_discord_recurrence_when_no_exceptions():
    added: list[ScheduleDiscordMirror] = []
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": f"event-{len(created_payloads)}"}, ""

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        actions = await sync_session_mirror(
            session=_session(),
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert len(added) == 1
    assert added[0].occurrence_date is None
    assert created_payloads[0]["recurrence_rule"]["frequency"] == 2
    assert created_payloads[0]["recurrence_rule"]["by_weekday"] == [6]
    assert actions[0].startswith("created recurring discord event")


async def test_discord_payload_converts_offset_times_to_utc():
    session = _session()
    session.start_time = "2099-07-05T21:00:00+09:00"
    session.end_time = "2099-07-06T00:00:00+09:00"
    session.timezone = "Asia/Tokyo"
    added: list[ScheduleDiscordMirror] = []
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": "event-1"}, ""

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert created_payloads[0]["scheduled_start_time"] == "2099-07-05T12:00:00Z"
    assert created_payloads[0]["scheduled_end_time"] == "2099-07-05T15:00:00Z"
    assert created_payloads[0]["recurrence_rule"]["start"] == "2099-07-05T12:00:00Z"


async def test_recurring_mirror_uses_concrete_window_when_exceptions_exist():
    added: list[ScheduleDiscordMirror] = []
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": f"event-{len(created_payloads)}"}, ""

    exceptions = {
        "2099-07-12": ScheduleException(
            id="exception-1",
            session_id="session-1",
            occurrence_date="2099-07-12",
            type="cancelled",
            created_by_id="user-1",
        )
    }

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        actions = await sync_session_mirror(
            session=_session(),
            discord_link=_link(),
            mirrors=[],
            exceptions=exceptions,
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert len(added) == 3
    assert [mirror.occurrence_date for mirror in added] == [
        "2099-07-05",
        "2099-07-19",
        "2099-07-26",
    ]
    assert all("recurrence_rule" not in payload for payload in created_payloads)
    assert actions[0].startswith("created discord event for 2099-07-05")


async def test_event_payload_includes_rich_description_and_planner_link():
    session = _session()
    session.category = "ultimate"
    session.content_name = "Dancing Mad (Ultimate)"
    session.description = "P4 prog and cleanup."
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": "event-1"}, ""

    with (
        patch(
            "app.services.discord_guild_events.get_settings",
            return_value=SimpleNamespace(
                discord_bot_token="bot-token",
                public_app_base_url="https://www.xivraidplanner.app",
            ),
        ),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=lambda _row: None,
            db_delete=lambda _row: None,
            static_group_name="Dev Test Static",
            static_share_code="E1FPZK",
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    description = created_payloads[0]["description"]
    assert "Ultimate: Weekly Prog" in description
    assert "Content: Dancing Mad (Ultimate)" in description
    assert "Static: Dev Test Static" in description
    assert "Server: Color's server" in description
    assert "P4 prog and cleanup." in description
    assert "https://www.xivraidplanner.app/group/E1FPZK?tab=schedule&sessionId=session-1" in description


async def test_event_with_banner_sends_discord_image_field():
    session = _session()
    session.banner_url = "https://cdn.example.test/banner.png"
    added: list[ScheduleDiscordMirror] = []
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": "event-1"}, ""

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch(
            "app.services.discord_guild_events._fetch_banner_data_uri",
            new=AsyncMock(return_value=("data:image/png;base64,abc123", None)),
        ),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert created_payloads[0]["image"] == "data:image/png;base64,abc123"
    assert added[0].sync_status == "synced"
    assert added[0].banner_hash_synced
    assert added[0].last_error is None


async def test_banner_failure_marks_mirror_failed_without_blocking_event_create():
    session = _session()
    session.banner_url = "https://cdn.example.test/not-an-image.txt"
    added: list[ScheduleDiscordMirror] = []

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch(
            "app.services.discord_guild_events._fetch_banner_data_uri",
            new=AsyncMock(return_value=(None, "image rejected: unsupported content type text/plain")),
        ),
        patch(
            "app.services.discord_guild_events._create_guild_event",
            new=AsyncMock(return_value=(True, {"id": "event-1"}, "")),
        ),
    ):
        actions = await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert added[0].discord_scheduled_event_id == "event-1"
    assert added[0].sync_status == "failed"
    assert added[0].last_error == "image rejected: unsupported content type text/plain"
    assert "image rejected: unsupported content type text/plain" in actions[0]


async def test_uploaded_data_url_banner_is_sent_without_fetching():
    session = _session()
    session.banner_url = "data:image/png;base64,YWJj"
    created_payloads: list[dict] = []

    async def fake_create(_token, _guild, payload):
        created_payloads.append(payload)
        return True, {"id": "event-1"}, ""

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._create_guild_event", new=AsyncMock(side_effect=fake_create)),
    ):
        await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[],
            exceptions={},
            db_add=lambda _row: None,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert created_payloads[0]["image"] == "data:image/png;base64,YWJj"


async def test_mirror_disabled_deletes_existing_discord_events():
    session = _session()
    session.mirror_to_discord = False
    deleted: list[ScheduleDiscordMirror] = []
    existing = ScheduleDiscordMirror(
        id="mirror-1",
        session_id="session-1",
        occurrence_date="2099-07-05",
        discord_guild_id="guild-1",
        discord_scheduled_event_id="event-1",
        sync_status="synced",
    )

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._delete_guild_event", new=AsyncMock(return_value=(True, ""))),
    ):
        actions = await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[existing],
            exceptions={},
            db_add=lambda _row: None,
            db_delete=deleted.append,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert deleted == [existing]
    assert actions == ["deleted discord event for 2099-07-05: ok"]


async def test_unknown_discord_event_is_recreated_on_sync():
    session = _session()
    added: list[ScheduleDiscordMirror] = []
    deleted: list[ScheduleDiscordMirror] = []
    existing = ScheduleDiscordMirror(
        id="mirror-stale",
        session_id="session-1",
        occurrence_date="2099-07-05",
        discord_guild_id="guild-1",
        discord_scheduled_event_id="deleted-event",
        sync_status="failed",
        last_error='HTTP 404: {"message": "Unknown Guild Scheduled Event", "code": 10070}',
    )

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch(
            "app.services.discord_guild_events._update_guild_event",
            new=AsyncMock(return_value=(False, {}, 'HTTP 404: {"message": "Unknown Guild Scheduled Event", "code": 10070}')),
        ),
        patch(
            "app.services.discord_guild_events._create_guild_event",
            new=AsyncMock(return_value=(True, {"id": "replacement-event"}, "")),
        ),
        patch("app.services.discord_guild_events._delete_guild_event", new=AsyncMock(return_value=(True, ""))),
    ):
        actions = await sync_session_mirror(
            session=session,
            discord_link=_link(),
            mirrors=[existing],
            exceptions={},
            db_add=added.append,
            db_delete=deleted.append,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert deleted == [existing]
    assert len(added) == 1
    assert added[0].occurrence_date is None
    assert added[0].discord_scheduled_event_id == "replacement-event"
    assert added[0].sync_status == "synced"
    assert any(action == "created recurring discord event: ok" for action in actions)


async def test_cancelled_occurrence_deletes_only_that_mirror_and_keeps_future():
    deleted: list[ScheduleDiscordMirror] = []
    existing_cancelled = ScheduleDiscordMirror(
        id="mirror-cancelled",
        session_id="session-1",
        occurrence_date="2099-07-05",
        discord_guild_id="guild-1",
        discord_scheduled_event_id="event-cancelled",
        sync_status="synced",
    )
    existing_future = ScheduleDiscordMirror(
        id="mirror-future",
        session_id="session-1",
        occurrence_date="2099-07-12",
        discord_guild_id="guild-1",
        discord_scheduled_event_id="event-future",
        sync_status="synced",
        last_synced_at=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc).isoformat(),
    )
    cancelled = ScheduleException(
        id="exception-1",
        session_id="session-1",
        occurrence_date="2099-07-05",
        type="cancelled",
        created_by_id="user-1",
    )

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch("app.services.discord_guild_events._delete_guild_event", new=AsyncMock(return_value=(True, ""))),
    ):
        await sync_session_mirror(
            session=_session(),
            discord_link=_link(),
            mirrors=[existing_cancelled, existing_future],
            exceptions={"2099-07-05": cancelled},
            db_add=lambda _row: None,
            db_delete=deleted.append,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert deleted == [existing_cancelled]
    assert existing_future not in deleted


async def test_permission_missing_link_still_attempts_sync_and_records_api_error():
    link = _link()
    link.status = "permission_missing"
    added: list[ScheduleDiscordMirror] = []

    with (
        patch("app.services.discord_guild_events.get_settings", return_value=SimpleNamespace(discord_bot_token="bot-token")),
        patch(
            "app.services.discord_guild_events._create_guild_event",
            new=AsyncMock(return_value=(False, {}, "HTTP 403: missing permission")),
        ),
    ):
        actions = await sync_session_mirror(
            session=_session(),
            discord_link=link,
            mirrors=[],
            exceptions={},
            db_add=added.append,
            db_delete=lambda _row: None,
            now=datetime(2099, 7, 5, 10, 0, tzinfo=timezone.utc),
        )

    assert len(added) == 1
    assert added[0].occurrence_date is None
    assert added[0].sync_status == "failed"
    assert added[0].last_error == "HTTP 403: missing permission"
    assert "HTTP 403: missing permission" in actions[0]
