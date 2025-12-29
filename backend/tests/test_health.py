"""Tests for health check endpoint"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the health check endpoint returns expected response."""
    response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


@pytest.mark.asyncio
async def test_health_check_no_auth_required(client: AsyncClient):
    """Test that health check does not require authentication."""
    response = await client.get("/health")
    assert response.status_code == 200
