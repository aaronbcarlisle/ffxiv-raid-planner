"""Tests for notification creation guards on content suggestion votes."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.membership import Membership, MemberRole
from app.models.notification import Notification
from app.models.static_content_suggestion import StaticContentSuggestion
from tests.factories import create_static_group, create_membership, create_user

import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _create_suggestion(
    session: AsyncSession,
    group,
    user: User,
    *,
    title: str = "Farm BiS for everyone",
) -> StaticContentSuggestion:
    s = StaticContentSuggestion(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        suggested_by_user_id=user.id,
        category="savage_bis",
        title=title,
        description=None,
        status="open",
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(s)
    await session.flush()
    return s


# ---------------------------------------------------------------------------
# 1. Self-vote does NOT create a notification
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_self_vote_does_not_create_notification(
    client, auth_headers, session: AsyncSession, test_user: User
):
    """Voting on your own suggestion must not create a notification to yourself."""
    group = await create_static_group(session, owner=test_user)
    suggestion = await _create_suggestion(session, group, test_user, title="My own idea")
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "must_have"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.notification_type == "suggestion_vote",
        )
    )
    assert result.scalar_one_or_none() is None, "Self-vote must not generate a notification"


# ---------------------------------------------------------------------------
# 2. Duplicate vote update does NOT create a second notification
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vote_update_does_not_create_duplicate_notification(
    client,
    auth_headers,
    auth_headers_user2,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
):
    """Updating an existing vote (second PUT) must not create a second notification."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user, title="Unique suggestion title")
    await session.commit()

    # First vote — creates notification
    resp1 = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "want"},
        headers=auth_headers_user2,
    )
    assert resp1.status_code == 200, resp1.text

    # Second vote (update) — must NOT create another notification
    resp2 = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "avoid"},
        headers=auth_headers_user2,
    )
    assert resp2.status_code == 200, resp2.text

    result = await session.execute(
        select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.notification_type == "suggestion_vote",
        )
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1, (
        f"Expected exactly 1 notification but found {len(notifications)}"
    )


# ---------------------------------------------------------------------------
# 3. Notification href contains "tab=goals", not "tab=home"
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vote_notification_href_contains_tab_goals(
    client,
    auth_headers_user2,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
):
    """Vote notification href must route to the Goals tab, not Home."""
    group = await create_static_group(session, owner=test_user)
    await create_membership(session, test_user_2, group, role=MemberRole.MEMBER)
    suggestion = await _create_suggestion(session, group, test_user, title="Goal tab check")
    await session.commit()

    resp = await client.put(
        f"/api/static-groups/{group.id}/content-suggestions/{suggestion.id}/vote",
        json={"vote": "must_have"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.notification_type == "suggestion_vote",
        )
    )
    notification = result.scalar_one_or_none()
    assert notification is not None, "Notification should have been created"
    assert notification.href is not None
    assert "tab=goals" in notification.href, (
        f"Expected 'tab=goals' in href, got: {notification.href}"
    )
    assert "tab=home" not in notification.href, (
        f"href must not point to tab=home, got: {notification.href}"
    )
