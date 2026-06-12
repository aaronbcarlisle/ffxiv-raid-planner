"""Tests for schedule/session endpoints"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth_utils import create_access_token
from app.models import MemberRole, ScheduleReminderDelivery, ScheduleRsvp, ScheduleSession, ScheduleSettings, User
from app.services.discord_webhook import (
    _next_occurrence_iso,
    _recurrence_rule_to_text,
    compute_rsvp_hash,
)
from app.services.schedule_webhooks import resolve_schedule_webhook
from app.tasks.schedule_reminders import run_schedule_reminder_cycle
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio


@pytest.fixture
def session_data():
    return {
        "title": "Weekly Raid Night",
        "startTime": "2026-06-01T12:00:00+00:00",
        "endTime": "2026-06-01T15:00:00+00:00",
        "timezone": "Asia/Tokyo",
        "isRecurring": True,
        "recurrenceRule": "FREQ=WEEKLY;BYDAY=SA",
    }


@pytest_asyncio.fixture
async def member_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="member_discord_id", discord_username="member")


@pytest_asyncio.fixture
async def viewer_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="viewer_discord_id", discord_username="viewer")


@pytest.fixture
def member_headers(member_user: User) -> dict[str, str]:
    token = create_access_token(member_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers(viewer_user: User) -> dict[str, str]:
    token = create_access_token(viewer_user.id)
    return {"Authorization": f"Bearer {token}"}


class TestScheduleCreate:
    async def test_owner_can_create_session(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Weekly Raid Night"
        assert data["timezone"] == "Asia/Tokyo"
        assert data["isRecurring"] is True
        assert data["trackAvailability"] is True
        assert data["rsvps"] == []

    async def test_owner_can_create_ultimate_session_without_availability_tracking(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                **session_data,
                "isRecurring": False,
                "recurrenceRule": None,
                "category": "ultimate",
                "contentId": "ult-fru",
                "contentName": "Futures Rewritten (Ultimate)",
                "trackAvailability": False,
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "ultimate"
        assert data["contentName"] == "Futures Rewritten (Ultimate)"
        assert data["trackAvailability"] is False

    async def test_lead_can_create_session(
        self, client: AsyncClient, session: AsyncSession, test_group, session_data
    ):
        lead = await create_user(session, discord_id="lead_id", discord_username="lead")
        await create_membership(session, lead, test_group, role=MemberRole.LEAD)
        token = create_access_token(lead.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=headers,
        )
        assert response.status_code == 201

    async def test_member_cannot_create_session(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=member_headers,
        )
        assert response.status_code == 403

    async def test_create_session_with_available_initial_rsvp_seeds_current_members(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        viewer_user,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await create_membership(session, viewer_user, test_group, role=MemberRole.VIEWER)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "available"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        rsvps = response.json()["rsvps"]
        assert len(rsvps) == 2
        assert {rsvp["status"] for rsvp in rsvps} == {"available"}
        assert {rsvp["userId"] for rsvp in rsvps} == {test_group.owner_id, member_user.id}

    async def test_create_session_with_tentative_initial_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "tentative"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        assert {rsvp["status"] for rsvp in response.json()["rsvps"]} == {"tentative"}

    async def test_create_session_with_unavailable_initial_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "unavailable"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        assert {rsvp["status"] for rsvp in response.json()["rsvps"]} == {"unavailable"}

    async def test_member_can_override_seeded_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        create_response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "available"},
            headers=auth_headers,
        )
        session_id = create_response.json()["id"]

        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "unavailable"},
            headers=member_headers,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"

        rsvp_result = await session.execute(
            select(ScheduleRsvp).where(
                ScheduleRsvp.session_id == session_id,
                ScheduleRsvp.user_id == member_user.id,
            )
        )
        member_rsvps = rsvp_result.scalars().all()
        assert len(member_rsvps) == 1
        assert member_rsvps[0].status == "unavailable"

    async def test_update_session_does_not_overwrite_seeded_rsvps(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        session_data,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        create_response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "available"},
            headers=auth_headers,
        )
        session_id = create_response.json()["id"]

        response = await client.put(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            json={"title": "Updated Raid Night", "initialRsvpStatus": "unavailable"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Updated Raid Night"
        assert {rsvp["status"] for rsvp in response.json()["rsvps"]} == {"available"}

        rsvp_result = await session.execute(
            select(ScheduleRsvp).where(ScheduleRsvp.session_id == session_id)
        )
        assert len(rsvp_result.scalars().all()) == 2

    async def test_invalid_initial_rsvp_status_is_rejected(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={**session_data, "initialRsvpStatus": "maybe"},
            headers=auth_headers,
        )

        assert response.status_code == 422


class TestScheduleList:
    async def test_member_can_list_sessions(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        # Owner creates a session
        await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )

        # Member can list
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.get(
            f"/api/static-groups/{test_group.id}/schedule",
            headers=member_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["title"] == "Weekly Raid Night"


class TestScheduleUpdate:
    async def test_owner_can_update_session(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            json={"title": "Updated Raid Night"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Raid Night"

    async def test_update_session_removes_friday_from_recurrence_after_refetch(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                **session_data,
                "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO,FR",
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        update_response = await client.put(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            json={"isRecurring": True, "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO"},
            headers=auth_headers,
        )

        assert update_response.status_code == 200
        assert update_response.json()["recurrenceRule"] == "FREQ=WEEKLY;BYDAY=MO"

        list_response = await client.get(
            f"/api/static-groups/{test_group.id}/schedule",
            headers=auth_headers,
        )
        persisted = list_response.json()[0]
        assert persisted["recurrenceRule"] == "FREQ=WEEKLY;BYDAY=MO"
        byday = persisted["recurrenceRule"].split("BYDAY=", 1)[1].split(";")[0].split(",")
        assert "FR" not in byday

    async def test_update_session_can_clear_recurrence_and_content(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                **session_data,
                "category": "farm",
                "contentId": "dt-worqor",
                "contentName": "Worqor Lar Dor (Extreme)",
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            json={
                "isRecurring": False,
                "recurrenceRule": None,
                "category": None,
                "contentId": None,
                "contentName": None,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["isRecurring"] is False
        assert response.json()["recurrenceRule"] is None
        assert response.json()["category"] is None
        assert response.json()["contentId"] is None
        assert response.json()["contentName"] is None

    async def test_member_cannot_update_session(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.put(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            json={"title": "Hacked"},
            headers=member_headers,
        )
        assert response.status_code == 403


class TestScheduleDelete:
    async def test_owner_can_delete_session(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify deleted
        list_resp = await client.get(
            f"/api/static-groups/{test_group.id}/schedule",
            headers=auth_headers,
        )
        assert len(list_resp.json()) == 0

    async def test_member_cannot_delete_session(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.delete(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}",
            headers=member_headers,
        )
        assert response.status_code == 403


class TestScheduleRsvp:
    async def test_member_can_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "available", "note": "Looking forward to it!"},
            headers=member_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "available"
        assert data["note"] == "Looking forward to it!"
        assert data["username"] == "member"

    async def test_member_can_update_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        # First RSVP
        await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "available"},
            headers=member_headers,
        )

        # Update RSVP
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "unavailable", "note": "Sorry, can't make it"},
            headers=member_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"

    async def test_viewer_cannot_rsvp(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        viewer_user,
        viewer_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, viewer_user, test_group, role=MemberRole.VIEWER)
        response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "available"},
            headers=viewer_headers,
        )
        assert response.status_code == 403

    async def test_rsvps_appear_in_session_list(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
        session_data,
    ):
        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await client.post(
            f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
            json={"status": "tentative"},
            headers=member_headers,
        )

        list_resp = await client.get(
            f"/api/static-groups/{test_group.id}/schedule",
            headers=auth_headers,
        )
        sessions = list_resp.json()
        assert len(sessions) == 1
        assert len(sessions[0]["rsvps"]) == 1
        assert sessions[0]["rsvps"][0]["status"] == "tentative"


class TestAvailability:
    async def test_member_can_submit_and_list_availability(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        submit_response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00", "03:30"]},
            headers=member_headers,
        )
        assert submit_response.status_code == 200
        assert submit_response.headers["cache-control"] == "no-store"
        submit_data = submit_response.json()
        assert submit_data["userId"] == member_user.id
        assert submit_data["username"] == "member"
        assert submit_data["date"] == "2026-06-01"
        assert submit_data["slots"] == ["03:00", "03:30"]

        list_response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=2026-05-31&end_date=2026-06-02",
            headers=member_headers,
        )
        assert list_response.status_code == 200
        assert list_response.headers["cache-control"] == "no-store"

        availability_by_date = {entry["date"]: entry for entry in list_response.json()}
        assert availability_by_date["2026-05-31"]["responses"] == []
        assert availability_by_date["2026-06-02"]["responses"] == []
        assert availability_by_date["2026-06-01"]["responses"] == [submit_data]

    async def test_submit_availability_updates_existing_date(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00", "03:30"]},
            headers=member_headers,
        )
        update_response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["04:00"]},
            headers=member_headers,
        )

        assert update_response.status_code == 200
        assert update_response.json()["slots"] == ["04:00"]

        list_response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=2026-06-01&end_date=2026-06-01",
            headers=member_headers,
        )
        responses = list_response.json()[0]["responses"]
        assert len(responses) == 1
        assert responses[0]["userId"] == member_user.id
        assert responses[0]["slots"] == ["04:00"]

    async def test_multiple_members_keep_separate_availability(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        owner_response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00"]},
            headers=auth_headers,
        )
        member_response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00", "03:30"]},
            headers=member_headers,
        )

        assert owner_response.status_code == 200
        assert member_response.status_code == 200

        list_response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=2026-06-01&end_date=2026-06-01",
            headers=auth_headers,
        )
        responses = list_response.json()[0]["responses"]

        assert len(responses) == 2
        assert {response["userId"] for response in responses} == {
            owner_response.json()["userId"],
            member_response.json()["userId"],
        }
        assert {response["username"] for response in responses} == {"testuser", "member"}

    async def test_viewer_cannot_submit_availability(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        viewer_user,
        viewer_headers,
    ):
        await create_membership(session, viewer_user, test_group, role=MemberRole.VIEWER)

        response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00"]},
            headers=viewer_headers,
        )

        assert response.status_code == 403

    async def test_list_availability_rejects_malformed_dates(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=not-a-date&end_date=2026-06-02",
            headers=member_headers,
        )

        assert response.status_code == 422


class TestScheduleIntegrations:
    async def test_owner_can_save_reminder_settings_masked(
        self, client: AsyncClient, test_group, auth_headers
    ):
        response = await client.put(
            f"/api/static-groups/{test_group.id}/scheduler/settings",
            json={
                "webhookUrl": "https://discord.com/api/webhooks/123/token-secret",
                "reminderChannelLabel": "raid-reminders",
                "enableAtStartReminder": True,
                "enable15mReminder": True,
                "enable24hReminder": True,
                "enable1hReminder": True,
                "enable6hReminder": True,
                "enable12hReminder": True,
                "enableMissingRsvpReminder": True,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["webhookConfigured"] is True
        assert payload["webhookUrlMasked"] != "https://discord.com/api/webhooks/123/token-secret"
        assert payload["enableAtStartReminder"] is True
        assert payload["enable15mReminder"] is True
        assert payload["enable24hReminder"] is True
        assert payload["enable1hReminder"] is True
        assert payload["enable6hReminder"] is True
        assert payload["enable12hReminder"] is True
        assert payload["enableMissingRsvpReminder"] is True

    async def test_member_cannot_edit_or_view_webhook_url(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await client.put(
            f"/api/static-groups/{test_group.id}/scheduler/settings",
            json={"webhookUrl": "https://discord.com/api/webhooks/123/token-secret"},
            headers=auth_headers,
        )
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        get_response = await client.get(
            f"/api/static-groups/{test_group.id}/scheduler/settings",
            headers=member_headers,
        )
        update_response = await client.put(
            f"/api/static-groups/{test_group.id}/scheduler/settings",
            json={"enable24hReminder": False},
            headers=member_headers,
        )

        assert get_response.status_code == 200
        assert get_response.json()["webhookConfigured"] is True
        assert get_response.json()["webhookUrlMasked"] is None
        assert update_response.status_code == 403

    async def test_calendar_token_feed_and_revoke(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json=session_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201

        token_response = await client.post(
            f"/api/static-groups/{test_group.id}/scheduler/calendar/regenerate",
            headers=auth_headers,
        )
        assert token_response.status_code == 200
        calendar_url = token_response.json()["calendarUrl"]
        token = calendar_url.rsplit("/api/calendar/", 1)[1].removesuffix(".ics")

        feed_response = await client.get(f"/api/calendar/{token}.ics")
        assert feed_response.status_code == 200
        assert "text/calendar" in feed_response.headers["content-type"]
        assert "BEGIN:VCALENDAR" in feed_response.text
        assert "Weekly Raid Night" in feed_response.text

        revoke_response = await client.post(
            f"/api/static-groups/{test_group.id}/scheduler/calendar/revoke",
            headers=auth_headers,
        )
        assert revoke_response.status_code == 200
        assert revoke_response.json()["calendarEnabled"] is False

        revoked_feed = await client.get(f"/api/calendar/{token}.ics")
        assert revoked_feed.status_code == 404

    async def test_calendar_feed_escapes_special_text(
        self, client: AsyncClient, test_group, auth_headers, session_data
    ):
        create_response = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                **session_data,
                "title": "Reclear, prog; cozy\\night",
                "description": "Bring food, pots; and\\vibes\nPhase 2",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201

        token_response = await client.post(
            f"/api/static-groups/{test_group.id}/scheduler/calendar/regenerate",
            headers=auth_headers,
        )
        token = token_response.json()["calendarUrl"].rsplit("/api/calendar/", 1)[1].removesuffix(".ics")

        feed_response = await client.get(f"/api/calendar/{token}.ics")

        assert feed_response.status_code == 200
        assert "SUMMARY:Reclear\\, prog\\; cozy\\\\night" in feed_response.text
        assert "DESCRIPTION:Bring food\\, pots\\; and\\\\vibes\\nPhase 2" in feed_response.text

    async def test_list_availability_rejects_oversized_range(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=2026-01-01&end_date=2026-12-31",
            headers=member_headers,
        )

        assert response.status_code == 422

    async def test_list_availability_rejects_inverted_range(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.get(
            f"/api/static-groups/{test_group.id}/availability?start_date=2026-06-10&end_date=2026-06-01",
            headers=member_headers,
        )

        assert response.status_code == 422


# ── Unit tests for discord_webhook helpers ───────────────────────────────────


class TestRecurrenceRuleToText:
    def test_weekly_single_day(self):
        assert _recurrence_rule_to_text("FREQ=WEEKLY;BYDAY=SA") == "Repeats weekly on Saturday"

    def test_weekly_two_days(self):
        assert _recurrence_rule_to_text("FREQ=WEEKLY;BYDAY=SA,SU") == "Repeats weekly on Saturday, Sunday"

    def test_weekly_no_byday(self):
        assert _recurrence_rule_to_text("FREQ=WEEKLY") == "Repeats weekly"

    def test_non_weekly_returns_none(self):
        assert _recurrence_rule_to_text("FREQ=DAILY") is None

    def test_none_returns_none(self):
        assert _recurrence_rule_to_text(None) is None

    def test_empty_string_returns_none(self):
        assert _recurrence_rule_to_text("") is None

    def test_case_insensitive(self):
        result = _recurrence_rule_to_text("freq=weekly;byday=mo")
        assert result == "Repeats weekly on Monday"


class TestNextOccurrenceIso:
    def test_future_date_unchanged(self):
        future = "2099-12-25T18:00:00+00:00"
        result = _next_occurrence_iso(future, "FREQ=WEEKLY;BYDAY=WE")
        assert result == future

    def test_past_date_advances_to_future(self):
        past = "2020-01-04T18:00:00+00:00"
        result = _next_occurrence_iso(past, "FREQ=WEEKLY;BYDAY=SA")
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(result.replace("Z", "+00:00"))
        assert dt > datetime.now(timezone.utc)

    def test_non_weekly_returns_unchanged(self):
        past = "2020-01-01T00:00:00+00:00"
        result = _next_occurrence_iso(past, "FREQ=DAILY")
        assert result == past

    def test_no_rule_returns_unchanged(self):
        past = "2020-01-01T00:00:00+00:00"
        assert _next_occurrence_iso(past, None) == past

    def test_unparseable_iso_returns_unchanged(self):
        bad = "not-a-date"
        assert _next_occurrence_iso(bad, "FREQ=WEEKLY;BYDAY=SA") == bad


class TestComputeRsvpHash:
    def test_deterministic(self):
        counts = {"available": 5, "tentative": 2, "unavailable": 1}
        assert compute_rsvp_hash(counts) == compute_rsvp_hash(counts)

    def test_order_independent(self):
        a = compute_rsvp_hash({"available": 5, "unavailable": 1})
        b = compute_rsvp_hash({"unavailable": 1, "available": 5})
        assert a == b

    def test_different_counts_give_different_hash(self):
        a = compute_rsvp_hash({"available": 5})
        b = compute_rsvp_hash({"available": 6})
        assert a != b

    def test_returns_16_char_hex(self):
        h = compute_rsvp_hash({"available": 8})
        assert len(h) == 16
        assert all(c in "0123456789abcdef" for c in h)


# ── Integration tests for webhook firing ─────────────────────────────────────


def _mock_discord_post(status_code: int = 200, message_id: str = "discord_msg_001"):
    """Return a mock httpx.AsyncClient that succeeds on POST/PATCH.

    POST with ?wait=true returns 200 + {"id": message_id}.
    PATCH returns 200 by default.
    """
    post_response = MagicMock()
    post_response.status_code = status_code
    post_response.json.return_value = {"id": message_id}

    patch_response = MagicMock()
    patch_response.status_code = 200

    client = AsyncMock()
    client.post.return_value = post_response
    client.patch.return_value = patch_response
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


class TestAutomaticScheduleReminders:
    @pytest.fixture(autouse=True)
    def patch_schedule_reminder_session_maker(self, engine):
        maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        with patch("app.tasks.schedule_reminders.async_session_maker", maker):
            yield maker

    async def _create_session(
        self,
        client: AsyncClient,
        group_id: str,
        headers: dict,
        *,
        start_time: str = "2099-07-05T12:00:00+00:00",
        track_availability: bool = True,
    ) -> str:
        response = await client.post(
            f"/api/static-groups/{group_id}/schedule",
            json={
                "title": "Automatic Reminder Session",
                "startTime": start_time,
                "endTime": (
                    datetime.fromisoformat(start_time.replace("Z", "+00:00")) + timedelta(hours=3)
                ).isoformat(),
                "timezone": "UTC",
                "isRecurring": False,
                "trackAvailability": track_availability,
            },
            headers=headers,
        )
        assert response.status_code == 201
        return response.json()["id"]

    async def _enable_webhook(
        self,
        client: AsyncClient,
        group_id: str,
        headers: dict,
        *,
        status_payload: dict | None = None,
    ) -> None:
        payload = {
            "webhookUrl": "https://discord.com/api/webhooks/1234/fake-token-for-tests",
            "enable1hReminder": True,
        }
        if status_payload:
            payload.update(status_payload)
        response = await client.put(
            f"/api/static-groups/{group_id}/scheduler/settings",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200

    async def test_automatic_reminder_sends_and_records_delivery(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
    ):
        session_id = await self._create_session(client, test_group.id, auth_headers)
        await self._enable_webhook(
            client,
            test_group.id,
            auth_headers,
            status_payload={
                "mentionTarget": "role",
                "mentionRoleId": "123456789012345678",
            },
        )

        mock_client = _mock_discord_post(204)
        with patch("app.services.schedule_webhooks.httpx.AsyncClient", return_value=mock_client):
            sent = await run_schedule_reminder_cycle(
                datetime(2099, 7, 5, 11, 0, tzinfo=timezone.utc)
            )

        assert sent == 1
        mock_client.post.assert_called_once()
        post_url = mock_client.post.call_args[0][0]
        payload = mock_client.post.call_args[1]["json"]
        assert post_url == "https://discord.com/api/webhooks/1234/fake-token-for-tests"
        assert payload["allowed_mentions"] == {"parse": [], "roles": ["123456789012345678"]}
        assert payload["content"].startswith("<@&123456789012345678>")
        assert "sessionId=" in payload["content"]

        result = await session.execute(
            select(ScheduleReminderDelivery).where(
                ScheduleReminderDelivery.session_id == session_id,
                ScheduleReminderDelivery.reminder_type == "1h",
            )
        )
        assert result.scalar_one_or_none() is not None

    async def test_automatic_reminder_failure_does_not_record_delivery(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
    ):
        session_id = await self._create_session(client, test_group.id, auth_headers)
        await self._enable_webhook(client, test_group.id, auth_headers)

        mock_client = _mock_discord_post(500)
        with patch("app.services.schedule_webhooks.httpx.AsyncClient", return_value=mock_client):
            sent = await run_schedule_reminder_cycle(
                datetime(2099, 7, 5, 11, 0, tzinfo=timezone.utc)
            )

        assert sent == 0
        result = await session.execute(
            select(ScheduleReminderDelivery).where(
                ScheduleReminderDelivery.session_id == session_id,
                ScheduleReminderDelivery.reminder_type == "1h",
            )
        )
        assert result.scalar_one_or_none() is None

    async def test_automatic_reminder_does_not_duplicate_delivery(
        self,
        client: AsyncClient,
        test_group,
        auth_headers,
    ):
        await self._create_session(client, test_group.id, auth_headers)
        await self._enable_webhook(client, test_group.id, auth_headers)

        mock_client = _mock_discord_post(204)
        now = datetime(2099, 7, 5, 11, 0, tzinfo=timezone.utc)
        with patch("app.services.schedule_webhooks.httpx.AsyncClient", return_value=mock_client):
            first = await run_schedule_reminder_cycle(now)
            second = await run_schedule_reminder_cycle(now)

        assert first == 1
        assert second == 0
        mock_client.post.assert_called_once()

    async def test_manual_preview_and_automatic_reminder_use_same_webhook_destination(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
    ):
        await self._create_session(client, test_group.id, auth_headers)
        await self._enable_webhook(
            client,
            test_group.id,
            auth_headers,
            status_payload={
                "mentionTarget": "here",
            },
        )

        settings_result = await session.execute(
            select(ScheduleSettings).where(ScheduleSettings.static_group_id == test_group.id)
        )
        row = settings_result.scalar_one()
        destination = resolve_schedule_webhook(row)
        assert destination is not None
        assert destination.webhook_url == "https://discord.com/api/webhooks/1234/fake-token-for-tests"
        assert destination.mention_target == "here"

        mock_client = _mock_discord_post(204)
        # post_session_preview now calls _post_or_edit_webhook (in app.routers.schedule),
        # while the auto-reminder uses post_schedule_webhook (in app.services.schedule_webhooks).
        # Patch both so the mock captures both calls.
        with patch("app.services.schedule_webhooks.httpx.AsyncClient", return_value=mock_client), \
             patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            preview_response = await client.post(
                f"/api/static-groups/{test_group.id}/scheduler/settings/post-session-preview",
                headers=auth_headers,
            )
            sent = await run_schedule_reminder_cycle(
                datetime(2099, 7, 5, 11, 0, tzinfo=timezone.utc)
            )

        assert preview_response.status_code == 200
        assert sent == 1
        # Preview uses ?wait=true (dedup mapping); auto-reminder uses bare URL.
        # Both must target the same base webhook URL.
        base_url = "https://discord.com/api/webhooks/1234/fake-token-for-tests"
        post_urls = [call.args[0] for call in mock_client.post.call_args_list]
        assert len(post_urls) == 2
        assert all(url.startswith(base_url) for url in post_urls)


class TestDiscordWebhook:
    """Verify that schedule mutations fire Discord webhook messages."""

    async def _setup_webhook(self, client, group_id: str, headers: dict) -> None:
        await client.put(
            f"/api/static-groups/{group_id}/scheduler/settings",
            json={"webhookUrl": "https://discord.com/api/webhooks/1234/fake-token-for-tests"},
            headers=headers,
        )

    async def test_create_session_fires_webhook_when_configured(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(204)

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Hook Test Session",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
        assert response.status_code == 201
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json") or {}
        assert "<t:" in str(payload)

    async def test_create_session_no_webhook_no_http_call(
        self, client, test_group, auth_headers
    ):
        mock_client = _mock_discord_post(204)

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "No Hook Session",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
        assert response.status_code == 201
        mock_client.post.assert_not_called()

    async def test_webhook_payload_has_rsvp_summary(
        self, client, session, test_group, auth_headers, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "RSVP Hook Test",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        captured_payloads = []
        mock_client = _mock_discord_post(204)

        async def capture_post(url, *, json=None, **kwargs):
            captured_payloads.append(json or {})
            return mock_client.post.return_value

        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "available"},
                headers=member_headers,
            )

        assert len(captured_payloads) == 1
        fields = captured_payloads[0]["embeds"][0]["fields"]
        assert any(f["name"] == "RSVP" for f in fields)

    async def test_webhook_payload_includes_recurrence_for_recurring_session(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)

        captured_payloads = []
        mock_client = _mock_discord_post(204)

        async def capture_post(url, *, json=None, **kwargs):
            captured_payloads.append(json or {})
            return mock_client.post.return_value

        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Weekly Session",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": True,
                    "recurrenceRule": "FREQ=WEEKLY;BYDAY=SA",
                },
                headers=auth_headers,
            )

        assert len(captured_payloads) >= 1
        fields = captured_payloads[0]["embeds"][0]["fields"]
        recurrence_field = next((f for f in fields if f["name"] == "Recurrence"), None)
        assert recurrence_field is not None
        assert "Saturday" in recurrence_field["value"]

    async def test_webhook_failure_does_not_break_session_create(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)

        import httpx as _httpx
        mock_client = AsyncMock()
        mock_client.post.side_effect = _httpx.ConnectError("timeout")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Resilience Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
        assert response.status_code == 201

    async def test_webhook_failure_does_not_break_rsvp(
        self, client, session, test_group, auth_headers, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "RSVP Resilience",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        import httpx as _httpx
        mock_client = AsyncMock()
        mock_client.post.side_effect = _httpx.ConnectError("timeout")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "available"},
                headers=member_headers,
            )
        assert response.status_code == 200

    async def test_delete_session_fires_cancelled_webhook(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "To Be Cancelled",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        captured_payloads = []
        mock_client = _mock_discord_post(204)

        async def capture_post(url, *, json=None, **kwargs):
            captured_payloads.append(json or {})
            return mock_client.post.return_value

        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            del_resp = await client.delete(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}",
                headers=auth_headers,
            )
        assert del_resp.status_code == 204
        assert len(captured_payloads) == 1
        fields = captured_payloads[0]["embeds"][0]["fields"]
        status_field = next((f for f in fields if f["name"] == "Status"), None)
        assert status_field is not None
        assert "Cancelled" in status_field["value"]

    async def test_post_session_preview_uses_real_session_data(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)

        await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "Preview Target Session",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )

        captured_payloads = []
        mock_client = _mock_discord_post(204)

        async def capture_post(url, *, json=None, **kwargs):
            captured_payloads.append(json or {})
            return mock_client.post.return_value

        mock_client.post.side_effect = capture_post

        with patch("app.services.schedule_webhooks.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/scheduler/settings/post-session-preview",
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert len(captured_payloads) == 1
        title = captured_payloads[0]["embeds"][0]["title"]
        assert "Preview Target Session" in title

    async def test_post_session_preview_fails_without_webhook(
        self, client, test_group, auth_headers
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/scheduler/settings/post-session-preview",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_post_session_preview_fails_with_no_upcoming_sessions(
        self, client, test_group, auth_headers
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)
        response = await client.post(
            f"/api/static-groups/{test_group.id}/scheduler/settings/post-session-preview",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_webhook_url_not_in_payload_content(
        self, client, test_group, auth_headers
    ):
        fake_token = "fake-token-for-tests"
        await client.put(
            f"/api/static-groups/{test_group.id}/scheduler/settings",
            json={"webhookUrl": f"https://discord.com/api/webhooks/1234/{fake_token}"},
            headers=auth_headers,
        )

        captured_payloads = []
        mock_client = _mock_discord_post(204)

        async def capture_post(url, *, json=None, **kwargs):
            captured_payloads.append(json or {})
            return mock_client.post.return_value

        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Token Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )

        assert len(captured_payloads) >= 1
        payload_str = str(captured_payloads[0])
        assert fake_token not in payload_str

    async def test_webhook_payload_includes_cannot_make_it_with_role(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        """Unavailable BRD/R2 appears in Cannot make it as 'R2 / BRD (Physical Ranged)'."""
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        from tests.factories import create_tier_snapshot, create_snapshot_player
        tier = await create_tier_snapshot(session, test_group)
        await create_snapshot_player(
            session, tier, name="Color", job="BRD", role="ranged",
            position="R2", sort_order=0,
        )
        player = await create_snapshot_player(
            session, tier, name="Aki", job="BRD", role="ranged",
            position="R2", sort_order=1,
        )
        player.user_id = member_user.id
        await session.flush()

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "Reclear",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        captured_posts = []
        captured_patches = []
        mock_client = _mock_discord_post(200)

        async def capture_post(url, *, json=None, **kw):
            captured_posts.append({"url": url, "json": json or {}})
            return mock_client.post.return_value

        async def capture_patch(url, *, json=None, **kw):
            captured_patches.append({"url": url, "json": json or {}})
            return mock_client.patch.return_value

        mock_client.post.side_effect = capture_post
        mock_client.patch.side_effect = capture_patch

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )

        # RSVP should POST (no prior mapping from session create outside mock)
        assert len(captured_posts) == 1
        fields = captured_posts[0]["json"]["embeds"][0]["fields"]
        cant_field = next((f for f in fields if "Cannot make it" in f["name"]), None)
        assert cant_field is not None
        assert "Aki" in cant_field["value"]
        assert "R2" in cant_field["value"]
        assert "BRD" in cant_field["value"]
        assert "Physical Ranged" in cant_field["value"]

        sub_field = next((f for f in fields if "Subs needed" in f["name"]), None)
        assert sub_field is not None
        assert "R2 / Physical Ranged" in sub_field["value"]

    async def test_webhook_payload_includes_tentative_with_role(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        """Tentative WHM/H1 appears in Tentative list."""
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        from tests.factories import create_tier_snapshot, create_snapshot_player
        tier = await create_tier_snapshot(session, test_group)
        player = await create_snapshot_player(
            session, tier, name="Mochi", job="WHM", role="healer",
            position="H1", sort_order=0,
        )
        player.user_id = member_user.id
        await session.flush()

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "Prog Night",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        captured_posts = []
        mock_client = _mock_discord_post(200)

        async def capture_post(url, *, json=None, **kw):
            captured_posts.append(json or {})
            return mock_client.post.return_value
        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "tentative"},
                headers=member_headers,
            )

        assert len(captured_posts) == 1
        fields = captured_posts[0]["embeds"][0]["fields"]
        tent_field = next((f for f in fields if "Tentative" in f["name"]), None)
        assert tent_field is not None
        assert "Mochi" in tent_field["value"]
        assert "H1" in tent_field["value"]
        assert "WHM" in tent_field["value"]
        assert "Pure Healer" in tent_field["value"]

    async def test_webhook_unknown_role_falls_back_safely(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        """Player with no active tier entry still appears by Discord username."""
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        create_resp = await client.post(
            f"/api/static-groups/{test_group.id}/schedule",
            json={
                "title": "Fallback Test",
                "startTime": "2099-07-05T12:00:00+00:00",
                "endTime": "2099-07-05T15:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        captured_posts = []
        mock_client = _mock_discord_post(200)

        async def capture_post(url, *, json=None, **kw):
            captured_posts.append(json or {})
            return mock_client.post.return_value
        mock_client.post.side_effect = capture_post

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )

        assert len(captured_posts) == 1
        fields = captured_posts[0]["embeds"][0]["fields"]
        cant_field = next((f for f in fields if "Cannot make it" in f["name"]), None)
        assert cant_field is not None
        assert "member" in cant_field["value"]


class TestWebhookMessagePersistence:
    """Verify that webhook messages are created/edited instead of spammed."""

    async def _setup_webhook(self, client, group_id: str, headers: dict) -> None:
        await client.put(
            f"/api/static-groups/{group_id}/scheduler/settings",
            json={"webhookUrl": "https://discord.com/api/webhooks/1234/fake-token-for-tests"},
            headers=headers,
        )

    async def test_session_create_posts_once_and_stores_message_id(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(200, message_id="msg_create_001")

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Post Once Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )

        assert response.status_code == 201
        mock_client.post.assert_called_once()
        assert "wait=true" in mock_client.post.call_args[0][0]

        from app.models.schedule import DiscordMessageMapping
        result = await session.execute(
            select(DiscordMessageMapping).where(
                DiscordMessageMapping.session_id == response.json()["id"],
            )
        )
        mapping = result.scalar_one_or_none()
        assert mapping is not None
        assert mapping.webhook_message_id == "msg_create_001"

    async def test_rsvp_change_edits_existing_message(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(200, message_id="msg_edit_001")

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            create_resp = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Edit Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
            session_id = create_resp.json()["id"]

            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )

        assert mock_client.post.call_count == 1
        assert mock_client.patch.call_count == 1
        patch_url = mock_client.patch.call_args[0][0]
        assert "msg_edit_001" in patch_url

    async def test_repeated_same_rsvp_does_not_edit_again(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(200, message_id="msg_hash_001")

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            create_resp = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Hash Skip Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
            session_id = create_resp.json()["id"]

            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )
            first_patch_count = mock_client.patch.call_count

            # Same RSVP again — hash unchanged
            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )

        assert mock_client.patch.call_count == first_patch_count

    async def test_session_update_edits_existing_message(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
    ):
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(200, message_id="msg_update_001")

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            create_resp = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Before Update",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
            session_id = create_resp.json()["id"]

            await client.put(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}",
                json={"title": "After Update"},
                headers=auth_headers,
            )

        assert mock_client.post.call_count == 1
        assert mock_client.patch.call_count == 1

    async def test_deleted_discord_message_posts_replacement(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)
        mock_client = _mock_discord_post(200, message_id="msg_original")

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            create_resp = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "404 Recovery Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )
            session_id = create_resp.json()["id"]

            # Simulate Discord returning 404 on PATCH (message was deleted)
            patch_404 = MagicMock()
            patch_404.status_code = 404
            mock_client.patch.return_value = patch_404

            replacement_resp = MagicMock()
            replacement_resp.status_code = 200
            replacement_resp.json.return_value = {"id": "msg_replacement"}
            mock_client.post.return_value = replacement_resp

            await client.post(
                f"/api/static-groups/{test_group.id}/schedule/{session_id}/rsvp",
                json={"status": "unavailable"},
                headers=member_headers,
            )

        # Should have tried PATCH (got 404), then POST replacement
        assert mock_client.patch.call_count == 1
        assert mock_client.post.call_count >= 2

        from app.models.schedule import DiscordMessageMapping
        result = await session.execute(
            select(DiscordMessageMapping).where(
                DiscordMessageMapping.session_id == session_id,
            )
        )
        mapping = result.scalar_one()
        assert mapping.webhook_message_id == "msg_replacement"

    async def test_webhook_failure_does_not_break_rsvp_save(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group,
        auth_headers,
        member_user,
        member_headers,
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await self._setup_webhook(client, test_group.id, auth_headers)

        import httpx as _httpx
        mock_client = AsyncMock()
        mock_client.post.side_effect = _httpx.ConnectError("timeout")
        mock_client.patch.side_effect = _httpx.ConnectError("timeout")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.routers.schedule.httpx.AsyncClient", return_value=mock_client):
            create_resp = await client.post(
                f"/api/static-groups/{test_group.id}/schedule",
                json={
                    "title": "Resilience Test",
                    "startTime": "2099-07-05T12:00:00+00:00",
                    "endTime": "2099-07-05T15:00:00+00:00",
                    "timezone": "UTC",
                    "isRecurring": False,
                },
                headers=auth_headers,
            )

        assert create_resp.status_code == 201
