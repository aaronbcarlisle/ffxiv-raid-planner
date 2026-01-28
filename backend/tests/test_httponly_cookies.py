"""Tests for httpOnly cookie authentication (HIGH-001 security fix).

Tests cover:
- Login sets httpOnly cookies
- Cookie attributes are secure (httponly, samesite, path)
- API calls work with cookies
- Logout clears cookies
- Token refresh works with cookies
- Backward compatibility with Authorization header
"""

from unittest.mock import MagicMock

import pytest

from app.auth_utils import create_access_token, create_refresh_token
from app.models import User


class TestLoginSetsCookies:
    """Test that Discord OAuth callback sets httpOnly cookies."""

    @pytest.fixture
    def mock_discord_oauth(self, mocker):
        """Set up mocks for Discord OAuth flow."""
        # Note: email field omitted - we no longer request email scope from Discord
        mock_discord_response = {
            "id": "123456789012345678",
            "username": "testuser",
            "discriminator": "0",
            "avatar": "abc123",
            "global_name": "Test User",
        }

        # Create mock response objects
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.json.return_value = {"access_token": "discord_token"}

        mock_user_response = MagicMock()
        mock_user_response.status_code = 200
        mock_user_response.json.return_value = mock_discord_response

        # Mock httpx.AsyncClient context manager
        mock_client = MagicMock()
        mock_client.post = mocker.AsyncMock(return_value=mock_token_response)
        mock_client.get = mocker.AsyncMock(return_value=mock_user_response)

        async def async_enter(*args, **kwargs):
            return mock_client

        async def async_exit(*args, **kwargs):
            pass

        mock_client.__aenter__ = async_enter
        mock_client.__aexit__ = async_exit

        mocker.patch("httpx.AsyncClient", return_value=mock_client)

        # Mock settings to enable Discord OAuth
        mock_settings = mocker.patch("app.routers.auth.settings")
        mock_settings.discord_configured = True
        mock_settings.discord_client_id = "test_client_id"
        mock_settings.discord_client_secret = "test_client_secret"
        mock_settings.discord_redirect_uri = "http://test/callback"
        mock_settings.environment = "development"
        mock_settings.jwt_access_token_expire_minutes = 15
        mock_settings.jwt_refresh_token_expire_days = 7
        mock_settings.admin_discord_ids_list = []

        # Mock client fingerprint to return a known value
        mocker.patch(
            "app.routers.auth._get_client_fingerprint",
            return_value="test-fingerprint-hash",
        )

        # Mock OAuth state cache - now uses get() instead of exists()
        # Return a valid state with matching fingerprint
        mocker.patch(
            "app.routers.auth.oauth_state_cache.get",
            mocker.AsyncMock(
                return_value={
                    "created": "2026-01-01T00:00:00+00:00",
                    "fingerprint": "test-fingerprint-hash",
                }
            ),
        )
        mocker.patch(
            "app.routers.auth.oauth_state_cache.delete",
            mocker.AsyncMock(),
        )

        return mock_discord_response

    @pytest.mark.asyncio
    async def test_callback_sets_access_token_cookie(
        self, client, session, mock_discord_oauth
    ):
        """Discord callback should set access_token cookie."""
        response = await client.post(
            "/api/auth/discord/callback",
            json={"code": "test_code", "state": "test_state"},
        )

        assert response.status_code == 200

        # Check that cookies are set
        cookies = response.cookies
        assert "access_token" in cookies

    @pytest.mark.asyncio
    async def test_callback_sets_refresh_token_cookie(
        self, client, session, mock_discord_oauth
    ):
        """Discord callback should set refresh_token cookie."""
        response = await client.post(
            "/api/auth/discord/callback",
            json={"code": "test_code", "state": "test_state"},
        )

        assert response.status_code == 200
        assert "refresh_token" in response.cookies


