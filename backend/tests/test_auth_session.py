"""GUEST-1 R-G1-3: GET /api/auth/session, the always-200 bootstrap probe.

Reads the `access_token` cookie only (never an Authorization header, never an
xrp_ API key), writes nothing, and never answers 401.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token, create_refresh_token
from app.models import ApiKey, User


def _cookie(**cookies: str) -> dict[str, str]:
    return {"Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())}


async def _last_used(session: AsyncSession, key_id: str) -> str | None:
    session.expire_all()
    result = await session.execute(select(ApiKey.last_used_at).where(ApiKey.id == key_id))
    return result.scalar_one()


async def _make_key(
    client: AsyncClient, session: AsyncSession, auth_headers: dict
) -> tuple[str, str]:
    response = await client.post(
        "/api/auth/api-keys", json={"name": "Probe Key"}, headers=auth_headers
    )
    assert response.status_code == 201
    result = await session.execute(select(ApiKey.id).where(ApiKey.name == "Probe Key"))
    return response.json()["key"], result.scalar_one()


class TestSessionProbe:
    @pytest.mark.asyncio
    async def test_no_cookies(self, client: AsyncClient):
        response = await client.get("/api/auth/session")
        assert response.status_code == 200
        assert response.json() == {"user": None, "canRefresh": False}
        assert "no-store" in response.headers["cache-control"]

    @pytest.mark.asyncio
    async def test_refresh_cookie_only(self, client: AsyncClient, test_user: User):
        response = await client.get(
            "/api/auth/session",
            headers=_cookie(refresh_token=create_refresh_token(test_user.id)),
        )
        assert response.status_code == 200
        assert response.json() == {"user": None, "canRefresh": True}

    @pytest.mark.asyncio
    async def test_valid_access_cookie(self, client: AsyncClient, test_user: User):
        headers = _cookie(access_token=create_access_token(test_user.id))
        response = await client.get("/api/auth/session", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["canRefresh"] is False
        assert body["user"]["id"] == test_user.id
        me = await client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert set(body["user"].keys()) == set(me.json().keys())
        assert body["user"] == me.json()
        assert "no-store" in response.headers["cache-control"]

    @pytest.mark.asyncio
    async def test_access_and_refresh_cookies(self, client: AsyncClient, test_user: User):
        headers = _cookie(
            access_token=create_access_token(test_user.id),
            refresh_token=create_refresh_token(test_user.id),
        )
        body = (await client.get("/api/auth/session", headers=headers)).json()
        assert body["user"]["id"] == test_user.id
        assert body["canRefresh"] is True

    @pytest.mark.asyncio
    async def test_garbage_access_cookie_is_never_401(self, client: AsyncClient):
        response = await client.get(
            "/api/auth/session", headers=_cookie(access_token="not-a-jwt")
        )
        assert response.status_code == 200
        assert response.json() == {"user": None, "canRefresh": False}

    @pytest.mark.asyncio
    async def test_refresh_token_in_access_cookie_is_not_a_session(
        self, client: AsyncClient, test_user: User
    ):
        response = await client.get(
            "/api/auth/session",
            headers=_cookie(access_token=create_refresh_token(test_user.id)),
        )
        assert response.status_code == 200
        assert response.json()["user"] is None

    @pytest.mark.asyncio
    async def test_api_key_bearer_is_ignored_and_writes_nothing(
        self, client: AsyncClient, session: AsyncSession, auth_headers: dict
    ):
        key, key_id = await _make_key(client, session, auth_headers)
        before = await _last_used(session, key_id)
        response = await client.get(
            "/api/auth/session", headers={"Authorization": f"Bearer {key}"}
        )
        assert response.status_code == 200
        assert response.json()["user"] is None
        assert await _last_used(session, key_id) == before

    @pytest.mark.asyncio
    async def test_api_key_in_access_cookie_is_ignored_and_writes_nothing(
        self, client: AsyncClient, session: AsyncSession, auth_headers: dict
    ):
        key, key_id = await _make_key(client, session, auth_headers)
        before = await _last_used(session, key_id)
        response = await client.get("/api/auth/session", headers=_cookie(access_token=key))
        assert response.status_code == 200
        assert response.json()["user"] is None
        assert await _last_used(session, key_id) == before

    @pytest.mark.asyncio
    async def test_authorization_header_jwt_is_ignored(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.get("/api/auth/session", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"user": None, "canRefresh": False}


class TestMeUnchanged:
    """(pin) The plugin reads /api/auth/me: the body must not change."""

    @pytest.mark.asyncio
    async def test_me_key_set(self, client: AsyncClient, test_user: User):
        response = await client.get(
            "/api/auth/me", headers=_cookie(access_token=create_access_token(test_user.id))
        )
        assert response.status_code == 200
        assert set(response.json().keys()) == {
            "id",
            "discordId",
            "discordUsername",
            "discordDiscriminator",
            "discordAvatar",
            "avatarUrl",
            "displayName",
            "isAdmin",
            "activityDisplayMode",
            "tabPersistence",
            "uiShell",
            "createdAt",
            "updatedAt",
            "lastLoginAt",
        }

    @pytest.mark.asyncio
    async def test_me_without_cookie_is_still_401(self, client: AsyncClient):
        assert (await client.get("/api/auth/me")).status_code == 401
