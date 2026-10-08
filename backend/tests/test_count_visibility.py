"""Token-count privacy (S2a-1, R-S1-19): the flag on PUT /api/player/profile and
the `count_visibility` gate the count-carrying reads apply.

The rule: a viewer sees no counts but their own; a member, lead, owner or admin
sees every count except those of members whose flag is set; a caller always
sees their own. Hidden counts are hidden from leads, owners and admins alike.
"""

import pytest
from sqlalchemy import select

from app.models import MemberRole, PlayerProfile, User
from app.services.collection_records import count_visibility
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

ROLES = [r.value for r in MemberRole]


async def _flagged(session, user: User, *, hidden: bool) -> None:
    profile = await create_player_profile(session, user)
    profile.hide_collection_counts = hidden
    await session.flush()


class TestProfileFlag:
    async def test_put_sets_only_the_callers_flag(
        self, client, session, auth_headers, test_user, test_user_2
    ):
        other = await create_player_profile(session, test_user_2)
        await session.commit()

        response = await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": True}
        )
        assert response.status_code == 200
        assert response.json()["hideCollectionCounts"] is True

        rows = (await session.execute(select(PlayerProfile))).scalars().all()
        flags = {p.user_id: p.hide_collection_counts for p in rows}
        assert flags[test_user.id] is True
        assert flags[test_user_2.id] is False
        assert other.hide_collection_counts is False

    async def test_omitting_the_field_leaves_it_unchanged(self, client, auth_headers):
        await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": True}
        )
        response = await client.put("/api/player/profile", headers=auth_headers, json={"bio": "hi"})
        assert response.status_code == 200
        assert response.json()["hideCollectionCounts"] is True

        response = await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": False}
        )
        assert response.json()["hideCollectionCounts"] is False

    async def test_get_carries_the_flag_default_false(self, client, auth_headers):
        response = await client.get("/api/player/profile", headers=auth_headers)
        assert response.json()["hideCollectionCounts"] is False


class TestCountVisibility:
    async def _setup(self, session, *, hidden: bool):
        owner = await create_user(session, discord_id="1001", discord_username="o")
        group = await create_static_group(session, owner)
        target = await create_user(session, discord_id="1002", discord_username="t")
        await create_membership(session, target, group)
        await _flagged(session, target, hidden=hidden)
        return group, target

    async def _visible(self, session, group, viewer_id, role, user_ids):
        return await count_visibility(
            session,
            static_group_id=group.id,
            viewer_user_id=viewer_id,
            viewer_role=role,
            user_ids=user_ids,
        )

    @pytest.mark.parametrize("role", ["member", "lead", "owner"])
    async def test_non_viewers_see_unflagged_counts(self, session, role):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, role, [target.id]) == {target.id}

    @pytest.mark.parametrize("role", ["member", "lead", "owner"])
    async def test_flag_hides_from_every_non_viewer_including_leads_and_owners(
        self, session, role
    ):
        group, target = await self._setup(session, hidden=True)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, role, [target.id]) == set()

    async def test_admin_acting_as_owner_is_hidden_from_too(self, session):
        group, target = await self._setup(session, hidden=True)
        admin = await create_user(session, discord_id="1004", discord_username="a")
        admin.is_admin = True
        await session.flush()
        # An admin who is not a member acts with the owner role (get_user_role_for_response).
        assert await self._visible(session, group, admin.id, "owner", [target.id]) == set()

    @pytest.mark.parametrize("hidden", [False, True])
    async def test_viewer_sees_no_counts_but_their_own(self, session, hidden):
        group, target = await self._setup(session, hidden=hidden)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        await create_membership(session, viewer, group, role=MemberRole.VIEWER)
        await _flagged(session, viewer, hidden=hidden)
        assert await self._visible(session, group, viewer.id, "viewer", [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, "viewer", [target.id, viewer.id]
        ) == {viewer.id}

    async def test_no_role_sees_only_their_own(self, session):
        # A share-code or non-member reader has no role (get_user_role_for_response -> None).
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, None, [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, None, [target.id, viewer.id]
        ) == {viewer.id}

    async def test_unknown_role_sees_only_their_own(self, session):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "bogus", [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, "bogus", [target.id, viewer.id]
        ) == {viewer.id}

    @pytest.mark.parametrize("role", ROLES)
    async def test_a_caller_always_sees_their_own_even_when_flagged(self, session, role):
        group, target = await self._setup(session, hidden=True)
        assert await self._visible(session, group, target.id, role, [target.id]) == {target.id}

    async def test_user_without_a_profile_has_no_flag(self, session):
        group, _ = await self._setup(session, hidden=True)
        bare = await create_user(session, discord_id="1005", discord_username="b")
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "member", [bare.id]) == {bare.id}
        assert await self._visible(session, group, viewer.id, "viewer", [bare.id]) == set()

    async def test_mixed_users_and_enum_role(self, session):
        group, hidden_user = await self._setup(session, hidden=True)
        shown = await create_user(session, discord_id="1006", discord_username="s")
        await _flagged(session, shown, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        visible = await self._visible(
            session, group, viewer.id, MemberRole.LEAD, [hidden_user.id, shown.id]
        )
        assert visible == {shown.id}

    async def test_empty_input_and_one_query(self, session, engine, count_statements):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "member", []) == set()
        others = [
            (await create_user(session, discord_id=f"20{i}", discord_username=f"u{i}")).id
            for i in range(5)
        ]
        with count_statements(engine) as counts:
            await self._visible(session, group, viewer.id, "member", [target.id, *others])
        assert counts.n == 1
