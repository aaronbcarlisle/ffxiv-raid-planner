"""Tests for schedule/session endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
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
        assert data["rsvps"] == []

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
