"""Application configuration using pydantic-settings"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

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

    # CORS - include common Vite dev server ports
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://localhost:5178,http://localhost:5179,http://localhost:5180,http://localhost:5181,http://localhost:5182,http://127.0.0.1:5173"

    # Debug mode
    debug: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
