"""Tests for admin system functionality

Tests cover:
- get_user_role_for_response helper
- Admin dashboard sorting by memberCount, tierCount, owner
- isAdminAccess flag in API responses
- Admin access to groups they're not members of
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MemberRole, User
from app.permissions import get_user_role_for_response, is_user_admin, create_admin_membership
from tests.factories import (
    create_membership,
    create_static_group,
    create_tier_snapshot,
    create_user,
)


class TestGetUserRoleForResponse:
    """Tests for the get_user_role_for_response helper function."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="admin123456789",
            discord_username="admin_user",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def regular_user(self, session: AsyncSession) -> User:
        """Create a regular (non-admin) user."""
        return await create_user(
            session,
            discord_id="regular123456789",
            discord_username="regular_user",
        )

    @pytest_asyncio.fixture
    async def group_owner(self, session: AsyncSession) -> User:
        """Create a user who owns a group."""
        return await create_user(
            session,
            discord_id="owner123456789",
            discord_username="group_owner",
        )

    @pytest_asyncio.fixture
    async def test_group_for_admin(
        self, session: AsyncSession, group_owner: User
    ):
        """Create a test group owned by group_owner."""
        return await create_static_group(session, owner=group_owner, name="Admin Test Group")

    @pytest.mark.asyncio
    async def test_returns_actual_membership_role(
        self, session: AsyncSession, regular_user: User, test_group_for_admin
    ):
        """Test that actual members get their real role, not admin access."""
        # Add regular_user as a member
        await create_membership(
            session, regular_user, test_group_for_admin, role=MemberRole.MEMBER
        )

        role, is_admin_access = await get_user_role_for_response(
            session, regular_user.id, test_group_for_admin.id
        )

        assert role == MemberRole.MEMBER
        assert is_admin_access is False

    @pytest.mark.asyncio
    async def test_returns_owner_role_for_admin_non_member(
        self, session: AsyncSession, admin_user: User, test_group_for_admin
    ):
        """Test that admin users who aren't members get owner role with isAdminAccess=True."""
        role, is_admin_access = await get_user_role_for_response(
            session, admin_user.id, test_group_for_admin.id
        )

        assert role == MemberRole.OWNER
        assert is_admin_access is True

    @pytest.mark.asyncio
    async def test_admin_who_is_member_gets_real_role(
        self, session: AsyncSession, admin_user: User, test_group_for_admin
    ):
        """Test that admin users who are actual members get their real role, not admin access."""
        # Add admin_user as a lead member
        await create_membership(
            session, admin_user, test_group_for_admin, role=MemberRole.LEAD
        )

        role, is_admin_access = await get_user_role_for_response(
            session, admin_user.id, test_group_for_admin.id
        )

        assert role == MemberRole.LEAD
        assert is_admin_access is False

    @pytest.mark.asyncio
    async def test_non_member_non_admin_returns_none(
        self, session: AsyncSession, regular_user: User, test_group_for_admin
    ):
        """Test that non-members who aren't admins get None role."""
        role, is_admin_access = await get_user_role_for_response(
            session, regular_user.id, test_group_for_admin.id
        )

        assert role is None
        assert is_admin_access is False


class TestCreateAdminMembership:
    """Tests for the create_admin_membership helper."""

    def test_creates_virtual_owner_membership(self):
        """Test that virtual admin membership has owner role."""
        membership = create_admin_membership("user-123", "group-456")

        assert membership.user_id == "user-123"
        assert membership.static_group_id == "group-456"
        assert membership.role == MemberRole.OWNER.value

    def test_virtual_membership_has_owner_permissions(self):
        """Test that virtual admin membership has all owner permissions."""
        membership = create_admin_membership("user-123", "group-456")

        assert membership.can_edit_roster() is True
        assert membership.can_manage_members() is True
        assert membership.can_delete_group() is True
        assert membership.can_change_visibility() is True


