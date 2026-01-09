"""Tests for static group bulk duplication endpoint"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, SnapshotPlayer, StaticGroup, TierSnapshot, User
from tests.factories import (
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)


pytestmark = pytest.mark.asyncio


class TestDuplicateGroupEndpoint:
    """Tests for POST /api/static-groups/{group_id}/duplicate"""

    async def test_duplicate_group_basic(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Test basic group duplication creates new group with new share code."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Duplicated Group", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify new group properties
        assert data["name"] == "Duplicated Group"
        assert data["id"] != test_group.id
        assert data["shareCode"] != test_group.share_code
        assert data["isPublic"] is False  # Duplicated groups start private
        assert data["ownerId"] == test_user.id

    async def test_duplicate_group_copies_tiers(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        test_tier: TierSnapshot,
        auth_headers: dict,
    ):
        """Test duplication copies all tiers from source group."""
        # Create a second tier (used implicitly via database)
        await create_tier_snapshot(
            session, test_group, tier_id="aac-cruiserweight", is_active=False
        )

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "With Tiers", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Verify tiers were copied
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        new_tiers = result.scalars().all()

        assert len(new_tiers) == 2
        tier_ids = {t.tier_id for t in new_tiers}
        assert "aac-heavyweight" in tier_ids
        assert "aac-cruiserweight" in tier_ids

    async def test_duplicate_group_copies_players(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        test_tier: TierSnapshot,
        auth_headers: dict,
    ):
        """Test duplication copies players with their configuration."""
        # Create configured players (used implicitly via database)
        await create_snapshot_player(
            session,
            test_tier,
            name="Tank Player",
            job="WAR",
            role="tank",
            position="T1",
            sort_order=0,
        )
        await create_snapshot_player(
            session,
            test_tier,
            name="Healer Player",
            job="WHM",
            role="healer",
            position="H1",
            sort_order=1,
        )

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "With Players", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Get the new tier
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        new_tier = result.scalar_one()

        # Verify players were copied
        result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.tier_snapshot_id == new_tier.id)
        )
        new_players = result.scalars().all()

        assert len(new_players) == 2
        player_names = {p.name for p in new_players}
        assert "Tank Player" in player_names
        assert "Healer Player" in player_names

        # Verify player details were preserved
        tank = next(p for p in new_players if p.name == "Tank Player")
        assert tank.job == "WAR"
        assert tank.role == "tank"
        assert tank.position == "T1"
        assert tank.configured is True

    async def test_duplicate_group_resets_player_user_id(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        test_tier: TierSnapshot,
        auth_headers: dict,
    ):
        """Test duplicated players don't inherit user_id (ownership is independent)."""
        # Create player linked to test_user
        player = await create_snapshot_player(session, test_tier, name="Linked Player")
        player.user_id = test_user.id
        await session.flush()

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Independent Ownership", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Get new player
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        new_tier = result.scalar_one()

        result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.tier_snapshot_id == new_tier.id)
        )
        new_player = result.scalar_one()

        # Verify user_id is NOT copied
        assert new_player.user_id is None

    async def test_duplicate_group_resets_week_tracking(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Test duplicated tiers have week tracking reset."""
        # Create tier with week tracking set
        tier = await create_tier_snapshot(session, test_group)
        tier.current_week = 5
        tier.week_start_date = "2026-01-01T00:00:00+00:00"
        await session.flush()

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Reset Weeks", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Verify week tracking is reset
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        new_tier = result.scalar_one()

        assert new_tier.current_week == 1
        assert new_tier.week_start_date is None

    async def test_duplicate_group_resets_loot_adjustments(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        test_tier: TierSnapshot,
        auth_headers: dict,
    ):
        """Test duplicated players have loot adjustments reset."""
        # Create player with adjustments
        player = await create_snapshot_player(session, test_tier, name="Adjusted Player")
        player.loot_adjustment = 3
        player.page_adjustments = {"I": 2, "II": 1, "III": 0, "IV": 0}
        await session.flush()

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Reset Adjustments", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Get new player
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        new_tier = result.scalar_one()

        result = await session.execute(
            select(SnapshotPlayer).where(SnapshotPlayer.tier_snapshot_id == new_tier.id)
        )
        new_player = result.scalar_one()

        # Verify adjustments are reset
        assert new_player.loot_adjustment == 0
        assert new_player.page_adjustments == {"I": 0, "II": 0, "III": 0, "IV": 0}

    async def test_duplicate_group_without_tiers(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        test_tier: TierSnapshot,
        auth_headers: dict,
    ):
        """Test duplication with copyTiers=False creates empty group."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "No Tiers", "copyTiers": False, "copyPlayers": False},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Verify no tiers were copied
        result = await session.execute(
            select(TierSnapshot).where(TierSnapshot.static_group_id == new_group_id)
        )
        tiers = result.scalars().all()
        assert len(tiers) == 0

    async def test_duplicate_group_creates_owner_membership(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Test duplication creates owner membership for current user."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "With Membership", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        new_group_id = response.json()["id"]

        # Verify membership was created
        result = await session.execute(
            select(Membership).where(
                Membership.static_group_id == new_group_id,
                Membership.user_id == test_user.id,
            )
        )
        membership = result.scalar_one()

        assert membership.role == "owner"

    async def test_duplicate_group_requires_auth(
        self,
        client: AsyncClient,
        test_group: StaticGroup,
    ):
        """Test duplication requires authentication."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Unauthenticated", "copyTiers": True, "copyPlayers": True},
        )

        assert response.status_code == 401

    async def test_duplicate_group_requires_membership(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_group: StaticGroup,
    ):
        """Test duplication requires membership in source group."""
        # Create a different user with no membership
        other_user = await create_user(session, discord_username="other")
        from app.auth_utils import create_access_token

        other_token = create_access_token(other_user.id)
        other_headers = {"Authorization": f"Bearer {other_token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "No Access", "copyTiers": True, "copyPlayers": True},
            headers=other_headers,
        )

        assert response.status_code == 404

    async def test_duplicate_group_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test duplication of non-existent group returns 404."""
        response = await client.post(
            "/api/static-groups/00000000-0000-0000-0000-000000000000/duplicate",
            json={"newName": "Not Found", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_duplicate_group_preserves_settings(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Test duplication preserves group settings."""
        # Create group with custom settings
        group = await create_static_group(session, test_user, name="With Settings")
        group.settings = {"lootPriority": ["tank", "healer", "melee", "ranged", "caster"]}
        await session.flush()

        response = await client.post(
            f"/api/static-groups/{group.id}/duplicate",
            json={"newName": "Copied Settings", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["settings"] is not None
        assert data["settings"]["lootPriority"] == ["tank", "healer", "melee", "ranged", "caster"]

    async def test_duplicate_group_validation_empty_name(
        self,
        client: AsyncClient,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Test duplication validates name is not empty."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "", "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 422

    async def test_duplicate_group_validation_name_too_long(
        self,
        client: AsyncClient,
        test_group: StaticGroup,
        auth_headers: dict,
    ):
        """Test duplication validates name length."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "X" * 101, "copyTiers": True, "copyPlayers": True},
            headers=auth_headers,
        )

        assert response.status_code == 422
