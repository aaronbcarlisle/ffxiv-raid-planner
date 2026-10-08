"""S2a-2·B3 TB4: the bulk "mark blank cells Need" route (R-S2-12, Q2).

`POST /api/static-groups/{group_id}/collection-participants/mark-need` takes the
blank claimed cells the client shows and writes a `need` row for each one that is
still blank, on a goal that isn't `complete`, for a non-viewer member whose record
for the goal's item doesn't say `have`. Everything else is skipped and counted, and
one `undo_token` covers every created row.
"""

import itertools
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.routers import collection_goals as goals_router
from tests.factories import (
    create_catalog_item,
    create_collection_goal,
    create_membership,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_user,
)
from tests.test_participant_undo import (
    _columns,
    _goal,
    _headers,
    _patch,
    _record,
    _row,
    _stored_row,
    _undo,
    _undone,
    ts,
)

ROUTER_CLOCK = datetime(2026, 3, 1, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def router_clock(monkeypatch):
    """The router's `now`: a minute later on every call, after every setup stamp."""
    ticks = itertools.count(1)
    monkeypatch.setattr(
        goals_router,
        "_now",
        lambda: (ROUTER_CLOCK + timedelta(minutes=next(ticks))).isoformat(),
    )


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="need_owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_username="need_lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="need_member")


@pytest_asyncio.fixture
async def member2(session: AsyncSession) -> User:
    return await create_user(session, discord_username="need_member2")


@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_username="need_viewer")


@pytest_asyncio.fixture
async def group(session, owner, lead, member, member2, viewer):
    g = await create_static_group(session, owner, name="Mark Need Static")
    await create_membership(session, lead, g, role="lead")
    await create_membership(session, member, g, role="member")
    await create_membership(session, member2, g, role="member")
    await create_membership(session, viewer, g, role="viewer")
    return g


async def _mained(session, user):
    """A profile and a main for `user` (no card: the chain falls back to the main)."""
    profile = await create_player_profile(session, user)
    main = await create_player_character(session, profile, name=f"{user.discord_username} Main")
    return profile, main


def _url(group) -> str:
    return f"/api/static-groups/{group.id}/collection-participants/mark-need"


def _cells(*pairs) -> dict:
    return {"cells": [{"goal_id": goal.id, "user_id": user.id} for goal, user in pairs]}


async def _mark(client, group, body: dict, as_: User):
    return await client.post(_url(group), json=body, headers=_headers(as_))


class TestGate:
    async def test_a_member_and_a_viewer_get_403(
        self, client, session, group, owner, member, viewer
    ):
        goal = await _goal(session, group, owner)
        await session.commit()
        for caller in (member, viewer):
            resp = await _mark(client, group, _cells((goal, member)), caller)
            assert resp.status_code == 403, resp.text
        assert await _stored_row(session, goal, member) is None

    async def test_more_than_two_hundred_cells_is_422(self, client, session, group, owner, lead):
        goal = await _goal(session, group, owner)
        await session.commit()
        cells = {"cells": [{"goal_id": goal.id, "user_id": str(uuid.uuid4())}] * 201}
        resp = await _mark(client, group, cells, lead)
        assert resp.status_code == 422, resp.text
        assert (await _mark(client, group, {"cells": []}, lead)).status_code == 422

    async def test_a_goal_from_another_static_is_404_and_nothing_is_written(
        self, client, session, group, owner, lead, member
    ):
        mine = await _goal(session, group, owner)
        other_owner = await create_user(session, discord_username="need_other_owner")
        other_group = await create_static_group(session, other_owner, name="Other Static")
        foreign = await create_collection_goal(session, other_group, other_owner, title="Foreign")
        await session.commit()

        resp = await _mark(client, group, _cells((mine, member), (foreign, member)), lead)
        assert resp.status_code == 404, resp.text
        assert await _stored_row(session, mine, member) is None


