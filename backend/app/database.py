"""Database setup with async SQLAlchemy"""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""

    pass


settings = get_settings()

# Create async engine (uses async_database_url for proper driver)
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def create_tables() -> None:
    """Create all database tables"""
    # Ensure data directory exists for SQLite
    if "sqlite" in settings.async_database_url:
        db_path = settings.database_url.split("///")[-1]
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
