"""Tests for join request endpoints"""

import pytest
from httpx import AsyncClient

from app.models import MemberRole, StaticGroup, User
from tests.factories import create_membership, create_static_group, create_user

DISCOVERY_ENABLED_SETTINGS = {
    "discovery": {
        "enabled": True,
        "recruitmentStatus": "open",
        "description": "Looking for members",
    }
}

DISCOVERY_DISABLED_SETTINGS = {
    "discovery": {
        "enabled": False,
    }
}


@pytest.fixture
async def public_discoverable_group(session, test_user) -> StaticGroup:
    return await create_static_group(
        session, owner=test_user, name="Open Static",
        is_public=True, settings=DISCOVERY_ENABLED_SETTINGS,
    )


@pytest.fixture
async def private_group(session, test_user) -> StaticGroup:
    return await create_static_group(
        session, owner=test_user, name="Private Static",
        is_public=False,
    )


@pytest.fixture
async def public_no_discovery_group(session, test_user) -> StaticGroup:
    return await create_static_group(
        session, owner=test_user, name="Public No Discovery",
        is_public=True, settings=DISCOVERY_DISABLED_SETTINGS,
    )


@pytest.fixture
async def applicant(session) -> User:
    return await create_user(
        session, discord_id="111222333444555666", discord_username="applicant",
    )


@pytest.fixture
def applicant_headers(applicant: User) -> dict[str, str]:
    from app.auth_utils import create_access_token
    token = create_access_token(applicant.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def member_user(session) -> User:
    return await create_user(
        session, discord_id="222333444555666777", discord_username="member_user",
    )


@pytest.fixture
def member_headers(member_user: User) -> dict[str, str]:
    from app.auth_utils import create_access_token
    token = create_access_token(member_user.id)
    return {"Authorization": f"Bearer {token}"}


# --- Create request ---

@pytest.mark.asyncio
async def test_create_join_request(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "I'd like to join!", "roleInterest": ["tank", "healer"], "jobInterest": ["war", "whm"]},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["message"] == "I'd like to join!"
    assert data["roleInterest"] == ["tank", "healer"]
    assert data["jobInterest"] == ["war", "whm"]
    assert data["staticGroupId"] == public_discoverable_group.id


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create_request(
    client: AsyncClient, public_discoverable_group: StaticGroup,
):
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_private_static_rejects_request(
    client: AsyncClient, applicant_headers: dict, private_group: StaticGroup,
):
    response = await client.post(
        f"/api/static-groups/{private_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    assert response.status_code == 403
    assert "not accepting" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_public_no_discovery_rejects_request(
    client: AsyncClient, applicant_headers: dict,
    public_no_discovery_group: StaticGroup,
):
    response = await client.post(
        f"/api/static-groups/{public_no_discovery_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_pending_request_rejected(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "First"},
        headers=applicant_headers,
    )
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Second"},
        headers=applicant_headers,
    )
    assert response.status_code == 409
    assert "pending" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_existing_member_cannot_request(
    client: AsyncClient, member_headers: dict, member_user: User,
    session, public_discoverable_group: StaticGroup,
):
    await create_membership(session, member_user, public_discoverable_group, role=MemberRole.MEMBER)
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=member_headers,
    )
    assert response.status_code == 409
    assert "already a member" in response.json()["detail"].lower()


# --- Cancel request ---

@pytest.mark.asyncio
async def test_requester_can_cancel_own_request(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/cancel",
        headers=applicant_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cannot_cancel_others_request(
    client: AsyncClient, applicant_headers: dict, member_headers: dict,
    public_discoverable_group: StaticGroup,
):
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/cancel",
        headers=member_headers,
    )
    assert response.status_code == 403


# --- List requests (owner/lead) ---

@pytest.mark.asyncio
async def test_owner_can_list_requests(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )

    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["pendingCount"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["requester"]["displayName"] == "applicant"
    assert "discordUsername" not in data["items"][0]["requester"]
    assert "discordAvatar" not in data["items"][0]["requester"]
    assert "shareDiscord" not in data["items"][0]


@pytest.mark.asyncio
async def test_member_cannot_list_requests(
    client: AsyncClient, member_headers: dict, member_user: User,
    session, public_discoverable_group: StaticGroup,
):
    await create_membership(session, member_user, public_discoverable_group, role=MemberRole.MEMBER)
    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=member_headers,
    )
    assert response.status_code == 403