class TestAdminDashboardSorting:
    """Tests for admin dashboard sorting functionality."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="admin_dashboard_test",
            discord_username="dashboard_admin",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def setup_groups_for_sorting(self, session: AsyncSession):
        """Create multiple groups with varying member counts and tier counts."""
        # Create owners
        owner1 = await create_user(session, discord_id="owner1", discord_username="alpha_owner")
        owner2 = await create_user(session, discord_id="owner2", discord_username="zeta_owner")
        owner3 = await create_user(session, discord_id="owner3", discord_username="beta_owner")

        # Create groups with different names
        group1 = await create_static_group(session, owner=owner1, name="Alpha Static")
        group2 = await create_static_group(session, owner=owner2, name="Zeta Static")
        group3 = await create_static_group(session, owner=owner3, name="Beta Static")

        # Add extra members to group2 (will have 3 members total)
        extra_member1 = await create_user(session, discord_id="extra1", discord_username="extra1")
        extra_member2 = await create_user(session, discord_id="extra2", discord_username="extra2")
        await create_membership(session, extra_member1, group2, role=MemberRole.MEMBER)
        await create_membership(session, extra_member2, group2, role=MemberRole.MEMBER)

        # Add tiers - group1 has 2 tiers, group3 has 1 tier, group2 has 0 tiers
        await create_tier_snapshot(session, group1, tier_id="aac-lightweight")
        await create_tier_snapshot(session, group1, tier_id="aac-heavyweight", is_active=False)
        await create_tier_snapshot(session, group3, tier_id="aac-lightweight")

        return {
            "groups": [group1, group2, group3],
            "owners": [owner1, owner2, owner3],
        }

    @pytest.mark.asyncio
    async def test_sort_by_member_count_descending(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        setup_groups_for_sorting,
    ):
        """Test sorting by memberCount in descending order."""
        from app.auth_utils import create_access_token

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all",
            params={"sort_by": "memberCount", "sort_order": "desc"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]

        # Zeta Static should be first (3 members), others have 1 member each
        assert len(items) >= 3
        assert items[0]["name"] == "Zeta Static"
        assert items[0]["memberCount"] == 3

    @pytest.mark.asyncio
    async def test_sort_by_tier_count_descending(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        setup_groups_for_sorting,
    ):
        """Test sorting by tierCount in descending order."""
        from app.auth_utils import create_access_token

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all",
            params={"sort_by": "tierCount", "sort_order": "desc"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]

        # Alpha Static should be first (2 tiers)
        assert len(items) >= 3
        assert items[0]["name"] == "Alpha Static"
        assert items[0]["tierCount"] == 2

    @pytest.mark.asyncio
    async def test_sort_by_owner_ascending(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        setup_groups_for_sorting,
    ):
        """Test sorting by owner username in ascending order."""
        from app.auth_utils import create_access_token

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            "/api/static-groups/admin/all",
            params={"sort_by": "owner", "sort_order": "asc"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]

        # Should be ordered by owner username: alpha_owner, beta_owner, zeta_owner
        assert len(items) >= 3
        owner_names = [item["owner"]["discordUsername"] for item in items[:3]]
        assert owner_names == sorted(owner_names)


class TestIsAdminAccessInResponse:
    """Tests for isAdminAccess field in API responses."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="response_admin",
            discord_username="response_admin",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def regular_owner(self, session: AsyncSession) -> User:
        """Create a regular user who owns a group."""
        return await create_user(
            session,
            discord_id="regular_owner",
            discord_username="regular_owner",
        )

    @pytest_asyncio.fixture
    async def test_private_group(self, session: AsyncSession, regular_owner: User):
        """Create a private test group."""
        return await create_static_group(
            session, owner=regular_owner, name="Private Group", is_public=False
        )

    @pytest.mark.asyncio
    async def test_admin_accessing_non_member_group_gets_is_admin_access_true(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        test_private_group,
    ):
        """Test that admin accessing a group they're not a member of gets isAdminAccess=True."""
        from app.auth_utils import create_access_token

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/by-code/{test_private_group.share_code}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isAdminAccess"] is True
        assert data["userRole"] == "owner"  # Virtual owner role

    @pytest.mark.asyncio
    async def test_owner_accessing_own_group_gets_is_admin_access_false(
        self,
        client: AsyncClient,
        session: AsyncSession,
        regular_owner: User,
        test_private_group,
    ):
        """Test that actual owner gets isAdminAccess=False."""
        from app.auth_utils import create_access_token

        token = create_access_token(regular_owner.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/by-code/{test_private_group.share_code}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isAdminAccess"] is False
        assert data["userRole"] == "owner"  # Real owner role

    @pytest.mark.asyncio
    async def test_admin_who_is_member_gets_is_admin_access_false(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        test_private_group,
    ):
        """Test that admin who is actual member gets isAdminAccess=False."""
        from app.auth_utils import create_access_token

        # Add admin as a member
        await create_membership(
            session, admin_user, test_private_group, role=MemberRole.LEAD
        )

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(
            f"/api/static-groups/by-code/{test_private_group.share_code}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isAdminAccess"] is False
        assert data["userRole"] == "lead"  # Real membership role

    @pytest.mark.asyncio
    async def test_update_response_includes_admin_access(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        test_private_group,
    ):
        """Test that update endpoint response includes correct isAdminAccess."""
        from app.auth_utils import create_access_token

        token = create_access_token(admin_user.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.put(
            f"/api/static-groups/{test_private_group.id}",
            json={"name": "Updated Name"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isAdminAccess"] is True
        assert data["userRole"] == "owner"


class TestIsUserAdmin:
    """Tests for the is_user_admin function."""

    @pytest_asyncio.fixture
    async def admin_user(self, session: AsyncSession) -> User:
        """Create an admin user."""
        user = await create_user(
            session,
            discord_id="is_admin_test",
            discord_username="is_admin_user",
        )
        user.is_admin = True
        await session.flush()
        return user

    @pytest_asyncio.fixture
    async def regular_user(self, session: AsyncSession) -> User:
        """Create a regular user."""
        return await create_user(
            session,
            discord_id="not_admin_test",
            discord_username="not_admin_user",
        )

    @pytest.mark.asyncio
    async def test_admin_user_returns_true(
        self, session: AsyncSession, admin_user: User
    ):
        """Test that is_user_admin returns True for admin users."""
        result = await is_user_admin(session, admin_user.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_regular_user_returns_false(
        self, session: AsyncSession, regular_user: User
    ):
        """Test that is_user_admin returns False for regular users."""
        result = await is_user_admin(session, regular_user.id)
        assert result is False

    @pytest.mark.asyncio
    async def test_nonexistent_user_returns_false(self, session: AsyncSession):
        """Test that is_user_admin returns False for nonexistent users."""
        result = await is_user_admin(session, "nonexistent-user-id")
        assert result is False
