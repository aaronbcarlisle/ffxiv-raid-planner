"""S2a-3c·C1 TC1: the farm queue-order route and its rank-only door (E-1…E-4, E-9, D-4, D-9).

`PUT /api/static-groups/{group_id}/collection-goals/{goal_id}/queue-order` takes
`{"user_ids": [...]}` from a lead and replaces the farm's whole order: the k-th listed
user who has a row on the goal gets rank k, every other row of the goal loses its rank,
and a listed id with no row is skipped and counted. `[]` is Back to automatic. The
writes go through `write_rank`, which moves `priority_rank` and `updated_at` only, so a
re-ranked cell keeps its writer and channel (D-9) and a pending status Undo sees the
row as changed (E-3). The PATCH routes and both plugin syncs leave a pin alone (R-C-11,
E-9).

The router's clock is a counter, one minute per call and later than every setup stamp,
so no two writes share an `updated_at` (Windows' clock ticks every 15.6 ms).
"""

import itertools
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.routers import collection_goals as goals_router
from tests.factories import (
    create_catalog_item,
    create_collection_goal,
    create_membership,
    create_static_group,
    create_user,
)
from tests.test_participant_undo import (
    ZODIARK_TRIAL,
    _carded,
    _columns,
    _goal,
    _headers,
    _patch,
    _row,
    _stored_row,
    _undone,
    ts,
)

ROUTER_CLOCK = datetime(2026, 3, 1, tzinfo=timezone.utc)
RESPONSE_KEYS = {"ranked", "cleared", "skipped"}
# What a re-rank must leave alone on the row (E-3, D-9).
KEPT_COLUMNS = (
    "updated_by_user_id",
    "updated_via",
    "state",
    "state_changed_at",
    "source",
    "last_manual_override_at",
    "token_count",
    "token_count_updated_at",
    "notes",
)
_MOUNT_ID = 9301
_TOKEN_ID = 9302


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
    return await create_user(session, discord_username="qo_owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_member")


