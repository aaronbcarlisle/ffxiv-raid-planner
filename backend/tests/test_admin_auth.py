"""AD1a admin auth substrate tests.

Covers the JWT-only lockdown (spec §2.1): every locked admin route rejects
xrp_ API keys (even an admin's own — the leaked-plugin-key scenario) and
non-admin JWTs; the catalog Forbidden→PermissionDenied bugfix (403, not 500);
the staged-lockdown boundaries (import-verified-ids is the permanent xrp_
carve-out; sync/seed stay xrp_-reachable until AD9b); and the
RequestIDMiddleware request.state fix.
"""

from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.middleware.request_id import RequestIDMiddleware
from app.models import User

# JWT-only rejection copy from get_current_user_jwt_only — asserting on the
# body (not just the 403 status) keeps a CSRF 403 from faking a green sweep.
API_KEY_REJECTED_DETAIL = "API keys cannot access this endpoint. Use browser authentication."
NOT_ADMIN_DETAIL = "Admin access required"

FINGERPRINT = "a" * 64

# The complete AD1a lockdown set: 11 analytics + 3 static_groups +
# catalog audit GET + tiers admin-assign. Path params are dummies — auth
# dependencies reject before any handler logic runs.
LOCKED_ROUTES = [
    ("GET", "/api/admin/analytics/overview", None),
    ("GET", "/api/admin/analytics/growth", None),
    ("GET", "/api/admin/analytics/usage", None),
    ("GET", "/api/admin/analytics/top-users", None),
    ("GET", "/api/admin/analytics/top-statics", None),
    ("GET", "/api/admin/analytics/errors", None),
    ("POST", "/api/admin/analytics/errors/batch-review", {"fingerprints": [FINGERPRINT], "action": "review"}),
    ("GET", f"/api/admin/analytics/errors/{FINGERPRINT}", None),
    ("POST", f"/api/admin/analytics/errors/{FINGERPRINT}/review", None),
    ("POST", f"/api/admin/analytics/errors/{FINGERPRINT}/unreview", None),
    ("GET", "/api/admin/analytics/users/some-user/statics", None),
    ("GET", "/api/static-groups/admin/all", None),
    ("GET", "/api/static-groups/admin/user-role/some-group/some-user", None),
    ("GET", "/api/static-groups/admin/all-users", None),
    ("GET", "/api/admin/collection-catalog/audit", None),
    ("POST", "/api/static-groups/g/tiers/t/players/p/admin-assign", {"userId": None}),
]


@pytest_asyncio.fixture
async def admin_user(session: AsyncSession) -> User:
    from tests.factories import create_user

    user = await create_user(
        session, discord_id="999888777666555444", discord_username="admin_tester"
    )
    user.is_admin = True
    await session.commit()
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(admin_user.id)}"}


@pytest_asyncio.fixture
async def admin_api_key_headers(client: AsyncClient, admin_headers: dict) -> dict[str, str]:
    """A real xrp_ key belonging to the ADMIN — the leaked-plugin-key scenario."""
    response = await client.post(
        "/api/auth/api-keys", json={"name": "Leaked Plugin Key"}, headers=admin_headers
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['key']}"}


async def _call(client: AsyncClient, method: str, path: str, body, headers: dict):
    if method == "GET":
        return await client.get(path, headers=headers)
    return await client.post(path, json=body, headers=headers)


