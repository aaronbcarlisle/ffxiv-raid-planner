"""Tests for rate limiting, particularly IP extraction security."""

from unittest.mock import MagicMock, patch

from fastapi import Request

from app.rate_limit import get_client_ip


class TestGetClientIP:
    """Test client IP extraction with trusted proxy validation."""

    def _make_request(
        self, client_host: str | None, headers: dict[str, str] | None = None
    ) -> Request:
        """Create a mock Request object."""
        request = MagicMock(spec=Request)
        if client_host:
            request.client = MagicMock()
            request.client.host = client_host
        else:
            request.client = None
        request.headers = headers or {}
        return request

    def test_returns_peer_ip_when_no_trusted_proxies(self):
        """Without trusted proxies, should return direct peer IP."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = []

            request = self._make_request(
                client_host="192.168.1.100",
                headers={"X-Forwarded-For": "10.0.0.1"},
            )

            result = get_client_ip(request)
            assert result == "192.168.1.100"

    def test_ignores_x_forwarded_for_from_untrusted_source(self):
        """X-Forwarded-For should be ignored from untrusted sources."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.99"]

            request = self._make_request(
                client_host="192.168.1.100",  # Not in trusted list
                headers={"X-Forwarded-For": "attacker-spoofed-ip"},
            )

            result = get_client_ip(request)
            assert result == "192.168.1.100"

    def test_trusts_x_forwarded_for_from_trusted_proxy(self):
        """X-Forwarded-For should be trusted from configured proxies."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",  # Trusted proxy
                headers={"X-Forwarded-For": "203.0.113.50"},
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_handles_multiple_ips_in_x_forwarded_for(self):
        """Should extract first IP from X-Forwarded-For chain."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Forwarded-For": "203.0.113.50, 10.0.0.2, 10.0.0.1"},
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_trusts_x_real_ip_from_trusted_proxy(self):
        """X-Real-IP should be trusted from configured proxies."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Real-IP": "203.0.113.50"},
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_x_forwarded_for_takes_precedence_over_x_real_ip(self):
        """X-Forwarded-For should be checked before X-Real-IP."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={
                    "X-Forwarded-For": "203.0.113.50",
                    "X-Real-IP": "203.0.113.99",
                },
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_returns_unknown_when_no_client(self):
        """Should return 'unknown' when no client info available."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = []

            request = self._make_request(client_host=None)

            result = get_client_ip(request)
            assert result == "unknown"

    def test_multiple_trusted_proxies(self):
        """Should accept requests from any configured trusted proxy."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1", "10.0.0.2", "10.0.0.3"]

            # Request from second trusted proxy
            request = self._make_request(
                client_host="10.0.0.2",
                headers={"X-Forwarded-For": "203.0.113.50"},
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_strips_whitespace_from_forwarded_ip(self):
        """Should strip whitespace from extracted IPs."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Forwarded-For": "  203.0.113.50  , 10.0.0.1"},
            )

            result = get_client_ip(request)
            assert result == "203.0.113.50"

    def test_rejects_malformed_ip_in_x_forwarded_for(self):
        """Should reject malformed IPs and fall back to peer IP."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            # Injection attempt
            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Forwarded-For": "' OR 1=1--"},
            )

            result = get_client_ip(request)
            # Should fall back to peer IP since malformed IP is rejected
            assert result == "10.0.0.1"

    def test_rejects_malformed_ip_in_x_real_ip(self):
        """Should reject malformed X-Real-IP and fall back to peer IP."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Real-IP": "not-an-ip-address"},
            )

            result = get_client_ip(request)
            assert result == "10.0.0.1"

    def test_accepts_valid_ipv6_address(self):
        """Should accept valid IPv6 addresses."""
        with patch("app.rate_limit.settings") as mock_settings:
            mock_settings.trusted_proxy_ips_list = ["10.0.0.1"]

            request = self._make_request(
                client_host="10.0.0.1",
                headers={"X-Forwarded-For": "2001:db8::1"},
            )

            result = get_client_ip(request)
            assert result == "2001:db8::1"
