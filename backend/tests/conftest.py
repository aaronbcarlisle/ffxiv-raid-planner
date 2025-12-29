"""Pytest fixtures for the test suite"""

from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth_utils import create_access_token
from app.database import Base, get_session
from app.main import app
from app.models import User

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def engine():
    """Create a test database engine with in-memory SQLite."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with the test database session."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(session: AsyncSession) -> User:
    """Create a test user in the database."""
    from tests.factories import create_user

    return await create_user(session)


@pytest_asyncio.fixture
async def test_user_2(session: AsyncSession) -> User:
    """Create a second test user in the database."""
    from tests.factories import create_user

    return await create_user(
        session,
        discord_id="987654321098765432",
        discord_username="testuser2",
    )


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    """Get authorization headers for the test user."""
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_user2(test_user_2: User) -> dict[str, str]:
    """Get authorization headers for the second test user."""
    token = create_access_token(test_user_2.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_group(session: AsyncSession, test_user: User) -> Any:
    """Create a test static group with the test user as owner."""
    from tests.factories import create_static_group

    return await create_static_group(session, owner=test_user)


@pytest_asyncio.fixture
async def test_tier(session: AsyncSession, test_group: Any) -> Any:
    """Create a test tier snapshot for the test group."""
    from tests.factories import create_tier_snapshot

    return await create_tier_snapshot(session, static_group=test_group)
