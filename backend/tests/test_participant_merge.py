"""S2a-1a·3 C1: the farm row door and the record merge (R-S1-7 rows, R-S1-9).

`merge_participant` is the pure table: a farm row and the member's character
record in, the state/count/source the static sees out. `merged_participants`
runs it for every row of every goal in one chain resolution and one record
SELECT. `write_row` is the row's door (built here, routed by C2/C3).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import PlayerCollectionSnapshot, RewardParticipantState, User
from app.models.reward_participant_state import PARTICIPANT_SOURCES
from app.services.collection_records import (
    UNSET,
    MergedParticipant,
    RowWrite,
    merge_participant,
    merged_participants,
    write_row,
)
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_collection_goal,
    create_membership,
    create_participant_state,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)
USER = "user-1"
LEAD = "lead-1"


def ts(minutes: int) -> str:
    return (BASE + timedelta(minutes=minutes)).isoformat()


# ── In-memory rows and records (the pure table needs no database) ─────────────


def row(
    *,
    state: str = "want",
    writer: str | None = USER,
    state_changed_at: str | None = ts(1),
    token_count: int | None = None,
    token_count_updated_at: str | None = None,
    source: str = "manual",
    updated_at: str = ts(1),
    user_id: str = USER,
) -> RewardParticipantState:
    return RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id="goal-1",
        user_id=user_id,
        static_group_id="static-1",
        state=state,
        token_count=token_count,
        source=source,
        updated_at=updated_at,
        updated_by_user_id=writer,
        updated_via="web" if writer is not None else None,
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )


def record(
    *,
    ownership: str = "have",
    state_changed_at: str | None = ts(5),
    token_count: int | None = None,
    token_count_updated_at: str | None = None,
    source: str = "plugin",
    updated_at: str = ts(5),
) -> PlayerCollectionSnapshot:
    return PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id="profile-1",
        character_id="char-1",
        catalog_item_id="item-1",
        ownership_state=ownership,
        token_count=token_count,
        source=source,
        confidence="high",
        updated_at=updated_at,
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )


# ── merge_participant: the state table (R-S1-9 cases 1–4) ────────────────────

STATE_CASES = [
    # (id, row state, row writer, row state_changed_at, record ownership, record state_changed_at,
    #  expected state, state_from_record)
    ("seeded-pass-vs-newer-have", "pass", None, None, "have", ts(5), "pass", False),
    ("own-pass-vs-newer-have", "pass", USER, ts(1), "have", ts(5), "pass", False),
    ("leads-pass-vs-newer-have", "pass", LEAD, ts(1), "have", ts(5), "have", True),
    ("leads-pass-vs-newer-missing", "pass", LEAD, ts(1), "missing", ts(5), "pass", False),
    ("own-want-vs-newer-have", "want", USER, ts(1), "have", ts(5), "have", True),
    ("legacy-want-vs-have", "want", None, None, "have", ts(5), "have", True),
    ("own-want-vs-older-have", "want", USER, ts(9), "have", ts(5), "want", False),
    ("own-want-vs-same-time-have", "want", USER, ts(5), "have", ts(5), "want", False),
    ("own-want-vs-undated-have", "want", USER, ts(1), "have", None, "want", False),
    ("own-have-vs-newer-missing", "have", USER, ts(1), "missing", ts(5), "want", True),
    ("legacy-have-vs-newer-missing", "have", None, None, "missing", ts(5), "want", True),
    ("own-have-vs-newer-unknown", "have", USER, ts(1), "unknown", ts(5), "want", True),
    ("leads-have-vs-newer-missing", "have", LEAD, ts(1), "missing", ts(5), "have", False),
    ("own-have-vs-older-missing", "have", USER, ts(9), "missing", ts(5), "have", False),
    ("own-need-vs-newer-missing", "need", USER, ts(1), "missing", ts(5), "need", False),
    ("own-have-vs-token-only-unknown", "have", USER, ts(1), "unknown", None, "have", False),
    ("leads-want-vs-newer-missing", "want", LEAD, ts(1), "missing", ts(5), "want", False),
]


@pytest.mark.parametrize(
    "row_state, writer, row_at, ownership, record_at, expected, from_record",
    [case[1:] for case in STATE_CASES],
    ids=[case[0] for case in STATE_CASES],
)
def test_state_table(row_state, writer, row_at, ownership, record_at, expected, from_record):
    merged = merge_participant(
        row(state=row_state, writer=writer, state_changed_at=row_at, source="manual"),
        record(ownership=ownership, state_changed_at=record_at, source="plugin"),
    )
    assert merged.state == expected
    assert merged.state_from_record is from_record
    assert merged.source == ("plugin" if from_record else "manual")
    assert merged.source in PARTICIPANT_SOURCES


def test_the_leads_have_survives_a_newer_missing_but_the_members_does_not():
    """The edge pair of case 3: only a Have that is not a correction yields."""
    lead_set = row(state="have", writer=LEAD, state_changed_at=ts(1))
    own = row(state="have", writer=USER, state_changed_at=ts(1))
    newer_missing = record(ownership="missing", state_changed_at=ts(5))
    assert merge_participant(lead_set, newer_missing).state == "have"
    assert merge_participant(own, newer_missing).state == "want"


def test_no_record_is_the_row_as_stored():
    stored = row(state="need", token_count=4, source="player_hub")
    merged = merge_participant(stored, None)
    assert merged == MergedParticipant(
        state="need",
        token_count=4,
        source="player_hub",
        state_from_record=False,
        count_from_record=False,
        record=None,
    )


def test_the_record_is_echoed_for_the_response():
    rec = record()
    assert merge_participant(row(), rec).record is rec


def test_an_off_vocabulary_record_source_falls_back_to_the_rows():
    merged = merge_participant(
        row(state="want", source="manual"), record(ownership="have", source="lodestone")
    )
    assert (merged.state, merged.state_from_record) == ("have", True)
    assert merged.source == "manual"
    assert merged.source in PARTICIPANT_SOURCES


# ── merge_participant: the count table ───────────────────────────────────────

COUNT_CASES = [
    # (id, row count, row count time, record count, record count time, expected, from_record)
    ("both-null", None, None, None, None, None, False),
    ("row-null-record-dated", None, None, 7, ts(1), 7, True),
    ("row-null-record-undated", None, None, 7, None, 7, True),
    ("record-null-row-dated", 3, ts(1), None, None, 3, False),
    ("record-null-row-undated", 3, None, None, None, 3, False),
    ("record-later", 3, ts(1), 7, ts(2), 7, True),
    ("row-later", 3, ts(2), 7, ts(1), 3, False),
    ("row-undated-loses", 3, None, 7, ts(1), 7, True),
    ("record-undated-loses", 3, ts(1), 7, None, 3, False),
    ("tie-goes-to-the-record", 3, ts(1), 7, ts(1), 7, True),
    ("both-undated-is-a-tie", 3, None, 7, None, 7, True),
]


@pytest.mark.parametrize(
    "row_count, row_at, record_count, record_at, expected, from_record",
    [case[1:] for case in COUNT_CASES],
    ids=[case[0] for case in COUNT_CASES],
)
def test_count_table(row_count, row_at, record_count, record_at, expected, from_record):
    merged = merge_participant(
        row(token_count=row_count, token_count_updated_at=row_at),
        record(ownership="missing", state_changed_at=None, token_count=record_count,
               token_count_updated_at=record_at),
    )
    assert merged.token_count == expected
    assert merged.count_from_record is from_record


def test_a_leads_state_edit_does_not_make_a_stale_row_count_newest():
    """The count compares token_count_updated_at, never updated_at (R-S1-7)."""
    stale = row(
        state="want", writer=LEAD, state_changed_at=ts(3), updated_at=ts(3),
        token_count=3, token_count_updated_at=ts(1),
    )
    fresher = record(
        ownership="missing", state_changed_at=None, updated_at=ts(2),
        token_count=7, token_count_updated_at=ts(2),
    )
    merged = merge_participant(stale, fresher)
    assert (merged.token_count, merged.count_from_record) == (7, True)


def test_count_and_state_come_from_different_sides_independently():
    merged = merge_participant(
        row(state="pass", writer=None, state_changed_at=None, token_count=None),
        record(ownership="have", state_changed_at=ts(5), token_count=12,
               token_count_updated_at=ts(5)),
    )
    assert (merged.state, merged.state_from_record) == ("pass", False)
    assert (merged.token_count, merged.count_from_record) == (12, True)
    assert merged.source == "manual"


# ── Fixtures for the database-backed tests ────────────────────────────────────


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="pm_owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_username="pm_lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="pm_member")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, lead: User, member: User):
    g = await create_static_group(session, owner, name="Merge Static")
    await create_membership(session, lead, g, role="lead")
    await create_membership(session, member, g, role="member")
    return g


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def _goal(session, group, owner, catalog=None):
    goal = await create_collection_goal(session, group, owner, title=f"Goal {uuid.uuid4().hex[:6]}")
    if catalog is not None:
        goal.catalog_item_id = catalog.id
        await session.flush()
    return goal


async def _row(
    session, goal, user, *, state="want", source="manual", writer=None,
    state_changed_at=None, token_count=None, token_count_updated_at=None,
):
    stored = await create_participant_state(session, goal, user, state=state)
    stored.source = source
    stored.updated_by_user_id = writer
    stored.updated_via = "web" if writer else None
    stored.state_changed_at = state_changed_at
    stored.token_count = token_count
    stored.token_count_updated_at = token_count_updated_at
    await session.flush()
    return stored


def _record(
    session, profile, character, catalog, *, ownership="have", token_count=None,
    source="plugin", state_changed_at=ts(5), token_count_updated_at=None,
) -> PlayerCollectionSnapshot:
    rec = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=character.id if character is not None else None,
        catalog_item_id=catalog.id,
        ownership_state=ownership,
        token_count=token_count,
        source=source,
        confidence="high",
        updated_at=ts(5),
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )
    session.add(rec)
    return rec


async def _participants(client, group, goal, reader) -> list[dict]:
    resp = await client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants",
        headers=_headers(reader),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _participant(client, group, goal, user, reader) -> dict:
    rows = await _participants(client, group, goal, reader)
    return next(p for p in rows if p["user_id"] == user.id)


async def _goals(client, group, reader) -> list[dict]:
    resp = await client.get(
        f"/api/static-groups/{group.id}/collection-goals", headers=_headers(reader)
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _is_select(sql: str) -> bool:
    return sql.lstrip().upper().startswith("SELECT")


# ── write_row (R-S1-7): the row's door, built here and routed by C2/C3 ────────


class TestWriteRow:
    async def test_create_sets_what_it_is_given_and_stamps(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        done = await write_row(
            session, row=None, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10),
            state="need", token_count=4, priority_rank=2, notes="hi", source="manual",
            last_manual_override_at=ts(10),
        )
        assert isinstance(done, RowWrite)
        assert (done.prior_state, done.state_changed, done.count_changed) == (None, True, True)
        stored = done.row
        assert (stored.goal_id, stored.static_group_id, stored.user_id) == (
            goal.id, group.id, member.id,
        )
        assert (stored.state, stored.token_count, stored.priority_rank, stored.notes) == (
            "need", 4, 2, "hi",
        )
        assert (stored.source, stored.last_manual_override_at, stored.last_synced_at) == (
            "manual", ts(10), None,
        )
        assert (stored.updated_at, stored.updated_by_user_id, stored.updated_via) == (
            ts(10), member.id, "web",
        )
        assert (stored.state_changed_at, stored.token_count_updated_at) == (ts(10), ts(10))
        assert stored.id

    async def test_create_without_a_state_or_count_takes_the_defaults_and_dates_the_state(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        done = await write_row(
            session, row=None, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10),
        )
        assert (done.row.state, done.row.source, done.row.token_count) == ("want", "manual", None)
        assert (done.row.state_changed_at, done.row.token_count_updated_at) == (ts(10), None)
        assert (done.state_changed, done.count_changed) == (True, False)

    async def test_update_sets_only_what_it_is_given(self, session, group, owner, lead, member):
        goal = await _goal(session, group, owner)
        stored = await _row(
            session, goal, member, state="want", writer=member.id, state_changed_at=ts(1),
            token_count=3, token_count_updated_at=ts(1),
        )
        stored.priority_rank = 1
        stored.notes = "keep"
        stored.last_synced_at = ts(0)
        await session.flush()

        done = await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=lead.id, via="api_key", now=ts(10), state="have",
        )
        assert done.row is stored
        assert (done.prior_state, done.state_changed, done.count_changed) == ("want", True, False)
        assert (stored.state, stored.state_changed_at) == ("have", ts(10))
        assert (stored.token_count, stored.token_count_updated_at) == (3, ts(1))
        assert (stored.priority_rank, stored.notes, stored.last_synced_at, stored.source) == (
            1, "keep", ts(0), "manual",
        )
        assert (stored.updated_at, stored.updated_by_user_id, stored.updated_via) == (
            ts(10), lead.id, "api_key",
        )

    async def test_the_same_state_does_not_move_state_changed_at(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        stored = await _row(
            session, goal, member, state="want", writer=member.id, state_changed_at=ts(1)
        )
        done = await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10), state="want", notes="n",
        )
        assert (done.state_changed, stored.state_changed_at, stored.updated_at) == (
            False, ts(1), ts(10),
        )
        assert stored.notes == "n"

    async def test_a_given_count_dates_the_count_even_when_unchanged(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member, token_count=3, token_count_updated_at=ts(1))
        done = await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="plugin", now=ts(10), token_count=3, source="plugin",
            last_synced_at=ts(10),
        )
        assert (done.count_changed, stored.token_count, stored.token_count_updated_at) == (
            False, 3, ts(10),
        )
        assert (stored.source, stored.last_synced_at) == ("plugin", ts(10))
        assert done.state_changed is False

    async def test_a_changed_count_reports_it(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member, token_count=3, token_count_updated_at=ts(1))
        done = await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10), token_count=5,
        )
        assert (done.count_changed, stored.token_count, stored.token_count_updated_at) == (
            True, 5, ts(10),
        )

    async def test_a_none_count_is_set_without_dating_it(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member, token_count=3, token_count_updated_at=ts(1))
        done = await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10), token_count=None,
        )
        assert (stored.token_count, stored.token_count_updated_at) == (None, ts(1))
        assert done.count_changed is True

    async def test_a_derived_write_records_the_channel_and_no_writer(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        done = await write_row(
            session, row=None, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=None, via="web", now=ts(10), state="have", source="player_hub",
        )
        assert (done.row.updated_by_user_id, done.row.updated_via) == (None, "web")
        assert (done.row.state, done.row.source) == ("have", "player_hub")

    async def test_unset_is_not_none(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member, token_count=3, token_count_updated_at=ts(1))
        stored.notes = "keep"
        await write_row(
            session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=ts(10), token_count=UNSET, notes=UNSET,
        )
        assert (stored.token_count, stored.notes) == (3, "keep")

    @pytest.mark.parametrize("bad", [{"state": "owned"}, {"source": "lodestone"}, {"source": None}])
    async def test_refuses_values_outside_the_vocabulary(self, session, group, owner, member, bad):
        goal = await _goal(session, group, owner)
        with pytest.raises(ValueError):
            await write_row(
                session, row=None, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
                actor_user_id=member.id, via="web", now=ts(10), **bad,
            )

    async def test_refuses_a_row_that_is_not_the_named_one(
        self, session, group, owner, lead, member
    ):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member)
        with pytest.raises(ValueError):
            await write_row(
                session, row=stored, goal_id=goal.id, static_group_id=group.id, user_id=lead.id,
                actor_user_id=lead.id, via="web", now=ts(10), state="have",
            )


# ── merged_participants: batched over rows of several goals ──────────────────


class TestMergedParticipants:
    async def test_no_rows_means_no_select(self, session, engine, group, count_statements):
        with count_statements(engine, match=_is_select) as counts:
            assert await merged_participants(
                session, static_group_id=group.id, rows=[], catalog_item_by_goal={}
            ) == {}
        assert counts.n == 0

    async def test_a_goal_without_a_catalog_item_reads_the_rows_as_stored_without_a_select(
        self, session, engine, group, owner, member, count_statements
    ):
        goal = await _goal(session, group, owner)
        stored = await _row(session, goal, member, state="need", token_count=2)
        await session.flush()
        with count_statements(engine, match=_is_select) as counts:
            merged = await merged_participants(
                session, static_group_id=group.id, rows=[stored],
                catalog_item_by_goal={goal.id: None},
            )
        assert counts.n == 0
        assert merged[stored.id] == MergedParticipant("need", 2, "manual", False, False, None)

    async def test_rows_of_several_goals_resolve_in_a_fixed_number_of_selects(
        self, session, engine, group, owner, lead, member, count_statements
    ):
        tier = await create_tier_snapshot(session, group)
        profiles = {}
        for user in (owner, lead, member):
            profile = await create_player_profile(session, user)
            main = await create_player_character(
                session, profile, name=f"Main {user.discord_username}"
            )
            await create_claimed_card(session, group, user, main, tier=tier)
            profiles[user.id] = (profile, main)
        catalogs = [await create_catalog_item(session, name=f"Item {i}") for i in range(3)]
        goals = [await _goal(session, group, owner, catalog) for catalog in catalogs]
        rows = []
        for goal, catalog in zip(goals, catalogs, strict=True):
            for user in (owner, lead, member):
                rows.append(await _row(session, goal, user, state="want"))
                profile, main = profiles[user.id]
                _record(session, profile, main, catalog, ownership="have")
        await session.flush()

        with count_statements(engine, match=_is_select) as one:
            first = await merged_participants(
                session, static_group_id=group.id, rows=rows[:1],
                catalog_item_by_goal={g.id: g.catalog_item_id for g in goals},
            )
        with count_statements(engine, match=_is_select) as nine:
            every = await merged_participants(
                session, static_group_id=group.id, rows=rows,
                catalog_item_by_goal={g.id: g.catalog_item_id for g in goals},
            )
        assert len(first) == 1 and len(every) == 9
        assert {m.state for m in every.values()} == {"have"}
        assert {m.state_from_record for m in every.values()} == {True}
        assert 1 <= one.n <= 6
        assert nine.n == one.n


# ── Routes: list_participants, the summaries, the PATCH responses ────────────


class TestRoutes:
    async def test_a_record_have_shows_in_every_static_carded_to_that_character_not_the_alts(
        self, async_client: AsyncClient, session, owner, member
    ):
        profile = await create_player_profile(session, member)
        main = await create_player_character(session, profile, name="Merge Main", is_main=True)
        alt = await create_player_character(session, profile, name="Merge Alt", is_main=False)
        catalog = await create_catalog_item(session, name="Shared Mount")
        statics = {}
        for name, character in (("A", main), ("B", main), ("C", alt)):
            static = await create_static_group(session, owner, name=f"Static {name}")
            await create_membership(session, member, static, role="member")
            await create_claimed_card(session, static, member, character)
            goal = await _goal(session, static, owner, catalog)
            await _row(session, goal, member, state="want", source="manual")
            statics[name] = (static, goal)
        _record(session, profile, main, catalog, ownership="have", state_changed_at=ts(5))
        _record(session, profile, alt, catalog, ownership="missing", state_changed_at=ts(5))
        await session.commit()

        for name in ("A", "B"):
            static, goal = statics[name]
            seen = await _participant(async_client, static, goal, member, owner)
            assert (seen["state"], seen["source"], seen["state_from_record"]) == (
                "have", "plugin", True,
            ), name
            assert seen["record"]["character_id"] == main.id
            assert seen["record"]["ownership_state"] == "have"

        static, goal = statics["C"]
        seen = await _participant(async_client, static, goal, member, owner)
        assert (seen["state"], seen["source"], seen["state_from_record"]) == (
            "want", "manual", False,
        )
        assert seen["record"]["character_id"] == alt.id
        assert seen["record"]["ownership_state"] == "missing"

    async def test_the_goal_lists_summary_counts_match_the_panel(
        self, async_client: AsyncClient, session, group, owner, lead, member
    ):
        catalog = await create_catalog_item(session, name="Summary Mount")
        goal = await _goal(session, group, owner, catalog)
        tier = await create_tier_snapshot(session, group)
        for user, state in ((owner, "need"), (lead, "want"), (member, "want")):
            profile = await create_player_profile(session, user)
            main = await create_player_character(
                session, profile, name=f"S {user.discord_username}"
            )
            await create_claimed_card(session, group, user, main, tier=tier)
            await _row(session, goal, user, state=state, source="manual")
            if user is member:
                _record(session, profile, main, catalog, ownership="have", state_changed_at=ts(5))
        await session.commit()

        panel = await _participants(async_client, group, goal, owner)
        states = sorted(p["state"] for p in panel)
        assert states == ["have", "need", "want"]

        listed = next(g for g in await _goals(async_client, group, owner) if g["id"] == goal.id)
        summary = listed["participant_summary"]
        assert summary == {"need": 1, "want": 1, "have": 1, "passing": 0, "total": 3}

        resp = await async_client.put(
            f"/api/static-groups/{group.id}/collection-goals/{goal.id}",
            json={"note": "still the same"},
            headers=_headers(owner),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["participant_summary"] == summary

    async def test_a_seeded_player_hub_pass_keeps_over_a_newer_record_have(
        self, async_client: AsyncClient, session, group, owner, member
    ):
        """Case 1, the declared V1 change (vet I-3): a Pass no lead set is kept."""
        profile = await create_player_profile(session, member)
        main = await create_player_character(session, profile, name="Pass Main")
        await create_claimed_card(session, group, member, main)
        catalog = await create_catalog_item(session, name="Passed Mount")
        goal = await _goal(session, group, owner, catalog)
        await _row(
            session, goal, member, state="pass", source="player_hub", writer=None,
            state_changed_at=None,
        )
        _record(session, profile, main, catalog, ownership="have", state_changed_at=ts(5))
        await session.commit()

        seen = await _participant(async_client, group, goal, member, owner)
        assert (seen["state"], seen["source"], seen["state_from_record"]) == (
            "pass", "player_hub", False,
        )
        assert seen["record"]["ownership_state"] == "have"
        listed = next(g for g in await _goals(async_client, group, owner) if g["id"] == goal.id)
        assert listed["participant_summary"]["passing"] == 1
        assert listed["participant_summary"]["have"] == 0

    async def test_a_leads_pass_yields_to_a_newer_record_have(
        self, async_client: AsyncClient, session, group, owner, lead, member
    ):
        profile = await create_player_profile(session, member)
        main = await create_player_character(session, profile, name="Lead Pass Main")
        await create_claimed_card(session, group, member, main)
        catalog = await create_catalog_item(session, name="Lead Passed Mount")
        goal = await _goal(session, group, owner, catalog)
        await _row(
            session, goal, member, state="pass", source="manual", writer=lead.id,
            state_changed_at=ts(1),
        )
        _record(session, profile, main, catalog, ownership="have", state_changed_at=ts(5))
        await session.commit()

        seen = await _participant(async_client, group, goal, member, owner)
        assert (seen["state"], seen["state_from_record"]) == ("have", True)

    async def test_response_shape_is_additive_and_source_stays_in_vocabulary(
        self, async_client: AsyncClient, session, group, owner, lead, member
    ):
        old_keys = {
            "id", "goal_id", "user_id", "static_group_id", "state", "token_count",
            "priority_rank", "source", "last_synced_at", "last_manual_override_at",
            "notes", "updated_at", "display_name", "member_role",
        }
        new_keys = {
            "updated_by_user_id", "updated_via", "state_changed_at",
            "token_count_updated_at", "state_from_record", "count_from_record", "record",
        }
        record_keys = {
            "character_id", "ownership_state", "token_count", "source", "updated_by_user_id",
            "updated_via", "state_changed_at", "token_count_updated_at", "last_synced_at",
        }
        profile = await create_player_profile(session, member)
        main = await create_player_character(session, profile, name="Shape Main")
        await create_claimed_card(session, group, member, main)
        catalog = await create_catalog_item(session, name="Shape Mount")
        with_item = await _goal(session, group, owner, catalog)
        plain = await _goal(session, group, owner)
        await _row(
            session, with_item, member, state="want", writer=member.id, state_changed_at=ts(1),
            token_count=None,
        )
        await _row(session, with_item, lead, state="need", writer=None)
        await _row(session, plain, member, state="have", writer=lead.id, state_changed_at=ts(1))
        _record(session, profile, main, catalog, ownership="have", token_count=9,
                state_changed_at=ts(5), token_count_updated_at=ts(5))
        await session.commit()

        for goal in (with_item, plain):
            for seen in await _participants(async_client, group, goal, owner):
                assert old_keys <= seen.keys()
                assert new_keys <= seen.keys()
                assert seen["source"] in PARTICIPANT_SOURCES
                assert isinstance(seen["state_from_record"], bool)
                assert isinstance(seen["count_from_record"], bool)

        merged = await _participant(async_client, group, with_item, member, owner)
        assert (merged["state"], merged["token_count"], merged["source"]) == ("have", 9, "plugin")
        assert (merged["state_from_record"], merged["count_from_record"]) == (True, True)
        assert (merged["updated_by_user_id"], merged["updated_via"]) == (member.id, "web")
        assert merged["state_changed_at"] == ts(1)
        assert merged["record"].keys() == record_keys
        assert merged["record"]["token_count"] == 9

        unmerged = await _participant(async_client, group, with_item, lead, owner)
        assert (unmerged["state"], unmerged["record"]) == ("need", None)
        assert (unmerged["state_from_record"], unmerged["count_from_record"]) == (False, False)

        stored = await _participant(async_client, group, plain, member, owner)
        assert (stored["state"], stored["record"], stored["updated_by_user_id"]) == (
            "have", None, lead.id,
        )

    async def test_both_patch_responses_carry_the_merge(
        self, async_client: AsyncClient, session, group, owner, member
    ):
        """A token-only record (no state date) lends its count; the state stays the row's."""
        profile = await create_player_profile(session, member)
        main = await create_player_character(session, profile, name="Patch Main")
        await create_claimed_card(session, group, member, main)
        catalog = await create_catalog_item(session, name="Patch Mount")
        goal = await _goal(session, group, owner, catalog)
        _record(session, profile, main, catalog, ownership="unknown", token_count=12,
                state_changed_at=None, token_count_updated_at=ts(5))
        await session.commit()

        base = f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants"
        own = await async_client.patch(base, json={"state": "want"}, headers=_headers(member))
        assert own.status_code == 200, own.text
        assert (own.json()["state"], own.json()["token_count"]) == ("want", 12)
        assert (own.json()["state_from_record"], own.json()["count_from_record"]) == (False, True)
        assert own.json()["record"]["ownership_state"] == "unknown"

        for_member = await async_client.patch(
            f"{base}/{member.id}", json={"state": "need"}, headers=_headers(owner)
        )
        assert for_member.status_code == 200, for_member.text
        assert (for_member.json()["state"], for_member.json()["token_count"]) == ("need", 12)
        assert for_member.json()["count_from_record"] is True
        assert for_member.json()["source"] in PARTICIPANT_SOURCES


