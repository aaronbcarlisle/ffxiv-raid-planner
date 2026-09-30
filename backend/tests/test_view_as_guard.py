"""P1 Task 1 (D-50 / HS-30): the X-View-As guard.

While the client sends X-View-As (admin View As), the API refuses the static
delete and the removal of the viewed member. The guard depends on the
header's presence alone, runs before any DB read (so a refusal writes no
audit row), and leaves every other removal open. An empty header counts as
absent, and admin moderation without the header is unchanged.
"""

import pytest
import pytest_asyncio
from fastapi import Request
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import AuditLog, MemberRole, Membership, StaticGroup, User
from app.permissions import VIEW_AS_HEADER, VIEW_AS_REFUSAL, view_as_user_id
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio


def _request_with(headers: list[tuple[bytes, bytes]]) -> Request:
    return Request(
        {"type": "http", "method": "DELETE", "path": "/", "headers": headers, "query_string": b""}
    )


class TestViewAsUserId:
    async def test_missing_header_is_none(self):
        assert view_as_user_id(_request_with([])) is None

    async def test_empty_header_is_none(self):
        assert view_as_user_id(_request_with([(b"x-view-as", b"")])) is None

    async def test_header_value_is_returned(self):
        assert view_as_user_id(_request_with([(b"x-view-as", b"u-1")])) == "u-1"


@pytest_asyncio.fixture
async def admin_user(session: AsyncSession) -> User:
    user = await create_user(
        session, discord_id="999888777666555442", discord_username="view_as_guard_admin"
    )
    user.is_admin = True
    await session.flush()
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(admin_user.id)}"}


async def _audit_rows(session: AsyncSession) -> list[AuditLog]:
    result = await session.execute(select(AuditLog).order_by(AuditLog.id))
    return list(result.scalars().all())


async def _group_exists(session: AsyncSession, group_id: str) -> bool:
    session.expire_all()
    result = await session.execute(select(StaticGroup.id).where(StaticGroup.id == group_id))
    return result.scalar_one_or_none() is not None


async def _membership_exists(session: AsyncSession, user_id: str, group_id: str) -> bool:
    session.expire_all()
    result = await session.execute(
        select(Membership.id).where(
            Membership.user_id == user_id, Membership.static_group_id == group_id
        )
    )
    return result.scalar_one_or_none() is not None


def _with_view_as(headers: dict[str, str], viewed_user_id: str) -> dict[str, str]:
    return {**headers, VIEW_AS_HEADER: viewed_user_id}


class TestStaticDeleteGuard:
    async def test_admin_delete_under_view_as_is_refused(
        self, client: AsyncClient, session, test_user, test_group, admin_headers
    ):
        response = await client.delete(
            f"/api/static-groups/{test_group.id}",
            headers=_with_view_as(admin_headers, test_user.id),
        )
        assert response.status_code == 403
        assert response.json()["detail"] == VIEW_AS_REFUSAL
        assert await _group_exists(session, test_group.id)
        assert await _audit_rows(session) == []

    async def test_owner_delete_with_any_header_is_refused(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        response = await client.delete(
            f"/api/static-groups/{test_group.id}",
            headers=_with_view_as(auth_headers, "anything"),
        )
        assert response.status_code == 403
        assert response.json()["detail"] == VIEW_AS_REFUSAL
        assert await _group_exists(session, test_group.id)
        assert await _audit_rows(session) == []

    async def test_admin_delete_without_header_is_moderation(
        self, client: AsyncClient, session, test_group, admin_headers
    ):
        group_id = test_group.id

        response = await client.delete(f"/api/static-groups/{group_id}", headers=admin_headers)
        assert response.status_code == 204
        assert not await _group_exists(session, group_id)

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].action == "static.deleted"
        assert rows[0].admin_override is True

    async def test_admin_owner_delete_without_header(
        self, client: AsyncClient, session, admin_user, admin_headers
    ):
        own_group = await create_static_group(session, owner=admin_user, name="Admin Owned")
        group_id = own_group.id

        response = await client.delete(f"/api/static-groups/{group_id}", headers=admin_headers)
        assert response.status_code == 204
        assert not await _group_exists(session, group_id)

    async def test_owner_delete_with_empty_header_is_allowed(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        group_id = test_group.id

        response = await client.delete(
            f"/api/static-groups/{group_id}", headers=_with_view_as(auth_headers, "")
        )
        assert response.status_code == 204
        assert not await _group_exists(session, group_id)


class TestMemberRemoveGuard:
    async def test_admin_removing_viewed_member_is_refused(
        self, client: AsyncClient, session, test_user_2, test_group, admin_headers
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/members/{test_user_2.id}",
            headers=_with_view_as(admin_headers, test_user_2.id),
        )
        assert response.status_code == 403
        assert response.json()["detail"] == VIEW_AS_REFUSAL
        assert await _membership_exists(session, test_user_2.id, test_group.id)
        assert await _audit_rows(session) == []

    async def test_admin_removing_other_member_under_view_as_is_allowed(
        self,
        client: AsyncClient,
        session,
        test_user_2,
        test_user_3,
        test_group,
        admin_headers,
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
        await create_membership(session, test_user_3, test_group, role=MemberRole.MEMBER)
        viewed_id, other_id, group_id = test_user_2.id, test_user_3.id, test_group.id

        response = await client.delete(
            f"/api/static-groups/{group_id}/members/{other_id}",
            headers=_with_view_as(admin_headers, viewed_id),
        )
        assert response.status_code == 204
        assert not await _membership_exists(session, other_id, group_id)
        assert await _membership_exists(session, viewed_id, group_id)

    async def test_member_self_leave_without_header(
        self, client: AsyncClient, session, test_user_2, test_group, auth_headers_user2
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
        user_id, group_id = test_user_2.id, test_group.id

        response = await client.delete(
            f"/api/static-groups/{group_id}/members/{user_id}", headers=auth_headers_user2
        )
        assert response.status_code == 204
        assert not await _membership_exists(session, user_id, group_id)

    async def test_admin_member_self_leave_under_view_as_of_another(
        self,
        client: AsyncClient,
        session,
        test_user_2,
        test_group,
        admin_user,
        admin_headers,
    ):
        await create_membership(session, admin_user, test_group, role=MemberRole.MEMBER)
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
        admin_id, viewed_id, group_id = admin_user.id, test_user_2.id, test_group.id

        response = await client.delete(
            f"/api/static-groups/{group_id}/members/{admin_id}",
            headers=_with_view_as(admin_headers, viewed_id),
        )
        assert response.status_code == 204
        assert not await _membership_exists(session, admin_id, group_id)
        assert await _membership_exists(session, viewed_id, group_id)