class TestWrites:
    async def test_only_the_cells_that_may_be_filled_get_a_need_row(
        self, client, session, group, owner, lead, member, member2, viewer
    ):
        blank = await _goal(session, group, owner)
        done = await _goal(session, group, owner)
        done.status = "complete"
        taken = await _goal(session, group, owner)
        item = await create_catalog_item(session, name="Mark Need Mount")
        owned = await _goal(session, group, owner, item)
        profile, main = await _mained(session, member2)
        await _record(session, profile, main, item, ownership="have")
        stranger = await create_user(session, discord_username="need_stranger")
        existing = await _row(
            session, taken, member, state="want", writer=member.id, via="web",
            source="manual", token_count=3, token_count_updated_at=ts(4),
            priority_rank=2, notes="keep me",
        )
        before = _columns(existing, but=())
        await session.commit()

        resp = await _mark(
            client,
            group,
            _cells(
                (blank, member),  # created
                (blank, member2),  # created
                (done, member),  # goal complete
                (taken, member),  # a row exists
                (owned, member2),  # the record says have
                (blank, viewer),  # a viewer
                (blank, stranger),  # no member of this static
                (blank, member),  # a duplicate of the first
            ),
            lead,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert sorted((c["goal_id"], c["user_id"]) for c in data["created"]) == sorted(
            [(blank.id, member.id), (blank.id, member2.id)]
        )
        assert data["skipped"] == 6
        assert all(c["state"] == "need" for c in data["created"])

        assert _columns(await _stored_row(session, taken, member), but=()) == before
        for goal, user in ((done, member), (owned, member2), (blank, viewer), (blank, stranger)):
            assert await _stored_row(session, goal, user) is None

    async def test_an_existing_row_is_left_byte_identical_and_counted(
        self, client, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        existing = await _row(
            session, goal, member, state="pass", writer=owner.id, via="api_key",
            source="plugin", token_count=7, token_count_updated_at=ts(4),
            priority_rank=1, notes="plugin wrote this",
        )
        before = _columns(existing, but=())
        await session.commit()

        resp = await _mark(client, group, _cells((goal, member)), lead)
        assert resp.status_code == 200, resp.text
        assert resp.json()["created"] == []
        assert resp.json()["skipped"] == 1
        assert resp.json()["undo_token"] is None
        assert _columns(await _stored_row(session, goal, member), but=()) == before

    async def test_a_record_that_says_have_skips_the_cell_and_a_missing_one_does_not(
        self, client, session, group, owner, lead, member, member2
    ):
        item = await create_catalog_item(session, name="Record Check Mount")
        goal = await _goal(session, group, owner, item)
        have_profile, have_main = await _mained(session, member)
        await _record(session, have_profile, have_main, item, ownership="have")
        missing_profile, missing_main = await _mained(session, member2)
        await _record(session, missing_profile, missing_main, item, ownership="missing")
        await session.commit()

        resp = await _mark(client, group, _cells((goal, member), (goal, member2)), lead)
        assert resp.status_code == 200, resp.text
        assert [c["user_id"] for c in resp.json()["created"]] == [member2.id]
        assert resp.json()["skipped"] == 1
        assert await _stored_row(session, goal, member) is None
        assert (await _stored_row(session, goal, member2)).state == "need"

    async def test_created_rows_are_the_leads_corrections_and_the_leads_own_cell_is_own(
        self, client, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        await session.commit()

        resp = await _mark(client, group, _cells((goal, member), (goal, lead)), lead)
        assert resp.status_code == 200, resp.text
        by_user = {c["user_id"]: c for c in resp.json()["created"]}
        assert set(by_user) == {member.id, lead.id}
        for user in (member, lead):
            row = await _stored_row(session, goal, user)
            assert (row.state, row.source, row.updated_by_user_id, row.updated_via) == (
                "need", "manual", lead.id, "web",
            )
            assert row.state_changed_at == row.updated_at == row.last_manual_override_at
            shown = by_user[user.id]
            assert (shown["updated_by_user_id"], shown["updated_via"], shown["source"]) == (
                lead.id, "web", "manual",
            )
        # A correction for the member (writer != user); "own" for the lead (writer == user).
        assert by_user[member.id]["updated_by_user_id"] != by_user[member.id]["user_id"]
        assert by_user[lead.id]["updated_by_user_id"] == by_user[lead.id]["user_id"]

    async def test_a_failed_mint_still_commits_the_rows(
        self, client, session, group, owner, lead, member, monkeypatch
    ):
        goal = await _goal(session, group, owner)
        await session.commit()

        def boom(**_kwargs):
            raise RuntimeError("no key")

        monkeypatch.setattr(goals_router, "mint_undo_token", boom)
        resp = await _mark(client, group, _cells((goal, member)), lead)
        assert resp.status_code == 200, resp.text
        assert resp.json()["undo_token"] is None
        assert len(resp.json()["created"]) == 1
        assert (await _stored_row(session, goal, member)).state == "need"


class TestUndo:
    async def test_the_token_deletes_the_created_rows(
        self, client, session, group, owner, lead, member, member2
    ):
        g1 = await _goal(session, group, owner)
        g2 = await _goal(session, group, owner)
        await session.commit()

        resp = await _mark(client, group, _cells((g1, member), (g2, member2), (g1, lead)), lead)
        assert resp.status_code == 200, resp.text
        token = resp.json()["undo_token"]
        assert isinstance(token, str) and token

        assert await _undone(client, group, token, lead) == {"restored": 3, "skipped": 0}
        for goal, user in ((g1, member), (g2, member2), (g1, lead)):
            assert await _stored_row(session, goal, user) is None

    async def test_a_created_row_edited_since_is_kept(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        await session.commit()

        resp = await _mark(client, group, _cells((goal, member), (goal, member2)), lead)
        token = resp.json()["undo_token"]
        await _patch(client, group, goal, {"state": "have"}, member)  # the member moves on

        assert await _undone(client, group, token, lead) == {"restored": 1, "skipped": 1}
        assert (await _stored_row(session, goal, member)).state == "have"
        assert await _stored_row(session, goal, member2) is None

    async def test_a_member_cannot_undo_the_leads_bulk_token(
        self, client, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        await session.commit()
        token = (await _mark(client, group, _cells((goal, member)), lead)).json()["undo_token"]

        resp = await _undo(client, group, token, member)
        assert resp.status_code == 400, resp.text
        assert (await _stored_row(session, goal, member)).state == "need"