# ── Budget (R-S1-5): members and goals add no SELECT ─────────────────────────


async def _static_of(session, *, members: int, goals: int, tag: str):
    """A static of `members` carded members, `goals` catalog goals, a row and a record each."""
    users = [await create_user(session, discord_username=f"{tag}{i}") for i in range(members)]
    static = await create_static_group(session, users[0], name=tag)
    tier = await create_tier_snapshot(session, static)
    characters = {}
    for index, user in enumerate(users):
        if index:
            await create_membership(session, user, static, role="member")
        profile = await create_player_profile(session, user)
        main = await create_player_character(session, profile, name=f"{tag} Main {index}")
        await create_claimed_card(session, static, user, main, tier=tier)
        characters[user.id] = (profile, main)
    made = []
    for g in range(goals):
        catalog = await create_catalog_item(session, name=f"{tag} Item {g}")
        goal = await _goal(session, static, users[0], catalog)
        for user in users:
            await _row(session, goal, user, state="want")
            profile, main = characters[user.id]
            _record(session, profile, main, catalog, ownership="have", state_changed_at=ts(5))
        made.append(goal)
    await session.flush()
    return static, users[0], made


async def test_list_participants_issues_the_same_selects_for_one_and_six_members(
    async_client: AsyncClient, session, engine, count_statements
):
    solo, solo_owner, (solo_goal,) = await _static_of(session, members=1, goals=1, tag="solo")
    sextet, sextet_owner, (sextet_goal,) = await _static_of(
        session, members=6, goals=1, tag="sextet"
    )
    await session.commit()

    with count_statements(engine, match=_is_select) as one:
        small = await _participants(async_client, solo, solo_goal, solo_owner)
    with count_statements(engine, match=_is_select) as six:
        large = await _participants(async_client, sextet, sextet_goal, sextet_owner)

    assert len(small) == 1 and len(large) == 6
    assert {p["state"] for p in large} == {"have"}
    assert one.n > 0
    assert six.n == one.n


async def test_list_goals_issues_the_same_selects_for_one_and_six_members_and_one_and_three_goals(
    async_client: AsyncClient, session, engine, count_statements
):
    solo, solo_owner, _ = await _static_of(session, members=1, goals=1, tag="g-solo")
    trio, trio_owner, _ = await _static_of(session, members=1, goals=3, tag="g-trio")
    sextet, sextet_owner, _ = await _static_of(session, members=6, goals=3, tag="g-sextet")
    await session.commit()

    with count_statements(engine, match=_is_select) as one:
        small = await _goals(async_client, solo, solo_owner)
    with count_statements(engine, match=_is_select) as three:
        middle = await _goals(async_client, trio, trio_owner)
    with count_statements(engine, match=_is_select) as eighteen:
        large = await _goals(async_client, sextet, sextet_owner)

    assert [len(small), len(middle), len(large)] == [1, 3, 3]
    all_have = {"need": 0, "want": 0, "have": 6, "passing": 0, "total": 6}
    assert all(g["participant_summary"] == all_have for g in large)
    assert one.n > 0
    assert three.n == one.n
    assert eighteen.n == one.n
