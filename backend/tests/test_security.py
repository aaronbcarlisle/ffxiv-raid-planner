"""Tests for security features: CSP headers and SSRF protection."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers.bis import (
    fetch_bis_from_etro,
    fetch_bis_from_github,
    fetch_bis_from_shortlink,
    fetch_item_from_garland,
)


class TestContentSecurityPolicy:
    """Test CSP header implementation."""

    @pytest.mark.asyncio
    async def test_csp_header_present_in_production(self, client):
        """CSP header should be present when environment is production."""
        with patch("app.middleware.security.get_settings") as mock_settings:
            mock_settings.return_value.environment = "production"

            response = await client.get("/health")

            assert response.status_code == 200
            assert "Content-Security-Policy" in response.headers

    @pytest.mark.asyncio
    async def test_csp_header_absent_in_development(self, client):
        """CSP header should NOT be present in development mode."""
        with patch("app.middleware.security.get_settings") as mock_settings:
            mock_settings.return_value.environment = "development"

            response = await client.get("/health")

            assert response.status_code == 200
            # In development, CSP should not be added
            assert "Content-Security-Policy" not in response.headers

    @pytest.mark.asyncio
    async def test_csp_contains_required_directives(self, client):
        """CSP should contain all required security directives."""
        with patch("app.middleware.security.get_settings") as mock_settings:
            mock_settings.return_value.environment = "production"

            response = await client.get("/health")

            # CSP must be present in production mode
            assert "Content-Security-Policy" in response.headers, (
                "CSP header missing in production mode"
            )
            csp = response.headers["Content-Security-Policy"]

            # Check required directives
            assert "default-src 'self'" in csp
            assert "script-src 'self'" in csp
            assert "object-src 'none'" in csp
            assert "frame-ancestors 'none'" in csp
            assert "base-uri 'self'" in csp
            assert "form-action 'self'" in csp

            # Parse CSP into directives to avoid relying on directive order
            directives = {}
            for directive in csp.split(";"):
                directive = directive.strip()
                if not directive:
                    continue
                parts = directive.split()
                name = parts[0]
                directives[name] = parts[1:]

            script_src_values = directives.get("script-src", [])
            style_src_values = directives.get("style-src", [])

            # Verify unsafe-inline is NOT in script-src
            # (it's allowed in style-src for Tailwind)
            assert "'unsafe-inline'" not in script_src_values
            assert "'unsafe-inline'" in style_src_values


class TestSSRFProtection:
    """Test SSRF protection via redirect rejection."""

    @pytest.mark.asyncio
    async def test_garland_rejects_redirect(self):
        """Garland Tools API should reject redirects."""
        mock_response = MagicMock()
        mock_response.status_code = 302

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await fetch_item_from_garland(12345)

            # Should return placeholder data instead of following redirect
            assert result["name"] == "Unknown"
            assert result["id"] == 12345

    @pytest.mark.asyncio
    async def test_github_rejects_redirect(self):
        """GitHub raw API should reject redirects."""
        mock_response = MagicMock()
        mock_response.status_code = 301

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await fetch_bis_from_github("drg", "current")

            assert exc_info.value.status_code == 502
            assert "redirect" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_xivgear_rejects_redirect(self):
        """XIVGear API should reject redirects."""
        mock_response = MagicMock()
        mock_response.status_code = 307

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await fetch_bis_from_shortlink("test-uuid")

            assert exc_info.value.status_code == 502
            assert "redirect" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_etro_rejects_redirect(self):
        """Etro API should reject redirects."""
        mock_response = MagicMock()
        mock_response.status_code = 308

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await fetch_bis_from_etro("test-uuid")

            assert exc_info.value.status_code == 502
            assert "redirect" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_rejects_all_3xx_status_codes(self):
        """Should reject all 3xx status codes, not just common ones."""
        # Test with 300 (Multiple Choices) - edge case
        mock_response = MagicMock()
        mock_response.status_code = 300

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await fetch_bis_from_github("drg", "current")

            assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_allows_successful_responses(self):
        """Should allow 200 OK responses through."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"sets": [{"name": "Test Set", "items": {}}]}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await fetch_bis_from_github("drg", "current")

            assert result == {"sets": [{"name": "Test Set", "items": {}}]}


class TestOAuthSSRFProtection:
    """Test SSRF protection in Discord OAuth endpoints."""

    @pytest.mark.asyncio
    async def test_token_exchange_rejects_redirect(self, client):
        """Discord token exchange should reject redirects."""
        with (
            patch("app.routers.auth.get_settings") as mock_settings,
            patch("app.routers.auth.oauth_state_cache") as mock_cache,
            patch("httpx.AsyncClient") as mock_client_class,
        ):
            # Configure settings
            mock_settings.return_value.discord_client_id = "test-client-id"
            mock_settings.return_value.discord_client_secret = "test-secret"
            mock_settings.return_value.discord_redirect_uri = "http://localhost/callback"

            # Make state valid - now uses get() instead of exists()
            mock_cache.get = AsyncMock(
                return_value={
                    "created": "2026-01-01T00:00:00+00:00",
                    "fingerprint": None,
                }
            )
            mock_cache.delete = AsyncMock()

            # Mock httpx to return a redirect
            mock_response = MagicMock()
            mock_response.status_code = 302

            mock_http_client = AsyncMock()
            mock_http_client.post.return_value = mock_response
            mock_http_client.__aenter__.return_value = mock_http_client
            mock_http_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_http_client

            response = await client.post(
                "/api/auth/discord/callback",
                json={"code": "test-code", "state": "test-state"},
            )

            # Should reject with 502 due to redirect
            assert response.status_code == 502
            assert "redirect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_user_info_rejects_redirect(self, client):
        """Discord user info endpoint should reject redirects."""
        with (
            patch("app.routers.auth.get_settings") as mock_settings,
            patch("app.routers.auth.oauth_state_cache") as mock_cache,
            patch("httpx.AsyncClient") as mock_client_class,
        ):
            # Configure settings
            mock_settings.return_value.discord_client_id = "test-client-id"
            mock_settings.return_value.discord_client_secret = "test-secret"
            mock_settings.return_value.discord_redirect_uri = "http://localhost/callback"

            # Make state valid - now uses get() instead of exists()
            mock_cache.get = AsyncMock(
                return_value={
                    "created": "2026-01-01T00:00:00+00:00",
                    "fingerprint": None,
                }
            )
            mock_cache.delete = AsyncMock()

            # Mock httpx: token exchange succeeds, user info returns redirect
            token_response = MagicMock()
            token_response.status_code = 200
            token_response.json.return_value = {"access_token": "test-token"}

            user_response = MagicMock()
            user_response.status_code = 307  # Temporary redirect

            mock_http_client = AsyncMock()
            mock_http_client.post.return_value = token_response
            mock_http_client.get.return_value = user_response
            mock_http_client.__aenter__.return_value = mock_http_client
            mock_http_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_http_client

            response = await client.post(
                "/api/auth/discord/callback",
                json={"code": "test-code", "state": "test-state"},
            )

            # Should reject with 502 due to redirect
            assert response.status_code == 502
            assert "redirect" in response.json()["detail"].lower()
