"""Tests for API key CRUD endpoints and authentication"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiKey, User
from tests.factories import create_user


class TestCreateApiKey:
    """Tests for POST /api/auth/api-keys"""

    @pytest.mark.asyncio
    async def test_create_api_key(self, client: AsyncClient, auth_headers: dict, test_user: User):
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Test Plugin Key"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Plugin Key"
        assert data["key"].startswith("xrp_")
        assert len(data["key"]) == 44  # "xrp_" + 40 hex chars
        assert data["keyPrefix"] == data["key"][:12]
        assert "priority:read" in data["scopes"]
        assert "loot:write" in data["scopes"]

    @pytest.mark.asyncio
    async def test_create_api_key_always_assigns_all_scopes(self, client: AsyncClient, auth_headers: dict):
        """All keys receive full scopes regardless of request body."""
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Full Access"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "priority:read" in data["scopes"]
        assert "loot:write" in data["scopes"]
        assert "materials:write" in data["scopes"]
        assert "pages:write" in data["scopes"]

    @pytest.mark.asyncio
    async def test_create_api_key_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": "No Auth Key"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_api_key_empty_name_rejected(self, client: AsyncClient, auth_headers: dict):
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_api_key_max_limit(self, client: AsyncClient, auth_headers: dict):
        # Create 10 keys (the max)
        for i in range(10):
            response = await client.post(
                "/api/auth/api-keys",
                json={"name": f"Key {i}"},
                headers=auth_headers,
            )
            assert response.status_code == 201

        # 11th should fail
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": "One Too Many"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "Maximum" in response.json()["detail"]


class TestListApiKeys:
    """Tests for GET /api/auth/api-keys"""

    @pytest.mark.asyncio
    async def test_list_api_keys_empty(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/auth/api-keys", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_api_keys(self, client: AsyncClient, auth_headers: dict):
        # Create a key first
        await client.post(
            "/api/auth/api-keys",
            json={"name": "My Key"},
            headers=auth_headers,
        )

        response = await client.get("/api/auth/api-keys", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "My Key"
        assert data[0]["isActive"] is True
        # Raw key should never be returned in list
        assert "key" not in data[0]

    @pytest.mark.asyncio
    async def test_list_api_keys_only_own(
        self, client: AsyncClient, auth_headers: dict, auth_headers_user2: dict
    ):
        # User 1 creates a key
        await client.post(
            "/api/auth/api-keys",
            json={"name": "User1 Key"},
            headers=auth_headers,
        )

        # User 2 should see no keys
        response = await client.get("/api/auth/api-keys", headers=auth_headers_user2)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/auth/api-keys")
        assert response.status_code == 401


class TestRevokeApiKey:
    """Tests for DELETE /api/auth/api-keys/{key_id}"""

    @pytest.mark.asyncio
    async def test_revoke_api_key(self, client: AsyncClient, auth_headers: dict):
        # Create a key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "To Revoke"},
            headers=auth_headers,
        )
        key_id = create_response.json()["id"]

        # Revoke it
        response = await client.delete(f"/api/auth/api-keys/{key_id}", headers=auth_headers)
        assert response.status_code == 204

        # Revoked keys are filtered from the list
        list_response = await client.get("/api/auth/api-keys", headers=auth_headers)
        keys = list_response.json()
        revoked = [k for k in keys if k["id"] == key_id]
        assert len(revoked) == 0

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_key(self, client: AsyncClient, auth_headers: dict):
        response = await client.delete(
            "/api/auth/api-keys/nonexistent-id",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cannot_revoke_other_users_key(
        self, client: AsyncClient, auth_headers: dict, auth_headers_user2: dict
    ):
        # User 1 creates a key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "User1 Key"},
            headers=auth_headers,
        )
        key_id = create_response.json()["id"]

        # User 2 tries to revoke it
        response = await client.delete(
            f"/api/auth/api-keys/{key_id}",
            headers=auth_headers_user2,
        )
        assert response.status_code == 404


class TestApiKeyAuthentication:
    """Tests for authenticating with API keys"""

    @pytest.mark.asyncio
    async def test_auth_with_api_key(self, client: AsyncClient, auth_headers: dict):
        # Create a key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Auth Test"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]

        # Use the API key to access a protected endpoint
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_auth_with_revoked_key_fails(self, client: AsyncClient, auth_headers: dict):
        # Create and revoke a key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Revoked Key"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]
        key_id = create_response.json()["id"]

        await client.delete(f"/api/auth/api-keys/{key_id}", headers=auth_headers)

        # Try to auth with revoked key
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_auth_with_invalid_key_fails(self, client: AsyncClient):
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer xrp_deadbeef00000000000000000000000000000000"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_api_key_bypasses_csrf(self, client: AsyncClient, session: AsyncSession, auth_headers: dict, test_group):
        """API key requests should not need CSRF tokens for state-changing methods."""
        # Create a key via normal auth
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "CSRF Test"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]

        # Use a raw AsyncClient without CSRF support to test that API keys bypass CSRF
        from httpx import ASGITransport, AsyncClient as RawClient
        from app.database import get_session
        from app.main import app as the_app

        async def override_get_session():
            yield session

        the_app.dependency_overrides[get_session] = override_get_session

        async with RawClient(
            transport=ASGITransport(app=the_app),
            base_url="http://test",
        ) as raw_client:
            # GET should work (no CSRF needed for GET anyway)
            response = await raw_client.get(
                "/api/static-groups",
                headers={"Authorization": f"Bearer {raw_key}"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_updates_last_used(
        self, client: AsyncClient, auth_headers: dict, session: AsyncSession
    ):
        # Create a key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Usage Tracking"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]

        # Use the key
        await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {raw_key}"},
        )

        # Verify last_used_at was updated
        list_response = await client.get("/api/auth/api-keys", headers=auth_headers)
        keys = list_response.json()
        assert len(keys) == 1
        assert keys[0]["lastUsedAt"] is not None

    @pytest.mark.asyncio
    async def test_api_key_cannot_manage_keys(self, client: AsyncClient, auth_headers: dict):
        """API keys should not be able to create, list, or revoke other API keys."""
        # Create a key via normal auth
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Management Test"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]
        api_key_headers = {"Authorization": f"Bearer {raw_key}"}

        # Try to list keys via API key — should be rejected
        response = await client.get("/api/auth/api-keys", headers=api_key_headers)
        assert response.status_code == 403

        # Try to create a key via API key — should be rejected
        response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Escalation Attempt"},
            headers=api_key_headers,
        )
        assert response.status_code == 403

        # Try to revoke a key via API key — should be rejected
        key_id = create_response.json()["id"]
        response = await client.delete(
            f"/api/auth/api-keys/{key_id}",
            headers=api_key_headers,
        )
        assert response.status_code == 403
