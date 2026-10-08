"""S2a-2·B3 TB3: the undo route puts a farm-status edit back exactly (R-S2-11, Q4, vet I-2/M-4).

`POST /api/static-groups/{group_id}/collection-participants/undo` takes the
`undo_token` a farm-status PATCH returned. The restore cases read the cell through
the Progress read before the edit and after the Undo and compare the two whole:
state, count, source, the record flags, both timestamps, rank, notes, and the
stored writer and channel of the row and of its record. Two fields are left out:
`updated_at`, which every write moves (the Undo's too), and the record's
`character_id`, because a profile-level record adopted onto a character stays
adopted (RecordPrior carries no character). The router's clock is a counter, one
minute per call and later than every stamp the setup writes, so no two writes
share an `updated_at` (Windows' clock ticks every 15.6 ms).
"""

import itertools
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import Membership, PlayerCollectionSnapshot, RewardParticipantState, User
from app.routers import collection_goals as goals_router
from app.schemas.collection_goals import UNDO_TOKEN_MAX_LENGTH, UndoRequest
from app.services.participant_undo import UNDO_TTL_SECONDS, RowPrior, UndoCell, mint_undo_token
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_collection_goal,
    create_membership,
    create_participant_state,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_user,
)

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)
ROUTER_CLOCK = datetime(2026, 3, 1, tzinfo=timezone.utc)
ZODIARK_TRIAL = "ew-zodiark"  # the mount-farm sync's curated trial: totem item 36810


def ts(minutes: int) -> str:
    return (BASE + timedelta(minutes=minutes)).isoformat()


@pytest.fixture(autouse=True)
def router_clock(monkeypatch):
    """The router's `now`: a minute later on every call, after every setup stamp."""
    ticks = itertools.count(1)
    monkeypatch.setattr(
        goals_router,
        "_now",
        lambda: (ROUTER_CLOCK + timedelta(minutes=next(ticks))).isoformat(),
    )


# ── Fixtures and helpers ─────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_route_owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_route_lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_route_member")


@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_route_viewer")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, lead: User, member: User, viewer: User):
    g = await create_static_group(session, owner, name="Undo Route Static")
    await create_membership(session, lead, g, role="lead")
    await create_membership(session, member, g, role="member")
    await create_membership(session, viewer, g, role="viewer")
    return g


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _undo_url(group) -> str:
    return f"/api/static-groups/{group.id}/collection-participants/undo"


async def _goal(session, group, owner, item=None):
    goal = await create_collection_goal(session, group, owner, title=f"Goal {uuid.uuid4().hex[:6]}")
    if item is not None:
        goal.catalog_item_id = item.id
        await session.flush()
    return goal


async def _carded(session, group, user):
    """A profile and a main for `user`, on a claimed card in `group` (the chain names it)."""
    profile = await create_player_profile(session, user)
    main = await create_player_character(session, profile, name=f"{user.discord_username} Main")
    await create_claimed_card(session, group, user, main)
    return profile, main


async def _record(
    session, profile, main, item, *, ownership, token_count=None, source="plugin", writer=None,
    via="api_key", state_changed_at=ts(5), token_count_updated_at=None,
) -> PlayerCollectionSnapshot:
    record = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=main.id,
        catalog_item_id=item.id,
        ownership_state=ownership,
        token_count=token_count,
        source=source,
        confidence="high",
        updated_at=ts(5),
        updated_by_user_id=writer,
        updated_via=via,
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )
    session.add(record)
    await session.flush()
    return record


async def _row(
    session, goal, user, *, state, writer, via, source="manual", token_count=None,
    token_count_updated_at=None, state_changed_at=ts(2), priority_rank=None, notes=None,
) -> RewardParticipantState:
    row = await create_participant_state(session, goal, user, state=state)
    row.source = source
    row.token_count = token_count
    row.token_count_updated_at = token_count_updated_at
    row.state_changed_at = state_changed_at
    row.priority_rank = priority_rank
    row.notes = notes
    row.last_manual_override_at = ts(2)
    row.updated_at = ts(3)
    row.updated_by_user_id = writer
    row.updated_via = via
    await session.flush()
    return row


