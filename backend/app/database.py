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
    """Create all database tables.

    Also adds missing columns to existing tables (dev only). SQLAlchemy's
    create_all does not ALTER existing tables, so new model columns won't
    appear until the table is recreated or an Alembic migration runs. This
    helper bridges the gap for local development with SQLite.
    """
    # Ensure data directory exists for SQLite
    if "sqlite" in settings.async_database_url:
        db_path = settings.database_url.split("///")[-1]
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add missing columns to existing tables (SQLite dev only)
        if "sqlite" in settings.async_database_url:
            await conn.run_sync(_add_missing_columns)


def _add_missing_columns(conn: object) -> None:
    """Check every model table for columns missing from SQLite and ALTER to add them."""
    from sqlalchemy import inspect, text

    inspector = inspect(conn)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            col_type = col.type.compile(dialect=conn.dialect)
            nullable = "NULL" if col.nullable else "NOT NULL"
            default = ""
            if col.server_default is not None:
                default = f" DEFAULT {col.server_default.arg}"
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type} {nullable}{default}"
            conn.execute(text(ddl))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions.

    Note: This does NOT auto-commit. Write operations must explicitly
    call `await session.commit()` to persist changes to the database.
    Rollback happens automatically on exceptions.
    """
    async with async_session_maker() as session:
        try:
            yield session
            # Don't auto-commit - let endpoints call commit explicitly
        except Exception:
            await session.rollback()
            raise
