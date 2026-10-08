"""S2a-2·B1 TB1: the Progress read API (R-S2-13, Q1, vet I-1, vet M-3).

`GET /api/static-groups/{group_id}/collection-participants` returns, for each
goal, the merged rows `list_participants` returns and the record-only cells (Q1):
a claimant of the newest active tier with no row and a record for the goal's
item. `count_hidden` says when the count gate withheld a count, so a lead can
tell "hidden" from "no count yet". New cases live here so the S2a-1 pin files
stay unedited (R-S2-2, vet M-2).
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from pydantic_core import PydanticUndefined

from app.auth_utils import create_access_token
from app.models import MemberRole, PlayerCollectionSnapshot, User
from app.schemas.collection_goals import ParticipantRecordView, ParticipantStateResponse
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


def ts(minutes: int) -> str:
    return (BASE + timedelta(minutes=minutes)).isoformat()


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _url(group) -> str:
    return f"/api/static-groups/{group.id}/collection-participants"


async def _get(client: AsyncClient, group, reader: User, goal_ids=None):
    params = [("goal_id", goal_id) for goal_id in goal_ids] if goal_ids is not None else None
    return await client.get(_url(group), params=params, headers=_headers(reader))


async def _progress(client: AsyncClient, group, reader: User, goal_ids=None) -> list[dict]:
    resp = await _get(client, group, reader, goal_ids)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _by_goal(client: AsyncClient, group, reader: User, goal_ids=None) -> dict[str, dict]:
    return {entry["goal_id"]: entry for entry in await _progress(client, group, reader, goal_ids)}


async def _participants(client: AsyncClient, group, goal, reader: User) -> list[dict]:
    resp = await client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants",
        headers=_headers(reader),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _cell(cells: list[dict], user: User) -> dict:
    (found,) = [c for c in cells if c["user_id"] == user.id]
    return found


def _user_ids(cells: list[dict]) -> set[str]:
    return {c["user_id"] for c in cells}


def _is_select(sql: str) -> bool:
    return sql.lstrip().upper().startswith("SELECT")


async def _person(session, group, name: str, *, role=MemberRole.MEMBER, tier=None, hidden=False):
    """A user with a display name, a profile (flag `hidden`) and a main; a member of
    `group` with `role` unless it is None; with a card claimed in `tier` when given."""
    user = await create_user(session, discord_username=name)
    user.display_name = name.title()
    if role is not None:
        await create_membership(session, user, group, role=role)
    profile = await create_player_profile(session, user)
    profile.hide_collection_counts = hidden
    main = await create_player_character(session, profile, name=f"{name} Main")
    if tier is not None:
        await create_claimed_card(session, group, user, main, tier=tier)
    await session.flush()
    return SimpleNamespace(user=user, profile=profile, main=main)


def _record(
    session, person, catalog, *, character=None, ownership="have", token_count=None,
    state_changed_at=ts(5), token_count_updated_at=None,
) -> PlayerCollectionSnapshot:
    rec = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=person.profile.id,
        character_id=(character or person.main).id,
        catalog_item_id=catalog.id,
        ownership_state=ownership,
        token_count=token_count,
        source="plugin",
        confidence="high",
        updated_at=ts(5),
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )
    session.add(rec)
    return rec


async def _goal(session, group, owner, *, catalog=None, status="farming", created_at=None):
    goal = await create_collection_goal(
        session, group, owner, title=f"Goal {uuid.uuid4().hex[:6]}", status=status
    )
    goal.catalog_item_id = catalog.id if catalog is not None else None
    if created_at is not None:
        goal.created_at = created_at
    await session.flush()
    return goal


async def _row(session, goal, user, *, state="want", rank=None, token_count=None, updated_at):
    stored = await create_participant_state(session, goal, user, state=state)
    stored.priority_rank = rank
    stored.token_count = token_count
    stored.token_count_updated_at = ts(1) if token_count is not None else None
    stored.updated_at = updated_at
    await session.flush()
    return stored


async def _tier(session, group, *, created_at: str, is_active: bool = True):
    tier = await create_tier_snapshot(
        session, group, tier_id=f"tier-{uuid.uuid4().hex[:8]}", is_active=is_active
    )
    tier.created_at = created_at
    await session.flush()
    return tier


# ── The world ────────────────────────────────────────────────────────────────
#
# One static, everyone carded in its one active tier: an owner, a lead, a member
# whose count flag is set ("hidden"), one whose flag is not ("shown"), one with no
# count anywhere ("blank"), and a viewer. Three goals:
#   goal_a (item A): rows for owner (rank 1, row count 3), hidden (record count 12),
#                    shown (record count 11) and blank (no count, no record);
#   goal_b (item B): a row for the owner only; records for hidden (have, 7), shown
#                    (count-only, 5), blank (have, no count) and the viewer (have);
#   goal_c (no item): rows for the lead and shown.

READERS = ["owner", "lead", "hidden", "shown", "viewer"]


async def _world(session) -> SimpleNamespace:
    owner = await create_user(session, discord_username="owner")
    owner.display_name = "Owner"
    group = await create_static_group(session, owner, name="Progress Static")
    tier = await _tier(session, group, created_at=ts(0))
    people = {
        "lead": await _person(session, group, "lead", role=MemberRole.LEAD, tier=tier),
        "hidden": await _person(session, group, "hidden", tier=tier, hidden=True),
        "shown": await _person(session, group, "shown", tier=tier),
        "blank": await _person(session, group, "blank", tier=tier),
        "viewer": await _person(session, group, "viewer", role=MemberRole.VIEWER, tier=tier),
    }
    owner_profile = await create_player_profile(session, owner)
    owner_main = await create_player_character(session, owner_profile, name="Owner Main")
    await create_claimed_card(session, group, owner, owner_main, tier=tier)
    people["owner"] = SimpleNamespace(user=owner, profile=owner_profile, main=owner_main)

    item_a = await create_catalog_item(session, name="Item A")
    item_b = await create_catalog_item(session, name="Item B")
    goal_a = await _goal(session, group, owner, catalog=item_a, created_at=ts(1))
    goal_b = await _goal(session, group, owner, catalog=item_b, status="wanted", created_at=ts(2))
    goal_c = await _goal(session, group, owner, status="scheduled", created_at=ts(3))

    users = {name: p.user for name, p in people.items()}
    await _row(session, goal_a, owner, rank=1, token_count=3, updated_at=ts(10))
    await _row(session, goal_a, users["hidden"], rank=2, updated_at=ts(11))
    await _row(session, goal_a, users["shown"], state="need", rank=3, updated_at=ts(12))
    await _row(session, goal_a, users["blank"], updated_at=ts(13))
    _record(session, people["hidden"], item_a, ownership="missing", token_count=12,
            token_count_updated_at=ts(5))
    _record(session, people["shown"], item_a, ownership="missing", token_count=11,
            token_count_updated_at=ts(5))

    await _row(session, goal_b, owner, state="have", updated_at=ts(20))
    _record(session, people["hidden"], item_b, ownership="have", token_count=7,
            token_count_updated_at=ts(5))
    _record(session, people["shown"], item_b, ownership="unknown", token_count=5,
            state_changed_at=None, token_count_updated_at=ts(5))
    _record(session, people["blank"], item_b, ownership="have")
    _record(session, people["viewer"], item_b, ownership="have")

    await _row(session, goal_c, users["lead"], state="need", rank=1, updated_at=ts(30))
    await _row(session, goal_c, users["shown"], state="pass", updated_at=ts(31))
    await session.commit()
    return SimpleNamespace(
        group=group, users=users, people=people, goal_a=goal_a, goal_b=goal_b, goal_c=goal_c,
        item_a=item_a, item_b=item_b,
    )


# ── Access (R-S2-14's GET tests) ─────────────────────────────────────────────


async def test_a_non_member_is_refused(async_client: AsyncClient, session):
    w = await _world(session)
    outsider = await create_user(session, discord_username="outsider")
    await session.commit()
    resp = await _get(async_client, w.group, outsider)
    assert resp.status_code == 403, resp.text


async def test_an_unknown_static_is_not_found(async_client: AsyncClient, session):
    w = await _world(session)
    resp = await async_client.get(
        f"/api/static-groups/{uuid.uuid4()}/collection-participants",
        headers=_headers(w.users["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Static group not found"


async def test_a_viewer_reads_states_without_counts_or_queue_order(
    async_client: AsyncClient, session
):
    w = await _world(session)
    # The owner's read of the same world carries counts and ranks, so the
    # viewer's nulls below are the gate's, not the data's.
    owners = await _by_goal(async_client, w.group, w.users["owner"])
    assert _cell(owners[w.goal_a.id]["participants"], w.users["shown"])["token_count"] == 11
    assert _cell(owners[w.goal_a.id]["participants"], w.users["owner"])["priority_rank"] == 1
    assert _cell(owners[w.goal_b.id]["record_only"], w.users["shown"])["token_count"] == 5

    seen = await _by_goal(async_client, w.group, w.users["viewer"])
    assert set(seen) == {w.goal_a.id, w.goal_b.id, w.goal_c.id}
    rows = [p for entry in seen.values() for p in entry["participants"]]
    cells = [c for entry in seen.values() for c in entry["record_only"]]
    assert len(rows) == 7 and len(cells) == 3
    for item in rows + cells:
        assert item["token_count"] is None, item
        assert item["count_hidden"] is True, item
        if item["record"] is not None:
            assert item["record"]["token_count"] is None, item
    assert all(p["priority_rank"] is None for p in rows)


# ── Equality: participants are list_participants', goal for goal ─────────────


@pytest.mark.parametrize("reader", READERS)
async def test_each_goals_participants_equal_list_participants(
    async_client: AsyncClient, session, reader
):
    w = await _world(session)
    progress = await _progress(async_client, w.group, w.users[reader])
    assert [entry["goal_id"] for entry in progress] == [w.goal_a.id, w.goal_b.id, w.goal_c.id]
    for goal, entry in zip((w.goal_a, w.goal_b, w.goal_c), progress, strict=True):
        listed = await _participants(async_client, w.group, goal, w.users[reader])
        assert listed, goal.title
        assert entry["participants"] == listed, goal.title


# ── Scope: which goals ───────────────────────────────────────────────────────


async def _scoped(session):
    owner = await create_user(session, discord_username="scope_owner")
    group = await create_static_group(session, owner, name="Scope Static")
    goals = {
        status: await _goal(session, group, owner, status=status, created_at=ts(minutes))
        for status, minutes in (
            ("complete", 1), ("scheduled", 2), ("wanted", 3), ("farming", 4),
        )
    }
    other = await create_static_group(session, owner, name="Other Static")
    foreign = await _goal(session, other, owner)
    await session.commit()
    return SimpleNamespace(owner=owner, group=group, goals=goals, foreign=foreign)


async def test_no_goal_id_returns_every_goal_not_complete_oldest_first(
    async_client: AsyncClient, session
):
    s = await _scoped(session)
    progress = await _progress(async_client, s.group, s.owner)
    assert [entry["goal_id"] for entry in progress] == [
        s.goals["scheduled"].id, s.goals["wanted"].id, s.goals["farming"].id,
    ]
    assert all(entry["participants"] == [] and entry["record_only"] == [] for entry in progress)


async def test_named_goals_are_returned_whatever_their_status(
    async_client: AsyncClient, session
):
    s = await _scoped(session)
    complete, farming = s.goals["complete"], s.goals["farming"]
    only = await _progress(async_client, s.group, s.owner, [complete.id])
    assert [entry["goal_id"] for entry in only] == [complete.id]
    both = await _progress(async_client, s.group, s.owner, [farming.id, complete.id, farming.id])
    assert [entry["goal_id"] for entry in both] == [complete.id, farming.id]


@pytest.mark.parametrize("which", ["foreign", "foreign-with-own", "unknown"])
async def test_a_goal_id_outside_the_static_is_not_found(
    async_client: AsyncClient, session, which
):
    s = await _scoped(session)
    ids = {
        "foreign": [s.foreign.id],
        "foreign-with-own": [s.goals["farming"].id, s.foreign.id],
        "unknown": [str(uuid.uuid4())],
    }[which]
    resp = await _get(async_client, s.group, s.owner, ids)
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Collection goal not found"


async def test_at_most_fifty_goal_ids(async_client: AsyncClient, session):
    s = await _scoped(session)
    resp = await _get(async_client, s.group, s.owner, [s.goals["farming"].id] * 51)
    assert resp.status_code == 422, resp.text
    resp = await _get(async_client, s.group, s.owner, [s.goals["farming"].id] * 50)
    assert resp.status_code == 200, resp.text


# ── Record-only cells (Q1) ───────────────────────────────────────────────────


async def test_a_claimant_with_a_record_and_no_row_gets_a_record_only_cell(
    async_client: AsyncClient, session
):
    owner = await create_user(session, discord_username="ro_owner")
    group = await create_static_group(session, owner, name="Record Only")
    tier = await _tier(session, group, created_at=ts(0))
    haver = await _person(session, group, "haver", tier=tier)
    counter = await _person(session, group, "counter", tier=tier)
    lead = await _person(session, group, "rolead", role=MemberRole.LEAD, tier=tier)
    rowed = await _person(session, group, "rowed", tier=tier)
    unrecorded = await _person(session, group, "unrecorded", tier=tier)
    item = await create_catalog_item(session, name="Record Only Mount")
    goal = await _goal(session, group, owner, catalog=item, created_at=ts(1))
    plain = await _goal(session, group, owner, created_at=ts(2))
    _record(session, haver, item, ownership="have")
    _record(session, counter, item, ownership="unknown", token_count=6, state_changed_at=None,
            token_count_updated_at=ts(5))
    _record(session, lead, item, ownership="missing", token_count=2,
            token_count_updated_at=ts(5))
    _record(session, rowed, item, ownership="have")
    await _row(session, goal, rowed.user, updated_at=ts(10))
    await _row(session, plain, haver.user, updated_at=ts(11))
    await session.commit()

    seen = await _by_goal(async_client, group, owner)
    cells = seen[goal.id]["record_only"]
    assert _user_ids(cells) == {haver.user.id, counter.user.id, lead.user.id}
    assert unrecorded.user.id not in _user_ids(cells)  # no record, no cell

    have = _cell(cells, haver.user)
    assert have.keys() == {
        "user_id", "display_name", "member_role", "state", "token_count", "count_hidden", "record",
    }
    assert (have["state"], have["record"]["ownership_state"]) == ("have", "have")
    assert (have["display_name"], have["member_role"]) == ("Haver", "member")
    assert (have["token_count"], have["count_hidden"]) == (None, False)
    assert have["record"]["character_id"] == haver.main.id
    assert have["record"].keys() == set(ParticipantRecordView.model_fields)

    count_only = _cell(cells, counter.user)
    assert (count_only["state"], count_only["token_count"]) == (None, 6)
    assert count_only["record"]["ownership_state"] == "unknown"
    assert count_only["record"]["token_count"] == 6

    missing = _cell(cells, lead.user)
    assert (missing["state"], missing["token_count"], missing["member_role"]) == (None, 2, "lead")

    # A member with a row is a participant, not a record-only cell.
    assert _user_ids(seen[goal.id]["participants"]) == {rowed.user.id}
    assert _cell(seen[goal.id]["participants"], rowed.user)["state"] == "have"
    # A goal with no catalog item has no record to read.
    assert seen[plain.id]["record_only"] == []
    assert _user_ids(seen[plain.id]["participants"]) == {haver.user.id}


async def test_unclaimed_viewer_and_inactive_tier_members_get_no_cell(
    async_client: AsyncClient, session
):
    owner = await create_user(session, discord_username="nc_owner")
    group = await create_static_group(session, owner, name="No Cells")
    active = await _tier(session, group, created_at=ts(100))
    # The newest tier by date is inactive: only active tiers count (as the chain).
    inactive = await _tier(session, group, created_at=ts(200), is_active=False)
    claimant = await _person(session, group, "claimant", tier=active)
    unclaimed = await _person(session, group, "unclaimed")
    viewer = await _person(session, group, "ncviewer", role=MemberRole.VIEWER, tier=active)
    benched = await _person(session, group, "benched", tier=inactive)
    item = await create_catalog_item(session, name="No Cell Mount")
    goal = await _goal(session, group, owner, catalog=item)
    for person in (claimant, unclaimed, viewer, benched):
        _record(session, person, item, ownership="have")
    await session.commit()

    seen = await _by_goal(async_client, group, owner)
    assert _user_ids(seen[goal.id]["record_only"]) == {claimant.user.id}


async def test_only_the_newest_active_tiers_claimants_get_cells(
    async_client: AsyncClient, session
):
    owner = await create_user(session, discord_username="tt_owner")
    group = await create_static_group(session, owner, name="Two Tiers")
    # Created newest first, so insertion order and recency disagree.
    newest = await _tier(session, group, created_at=ts(500))
    older = await _tier(session, group, created_at=ts(100))
    current = await _person(session, group, "current", tier=newest)
    former = await _person(session, group, "former", tier=older)
    item = await create_catalog_item(session, name="Two Tier Mount")
    goal = await _goal(session, group, owner, catalog=item)
    _record(session, current, item, ownership="have")
    _record(session, former, item, ownership="have")
    await session.commit()

    seen = await _by_goal(async_client, group, owner)
    assert _user_ids(seen[goal.id]["record_only"]) == {current.user.id}


async def test_a_card_registered_to_an_alt_reads_the_alts_record(
    async_client: AsyncClient, session
):
    owner = await create_user(session, discord_username="alt_owner")
    group = await create_static_group(session, owner, name="Alt Static")
    tier = await _tier(session, group, created_at=ts(0))
    person = await _person(session, group, "alter")
    alt = await create_player_character(session, person.profile, name="Alter Alt", is_main=False)
    await create_claimed_card(session, group, person.user, alt, tier=tier)
    item = await create_catalog_item(session, name="Alt Mount")
    goal = await _goal(session, group, owner, catalog=item)
    _record(session, person, item, ownership="have")
    _record(session, person, item, character=alt, ownership="missing", token_count=4,
            token_count_updated_at=ts(5))
    await session.commit()

    seen = await _by_goal(async_client, group, owner)
    cell = _cell(seen[goal.id]["record_only"], person.user)
    assert cell["record"]["character_id"] == alt.id
    assert (cell["state"], cell["token_count"]) == (None, 4)
    assert cell["record"]["ownership_state"] == "missing"


# ── Gating and count_hidden (vet I-1) ────────────────────────────────────────


@pytest.mark.parametrize("reader", ["owner", "lead", "hidden"])
async def test_a_flagged_members_counts_are_withheld_from_leads_and_owners_not_themselves(
    async_client: AsyncClient, session, reader
):
    w = await _world(session)
    seen = await _by_goal(async_client, w.group, w.users[reader])
    row = _cell(seen[w.goal_a.id]["participants"], w.users["hidden"])
    cell = _cell(seen[w.goal_b.id]["record_only"], w.users["hidden"])
    if reader == "hidden":
        assert (row["token_count"], row["count_hidden"], row["record"]["token_count"]) == (
            12, False, 12,
        )
        assert (cell["token_count"], cell["count_hidden"], cell["record"]["token_count"]) == (
            7, False, 7,
        )
    else:
        assert (row["token_count"], row["count_hidden"], row["record"]["token_count"]) == (
            None, True, None,
        )
        assert (cell["token_count"], cell["count_hidden"], cell["record"]["token_count"]) == (
            None, True, None,
        )
    # The record-only Have is still a Have, hidden count or not.
    assert cell["state"] == "have"


async def test_an_unflagged_member_with_no_count_reads_null_and_not_hidden(
    async_client: AsyncClient, session
):
    w = await _world(session)
    seen = await _by_goal(async_client, w.group, w.users["lead"])
    blank_row = _cell(seen[w.goal_a.id]["participants"], w.users["blank"])
    assert (blank_row["token_count"], blank_row["count_hidden"], blank_row["record"]) == (
        None, False, None,
    )
    blank_cell = _cell(seen[w.goal_b.id]["record_only"], w.users["blank"])
    assert (blank_cell["token_count"], blank_cell["count_hidden"]) == (None, False)
    assert blank_cell["record"]["token_count"] is None
    shown_row = _cell(seen[w.goal_a.id]["participants"], w.users["shown"])
    assert (shown_row["token_count"], shown_row["count_hidden"]) == (11, False)


async def test_list_participants_and_both_patch_responses_carry_the_flag(
    async_client: AsyncClient, session
):
    w = await _world(session)
    lead = w.users["lead"]
    listed = {p["user_id"]: p for p in await _participants(async_client, w.group, w.goal_a, lead)}
    assert listed[w.users["hidden"].id]["count_hidden"] is True
    assert listed[w.users["shown"].id]["count_hidden"] is False
    blank = listed[w.users["blank"].id]
    assert (blank["token_count"], blank["count_hidden"]) == (None, False)

    base = f"/api/static-groups/{w.group.id}/collection-goals/{w.goal_a.id}/participants"
    for who in ("hidden", "shown"):
        own = await async_client.patch(
            base, json={"state": "want"}, headers=_headers(w.users[who])
        )
        assert own.status_code == 200, own.text
        assert own.json()["count_hidden"] is False, who
        assert own.json()["token_count"] is not None, who

    expected = {"hidden": (None, True), "shown": (11, False), "blank": (None, False)}
    for who, (count, hidden) in expected.items():
        corrected = await async_client.patch(
            f"{base}/{w.users[who].id}", json={"state": "need"}, headers=_headers(lead)
        )
        assert corrected.status_code == 200, corrected.text
        assert (corrected.json()["token_count"], corrected.json()["count_hidden"]) == (
            count, hidden,
        ), who


# ── Budget: members and goals add no SELECT ──────────────────────────────────


async def _budget_static(session, *, members: int, goals: int, tag: str):
    """`members` members with a row and a record on every goal, and `members`
    claimants with only a record; the caller (the owner) has neither."""
    owner = await create_user(session, discord_username=f"{tag}-owner")
    static = await create_static_group(session, owner, name=tag)
    tier = await _tier(session, static, created_at=ts(0))
    rowed = [await _person(session, static, f"{tag}-row{i}", tier=tier) for i in range(members)]
    record_only = [
        await _person(session, static, f"{tag}-rec{i}", tier=tier) for i in range(members)
    ]
    made = []
    for g in range(goals):
        item = await create_catalog_item(session, name=f"{tag} Item {g}")
        goal = await _goal(session, static, owner, catalog=item, created_at=ts(g))
        for i, person in enumerate(rowed):
            await _row(session, goal, person.user, updated_at=ts(10 + i))
            _record(session, person, item, ownership="have")
        for person in record_only:
            _record(session, person, item, ownership="missing", token_count=2,
                    token_count_updated_at=ts(5))
        made.append(goal)
    await session.flush()
    return static, owner, made


async def test_the_same_selects_for_one_and_six_members_and_one_and_three_goals(
    async_client: AsyncClient, session, engine, count_statements
):
    solo, solo_owner, _ = await _budget_static(session, members=1, goals=1, tag="b-solo")
    sextet, sextet_owner, _ = await _budget_static(session, members=6, goals=1, tag="b-sextet")
    trio, trio_owner, trio_goals = await _budget_static(session, members=1, goals=3, tag="b-trio")
    await session.commit()

    with count_statements(engine, match=_is_select) as one:
        small = await _progress(async_client, solo, solo_owner)
    with count_statements(engine, match=_is_select) as six:
        large = await _progress(async_client, sextet, sextet_owner)
    with count_statements(engine, match=_is_select) as three:
        wide = await _progress(async_client, trio, trio_owner)
    with count_statements(engine, match=_is_select) as named_one:
        await _progress(async_client, trio, trio_owner, [trio_goals[0].id])
    with count_statements(engine, match=_is_select) as named_three:
        await _progress(async_client, trio, trio_owner, [g.id for g in trio_goals])

    shapes = [
        [(len(e["participants"]), len(e["record_only"])) for e in body]
        for body in (small, large, wide)
    ]
    assert shapes == [[(1, 1)], [(6, 6)], [(1, 1)] * 3]
    assert {p["state"] for e in large for p in e["participants"]} == {"have"}
    assert {c["token_count"] for e in large for c in e["record_only"]} == {2}
    assert one.n > 0
    assert six.n == one.n
    assert three.n == one.n
    assert named_three.n == named_one.n


# ── Additive only (R-S2-15) ──────────────────────────────────────────────────

# ParticipantStateResponse before S2a-2: name -> (annotation, required, default).
OLD_FIELDS = {
    "id": (str, True, PydanticUndefined),
    "goal_id": (str, True, PydanticUndefined),
    "user_id": (str, True, PydanticUndefined),
    "static_group_id": (str, True, PydanticUndefined),
    "state": (str, True, PydanticUndefined),
    "token_count": (int | None, True, PydanticUndefined),
    "priority_rank": (int | None, True, PydanticUndefined),
    "source": (str, True, PydanticUndefined),
    "last_synced_at": (str | None, True, PydanticUndefined),
    "last_manual_override_at": (str | None, False, None),
    "notes": (str | None, True, PydanticUndefined),
    "updated_at": (str, True, PydanticUndefined),
    "display_name": (str | None, False, None),
    "member_role": (str | None, False, None),
    "updated_by_user_id": (str | None, False, None),
    "updated_via": (str | None, False, None),
    "state_changed_at": (str | None, False, None),
    "token_count_updated_at": (str | None, False, None),
    "state_from_record": (bool, False, False),
    "count_from_record": (bool, False, False),
    "record": (ParticipantRecordView | None, False, None),
}


def test_participant_state_response_only_gains_count_hidden():
    fields = ParticipantStateResponse.model_fields
    assert set(fields) - set(OLD_FIELDS) == {"count_hidden"}
    for name, (annotation, required, default) in OLD_FIELDS.items():
        field = fields[name]
        assert (field.annotation, field.is_required(), field.default) == (
            annotation, required, default,
        ), name
    assert fields["count_hidden"].annotation is bool


async def test_responses_carry_the_old_keys_and_count_hidden_only(
    async_client: AsyncClient, session
):
    w = await _world(session)
    expected = set(OLD_FIELDS) | {"count_hidden"}
    listed = await _participants(async_client, w.group, w.goal_a, w.users["owner"])
    progress = await _by_goal(async_client, w.group, w.users["owner"])
    for seen in listed + progress[w.goal_a.id]["participants"]:
        assert seen.keys() == expected
    assert progress[w.goal_a.id].keys() == {"goal_id", "participants", "record_only"}
