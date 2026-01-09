"""Tests for production configuration validation"""

import os
import pytest
from unittest.mock import patch

from pydantic import ValidationError


class TestProductionConfigValidation:
    """Tests for Settings.validate_production_config()"""

    def test_development_allows_no_jwt_secret(self):
        """In development, JWT secret is auto-generated if not set."""
        from app.config import Settings

        with patch.dict(os.environ, {"ENVIRONMENT": "development", "JWT_SECRET_KEY": ""}, clear=False):
            # Clear any cached settings
            from app.config import get_settings
            get_settings.cache_clear()

            settings = Settings(environment="development", jwt_secret_key="")

            # Should auto-generate a secret
            assert len(settings.jwt_secret_key) >= 32

    def test_production_requires_jwt_secret(self):
        """In production, JWT_SECRET_KEY is required."""
        from app.config import Settings

        with pytest.raises(ValidationError) as exc_info:
            Settings(environment="production", jwt_secret_key="")

        assert "JWT_SECRET_KEY" in str(exc_info.value)

    def test_production_jwt_secret_minimum_length(self):
        """In production, JWT_SECRET_KEY must be at least 32 characters."""
        from app.config import Settings

        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment="production",
                jwt_secret_key="short_secret",  # Only 12 chars
                debug=False,
                database_url="postgresql://localhost/db",
            )

        assert "32 characters" in str(exc_info.value)

    def test_production_rejects_placeholder_secrets(self):
        """In production, placeholder-like secrets should be rejected."""
        from app.config import Settings

        # All secrets must be 32+ chars to pass length check and hit pattern check
        # Patterns use word boundaries to reduce false positives
        placeholder_secrets = [
            ("changeme please this is 32 chars!", "changeme"),  # word boundary match
            ("my secret key for production use!!", "secret"),   # word boundary match
            ("dev-production-key-for-my-server!", "dev-"),      # dev- at word boundary
            ("test_production_jwt_secret_key!!", "test_"),      # test_ at word boundary
            ("placeholder value for jwt tokens!", "placeholder"),  # word boundary match
            ("password_for_production_server!!!", "password"),  # ^password pattern
            ("supersecure_production_secret_key", "_key"),      # _key$ pattern
        ]

        for secret, expected_pattern in placeholder_secrets:
            with pytest.raises(ValidationError) as exc_info:
                Settings(
                    environment="production",
                    jwt_secret_key=secret,
                    debug=False,
                    database_url="postgresql://localhost/db",
                )

            error_msg = str(exc_info.value).lower()
            assert "placeholder" in error_msg or expected_pattern.replace("_", "").replace("-", "") in error_msg, \
                f"Expected error about placeholder patterns for '{secret}', got: {exc_info.value}"

    def test_production_accepts_valid_secret(self):
        """In production, a proper random secret should be accepted."""
        from app.config import Settings
        import secrets

        valid_secret = secrets.token_urlsafe(32)

        # Should not raise
        settings = Settings(
            environment="production",
            jwt_secret_key=valid_secret,
            debug=False,
            database_url="postgresql://localhost/db",
            cors_origins_production="https://example.com",
        )

        assert settings.jwt_secret_key == valid_secret

    def test_production_debug_must_be_false(self):
        """In production, DEBUG must be False."""
        from app.config import Settings
        import secrets

        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment="production",
                jwt_secret_key=secrets.token_urlsafe(32),
                debug=True,  # Should fail
                database_url="postgresql://localhost/db",
            )

        assert "DEBUG" in str(exc_info.value) and "False" in str(exc_info.value)

    def test_production_rejects_sqlite(self):
        """In production, SQLite database should be rejected."""
        from app.config import Settings
        import secrets

        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment="production",
                jwt_secret_key=secrets.token_urlsafe(32),
                debug=False,
                database_url="sqlite:///./data/app.db",
            )

        assert "SQLite" in str(exc_info.value)

    def test_production_warns_missing_cors_origins(self):
        """In production, missing CORS_ORIGINS_PRODUCTION should warn."""
        from app.config import Settings
        import secrets
        import warnings

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            # Settings instance not stored since we only care about the warning
            Settings(
                environment="production",
                jwt_secret_key=secrets.token_urlsafe(32),
                debug=False,
                database_url="postgresql://localhost/db",
                cors_origins_production="",  # Empty = not set
            )

            # Check that a warning was issued
            cors_warnings = [warning for warning in w if "CORS" in str(warning.message)]
            assert len(cors_warnings) >= 1

    def test_development_allows_debug_true(self):
        """In development, DEBUG=True is allowed."""
        from app.config import Settings
        import secrets

        # Should not raise
        settings = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=True,
            database_url="sqlite:///./data/app.db",
        )

        assert settings.debug is True

    def test_development_allows_sqlite(self):
        """In development, SQLite database is allowed."""
        from app.config import Settings
        import secrets

        # Should not raise
        settings = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=True,
            database_url="sqlite:///./data/app.db",
        )

        assert "sqlite" in settings.database_url

    def test_cors_origins_list_production(self):
        """In production, cors_origins_list uses cors_origins_production."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="production",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=False,
            database_url="postgresql://localhost/db",
            cors_origins="http://localhost:5173",
            cors_origins_production="https://app.example.com,https://www.example.com",
        )

        origins = settings.cors_origins_list
        assert "https://app.example.com" in origins
        assert "https://www.example.com" in origins
        assert "http://localhost:5173" not in origins

    def test_cors_origins_list_development(self):
        """In development, cors_origins_list uses cors_origins."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=True,
            database_url="sqlite:///./data/app.db",
            cors_origins="http://localhost:5173,http://localhost:5174",
        )

        origins = settings.cors_origins_list
        assert "http://localhost:5173" in origins
        assert "http://localhost:5174" in origins

    def test_async_database_url_postgres_conversion(self):
        """PostgreSQL URLs should be converted to asyncpg format."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="production",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=False,
            database_url="postgresql://user:pass@host/db",
            cors_origins_production="https://example.com",
        )

        assert settings.async_database_url == "postgresql+asyncpg://user:pass@host/db"

    def test_async_database_url_postgres_alt_conversion(self):
        """postgres:// URLs (Heroku-style) should also be converted."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="production",
            jwt_secret_key=secrets.token_urlsafe(32),
            debug=False,
            database_url="postgres://user:pass@host/db",
            cors_origins_production="https://example.com",
        )

        assert settings.async_database_url == "postgresql+asyncpg://user:pass@host/db"

    def test_discord_configured_when_both_set(self):
        """discord_configured returns True when both client_id and secret are set."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            discord_client_id="123456789",
            discord_client_secret="my_secret",
        )

        assert settings.discord_configured is True

    def test_discord_not_configured_when_missing(self):
        """discord_configured returns False when either is missing."""
        from app.config import Settings
        import secrets

        settings = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            discord_client_id="",
            discord_client_secret="my_secret",
        )

        assert settings.discord_configured is False

        settings2 = Settings(
            environment="development",
            jwt_secret_key=secrets.token_urlsafe(32),
            discord_client_id="123456789",
            discord_client_secret="",
        )

        assert settings2.discord_configured is False
