"""Tests for GET /api/static-groups/{group_id}/objective-command endpoint.

Verifies:
- Correct response shape for members
- Private goals are excluded (only public goals counted in goal_alignment)
- Non-members get 403
- Empty objectives returns empty list
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StaticGroup, User
from app.models.membership import Membership, MemberRole
from app.models.static_objective_goal import StaticObjectiveGoal
from app.models.player_goal import PlayerGoal
from app.models.player_profile import PlayerProfile
from tests.factories import create_static_group, create_user, create_membership


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


async def _create_profile(
    session: AsyncSession,
    user: User,
    *,
    visibility: str = "discoverable",
) -> PlayerProfile:
    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        visibility=visibility,
        share_enabled=False,
        share_code=str(uuid.uuid4())[:8].upper(),
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(profile)
    await session.flush()
    return profile


async def _create_player_goal(
    session: AsyncSession,
    profile: PlayerProfile,
    *,
    goal_type: str = "raid",
    intent_level: str = "must_have",
    is_public: bool = True,
    category: str | None = None,
) -> PlayerGoal:
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        title="My goal",
        goal_type=goal_type,
        status="active",
        current_count=0,
        intent_level=intent_level,
        is_public=is_public,
        category=category,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(goal)
    await session.flush()
    return goal


# ---------------------------------------------------------------------------
# 1. Non-member gets 403
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_non_member_gets_403(
    client, session: AsyncSession, test_user: User, test_user_2: User
):
    """User without membership cannot access the endpoint."""
    group = await create_static_group(session, owner=test_user)
    await _create_objective(session, group, test_user)
    await session.commit()

    from app.auth_utils import create_access_token
    token = create_access_token(test_user_2.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=headers,
    )
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# 2. Empty objectives returns empty list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_empty_objectives_returns_empty_list(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """No objectives → empty array response."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 3. Correct response shape for a member
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_returns_correct_shape(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Response has expected fields and types."""
    group = await create_static_group(session, owner=test_user)
    await _create_objective(session, group, test_user, title="Clear DSR", category="ultimate_clear")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1

    card = data[0]
    assert card["title"] == "Clear DSR"
    assert card["category"] == "ultimate_clear"
    assert card["priority"] == "required"
    assert "roster_readiness" in card
    assert "ready" in card["roster_readiness"]
    assert "total" in card["roster_readiness"]
    assert "goal_alignment" in card
    assert "aligned" in card["goal_alignment"]
    assert "partial" in card["goal_alignment"]
    assert "conflicts" in card["goal_alignment"]
    assert "next_action" in card
    assert isinstance(card["next_action"], str)
    assert len(card["next_action"]) > 0


# ---------------------------------------------------------------------------
# 4. Private goals are excluded
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_private_goals_excluded(
    client, auth_headers, session: AsyncSession, test_user: User, test_user_2: User
):
    """Private player goals (is_public=False) do not affect goal_alignment counts."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)

    await _create_objective(session, group, test_user, category="savage_bis", title="Get BiS")
    await session.commit()

    # Create a discoverable profile for user2 with a private goal only
    profile = await _create_profile(session, test_user_2, visibility="discoverable")
    await _create_player_goal(
        session, profile,
        goal_type="gear",
        intent_level="must_have",
        is_public=False,  # PRIVATE — must not count
        category="savage_bis",
    )
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    card = resp.json()[0]
    # Private goal should not contribute to aligned count
    assert card["goal_alignment"]["aligned"] == 0


# ---------------------------------------------------------------------------
# 5. Public goals do appear in goal_alignment
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_goals_counted(
    client, auth_headers, session: AsyncSession, test_user: User, test_user_2: User
):
    """Public player goals (is_public=True) do contribute to goal_alignment."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)

    await _create_objective(session, group, test_user, category="savage_bis", title="Get BiS", priority="required")
    await session.commit()

    profile = await _create_profile(session, test_user_2, visibility="discoverable")
    await _create_player_goal(
        session, profile,
        goal_type="gear",
        intent_level="must_have",
        is_public=True,  # PUBLIC — must count
        category="savage_bis",
    )
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    card = resp.json()[0]
    assert card["goal_alignment"]["aligned"] == 1


# ---------------------------------------------------------------------------
# 6. 'not_doing' objectives are excluded from results
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_not_doing_objectives_excluded(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Objectives with priority='not_doing' are not included in cards."""
    group = await create_static_group(session, owner=test_user)
    await _create_objective(session, group, test_user, title="Active", priority="required")
    await _create_objective(session, group, test_user, title="Inactive", priority="not_doing")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # Only the 'required' objective should appear
    assert len(data) == 1
    assert data[0]["title"] == "Active"


# ---------------------------------------------------------------------------
# 7. At most 5 cards returned
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_at_most_five_cards(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Even if there are 6+ active objectives, only up to 5 cards are returned."""
    group = await create_static_group(session, owner=test_user)
    for i in range(7):
        await _create_objective(
            session, group, test_user,
            title=f"Objective {i}",
            priority="optional",
        )
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/objective-command",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 5