class TestJwtOnlyLockdown:
    """Every locked route rejects API keys — even an admin's own."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,path,body", LOCKED_ROUTES)
    async def test_admin_api_key_rejected(
        self, client: AsyncClient, admin_api_key_headers: dict, method, path, body
    ):
        response = await _call(client, method, path, body, admin_api_key_headers)
        assert response.status_code == 403, f"{method} {path}: {response.status_code}"
        assert response.json()["detail"] == API_KEY_REJECTED_DETAIL

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,path,body", LOCKED_ROUTES)
    async def test_non_admin_jwt_rejected(
        self, client: AsyncClient, auth_headers: dict, method, path, body
    ):
        response = await _call(client, method, path, body, auth_headers)
        assert response.status_code == 403, f"{method} {path}: {response.status_code}"
        assert response.json()["detail"] == NOT_ADMIN_DETAIL


class TestAdminJwtHappyPath:
    """The swap did not break browser-admin access (spot checks)."""

    @pytest.mark.asyncio
    async def test_analytics_overview(self, client: AsyncClient, admin_headers: dict):
        response = await client.get("/api/admin/analytics/overview", headers=admin_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_static_groups_admin_all(self, client: AsyncClient, admin_headers: dict):
        response = await client.get("/api/static-groups/admin/all", headers=admin_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_static_groups_all_users(self, client: AsyncClient, admin_headers: dict):
        response = await client.get("/api/static-groups/admin/all-users", headers=admin_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_catalog_audit(self, client: AsyncClient, admin_headers: dict):
        response = await client.get("/api/admin/collection-catalog/audit", headers=admin_headers)
        assert response.status_code == 200


class TestForbiddenBugfix:
    """Non-admin catalog calls get a clean 403 — before AD1a they 500'd on
    `from ..permissions import Forbidden` (a class that never existed)."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "path,body",
        [
            ("/api/admin/collection-catalog/sync", None),
            ("/api/admin/collection-catalog/seed", None),
            ("/api/admin/collection-catalog/import-verified-ids", []),
        ],
    )
    async def test_non_admin_gets_403_not_500(
        self, client: AsyncClient, auth_headers: dict, path, body
    ):
        response = await client.post(path, json=body, headers=auth_headers)
        assert response.status_code == 403
        assert response.json()["detail"] == NOT_ADMIN_DETAIL


class TestStagedLockdownBoundaries:
    """What is NOT locked in AD1a, proven so the staged plan stays honest."""

    @pytest.mark.asyncio
    async def test_import_verified_ids_keeps_xrp_carveout(
        self, client: AsyncClient, admin_api_key_headers: dict
    ):
        """The permanent carve-out: the plugin's /xrp resolve-ids stays alive."""
        response = await client.post(
            "/api/admin/collection-catalog/import-verified-ids",
            json=[],
            headers=admin_api_key_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_sync_still_xrp_reachable_until_ad9b(
        self, client: AsyncClient, admin_api_key_headers: dict
    ):
        async def fake_sync(session):
            return {"mounts": 0}

        with patch("app.routers.collection_catalog.sync_from_ffxiv_collect", fake_sync):
            response = await client.post(
                "/api/admin/collection-catalog/sync", headers=admin_api_key_headers
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_seed_still_xrp_reachable_until_ad9b(
        self, client: AsyncClient, admin_api_key_headers: dict
    ):
        async def fake_seed(session):
            return 0

        with patch("app.routers.collection_catalog.seed_from_internal", fake_seed):
            response = await client.post(
                "/api/admin/collection-catalog/seed", headers=admin_api_key_headers
            )
        assert response.status_code == 200


class TestRequestIdState:
    """RequestIDMiddleware must set request.state.request_id (the always-None
    exceptions.py bug): the real middleware, probed by a handler."""

    def _probe_app(self) -> FastAPI:
        probe = FastAPI()
        probe.add_middleware(RequestIDMiddleware)

        @probe.get("/probe")
        async def read_state(request: Request):
            return {"request_id": getattr(request.state, "request_id", None)}

        return probe

    @pytest.mark.asyncio
    async def test_state_set_and_matches_response_header(self):
        async with AsyncClient(
            transport=ASGITransport(app=self._probe_app()), base_url="http://test"
        ) as probe_client:
            response = await probe_client.get("/probe")
        state_id = response.json()["request_id"]
        assert state_id is not None
        assert response.headers["X-Request-ID"] == state_id

    @pytest.mark.asyncio
    async def test_inbound_header_honored_and_capped(self):
        async with AsyncClient(
            transport=ASGITransport(app=self._probe_app()), base_url="http://test"
        ) as probe_client:
            response = await probe_client.get(
                "/probe", headers={"X-Request-ID": "proxy-supplied-id"}
            )
            assert response.json()["request_id"] == "proxy-supplied-id"

            oversized = "x" * 500
            response = await probe_client.get("/probe", headers={"X-Request-ID": oversized})
            assert response.json()["request_id"] == "x" * 64
