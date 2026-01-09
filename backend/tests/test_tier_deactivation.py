"""Tests for tier snapshot deactivation behavior"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StaticGroup, TierSnapshot, User
from tests.factories import create_tier_snapshot


pytestmark = pytest.mark.asyncio


class TestTierDeactivation:
    """Tests for tier is_active management"""

    async def test_create_active_tier_deactivates_others(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Creating a new active tier should deactivate all existing active tiers."""
        # Create first active tier
        tier1 = await create_tier_snapshot(
            session, test_group, tier_id="aac-heavyweight", is_active=True
        )

        # Create second active tier via API
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers",
            json={"tierId": "aac-cruiserweight", "contentType": "savage", "isActive": True},
            headers=auth_headers,
        )

        assert response.status_code == 201

        # Refresh tier1 from database
        await session.refresh(tier1)

        # Verify first tier is now inactive
        assert tier1.is_active is False

        # Verify new tier is active
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.tier_id == "aac-cruiserweight")
        )
        tier2 = result.scalar_one()
        assert tier2.is_active is True

    async def test_create_inactive_tier_does_not_affect_others(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Creating an inactive tier should not affect existing active tiers."""
        # Create first active tier
        tier1 = await create_tier_snapshot(
            session, test_group, tier_id="aac-heavyweight", is_active=True
        )

        # Create second tier as inactive via API
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers",
            json={"tierId": "aac-cruiserweight", "contentType": "savage", "isActive": False},
            headers=auth_headers,
        )

        assert response.status_code == 201

        # Refresh tier1 from database
        await session.refresh(tier1)

        # Verify first tier is still active
        assert tier1.is_active is True

    async def test_update_tier_to_active_deactivates_others(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Updating a tier to active should deactivate all other tiers."""
        # Create two tiers, first is active
        tier1 = await create_tier_snapshot(
            session, test_group, tier_id="aac-heavyweight", is_active=True
        )
        tier2 = await create_tier_snapshot(
            session, test_group, tier_id="aac-cruiserweight", is_active=False
        )

        # Set tier2 as active via API
        response = await client.put(
            f"/api/static-groups/{test_group.id}/tiers/aac-cruiserweight",
            json={"isActive": True},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Refresh both tiers
        await session.refresh(tier1)
        await session.refresh(tier2)

        # Verify tier1 is now inactive and tier2 is active
        assert tier1.is_active is False
        assert tier2.is_active is True

    async def test_deactivate_tier_leaves_no_active(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Setting a tier to inactive should leave no active tiers."""
        # Create one active tier
        tier = await create_tier_snapshot(
            session, test_group, tier_id="aac-heavyweight", is_active=True
        )

        # Deactivate it via API
        response = await client.put(
            f"/api/static-groups/{test_group.id}/tiers/aac-heavyweight",
            json={"isActive": False},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify it's inactive
        await session.refresh(tier)
        assert tier.is_active is False

    async def test_multiple_tiers_only_one_active(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Creating multiple active tiers sequentially should result in only the last being active."""
        # Create three tiers all requesting active status
        for tier_id in ["tier-1", "tier-2", "tier-3"]:
            response = await client.post(
                f"/api/static-groups/{test_group.id}/tiers",
                json={"tierId": tier_id, "contentType": "savage", "isActive": True},
                headers=auth_headers,
            )
            assert response.status_code == 201

        # Query all tiers
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == test_group.id)
        )
        tiers = result.scalars().all()

        # Verify only one is active (the last one created)
        active_tiers = [t for t in tiers if t.is_active]
        assert len(active_tiers) == 1
        assert active_tiers[0].tier_id == "tier-3"

    async def test_bulk_deactivation_is_atomic(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Deactivation of existing tiers should happen atomically with new tier creation."""
        # Create 5 active tiers (should result in only 1 active after each creation)
        for i in range(5):
            response = await client.post(
                f"/api/static-groups/{test_group.id}/tiers",
                json={"tierId": f"tier-{i}", "contentType": "savage", "isActive": True},
                headers=auth_headers,
            )
            assert response.status_code == 201

            # After each creation, verify exactly one tier is active
            result = await session.execute(
                select(TierSnapshot).where(
                    TierSnapshot.static_group_id == test_group.id,
                    TierSnapshot.is_active == True,
                )
            )
            active_tiers = result.scalars().all()
            assert len(active_tiers) == 1, f"Expected 1 active tier after creating tier-{i}"

    async def test_tier_deactivation_preserves_other_fields(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Deactivating a tier should not modify other tier fields."""
        # Create first tier with specific settings
        tier1 = await create_tier_snapshot(
            session, test_group, tier_id="aac-heavyweight", is_active=True
        )
        tier1.current_week = 5
        tier1.week_start_date = "2026-01-01T00:00:00+00:00"
        await session.flush()

        original_week = tier1.current_week
        original_start_date = tier1.week_start_date

        # Create new active tier (should deactivate first)
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers",
            json={"tierId": "aac-cruiserweight", "contentType": "savage", "isActive": True},
            headers=auth_headers,
        )

        assert response.status_code == 201

        # Refresh and verify other fields are preserved
        await session.refresh(tier1)

        assert tier1.is_active is False
        assert tier1.current_week == original_week
        assert tier1.week_start_date == original_start_date

    async def test_update_tier_not_found(
        self,
        client: AsyncClient,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Updating a non-existent tier should return 404."""
        response = await client.put(
            f"/api/static-groups/{test_group.id}/tiers/nonexistent-tier",
            json={"isActive": True},
            headers=auth_headers,
        )

        assert response.status_code == 404
