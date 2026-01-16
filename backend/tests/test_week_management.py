"""Tests for week management endpoints (start-next-week, revert-week)"""

import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User, StaticGroup, TierSnapshot, Membership, MemberRole
from tests.factories import create_user, create_static_group, create_tier_snapshot, create_membership


class TestStartNextWeek:
    """Tests for the start-next-week endpoint"""

    @pytest.mark.asyncio
    async def test_start_next_week_success(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that owner can advance to next week"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/start-next-week",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "currentWeek" in data
        assert "weekStartDate" in data
        assert data["currentWeek"] >= 1

    @pytest.mark.asyncio
    async def test_start_next_week_permission_denied_member(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that member role cannot advance week"""
        owner = await create_user(session, discord_username="owner")
        group = await create_static_group(session, owner)
        tier = await create_tier_snapshot(session, group)
        # test_user is a member, not lead/owner
        await create_membership(session, test_user, group, role=MemberRole.MEMBER)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/start-next-week",
            headers=headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_start_next_week_max_weeks_limit(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that cannot advance beyond MAX_WEEKS (20)"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        # Set week_start_date far in the past to simulate being at week 20
        tier.week_start_date = (datetime.now(timezone.utc) - timedelta(weeks=20)).isoformat()
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/start-next-week",
            headers=headers,
        )

        assert response.status_code == 400
        assert "Cannot advance beyond week 20" in response.json()["detail"]


class TestRevertWeek:
    """Tests for the revert-week endpoint"""

    @pytest.mark.asyncio
    async def test_revert_week_success(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that owner can revert to previous week"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        # Set week_start_date 2 weeks in the past (so we're at week 2+)
        tier.week_start_date = (datetime.now(timezone.utc) - timedelta(weeks=2)).isoformat()
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/revert-week",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "currentWeek" in data
        assert "weekStartDate" in data

    @pytest.mark.asyncio
    async def test_revert_week_at_week_1_fails(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that cannot revert when already at week 1"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        # Set week_start_date to now (week 1)
        tier.week_start_date = datetime.now(timezone.utc).isoformat()
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/revert-week",
            headers=headers,
        )

        assert response.status_code == 400
        assert "already at week 1" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_revert_week_no_start_date_fails(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that cannot revert when week_start_date is not set"""
        group = await create_static_group(session, test_user)
        tier = await create_tier_snapshot(session, group)
        tier.week_start_date = None
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/revert-week",
            headers=headers,
        )

        assert response.status_code == 400
        assert "no week start date set" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_revert_week_permission_denied_viewer(
        self,
        client: AsyncClient,
        session: AsyncSession,
        test_user: User,
    ):
        """Test that viewer role cannot revert week"""
        owner = await create_user(session, discord_username="owner")
        group = await create_static_group(session, owner)
        tier = await create_tier_snapshot(session, group)
        tier.week_start_date = (datetime.now(timezone.utc) - timedelta(weeks=2)).isoformat()
        await create_membership(session, test_user, group, role=MemberRole.VIEWER)
        await session.commit()

        token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/revert-week",
            headers=headers,
        )

        assert response.status_code == 403
