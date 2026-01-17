"""Tests for pagination on loot log endpoints"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from tests.factories import (
    create_user,
    create_static_group,
    create_tier_snapshot,
    create_snapshot_player,
    create_loot_log_entry,
)


class TestLootLogPagination:
    """Tests for loot log endpoint pagination"""

    @pytest.mark.asyncio
    async def test_default_limit_returns_100(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that default limit returns up to 100 entries"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        player = await create_snapshot_player(session, tier)

        # Create 150 entries
        for i in range(150):
            await create_loot_log_entry(
                session, tier, player, test_user, week_number=1, item_slot=f"slot{i}"
            )
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 100  # Default limit

    @pytest.mark.asyncio
    async def test_custom_limit(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that custom limit works"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        player = await create_snapshot_player(session, tier)

        # Create 50 entries
        for i in range(50):
            await create_loot_log_entry(
                session, tier, player, test_user, week_number=1, item_slot=f"slot{i}"
            )
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?limit=25",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 25

    @pytest.mark.asyncio
    async def test_offset_skips_entries(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that offset skips the specified number of entries"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        player = await create_snapshot_player(session, tier)

        # Create 20 entries
        for i in range(20):
            await create_loot_log_entry(
                session, tier, player, test_user, week_number=1, item_slot=f"slot{i}"
            )
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        # Get first 10
        response1 = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?limit=10&offset=0",
            headers=headers,
        )
        # Get second 10
        response2 = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?limit=10&offset=10",
            headers=headers,
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()
        data2 = response2.json()

        assert len(data1) == 10
        assert len(data2) == 10

        # Ensure no overlap
        ids1 = {entry["id"] for entry in data1}
        ids2 = {entry["id"] for entry in data2}
        assert len(ids1 & ids2) == 0  # No intersection

    @pytest.mark.asyncio
    async def test_limit_exceeds_max_returns_422(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that limit > 500 returns validation error"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?limit=501",
            headers=headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_limit_zero_returns_422(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that limit=0 returns validation error"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?limit=0",
            headers=headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_negative_offset_returns_422(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that negative offset returns validation error"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?offset=-1",
            headers=headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_pagination_with_week_filter(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test pagination works with week filter"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        player = await create_snapshot_player(session, tier)

        # Create entries for week 1 and week 2
        for i in range(30):
            await create_loot_log_entry(
                session, tier, player, test_user, week_number=1, item_slot=f"w1slot{i}"
            )
        for i in range(20):
            await create_loot_log_entry(
                session, tier, player, test_user, week_number=2, item_slot=f"w2slot{i}"
            )
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        # Get week 1 with limit
        response = await client.get(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/loot-log?week=1&limit=15",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 15
        # All entries should be week 1
        assert all(entry["weekNumber"] == 1 for entry in data)