# --- Accept / Decline ---

@pytest.mark.asyncio
async def test_owner_can_accept_request(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/accept",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_owner_can_decline_request(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/decline",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "declined"


@pytest.mark.asyncio
async def test_accept_does_not_create_duplicate_membership(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, applicant: User, session,
):
    await create_membership(session, applicant, public_discoverable_group, role=MemberRole.MEMBER)

    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    # Should fail because already a member
    assert create_resp.status_code == 409


@pytest.mark.asyncio
async def test_response_does_not_leak_private_fields(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    data = create_resp.json()
    assert "discordId" not in data
    assert "discordUsername" not in data
    assert "discordAvatar" not in data
    assert "discordDiscriminator" not in data
    assert "avatarUrl" not in data
    assert "shareDiscord" not in data
    assert "gear" not in data
    assert "rsvp" not in data
    assert "settings" not in data
    assert "email" not in data
    assert "token" not in data


@pytest.mark.asyncio
async def test_list_my_requests(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )

    response = await client.get("/api/me/join-requests", headers=applicant_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["staticGroupName"] == "Open Static"


# --- Privacy tests ---


@pytest.mark.asyncio
async def test_owner_inbox_shows_only_display_name(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Owner inbox must only expose requester display name, not Discord identifiers."""
    await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )

    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=auth_headers,
    )
    assert response.status_code == 200
    item = response.json()["items"][0]
    requester = item["requester"]

    assert "displayName" in requester
    assert requester["displayName"] is not None

    for field in ["discordUsername", "discordAvatar", "discordDiscriminator",
                  "discordId", "email", "token"]:
        assert field not in requester, f"Requester leaked private field: {field}"


@pytest.mark.asyncio
async def test_cancel_redacts_personal_data(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Cancelling a request should redact message, availability, and contact Discord."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Personal info", "availabilityNote": "My schedule", "contactDiscord": "myhandle"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/cancel",
        headers=applicant_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"
    assert data["message"] is None
    assert data["availabilityNote"] is None
    assert data["contactDiscord"] is None


@pytest.mark.asyncio
async def test_accept_redacts_personal_data(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Accepting a request should redact message, availability, and contact Discord."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi", "availabilityNote": "Evenings", "contactDiscord": "myhandle"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/accept",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["message"] is None
    assert data["availabilityNote"] is None
    assert data["contactDiscord"] is None


@pytest.mark.asyncio
async def test_decline_redacts_personal_data(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Declining a request should redact message, availability, and contact Discord."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Personal info", "availabilityNote": "My schedule", "contactDiscord": "myhandle"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/decline",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "declined"
    assert data["message"] is None
    assert data["availabilityNote"] is None
    assert data["contactDiscord"] is None


@pytest.mark.asyncio
async def test_contact_discord_visible_while_pending(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Contact Discord handle should be visible to leads while request is pending."""
    await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi", "contactDiscord": "myhandle"},
        headers=applicant_headers,
    )

    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=auth_headers,
    )
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["contactDiscord"] == "myhandle"


@pytest.mark.asyncio
async def test_contact_discord_optional(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Contact Discord is optional — requests without it should work fine."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    assert response.json()["contactDiscord"] is None


@pytest.mark.asyncio
async def test_join_request_model_has_no_discord_columns(session):
    """The static_join_requests table must not have Discord-specific columns."""
    from sqlalchemy import inspect as sa_inspect
    from app.models import JoinRequest

    mapper = sa_inspect(JoinRequest)
    column_names = {col.key for col in mapper.columns}

    for forbidden in ["discord_id", "discord_username", "discord_discriminator",
                      "discord_avatar", "avatar_url", "email", "token",
                      "access_token", "refresh_token"]:
        assert forbidden not in column_names, f"Join request model has forbidden column: {forbidden}"
