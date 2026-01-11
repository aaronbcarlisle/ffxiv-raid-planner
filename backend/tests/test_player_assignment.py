"""Tests for player assignment endpoints and helpers

Tests cover:
- POST /{groupId}/tiers/{tierId}/players/{playerId}/admin-assign
- POST /{groupId}/tiers/{tierId}/players/{playerId}/owner-assign
- GET /{groupId}/interacted-users
- GET /admin/all-users
- create_membership_for_assignment helper function
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from app.permissions import create_membership_for_assignment
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)


class TestAdminAssignPlayer:
    """Tests for the admin-assign endpoint."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="admin_assign_test",
            discord_username="admin_assigner",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def regular_user(self, session: AsyncSession) -> User:
        """Create a regular (non-admin) user."""
        return await create_user(
            session,
            discord_id="regular_assign_test",
            discord_username="regular_user",
        )

    @pytest_asyncio.fixture
    async def target_user(self, session: AsyncSession) -> User:
        """Create a user to be assigned to a player."""
        return await create_user(
            session,
            discord_id="target_user_assign",
            discord_username="target_user",
        )

    @pytest_asyncio.fixture
    async def group_owner(self, session: AsyncSession) -> User:
        """Create a user who owns a group."""
        return await create_user(
            session,
            discord_id="group_owner_assign",
            discord_username="group_owner",
        )

    @pytest_asyncio.fixture
    async def test_group(self, session: AsyncSession, group_owner: User):
        """Create a test group."""
        return await create_static_group(session, owner=group_owner, name="Assignment Test Group")

    @pytest_asyncio.fixture
    async def test_tier(self, session: AsyncSession, test_group):
        """Create a test tier."""
        return await create_tier_snapshot(session, test_group, tier_id="aac-lightweight")

    @pytest_asyncio.fixture
    async def test_player(self, session: AsyncSession, test_tier):
        """Create a test player in the tier."""
        return await create_snapshot_player(
            session, test_tier, name="Unassigned Player", job="DRG"
        )

    @pytest.mark.asyncio
    async def test_admin_can_assign_user_to_player(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that admins can assign any user to a player."""
        # Cache IDs to avoid lazy loading issues outside async context
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        admin_id = admin_user.id

        token = create_access_token(admin_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/admin-assign",
            json={"userId": target_user_id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == target_user_id

    @pytest.mark.asyncio
    async def test_admin_can_assign_using_discord_id(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that admins can assign users using Discord ID."""
        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}/players/{test_player.id}/admin-assign",
            json={"userId": target_user.discord_id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == target_user.id

    @pytest.mark.asyncio
    async def test_admin_can_unassign_player(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that admins can unassign a player by passing null userId."""
        # First assign the user
        test_player.user_id = target_user.id
        await session.flush()

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}/players/{test_player.id}/admin-assign",
            json={"userId": None},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] is None

    @pytest.mark.asyncio
    async def test_admin_can_create_membership_on_assign(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that admins can create membership when assigning."""
        # Cache IDs to avoid lazy loading issues
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        admin_id = admin_user.id

        token = create_access_token(admin_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/admin-assign",
            json={
                "userId": target_user_id,
                "createMembership": True,
                "membershipRole": "member",
            },
            headers=headers,
        )

        assert response.status_code == 200

        # Verify membership was created by querying fresh from database
        from sqlalchemy import select
        from app.models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.user_id == target_user_id,
                Membership.static_group_id == group_id,
            )
        )
        membership = result.scalar_one_or_none()
        assert membership is not None
        assert membership.role == MemberRole.MEMBER.value

    @pytest.mark.asyncio
    async def test_non_admin_cannot_use_admin_assign(
        self,
        client: AsyncClient,
        session: AsyncSession,
        regular_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that non-admins get permission denied."""
        token = create_access_token(regular_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}/players/{test_player.id}/admin-assign",
            json={"userId": target_user.id},
            headers=headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_assign_nonexistent_user_returns_404(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that assigning a nonexistent user returns 404."""
        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}/players/{test_player.id}/admin-assign",
            json={"userId": "nonexistent-user-id"},
            headers=headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cannot_assign_user_already_linked_in_tier(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that a user cannot be linked to multiple players in the same tier."""
        # Create another player and assign target_user to it
        other_player = await create_snapshot_player(
            session, test_tier, name="Other Player", job="WHM"
        )
        other_player.user_id = target_user.id
        await session.flush()

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}/players/{test_player.id}/admin-assign",
            json={"userId": target_user.id},
            headers=headers,
        )

        assert response.status_code == 400
        assert "already linked" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_invalid_membership_role_returns_422(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that invalid membership role returns 422 (Pydantic validation error)."""
        # Cache IDs to avoid lazy loading issues
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        admin_id = admin_user.id

        token = create_access_token(admin_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/admin-assign",
            json={
                "userId": target_user_id,
                "createMembership": True,
                "membershipRole": "owner",  # Invalid - can only assign member or lead
            },
            headers=headers,
        )

        # Pydantic validates Literal types and returns 422 for invalid values
        assert response.status_code == 422


class TestOwnerAssignPlayer:
    """Tests for the owner-assign endpoint."""

    @pytest_asyncio.fixture
    async def owner_user(self, session: AsyncSession) -> User:
        """Create a user who owns a group."""
        return await create_user(
            session,
            discord_id="owner_assign_test",
            discord_username="owner_user",
        )

    @pytest_asyncio.fixture
    async def member_user(self, session: AsyncSession) -> User:
        """Create a member user (non-owner)."""
        return await create_user(
            session,
            discord_id="member_assign_test",
            discord_username="member_user",
        )

    @pytest_asyncio.fixture
    async def target_user(self, session: AsyncSession) -> User:
        """Create a user to be assigned."""
        return await create_user(
            session,
            discord_id="target_owner_assign",
            discord_username="target_owner_user",
        )

    @pytest_asyncio.fixture
    async def test_group(self, session: AsyncSession, owner_user: User):
        """Create a test group owned by owner_user."""
        return await create_static_group(session, owner=owner_user, name="Owner Assign Test")

    @pytest_asyncio.fixture
    async def test_tier(self, session: AsyncSession, test_group):
        """Create a test tier."""
        return await create_tier_snapshot(session, test_group, tier_id="aac-lightweight")

    @pytest_asyncio.fixture
    async def test_player(self, session: AsyncSession, test_tier):
        """Create a test player."""
        return await create_snapshot_player(
            session, test_tier, name="Owner Assign Player", job="PLD"
        )

    @pytest.mark.asyncio
    async def test_owner_can_assign_user_to_player(
        self,
        client: AsyncClient,
        session: AsyncSession,
        owner_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that owners can assign users to players."""
        # Cache IDs to avoid lazy loading issues
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        owner_id = owner_user.id

        token = create_access_token(owner_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/owner-assign",
            json={"userId": target_user_id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == target_user_id

    @pytest.mark.asyncio
    async def test_owner_can_create_membership_on_assign(
        self,
        client: AsyncClient,
        session: AsyncSession,
        owner_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that owners can create membership when assigning."""
        # Cache IDs to avoid lazy loading issues
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        owner_id = owner_user.id

        token = create_access_token(owner_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/owner-assign",
            json={
                "userId": target_user_id,
                "createMembership": True,
                "membershipRole": "lead",
            },
            headers=headers,
        )

        assert response.status_code == 200

        # Verify membership was created by querying fresh from database
        from sqlalchemy import select
        from app.models import Membership
        result = await session.execute(
            select(Membership).where(
                Membership.user_id == target_user_id,
                Membership.static_group_id == group_id,
            )
        )
        membership = result.scalar_one_or_none()
        assert membership is not None
        assert membership.role == MemberRole.LEAD.value

    @pytest.mark.asyncio
    async def test_non_owner_cannot_use_owner_assign(
        self,
        client: AsyncClient,
        session: AsyncSession,
        member_user: User,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that non-owners get permission denied."""
        # Cache IDs before adding membership (which could affect session state)
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id
        member_id = member_user.id

        # Add member_user as a member (not owner)
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        token = create_access_token(member_id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/owner-assign",
            json={"userId": target_user_id},
            headers=headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_use_owner_assign(
        self,
        client: AsyncClient,
        session: AsyncSession,
        target_user: User,
        test_group,
        test_tier,
        test_player,
    ):
        """Test that admins can use the owner-assign endpoint."""
        # Cache IDs to avoid lazy loading issues
        group_id = test_group.id
        tier_id = test_tier.tier_id
        player_id = test_player.id
        target_user_id = target_user.id

        # Create an admin user
        admin = await create_user(
            session,
            discord_id="admin_using_owner_assign",
            discord_username="admin_owner",
        )
        admin.is_admin = True
        await session.flush()

        token = create_access_token(admin.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/owner-assign",
            json={"userId": target_user_id},
            headers=headers,
        )

        assert response.status_code == 200


class TestInteractedUsersEndpoint:
    """Tests for the interacted-users endpoint."""

    @pytest_asyncio.fixture
    async def owner_user(self, session: AsyncSession) -> User:
        """Create a user who owns a group."""
        return await create_user(
            session,
            discord_id="owner_interacted",
            discord_username="owner_interacted",
        )

    @pytest_asyncio.fixture
    async def member_user(self, session: AsyncSession) -> User:
        """Create a member user."""
        return await create_user(
            session,
            discord_id="member_interacted",
            discord_username="member_interacted",
        )

    @pytest_asyncio.fixture
    async def linked_user(self, session: AsyncSession) -> User:
        """Create a user who is linked to a player but not a member."""
        return await create_user(
            session,
            discord_id="linked_interacted",
            discord_username="linked_only",
        )

    @pytest_asyncio.fixture
    async def test_group(self, session: AsyncSession, owner_user: User):
        """Create a test group."""
        return await create_static_group(session, owner=owner_user, name="Interacted Users Test")

    @pytest_asyncio.fixture
    async def test_tier(self, session: AsyncSession, test_group):
        """Create a test tier."""
        return await create_tier_snapshot(session, test_group)

    @pytest.mark.asyncio
    async def test_owner_can_list_interacted_users(
        self,
        client: AsyncClient,
        session: AsyncSession,
        owner_user: User,
        member_user: User,
        linked_user: User,
        test_group,
        test_tier,
    ):
        """Test that owners can list all interacted users."""
        # Add member_user as a member
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        # Create a player linked to linked_user (not a member)
        player = await create_snapshot_player(
            session, test_tier, name="Linked Player", job="BLM"
        )
        player.user_id = linked_user.id
        await session.flush()

        token = create_access_token(owner_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{test_group.id}/interacted-users",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should include owner, member, and linked user
        user_ids = [u["user"]["id"] for u in data]
        assert owner_user.id in user_ids
        assert member_user.id in user_ids
        assert linked_user.id in user_ids

        # Check that member_user is marked as member and linked_user is not
        for user_info in data:
            if user_info["user"]["id"] == member_user.id:
                assert user_info["isMember"] is True
            if user_info["user"]["id"] == linked_user.id:
                assert user_info["isMember"] is False

    @pytest.mark.asyncio
    async def test_admin_can_list_interacted_users(
        self,
        client: AsyncClient,
        session: AsyncSession,
        owner_user: User,
        test_group,
    ):
        """Test that admins can list interacted users for any group."""
        admin = await create_user(
            session,
            discord_id="admin_interacted",
            discord_username="admin_interacted",
        )
        admin.is_admin = True
        await session.flush()

        token = create_access_token(admin.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{test_group.id}/interacted-users",
            headers=headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_non_owner_non_admin_cannot_list(
        self,
        client: AsyncClient,
        session: AsyncSession,
        member_user: User,
        test_group,
    ):
        """Test that non-owner/non-admin members cannot list interacted users."""
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        token = create_access_token(member_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/{test_group.id}/interacted-users",
            headers=headers,
        )

        assert response.status_code == 403


class TestAllUsersAdminEndpoint:
    """Tests for the admin/all-users endpoint."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="admin_all_users",
            discord_username="admin_all_users",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def regular_user(self, session: AsyncSession) -> User:
        """Create a regular user."""
        return await create_user(
            session,
            discord_id="regular_all_users",
            discord_username="regular_user",
        )

    @pytest_asyncio.fixture
    async def other_users(self, session: AsyncSession) -> list[User]:
        """Create some additional users."""
        users = []
        for i in range(3):
            user = await create_user(
                session,
                discord_id=f"other_user_{i}",
                discord_username=f"other_user_{i}",
            )
            users.append(user)
        return users

    @pytest.mark.asyncio
    async def test_admin_can_list_all_users(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        other_users: list[User],
    ):
        """Test that admins can list all users in the database."""
        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all-users",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should include admin and all other users
        user_ids = [u["user"]["id"] for u in data]
        assert admin_user.id in user_ids
        for user in other_users:
            assert user.id in user_ids

    @pytest.mark.asyncio
    async def test_non_admin_cannot_list_all_users(
        self,
        client: AsyncClient,
        session: AsyncSession,
        regular_user: User,
    ):
        """Test that non-admins cannot list all users."""
        token = create_access_token(regular_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all-users",
            headers=headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_all_users_sorted_by_username(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
    ):
        """Test that all users are sorted alphabetically by username."""
        # Create users with specific names
        await create_user(session, discord_id="z_user", discord_username="zebra_user")
        await create_user(session, discord_id="a_user", discord_username="alpha_user")
        await create_user(session, discord_id="m_user", discord_username="middle_user")

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all-users",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()

        usernames = [u["user"]["discordUsername"] for u in data]
        assert usernames == sorted(usernames, key=str.lower)


class TestCreateMembershipForAssignment:
    """Tests for the create_membership_for_assignment helper function."""

    @pytest_asyncio.fixture
    async def test_user(self, session: AsyncSession) -> User:
        """Create a test user."""
        return await create_user(
            session,
            discord_id="membership_test_user",
            discord_username="membership_test",
        )

    @pytest_asyncio.fixture
    async def owner_user(self, session: AsyncSession) -> User:
        """Create a user who owns a group."""
        return await create_user(
            session,
            discord_id="membership_owner",
            discord_username="membership_owner",
        )

    @pytest_asyncio.fixture
    async def test_group(self, session: AsyncSession, owner_user: User):
        """Create a test group."""
        return await create_static_group(session, owner=owner_user, name="Membership Test")

    @pytest.mark.asyncio
    async def test_creates_member_membership(
        self, session: AsyncSession, test_user: User, test_group
    ):
        """Test creating a member membership."""
        membership = await create_membership_for_assignment(
            session, test_user.id, test_group.id, MemberRole.MEMBER
        )

        assert membership is not None
        assert membership.user_id == test_user.id
        assert membership.static_group_id == test_group.id
        assert membership.role == MemberRole.MEMBER.value

    @pytest.mark.asyncio
    async def test_creates_lead_membership(
        self, session: AsyncSession, test_user: User, test_group
    ):
        """Test creating a lead membership."""
        membership = await create_membership_for_assignment(
            session, test_user.id, test_group.id, MemberRole.LEAD
        )

        assert membership is not None
        assert membership.role == MemberRole.LEAD.value

    @pytest.mark.asyncio
    async def test_cannot_create_owner_membership(
        self, session: AsyncSession, test_user: User, test_group
    ):
        """Test that owner role cannot be assigned through this helper."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await create_membership_for_assignment(
                session, test_user.id, test_group.id, MemberRole.OWNER
            )

        assert exc_info.value.status_code == 400
        assert "member or lead" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_cannot_create_viewer_membership(
        self, session: AsyncSession, test_user: User, test_group
    ):
        """Test that viewer role cannot be assigned through this helper."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await create_membership_for_assignment(
                session, test_user.id, test_group.id, MemberRole.VIEWER
            )

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_returns_existing_membership_on_duplicate(
        self, session: AsyncSession, test_user: User, test_group
    ):
        """Test that duplicate membership requests return the existing membership (no-op)."""
        # Create first membership
        first_membership = await create_membership_for_assignment(
            session, test_user.id, test_group.id, MemberRole.MEMBER
        )

        # Try to create duplicate - should return existing membership
        second_membership = await create_membership_for_assignment(
            session, test_user.id, test_group.id, MemberRole.LEAD  # Different role intentionally
        )

        # Should return the same membership (not create a new one)
        assert second_membership.id == first_membership.id
        # Original role should be preserved
        assert second_membership.role == MemberRole.MEMBER.value