async def _stored_row(session, goal, user) -> RewardParticipantState | None:
    result = await session.execute(
        select(RewardParticipantState)
        .where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user.id,
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _records(session) -> list[PlayerCollectionSnapshot]:
    result = await session.execute(
        select(PlayerCollectionSnapshot).execution_options(populate_existing=True)
    )
    return list(result.scalars())


def _columns(obj, *, but=("updated_at",)) -> dict:
    """Every stored column of a row or record, but the ones named."""
    return {
        attr.key: getattr(obj, attr.key)
        for attr in inspect(obj).mapper.column_attrs
        if attr.key not in but
    }


async def _cell(client: AsyncClient, group, goal, user, *, as_: User) -> dict | None:
    """`user`'s cell on `goal` as the Progress read shows it to `as_`, without the two
    fields an Undo does not return (module docstring); None for a blank cell."""
    resp = await client.get(
        f"/api/static-groups/{group.id}/collection-participants",
        params={"goal_id": goal.id},
        headers=_headers(as_),
    )
    assert resp.status_code == 200, resp.text
    (entry,) = resp.json()
    found = [c for c in entry["participants"] + entry["record_only"] if c["user_id"] == user.id]
    if not found:
        return None
    (cell,) = found
    cell = {k: v for k, v in cell.items() if k != "updated_at"}
    if cell.get("record") is not None:
        cell["record"] = {k: v for k, v in cell["record"].items() if k != "character_id"}
    return cell


async def _patch(client: AsyncClient, group, goal, body: dict, as_: User, target=None) -> str:
    """A farm-status PATCH (the lead route when `target` is given); returns its undo token."""
    url = f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants"
    if target is not None:
        url = f"{url}/{target.id}"
    resp = await client.patch(url, json=body, headers=_headers(as_))
    assert resp.status_code == 200, resp.text
    token = resp.json()["undo_token"]
    assert isinstance(token, str) and token
    return token


async def _undo(client: AsyncClient, group, token: str, as_: User):
    return await client.post(_undo_url(group), json={"token": token}, headers=_headers(as_))


async def _undone(client: AsyncClient, group, token: str, as_: User) -> dict:
    resp = await _undo(client, group, token, as_)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── Each restore gives back the cell the static saw before the edit ──────────


class TestRestores:
    async def test_blank_to_need_then_undo_deletes_the_row(
        self, client, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        await session.commit()
        assert await _cell(client, group, goal, member, as_=owner) is None

        token = await _patch(client, group, goal, {"state": "need"}, member)
        assert (await _cell(client, group, goal, member, as_=owner))["state"] == "need"

        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 0}
        assert await _cell(client, group, goal, member, as_=owner) is None
        assert await _stored_row(session, goal, member) is None

    async def test_want_to_have_then_undo_restores_the_row_and_deletes_the_record_it_made(
        self, client, session, group, owner, member
    ):
        await _carded(session, group, member)
        item = await create_catalog_item(session, name="Created Record Mount")
        goal = await _goal(session, group, owner, item)
        # Written by no one the undo names: the restore can't pass for the undoer's write.
        row = await _row(session, goal, member, state="want", writer=None, via="api_key")
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        row_before = _columns(row)
        assert (before["state"], before["record"]) == ("want", None)

        token = await _patch(client, group, goal, {"state": "have"}, member)
        (created,) = await _records(session)
        assert created.ownership_state == "have"

        assert await _undone(client, group, token, member) == {"restored": 2, "skipped": 0}
        assert await _cell(client, group, goal, member, as_=owner) == before
        assert _columns(await _stored_row(session, goal, member)) == row_before
        assert await _records(session) == []

    async def test_need_over_a_newer_record_have_then_undo_reads_have_here_and_elsewhere(
        self, client, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Unhave Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="want", writer=member.id, via="web")
        record = await _record(
            session, profile, main, item, ownership="have", writer=member.id, via="api_key"
        )
        other = await create_static_group(session, owner, name="Elsewhere Static")
        await create_membership(session, member, other, role="member")
        other_goal = await _goal(session, other, owner, item)
        await _row(
            session, other_goal, member, state="have", writer=None, via=None, source="plugin",
            state_changed_at=ts(1),
        )
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        elsewhere_before = await _cell(client, other, other_goal, member, as_=owner)
        record_before = _columns(record)
        assert (before["state"], before["state_from_record"]) == ("have", True)
        assert elsewhere_before["state"] == "have"

        token = await _patch(client, group, goal, {"state": "need"}, member)
        assert (await _cell(client, other, other_goal, member, as_=owner))["state"] == "want"

        assert await _undone(client, group, token, member) == {"restored": 2, "skipped": 0}
        (stored,) = await _records(session)
        assert (stored.ownership_state, stored.state_changed_at) == ("have", ts(5))
        assert _columns(stored) == record_before  # source, confidence and writer too
        assert await _cell(client, group, goal, member, as_=owner) == before
        assert await _cell(client, other, other_goal, member, as_=owner) == elsewhere_before

    @pytest.mark.parametrize(
        ("prior", "prior_at"), [(30, ts(6)), (None, None)], ids=["count-30", "count-null"]
    )
    async def test_a_count_edit_then_undo_restores_the_records_count_and_its_stamp(
        self, client, session, group, owner, member, prior, prior_at
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Count Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="want", writer=member.id, via="web")
        await _record(
            session, profile, main, item, ownership="missing", token_count=prior,
            token_count_updated_at=prior_at, writer=member.id, via="api_key",  # a plugin sync's
        )
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        assert before["token_count"] == prior

        token = await _patch(client, group, goal, {"state": "want", "token_count": 40}, member)
        assert (await _cell(client, group, goal, member, as_=owner))["token_count"] == 40

        assert await _undone(client, group, token, member) == {"restored": 2, "skipped": 0}
        (stored,) = await _records(session)
        assert (stored.token_count, stored.token_count_updated_at) == (prior, prior_at)
        assert await _cell(client, group, goal, member, as_=owner) == before

    async def test_a_leads_correction_then_undo_restores_that_row_alone(
        self, client, session, group, owner, lead, member
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Corrected Mount")
        goal = await _goal(session, group, owner, item)
        row = await _row(
            session, goal, member, state="want", writer=member.id, via="web", token_count=3,
            token_count_updated_at=ts(2), priority_rank=1, notes="own note",
        )
        record = await _record(
            session, profile, main, item, ownership="have", token_count=7,
            token_count_updated_at=ts(4), state_changed_at=ts(1),
        )
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        row_before = _columns(row)
        record_before = _columns(record, but=())

        body = {"state": "need", "token_count": 9, "priority_rank": 2, "notes": "lead's note"}
        token = await _patch(client, group, goal, body, lead, target=member)
        edited = await _cell(client, group, goal, member, as_=owner)
        assert (edited["state"], edited["priority_rank"], edited["notes"]) == (
            "need", 2, "lead's note",
        )
        assert (await _stored_row(session, goal, member)).token_count == 9

        assert await _undone(client, group, token, lead) == {"restored": 1, "skipped": 0}
        assert await _cell(client, group, goal, member, as_=owner) == before
        # The merge shows the record's newer 7 either way: the row's own count is read back.
        assert _columns(await _stored_row(session, goal, member)) == row_before
        (stored,) = await _records(session)
        assert _columns(stored, but=()) == record_before  # untouched, `updated_at` included

    @pytest.mark.parametrize(
        ("prior", "prior_at"), [(5, ts(2)), (None, None)], ids=["count-5", "count-null"]
    )
    async def test_a_count_edit_on_a_goal_without_an_item_then_undo_restores_the_rows_count(
        self, client, session, group, owner, member, prior, prior_at
    ):
        """No catalog item, no record: `_write_own_state` puts the member's count on the row."""
        await _carded(session, group, member)
        goal = await _goal(session, group, owner)
        row = await _row(
            session, goal, member, state="want", writer=member.id, via="api_key",
            token_count=prior, token_count_updated_at=prior_at,
        )
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        row_before = _columns(row)
        assert (before["token_count"], before["count_from_record"]) == (prior, False)

        token = await _patch(client, group, goal, {"state": "want", "token_count": 12}, member)
        assert (await _stored_row(session, goal, member)).token_count == 12

        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 0}
        stored = await _stored_row(session, goal, member)
        assert (stored.token_count, stored.token_count_updated_at) == (prior, prior_at)
        assert _columns(stored) == row_before
        assert await _cell(client, group, goal, member, as_=owner) == before
        assert await _records(session) == []

    async def test_flip_rule_1_a_leads_undo_gives_the_member_their_own_pass_back(
        self, client, session, group, owner, lead, member
    ):
        """vet I-2: restored with the member as writer, the Pass is theirs again, so a
        newer record Have still leaves it Pass, as it did before the edit."""
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Pass Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="pass", writer=member.id, via="web")
        await _record(session, profile, main, item, ownership="have", state_changed_at=ts(5))
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        assert (before["state"], before["state_from_record"]) == ("pass", False)

        token = await _patch(client, group, goal, {"state": "need"}, lead, target=member)
        assert (await _cell(client, group, goal, member, as_=owner))["state"] == "need"

        assert await _undone(client, group, token, lead) == {"restored": 1, "skipped": 0}
        after = await _cell(client, group, goal, member, as_=owner)
        assert after == before
        assert (after["state"], after["updated_by_user_id"]) == ("pass", member.id)

    async def test_flip_rule_3_a_leads_undo_gives_the_member_their_own_have_back(
        self, client, session, group, owner, lead, member
    ):
        """vet I-2: the member's own Have is theirs again, so a newer record `missing`
        still turns it to Want, as it did before the edit."""
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Have Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="have", writer=member.id, via="web")
        await _record(session, profile, main, item, ownership="missing", state_changed_at=ts(5))
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)
        assert (before["state"], before["state_from_record"]) == ("want", True)

        token = await _patch(client, group, goal, {"state": "want"}, lead, target=member)
        assert (await _cell(client, group, goal, member, as_=owner))["state_from_record"] is False

        assert await _undone(client, group, token, lead) == {"restored": 1, "skipped": 0}
        assert await _cell(client, group, goal, member, as_=owner) == before
        stored = await _stored_row(session, goal, member)
        assert (stored.state, stored.updated_by_user_id) == ("have", member.id)

    async def test_label_a_row_the_plugin_wrote_reads_as_the_plugins_again(
        self, client, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        await _row(
            session, goal, member, state="have", source="plugin", writer=member.id, via="api_key"
        )
        await session.commit()
        before = await _cell(client, group, goal, member, as_=owner)

        token = await _patch(client, group, goal, {"state": "need"}, member)
        edited = await _cell(client, group, goal, member, as_=owner)
        assert (edited["updated_via"], edited["source"]) == ("web", "manual")

        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 0}
        after = await _cell(client, group, goal, member, as_=owner)
        assert after == before
        assert (after["updated_via"], after["source"]) == ("api_key", "plugin")


