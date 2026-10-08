"""S2a-2·B2 TB2: the undo token and the door's restores (R-S2-11, Q4, vet I-2, vet M-4).

Every farm-cell write returns an `undo_token`: a Fernet token (encrypted and
authenticated, ten minutes, bound to its static and its actor) that carries what
the row and the record held before the write, the prior writer and channel
included, so B3's undo route can put them back exactly. Encryption keeps a
flagged member's prior count from the lead holding the token (B1). The door
gains restore keywords that only the undo route may pass (an AST guard), and
`delete_row` / `delete_record`. B1's parked Minors land here too: the id
tiebreak in `_participant_rows` and the `count_hidden` is-required pins.
"""

import ast
import base64
import json
import uuid
from collections.abc import Iterator
from dataclasses import asdict, fields, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token, verify_token
from app.models import PlayerCollectionSnapshot, RewardParticipantState, User
from app.routers import collection_goals as goals_router
from app.schemas.collection_goals import ParticipantStateResponse, ParticipantWriteResponse
from app.services import participant_undo
from app.services.collection_records import (
    RECORD_WRITE_PERSON,
    RecordTarget,
    delete_record,
    delete_row,
    resolve_record_targets,
    write_record,
    write_row,
)
from app.services.participant_undo import (
    UNDO_TTL_SECONDS,
    RecordPrior,
    RowPrior,
    UndoCell,
    UndoClaims,
    UndoTokenInvalid,
    mint_undo_token,
    read_undo_token,
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
    create_user,
)

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)
CLOCK = 1_800_000_000  # the injected Fernet clock, seconds


def ts(minutes: int) -> str:
    return (BASE + timedelta(minutes=minutes)).isoformat()


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="undo_member")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, lead: User, member: User):
    g = await create_static_group(session, owner, name="Undo Static")
    await create_membership(session, lead, g, role="lead")
    await create_membership(session, member, g, role="member")
    return g


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _url(group, goal, target: User | None = None) -> str:
    url = f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants"
    return url if target is None else f"{url}/{target.id}"


async def _goal(session, group, owner, catalog=None):
    goal = await create_collection_goal(session, group, owner, title=f"Goal {uuid.uuid4().hex[:6]}")
    if catalog is not None:
        goal.catalog_item_id = catalog.id
        await session.flush()
    return goal


async def _carded(session, group, user, *, hidden: bool = False):
    """A profile and a main for `user`, carded in `group` so the chain names it."""
    profile = await create_player_profile(session, user)
    profile.hide_collection_counts = hidden
    main = await create_player_character(session, profile, name=f"{user.discord_username} Main")
    await create_claimed_card(session, group, user, main)
    await session.flush()
    return profile, main


def _record(
    session, profile, main, catalog, *, ownership="have", token_count=None, source="plugin",
    writer=None, via=None, state_changed_at=ts(5), token_count_updated_at=None,
) -> PlayerCollectionSnapshot:
    rec = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=main.id,
        catalog_item_id=catalog.id,
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
    session.add(rec)
    return rec


async def _row(
    session, goal, user, *, state="want", writer=None, via=None, token_count=None,
    state_changed_at=ts(2), token_count_updated_at=None, last_manual_override_at=None,
    updated_at=ts(3),
) -> RewardParticipantState:
    stored = await create_participant_state(session, goal, user, state=state)
    stored.updated_by_user_id = writer
    stored.updated_via = via
    stored.token_count = token_count
    stored.state_changed_at = state_changed_at
    stored.token_count_updated_at = token_count_updated_at
    stored.last_manual_override_at = last_manual_override_at
    stored.updated_at = updated_at
    await session.flush()
    return stored