@pytest_asyncio.fixture
async def member2(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_member2")


@pytest_asyncio.fixture
async def member3(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_member3")


@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_viewer")


@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_username="qo_outsider")


@pytest_asyncio.fixture
async def group(session, owner, lead, member, member2, member3, viewer):
    g = await create_static_group(session, owner, name="Queue Order Static")
    await create_membership(session, lead, g, role="lead")
    await create_membership(session, member, g, role="member")
    await create_membership(session, member2, g, role="member")
    await create_membership(session, member3, g, role="member")
    await create_membership(session, viewer, g, role="viewer")
    return g


def _url(group, goal) -> str:
    return f"/api/static-groups/{group.id}/collection-goals/{goal.id}/queue-order"


async def _put(client: AsyncClient, group, goal, body, as_: User):
    return await client.put(_url(group, goal), json=body, headers=_headers(as_))


async def _order(client: AsyncClient, group, goal, users, as_: User) -> dict:
    """A queue-order PUT that must succeed; returns its body."""
    resp = await _put(client, group, goal, {"user_ids": [u.id for u in users]}, as_)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _need(session, goal, user, *, state="need", rank=None, writer=None, via="web"):
    return await _row(
        session, goal, user, state=state, writer=writer or user.id, via=via, priority_rank=rank,
    )


async def _rank(session, goal, user) -> int | None:
    return (await _stored_row(session, goal, user)).priority_rank


async def _listed(client: AsyncClient, group, goal, as_: User) -> list[dict]:
    resp = await client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants",
        headers=_headers(as_),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _mint_key(client: AsyncClient, user: User) -> str:
    """A real xrp_ key for `user`; returns the raw key."""
    minted = await client.post(
        "/api/auth/api-keys", json={"name": "Queue order key"}, headers=_headers(user)
    )
    assert minted.status_code == 201, minted.text
    key = minted.json()["key"]
    assert key.startswith("xrp_")
    return key


# ── The order is stored and read back ────────────────────────────────────────


class TestOrder:
    async def test_a_leads_order_ranks_the_listed_rows_and_the_read_follows_it(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member)  # A
        await _need(session, goal, member2)  # B
        await session.commit()

        data = await _order(client, group, goal, [member2, member], lead)

        assert set(data) == RESPONSE_KEYS
        assert data == {"ranked": 2, "cleared": 0, "skipped": 0}
        assert await _rank(session, goal, member2) == 1
        assert await _rank(session, goal, member) == 2
        listed = [p["user_id"] for p in await _listed(client, group, goal, lead)]
        assert listed == [member2.id, member.id]

    async def test_the_order_replaces_the_whole_order_and_an_unlisted_rank_is_cleared(
        self, client, session, group, owner, lead, member, member2, member3
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member)
        await _need(session, goal, member2)
        await _need(session, goal, member3, state="have", rank=1)  # C, pinned before
        await session.commit()

        data = await _order(client, group, goal, [member2, member], lead)

        assert data == {"ranked": 2, "cleared": 1, "skipped": 0}
        assert await _rank(session, goal, member3) is None
        assert (await _stored_row(session, goal, member3)).state == "have"

    async def test_an_empty_order_clears_every_rank_of_the_goal_and_nothing_else(
        self, client, session, group, owner, lead, member, member2, member3
    ):
        goal = await _goal(session, group, owner)
        other_goal = await _goal(session, group, owner)
        other_owner = await create_user(session, discord_username="qo_other_owner")
        other_group = await create_static_group(session, other_owner, name="Other Queue Static")
        await create_membership(session, member, other_group, role="member")
        foreign = await create_collection_goal(session, other_group, other_owner, title="Foreign")
        await _need(session, goal, member, rank=1)
        await _need(session, goal, member2, state="want", rank=2)
        await _need(session, goal, member3)  # unranked: not counted as cleared
        await _need(session, other_goal, member, rank=3)
        await _need(session, foreign, member, rank=4)
        await session.commit()
        other_before = _columns(await _stored_row(session, other_goal, member), but=())
        foreign_before = _columns(await _stored_row(session, foreign, member), but=())

        data = await _order(client, group, goal, [], lead)

        assert data == {"ranked": 0, "cleared": 2, "skipped": 0}
        for user in (member, member2, member3):
            assert await _rank(session, goal, user) is None
        assert _columns(await _stored_row(session, other_goal, member), but=()) == other_before
        assert _columns(await _stored_row(session, foreign, member), but=()) == foreign_before

    async def test_ids_with_no_row_are_skipped_and_a_demoted_viewers_row_is_ranked(
        self, client, session, group, owner, lead, member, member2, viewer, outsider
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member)
        await _need(session, goal, viewer)  # a viewer who kept a claimed card (design §7)
        await session.commit()

        body = {
            "user_ids": [
                outsider.id,  # not a member of this static
                member2.id,  # a member with no row on the goal
                viewer.id,
                str(uuid.uuid4()),  # no such user
                "ünïcødé \\u0000 '$%…",  # not an id at all: no row either
                member.id,
            ]
        }
        resp = await _put(client, group, goal, body, lead)
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"ranked": 2, "cleared": 0, "skipped": 4}
        # Ranks follow the listed users who have a row, in order (R-C-1).
        assert await _rank(session, goal, viewer) == 1
        assert await _rank(session, goal, member) == 2
        assert await _stored_row(session, goal, member2) is None
        assert await _stored_row(session, goal, outsider) is None

    async def test_two_hundred_ids_is_accepted(self, client, session, group, owner, lead):
        goal = await _goal(session, group, owner)
        await session.commit()
        body = {"user_ids": [str(uuid.uuid4()) for _ in range(200)]}
        resp = await _put(client, group, goal, body, lead)
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"ranked": 0, "cleared": 0, "skipped": 200}

    async def test_the_route_locks_the_goal_then_its_rows(
        self, client, session, group, owner, lead, member, monkeypatch
    ):
        from sqlalchemy.dialects import postgresql

        goal = await _goal(session, group, owner)
        await _need(session, goal, member)
        await session.commit()

        seen: list[str] = []
        real_execute = session.execute

        async def recording_execute(statement, *args, **kwargs):
            try:
                seen.append(str(statement.compile(dialect=postgresql.dialect())))
            except Exception:  # raw text / DDL: not a select we care about
                seen.append("")
            return await real_execute(statement, *args, **kwargs)

        monkeypatch.setattr(session, "execute", recording_execute)
        await _order(client, group, goal, [member], lead)
        monkeypatch.undo()

        goal_lock = next(
            (i for i, s in enumerate(seen) if "FROM collection_goals" in s and "FOR UPDATE" in s),
            None,
        )
        row_lock = next(
            (
                i
                for i, s in enumerate(seen)
                if "FROM reward_participant_states" in s and "FOR UPDATE" in s
            ),
            None,
        )
        assert goal_lock is not None, "set_queue_order must SELECT the goal FOR UPDATE"
        assert row_lock is not None, "set_queue_order must SELECT the goal's rows FOR UPDATE"
        assert goal_lock < row_lock, "the goal lock must precede the row lock"


