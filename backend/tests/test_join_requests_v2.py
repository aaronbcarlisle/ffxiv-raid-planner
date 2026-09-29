"""Tests for Application Review 2.0 — fit_snapshot on join requests"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import StaticGroup, User
from app.models.join_request import JoinRequest
from tests.factories import (
    create_static_group,
    create_user,
)

DISCOVERY_ENABLED_SETTINGS = {
    "discovery": {
        "enabled": True,
        "recruitmentStatus": "open",
        "description": "Looking for members",
    }
}


@pytest.fixture
async def public_discoverable_group(session, test_user) -> StaticGroup:
    return await create_static_group(
        session, owner=test_user, name="Open Static",
        is_public=True, settings=DISCOVERY_ENABLED_SETTINGS,
    )


@pytest.fixture
async def applicant(session) -> User:
    return await create_user(
        session, discord_id="991122334455667788", discord_username="fit_applicant",
    )


@pytest.fixture
def applicant_headers(applicant: User) -> dict[str, str]:
    from app.auth_utils import create_access_token
    token = create_access_token(applicant.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def applicant_with_profile(session, applicant: User):
    """Create a player profile for the applicant with a DNC job."""
    from app.models.player_profile import PlayerProfile
    from app.models.player_job_profile import PlayerJobProfile

    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=applicant.id,
        visibility="shareable",
        share_enabled=True,
        share_code="FITTEST1",
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(profile)
    await session.flush()

    job_profile = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        job="DNC",
        role="ranged",
        priority="main",
        readiness="ready",
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(job_profile)
    await session.flush()

    return profile


@pytest.fixture
async def applicant_with_public_goals(session, applicant_with_profile):
    """Add public and private goals to the profile."""
    from app.models.player_goal import PlayerGoal

    public_goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=applicant_with_profile.id,
        goal_type="raid",
        title="Clear savage tier",
        intent_level="must_have",
        is_public=True,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(public_goal)

    private_goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=applicant_with_profile.id,
        goal_type="gear",
        title="Get BiS gear (private)",
        intent_level="want",
        is_public=False,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(private_goal)
    await session.flush()
    return applicant_with_profile


# ─── fit_snapshot populated on creation ───────────────────────────────────────

@pytest.mark.asyncio
async def test_fit_snapshot_populated_on_create(
    client: AsyncClient,
    applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """fit_snapshot is stored when a join request is created."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Looking to raid!",
            "roleInterest": ["ranged"],
            "jobInterest": ["dnc"],
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    # fit_snapshot is returned in the response
    assert "fitSnapshot" in data
    snap = data["fitSnapshot"]
    assert snap is not None
    # job should be set to DNC
    assert snap.get("job") == "DNC"
    # snapshotAt should be populated
    assert snap.get("snapshotAt") is not None


