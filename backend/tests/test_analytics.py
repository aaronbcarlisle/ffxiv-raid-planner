"""Tests for the analytics router's anonymous (logged-out) ingestion.

The events and error-report endpoints use optional auth: logged-out activity is
recorded with a null user_id (matching the nullable model columns), while
authenticated activity is attributed to the user.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AnalyticsEvent, ErrorReport, User

pytestmark = pytest.mark.asyncio


def _events_payload() -> dict:
    return {
        "sessionId": "test-session",
        "events": [
            {"eventCategory": "navigation", "eventName": "page_view", "pageUrl": "/"},
        ],
    }


def _error_payload() -> dict:
    return {
        "fingerprint": "deadbeef",
        "errorType": "TypeError",
        "message": "boom",
        "context": {"where": "test"},
        "severity": "error",
    }


async def test_events_accepts_anonymous(client: AsyncClient, session: AsyncSession):
    """Logged-out users can submit events; they are stored with a null user_id."""
    resp = await client.post("/api/analytics/events", json=_events_payload())
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "count": 1}

    rows = (await session.execute(select(AnalyticsEvent))).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id is None


async def test_events_records_user_when_authenticated(
    client: AsyncClient, session: AsyncSession, test_user: User, auth_headers: dict
):
    """Authenticated events are attributed to the logged-in user."""
    resp = await client.post(
        "/api/analytics/events", json=_events_payload(), headers=auth_headers
    )
    assert resp.status_code == 200

    rows = (await session.execute(select(AnalyticsEvent))).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id == test_user.id


async def test_error_report_accepts_anonymous(client: AsyncClient, session: AsyncSession):
    """Logged-out users can submit error reports; stored with a null user_id."""
    resp = await client.post("/api/analytics/errors", json=_error_payload())
    assert resp.status_code == 200

    rows = (await session.execute(select(ErrorReport))).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id is None


async def test_error_report_records_user_when_authenticated(
    client: AsyncClient, session: AsyncSession, test_user: User, auth_headers: dict
):
    """Authenticated error reports are attributed to the logged-in user."""
    resp = await client.post(
        "/api/analytics/errors", json=_error_payload(), headers=auth_headers
    )
    assert resp.status_code == 200

    rows = (await session.execute(select(ErrorReport))).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id == test_user.id
