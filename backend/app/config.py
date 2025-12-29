"""Application configuration using pydantic-settings"""

import secrets
from functools import lru_cache
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Frontend URL (for redirects)
    frontend_url: str = "http://localhost:5173"

    @model_validator(mode='after')
    def validate_jwt_secret(self) -> Self:
        """Ensure JWT secret is set in production, auto-generate for local dev."""
        if not self.jwt_secret_key:
            if self.environment == "production":
                raise ValueError(
                    "JWT_SECRET_KEY environment variable must be set in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            # Auto-generate for local development only
            object.__setattr__(self, 'jwt_secret_key', secrets.token_urlsafe(32))
            print("⚠️  Using auto-generated JWT secret (development mode)")
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
