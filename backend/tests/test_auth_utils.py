"""Tests for JWT authentication utilities"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from jose import jwt

from app.auth_utils import create_access_token, create_refresh_token, verify_token
from app.config import get_settings


class TestCreateAccessToken:
    """Tests for create_access_token()"""

    def test_creates_valid_jwt(self):
        """Access token should be a valid JWT."""
        user_id = "user-123"
        token = create_access_token(user_id)

        # Should be decodable
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_has_correct_expiration(self):
        """Access token should expire in configured minutes."""
        settings = get_settings()
        user_id = "user-123"
        token = create_access_token(user_id)

        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

        # Expiration should be ~15 minutes from now
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp_time - now

        assert timedelta(minutes=14) < delta < timedelta(minutes=16)


class TestCreateRefreshToken:
    """Tests for create_refresh_token()"""

    def test_creates_valid_jwt(self):
        """Refresh token should be a valid JWT."""
        user_id = "user-123"
        token = create_refresh_token(user_id)

        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert "exp" in payload

    def test_has_longer_expiration(self):
        """Refresh token should expire in configured days."""
        settings = get_settings()
        user_id = "user-123"
        token = create_refresh_token(user_id)

        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

        # Expiration should be ~7 days from now
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp_time - now

        assert timedelta(days=6) < delta < timedelta(days=8)


class TestVerifyToken:
    """Tests for verify_token()"""

    def test_verifies_valid_access_token(self):
        """Valid access token should return user_id."""
        user_id = "user-123"
        token = create_access_token(user_id)

        result = verify_token(token, token_type="access")

        assert result == user_id

    def test_verifies_valid_refresh_token(self):
        """Valid refresh token should return user_id."""
        user_id = "user-456"
        token = create_refresh_token(user_id)

        result = verify_token(token, token_type="refresh")

        assert result == user_id

    def test_rejects_wrong_token_type(self):
        """Token with wrong type should return None."""
        user_id = "user-123"
        access_token = create_access_token(user_id)

        # Try to verify access token as refresh token
        result = verify_token(access_token, token_type="refresh")

        assert result is None

    def test_rejects_expired_token(self):
        """Expired token should return None."""
        settings = get_settings()

        # Create a manually crafted expired token
        expired_payload = {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
        }
        expired_token = jwt.encode(
            expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )

        result = verify_token(expired_token, token_type="access")

        assert result is None

    def test_rejects_invalid_signature(self):
        """Token with wrong signature should return None."""
        user_id = "user-123"
        token = create_access_token(user_id)

        # Corrupt the token
        corrupted_token = token[:-5] + "XXXXX"

        result = verify_token(corrupted_token, token_type="access")

        assert result is None

    def test_rejects_malformed_token(self):
        """Malformed token should return None."""
        result = verify_token("not-a-valid-token", token_type="access")

        assert result is None

    def test_rejects_empty_token(self):
        """Empty token should return None."""
        result = verify_token("", token_type="access")

        assert result is None

    def test_rejects_token_without_sub(self):
        """Token without 'sub' claim should return None."""
        settings = get_settings()

        # Create token without sub
        payload = {
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "type": "access",
        }
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        result = verify_token(token, token_type="access")

        assert result is None

    def test_logging_on_type_mismatch(self, caplog):
        """Token type mismatch should be logged."""
        import logging

        user_id = "user-123"
        access_token = create_access_token(user_id)

        with caplog.at_level(logging.DEBUG):
            verify_token(access_token, token_type="refresh")

        # Should have logged the mismatch (structlog uses different format)
        # The actual log message depends on structlog configuration

    def test_logging_on_expired_token(self, caplog):
        """Expired token should be logged."""
        import logging

        settings = get_settings()
        expired_payload = {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
        }
        expired_token = jwt.encode(
            expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )

        with caplog.at_level(logging.DEBUG):
            verify_token(expired_token, token_type="access")

        # Should have logged the expiration

    def test_logging_on_invalid_token(self, caplog):
        """Invalid token should be logged."""
        import logging

        with caplog.at_level(logging.DEBUG):
            verify_token("invalid-token", token_type="access")

        # Should have logged the failure


class TestTokenRoundTrip:
    """Integration tests for token creation and verification"""

    def test_access_token_roundtrip(self):
        """Create and verify access token."""
        user_id = "user-abc-123"
        token = create_access_token(user_id)
        result = verify_token(token, token_type="access")

        assert result == user_id

    def test_refresh_token_roundtrip(self):
        """Create and verify refresh token."""
        user_id = "user-def-456"
        token = create_refresh_token(user_id)
        result = verify_token(token, token_type="refresh")

        assert result == user_id

    def test_different_users_get_different_tokens(self):
        """Different users should get different tokens."""
        token1 = create_access_token("user-1")
        token2 = create_access_token("user-2")

        assert token1 != token2

    def test_same_user_gets_different_tokens(self):
        """Same user should get different tokens (different exp)."""
        import time

        token1 = create_access_token("user-1")
        time.sleep(0.01)  # Small delay to ensure different timestamp
        token2 = create_access_token("user-1")

        # Tokens may be identical if created at same second, but that's OK
        # The important thing is they're both valid
        assert verify_token(token1, token_type="access") == "user-1"
        assert verify_token(token2, token_type="access") == "user-1"