# ── A re-rank moves the rank alone (E-3, D-9) ────────────────────────────────


class TestRankOnly:
    async def test_a_reranked_row_keeps_its_provenance_and_its_updated_at_moves(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        row = await _row(
            session, goal, member, state="want", writer=member.id, via="api_key",
            source="plugin", token_count=12, token_count_updated_at=ts(4),
            state_changed_at=ts(1), priority_rank=None, notes="my notes ‘quoted’ \\ $",
        )
        await _need(session, goal, member2)
        await session.commit()
        before = _columns(row, but=())

        await _order(client, group, goal, [member, member2], lead)

        after = _columns(await _stored_row(session, goal, member), but=())
        assert after["priority_rank"] == 1
        for column in KEPT_COLUMNS:
            assert after[column] == before[column], column
        assert after["updated_at"] != before["updated_at"]
        assert datetime.fromisoformat(after["updated_at"]) > datetime.fromisoformat(
            before["updated_at"]
        )
        # Nothing else on the row moved either.
        assert {k: v for k, v in after.items() if k not in ("priority_rank", "updated_at")} == {
            k: v for k, v in before.items() if k not in ("priority_rank", "updated_at")
        }

    async def test_a_row_whose_rank_already_matches_is_not_written(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        kept = await _need(session, goal, member, rank=1)
        await _need(session, goal, member2, rank=5)
        await session.commit()
        before = _columns(kept, but=())

        data = await _order(client, group, goal, [member, member2], lead)

        assert data == {"ranked": 2, "cleared": 0, "skipped": 0}
        assert _columns(await _stored_row(session, goal, member), but=()) == before
        assert await _rank(session, goal, member2) == 2

    async def test_the_read_shows_the_cells_writer_unchanged_after_a_rerank(
        self, client, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member, writer=member.id, via="web")
        await session.commit()

        await _order(client, group, goal, [member], lead)

        cells = await _listed(client, group, goal, owner)
        (cell,) = [p for p in cells if p["user_id"] == member.id]
        assert (cell["priority_rank"], cell["updated_by_user_id"], cell["updated_via"]) == (
            1, member.id, "web",
        )


# ── Who may set it, and what it refuses ──────────────────────────────────────


class TestGate:
    async def test_a_member_a_viewer_and_a_non_member_get_403(
        self, client, session, group, owner, lead, member, member2, viewer, outsider
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member, rank=1)
        await _need(session, goal, member2, rank=2)
        await session.commit()
        before = [_columns(await _stored_row(session, goal, u), but=()) for u in (member, member2)]

        for caller in (member, viewer, outsider):
            resp = await _put(client, group, goal, {"user_ids": [member2.id, member.id]}, caller)
            assert resp.status_code == 403, (caller.discord_username, resp.text)
        after = [_columns(await _stored_row(session, goal, u), but=()) for u in (member, member2)]
        assert after == before
        # A lead may (the gate is lead and above, not a missing route).
        assert (await _order(client, group, goal, [member2, member], lead))["ranked"] == 2

    async def test_the_owner_may_set_the_order(self, client, session, group, owner, member):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member)
        await session.commit()
        assert await _order(client, group, goal, [member], owner) == {
            "ranked": 1, "cleared": 0, "skipped": 0,
        }

    @pytest.mark.parametrize(
        "body",
        [
            pytest.param("dupes", id="duplicate ids"),
            pytest.param("too_many", id="201 ids"),
            pytest.param({}, id="no user_ids"),
            pytest.param({"user_ids": None}, id="user_ids null"),
            pytest.param({"user_ids": "abc"}, id="user_ids a string"),
        ],
    )
    async def test_a_bad_body_is_422_and_nothing_is_written(
        self, client, session, group, owner, lead, member, member2, body
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member, rank=1)
        await _need(session, goal, member2)
        await session.commit()
        before = [_columns(await _stored_row(session, goal, u), but=()) for u in (member, member2)]
        if body == "dupes":
            body = {"user_ids": [member2.id, member.id, member2.id]}
        elif body == "too_many":
            body = {"user_ids": [member2.id] + [str(uuid.uuid4()) for _ in range(200)]}

        resp = await _put(client, group, goal, body, lead)
        assert resp.status_code == 422, resp.text
        after = [_columns(await _stored_row(session, goal, u), but=()) for u in (member, member2)]
        assert after == before
        # The route exists and takes a good body (not a 422 for a missing route).
        assert (await _order(client, group, goal, [member2], lead))["ranked"] == 1

    async def test_another_statics_goal_is_404_and_its_ranks_are_untouched(
        self, client, session, group, owner, lead, member
    ):
        mine = await _goal(session, group, owner)
        other_owner = await create_user(session, discord_username="qo_foreign_owner")
        other_group = await create_static_group(session, other_owner, name="Foreign Queue Static")
        await create_membership(session, member, other_group, role="member")
        foreign = await create_collection_goal(session, other_group, other_owner, title="Foreign")
        await _need(session, mine, member)
        await _need(session, foreign, member, rank=3)
        await session.commit()
        foreign_before = _columns(await _stored_row(session, foreign, member), but=())

        # Our own goal is ordered through the same path ...
        assert (await _order(client, group, mine, [member], lead))["ranked"] == 1
        # ... but another static's goal under our static is not found.
        resp = await _put(client, group, foreign, {"user_ids": [member.id]}, lead)
        assert resp.status_code == 404, resp.text
        assert _columns(await _stored_row(session, foreign, member), but=()) == foreign_before

        class _Missing:
            id = str(uuid.uuid4())

        resp = await _put(client, group, _Missing, {"user_ids": [member.id]}, lead)
        assert resp.status_code == 404, resp.text


# ── A pending status Undo and a re-rank (E-3) ────────────────────────────────


class TestUndo:
    async def test_a_status_undo_after_a_rerank_of_that_row_is_skipped_and_the_rank_stays(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member, state="want")
        await _need(session, goal, member2)
        await session.commit()

        token = await _patch(client, group, goal, {"state": "need"}, lead, target=member)
        await _order(client, group, goal, [member2, member], lead)  # member: None -> 2

        assert await _undone(client, group, token, lead) == {"restored": 0, "skipped": 1}
        stored = await _stored_row(session, goal, member)
        assert (stored.state, stored.priority_rank) == ("need", 2)

    async def test_a_status_undo_after_an_order_that_left_that_row_alone_restores_the_state(
        self, client, session, group, owner, lead, member, member2
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member, state="want", rank=1)
        await _need(session, goal, member2)
        await session.commit()

        token = await _patch(client, group, goal, {"state": "need"}, lead, target=member)
        data = await _order(client, group, goal, [member, member2], lead)  # member keeps 1
        assert data == {"ranked": 2, "cleared": 0, "skipped": 0}
        assert await _rank(session, goal, member2) == 2

        assert await _undone(client, group, token, lead) == {"restored": 1, "skipped": 0}
        stored = await _stored_row(session, goal, member)
        assert (stored.state, stored.priority_rank) == ("want", 1)


# ── The PATCH and the plugin syncs keep a pin (R-C-11, E-9) ──────────────────


class TestPinKept:
    async def test_v1s_null_rank_on_either_patch_keeps_the_pin(
        self, client, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        await _need(session, goal, member)
        await _need(session, goal, lead)
        await session.commit()
        await _order(client, group, goal, [member, lead], lead)

        await _patch(client, group, goal, {"state": "want", "priority_rank": None}, member)
        await _patch(client, group, goal, {"state": "want", "priority_rank": None}, lead)
        await _patch(
            client, group, goal, {"state": "need", "priority_rank": None}, lead, target=member
        )

        assert await _rank(session, goal, member) == 1
        assert await _rank(session, goal, lead) == 2
        assert (await _stored_row(session, goal, member)).state == "need"
        assert (await _stored_row(session, goal, lead)).state == "want"

    async def test_the_collections_sync_over_a_pinned_row_keeps_its_rank(
        self, client, session, group, owner, lead, member, member2
    ):
        item = await create_catalog_item(session, name="Queue Sync Mount")
        item.game_mount_id = _MOUNT_ID
        item.token_item_id = _TOKEN_ID
        goal = await _goal(session, group, owner, item)
        await _need(session, goal, member2)
        await _need(session, goal, member)
        await session.commit()
        await _order(client, group, goal, [member2, member], lead)
        key = await _mint_key(client, member)

        resp = await client.post(
            "/api/plugin/collections/sync",
            json={
                "mounts": [{"mountId": _MOUNT_ID, "owned": True}],
                "currencies": [{"itemId": _TOKEN_ID, "count": 40}],
            },
            headers={"Authorization": f"Bearer {key}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["statesUpdated"] == 1  # the sync did write the pinned row

        stored = await _stored_row(session, goal, member)
        assert (stored.state, stored.priority_rank) == ("have", 2)
        assert await _rank(session, goal, member2) == 1

    async def test_the_mount_farm_sync_over_a_pinned_row_keeps_its_rank(
        self, client, session, group, owner, lead, member, member2
    ):
        await _carded(session, group, member)
        item = await create_catalog_item(session, name="Queue Zodiark Mount")
        item.source_duty_key = ZODIARK_TRIAL
        item.is_active = True
        goal = await _goal(session, group, owner, item)
        await _need(session, goal, member2)
        await _need(session, goal, member)
        await session.commit()
        await _order(client, group, goal, [member2, member], lead)
        key = await _mint_key(client, member)

        resp = await client.post(
            "/api/plugin/mount-farms/sync",
            json={
                "mounts": [{"mountId": 999999, "trialId": ZODIARK_TRIAL, "owned": True}],
                "totems": [{"itemId": 36810, "count": 40}],
            },
            headers={"Authorization": f"Bearer {key}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["mountsUpdated"] == 1  # the sync landed on the farm's item
        cells = await _listed(client, group, goal, owner)
        (cell,) = [p for p in cells if p["user_id"] == member.id]
        assert (cell["state"], cell["priority_rank"]) == ("have", 2)

        assert await _rank(session, goal, member) == 2
        assert await _rank(session, goal, member2) == 1


# ── The door itself (R-C-2) ──────────────────────────────────────────────────


class TestWriteRank:
    async def test_write_rank_refuses_a_rank_below_one(self, session, group, owner, member):
        from app.services.collection_records import write_rank

        goal = await _goal(session, group, owner)
        row = await _need(session, goal, member, rank=3)
        await session.commit()
        before = _columns(row, but=())

        for bad in (0, -1):
            with pytest.raises(ValueError):
                await write_rank(session, row=row, priority_rank=bad, now=ts(50))
        assert _columns(row, but=()) == before

    @pytest.mark.parametrize("rank", [None, 2], ids=["no rank", "rank 2"])
    async def test_write_rank_with_an_equal_rank_returns_false_and_writes_nothing(
        self, session, group, owner, member, rank
    ):
        from app.services.collection_records import write_rank

        goal = await _goal(session, group, owner)
        row = await _need(session, goal, member, rank=rank)
        await session.commit()
        before = _columns(row, but=())

        assert await write_rank(session, row=row, priority_rank=rank, now=ts(50)) is False
        assert _columns(row, but=()) == before

    @pytest.mark.parametrize(("old", "new"), [(None, 1), (4, 1), (2, None)])
    async def test_write_rank_moves_the_rank_and_updated_at_only(
        self, session, group, owner, member, old, new
    ):
        from app.services.collection_records import write_rank

        goal = await _goal(session, group, owner)
        row = await _need(session, goal, member, rank=old)
        await session.commit()
        before = _columns(row, but=("priority_rank", "updated_at"))

        assert await write_rank(session, row=row, priority_rank=new, now=ts(50)) is True
        assert (row.priority_rank, row.updated_at) == (new, ts(50))
        assert _columns(row, but=("priority_rank", "updated_at")) == before
