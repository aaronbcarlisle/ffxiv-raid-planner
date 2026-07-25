"""Tests for development auth helpers."""

import json

import pytest
import pytest_asyncio
from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, MemberRole, SnapshotPlayer, User, UserAvailability
from app.routers import dev_auth as dev_auth_module
from app.routers.dev_auth import DEV_USERS, _merge_duplicate_dev_users, dev_login
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio


class TestDevAuthDuplicateMerge:
    @pytest_asyncio.fixture
    async def owner_user(self, session: AsyncSession) -> User:
        return await create_user(session, discord_id="owner_discord_id", discord_username="owner")

    async def test_merge_duplicate_dev_member_repairs_links_and_removes_duplicate(
        self,
        session: AsyncSession,
        owner_user: User,
    ):
        group = await create_static_group(session, owner_user)

        canonical_user = await create_user(
            session,
            discord_id=DEV_USERS[1]["discord_id"],
            discord_username=DEV_USERS[1]["discord_username"],
        )
        duplicate_user = await create_user(
            session,
            discord_id="100000000000000002",
            discord_username=DEV_USERS[1]["discord_username"],
        )

        await create_membership(session, canonical_user, group, role=MemberRole.MEMBER)
        await create_membership(session, duplicate_user, group, role=MemberRole.MEMBER)

        tier = await create_tier_snapshot(session, group)
        player = await create_snapshot_player(session, tier, name="Ayup")
        player.user_id = duplicate_user.id
        await session.flush()

        availability = UserAvailability(
            id="availability-1",
            static_group_id=group.id,
            user_id=duplicate_user.id,
            date="2026-06-01",
            slots=json.dumps(["03:00", "03:30"]),
            updated_at="2026-06-01T00:00:00+00:00",
        )
        session.add(availability)
        await session.flush()

        await _merge_duplicate_dev_users(session, canonical_user, DEV_USERS[1])
        await session.flush()

        duplicate_lookup = await session.execute(
            select(User).where(User.id == duplicate_user.id)
        )
        assert duplicate_lookup.scalar_one_or_none() is None

        membership_lookup = await session.execute(
            select(Membership).where(
                Membership.static_group_id == group.id,
                Membership.user_id == canonical_user.id,
            )
        )
        memberships = membership_lookup.scalars().all()
        assert len(memberships) == 1
        assert memberships[0].role == MemberRole.MEMBER.value

        player_lookup = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.id == player.id)
        )
        merged_player = player_lookup.scalar_one()
        assert merged_player.user_id == canonical_user.id

        availability_lookup = await session.execute(
            select(UserAvailability).where(
                UserAvailability.static_group_id == group.id,
                UserAvailability.user_id == canonical_user.id,
                UserAvailability.date == "2026-06-01",
            )
        )
        merged_availability = availability_lookup.scalar_one()
        assert json.loads(merged_availability.slots) == ["03:00", "03:30"]


class TestDevLoginPreferenceNormalization:
    """dev_login must reset drifted UI preferences so e2e suites start stable.

    `tab_persistence` (A13) and `ui_shell` (Stage-1 T6) are normalized the same
    way and for the same reason: the dev accounts are dogfooded by hand, and a
    drifted value silently changes what the suites render.
    """

    @pytest.fixture
    def dev_mode(self, monkeypatch):
        """Open the dev-auth guard for direct dev_login calls.

        dev_auth reads the module-level `settings` object (dev_auth.py:36), so
        patch that instance; monkeypatch restores both attributes at teardown.
        """
        monkeypatch.setattr(dev_auth_module.settings, "environment", "development")
        monkeypatch.setattr(dev_auth_module.settings, "dev_auth_mode", True)

    async def test_dev_login_resets_drifted_tab_persistence(
        self,
        session: AsyncSession,
        dev_mode,
    ):
        seeded = await create_user(
            session,
            discord_id=DEV_USERS[0]["discord_id"],
            discord_username=DEV_USERS[0]["discord_username"],
        )
        seeded.tab_persistence = "reset"
        await session.flush()

        result = await dev_login(user_index=0, response=Response(), session=session)

        assert result["user_id"] == seeded.id
        row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
            )
        ).scalar_one()
        assert row.tab_persistence == "remember"

    async def test_dev_login_normalizes_only_the_logging_in_user(
        self,
        session: AsyncSession,
        dev_mode,
    ):
        owner = await create_user(
            session,
            discord_id=DEV_USERS[0]["discord_id"],
            discord_username=DEV_USERS[0]["discord_username"],
        )
        owner.tab_persistence = "reset"
        member = await create_user(
            session,
            discord_id=DEV_USERS[1]["discord_id"],
            discord_username=DEV_USERS[1]["discord_username"],
        )
        member.tab_persistence = "reset"
        await session.flush()

        await dev_login(user_index=1, response=Response(), session=session)

        member_row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[1]["discord_id"])
            )
        ).scalar_one()
        owner_row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
            )
        ).scalar_one()
        assert member_row.tab_persistence == "remember"
        # Deliberate: no 3-user sweep — each suite self-restores its own
        # login's preconditions (Phase A spec A13b).
        assert owner_row.tab_persistence == "reset"

    async def test_dev_login_resets_drifted_ui_shell(
        self,
        session: AsyncSession,
        dev_mode,
    ):
        """A dogfooded `ui_shell='v2'` must not leak v2 chrome into e2e runs."""
        seeded = await create_user(
            session,
            discord_id=DEV_USERS[0]["discord_id"],
            discord_username=DEV_USERS[0]["discord_username"],
        )
        seeded.ui_shell = "v2"
        await session.flush()

        result = await dev_login(user_index=0, response=Response(), session=session)

        assert result["user_id"] == seeded.id
        row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
            )
        ).scalar_one()
        assert row.ui_shell == "legacy"

    async def test_dev_login_normalizes_ui_shell_only_for_the_logging_in_user(
        self,
        session: AsyncSession,
        dev_mode,
    ):
        owner = await create_user(
            session,
            discord_id=DEV_USERS[0]["discord_id"],
            discord_username=DEV_USERS[0]["discord_username"],
        )
        owner.ui_shell = "v2"
        member = await create_user(
            session,
            discord_id=DEV_USERS[1]["discord_id"],
            discord_username=DEV_USERS[1]["discord_username"],
        )
        member.ui_shell = "v2"
        await session.flush()

        await dev_login(user_index=1, response=Response(), session=session)

        member_row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[1]["discord_id"])
            )
        ).scalar_one()
        owner_row = (
            await session.execute(
                select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
            )
        ).scalar_one()
        assert member_row.ui_shell == "legacy"
        # Same deliberate scope as tab_persistence above: one login normalizes
        # exactly one user.
        assert owner_row.ui_shell == "v2"
