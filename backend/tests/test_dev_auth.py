"""Tests for development auth helpers."""

import json

import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, MemberRole, SnapshotPlayer, User, UserAvailability
from app.routers.dev_auth import DEV_USERS, _merge_duplicate_dev_users
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)


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
