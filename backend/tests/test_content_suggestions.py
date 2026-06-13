"""Tests for content suggestions CRUD, voting, and promote-to-goal."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StaticGroup, User
from app.models.membership import Membership, MemberRole
from app.models.notification import Notification
from app.models.static_content_suggestion import (
    StaticContentSuggestion,
    StaticContentSuggestionVote,
)
from tests.factories import create_static_group, create_membership, create_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _create_suggestion(
    session: AsyncSession,
    group: StaticGroup,
    user: User,
    *,
    category: str = "savage_bis",
    title: str = "Farm BiS for everyone",
    description: str | None = None,
    status: str = "open",
) -> StaticContentSuggestion:
    s = StaticContentSuggestion(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        suggested_by_user_id=user.id,
        category=category,
        title=title,
        description=description,
        status=status,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(s)
    await session.flush()
    return s


# ---------------------------------------------------------------------------
# 1. List suggestions — member sees open ones
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_can_list_suggestions(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Members can list suggestions for their group."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    await _create_suggestion(session, group, test_user, title="Do ultimates")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/content-suggestions",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["title"] == "Do ultimates"


@pytest.mark.asyncio
async def test_non_member_cannot_list_suggestions(
    client, auth_headers_user2, session: AsyncSession, test_user: User
):
    """Non-members get 403."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group.id}/content-suggestions",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# 2. Create suggestion — any member
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_can_create_suggestion(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Members can propose new content suggestions."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions",
        json={"category": "ultimate_clear", "title": "Clear TOP"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["category"] == "ultimate_clear"
    assert data["title"] == "Clear TOP"
    assert data["status"] == "open"
    assert data["suggestedByUserId"] == test_user_2.id


@pytest.mark.asyncio
async def test_invalid_category_rejected(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Invalid suggestion category returns 422."""
    group = await create_static_group(session, owner=test_user)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions",
        json={"category": "not_real_category", "title": "Test"},
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# 3. Vote — member can vote, update, and remove vote
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_can_vote(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Member can cast a vote on a suggestion."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "must_have"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["currentUserVote"] == "must_have"
    assert data["voteSummary"]["mustHave"] == 1
    assert data["voteSummary"]["total"] == 1


@pytest.mark.asyncio
async def test_vote_upsert_changes_existing_vote(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Voting twice on same suggestion replaces the first vote."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "want"},
        headers=auth_headers_user2,
    )
    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "avoid"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["currentUserVote"] == "avoid"
    assert data["voteSummary"]["want"] == 0
    assert data["voteSummary"]["avoid"] == 1
    assert data["voteSummary"]["total"] == 1


@pytest.mark.asyncio
async def test_invalid_vote_value_rejected(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Invalid vote value returns 422."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "super_yes"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_member_can_delete_own_vote(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Member can remove their own vote."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "want"},
        headers=auth_headers_user2,
    )
    resp = await client.delete(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["currentUserVote"] is None
    assert data["voteSummary"]["total"] == 0


# ---------------------------------------------------------------------------
# 4. Conflict count in vote summary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vote_summary_conflict_count(
    client, auth_headers, auth_headers_user2, auth_headers_user3,
    session: AsyncSession, test_user: User, test_user_2: User, test_user_3: User,
):
    """conflictCount = not_interested + avoid votes."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    await create_membership(session, test_user_3, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "not_interested"}, headers=auth_headers_user2,
    )
    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "avoid"}, headers=auth_headers_user3,
    )

    resp = await client.get(
        f"/api/static-groups/{group.id}/content-suggestions",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    summary = resp.json()[0]["voteSummary"]
    assert summary["conflictCount"] == 2
    assert summary["total"] == 2


# ---------------------------------------------------------------------------
# 5. Status update — lead/owner only
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_cannot_update_suggestion_status(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Members cannot change suggestion status."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.patch(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}",
        json={"status": "closed"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_lead_can_close_suggestion(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Leads can close open suggestions."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.LEAD)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.patch(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}",
        json={"status": "closed"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "closed"


# ---------------------------------------------------------------------------
# 6. Delete — lead/owner only; member cannot delete someone else's suggestion
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_member_cannot_delete_others_suggestion(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Member cannot delete another member's suggestion."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user, title="Owner suggestion")
    await session.commit()

    resp = await client.delete(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_owner_can_delete_any_suggestion(
    client, auth_headers, session: AsyncSession, test_user: User, test_user_2: User
):
    """Owner can delete any suggestion."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user_2, title="Member suggestion")
    await session.commit()

    resp = await client.delete(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204, resp.text


# ---------------------------------------------------------------------------
# 7. Promote to static objective goal — owner/lead only
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_owner_can_promote_suggestion_to_goal(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Owner can promote an open suggestion to a static objective goal."""
    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(
        session, group, test_user, category="ultimate_clear", title="Clear TOP"
    )
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/promote",
        json={"priority": "required"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "promoted"
    assert data["promotedGoalId"] is not None


@pytest.mark.asyncio
async def test_promote_creates_objective_goal(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Promoting a suggestion creates a corresponding static objective goal."""
    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(
        session, group, test_user, category="savage_mount", title="Mount farm"
    )
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/promote",
        json={"priority": "preferred", "title": "Farm all savage mounts"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    promoted_goal_id = resp.json()["promotedGoalId"]

    # Verify the objective goal exists
    goals_resp = await client.get(
        f"/api/static-groups/{group.id}/objective-goals",
        headers=auth_headers,
    )
    assert goals_resp.status_code == 200, goals_resp.text
    goals = goals_resp.json()
    matching = [g for g in goals if g["id"] == promoted_goal_id]
    assert len(matching) == 1
    assert matching[0]["category"] == "savage_mount"
    assert matching[0]["title"] == "Farm all savage mounts"
    assert matching[0]["priority"] == "preferred"


@pytest.mark.asyncio
async def test_member_cannot_promote_suggestion(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Regular members cannot promote suggestions."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/promote",
        json={"priority": "required"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_cannot_promote_already_promoted_suggestion(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Promoting an already-promoted suggestion returns 409."""
    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(
        session, group, test_user, status="promoted"
    )
    await session.commit()

    resp = await client.post(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/promote",
        json={"priority": "required"},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text


# ---------------------------------------------------------------------------
# 8. Isolation — suggestions from one group not visible to another
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_suggestions_isolated_between_groups(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Suggestions from group A are not visible via group B's endpoint."""
    group_a = await create_static_group(session, owner=test_user)
    group_b = await create_static_group(session, owner=test_user_2, name="Group B")
    await create_membership(session, test_user_2, group_a, role=MemberRole.MEMBER)
    await _create_suggestion(session, group_a, test_user, title="Group A suggestion")
    await session.commit()

    resp = await client.get(
        f"/api/static-groups/{group_b.id}/content-suggestions",
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 9. Cascade delete — suggestions removed when group is deleted
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_suggestions_deleted_with_group(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Deleting a static group cascades to remove its content suggestions."""
    from sqlalchemy import select as sa_select

    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    # Verify suggestion exists
    result = await session.execute(
        sa_select(StaticContentSuggestion).where(StaticContentSuggestion.id == suggestion.id)
    )
    assert result.scalar_one_or_none() is not None

    # Delete group via API
    resp = await client.delete(
        f"/api/static-groups/{group.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204, resp.text

    await session.reset()
    result = await session.execute(
        sa_select(StaticContentSuggestion).where(StaticContentSuggestion.id == suggestion.id)
    )
    assert result.scalar_one_or_none() is None


# ---------------------------------------------------------------------------
# 10. Vote notifications — regression tests for suggestion_vote notify logic
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vote_creates_notification_for_suggestion_author(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """New vote on another user's suggestion notifies the suggestion author."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user, title="Clear TOP")
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "must_have"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        sa_select(Notification).where(Notification.user_id == test_user.id)
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1
    n = notifications[0]
    assert n.notification_type == "suggestion_vote"
    assert n.user_id == test_user.id
    assert "testuser2" in n.title.lower() or "testuser" in n.title.lower()
    assert "Must Have" in n.body
    assert "Clear TOP" in n.body


@pytest.mark.asyncio
async def test_vote_update_does_not_create_duplicate_notification(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Updating an existing vote does not create a second notification."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    # First vote — creates notification
    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "want"},
        headers=auth_headers_user2,
    )
    # Second vote on same suggestion — must not create another notification
    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "avoid"},
        headers=auth_headers_user2,
    )

    result = await session.execute(
        sa_select(Notification).where(Notification.user_id == test_user.id)
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1  # still exactly one from the first vote


@pytest.mark.asyncio
async def test_self_vote_does_not_create_notification(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Voting on your own suggestion does not send a notification to yourself."""
    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(session, group, test_user)
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "must_have"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        sa_select(Notification).where(Notification.user_id == test_user.id)
    )
    notifications = result.scalars().all()
    assert len(notifications) == 0


@pytest.mark.asyncio
async def test_vote_notification_payload(
    client, auth_headers_user2, session: AsyncSession, test_user: User, test_user_2: User
):
    """Notification has correct type, vote label, suggestion title, and recipient."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user, title="FRU Clear")
    await session.commit()

    await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "willing"},
        headers=auth_headers_user2,
    )

    result = await session.execute(
        sa_select(Notification).where(Notification.user_id == test_user.id)
    )
    n = result.scalar_one()
    assert n.notification_type == "suggestion_vote"
    assert n.user_id == test_user.id
    assert "Willing" in n.body
    assert "FRU Clear" in n.body
    assert n.href is not None
    assert "goals" in n.href
