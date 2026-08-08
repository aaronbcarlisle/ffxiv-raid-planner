"""Tests for the race-safe PlayerProfile get-or-create.

The bug this guards against, observed in production on 2026-08-06: several
requests for a user with no profile yet each read "no profile", each insert,
and the losers raise

    UniqueViolationError: duplicate key value violates unique constraint
    "player_profiles_user_id_key"

which surfaced to the user as a 500. Three inserts for one user_id landed
inside 47ms.
"""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player_profile import PlayerProfile
from app.models.user import User
from app.services import player_profile_service
from app.services.player_profile_service import get_or_create_profile


async def _profile_count(session: AsyncSession, user_id: str) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(PlayerProfile)
        .where(PlayerProfile.user_id == user_id)
    )


class TestGetOrCreateProfile:
    async def test_creates_when_absent(self, session: AsyncSession, test_user: User):
        assert await _profile_count(session, test_user.id) == 0

        profile = await get_or_create_profile(session, test_user.id)

        assert profile.user_id == test_user.id
        assert profile.visibility == "private"
        assert profile.share_enabled is False
        assert await _profile_count(session, test_user.id) == 1

    async def test_returns_existing_without_creating(
        self, session: AsyncSession, test_user: User
    ):
        first = await get_or_create_profile(session, test_user.id)
        await session.commit()

        second = await get_or_create_profile(session, test_user.id)

        assert second.id == first.id
        assert await _profile_count(session, test_user.id) == 1

    async def test_lost_race_returns_winners_row(
        self, session: AsyncSession, test_user: User, monkeypatch
    ):
        """The production bug: the row appears between our read and our insert.

        Simulated by forcing the initial lookup to report "absent" for a user who
        already has a profile, so the INSERT hits the unique constraint exactly
        as a losing concurrent request does. The helper must recover and return
        the existing row rather than raising.
        """
        winner = PlayerProfile(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            visibility="private",
            share_enabled=False,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )
        session.add(winner)
        await session.commit()

        real_select = player_profile_service._select_profile
        calls = {"n": 0}

        async def stale_first_read(sess, user_id, options):
            calls["n"] += 1
            if calls["n"] == 1:
                return None  # stale read: the winner isn't visible to us yet
            return await real_select(sess, user_id, options)

        monkeypatch.setattr(
            player_profile_service, "_select_profile", stale_first_read
        )

        profile = await get_or_create_profile(session, test_user.id)

        assert profile.id == winner.id, "should return the winner's row"
        assert calls["n"] == 2, "should re-read after losing the race"
        assert await _profile_count(session, test_user.id) == 1, "no duplicate"

    async def test_lost_race_leaves_outer_transaction_usable(
        self, session: AsyncSession, test_user: User, monkeypatch
    ):
        """Losing the race must not poison the caller's transaction.

        The insert runs in a SAVEPOINT precisely so the outer transaction -- which
        may already hold writes worth keeping -- survives the unique violation.

        Caveat on what this proves: the test database is in-memory SQLite
        (conftest.py) and the engine carries no do_connect/do_begin savepoint
        recipe, which SQLAlchemy documents as required for pysqlite to handle
        SAVEPOINT correctly. So a green result here demonstrates the *caller-facing
        contract* (the session is still usable, no duplicate row) rather than
        independently proving SAVEPOINT isolation. That property holds on
        PostgreSQL, which is where the production race actually occurs.
        """
        winner = PlayerProfile(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            visibility="private",
            share_enabled=False,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )
        session.add(winner)
        await session.commit()

        real_select = player_profile_service._select_profile
        calls = {"n": 0}

        async def stale_first_read(sess, user_id, options):
            calls["n"] += 1
            if calls["n"] == 1:
                return None
            return await real_select(sess, user_id, options)

        monkeypatch.setattr(
            player_profile_service, "_select_profile", stale_first_read
        )

        await get_or_create_profile(session, test_user.id)

        # The session must still be usable: write, commit, read back.
        winner.bio = "still writable after the race"
        await session.commit()

        refreshed = await session.scalar(
            select(PlayerProfile).where(PlayerProfile.user_id == test_user.id)
        )
        assert refreshed.bio == "still writable after the race"

    async def test_unrelated_integrity_error_propagates(
        self, session: AsyncSession, test_user: User, test_user_2: User, monkeypatch
    ):
        """A violation that isn't the profile race must not be swallowed.

        Here the insert collides on the PRIMARY key, not on user_id: user 2 still
        genuinely has no profile, so the re-read finds nothing and the helper has
        no basis to claim it lost a race. It must surface the error rather than
        silently returning None or looping.
        """
        # Capture ids as plain strs up front. commit()/rollback() expire these ORM
        # objects, and touching an expired attribute outside async context (or
        # inside the patched sync lambda) raises MissingGreenlet.
        user_2_id = str(test_user_2.id)

        existing = await get_or_create_profile(session, test_user.id)
        existing_id = str(existing.id)
        await session.commit()

        # Force the new profile to reuse an existing primary key.
        monkeypatch.setattr(
            player_profile_service.uuid, "uuid4", lambda: existing_id
        )

        with pytest.raises(IntegrityError):
            await get_or_create_profile(session, user_2_id)

        await session.rollback()
        assert await _profile_count(session, user_2_id) == 0