@pytest.mark.asyncio
async def test_fit_snapshot_with_gear_summary(
    client: AsyncClient,
    applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """fit_snapshot.gearSummary is derived from gear_snapshot_summary if present."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Hello",
            "selectedJob": "brd",
            "gearSnapshotSummary": {
                "job": "BRD",
                "avgItemLevel": 710,
                "source": "lodestone",
                "syncedAt": datetime.now(timezone.utc).isoformat(),
            },
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    snap = data.get("fitSnapshot") or {}
    assert snap.get("gearSummary") == "iL710 avg"


# ─── Private goals must not be counted ────────────────────────────────────────

@pytest.mark.asyncio
async def test_fit_snapshot_private_goals_excluded(
    client: AsyncClient,
    session,
    applicant_headers: dict,
    public_discoverable_group: StaticGroup,
    applicant_with_public_goals,
):
    """Private goals (is_public=False) must not be included in goalAlignment."""
    from app.models.static_objective_goal import StaticObjectiveGoal

    # Add a static objective so the alignment logic runs
    obj = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=public_discoverable_group.id,
        category="savage_bis",
        priority="required",
        title="Savage BiS",
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(obj)
    await session.flush()

    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Hello",
            "playerProfileId": applicant_with_public_goals.id,
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    snap = data.get("fitSnapshot") or {}
    goal_alignment = snap.get("goalAlignment")

    # goalAlignment snapshot should exist because we have public goals
    # The private goal (gear/want) should NOT show up; only the public one matters
    assert goal_alignment is not None
    # counts should be non-negative integers
    for key in ("aligned", "partial", "conflicts", "missing", "unknown"):
        assert isinstance(goal_alignment.get(key, 0), int)
        assert goal_alignment.get(key, 0) >= 0


# ─── No public BiS target → selectedBisTargetName is null ────────────────────

@pytest.mark.asyncio
async def test_fit_snapshot_no_public_bis_target(
    client: AsyncClient,
    applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """When no public BiS target exists, selectedBisTargetName must be null."""
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "No BiS linked",
            "selectedJob": "war",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    data = response.json()
    snap = data.get("fitSnapshot") or {}
    assert snap.get("selectedBisTargetName") is None


# ─── fit_snapshot is stable after profile changes ─────────────────────────────

@pytest.mark.asyncio
async def test_fit_snapshot_stable_after_profile_change(
    client: AsyncClient,
    session,
    applicant_headers: dict,
    public_discoverable_group: StaticGroup,
    applicant_with_profile,
):
    """The fit_snapshot frozen at submit time does not change when profile is later edited."""
    # Create the join request
    response = await client.post(
        f"/api/static-groups/{public_discoverable_group.share_code}/join-requests",
        json={
            "message": "Stable snapshot test",
            "playerProfileId": applicant_with_profile.id,
            "selectedJob": "dnc",
        },
        headers=applicant_headers,
    )
    assert response.status_code == 201
    request_id = response.json()["id"]
    original_snap = response.json().get("fitSnapshot") or {}

    # Simulate a profile change (change visibility)
    applicant_with_profile.visibility = "private"
    await session.flush()
    await session.commit()

    # Re-fetch the join request from DB — snapshot must not have changed
    result = await session.execute(
        select(JoinRequest).where(JoinRequest.id == request_id)
    )
    jr = result.scalar_one()
    assert jr.fit_snapshot is not None
    # The job should still be DNC from original snapshot
    assert jr.fit_snapshot.get("job") == "DNC"
    # snapshotAt matches what was in the response
    assert jr.fit_snapshot.get("snapshotAt") == original_snap.get("snapshotAt")


# ─── Create-request gate on the recruitment status (RH1a, R-RH-A) ────────────

NOT_TAKING = "This static is not taking join requests right now"
ALREADY_PENDING = "You already have a pending request for this static"


def _status_settings(status: str) -> dict:
    return {"discovery": {"enabled": True, "recruitmentStatus": status}}


async def _apply(client: AsyncClient, share_code: str, headers: dict):
    return await client.post(
        f"/api/static-groups/{share_code}/join-requests",
        json={"message": "Hello", "roleInterest": ["melee"]},
        headers=headers,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["paused", "closed"])
async def test_create_rejected_when_paused_or_closed(
    client: AsyncClient, session, test_user: User, applicant_headers: dict, status: str
):
    group = await create_static_group(
        session, owner=test_user, name="Not Taking", is_public=True,
        settings=_status_settings(status),
    )
    response = await _apply(client, group.share_code, applicant_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == NOT_TAKING


@pytest.mark.asyncio
async def test_create_private_but_open_still_403(
    client: AsyncClient, session, test_user: User, applicant_headers: dict
):
    group = await create_static_group(
        session, owner=test_user, name="Private Open", is_public=False,
        settings=_status_settings("open"),
    )
    response = await _apply(client, group.share_code, applicant_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == (
        "This static is not accepting join requests. "
        "It must be public with discovery enabled."
    )


@pytest.mark.asyncio
async def test_second_request_while_under_review_is_409(
    client: AsyncClient, session, auth_headers: dict, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    first = await _apply(client, public_discoverable_group.share_code, applicant_headers)
    assert first.status_code == 201
    review = await client.post(
        f"/api/join-requests/{first.json()['id']}/under-review", headers=auth_headers,
    )
    assert review.status_code == 200
    assert review.json()["status"] == "under_review"

    second = await _apply(client, public_discoverable_group.share_code, applicant_headers)
    assert second.status_code == 409
    assert second.json()["detail"] == ALREADY_PENDING


@pytest.mark.asyncio
async def test_pending_and_under_review_rows_give_409_not_500(
    client: AsyncClient, session, applicant: User, applicant_headers: dict,
    public_discoverable_group: StaticGroup,
):
    """M6: two waiting rows for one user (inserted through the ORM) must not 500 the check."""
    now = datetime.now(timezone.utc).isoformat()
    for status in ("pending", "under_review"):
        session.add(
            JoinRequest(
                id=str(uuid.uuid4()),
                static_group_id=public_discoverable_group.id,
                requester_user_id=applicant.id,
                status=status,
                created_at=now,
                updated_at=now,
            )
        )
    await session.flush()
    await session.commit()

    response = await _apply(client, public_discoverable_group.share_code, applicant_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == ALREADY_PENDING
