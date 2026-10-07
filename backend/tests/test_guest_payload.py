"""GUEST-1 R-G1-1/R-G1-2: a non-member gets no member or owner Discord identity.

`GET /static-groups/by-code/{code}` and `GET /static-groups/{id}` share one
builder (`group_to_response_with_members`). The identity gate is
`user_role is not None`: every membership role (viewers included) and admins
keep the identity; anonymous callers and signed-in outsiders get `owner: null`
and `members[].user: null` with the members list itself (id, userId, role,
joinedAt) intact.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from tests.factories import create_membership, create_static_group, create_user

IDENTITY_KEYS = ("discordUsername", "discordId", "discordAvatar", "avatarUrl")

USERNAMES = {
    "owner": "owner_handle",
    "lead": "lead_handle",
    "member": "member_handle",
    "viewer": "viewer_handle",
}


def _bearer(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest_asyncio.fixture
async def world(session: AsyncSession) -> dict:
    users: dict[str, User] = {}
    for i, (key, handle) in enumerate(USERNAMES.items()):
        users[key] = await create_user(
            session,
            discord_id=f"10000000000000000{i}",
            discord_username=handle,
            discord_avatar=f"avatarhash{i}",
        )
    users["outsider"] = await create_user(
        session, discord_id="200000000000000000", discord_username="outsider_handle"
    )
    admin = await create_user(
        session, discord_id="300000000000000000", discord_username="admin_handle"
    )
    admin.is_admin = True
    users["admin"] = admin

    group = await create_static_group(
        session, users["owner"], name="Public Static", share_code="PUBL1C", is_public=True
    )
    await create_membership(session, users["lead"], group, role=MemberRole.LEAD)
    await create_membership(session, users["member"], group, role=MemberRole.MEMBER)
    await create_membership(session, users["viewer"], group, role=MemberRole.VIEWER)

    private = await create_static_group(
        session, users["owner"], name="Private Static", share_code="PR1VAT", is_public=False
    )
    await session.commit()
    return {"users": users, "group": group, "private": private}


def _urls(group) -> list[str]:
    return [
        f"/api/static-groups/by-code/{group.share_code}",
        f"/api/static-groups/{group.id}",
    ]


def _assert_no_identity(response) -> None:
    assert response.status_code == 200
    body = response.json()
    assert body["owner"] is None
    assert len(body["members"]) == 4
    assert {m["role"] for m in body["members"]} == {"owner", "lead", "member", "viewer"}
    for m in body["members"]:
        assert m["user"] is None
        assert m["userId"]
        assert m["joinedAt"]
    for key in IDENTITY_KEYS:
        assert key not in response.text, f"{key} leaked to a non-member"
    for handle in USERNAMES.values():
        assert handle not in response.text


def _assert_identity(response) -> None:
    assert response.status_code == 200
    body = response.json()
    assert body["owner"]["discordUsername"] == "owner_handle"
    handles = {m["user"]["discordUsername"] for m in body["members"]}
    assert handles == set(USERNAMES.values())


@pytest.mark.parametrize("which", [0, 1], ids=["by-code", "by-id"])
class TestNonMemberGetsNoIdentity:
    @pytest.mark.asyncio
    async def test_anonymous(self, client: AsyncClient, world: dict, which: int):
        response = await client.get(_urls(world["group"])[which])
        _assert_no_identity(response)

    @pytest.mark.asyncio
    async def test_signed_in_outsider(self, client: AsyncClient, world: dict, which: int):
        response = await client.get(
            _urls(world["group"])[which], headers=_bearer(world["users"]["outsider"])
        )
        _assert_no_identity(response)
        assert response.json()["userRole"] is None


@pytest.mark.parametrize("which", [0, 1], ids=["by-code", "by-id"])
class TestMembersAndAdminsKeepIdentity:
    """(pin) Behaviour that must not change."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("role", ["owner", "lead", "member", "viewer"])
    async def test_every_role_keeps_identity(
        self, client: AsyncClient, world: dict, which: int, role: str
    ):
        response = await client.get(
            _urls(world["group"])[which], headers=_bearer(world["users"][role])
        )
        _assert_identity(response)

    @pytest.mark.asyncio
    async def test_admin_non_member_keeps_identity(
        self, client: AsyncClient, world: dict, which: int
    ):
        response = await client.get(
            _urls(world["group"])[which], headers=_bearer(world["users"]["admin"])
        )
        _assert_identity(response)
        assert response.json()["isAdminAccess"] is True


class TestUnchangedRoutes:
    """(pin)"""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("which", [0, 1], ids=["by-code", "by-id"])
    async def test_private_static_refuses_anonymous(
        self, client: AsyncClient, world: dict, which: int
    ):
        response = await client.get(_urls(world["private"])[which])
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_returns_owner_identity(self, client: AsyncClient, world: dict):
        response = await client.post(
            "/api/static-groups",
            json={"name": "Fresh Static"},
            headers=_bearer(world["users"]["owner"]),
        )
        assert response.status_code in (200, 201)
        body = response.json()
        assert body["owner"]["discordUsername"] == "owner_handle"
        assert body["members"][0]["user"]["discordUsername"] == "owner_handle"
