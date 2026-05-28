"""Tests for the plugin's loopback OAuth/PKCE sign-in flow."""

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiKey, PluginAuthCode, User

pytestmark = pytest.mark.asyncio


def _pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) — the verifier is the secret the plugin holds."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _authorize_body(*, code_challenge: str | None = None, redirect_uri: str | None = None,
                    state: str = "abc123", method: str = "S256") -> dict:
    if code_challenge is None:
        _, code_challenge = _pkce_pair()
    return {
        "redirectUri": redirect_uri or "http://127.0.0.1:51234/callback/",
        "state": state,
        "codeChallenge": code_challenge,
        "codeChallengeMethod": method,
    }


class TestPluginAuthAuthorize:
    """POST /api/auth/api-keys/plugin-auth/authorize"""

    async def test_authorize_happy_path_returns_code(
        self, client: AsyncClient, auth_headers: dict, test_user: User
    ):
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(),
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert isinstance(body["code"], str)
        assert len(body["code"]) > 20

    async def test_authorize_persists_record_with_hashed_code(
        self, client: AsyncClient, auth_headers: dict, session: AsyncSession, test_user: User
    ):
        _, challenge = _pkce_pair()
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(code_challenge=challenge),
            headers=auth_headers,
        )
        code = response.json()["code"]

        result = await session.execute(select(PluginAuthCode).where(PluginAuthCode.user_id == test_user.id))
        records = result.scalars().all()
        assert len(records) == 1
        record = records[0]
        # Raw code MUST NOT be persisted — only the SHA-256 hash.
        assert record.code_hash == hashlib.sha256(code.encode("ascii")).hexdigest()
        assert record.code_challenge == challenge
        assert record.used is False

    async def test_authorize_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(),
        )
        assert response.status_code == 401

    async def test_authorize_rejects_non_loopback_redirect_uri(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(redirect_uri="https://evil.example.com/callback"),
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "loopback" in response.json()["detail"].lower() or "127.0.0.1" in response.json()["detail"]

    async def test_authorize_rejects_https_loopback(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Only http is permitted for loopback — https would imply real TLS expectations."""
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(redirect_uri="https://127.0.0.1:51234/callback/"),
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_authorize_rejects_non_S256_method(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(method="plain"),
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestPluginAuthExchange:
    """POST /api/auth/api-keys/plugin-auth/exchange"""

    async def _issue_code(self, client: AsyncClient, auth_headers: dict) -> tuple[str, str]:
        """Helper: run authorize and return (raw_code, code_verifier)."""
        verifier, challenge = _pkce_pair()
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(code_challenge=challenge),
            headers=auth_headers,
        )
        assert response.status_code == 201
        return response.json()["code"], verifier

    async def test_exchange_happy_path_mints_api_key(
        self, client: AsyncClient, auth_headers: dict, session: AsyncSession, test_user: User
    ):
        code, verifier = await self._issue_code(client, auth_headers)

        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["apiKey"].startswith("xrp_")
        assert len(body["apiKey"]) == 44

        # Key persisted, code marked used.
        keys = (await session.execute(select(ApiKey).where(ApiKey.user_id == test_user.id))).scalars().all()
        assert len(keys) == 1
        assert keys[0].name == "Plugin browser sign-in"

        records = (await session.execute(select(PluginAuthCode))).scalars().all()
        assert records[0].used is True

    async def test_exchange_does_not_require_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        """The exchange call comes from the plugin loopback listener — never authenticated."""
        code, verifier = await self._issue_code(client, auth_headers)

        # Note: no headers passed.
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert response.status_code == 200

    async def test_exchange_rejects_pkce_mismatch(
        self, client: AsyncClient, auth_headers: dict
    ):
        code, _verifier = await self._issue_code(client, auth_headers)
        # Pass an unrelated verifier — challenge won't match.
        wrong_verifier, _ = _pkce_pair()

        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": wrong_verifier},
        )
        assert response.status_code == 400
        assert "pkce" in response.json()["detail"].lower() or "mismatch" in response.json()["detail"].lower()

    async def test_exchange_rejects_unknown_code(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": "totally-not-a-real-code-xxxxxxxxxxxxxxxxxxxxxx", "codeVerifier": "x" * 50},
        )
        assert response.status_code == 400

    async def test_exchange_rejects_reused_code(
        self, client: AsyncClient, auth_headers: dict
    ):
        code, verifier = await self._issue_code(client, auth_headers)

        first = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert first.status_code == 200

        second = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert second.status_code == 400
        assert "used" in second.json()["detail"].lower()

    async def test_exchange_rejects_expired_code(
        self, client: AsyncClient, auth_headers: dict, session: AsyncSession
    ):
        code, verifier = await self._issue_code(client, auth_headers)

        # Force expiry by rewriting the record's expires_at.
        record = (await session.execute(select(PluginAuthCode))).scalar_one()
        record.expires_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        await session.commit()

        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

    async def test_exchange_race_safe_second_call_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Sequential calls with the same code simulate the race condition fix.

        The atomic UPDATE ensures only the first caller can flip used=False→True;
        the second caller sees rowcount=0 and receives 400.
        """
        code, verifier = await self._issue_code(client, auth_headers)

        first = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert first.status_code == 200

        second = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert second.status_code == 400
        assert "used" in second.json()["detail"].lower()

    async def test_exchange_rejects_when_user_at_key_limit(
        self, client: AsyncClient, auth_headers: dict, session: AsyncSession, test_user: User
    ):
        """Exchange must 400 when the user already has MAX_KEYS_PER_USER active keys."""
        import uuid as _uuid
        from app.routers.api_keys import MAX_KEYS_PER_USER

        # Pre-populate the user's active key count up to the limit.
        for _ in range(MAX_KEYS_PER_USER):
            raw = "xrp_" + secrets.token_hex(20)
            session.add(ApiKey(
                id=str(_uuid.uuid4()),
                user_id=test_user.id,
                key_hash=hashlib.sha256(raw.encode()).hexdigest(),
                key_prefix=raw[:12],
                name="pre-existing",
                scopes=[],
                is_active=True,
                created_at=datetime.now(timezone.utc).isoformat(),
            ))
        await session.commit()

        code, verifier = await self._issue_code(client, auth_headers)

        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": code, "codeVerifier": verifier},
        )
        assert response.status_code == 400
        assert str(MAX_KEYS_PER_USER) in response.json()["detail"]

    async def test_exchange_rejects_non_ascii_code(self, client: AsyncClient):
        """Non-ASCII input must produce 422 from Pydantic, not 500 from .encode('ascii')."""
        response = await client.post(
            "/api/auth/api-keys/plugin-auth/exchange",
            json={"code": "café-invalid", "codeVerifier": "a" * 43},
        )
        assert response.status_code == 422


class TestPluginAuthAuthorizePrivilegeEscalation:
    """Authorization boundary tests for the authorize endpoint."""

    async def test_authorize_rejects_api_key_auth(
        self, client: AsyncClient, test_user: User, session: AsyncSession
    ):
        """An existing API key must not be usable to mint new plugin auth codes.

        get_current_user_jwt_only explicitly rejects Bearer xrp_... headers so
        a plugin cannot bootstrap itself into further keys via its own credential.
        """
        import uuid as _uuid
        raw_key = "xrp_" + secrets.token_hex(20)
        session.add(ApiKey(
            id=str(_uuid.uuid4()),
            user_id=test_user.id,
            key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
            key_prefix=raw_key[:12],
            name="test",
            scopes=[],
            is_active=True,
            created_at=datetime.now(timezone.utc).isoformat(),
        ))
        await session.commit()

        response = await client.post(
            "/api/auth/api-keys/plugin-auth/authorize",
            json=_authorize_body(),
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        # get_current_user_jwt_only rejects API key Bearer tokens with 403
        assert response.status_code == 403
