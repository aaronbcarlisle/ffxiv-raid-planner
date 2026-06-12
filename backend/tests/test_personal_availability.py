"""Tests for personal availability template endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

pytestmark = pytest.mark.asyncio


class TestGetPersonalAvailability:
    async def test_get_empty_personal_availability(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """GET returns empty list for new user."""
        response = await client.get(
            "/api/player/availability/template",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_unauthenticated_access(self, client: AsyncClient):
        """Requests without auth return 401."""
        response = await client.get("/api/player/availability/template")
        assert response.status_code == 401

        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "MO", "slots": ["09:00", "10:00"]},
        )
        assert response.status_code == 401


class TestSubmitPersonalAvailability:
    async def test_submit_personal_availability(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """PUT creates a template, GET returns it."""
        # Create
        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "MO", "slots": ["09:00", "10:00", "11:00"], "timezone": "Asia/Tokyo"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["dayOfWeek"] == "MO"
        assert sorted(data["slots"]) == ["09:00", "10:00", "11:00"]
        assert data["timezone"] == "Asia/Tokyo"
        assert data["userId"] == test_user.id
        assert "id" in data

        # Verify via GET
        response = await client.get(
            "/api/player/availability/template",
            headers=auth_headers,
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["dayOfWeek"] == "MO"
        assert sorted(items[0]["slots"]) == ["09:00", "10:00", "11:00"]
        assert items[0]["timezone"] == "Asia/Tokyo"

    async def test_update_personal_availability(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """PUT same day updates slots."""
        # Create initial
        await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "TU", "slots": ["09:00", "10:00"]},
            headers=auth_headers,
        )

        # Update same day
        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "TU", "slots": ["14:00", "15:00", "16:00"], "timezone": "US/Eastern"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["dayOfWeek"] == "TU"
        assert sorted(data["slots"]) == ["14:00", "15:00", "16:00"]
        assert data["timezone"] == "US/Eastern"

        # Verify only one entry for TU
        response = await client.get(
            "/api/player/availability/template",
            headers=auth_headers,
        )
        items = response.json()
        tu_items = [i for i in items if i["dayOfWeek"] == "TU"]
        assert len(tu_items) == 1

    async def test_submit_multiple_days(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """PUT different days, GET returns all ordered MO-SU."""
        days = ["FR", "MO", "WE"]
        for day in days:
            await client.put(
                "/api/player/availability/template",
                json={"dayOfWeek": day, "slots": [f"{day}:00"]},
                headers=auth_headers,
            )

        response = await client.get(
            "/api/player/availability/template",
            headers=auth_headers,
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 3
        # Should be ordered MO, WE, FR
        assert [i["dayOfWeek"] for i in items] == ["MO", "WE", "FR"]

    async def test_invalid_day_of_week(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """PUT with invalid day returns 400."""
        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "XX", "slots": ["09:00"]},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "Invalid day_of_week" in response.json()["detail"]

    async def test_default_timezone(
        self, client: AsyncClient, test_user: User, auth_headers: dict,
    ):
        """PUT without timezone defaults to UTC."""
        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": "SA", "slots": ["20:00"]},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["timezone"] == "UTC"