async def _stored_row_by_ids(session, goal_id: str, user_id: str) -> RewardParticipantState | None:
    result = await session.execute(
        select(RewardParticipantState)
        .where(
            RewardParticipantState.goal_id == goal_id,
            RewardParticipantState.user_id == user_id,
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _stored_row(session, goal, user) -> RewardParticipantState | None:
    return await _stored_row_by_ids(session, goal.id, user.id)


async def _target_of(session, group, user) -> RecordTarget:
    """The record target the chain names for `user` in `group`, as the routes resolve it."""
    return (await resolve_record_targets(session, [(group.id, user.id)]))[(group.id, user.id)]


async def _records(session) -> list[PlayerCollectionSnapshot]:
    result = await session.execute(
        select(PlayerCollectionSnapshot).execution_options(populate_existing=True)
    )
    return list(result.scalars())


ROW_PRIOR = RowPrior(
    state="pass",
    token_count=30,
    source="player_hub",
    state_changed_at=ts(1),
    token_count_updated_at=ts(2),
    updated_by_user_id="user-prior-row",
    updated_via="api_key",
    last_manual_override_at=ts(3),
    priority_rank=2,
    notes="prior note",
)
RECORD_PRIOR = RecordPrior(
    ownership_state="have",
    token_count=31,
    source="plugin",
    confidence="high",
    state_changed_at=ts(4),
    token_count_updated_at=ts(5),
    updated_by_user_id="user-prior-record",
    updated_via="web",
)
CELL = UndoCell(
    goal_id="goal-1",
    user_id="user-1",
    row_prior=ROW_PRIOR,
    row_updated_at=ts(10),
    record_id="record-1",
    record_prior=RECORD_PRIOR,
    record_updated_at=ts(10),
)
CREATED_CELL = UndoCell(goal_id="goal-2", user_id="user-2", row_prior=None, row_updated_at=ts(11))


def _mint(cells=(CELL, CREATED_CELL), *, group_id="static-1", actor="actor-1", now=CLOCK) -> str:
    return mint_undo_token(group_id=group_id, actor_user_id=actor, cells=cells, now=now)


def _read(token, *, group_id="static-1", actor="actor-1", now=CLOCK) -> UndoClaims:
    return read_undo_token(token, group_id=group_id, actor_user_id=actor, now=now)


def _sealed(version: int, cell: dict) -> str:
    """A token sealed with the real key whose payload says `version` and holds `cell`."""
    payload = {"v": version, "group_id": "static-1", "actor_user_id": "actor-1", "cells": [cell]}
    data = json.dumps(payload).encode("utf-8")
    return participant_undo._fernet().encrypt_at_time(data, CLOCK).decode("ascii")


# ── The token (R-S2-11) ──────────────────────────────────────────────────────


class TestToken:
    def test_a_round_trip_keeps_every_field_the_prior_writer_and_channel_included(self):
        claims = _read(_mint())
        assert claims == UndoClaims(
            group_id="static-1", actor_user_id="actor-1", cells=(CELL, CREATED_CELL)
        )
        (cell, created) = claims.cells
        # vet I-2: the priors carry who wrote them and through which channel.
        assert (cell.row_prior.updated_by_user_id, cell.row_prior.updated_via) == (
            "user-prior-row",
            "api_key",
        )
        assert (cell.record_prior.updated_by_user_id, cell.record_prior.updated_via) == (
            "user-prior-record",
            "web",
        )
        assert cell.row_prior.last_manual_override_at == ts(3)
        assert (cell.row_prior.priority_rank, cell.row_prior.notes) == (2, "prior note")
        assert cell.record_prior.confidence == "high"
        # A created row and no record travel as None, not as a hole.
        assert (created.row_prior, created.record_id, created.record_prior) == (None, None, None)

    def test_a_none_count_and_none_stamps_survive_the_trip(self):
        prior = replace(
            ROW_PRIOR, token_count=None, state_changed_at=None, token_count_updated_at=None,
            updated_by_user_id=None, updated_via=None, last_manual_override_at=None,
            priority_rank=None, notes=None,
        )
        cell = replace(CELL, row_prior=prior, record_prior=None)
        (read,) = _read(_mint([cell])).cells
        assert read == cell
        assert read.row_prior.token_count is None

    def test_a_tampered_token_is_refused(self):
        token = _mint()
        flipped = token[:40] + ("A" if token[40] != "A" else "B") + token[41:]
        with pytest.raises(UndoTokenInvalid):
            _read(flipped)
        with pytest.raises(UndoTokenInvalid):
            _read(token[:-6])
        with pytest.raises(UndoTokenInvalid):
            _read("not-a-token")

    def test_it_expires_after_ten_minutes(self):
        token = _mint(now=CLOCK)
        assert _read(token, now=CLOCK + UNDO_TTL_SECONDS).cells == (CELL, CREATED_CELL)
        with pytest.raises(UndoTokenInvalid):
            _read(token, now=CLOCK + UNDO_TTL_SECONDS + 1)

    def test_another_statics_token_is_refused(self):
        with pytest.raises(UndoTokenInvalid):
            _read(_mint(group_id="static-1"), group_id="static-2")

    def test_another_actors_token_is_refused(self):
        with pytest.raises(UndoTokenInvalid):
            _read(_mint(actor="actor-1"), actor="actor-2")

    def test_it_cannot_authenticate(self):
        token = _mint()
        assert verify_token(token) is None
        assert verify_token(token, "refresh") is None

    def test_a_token_names_at_least_one_cell(self):
        with pytest.raises(ValueError):
            _mint([])

    def test_a_format_1_token_is_refused(self):
        """B3 added the row's `priority_rank` and `notes` and bumped the format, so a token
        minted before (format 1, without them) is refused, whatever fields it carries."""
        new_cell = asdict(CELL)
        added = ("priority_rank", "notes")
        old_cell = {
            **new_cell,
            "row_prior": {k: v for k, v in new_cell["row_prior"].items() if k not in added},
        }
        for version, cell in ((1, old_cell), (1, new_cell), (participant_undo._FORMAT, old_cell)):
            with pytest.raises(UndoTokenInvalid):
                _read(_sealed(version, cell))
        (read,) = _read(_sealed(participant_undo._FORMAT, new_cell)).cells
        assert read == CELL

    def test_the_sentinel_count_is_encrypted(self):
        """vet M-4: a lead's token for a flagged member's row must not show the prior count."""
        sentinel = 987654321
        cell = replace(CELL, row_prior=replace(ROW_PRIOR, token_count=sentinel))
        token = _mint([cell])
        for text in _decoded_views(token):
            assert str(sentinel) not in text
            assert json.dumps({"token_count": sentinel})[1:-1] not in text
            assert "token_count" not in text and "goal-1" not in text
        (read,) = _read(token).cells
        assert read.row_prior.token_count == sentinel


def _decoded_views(token: str) -> list[str]:
    """The token, and each of its base64url segments decoded: a Fernet token is one
    segment; a merely signed JWT would be three, its payload readable."""
    views = [token]
    for segment in token.split("."):
        padded = segment + "=" * (-len(segment) % 4)
        views.append(base64.urlsafe_b64decode(padded).decode("latin-1"))
    return views


# ── Both PATCH routes mint one (R-S2-11, vet M-4) ────────────────────────────


OLD_KEYS = set(ParticipantStateResponse.model_fields)


class TestPatchRoutes:
    async def test_the_self_route_names_the_record_it_created(
        self, client: AsyncClient, session, group, owner, member
    ):
        await _carded(session, group, member)
        catalog = await create_catalog_item(session, name="Undo Mount")
        goal = await _goal(session, group, owner, catalog)
        await session.commit()

        resp = await client.patch(
            _url(group, goal), json={"state": "have"}, headers=_headers(member)
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert set(body) == OLD_KEYS | {"undo_token"}
        assert isinstance(body["undo_token"], str) and body["undo_token"]

        claims = read_undo_token(body["undo_token"], group_id=group.id, actor_user_id=member.id)
        (cell,) = claims.cells
        (record,) = await _records(session)
        assert (cell.goal_id, cell.user_id) == (goal.id, member.id)
        assert cell.row_prior is None  # no row before
        assert cell.row_updated_at == body["updated_at"]
        assert cell.record_id == record.id
        assert cell.record_prior is None  # no record before
        assert cell.record_updated_at == record.updated_at == body["updated_at"]

    async def test_the_self_route_carries_the_records_prior_with_its_writer(
        self, client: AsyncClient, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        catalog = await create_catalog_item(session, name="Prior Mount")
        goal = await _goal(session, group, owner, catalog)
        _record(session, profile, main, catalog, ownership="have", token_count=30,
                token_count_updated_at=ts(6), writer=None, via="api_key")
        await _row(session, goal, member, state="have", writer=member.id, via="web",
                   last_manual_override_at=ts(3))
        await session.commit()

        resp = await client.patch(
            _url(group, goal), json={"state": "need"}, headers=_headers(member)
        )
        assert resp.status_code == 200, resp.text
        (cell,) = read_undo_token(
            resp.json()["undo_token"], group_id=group.id, actor_user_id=member.id
        ).cells
        assert cell.row_prior == RowPrior(
            state="have", token_count=None, source="manual", state_changed_at=ts(2),
            token_count_updated_at=None, updated_by_user_id=member.id, updated_via="web",
            last_manual_override_at=ts(3), priority_rank=None, notes=None,
        )
        (record,) = await _records(session)
        assert record.ownership_state == "missing"  # the write un-Haved it (Q6)
        assert cell.record_id == record.id
        assert cell.record_prior == RecordPrior(
            ownership_state="have", token_count=30, source="plugin", confidence="high",
            state_changed_at=ts(5), token_count_updated_at=ts(6), updated_by_user_id=None,
            updated_via="api_key",
        )
        assert cell.record_updated_at == record.updated_at == resp.json()["updated_at"]

    async def test_the_self_route_names_no_record_when_none_was_written(
        self, client: AsyncClient, session, group, owner, member
    ):
        profile, main = await _carded(session, group, member)
        catalog = await create_catalog_item(session, name="Pass Mount")
        with_item = await _goal(session, group, owner, catalog)
        without = await _goal(session, group, owner)
        _record(session, profile, main, catalog, ownership="have")
        await session.commit()

        for goal, state in ((with_item, "pass"), (without, "have")):
            resp = await client.patch(
                _url(group, goal), json={"state": state}, headers=_headers(member)
            )
            assert resp.status_code == 200, resp.text
            (cell,) = read_undo_token(
                resp.json()["undo_token"], group_id=group.id, actor_user_id=member.id
            ).cells
            assert (cell.record_id, cell.record_prior, cell.record_updated_at) == (None, None, None)
            assert cell.row_updated_at == resp.json()["updated_at"]

    async def test_the_lead_route_for_another_member_names_the_row_only(
        self, client: AsyncClient, session, group, owner, lead, member
    ):
        profile, main = await _carded(session, group, member)
        catalog = await create_catalog_item(session, name="Lead Mount")
        goal = await _goal(session, group, owner, catalog)
        _record(session, profile, main, catalog, ownership="have", token_count=7)
        row = await _row(session, goal, member, state="pass", writer=member.id, via="web",
                         token_count=3, token_count_updated_at=ts(2))
        row.priority_rank, row.notes = 4, "lead's note"
        await session.commit()

        resp = await client.patch(
            _url(group, goal, member), json={"state": "need"}, headers=_headers(lead)
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert set(body) == OLD_KEYS | {"undo_token"}

        claims = read_undo_token(body["undo_token"], group_id=group.id, actor_user_id=lead.id)
        (cell,) = claims.cells
        assert (cell.goal_id, cell.user_id) == (goal.id, member.id)
        assert cell.row_prior == RowPrior(
            state="pass", token_count=3, source="manual", state_changed_at=ts(2),
            token_count_updated_at=ts(2), updated_by_user_id=member.id, updated_via="web",
            last_manual_override_at=None, priority_rank=4, notes="lead's note",
        )
        assert cell.row_updated_at == body["updated_at"]
        assert (cell.record_id, cell.record_prior, cell.record_updated_at) == (None, None, None)
        # The token is the lead's: the member it names can't read it.
        with pytest.raises(UndoTokenInvalid):
            read_undo_token(body["undo_token"], group_id=group.id, actor_user_id=member.id)

    async def test_the_lead_route_aimed_at_themselves_follows_the_self_rules(
        self, client: AsyncClient, session, group, owner, lead
    ):
        await _carded(session, group, lead)
        catalog = await create_catalog_item(session, name="Own Mount")
        goal = await _goal(session, group, owner, catalog)
        await session.commit()

        resp = await client.patch(
            _url(group, goal, lead), json={"state": "have"}, headers=_headers(lead)
        )
        assert resp.status_code == 200, resp.text
        (cell,) = read_undo_token(
            resp.json()["undo_token"], group_id=group.id, actor_user_id=lead.id
        ).cells
        (record,) = await _records(session)
        assert (cell.user_id, cell.record_id, cell.record_prior) == (lead.id, record.id, None)

    async def test_a_hidden_count_travels_encrypted_in_the_leads_token(
        self, client: AsyncClient, session, group, owner, lead, member
    ):
        """B1's gate: the lead's response hides the flagged member's count; so does the token."""
        await _carded(session, group, member, hidden=True)
        goal = await _goal(session, group, owner)
        await _row(session, goal, member, state="want", token_count=987654321)
        await session.commit()

        resp = await client.patch(
            _url(group, goal, member), json={"state": "need"}, headers=_headers(lead)
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert (body["token_count"], body["count_hidden"]) == (None, True)
        assert all("987654321" not in text for text in _decoded_views(body["undo_token"]))
        claims = read_undo_token(body["undo_token"], group_id=group.id, actor_user_id=lead.id)
        assert claims.cells[0].row_prior.token_count == 987654321

    @pytest.mark.parametrize("route", ["self", "lead"])
    async def test_a_mint_failure_leaves_the_write_committed_with_a_null_token(
        self, client: AsyncClient, session, group, owner, lead, member, monkeypatch, route
    ):
        """vet M-4: minted after the flush and before the commit; a failure never fails the edit."""
        goal = await _goal(session, group, owner)
        await _row(session, goal, member, state="want")
        await session.commit()

        events: list[str] = []

        def boom(**_kwargs):
            events.append("mint")
            raise RuntimeError("no key")

        def committed(_session):
            events.append("commit")

        monkeypatch.setattr(goals_router, "mint_undo_token", boom)
        event.listen(session.sync_session, "after_commit", committed)
        try:
            if route == "self":
                resp = await client.patch(
                    _url(group, goal), json={"state": "need"}, headers=_headers(member)
                )
            else:
                resp = await client.patch(
                    _url(group, goal, member), json={"state": "need"}, headers=_headers(lead)
                )
        finally:
            event.remove(session.sync_session, "after_commit", committed)

        assert resp.status_code == 200, resp.text
        assert resp.json()["state"] == "need"
        assert resp.json()["undo_token"] is None
        assert events == ["mint", "commit"], events
        # Committed, not just flushed: a rollback does not take the write back.
        goal_id, member_id = goal.id, member.id  # read before the rollback expires them
        await session.rollback()
        row = await _stored_row_by_ids(session, goal_id, member_id)
        assert row is not None and row.state == "need"


# ── The door's restores (R-S2-11) ────────────────────────────────────────────


NOW = ts(60)
T0 = "2025-12-31T23:00:00+00:00"
T1 = "2025-12-31T23:30:00+00:00"


class TestDoorRestores:
    async def test_write_row_stores_the_restore_stamps_exactly(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, member, state="want", token_count=5,
                         token_count_updated_at=ts(2))
        done = await write_row(
            session, row=row, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=NOW, state="need", token_count=9,
            restore_state_changed_at=T0, restore_token_count_updated_at=T1,
        )
        assert (done.row.state, done.row.token_count) == ("need", 9)
        assert (done.row.state_changed_at, done.row.token_count_updated_at) == (T0, T1)
        assert done.row.updated_at == NOW  # updated_at still moves on every write
        assert (done.state_changed, done.count_changed) == (True, True)

    async def test_write_row_restores_a_null_stamp_as_null(self, session, group, owner, member):
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, member, state="want", state_changed_at=ts(2))
        done = await write_row(
            session, row=row, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=NOW, state="need",
            restore_state_changed_at=None,
        )
        assert done.row.state_changed_at is None

    async def test_write_row_clears_the_count_with_the_restore_keywords(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        row = await _row(session, goal, member, token_count=30, token_count_updated_at=ts(2))
        done = await write_row(
            session, row=row, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=NOW, token_count=None,
            restore_state_changed_at=T0, restore_token_count_updated_at=None,
        )
        assert (done.row.token_count, done.row.token_count_updated_at) == (None, None)
        assert done.row.state_changed_at == T0
        assert done.count_changed is True

    async def test_write_row_on_create_takes_the_restore_stamps(
        self, session, group, owner, member
    ):
        goal = await _goal(session, group, owner)
        done = await write_row(
            session, row=None, goal_id=goal.id, static_group_id=group.id, user_id=member.id,
            actor_user_id=member.id, via="web", now=NOW, state="need", token_count=4,
            restore_state_changed_at=T0, restore_token_count_updated_at=T1,
        )
        assert (done.row.state_changed_at, done.row.token_count_updated_at) == (T0, T1)

    async def _target(self, session, group, member, catalog, **record_kwargs):
        profile, main = await _carded(session, group, member)
        rec = _record(session, profile, main, catalog, **record_kwargs)
        await session.flush()
        target = await _target_of(session, group, member)
        assert (target.profile_id, target.character_id) == (profile.id, main.id)
        return rec, target

    async def test_write_record_restore_token_count_none_clears_the_count(
        self, session, group, member
    ):
        catalog = await create_catalog_item(session, name="Clear Mount")
        rec, target = await self._target(
            session, group, member, catalog, token_count=30, token_count_updated_at=ts(6)
        )
        done = await write_record(
            session, target, catalog.id, actor_user_id=member.id, via="web",
            mode=RECORD_WRITE_PERSON, now=NOW, source="manual", confidence="medium",
            restore_token_count=None, restore_token_count_updated_at=None,
        )
        assert done.record is rec
        assert (rec.token_count, rec.token_count_updated_at) == (None, None)
        assert done.count_changed is True
        assert rec.ownership_state == "have"  # a count-only restore leaves the ownership
        assert rec.state_changed_at == ts(5)
        assert (rec.updated_at, rec.updated_by_user_id, rec.updated_via) == (NOW, member.id, "web")

    async def test_write_record_restore_token_count_sets_the_count_and_its_stamp_exactly(
        self, session, group, member
    ):
        catalog = await create_catalog_item(session, name="Exact Mount")
        rec, target = await self._target(
            session, group, member, catalog, token_count=40, token_count_updated_at=ts(6)
        )
        done = await write_record(
            session, target, catalog.id, actor_user_id=member.id, via="web",
            mode=RECORD_WRITE_PERSON, now=NOW, source="manual", confidence="medium",
            restore_token_count=30, restore_token_count_updated_at=T1,
        )
        assert (rec.token_count, rec.token_count_updated_at) == (30, T1)
        assert done.count_changed is True

    async def test_write_record_restore_token_count_alone_dates_the_count_now(
        self, session, group, member
    ):
        catalog = await create_catalog_item(session, name="Dated Mount")
        rec, target = await self._target(
            session, group, member, catalog, token_count=30, token_count_updated_at=ts(6)
        )
        done = await write_record(
            session, target, catalog.id, actor_user_id=member.id, via="web",
            mode=RECORD_WRITE_PERSON, now=NOW, source="manual", confidence="medium",
            restore_token_count=30,
        )
        assert (rec.token_count, rec.token_count_updated_at) == (30, NOW)
        assert done.count_changed is False

    async def test_write_record_restores_the_state_stamp_with_an_ownership(
        self, session, group, member
    ):
        catalog = await create_catalog_item(session, name="Stamp Mount")
        rec, target = await self._target(session, group, member, catalog, ownership="missing")
        await write_record(
            session, target, catalog.id, actor_user_id=member.id, via="web",
            mode=RECORD_WRITE_PERSON, now=NOW, ownership="have", source="plugin",
            confidence="high", restore_state_changed_at=T0,
            restore_token_count=12, restore_token_count_updated_at=T1,
        )
        assert (rec.ownership_state, rec.state_changed_at) == ("have", T0)
        assert (rec.token_count, rec.token_count_updated_at) == (12, T1)
        assert (rec.source, rec.confidence) == ("plugin", "high")

    async def test_delete_row_deletes_that_row_alone(self, session, group, owner, lead, member):
        goal = await _goal(session, group, owner)
        mine = await _row(session, goal, member)
        theirs = await _row(session, goal, lead)
        await delete_row(session, mine)
        assert await _stored_row(session, goal, member) is None
        assert (await _stored_row(session, goal, lead)) is theirs

    async def test_delete_record_deletes_that_record_alone(self, session, group, member, lead):
        catalog = await create_catalog_item(session, name="Two Mount")
        mine, _ = await self._target(session, group, member, catalog)
        their_profile = await create_player_profile(session, lead)
        their_main = await create_player_character(session, their_profile, name="Their Main")
        theirs = _record(session, their_profile, their_main, catalog)
        await session.flush()
        await delete_record(session, mine)
        assert [r.id for r in await _records(session)] == [theirs.id]


# ── The guard: only the undo route passes the restore keywords ───────────────


BACKEND = Path(__file__).resolve().parents[1]
APP = BACKEND / "app"
DOOR_WRITERS = {"write_row", "write_record"}
DOOR_DELETERS = {"delete_row", "delete_record"}
RESTORE_KEYWORDS = {
    "restore_token_count",
    "restore_token_count_updated_at",
    "restore_state_changed_at",
}
UNDO_ROUTE = "undo_participant_edits"
# (door function, keyword) -> the functions that may pass it; anything else is the undo route's.
RESTORE_ALLOWED = {
    ("write_record", "restore_state_changed_at"): {"delete_drop", UNDO_ROUTE},
}


def _modules() -> Iterator[tuple[str, ast.Module]]:
    for path in sorted(APP.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        yield path.relative_to(BACKEND).as_posix(), tree


def _nodes_with_function(tree: ast.AST) -> Iterator[tuple[str, ast.AST]]:
    def walk(node: ast.AST, fn: str) -> Iterator[tuple[str, ast.AST]]:
        yield fn, node
        for child in ast.iter_child_nodes(node):
            inner = child.name if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) else fn
            yield from walk(child, inner)

    yield from walk(tree, "<module>")


def _door_names(tree: ast.Module) -> dict[str, str]:
    """Local name -> door function, `import ... as` included."""
    names = {name: name for name in DOOR_WRITERS | DOOR_DELETERS}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in names and alias.asname:
                    names[alias.asname] = alias.name
    return names


def _callee(call: ast.Call, names: dict[str, str]) -> str | None:
    if isinstance(call.func, ast.Name):
        return names.get(call.func.id)
    if isinstance(call.func, ast.Attribute):
        # By attribute name alone, whatever the object: `records.write_row(...)` is the
        # door's, and so is any other `.write_row`/`.delete_record` method of that name,
        # which the guard then refuses outside the undo route (rename such a method).
        return names.get(call.func.attr)
    return None


def _restore_problems(module: str, tree: ast.Module) -> list[str]:
    """Every door call outside the undo route that passes a restore keyword, hides its
    keywords behind `**`, or deletes a row or record."""
    problems = []
    names = _door_names(tree)
    for fn, node in _nodes_with_function(tree):
        if not isinstance(node, ast.Call):
            continue
        door = _callee(node, names)
        if door is None:
            continue
        where = f"{module}:{node.lineno} {fn}"
        if door in DOOR_DELETERS and fn != UNDO_ROUTE:
            problems.append(f"{where}: {door}() outside the undo route")
            continue
        for kw in node.keywords:
            if kw.arg is None:
                if fn != UNDO_ROUTE:
                    problems.append(f"{where}: {door}(**...) hides its keywords")
            elif kw.arg in RESTORE_KEYWORDS:
                if fn not in RESTORE_ALLOWED.get((door, kw.arg), {UNDO_ROUTE}):
                    problems.append(f"{where}: {door}({kw.arg}=) outside the undo route")
    return problems


def test_only_the_undo_route_passes_the_restore_keywords():
    problems = [p for module, tree in _modules() for p in _restore_problems(module, tree)]
    assert not problems, "\n".join(problems)


def test_the_guard_sees_the_doors_current_callers():
    """The guard's walk reaches the door's known callers: an empty finding is not vacuous."""
    seen = set()
    for module, tree in _modules():
        names = _door_names(tree)
        for fn, node in _nodes_with_function(tree):
            if isinstance(node, ast.Call) and _callee(node, names) in DOOR_WRITERS:
                seen.add((module, fn))
    assert {
        ("app/routers/collection_goals.py", "_write_own_state"),
        ("app/routers/collection_goals.py", "upsert_participant_state_for_user"),
        ("app/routers/collection_goals.py", "delete_drop"),
        ("app/routers/collection_goals.py", UNDO_ROUTE),
    } <= seen, seen


@pytest.mark.parametrize(
    "source",
    [
        "async def f(db):\n    await write_row(db, restore_state_changed_at=t)",
        "async def f(db):\n    await write_row(db, restore_token_count_updated_at=t)",
        "async def f(db):\n    await write_record(db, restore_token_count=None)",
        "async def f(db):\n    await write_record(db, restore_token_count_updated_at=t)",
        "async def log_drop(db):\n    await write_record(db, restore_state_changed_at=t)",
        "async def delete_drop(db):\n    await write_row(db, restore_state_changed_at=t)",
        "async def f(db):\n    await write_row(db, **kwargs)",
        "async def f(db):\n    await records.write_row(db, restore_state_changed_at=t)",
        "from app.services.collection_records import write_row as wr\n"
        "async def f(db):\n    await wr(db, restore_state_changed_at=t)",
        "async def f(db):\n    await delete_row(db, row)",
        "async def f(db):\n    await delete_record(db, record)",
        "async def outer(db):\n    async def inner():\n"
        "        await write_row(db, restore_token_count_updated_at=t)",
    ],
)
def test_the_guard_refuses_each_stray_restore(source):
    assert _restore_problems("snippet.py", ast.parse(source))


@pytest.mark.parametrize(
    "source",
    [
        f"async def {UNDO_ROUTE}(db):\n    await write_row(db, restore_state_changed_at=t)",
        f"async def {UNDO_ROUTE}(db):\n"
        "    await write_record(db, restore_token_count=None, restore_token_count_updated_at=t)",
        f"async def {UNDO_ROUTE}(db):\n    await delete_row(db, row)\n"
        "    await delete_record(db, r)",
        "async def delete_drop(db):\n    await write_record(db, restore_state_changed_at=t)",
        "async def f(db):\n    await write_row(db, state='need', token_count=None)",
        "async def f(db):\n    await other(db, restore_state_changed_at=t)",
    ],
)
def test_the_guard_lets_the_undo_route_and_todays_callers_through(source):
    assert not _restore_problems("snippet.py", ast.parse(source))


# ── B1's parked Minors ───────────────────────────────────────────────────────


async def test_tied_rows_order_by_id_on_both_read_routes(
    client: AsyncClient, session, group, owner, lead, member
):
    """Tied (rank, updated_at) rows take the id as the final tiebreak, so list_participants
    and the Progress read agree. Inserted in reverse id order, so storage order can't pass."""
    goal = await _goal(session, group, owner)
    later_id = "ffffffff-0000-4000-8000-000000000002"
    earlier_id = "00000000-0000-4000-8000-000000000001"
    for row_id, user in ((later_id, lead), (earlier_id, member)):
        session.add(
            RewardParticipantState(
                id=row_id, goal_id=goal.id, user_id=user.id, static_group_id=group.id,
                state="want", source="manual", updated_at=ts(3), updated_via="web",
                updated_by_user_id=user.id,
            )
        )
        await session.flush()
    await session.commit()

    one = await client.get(_url(group, goal), headers=_headers(owner))
    assert one.status_code == 200, one.text
    assert [p["id"] for p in one.json()] == [earlier_id, later_id]

    many = await client.get(
        f"/api/static-groups/{group.id}/collection-participants", headers=_headers(owner)
    )
    assert many.status_code == 200, many.text
    (entry,) = [e for e in many.json() if e["goal_id"] == goal.id]
    assert [p["id"] for p in entry["participants"]] == [earlier_id, later_id]


def test_count_hidden_is_required_on_every_participant_response():
    assert ParticipantStateResponse.model_fields["count_hidden"].is_required()
    assert ParticipantWriteResponse.model_fields["count_hidden"].is_required()
    assert issubclass(ParticipantWriteResponse, ParticipantStateResponse)
    undo = ParticipantWriteResponse.model_fields["undo_token"]
    assert (undo.is_required(), undo.default) == (False, None)
    assert set(ParticipantWriteResponse.model_fields) == OLD_KEYS | {"undo_token"}


def test_the_priors_carry_the_fields_the_ruling_names():
    """R-S2-11: the fields a prior carries, so a restore can be exact (Q4)."""
    assert {f.name for f in fields(RowPrior)} == {
        "state", "token_count", "source", "state_changed_at", "token_count_updated_at",
        "updated_by_user_id", "updated_via", "last_manual_override_at",
        "priority_rank", "notes",  # B3 (B2's parked Minor): a V1 PATCH can change them
    }
    assert {f.name for f in fields(RecordPrior)} == {
        "ownership_state", "token_count", "source", "confidence", "state_changed_at",
        "token_count_updated_at", "updated_by_user_id", "updated_via",
    }
