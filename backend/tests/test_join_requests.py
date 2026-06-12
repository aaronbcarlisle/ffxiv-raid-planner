"""Tests for join request endpoints"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import MemberRole, StaticGroup, User
from app.models.player_character import PlayerCharacter
from app.models.player_gear_snapshot import PlayerGearSnapshot
from app.models.player_job_profile import PlayerJobProfile
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

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


@pytest.fixture
async def lead_user(session) -> User:
    return await create_user(
        session, discord_id="333444555666777888", discord_username="lead_user",
    )


@pytest.fixture
def lead_headers(lead_user: User) -> dict[str, str]:
    from app.auth_utils import create_access_token
    token = create_access_token(lead_user.id)
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


# --- Profile-connected join request tests ---


async def _ensure_job_profile(
    session,
    profile_id: str,
    *,
    job: str,
    role: str,
    priority: str,
    readiness: str,
) -> PlayerJobProfile:
    result = await session.execute(
        select(PlayerJobProfile).where(
            PlayerJobProfile.profile_id == profile_id,
            PlayerJobProfile.job == job.upper(),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    now = datetime.now(timezone.utc).isoformat()
    job_profile = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        job=job.upper(),
        role=role,
        priority=priority,
        readiness=readiness,
        created_at=now,
        updated_at=now,
    )
    session.add(job_profile)
    await session.flush()
    return job_profile


async def _create_profile_and_character(client, headers, session):
    """Helper: create a player profile and link a character."""
    profile_seed_resp = await client.get("/api/player/profile", headers=headers)
    profile_id = profile_seed_resp.json()["id"]
    now = datetime.now(timezone.utc).isoformat()
    character = PlayerCharacter(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        lodestone_id="99999",
        name="Test Char",
        server="Gilgamesh",
        is_main=True,
        created_at=now,
        updated_at=now,
    )
    session.add(character)
    await session.flush()
    await _ensure_job_profile(
        session, profile_id, job="DNC", role="ranged", priority="main", readiness="ready"
    )
    await _ensure_job_profile(
        session, profile_id, job="BRD", role="ranged", priority="flex", readiness="ready"
    )
    await _ensure_job_profile(
        session, profile_id, job="WAR", role="tank", priority="flex", readiness="in_progress"
    )
    profile_resp = await client.get("/api/player/profile", headers=headers)
    return profile_resp.json(), {
        "id": character.id,
        "lodestoneId": character.lodestone_id,
        "name": character.name,
        "server": character.server,
        "dataCenter": character.data_center,
        "avatarUrl": character.avatar_url,
        "isMain": character.is_main,
    }


async def _attach_gear_snapshot(
    session,
    profile_id: str,
    character_id: str,
    *,
    job: str = "DNC",
    avg_item_level: int = 710,
    source: str = "plugin",
) -> PlayerGearSnapshot:
    """Attach an owned Player Hub gear snapshot to the matching job profile."""
    now = datetime.now(timezone.utc).isoformat()
    snapshot = PlayerGearSnapshot(
        id=str(uuid.uuid4()),
        character_id=character_id,
        job=job.upper(),
        gear=[
            {
                "slot": "weapon",
                "equippedItemId": "item-1",
                "equippedItemName": "Test Weapon",
                "equippedItemLevel": avg_item_level,
            }
        ],
        avg_item_level=avg_item_level,
        source=source,
        synced_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(snapshot)
    result = await session.execute(
        select(PlayerJobProfile).where(
            PlayerJobProfile.profile_id == profile_id,
            PlayerJobProfile.job == job.upper(),
        )
    )
    job_profile = result.scalar_one()
    job_profile.gear_snapshot_id = snapshot.id
    job_profile.updated_at = now
    await session.flush()
    return snapshot


@pytest.mark.asyncio
async def test_create_request_with_profile_fields(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, applicant: User, session,
):
    """Profile-connected fields are derived from owned Player Hub data."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)
    await _attach_gear_snapshot(session, profile["id"], character["id"], avg_item_level=710)

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "I'd like to join as DNC!",
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
            "selectedRole": "healer",
            "includedAltJobs": [
                {"job": "BRD", "role": "ranged", "priority": "flex", "readiness": "ready"},
                {"job": "WHM", "role": "healer", "priority": "flex", "readiness": "ready"},
            ],
            "gearSnapshotSummary": {"job": "DNC", "avgItemLevel": 1, "source": "manual", "syncedAt": None},
            "readinessAtApply": "unknown",
            "profileShareCodeAtApply": "ABCD1234",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["selectedJob"] == "dnc"
    assert data["selectedRole"] == "ranged"
    assert data["playerProfileId"] == profile["id"]
    assert data["playerCharacterId"] == character["id"]
    assert data["readinessAtApply"] == "ready"
    assert data["profileShareCodeAtApply"] is None
    assert data["profileVisibilityAtApply"] == "private"
    assert data["profileShareEnabledAtApply"] is False
    assert data["gearSnapshotSummary"]["avgItemLevel"] == 710
    assert data["gearSnapshotSummary"]["source"] == "plugin"
    assert data["gearSnapshotSummary"]["completeSlotsCount"] == 1
    assert len(data["includedAltJobs"]) == 1
    assert data["includedAltJobs"][0]["job"] == "BRD"