# ── A part a later write changed is skipped and counted ──────────────────────


class TestChangedSince:
    async def test_a_second_patch_keeps_its_row_and_the_record_is_restored(
        self, client, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Second Patch Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="want", writer=member.id, via="web")
        record = await _record(
            session, profile, main, item, ownership="have", writer=member.id, via="api_key"
        )
        await session.commit()
        record_before = _columns(record)

        token = await _patch(client, group, goal, {"state": "need"}, member)
        await _patch(client, group, goal, {"state": "want"}, member)  # the row alone moves
        row_after_second = _columns(await _stored_row(session, goal, member), but=())

        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 1}
        assert _columns(await _stored_row(session, goal, member), but=()) == row_after_second
        (stored,) = await _records(session)
        assert _columns(stored) == record_before

    async def test_a_plugin_token_sync_keeps_its_record_and_the_row_is_restored(
        self, client, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Zodiark Mount")
        item.source_duty_key = ZODIARK_TRIAL
        item.is_active = True
        goal = await _goal(session, group, owner, item)
        row = await _row(session, goal, member, state="want", writer=member.id, via="web")
        await _record(
            session, profile, main, item, ownership="missing", token_count=30,
            token_count_updated_at=ts(6), source="manual", writer=member.id, via="web",
        )
        await session.commit()
        row_before = _columns(row)

        token = await _patch(client, group, goal, {"state": "want", "token_count": 40}, member)
        sync = await client.post(
            "/api/plugin/mount-farms/sync",
            json={"totems": [{"itemId": 36810, "count": 41}]},
            headers=_headers(member),
        )
        assert sync.status_code == 200, sync.text
        (synced,) = await _records(session)
        assert synced.token_count == 41
        record_after_sync = _columns(synced, but=())

        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 1}
        (stored,) = await _records(session)
        assert _columns(stored, but=()) == record_after_sync
        assert _columns(await _stored_row(session, goal, member)) == row_before

    async def test_the_same_token_twice_restores_once(
        self, client, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        item = await create_catalog_item(session, name="Twice Mount")
        goal = await _goal(session, group, owner, item)
        await _row(session, goal, member, state="want", writer=member.id, via="web")
        await _record(session, profile, main, item, ownership="have")
        await session.commit()

        token = await _patch(client, group, goal, {"state": "need"}, member)
        assert await _undone(client, group, token, member) == {"restored": 2, "skipped": 0}
        once = await _cell(client, group, goal, member, as_=owner)

        assert await _undone(client, group, token, member) == {"restored": 0, "skipped": 2}
        assert await _cell(client, group, goal, member, as_=owner) == once

    async def test_the_same_token_twice_deletes_what_the_edit_made_once(
        self, client, session, group, owner, member
    ):
        await _carded(session, group, member)
        item = await create_catalog_item(session, name="Made Twice Mount")
        goal = await _goal(session, group, owner, item)
        await session.commit()

        token = await _patch(client, group, goal, {"state": "have"}, member)
        assert await _undone(client, group, token, member) == {"restored": 2, "skipped": 0}
        assert await _undone(client, group, token, member) == {"restored": 0, "skipped": 2}
        assert await _stored_row(session, goal, member) is None
        assert await _records(session) == []


# ── The order of the checks (vet M-4) ────────────────────────────────────────


def _restorable(group, goal, row, *, actor: User, now: float | None = None) -> str:
    """A token that would turn `row` into a Pass if the route accepted it."""
    prior = RowPrior(
        state="pass", token_count=None, source="manual", state_changed_at=None,
        token_count_updated_at=None, updated_by_user_id=None, updated_via=None,
        last_manual_override_at=None, priority_rank=None, notes=None,
    )
    cell = UndoCell(
        goal_id=goal.id, user_id=row.user_id, row_prior=prior, row_updated_at=row.updated_at
    )
    return mint_undo_token(group_id=group.id, actor_user_id=actor.id, cells=[cell], now=now)


class TestChecks:
    @pytest.mark.parametrize("which", ["garbage", "their own"])
    async def test_a_viewer_is_refused_before_the_token_is_read(
        self, client, session, group, owner, viewer, which
    ):
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, viewer, state="want", writer=viewer.id, via="web")
        await session.commit()
        token = "not-a-token" if which == "garbage" else _restorable(group, goal, row, actor=viewer)

        resp = await _undo(client, group, token, viewer)
        assert resp.status_code == 403, resp.text
        assert (await _stored_row(session, goal, viewer)).state == "want"

    @pytest.mark.parametrize(
        "which", ["another member's", "another static's", "expired", "garbage"]
    )
    async def test_a_token_that_is_not_this_callers_now_is_400_and_changes_nothing(
        self, client, session, group, owner, lead, member, which
    ):
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, member, state="want", writer=member.id, via="web")
        other = await create_static_group(session, owner, name="Token Elsewhere")
        await session.commit()
        expired = time.time() - UNDO_TTL_SECONDS - 60
        token = {
            "another member's": lambda: _restorable(group, goal, row, actor=lead),
            "another static's": lambda: _restorable(other, goal, row, actor=member),
            "expired": lambda: _restorable(group, goal, row, actor=member, now=expired),
            "garbage": lambda: "not-a-token",
        }[which]()

        resp = await _undo(client, group, token, member)
        assert resp.status_code == 400, resp.text
        assert (await _stored_row(session, goal, member)).state == "want"

    async def test_the_control_token_restores(self, client, session, group, owner, member):
        """The tokens refused above differ from this one in one claim each, so their 400 is
        the claim's, not a token that could never restore."""
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, member, state="want", writer=member.id, via="web")
        await session.commit()

        token = _restorable(group, goal, row, actor=member)
        assert await _undone(client, group, token, member) == {"restored": 1, "skipped": 0}
        assert (await _stored_row(session, goal, member)).state == "pass"

    async def test_a_former_lead_is_refused_their_correction_of_another_member(
        self, client, session, group, owner, lead, member
    ):
        """The caller must still hold the role the write needed: lead for another's cell."""
        goal = await _goal(session, group, owner)
        await _row(session, goal, member, state="want", writer=member.id, via="web")
        await session.commit()
        token = await _patch(client, group, goal, {"state": "need"}, lead, target=member)
        demoted = (
            await session.execute(
                select(Membership).where(
                    Membership.static_group_id == group.id, Membership.user_id == lead.id
                )
            )
        ).scalar_one()
        demoted.role = "member"
        await session.commit()

        resp = await _undo(client, group, token, lead)
        assert resp.status_code == 403, resp.text
        assert (await _stored_row(session, goal, member)).state == "need"


# ── The request cap holds a bulk Need's token (TB4: 1-200 cells) ─────────────


def test_a_two_hundred_cell_token_fits_the_request_cap_with_room():
    stamp = datetime.now(timezone.utc).isoformat()
    cells = [
        UndoCell(goal_id=str(uuid.uuid4()), user_id=str(uuid.uuid4()), row_prior=None,
                 row_updated_at=stamp)
        for _ in range(200)
    ]
    token = mint_undo_token(
        group_id=str(uuid.uuid4()), actor_user_id=str(uuid.uuid4()), cells=cells
    )
    assert 2 * len(token) < UNDO_TOKEN_MAX_LENGTH
    assert UndoRequest(token=token).token == token
    with pytest.raises(ValidationError):
        UndoRequest(token="x" * (UNDO_TOKEN_MAX_LENGTH + 1))
