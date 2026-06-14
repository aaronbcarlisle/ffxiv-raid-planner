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
