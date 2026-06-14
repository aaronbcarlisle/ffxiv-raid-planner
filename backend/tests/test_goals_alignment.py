"""Tests for goal alignment: intent_level/is_public on player goals,
static objective goals CRUD, and goal matching service."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StaticGroup, User
from app.models.membership import Membership, MemberRole
from app.models.player_goal import PlayerGoal
from app.models.player_profile import PlayerProfile
from app.models.static_objective_goal import StaticObjectiveGoal
from app.services.goal_matching import compute_alignment
from tests.factories import create_static_group, create_user, create_membership


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _create_profile(session: AsyncSession, user: User) -> PlayerProfile:
    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        visibility="private",
        share_enabled=False,
        share_code=str(uuid.uuid4())[:8].upper(),
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(profile)
    await session.flush()
    return profile


async def _create_goal(
    session: AsyncSession,
    profile: PlayerProfile,
    *,
    goal_type: str = "raid",
    intent_level: str | None = None,
    is_public: bool = False,
    title: str = "Test Goal",
) -> PlayerGoal:
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        title=title,
        goal_type=goal_type,
        status="active",
        current_count=0,
        intent_level=intent_level,
        is_public=is_public,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(goal)
    await session.flush()
    return goal


async def _create_objective(
    session: AsyncSession,
    group: StaticGroup,
    user: User,
    *,
    category: str = "savage_bis",
    priority: str = "required",
    title: str = "Test Objective",
) -> StaticObjectiveGoal:
    obj = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        created_by_id=user.id,
        category=category,
        title=title,
        priority=priority,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(obj)
    await session.flush()
    return obj


# ---------------------------------------------------------------------------
# 1. Model fields exist
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_player_goal_intent_level_and_is_public_fields(session: AsyncSession, test_user: User):
    """PlayerGoal has intent_level and is_public fields."""
    profile = await _create_profile(session, test_user)
    goal = await _create_goal(
        session, profile,
        intent_level="must_have",
        is_public=True,
    )
    await session.commit()
    await session.refresh(goal)

    assert goal.intent_level == "must_have"
    assert goal.is_public is True


@pytest.mark.asyncio
async def test_static_objective_goal_model(session: AsyncSession, test_user: User):
    """StaticObjectiveGoal table and fields work correctly."""
    group = await create_static_group(session, owner=test_user)
    obj = await _create_objective(
        session, group, test_user,
        category="ultimate_clear",
        priority="preferred",
        title="Clear TEA",
    )
    await session.commit()
    await session.refresh(obj)

    assert obj.id is not None
    assert obj.static_group_id == group.id
    assert obj.category == "ultimate_clear"
    assert obj.priority == "preferred"
    assert obj.title == "Clear TEA"


# ---------------------------------------------------------------------------
# 2. Create player goal with intent_level and is_public via API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_goal_with_intent_level_and_is_public(client, auth_headers):
    """POST /api/player/goals stores intent_level and is_public."""
    resp = await client.post(
        "/api/player/goals",
        json={
            "title": "Clear M4S",
            "goalType": "raid",
            "intentLevel": "must_have",
            "isPublic": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["intentLevel"] == "must_have"
    assert data["isPublic"] is True


# ---------------------------------------------------------------------------
# 3. Update player goal intent_level
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_goal_intent_level(client, auth_headers, session: AsyncSession, test_user: User):
    """PUT /api/player/goals/{id} updates intent_level."""
    profile = await _create_profile(session, test_user)
    goal = await _create_goal(session, profile, intent_level="want", is_public=False)
    await session.commit()

    resp = await client.put(
        f"/api/player/goals/{goal.id}",
        json={"intentLevel": "willing", "isPublic": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["intentLevel"] == "willing"
    assert data["isPublic"] is True


# ---------------------------------------------------------------------------
# 4. Private goals excluded from alignment computation
# ---------------------------------------------------------------------------


def test_private_goals_excluded_from_alignment():
    """compute_alignment receives only public goals — private goals must not reach it."""
    # Simulate: only public goals passed in
    public_goals = [{"goal_type": "raid", "intent_level": "must_have", "category": None}]
    static_goals = [{"category": "savage_bis", "priority": "required", "title": "BiS"}]

    result = compute_alignment(public_goals, static_goals)
    assert result["summary"]["aligned"] == 1

    # With no public goals at all, it's missing
    result2 = compute_alignment([], static_goals)
    assert result2["summary"]["missing"] == 1


# ---------------------------------------------------------------------------
# 5. StaticObjectiveGoal CRUD permissions: owner can create, member cannot
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_cannot_create_objective_goal(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Regular members cannot create objective goals."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/objective-goals",
        json={
            "category": "savage_bis",
            "title": "Get BiS",
            "priority": "required",
        },
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_owner_can_create_objective_goal(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Owner can create objective goals."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/objective-goals",
        json={
            "category": "savage_bis",
            "title": "Get full BiS this tier",
            "priority": "required",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["category"] == "savage_bis"
    assert data["priority"] == "required"


# ---------------------------------------------------------------------------
# 6. Lead can create/edit/delete static objective goals
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_lead_can_manage_objective_goals(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Lead can create, update, and delete objective goals."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.LEAD)
    await session.commit()

    # Create
    resp = await client.post(
        f"/api/static-groups/{group.id}/objective-goals",
        json={"category": "ultimate_clear", "title": "Clear TOP", "priority": "preferred"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 201, resp.text
    goal_id = resp.json()["id"]

    # Update
    resp = await client.patch(
        f"/api/static-groups/{group.id}/objective-goals/{goal_id}",
        json={"priority": "optional"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["priority"] == "optional"

    # Delete
    resp = await client.delete(
        f"/api/static-groups/{group.id}/objective-goals/{goal_id}",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 204, resp.text


# ---------------------------------------------------------------------------
# 7. Goal alignment endpoint returns correct counts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_goal_alignment_endpoint(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """GET /api/static-groups/{id}/goal-alignment returns alignment data."""
    group = await create_static_group(session, owner=test_user)
    profile = await _create_profile(session, test_user)

    # Public goal: raid + must_have → aligns with savage_bis required
    await _create_goal(
        session, profile,
        goal_type="raid",
        intent_level="must_have",
        is_public=True,
        title="Clear Savage",
    )

    # Static objectives
    await _create_objective(session, group, test_user, category="savage_bis", priority="required")
    await _create_objective(session, group, test_user, category="ultimate_clear", priority="required")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/goal-alignment?profile_id={profile.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "summary" in data
    assert "items" in data
    summary = data["summary"]
    # savage_bis: raid+must_have vs required → aligned
    # ultimate_clear: raid+must_have matches ultimate_clear? Let's check mapping:
    # ultimate_clear maps to {"weekly_clear", "raid", "personal"} → raid matches → aligned
    assert summary["aligned"] >= 1


# ---------------------------------------------------------------------------
# 8. Matching logic unit tests
# ---------------------------------------------------------------------------


def test_compute_alignment_aligned():
    static_goals = [{"category": "savage_bis", "priority": "required", "title": "BiS"}]
    player_goals = [{"goal_type": "raid", "intent_level": "must_have", "category": None}]
    result = compute_alignment(player_goals, static_goals)
    assert result["summary"]["aligned"] == 1
    assert result["items"][0]["status"] == "aligned"


def test_compute_alignment_partial_willing():
    static_goals = [{"category": "savage_bis", "priority": "required", "title": "BiS"}]
    player_goals = [{"goal_type": "raid", "intent_level": "willing", "category": None}]
    result = compute_alignment(player_goals, static_goals)
    assert result["summary"]["partial"] == 1
    assert result["items"][0]["status"] == "partial"


def test_compute_alignment_conflict_avoid_required():
    static_goals = [{"category": "savage_bis", "priority": "required", "title": "BiS"}]
    player_goals = [{"goal_type": "raid", "intent_level": "avoid", "category": None}]
    result = compute_alignment(player_goals, static_goals)
    assert result["summary"]["conflicts"] == 1
    assert result["items"][0]["status"] == "conflict"


def test_compute_alignment_missing():
    static_goals = [{"category": "savage_bis", "priority": "required", "title": "BiS"}]
    result = compute_alignment([], static_goals)
    assert result["summary"]["missing"] == 1
    assert result["items"][0]["status"] == "missing"


def test_compute_alignment_must_have_vs_not_doing():
    """Player must_have + static not_doing → conflict."""
    static_goals = [{"category": "savage_bis", "priority": "not_doing", "title": "BiS"}]
    player_goals = [{"goal_type": "raid", "intent_level": "must_have", "category": None}]
    result = compute_alignment(player_goals, static_goals)
    assert result["items"][0]["status"] == "conflict"


def test_compute_alignment_want_vs_not_doing():
    """Player want + static not_doing → partial (not a hard conflict)."""
    static_goals = [{"category": "savage_bis", "priority": "not_doing", "title": "BiS"}]
    player_goals = [{"goal_type": "raid", "intent_level": "want", "category": None}]
    result = compute_alignment(player_goals, static_goals)
    assert result["items"][0]["status"] == "partial"


def test_compute_alignment_optional_not_required_missing():
    """Static optional with no player goal → unknown (not missing)."""
    static_goals = [{"category": "savage_mount", "priority": "optional", "title": "Mount"}]
    result = compute_alignment([], static_goals)
    assert result["items"][0]["status"] == "unknown"
    assert result["summary"]["unknown"] == 1
    assert result["summary"]["missing"] == 0


# ---------------------------------------------------------------------------
# 9. Invalid intent_level rejected with 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_invalid_intent_level_rejected(client, auth_headers):
    """Invalid intent_level returns 422."""
    resp = await client.post(
        "/api/player/goals",
        json={
            "title": "Test",
            "goalType": "raid",
            "intentLevel": "super_want",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# 10. Invalid category/priority rejected with 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_invalid_objective_category_rejected(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Invalid category returns 422."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/objective-goals",
        json={"category": "not_a_real_category", "title": "Test", "priority": "required"},
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_invalid_objective_priority_rejected(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Invalid priority returns 422."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/objective-goals",
        json={"category": "savage_bis", "title": "Test", "priority": "super_high"},
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# 11. Roster alignment — visibility filter regression
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roster_alignment_includes_discoverable_profiles(
    client, auth_headers, session: AsyncSession, test_user: User, test_user_2: User
):
    """Roster alignment returns non-zero counts for discoverable profiles with public goals.

    Regression: the endpoint previously filtered on visibility == "public" which is
    not a valid value, causing every member to show all-zero alignment even when
    they had a public profile and matching goals.
    """
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)

    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=test_user_2.id,
        visibility="discoverable",
        share_enabled=True,
        share_code=str(uuid.uuid4())[:8].upper(),
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(profile)
    await session.flush()

    await _create_goal(session, profile, goal_type="raid", intent_level="must_have", is_public=True)
    await _create_objective(session, group, test_user, category="savage_bis", priority="required")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/roster-alignment",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    member_row = next((r for r in data if r["userId"] == test_user_2.id), None)
    assert member_row is not None
    assert member_row["profileId"] == profile.id
    # raid + must_have vs savage_bis required → aligned
    assert member_row["aligned"] >= 1


@pytest.mark.asyncio
async def test_roster_alignment_excludes_private_profiles(
    client, auth_headers, session: AsyncSession, test_user: User, test_user_2: User
):
    """Private profiles are not matched in roster alignment — member gets all-zero row."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)

    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=test_user_2.id,
        visibility="private",
        share_enabled=False,
        share_code=str(uuid.uuid4())[:8].upper(),
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(profile)
    await session.flush()

    await _create_goal(session, profile, goal_type="raid", intent_level="must_have", is_public=True)
    await _create_objective(session, group, test_user, category="savage_bis", priority="required")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/roster-alignment",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    member_row = next((r for r in data if r["userId"] == test_user_2.id), None)
    assert member_row is not None
    assert member_row["profileId"] is None  # private profile not surfaced
    assert member_row["aligned"] == 0
    assert member_row["missing"] == 0


@pytest.mark.asyncio
async def test_roster_alignment_member_only_accessible_to_lead_or_owner(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Regular members cannot access the roster alignment endpoint."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/roster-alignment",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text
