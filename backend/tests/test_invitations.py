"""Tests for invitation system and acceptance flow"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient

from app.models import Invitation, MemberRole, StaticGroup, User, Membership
from app.schemas import InvitationCreate, MemberRoleEnum
from tests.factories import create_membership


@pytest.mark.asyncio
async def test_create_unlimited_invitation(
    client: AsyncClient,
    auth_headers: dict,
    test_group: StaticGroup,
):
    """Test creating an unlimited invitation (no expiry, no max uses)."""
    response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={
            "role": "member",
            "expiresInDays": None,  # Permanent (no expiration)
            "maxUses": None,  # Unlimited
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "member"
    assert data["isValid"] is True
    assert data["expiresAt"] is None
    assert data["maxUses"] is None
    assert data["useCount"] == 0


@pytest.mark.asyncio
async def test_unlimited_invitation_can_be_used_by_multiple_users(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    auth_headers_user3: dict,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    test_group: StaticGroup,
):
    """Test that a permanent unlimited invitation allows multiple different users to join."""
    # test_user is already owner of test_group via the fixture
    # Create unlimited invitation
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member", "expiresInDays": None, "maxUses": None},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    invite_code = create_response.json()["inviteCode"]

    # User 2 accepts the invitation
    accept_response_2 = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response_2.status_code == 200
    assert accept_response_2.json()["success"] is True

    # User 3 accepts the SAME invitation
    accept_response_3 = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user3,
    )
    assert accept_response_3.status_code == 200
    assert accept_response_3.json()["success"] is True

    # Both users should have successfully joined the group


@pytest.mark.asyncio
async def test_use_count_only_increments_on_successful_membership_creation(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    test_user: User,
    test_user_2: User,
    test_group: StaticGroup,
):
    """Test that use_count only increments after successful membership creation."""
    # test_user is already owner of test_group via the fixture

    # Create an invitation with max_uses=1
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member", "maxUses": 1},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]
    initial_use_count = create_response.json()["useCount"]
    assert initial_use_count == 0

    # User 2 accepts successfully
    accept_response = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["success"] is True

    # Check that use_count is now 1
    invitations_response = await client.get(
        f"/api/static-groups/{test_group.id}/invitations",
        headers=auth_headers,
    )
    invitations = invitations_response.json()
    invitation = next((inv for inv in invitations if inv["inviteCode"] == invite_code), None)
    assert invitation is not None
    assert invitation["useCount"] == 1


@pytest.mark.asyncio
async def test_already_member_does_not_consume_invite(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    test_user: User,
    test_user_2: User,
    test_group: StaticGroup,
):
    """Test that if a user is already a member, the invite is not consumed."""
    # test_user is already owner of test_group via the fixture
    # Add test_user_2 as a member
    await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
    await session.commit()

    # Create invitation with max_uses=1
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member", "maxUses": 1},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]

    # User 2 (already a member) tries to accept
    accept_response = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response.status_code == 200
    data = accept_response.json()
    assert data["success"] is False
    assert "already a member" in data["message"].lower()

    # Verify use_count was NOT incremented
    invitations_response = await client.get(
        f"/api/static-groups/{test_group.id}/invitations",
        headers=auth_headers,
    )
    invitations = invitations_response.json()
    invitation = next((inv for inv in invitations if inv["inviteCode"] == invite_code), None)
    assert invitation["useCount"] == 0


@pytest.mark.asyncio
async def test_expired_invitation_rejects_cleanly(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    test_user: User,
    test_user_2: User,
    test_group: StaticGroup,
):
    """Test that an expired invitation shows a clear error message."""
    # test_user is already owner of test_group via the fixture

    # Create an invitation with negative expiry (already expired)
    # Note: The API validates expires_in_days, so we can't send negative directly
    # Instead, we'll test the backend's expiration logic via manual database insertion
    from app.models import Invitation
    import uuid

    now = datetime.now(timezone.utc)
    past_date = (now - timedelta(days=1)).isoformat()

    invitation = Invitation(
        id=str(uuid.uuid4()),
        static_group_id=test_group.id,
        created_by_id=test_user.id,
        invite_code="EXPIRED1",
        role="member",
        expires_at=past_date,  # Already expired
        max_uses=None,
        use_count=0,
        is_active=True,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )
    session.add(invitation)
    await session.commit()

    # Try to accept the expired invitation
    accept_response = await client.post(
        "/api/invitations/EXPIRED1/accept",
        headers=auth_headers_user2,
    )
    assert accept_response.status_code == 200
    data = accept_response.json()
    assert data["success"] is False
    assert "expired" in data["message"].lower()


@pytest.mark.asyncio
async def test_max_use_invitation_rejects_only_after_limit_reached(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    auth_headers_user3: dict,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    test_group: StaticGroup,
):
    """Test that a max_use invitation rejects only after limit is reached."""
    # test_user is already owner of test_group via the fixture

    # Create invitation with max_uses=2
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member", "maxUses": 2},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]

    # First user accepts (should succeed)
    accept_response_1 = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response_1.status_code == 200
    assert accept_response_1.json()["success"] is True

    # Second user accepts (should succeed, still under limit)
    accept_response_2 = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user3,
    )
    assert accept_response_2.status_code == 200
    assert accept_response_2.json()["success"] is True

    # Verify use_count is 2
    invitations_response = await client.get(
        f"/api/static-groups/{test_group.id}/invitations",
        headers=auth_headers,
    )
    invitations = invitations_response.json()
    invitation = next((inv for inv in invitations if inv["inviteCode"] == invite_code), None)
    assert invitation["useCount"] == 2
    assert invitation["isValid"] is False  # Should be exhausted now


@pytest.mark.asyncio
async def test_revoked_invitation_rejects_cleanly(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    test_user: User,
    test_user_2: User,
    test_group: StaticGroup,
):
    """Test that a revoked invitation shows a clear error message."""
    # test_user is already owner of test_group via the fixture

    # Create invitation
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member"},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]
    invitation_id = create_response.json()["id"]

    # Revoke the invitation
    revoke_response = await client.delete(
        f"/api/static-groups/{test_group.id}/invitations/{invitation_id}",
        headers=auth_headers,
    )
    assert revoke_response.status_code == 204

    # Try to accept the revoked invitation
    accept_response = await client.post(
        f"/api/invitations/{invite_code}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response.status_code == 200
    data = accept_response.json()
    assert data["success"] is False
    assert "revoked" in data["message"].lower()


@pytest.mark.asyncio
async def test_get_invitation_preview_shows_already_member_status(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    auth_headers_user3: dict,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    test_group: StaticGroup,
):
    """Test that the preview endpoint correctly shows if user is already a member."""
    # test_user is already owner of test_group via the fixture
    # Add test_user_2 as a member
    await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
    await session.commit()

    # Create invitation
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member"},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]

    # Check preview as non-member (test_user_3) - should NOT show already_member
    preview_response_1 = await client.get(
        f"/api/invitations/{invite_code}",
        headers=auth_headers_user3,
    )
    assert preview_response_1.status_code == 200
    data1 = preview_response_1.json()
    assert data1["alreadyMember"] is False

    # Check preview as member (test_user_2) - should show already_member
    preview_response_2 = await client.get(
        f"/api/invitations/{invite_code}",
        headers=auth_headers_user2,
    )
    assert preview_response_2.status_code == 200
    data2 = preview_response_2.json()
    assert data2["alreadyMember"] is True


@pytest.mark.asyncio
async def test_invitation_not_found_error(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test that accepting a non-existent invitation returns proper error."""
    accept_response = await client.post(
        "/api/invitations/INVALID123/accept",
        headers=auth_headers,
    )
    assert accept_response.status_code == 404


@pytest.mark.asyncio
async def test_invitation_code_case_insensitive(
    client: AsyncClient,
    session,
    auth_headers: dict,
    auth_headers_user2: dict,
    test_user: User,
    test_user_2: User,
    test_group: StaticGroup,
):
    """Test that invitation codes are case-insensitive."""
    # test_user is already owner of test_group via the fixture

    # Create invitation
    create_response = await client.post(
        f"/api/static-groups/{test_group.id}/invitations",
        json={"role": "member"},
        headers=auth_headers,
    )
    invite_code = create_response.json()["inviteCode"]

    # Try to accept with lowercase code
    accept_response = await client.post(
        f"/api/invitations/{invite_code.lower()}/accept",
        headers=auth_headers_user2,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["success"] is True