class TestCookieAttributes:
    """Test that cookies have correct security attributes."""

    @pytest.fixture
    def mock_discord_oauth(self, mocker):
        """Set up mocks for Discord OAuth flow."""
        # Note: email field omitted - we no longer request email scope from Discord
        mock_discord_response = {
            "id": "123456789012345680",
            "username": "testuser3",
            "discriminator": "0",
            "avatar": None,
            "global_name": None,
        }

        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.json.return_value = {"access_token": "discord_token"}

        mock_user_response = MagicMock()
        mock_user_response.status_code = 200
        mock_user_response.json.return_value = mock_discord_response

        mock_client = MagicMock()
        mock_client.post = mocker.AsyncMock(return_value=mock_token_response)
        mock_client.get = mocker.AsyncMock(return_value=mock_user_response)

        async def async_enter(*args, **kwargs):
            return mock_client

        async def async_exit(*args, **kwargs):
            pass

        mock_client.__aenter__ = async_enter
        mock_client.__aexit__ = async_exit

        mocker.patch("httpx.AsyncClient", return_value=mock_client)

        mock_settings = mocker.patch("app.routers.auth.settings")
        mock_settings.discord_configured = True
        mock_settings.discord_client_id = "test_client_id"
        mock_settings.discord_client_secret = "test_client_secret"
        mock_settings.discord_redirect_uri = "http://test/callback"
        mock_settings.environment = "development"
        mock_settings.jwt_access_token_expire_minutes = 15
        mock_settings.jwt_refresh_token_expire_days = 7
        mock_settings.admin_discord_ids_list = []

        # Mock client fingerprint to return a known value
        mocker.patch(
            "app.routers.auth._get_client_fingerprint",
            return_value="test-fingerprint-hash",
        )

        # Mock OAuth state cache - now uses get() instead of exists()
        mocker.patch(
            "app.routers.auth.oauth_state_cache.get",
            mocker.AsyncMock(
                return_value={
                    "created": "2026-01-01T00:00:00+00:00",
                    "fingerprint": "test-fingerprint-hash",
                }
            ),
        )
        mocker.patch(
            "app.routers.auth.oauth_state_cache.delete",
            mocker.AsyncMock(),
        )

        return mock_discord_response

    @pytest.mark.asyncio
    async def test_cookies_are_httponly(self, client, session, mock_discord_oauth):
        """Cookies should have httponly flag set."""
        response = await client.post(
            "/api/auth/discord/callback",
            json={"code": "test_code", "state": "test_state"},
        )

        assert response.status_code == 200

        # Check Set-Cookie headers for httponly attribute
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert len(set_cookie_headers) >= 2

        for header in set_cookie_headers:
            header_lower = header.lower()
            if "access_token" in header_lower or "refresh_token" in header_lower:
                assert "httponly" in header_lower, f"Cookie missing httponly: {header}"

    @pytest.mark.asyncio
    async def test_cookies_have_samesite_lax(self, client, session, mock_discord_oauth):
        """Cookies should have samesite=lax for CSRF protection."""
        response = await client.post(
            "/api/auth/discord/callback",
            json={"code": "test_code", "state": "test_state"},
        )

        assert response.status_code == 200

        set_cookie_headers = response.headers.get_list("set-cookie")

        for header in set_cookie_headers:
            header_lower = header.lower()
            if "access_token" in header_lower or "refresh_token" in header_lower:
                assert (
                    "samesite=lax" in header_lower
                ), f"Cookie missing samesite=lax: {header}"

    @pytest.mark.asyncio
    async def test_cookies_have_path_root(self, client, session, mock_discord_oauth):
        """Cookies should have path=/ to be sent with all requests."""
        response = await client.post(
            "/api/auth/discord/callback",
            json={"code": "test_code", "state": "test_state"},
        )

        assert response.status_code == 200

        set_cookie_headers = response.headers.get_list("set-cookie")

        for header in set_cookie_headers:
            header_lower = header.lower()
            if "access_token" in header_lower or "refresh_token" in header_lower:
                assert "path=/" in header_lower, f"Cookie missing path=/: {header}"