@pytest.mark.asyncio
async def test_create_request_without_profile_fields_backwards_compat(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Requests without profile fields work as before (all null)."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Old-style request"},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["selectedJob"] is None
    assert data["selectedRole"] is None
    assert data["playerProfileId"] is None
    assert data["gearSnapshotSummary"] is None
    assert data["includedAltJobs"] is None
    assert data["readinessAtApply"] is None
    assert data["profileShareCodeAtApply"] is None


@pytest.mark.asyncio
async def test_profile_id_must_belong_to_current_user(
    client: AsyncClient, applicant_headers: dict, auth_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User, session,
):
    """Cannot submit with another user's profile ID."""
    # Create profile for test_user (owner), not applicant
    owner_profile, _ = await _create_profile_and_character(client, auth_headers, session)

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"playerProfileId": owner_profile["id"], "selectedJob": "dnc"},
        headers=applicant_headers,
    )
    assert response.status_code == 400
    assert "does not belong to you" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_accept_keeps_profile_snapshot_fields(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Accept clears PII but preserves profile snapshot data."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)
    await _attach_gear_snapshot(session, profile["id"], character["id"], avg_item_level=710)

    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "PII message",
            "contactDiscord": "myhandle",
            "availabilityNote": "Evenings",
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
            "selectedRole": "ranged",
            "gearSnapshotSummary": {"job": "DNC", "avgItemLevel": 1, "source": "manual", "syncedAt": None},
            "readinessAtApply": "ready",
        },
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/accept", headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # PII cleared
    assert data["message"] is None
    assert data["contactDiscord"] is None
    assert data["availabilityNote"] is None
    # Profile snapshot preserved
    assert data["selectedJob"] == "dnc"
    assert data["selectedRole"] == "ranged"
    assert data["playerProfileId"] == profile["id"]
    assert data["gearSnapshotSummary"]["avgItemLevel"] == 710
    assert data["readinessAtApply"] == "ready"


@pytest.mark.asyncio
async def test_decline_keeps_profile_snapshot_fields(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Decline clears PII but preserves profile snapshot data."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)

    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "PII message",
            "contactDiscord": "myhandle",
            "playerProfileId": profile["id"],
            "selectedJob": "war",
            "selectedRole": "tank",
            "readinessAtApply": "in_progress",
        },
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/decline", headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # PII cleared
    assert data["message"] is None
    assert data["contactDiscord"] is None
    # Profile snapshot preserved
    assert data["selectedJob"] == "war"
    assert data["selectedRole"] == "tank"
    assert data["readinessAtApply"] == "in_progress"


