"""Tests for permission system"""

import pytest

from app.models import MemberRole, Membership, ROLE_HIERARCHY


class TestRoleHierarchy:
    """Test role hierarchy and permissions"""

    def test_role_hierarchy_order(self):
        """Test that role hierarchy is correctly ordered."""
        assert ROLE_HIERARCHY[MemberRole.OWNER] > ROLE_HIERARCHY[MemberRole.LEAD]
        assert ROLE_HIERARCHY[MemberRole.LEAD] > ROLE_HIERARCHY[MemberRole.MEMBER]
        assert ROLE_HIERARCHY[MemberRole.MEMBER] > ROLE_HIERARCHY[MemberRole.VIEWER]

    def test_owner_has_highest_level(self):
        """Test owner has highest role level."""
        assert ROLE_HIERARCHY[MemberRole.OWNER] == 4

    def test_viewer_has_lowest_level(self):
        """Test viewer has lowest role level."""
        assert ROLE_HIERARCHY[MemberRole.VIEWER] == 1


class TestMembershipPermissions:
    """Test membership permission methods"""

    @pytest.fixture
    def owner_membership(self) -> Membership:
        """Create a mock owner membership."""
        membership = Membership(
            id="test-id",
            user_id="user-id",
            static_group_id="group-id",
            role=MemberRole.OWNER.value,
        )
        return membership

    @pytest.fixture
    def lead_membership(self) -> Membership:
        """Create a mock lead membership."""
        membership = Membership(
            id="test-id",
            user_id="user-id",
            static_group_id="group-id",
            role=MemberRole.LEAD.value,
        )
        return membership

    @pytest.fixture
    def member_membership(self) -> Membership:
        """Create a mock member membership."""
        membership = Membership(
            id="test-id",
            user_id="user-id",
            static_group_id="group-id",
            role=MemberRole.MEMBER.value,
        )
        return membership

    @pytest.fixture
    def viewer_membership(self) -> Membership:
        """Create a mock viewer membership."""
        membership = Membership(
            id="test-id",
            user_id="user-id",
            static_group_id="group-id",
            role=MemberRole.VIEWER.value,
        )
        return membership

    def test_owner_can_edit_roster(self, owner_membership: Membership):
        """Test owner can edit roster."""
        assert owner_membership.can_edit_roster() is True

    def test_lead_can_edit_roster(self, lead_membership: Membership):
        """Test lead can edit roster."""
        assert lead_membership.can_edit_roster() is True

    def test_member_cannot_edit_roster(self, member_membership: Membership):
        """Test member cannot edit roster."""
        assert member_membership.can_edit_roster() is False

    def test_viewer_cannot_edit_roster(self, viewer_membership: Membership):
        """Test viewer cannot edit roster."""
        assert viewer_membership.can_edit_roster() is False

    def test_owner_can_manage_members(self, owner_membership: Membership):
        """Test owner can manage members."""
        assert owner_membership.can_manage_members() is True

    def test_lead_can_manage_members(self, lead_membership: Membership):
        """Test lead can manage members."""
        assert lead_membership.can_manage_members() is True

    def test_member_cannot_manage_members(self, member_membership: Membership):
        """Test member cannot manage members."""
        assert member_membership.can_manage_members() is False

    def test_owner_can_delete_group(self, owner_membership: Membership):
        """Test only owner can delete group."""
        assert owner_membership.can_delete_group() is True

    def test_lead_cannot_delete_group(self, lead_membership: Membership):
        """Test lead cannot delete group."""
        assert lead_membership.can_delete_group() is False

    def test_member_cannot_delete_group(self, member_membership: Membership):
        """Test member cannot delete group."""
        assert member_membership.can_delete_group() is False

    def test_owner_can_change_visibility(self, owner_membership: Membership):
        """Test only owner can change visibility."""
        assert owner_membership.can_change_visibility() is True

    def test_lead_cannot_change_visibility(self, lead_membership: Membership):
        """Test lead cannot change visibility."""
        assert lead_membership.can_change_visibility() is False

    def test_role_level_comparison(
        self, owner_membership: Membership, lead_membership: Membership
    ):
        """Test role level comparison works correctly."""
        assert owner_membership.role_level > lead_membership.role_level