class TestApiCallsWithCookies:
    """Test that API calls work when authenticated via cookies."""

    @pytest.mark.asyncio
    async def test_get_me_with_cookie_auth(self, client, test_user: User):
        """GET /api/auth/me should work with cookie authentication."""
        access_token = create_access_token(test_user.id)

        # Set cookie on the client
        client.cookies.set("access_token", access_token)

        response = await client.get("/api/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        # API uses camelCase: discordUsername
        assert data["discordUsername"] == test_user.discord_username

    @pytest.mark.asyncio
    async def test_list_groups_with_cookie_auth(self, client, test_user: User):
        """GET /api/static-groups should work with cookie authentication."""
        access_token = create_access_token(test_user.id)
        client.cookies.set("access_token", access_token)

        response = await client.get("/api/static-groups")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_cookie_auth_takes_precedence_over_header(
        self, client, test_user: User, test_user_2: User
    ):
        """Cookie authentication should take precedence over Authorization header."""
        # Cookie has test_user's token
        cookie_token = create_access_token(test_user.id)
        client.cookies.set("access_token", cookie_token)

        # Header has test_user_2's token
        header_token = create_access_token(test_user_2.id)

        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {header_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        # Should return test_user (from cookie), not test_user_2 (from header)
        assert data["id"] == test_user.id

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, client):
        """Request without cookie or header should return 401."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_cookie_returns_401(self, client):
        """Request with invalid cookie should return 401."""
        client.cookies.set("access_token", "invalid_token")

        response = await client.get("/api/auth/me")

        assert response.status_code == 401


class TestLogoutClearsCookies:
    """Test that logout endpoint clears cookies."""

    @pytest.mark.asyncio
    async def test_logout_clears_access_token_cookie(self, client, test_user: User):
        """POST /api/auth/logout should clear access_token cookie."""
        access_token = create_access_token(test_user.id)
        client.cookies.set("access_token", access_token)

        response = await client.post("/api/auth/logout")

        assert response.status_code == 200

        # Check that Set-Cookie header clears the cookie
        set_cookie_headers = response.headers.get_list("set-cookie")
        access_token_cleared = False

        for header in set_cookie_headers:
            if "access_token" in header.lower():
                # Cookie should be cleared (empty value or max-age=0)
                access_token_cleared = True

        assert access_token_cleared, "access_token cookie was not cleared"

    @pytest.mark.asyncio
    async def test_logout_clears_refresh_token_cookie(self, client, test_user: User):
        """POST /api/auth/logout should clear refresh_token cookie."""
        access_token = create_access_token(test_user.id)
        refresh_token = create_refresh_token(test_user.id)
        client.cookies.set("access_token", access_token)
        client.cookies.set("refresh_token", refresh_token)

        response = await client.post("/api/auth/logout")

        assert response.status_code == 200

        set_cookie_headers = response.headers.get_list("set-cookie")
        refresh_token_cleared = False

        for header in set_cookie_headers:
            if "refresh_token" in header.lower():
                refresh_token_cleared = True

        assert refresh_token_cleared, "refresh_token cookie was not cleared"

    @pytest.mark.asyncio
    async def test_logout_returns_success_message(self, client, test_user: User):
        """POST /api/auth/logout should return success message when authenticated."""
        access_token = create_access_token(test_user.id)
        client.cookies.set("access_token", access_token)

        response = await client.post("/api/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Logged out successfully"

    @pytest.mark.asyncio
    async def test_logout_requires_authentication(self, client):
        """POST /api/auth/logout should reject unauthenticated requests (CSRF protection)."""
        response = await client.post("/api/auth/logout")

        # Should reject unauthenticated logout to prevent CSRF attacks
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_api_call_after_logout_fails(self, client, test_user: User):
        """API calls should fail after logout clears cookies."""
        access_token = create_access_token(test_user.id)
        client.cookies.set("access_token", access_token)

        # Verify authenticated
        response = await client.get("/api/auth/me")
        assert response.status_code == 200

        # Logout
        await client.post("/api/auth/logout")

        # Clear client cookies to simulate browser behavior after Set-Cookie
        client.cookies.clear()

        # Should now fail
        response = await client.get("/api/auth/me")
        assert response.status_code == 401


class TestTokenRefreshWithCookies:
    """Test that token refresh works with httpOnly cookies."""

    @pytest.mark.asyncio
    async def test_refresh_with_cookie(self, client, test_user: User):
        """POST /api/auth/refresh should work with refresh_token cookie."""
        refresh_token = create_refresh_token(test_user.id)
        client.cookies.set("refresh_token", refresh_token)

        response = await client.post("/api/auth/refresh")

        assert response.status_code == 200
        data = response.json()
        # API uses camelCase: accessToken, refreshToken
        assert "accessToken" in data
        assert "refreshToken" in data

    @pytest.mark.asyncio
    async def test_refresh_sets_new_cookies(self, client, test_user: User):
        """POST /api/auth/refresh should set new httpOnly cookies."""
        refresh_token = create_refresh_token(test_user.id)
        client.cookies.set("refresh_token", refresh_token)

        response = await client.post("/api/auth/refresh")

        assert response.status_code == 200

        # Check new cookies are set
        set_cookie_headers = response.headers.get_list("set-cookie")
        has_access_token = False
        has_refresh_token = False

        for header in set_cookie_headers:
            header_lower = header.lower()
            if "access_token" in header_lower:
                has_access_token = True
                assert "httponly" in header_lower
            if "refresh_token" in header_lower:
                has_refresh_token = True
                assert "httponly" in header_lower

        assert has_access_token, "New access_token cookie was not set"
        assert has_refresh_token, "New refresh_token cookie was not set"

    @pytest.mark.asyncio
    async def test_refresh_without_token_returns_401(self, client):
        """POST /api/auth/refresh without refresh token should return 401."""
        response = await client.post("/api/auth/refresh")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token_returns_401(self, client):
        """POST /api/auth/refresh with invalid token should return 401."""
        client.cookies.set("refresh_token", "invalid_token")

        response = await client.post("/api/auth/refresh")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_instead_of_refresh_returns_401(
        self, client, test_user: User
    ):
        """Using access_token as refresh_token should fail."""
        # Access tokens have different type claim than refresh tokens
        access_token = create_access_token(test_user.id)
        client.cookies.set("refresh_token", access_token)

        response = await client.post("/api/auth/refresh")

        assert response.status_code == 401


class TestBackwardCompatibility:
    """Test backward compatibility with Authorization header."""

    @pytest.mark.asyncio
    async def test_authorization_header_still_works(self, client, test_user: User):
        """Authorization header should still work for authentication."""
        access_token = create_access_token(test_user.id)

        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id

    @pytest.mark.asyncio
    async def test_refresh_with_body_still_works(self, client, test_user: User):
        """POST /api/auth/refresh with body should still work."""
        refresh_token = create_refresh_token(test_user.id)

        response = await client.post(
            "/api/auth/refresh",
            json={"refreshToken": refresh_token},
            headers={"X-Legacy-Token-Response": "1"},  # Request tokens in body
        )

        assert response.status_code == 200
        data = response.json()
        # API uses camelCase: accessToken
        assert "accessToken" in data
        assert data["accessToken"] is not None

    @pytest.mark.asyncio
    async def test_cookie_preferred_over_body_for_refresh(
        self, client, test_user: User, test_user_2: User
    ):
        """Cookie refresh token should be preferred over body."""
        # Cookie has test_user's refresh token
        cookie_token = create_refresh_token(test_user.id)
        client.cookies.set("refresh_token", cookie_token)

        # Body has test_user_2's refresh token
        body_token = create_refresh_token(test_user_2.id)

        response = await client.post(
            "/api/auth/refresh",
            json={"refreshToken": body_token},
            headers={"X-Legacy-Token-Response": "1"},  # Request tokens in body
        )

        assert response.status_code == 200

        # Verify the new tokens are for test_user (from cookie)
        # by using the new access token (API uses camelCase: accessToken)
        new_access_token = response.json()["accessToken"]
        client.cookies.clear()

        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )

        assert response.status_code == 200
        assert response.json()["id"] == test_user.id

    @pytest.mark.asyncio
    async def test_tokens_not_in_body_by_default(self, client, test_user: User):
        """Tokens should NOT be returned in response body by default (security)."""
        refresh_token = create_refresh_token(test_user.id)

        # Without the legacy header, tokens should not be in response body
        response = await client.post(
            "/api/auth/refresh",
            json={"refreshToken": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()
        # Tokens should be None (not included in response)
        assert data.get("accessToken") is None
        assert data.get("refreshToken") is None
        # But expires_in should still be present
        assert "expiresIn" in data
