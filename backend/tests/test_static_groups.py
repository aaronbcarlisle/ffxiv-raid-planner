"""Tests for static group endpoints"""

import pytest
from httpx import AsyncClient

from app.models import MemberRole, StaticGroup, User
from tests.factories import create_membership


@pytest.mark.asyncio
async def test_create_static_group(client: AsyncClient, auth_headers: dict, test_user: User):
    """Test creating a new static group."""
    response = await client.post(
        "/api/static-groups",
        json={"name": "My New Static"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My New Static"
    assert data["ownerId"] == test_user.id
    assert "shareCode" in data
    assert len(data["shareCode"]) == 6
    assert data["isPublic"] is False


@pytest.mark.asyncio
async def test_create_static_group_requires_auth(client: AsyncClient):
    """Test that creating a static group requires authentication."""
    response = await client.post(
        "/api/static-groups",
        json={"name": "Test Static"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_static_groups(
    client: AsyncClient, auth_headers: dict, test_group: StaticGroup
):
    """Test listing user's static groups."""
    response = await client.get("/api/static-groups", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_group.id
    assert data[0]["name"] == test_group.name


@pytest.mark.asyncio
async def test_list_static_groups_requires_auth(client: AsyncClient):
    """Test that listing static groups requires authentication."""
    response = await client.get("/api/static-groups")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_static_group_by_share_code(
    client: AsyncClient, auth_headers: dict, test_group: StaticGroup
):
    """Test getting a static group by share code."""
    response = await client.get(
        f"/api/static-groups/by-code/{test_group.share_code}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_group.id
    assert data["name"] == test_group.name


@pytest.mark.asyncio
async def test_get_static_group_by_invalid_code(client: AsyncClient, auth_headers: dict):
    """Test getting a static group with invalid share code returns 404."""
    response = await client.get(
        "/api/static-groups/by-code/INVALID",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_static_group_as_owner(
    client: AsyncClient, auth_headers: dict, test_group: StaticGroup
):
    """Test owner can update static group name."""
    response = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"name": "Updated Static Name"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Static Name"


@pytest.mark.asyncio
async def test_update_static_group_as_non_member(
    client: AsyncClient, auth_headers_user2: dict, test_group: StaticGroup
):
    """Test non-member cannot update static group."""
    response = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"name": "Hacked Name"},
        headers=auth_headers_user2,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_static_group_as_owner(
    client: AsyncClient, auth_headers: dict, test_group: StaticGroup
):
    """Test owner can delete static group."""
    response = await client.delete(
        f"/api/static-groups/{test_group.id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Verify it's gone
    response = await client.get(
        f"/api/static-groups/by-code/{test_group.share_code}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_static_group_as_lead_forbidden(
    client: AsyncClient,
    session,
    auth_headers_user2: dict,
    test_group: StaticGroup,
    test_user_2: User,
):
    """Test lead cannot delete static group (only owner can)."""
    # Add user2 as lead
    await create_membership(session, test_user_2, test_group, role=MemberRole.LEAD)
    await session.commit()

    response = await client.delete(
        f"/api/static-groups/{test_group.id}",
        headers=auth_headers_user2,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_toggle_visibility_as_owner(
    client: AsyncClient, auth_headers: dict, test_group: StaticGroup
):
    """Test owner can toggle visibility."""
    response = await client.put(
        f"/api/static-groups/{test_group.id}",
        json={"isPublic": True},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["isPublic"] is True