@pytest.mark.asyncio
async def test_application_availability_summary_is_derived_without_slots_by_default(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Join requests store broad Player Hub availability unless exact windows are explicitly requested."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)
    for day in ["MO", "WE"]:
        response = await client.put(
            "/api/player/availability/template",
            json={"dayOfWeek": day, "slots": ["19:00", "19:30"], "timezone": "Asia/Tokyo"},
            headers=applicant_headers,
        )
        assert response.status_code == 200

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
            "availabilitySummary": {
                "configuredDays": 7,
                "timezone": "Injected",
                "detailLevel": "exact",
                "slots": ["00:00"],
            },
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    summary = response.json()["availabilitySummary"]
    assert summary == {
        "configuredDays": 2,
        "timezone": "Asia/Tokyo",
        "detailLevel": "summary_only",
        "dayLabels": ["Mon", "Wed"],
        "source": "player_hub",
    }
    assert "slots" not in summary
    assert "exactWindows" not in summary


@pytest.mark.asyncio
async def test_application_availability_exact_windows_are_opt_in(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Exact Player Hub availability windows are stored only when explicitly included."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)
    response = await client.put(
        "/api/player/availability/template",
        json={"dayOfWeek": "TU", "slots": ["19:00", "19:30"], "timezone": "Asia/Tokyo"},
        headers=applicant_headers,
    )
    assert response.status_code == 200

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
            "includeExactAvailability": True,
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    summary = response.json()["availabilitySummary"]
    assert summary == {
        "configuredDays": 1,
        "timezone": "Asia/Tokyo",
        "detailLevel": "exact",
        "dayLabels": ["Tue"],
        "source": "player_hub",
        "exactWindows": [
            {"dayOfWeek": "TU", "dayLabel": "Tue", "slots": ["19:00", "19:30"]},
        ],
    }


@pytest.mark.asyncio
async def test_application_snapshot_is_immutable_after_profile_changes(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Submitted application snapshots do not change with later Player Hub edits."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)
    dnc_job = next(job for job in profile["jobProfiles"] if job["job"] == "DNC")

    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert create_resp.status_code == 201
    request_id = create_resp.json()["id"]
    assert create_resp.json()["readinessAtApply"] == "ready"

    update_resp = await client.put(
        f"/api/player/jobs/{dnc_job['id']}",
        json={"readiness": "not_ready", "notes": "Private notes must stay private"},
        headers=applicant_headers,
    )
    assert update_resp.status_code == 200

    list_resp = await client.get("/api/me/join-requests", headers=applicant_headers)
    assert list_resp.status_code == 200
    request = next(item for item in list_resp.json() if item["id"] == request_id)
    assert request["readinessAtApply"] == "ready"
    assert "Private notes must stay private" not in str(request)


# --- Under Review status tests ---


@pytest.mark.asyncio
async def test_mark_under_review(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Owner can mark a pending request as under_review."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi", "contactDiscord": "myhandle"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/under-review",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "under_review"
    # PII NOT cleared — leader may still contact
    assert data["message"] == "Hi"
    assert data["contactDiscord"] == "myhandle"


@pytest.mark.asyncio
async def test_under_review_does_not_clear_pii(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Under review preserves message, availability, and Discord handle."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Details", "availabilityNote": "Evenings", "contactDiscord": "handle"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    await client.post(f"/api/join-requests/{request_id}/under-review", headers=auth_headers)
    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=auth_headers,
    )
    item = next(r for r in response.json()["items"] if r["id"] == request_id)
    assert item["message"] == "Details"
    assert item["availabilityNote"] == "Evenings"
    assert item["contactDiscord"] == "handle"


@pytest.mark.asyncio
async def test_accept_from_under_review(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Can accept a request that is under_review."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    await client.post(f"/api/join-requests/{request_id}/under-review", headers=auth_headers)
    response = await client.post(f"/api/join-requests/{request_id}/accept", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_decline_from_under_review(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Can decline a request that is under_review."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    await client.post(f"/api/join-requests/{request_id}/under-review", headers=auth_headers)
    response = await client.post(f"/api/join-requests/{request_id}/decline", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "declined"


@pytest.mark.asyncio
async def test_non_leader_cannot_mark_under_review(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
    member_user: User, member_headers: dict,
):
    """Non-leader member cannot mark request as under review."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/under-review",
        headers=member_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_under_review_counted_in_pending(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Under review requests are included in pendingCount."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    await client.post(f"/api/join-requests/{request_id}/under-review", headers=auth_headers)

    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["pendingCount"] >= 1
    statuses = [r["status"] for r in data["items"]]
    assert "under_review" in statuses


# --- Character identity snapshot tests ---


@pytest.mark.asyncio
async def test_character_identity_auto_populated(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Character name/world/dc/avatar are auto-populated from the linked character."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Hi",
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["characterNameAtApply"] == "Test Char"
    assert data["characterWorldAtApply"] == "Gilgamesh"
    # Avatar may be None for test characters
    assert "characterAvatarUrlAtApply" in data


@pytest.mark.asyncio
async def test_character_identity_null_for_legacy(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Legacy requests without profile data have null character identity."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Old style"},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["characterNameAtApply"] is None
    assert data["characterWorldAtApply"] is None


# --- Roster onboarding link tests ---


async def _accept_request(client, auth_headers, share_code, applicant_headers, group_id):
    """Helper: create and accept a join request, return request data."""
    create_resp = await client.post(
        f"/api/static-groups/{share_code}/join-requests",
        json={"message": "Hi", "selectedJob": "dnc"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]
    await client.post(f"/api/join-requests/{request_id}/accept", headers=auth_headers)
    return create_resp.json()


@pytest.mark.asyncio
async def test_link_roster_player(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User,
):
    """Can link an accepted request to a roster player."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    # Create a tier + player
    tier = await create_tier_snapshot(session, public_discoverable_group)
    player = await create_snapshot_player(session, tier, name="Applicant", job="DNC")
    await session.commit()

    response = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player.id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rosterPlayerId"] == player.id


@pytest.mark.asyncio
async def test_link_roster_requires_accepted(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Cannot link roster to a pending request."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    response = await client.post(
        f"/api/join-requests/{create_resp.json()['id']}/link-roster",
        json={"rosterPlayerId": "fake-id"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "accepted" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_link_roster_requires_lead(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    member_headers: dict, public_discoverable_group: StaticGroup,
):
    """Non-leader cannot link roster."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    response = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": "fake-id"},
        headers=member_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_link_roster_rejects_wrong_static(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User,
):
    """Cannot link a roster player from a different static."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    # Create tier+player in a DIFFERENT group
    other_group = await create_static_group(session, test_user, name="Other")
    other_tier = await create_tier_snapshot(session, other_group)
    other_player = await create_snapshot_player(session, other_tier, name="Wrong")
    await session.commit()

    response = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": other_player.id},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_link_roster_idempotent(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User,
):
    """Calling link-roster twice with same ID is idempotent."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    tier = await create_tier_snapshot(session, public_discoverable_group)
    player = await create_snapshot_player(session, tier, name="Applicant", job="DNC")
    await session.commit()

    # First call
    r1 = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player.id},
        headers=auth_headers,
    )
    assert r1.status_code == 200

    # Second call with same ID — idempotent
    r2 = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player.id},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["rosterPlayerId"] == player.id


@pytest.mark.asyncio
async def test_link_roster_rejects_different_player(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User,
):
    """Cannot overwrite an existing roster link with a different player."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    tier = await create_tier_snapshot(session, public_discoverable_group)
    player1 = await create_snapshot_player(session, tier, name="Player 1", job="DNC")
    player2 = await create_snapshot_player(session, tier, name="Player 2", job="BRD")
    await session.commit()

    # Link to player 1
    await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player1.id},
        headers=auth_headers,
    )

    # Try to link to different player 2 — should 409
    response = await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player2.id},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert "different" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_roster_player_id_in_list(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, test_user: User,
):
    """rosterPlayerId appears in the group requests list."""
    req = await _accept_request(
        client, auth_headers, public_discoverable_group.share_code,
        applicant_headers, public_discoverable_group.id,
    )
    tier = await create_tier_snapshot(session, public_discoverable_group)
    player = await create_snapshot_player(session, tier, name="Applicant")
    await session.commit()

    await client.post(
        f"/api/join-requests/{req['id']}/link-roster",
        json={"rosterPlayerId": player.id},
        headers=auth_headers,
    )

    response = await client.get(
        f"/api/static-groups/{public_discoverable_group.id}/join-requests?include_resolved=true",
        headers=auth_headers,
    )
    item = next(r for r in response.json()["items"] if r["id"] == req["id"])
    assert item["rosterPlayerId"] == player.id


@pytest.mark.asyncio
async def test_legacy_request_null_roster_id(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Legacy requests have null rosterPlayerId."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    assert response.json()["rosterPlayerId"] is None


@pytest.mark.asyncio
async def test_link_roster_rejects_declined_request(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Cannot link roster to a declined request."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]
    await client.post(f"/api/join-requests/{request_id}/decline", headers=auth_headers)

    response = await client.post(
        f"/api/join-requests/{request_id}/link-roster",
        json={"rosterPlayerId": "fake-id"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "accepted" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_link_roster_rejects_cancelled_request(
    client: AsyncClient, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Cannot link roster to a cancelled request."""
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]
    await client.post(f"/api/join-requests/{request_id}/cancel", headers=applicant_headers)

    response = await client.post(
        f"/api/join-requests/{request_id}/link-roster",
        json={"rosterPlayerId": "fake-id"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "accepted" in response.json()["detail"].lower()


# --- Lodestone ID snapshot tests ---


@pytest.mark.asyncio
async def test_lodestone_id_snapshot_populated(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session,
):
    """Lodestone ID is captured from the linked character at application time."""
    profile, character = await _create_profile_and_character(client, applicant_headers, session)

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Hi",
            "playerProfileId": profile["id"],
            "playerCharacterId": character["id"],
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["characterLodestoneIdAtApply"] == "99999"


@pytest.mark.asyncio
async def test_lodestone_id_null_for_legacy(
    client: AsyncClient, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """Legacy requests without character have null lodestone ID."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Old style"},
        headers=applicant_headers,
    )
    assert response.status_code == 201
    assert response.json()["characterLodestoneIdAtApply"] is None


# --- Lead / member permission enforcement ---


@pytest.mark.asyncio
async def test_lead_can_accept_request(
    client: AsyncClient, lead_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session, lead_user: User,
):
    """A lead member can accept a pending join request."""
    await create_membership(session, lead_user, public_discoverable_group, role=MemberRole.LEAD)
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/accept",
        headers=lead_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_lead_can_decline_request(
    client: AsyncClient, lead_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session, lead_user: User,
):
    """A lead member can decline a pending join request."""
    await create_membership(session, lead_user, public_discoverable_group, role=MemberRole.LEAD)
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/decline",
        headers=lead_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "declined"


@pytest.mark.asyncio
async def test_member_cannot_accept_request(
    client: AsyncClient, member_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session, member_user: User,
):
    """A regular member cannot accept a join request via direct API call."""
    await create_membership(session, member_user, public_discoverable_group, role=MemberRole.MEMBER)
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/accept",
        headers=member_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_member_cannot_decline_request(
    client: AsyncClient, member_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup, session, member_user: User,
):
    """A regular member cannot decline a join request via direct API call."""
    await create_membership(session, member_user, public_discoverable_group, role=MemberRole.MEMBER)
    create_resp = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={"message": "Hi"},
        headers=applicant_headers,
    )
    request_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/join-requests/{request_id}/decline",
        headers=member_headers,
    )
    assert response.status_code == 403
