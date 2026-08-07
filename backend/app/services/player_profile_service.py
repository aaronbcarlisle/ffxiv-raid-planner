"""Race-safe get-or-create for PlayerProfile.

Every caller that lazily materialises a user's profile used to do this:

    profile = SELECT ... WHERE user_id = :uid
    if profile is None:
        INSERT ...

which is a check-then-act race. `player_profiles.user_id` is UNIQUE, so when a
page load fires several requests in parallel and the user has no profile yet,
each one reads "no profile", each one inserts, and every loser gets

    UniqueViolationError: duplicate key value violates unique constraint
    "player_profiles_user_id_key"

surfaced to the user as a 500. Observed in production on 2026-08-06: three
inserts for the same user_id inside 47ms, two of them failing.

`get_or_create_profile` closes that by attempting the insert inside a SAVEPOINT
and treating a unique violation as "someone else won" -- rolling back only the
savepoint (so the caller's outer transaction survives) and re-reading the
winner's row. The database's unique constraint stays the single arbiter, which
is what makes this correct under real concurrency rather than merely less
likely to break.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.base import ExecutableOption

from ..models.player_profile import PlayerProfile


async def _select_profile(
    session: AsyncSession,
    user_id: str,
    options: Sequence[ExecutableOption],
) -> PlayerProfile | None:
    stmt = select(PlayerProfile).where(PlayerProfile.user_id == user_id)
    if options:
        stmt = stmt.options(*options)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_or_create_profile(
    session: AsyncSession,
    user_id: str,
    *,
    options: Sequence[ExecutableOption] = (),
) -> PlayerProfile:
    """Return the user's profile, creating a minimal private one if absent.

    Safe against concurrent callers: if another request creates the profile
    between this one's read and its insert, the unique violation is caught and
    the existing row is returned instead of surfacing a 500.

    `options` are loader options (e.g. selectinload) applied to the returned
    profile, so callers needing eager-loaded relationships don't have to re-query.

    Do not call this with autoflush disabled (or from inside
    `session.no_autoflush`) while the session holds pending writes. Normally the
    first SELECT below autoflushes that pending work into the *outer*
    transaction before the SAVEPOINT opens, so losing the race rolls back only
    this insert. Suppress the autoflush and that work lands inside the savepoint
    instead, where a lost race would discard it.

    Callers do not otherwise need to order their writes around this: `update_goal`
    in routers/player.py mutates its goal before calling, and is safe precisely
    because `async_session_maker` (app/database.py) leaves autoflush at its
    default of True.
    """
    profile = await _select_profile(session, user_id, options)
    if profile is not None:
        return profile

    now = datetime.now(timezone.utc).isoformat()
    new_profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user_id,
        visibility="private",
        share_enabled=False,
        created_at=now,
        updated_at=now,
    )

    try:
        # SAVEPOINT: a unique violation here must not poison the caller's
        # transaction, which may already hold writes worth keeping.
        async with session.begin_nested():
            session.add(new_profile)
            await session.flush()
    except IntegrityError:
        # Lost the race. The winner has committed (the unique index made us
        # wait on it), so the row is readable now.
        profile = await _select_profile(session, user_id, options)
        if profile is None:
            # Not the race we thought -- a different constraint failed.
            raise
        return profile

    if options:
        # Re-read so the requested relationships are eagerly loaded.
        return await _select_profile(session, user_id, options)  # type: ignore[return-value]
    return new_profile
