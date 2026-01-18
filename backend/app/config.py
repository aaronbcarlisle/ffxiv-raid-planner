"""Application configuration using pydantic-settings"""

import re
import secrets
from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Allowed JWT algorithms (HS256 is preferred for symmetric keys)
# Explicitly exclude "none" and weak algorithms
AllowedJWTAlgorithm = Literal["HS256", "HS384", "HS512"]


# Forbidden patterns for JWT secret validation
# Uses word boundaries (\b) to reduce false positives with randomly generated secrets
# that might contain letter sequences like "test" as part of a larger random string.
FORBIDDEN_SECRET_PATTERNS: list[str] = [
    r"\bchangeme\b",       # Common placeholder value
    r"\bsecret\b",         # Generic "secret" placeholder
    r"\b(?:dev-|dev_)",    # Development prefix (dev-, dev_)
    r"\b(?:test-|test_)",  # Test prefix (test-, test_)
    r"\bplaceholder\b",    # Explicit placeholder marker
    r"\bexample\b",        # Example/documentation value
    r"^password",          # Starts with "password"
    r"_key$",              # Ends with "_key" (like "my_api_key")
]


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Environment (development/production)
    environment: str = "development"

    # Database - Railway provides DATABASE_URL for PostgreSQL
    database_url: str = "sqlite+aiosqlite:///./data/raid_planner.db"

    @property
    def async_database_url(self) -> str:
        """Convert database URL to async-compatible format"""
        url = self.database_url
        # Railway's PostgreSQL URL needs asyncpg driver
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    # CORS - development includes common Vite dev server ports
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://localhost:5178,http://localhost:5179,http://localhost:5180,http://localhost:5181,http://localhost:5182,http://127.0.0.1:5173"

    # CORS for production - only the actual frontend domain (set via CORS_ORIGINS_PRODUCTION)
    cors_origins_production: str = ""  # e.g., "https://raidplanner.example.com"

    # CORS regex pattern for Vercel preview deployments (opt-in for security)
    # Empty by default - set explicitly to enable preview domain access
    # Example pattern: https://ffxiv-raid-planner-dev-.*\.vercel\.app
    # WARNING: Only use for preview/staging deployments, not general *.vercel.app access
    cors_vercel_preview_pattern: str = ""

    # Debug mode
    debug: bool = True

    # Logging
    log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # Redis (optional - falls back to in-memory cache if not configured)
    redis_url: str = ""  # e.g., "redis://localhost:6379/0"

    # Discord OAuth
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:5173/auth/callback"

    # JWT Configuration
    jwt_secret_key: str = ""  # Set via JWT_SECRET_KEY env var (required in production)
    jwt_algorithm: AllowedJWTAlgorithm = "HS256"  # Only allow secure HMAC algorithms
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Frontend URL (for redirects)
    frontend_url: str = "http://localhost:5173"

    # Admin Discord IDs (comma-separated) - users with these Discord IDs
    # automatically get admin privileges on login. This is the only way to
    # grant admin access besides direct database modification.
    # Example: "123456789012345678,987654321098765432"
    admin_discord_ids: str = ""

    # Trusted proxy IPs (comma-separated) - only these IPs can set
    # X-Forwarded-For and X-Real-IP headers for rate limiting.
    # This prevents rate limit bypass by spoofing client IP.
    #
    # Common configurations:
    # - Local dev: "127.0.0.1"
    # - Docker: "172.17.0.1" (Docker bridge gateway)
    # - Cloud LB: "10.0.0.1,10.0.0.2" (internal LB IPs)
    # - Kubernetes: Pod CIDR or ingress controller IPs
    #
    # Security: NEVER use public IPs here - only internal proxy IPs.
    # If empty, X-Forwarded-For headers are ignored (direct peer IP used).
    trusted_proxy_ips: str = ""

    @property
    def trusted_proxy_ips_list(self) -> list[str]:
        """Parse comma-separated trusted proxy IPs into a list."""
        if not self.trusted_proxy_ips:
            return []
        return [ip.strip() for ip in self.trusted_proxy_ips.split(",") if ip.strip()]

    @property
    def admin_discord_ids_list(self) -> list[str]:
        """Parse comma-separated admin Discord IDs into a list."""
        if not self.admin_discord_ids:
            return []
        return [id.strip() for id in self.admin_discord_ids.split(",") if id.strip()]

    @model_validator(mode='after')
    def validate_production_config(self) -> Self:
        """Validate configuration for production environment.

        Ensures proper security settings are in place for production deployments.
        Auto-generates JWT secret for local development only.
        """
        is_production = self.environment == "production"

        # JWT Secret validation
        if not self.jwt_secret_key:
            if is_production:
                raise ValueError(
                    "JWT_SECRET_KEY environment variable must be set in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            # Auto-generate for local development only
            object.__setattr__(self, 'jwt_secret_key', secrets.token_urlsafe(32))
            print("⚠️  Using auto-generated JWT secret (development mode)")

        if is_production:
            # Validate JWT secret strength
            if len(self.jwt_secret_key) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be at least 32 characters in production"
                )

            # Check for placeholder patterns
            secret_lower = self.jwt_secret_key.lower()
            if any(re.search(p, secret_lower) for p in FORBIDDEN_SECRET_PATTERNS):
                raise ValueError(
                    "JWT_SECRET_KEY appears to contain a placeholder value - "
                    "please use a secure random key"
                )

            # Validate debug mode is off
            if self.debug:
                raise ValueError(
                    "DEBUG must be False in production for security"
                )

            # Validate database is not SQLite
            if 'sqlite' in self.database_url.lower():
                raise ValueError(
                    "SQLite is not recommended for production - use PostgreSQL"
                )

            # Warn (but don't fail) if CORS production origins not set
            if not self.cors_origins_production:
                import warnings
                warnings.warn(
                    "CORS_ORIGINS_PRODUCTION is not set - using development CORS origins. "
                    "This may be a security risk in production.",
                    UserWarning,
                )

        return self

    @property
    def cors_origins_list(self) -> list[str]:
        """
        Parse comma-separated CORS origins into a list.

        In production, uses cors_origins_production (strict whitelist).
        Falls back to cors_origins if production origins not configured.
        """
        if self.environment == "production" and self.cors_origins_production:
            origins = self.cors_origins_production
        else:
            origins = self.cors_origins
        return [origin.strip() for origin in origins.split(",") if origin.strip()]

    @property
    def discord_configured(self) -> bool:
        """Check if Discord OAuth is properly configured"""
        return bool(self.discord_client_id and self.discord_client_secret)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
