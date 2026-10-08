"""SEC-1 (P0a Task 1): who may log a farm drop, drop delete with prior-state
restore, and the participant self-upsert limits.

Rulings R-P0-1 … R-P0-4 in design/redesign/plans/2026-09-30-p0-safety.md.

S2a-1a·4 (R-S1-14): Undo's restore check is the row's `state_changed_at`, the
record prior hands off between drops like the row prior, and the member's own
Undo reverts their record. Ruling in design/redesign/plans/2026-10-01-s2a-1-character-records.md.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import CollectionGoal, MemberRole, Membership, PlayerCollectionSnapshot, User
from app.models.reward_drop_log import RewardDropLog
from app.models.reward_participant_state import RewardParticipantState
from tests.factories import (
    create_catalog_item,
    create_collection_goal,
    create_membership,
    create_participant_state,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────────


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _later_than(iso: str, *, minutes: int = 1) -> str:
    return (datetime.fromisoformat(iso) + timedelta(minutes=minutes)).isoformat()


def _drops_url(group_id: str, goal_id: str) -> str:
    return f"/api/static-groups/{group_id}/collection-goals/{goal_id}/drops"


def _participants_url(group_id: str, goal_id: str) -> str:
    return f"/api/static-groups/{group_id}/collection-goals/{goal_id}/participants"


async def _log(
    client: AsyncClient, group, goal: dict, actor: User, *, recipient_id: str | None = None
):
    return await client.post(
        _drops_url(group.id, goal["id"]),
        json={"recipient_user_id": recipient_id},
        headers=_headers(actor),
    )


async def _delete(client: AsyncClient, group, goal_id: str, drop_id: str, actor: User):
    return await client.delete(
        f"{_drops_url(group.id, goal_id)}/{drop_id}", headers=_headers(actor)
    )


async def _participants(client: AsyncClient, group, goal: dict, reader: User) -> list[dict]:
    resp = await client.get(_participants_url(group.id, goal["id"]), headers=_headers(reader))
    assert resp.status_code == 200
    return resp.json()


async def _state_of(client: AsyncClient, group, goal: dict, user: User, reader: User) -> str:
    rows = await _participants(client, group, goal, reader)
    return next(p for p in rows if p["user_id"] == user.id)["state"]


async def _drops(client: AsyncClient, group, goal: dict, reader: User) -> list[dict]:
    resp = await client.get(_drops_url(group.id, goal["id"]), headers=_headers(reader))
    assert resp.status_code == 200
    return resp.json()


async def _drop_count(session: AsyncSession, goal_id: str) -> int:
    result = await session.execute(select(RewardDropLog).where(RewardDropLog.goal_id == goal_id))
    return len(result.scalars().all())


async def _drop_row(session: AsyncSession, drop_id: str) -> RewardDropLog:
    result = await session.execute(select(RewardDropLog).where(RewardDropLog.id == drop_id))
    return result.scalar_one()


async def _add_participant(
    session: AsyncSession, goal_id: str, group_id: str, user: User, *, state: str = "need"
) -> RewardParticipantState:
    row = RewardParticipantState(
        id=str(uuid.uuid4()),
        goal_id=goal_id,
        user_id=user.id,
        static_group_id=group_id,
        state=state,
        source="manual",
        updated_at=_now(),
    )
    session.add(row)
    await session.flush()
    return row


async def _tick() -> None:
    """Cross a Windows clock tick so the next server write gets a later timestamp."""
    await asyncio.sleep(0.02)


_MOUNT_ID = 9101
_TOKEN_ID = 9102
_LONG_AGO = "2000-01-01T00:00:00+00:00"
_BEFORE_THE_DROP = "2010-01-01T00:00:00+00:00"
_SYNC_URL = "/api/plugin/collections/sync"


async def _item_on_goal(session: AsyncSession, goal: dict, *, name: str = "Undo Mount"):
    """Give the goal a catalog item the plugin can match by mount id and by token id."""
    item = await create_catalog_item(session, name=name)
    item.game_mount_id = _MOUNT_ID
    item.token_item_id = _TOKEN_ID
    stored = (
        await session.execute(select(CollectionGoal).where(CollectionGoal.id == goal["id"]))
    ).scalar_one()
    stored.catalog_item_id = item.id
    await session.flush()
    return item


async def _set_own_state(client: AsyncClient, group, goal: dict, user: User, state: str) -> dict:
    resp = await client.patch(
        _participants_url(group.id, goal["id"]), json={"state": state}, headers=_headers(user)
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _set_state_for(
    client: AsyncClient, group, goal: dict, actor: User, target: User, state: str
) -> dict:
    resp = await client.patch(
        f"{_participants_url(group.id, goal['id'])}/{target.id}",
        json={"state": state},
        headers=_headers(actor),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _plugin_sync(
    client: AsyncClient, user: User, *, mounts: list | None = None, currencies: list | None = None
) -> dict:
    """Sync as `user`'s plugin: mint a real xrp_ key and post the payload with it."""
    minted = await client.post(
        "/api/auth/api-keys", json={"name": "Undo key"}, headers=_headers(user)
    )
    assert minted.status_code == 201, minted.text
    resp = await client.request(
        "POST",
        _SYNC_URL,
        json={"mounts": mounts or [], "currencies": currencies or []},
        headers={"Authorization": f"Bearer {minted.json()['key']}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _participant_of(client: AsyncClient, group, goal: dict, user: User, reader: User) -> dict:
    rows = await _participants(client, group, goal, reader)
    return next(p for p in rows if p["user_id"] == user.id)


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_owner", discord_username="owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_lead", discord_username="lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_member", discord_username="member")


@pytest_asyncio.fixture
async def member2(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_member2", discord_username="member2")


@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_viewer", discord_username="viewer")


@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_id="fda_outsider", discord_username="outsider")


@pytest_asyncio.fixture
async def group(
    session: AsyncSession, owner: User, lead: User, member: User, member2: User, viewer: User
):
    g = await create_static_group(session, owner)
    await create_membership(session, lead, g, role=MemberRole.LEAD)
    await create_membership(session, member, g, role=MemberRole.MEMBER)
    await create_membership(session, member2, g, role=MemberRole.MEMBER)
    await create_membership(session, viewer, g, role=MemberRole.VIEWER)
    return g


@pytest_asyncio.fixture
async def goal(async_client: AsyncClient, group, owner: User) -> dict:
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Farm Mount", "status": "farming"},
        headers=_headers(owner),
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def participants(
    session: AsyncSession, goal: dict, group, member: User, member2: User
) -> dict[str, RewardParticipantState]:
    """member and member2 both in `need`."""
    return {
        "member": await _add_participant(session, goal["id"], group.id, member),
        "member2": await _add_participant(session, goal["id"], group.id, member2),
    }


# ── R-P0-1: log_drop rules ───────────────────────────────────────────────────


async def test_viewer_cannot_log_drop_for_self(
    async_client, session, group, goal, participants, viewer
):
    resp = await _log(async_client, group, goal, viewer, recipient_id=viewer.id)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers cannot log drops"
    assert await _drop_count(session, goal["id"]) == 0


async def test_viewer_cannot_log_drop_for_member(
    async_client, session, group, goal, participants, viewer, member, owner
):
    resp = await _log(async_client, group, goal, viewer, recipient_id=member.id)
    assert resp.status_code == 403
    assert await _drop_count(session, goal["id"]) == 0
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_member_cannot_log_drop_for_other_member(
    async_client, session, group, goal, participants, member, member2, owner
):
    resp = await _log(async_client, group, goal, member, recipient_id=member2.id)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Only leads and owners can log a drop for another member"
    assert await _drop_count(session, goal["id"]) == 0
    assert await _state_of(async_client, group, goal, member2, owner) == "need"


async def test_member_logs_drop_for_self(async_client, group, goal, participants, member, owner):
    resp = await _log(async_client, group, goal, member, recipient_id=member.id)
    assert resp.status_code == 201
    assert resp.json()["recipient_user_id"] == member.id
    assert resp.json()["created_by_id"] == member.id
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_lead_logs_drop_for_member(
    async_client, group, goal, participants, lead, member2, owner
):
    resp = await _log(async_client, group, goal, lead, recipient_id=member2.id)
    assert resp.status_code == 201
    assert await _state_of(async_client, group, goal, member2, owner) == "have"


async def test_lead_logging_for_outsider_is_400(
    async_client, session, group, goal, participants, lead, outsider
):
    resp = await _log(async_client, group, goal, lead, recipient_id=outsider.id)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Recipient must be a member of this static"
    assert await _drop_count(session, goal["id"]) == 0


async def test_lead_logging_for_viewer_is_400(
    async_client, session, group, goal, participants, lead, viewer
):
    resp = await _log(async_client, group, goal, lead, recipient_id=viewer.id)
    assert resp.status_code == 400
    assert await _drop_count(session, goal["id"]) == 0


async def test_lead_logging_for_unknown_id_is_400(
    async_client, session, group, goal, participants, lead
):
    resp = await _log(async_client, group, goal, lead, recipient_id="no-such-user")
    assert resp.status_code == 400
    assert await _drop_count(session, goal["id"]) == 0


async def test_member_logging_for_outsider_is_403_not_400(
    async_client, session, group, goal, participants, member, outsider
):
    """Check order: the role check runs first, so a member can't probe who belongs to the static."""
    resp = await _log(async_client, group, goal, member, recipient_id=outsider.id)
    assert resp.status_code == 403
    assert await _drop_count(session, goal["id"]) == 0


async def test_member_logs_drop_with_no_recipient(
    async_client, group, goal, participants, member, owner
):
    resp = await _log(async_client, group, goal, member)
    assert resp.status_code == 201
    assert resp.json()["recipient_user_id"] is None
    assert resp.json()["recipient_prior_state"] is None
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_admin_non_member_passes_role_checks_but_recipient_check_applies(
    async_client, session, group, goal, participants, member, outsider
):
    admin = await create_user(session, discord_id="fda_admin", discord_username="admin")
    admin.is_admin = True
    await session.flush()

    resp = await _log(async_client, group, goal, admin, recipient_id=outsider.id)
    assert resp.status_code == 400

    resp = await _log(async_client, group, goal, admin, recipient_id=member.id)
    assert resp.status_code == 201


# ── R-P0-2: delete ───────────────────────────────────────────────────────────


async def test_lead_delete_restores_need(
    async_client, group, goal, participants, lead, member, owner
):
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert await _state_of(async_client, group, goal, member, owner) == "have"

    resp = await _delete(async_client, group, goal["id"], drop["id"], lead)
    assert resp.status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"
    assert await _drops(async_client, group, goal, owner) == []


async def test_member_deletes_own_drop(async_client, group, goal, participants, member, owner):
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()

    resp = await _delete(async_client, group, goal["id"], drop["id"], member)
    assert resp.status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_member_cannot_delete_another_members_drop(
    async_client, group, goal, participants, member, member2, owner
):
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()

    resp = await _delete(async_client, group, goal["id"], drop["id"], member2)
    assert resp.status_code == 403
    assert (
        resp.json()["detail"] == "Only leads, owners or the member who logged it can delete a drop"
    )
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert [d["id"] for d in await _drops(async_client, group, goal, owner)] == [drop["id"]]


async def test_viewer_cannot_delete_drop(
    async_client, group, goal, participants, lead, member, viewer, owner
):
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()

    resp = await _delete(async_client, group, goal["id"], drop["id"], viewer)
    assert resp.status_code == 403
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_creator_demoted_to_viewer_cannot_delete_own_drop(
    async_client, session, group, goal, participants, member, owner
):
    """The viewer gate, not the creator rule: the creator would otherwise be allowed."""
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    membership = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == member.id, Membership.static_group_id == group.id
            )
        )
    ).scalar_one()
    membership.role = MemberRole.VIEWER.value
    await session.flush()

    resp = await _delete(async_client, group, goal["id"], drop["id"], member)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers cannot delete drops"
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_delete_with_wrong_goal_is_404(
    async_client, session, group, goal, participants, lead, member, owner
):
    other_goal = (
        await async_client.post(
            f"/api/static-groups/{group.id}/collection-goals",
            json={"goal_type": "mount", "title": "Other Mount", "status": "farming"},
            headers=_headers(owner),
        )
    ).json()
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()

    resp = await _delete(async_client, group, other_goal["id"], drop["id"], lead)
    assert resp.status_code == 404
    resp = await _delete(async_client, group, goal["id"], "no-such-drop", lead)
    assert resp.status_code == 404
    assert await _drop_count(session, goal["id"]) == 1
    assert await _state_of(async_client, group, goal, member, owner) == "have"


# ── R-P0-2: restore rule (V3, order-independent) ─────────────────────────────


@pytest_asyncio.fixture
async def two_drops(
    async_client, group, goal, participants, lead, member, owner
) -> tuple[dict, dict]:
    """A flips need→have (prior `need`); B lands on `have` (prior NULL)."""
    a = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    b = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert a["recipient_prior_state"] == "need"
    assert b["recipient_prior_state"] is None
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    return a, b


async def test_delete_a_then_b_restores_need(
    async_client, group, goal, two_drops, lead, member, owner
):
    a, b = two_drops
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_delete_b_then_a_restores_need(
    async_client, group, goal, two_drops, lead, member, owner
):
    a, b = two_drops
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_delete_a_alone_keeps_have_and_hands_prior_to_b(
    async_client, group, goal, two_drops, lead, member, owner
):
    a, b = two_drops
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    remaining = await _drops(async_client, group, goal, owner)
    assert [d["id"] for d in remaining] == [b["id"]]
    assert remaining[0]["recipient_prior_state"] == "need"


async def test_drop_logged_in_pass_state_has_no_prior_and_delete_leaves_pass(
    async_client, session, group, goal, participants, lead, member, owner
):
    participants["member"].state = "pass"
    await session.flush()

    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert drop["recipient_prior_state"] is None
    assert await _state_of(async_client, group, goal, member, owner) == "pass"

    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "pass"


async def test_delete_restores_after_a_token_sync(
    async_client, session, group, goal, participants, lead, member, owner
):
    """R-S1-14 (Q2): a plugin token sync after the flip no longer blocks Undo."""
    await _item_on_goal(session, goal)
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert drop["recipient_prior_state"] == "need"
    await _tick()
    synced = await _plugin_sync(
        async_client, member, currencies=[{"itemId": _TOKEN_ID, "count": 40}]
    )
    assert synced["tokenCountsUpdated"] == 1
    assert (await _participant_of(async_client, group, goal, member, owner))["token_count"] == 40

    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    restored = await _participant_of(async_client, group, goal, member, owner)
    assert restored["state"] == "need"
    assert restored["token_count"] == 40


# A state write after the flip, through a route, that leaves the row `have` with a
# later `state_changed_at`: the member lowers their cell, then `raiser` raises it.


async def _member_raises(async_client, session, group, goal, member, lead) -> None:
    await _set_own_state(async_client, group, goal, member, "have")


async def _plugin_raises(async_client, session, group, goal, member, lead) -> None:
    synced = await _plugin_sync(
        async_client, member, mounts=[{"mountId": _MOUNT_ID, "owned": True}]
    )
    assert synced["statesUpdated"] == 1


async def _lead_raises(async_client, session, group, goal, member, lead) -> None:
    await _set_state_for(async_client, group, goal, lead, member, "have")


_LATER_STATE_WRITERS = [
    pytest.param(_member_raises, id="member"),
    pytest.param(_plugin_raises, id="plugin"),
    pytest.param(_lead_raises, id="lead"),
]


async def _lower_then_raise(async_client, session, group, goal, member, lead, raiser) -> None:
    await _tick()
    await _set_own_state(async_client, group, goal, member, "need")
    await _tick()
    await raiser(async_client, session, group, goal, member, lead)


@pytest.mark.parametrize("raiser", _LATER_STATE_WRITERS)
async def test_delete_skips_restore_after_a_later_state_write(
    async_client, session, group, goal, participants, lead, member, owner, raiser
):
    await _item_on_goal(session, goal)
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert drop["recipient_prior_state"] == "need"
    await _lower_then_raise(async_client, session, group, goal, member, lead, raiser)
    assert await _state_of(async_client, group, goal, member, owner) == "have"

    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_restore_leaves_source_and_manual_override_untouched(
    async_client, session, group, goal, participants, lead, member, owner
):
    row = participants["member"]
    row.source = "plugin"
    row.last_manual_override_at = "2026-01-01T00:00:00+00:00"  # before the drop: no skip
    await session.flush()

    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    rows = await _participants(async_client, group, goal, owner)
    p = next(p for p in rows if p["user_id"] == member.id)
    assert p["state"] == "need"
    assert p["source"] == "plugin"
    assert p["last_manual_override_at"] == "2026-01-01T00:00:00+00:00"


# ── R-P0-2 fix: a state write between two drops wins in either delete order ──


async def _log_a_write_b(
    async_client, session, group, goal, participants, lead, member, raiser
) -> tuple[dict, dict]:
    """A at t1 flips need→have; a state write through a route leaves the row `have`
    with a later `state_changed_at`; B at t1+2min has prior NULL."""
    await _item_on_goal(session, goal)
    a = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert a["recipient_prior_state"] == "need"
    await _lower_then_raise(async_client, session, group, goal, member, lead, raiser)
    b = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert b["recipient_prior_state"] is None
    (await _drop_row(session, b["id"])).created_at = _later_than(a["created_at"], minutes=2)
    await session.flush()
    return a, b


@pytest.mark.parametrize("raiser", _LATER_STATE_WRITERS)
async def test_state_write_between_drops_keeps_have_deleting_a_then_b(
    async_client, session, group, goal, participants, lead, member, owner, raiser
):
    a, b = await _log_a_write_b(
        async_client, session, group, goal, participants, lead, member, raiser
    )
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"


@pytest.mark.parametrize("raiser", _LATER_STATE_WRITERS)
async def test_state_write_between_drops_keeps_have_deleting_b_then_a(
    async_client, session, group, goal, participants, lead, member, owner, raiser
):
    a, b = await _log_a_write_b(
        async_client, session, group, goal, participants, lead, member, raiser
    )
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_handoff_carries_the_flip_timestamp(
    async_client, session, group, goal, two_drops, lead, member, owner
):
    a, b = two_drops
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    b_row = await _drop_row(session, b["id"])
    assert b_row.recipient_prior_state == "need"
    assert b_row.recipient_prior_state_at == a["created_at"]


# ── R-P0-2 review fix: both drops carry a prior (manual edit between them) ───


async def _flip_edit_flip(
    async_client, session, group, goal, participants, lead, member
) -> tuple[dict, dict, str]:
    """A at tA flips want→have; a manual edit sets `need` at tA+1min; B at tA+2min
    flips need→have. The priors differ (`want` vs `need`) so a test can tell which
    one survived. Returns (a, b, tB).
    """
    row = participants["member"]
    row.state = "want"
    await session.flush()
    a = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert a["recipient_prior_state"] == "want"
    row.state = "need"
    row.last_manual_override_at = _later_than(a["created_at"], minutes=1)
    await session.flush()
    b = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert b["recipient_prior_state"] == "need"
    t_b = _later_than(a["created_at"], minutes=2)
    b_row = await _drop_row(session, b["id"])
    b_row.created_at = t_b
    b_row.recipient_prior_state_at = t_b
    await session.flush()
    return a, b, t_b


async def test_both_priors_deleting_a_then_b_restores_the_latest_prior(
    async_client, session, group, goal, participants, lead, member, owner
):
    a, b, _ = await _flip_edit_flip(
        async_client, session, group, goal, participants, lead, member
    )
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_both_priors_deleting_b_then_a_restores_the_latest_prior(
    async_client, session, group, goal, participants, lead, member, owner
):
    a, b, _ = await _flip_edit_flip(
        async_client, session, group, goal, participants, lead, member
    )
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_both_priors_deleting_b_alone_hands_its_later_prior_to_a(
    async_client, session, group, goal, participants, lead, member, owner
):
    a, b, t_b = await _flip_edit_flip(
        async_client, session, group, goal, participants, lead, member
    )
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    a_row = await _drop_row(session, a["id"])
    assert a_row.recipient_prior_state == "need"
    assert a_row.recipient_prior_state_at == t_b


# ── R-S1-14: the member's own Undo reverts their record ──────────────────────
# The member has a profile and a main, so the chain names the main's record in
# every static; the goal names a catalog item, so an own drop raises it (D1).


@pytest_asyncio.fixture
async def recorded(session, goal, participants, member):
    """member's profile, main and the goal's catalog item; no record yet."""
    profile = await create_player_profile(session, member)
    main = await create_player_character(session, profile, name="Member Main", is_main=True)
    item = await _item_on_goal(session, goal)
    return profile, main, item


async def _put_record(
    session: AsyncSession, profile, main, item, *, ownership: str, state_changed_at: str | None
) -> PlayerCollectionSnapshot:
    """A record written long ago by nobody in particular."""
    record = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=main.id,
        catalog_item_id=item.id,
        ownership_state=ownership,
        source="manual",
        confidence="medium",
        updated_at=_LONG_AGO,
        state_changed_at=state_changed_at,
    )
    session.add(record)
    await session.flush()
    return record


async def _record(session: AsyncSession, item) -> PlayerCollectionSnapshot | None:
    """The one record for `item`, read back from the database."""
    result = await session.execute(
        select(PlayerCollectionSnapshot)
        .where(PlayerCollectionSnapshot.catalog_item_id == item.id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _record_prior(session: AsyncSession, drop_id: str) -> tuple:
    drop = await _drop_row(session, drop_id)
    return (
        drop.recipient_record_prior_state,
        drop.recipient_record_prior_at,
        drop.recipient_record_prior_changed_at,
    )


async def _second_static(session: AsyncSession, owner: User, member: User, item):
    """Another static of the owner's that member belongs to, farming the same item."""
    group_b = await create_static_group(session, owner, name="Static B")
    await create_membership(session, member, group_b, role=MemberRole.MEMBER)
    goal_b = await create_collection_goal(session, group_b, owner, title="Farm Mount B")
    goal_b.catalog_item_id = item.id
    await session.flush()
    return group_b, goal_b


async def _row_in(
    session: AsyncSession, goal_b, member: User, *, state: str, state_changed_at: str, own: bool
) -> RewardParticipantState:
    """member's row in the other static, stamped as given; `own` makes it the member's write."""
    row = await create_participant_state(session, goal_b, member, state=state)
    row.updated_at = state_changed_at
    row.state_changed_at = state_changed_at
    row.updated_by_user_id = member.id if own else None
    await session.flush()
    return row


async def test_own_undo_reverts_the_record_and_its_clock(
    async_client, session, group, goal, recorded, member, owner
):
    """The record goes back to its prior, stamped with the state clock it had before the drop."""
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    raised = await _record(session, item)
    assert raised.ownership_state == "have"
    raised_at = raised.state_changed_at  # `_record` refreshes one instance: copy before the delete
    assert await _record_prior(session, drop["id"]) == ("missing", raised_at, _LONG_AGO)
    await _tick()

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", _LONG_AGO)
    assert (record.updated_by_user_id, record.updated_via) == (member.id, "web")
    assert record.updated_at not in (_LONG_AGO, raised_at)


async def test_own_undo_reverts_to_unknown_when_the_drop_created_the_record(
    async_client, session, group, goal, recorded, member, owner
):
    _, _, item = recorded
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    raised = await _record(session, item)
    assert await _record_prior(session, drop["id"]) == ("unknown", raised.state_changed_at, None)
    await _tick()

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("unknown", None)


async def test_leads_delete_of_a_members_own_drop_restores_the_row_and_leaves_the_record(
    async_client, session, group, goal, recorded, lead, member, owner
):
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    raised = await _record(session, item)
    raised_at, raised_updated_at = raised.state_changed_at, raised.updated_at
    assert raised_at not in (None, _LONG_AGO)
    await _tick()

    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("have", raised_at)
    assert (record.updated_at, record.updated_by_user_id) == (raised_updated_at, member.id)


async def test_own_undo_leaves_the_record_the_plugin_re_raised(
    async_client, session, group, goal, recorded, member, owner
):
    """Un-Have, then the plugin raises it again: the record's clock moved, so no revert."""
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    await _tick()
    await _set_own_state(async_client, group, goal, member, "need")
    assert (await _record(session, item)).ownership_state == "missing"
    await _tick()
    synced = await _plugin_sync(async_client, member, mounts=[{"mountId": _MOUNT_ID, "owned": True}])
    assert synced["statesUpdated"] == 1
    assert (await _record(session, item)).state_changed_at == synced["syncedAt"]

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at, record.source) == (
        "have",
        synced["syncedAt"],
        "plugin",
    )


async def test_own_undo_leaves_the_record_the_hub_edited(
    async_client, session, group, goal, recorded, member, owner
):
    """The drop created the record; the Hub then set it to missing: the row restores, the record stays."""
    _, _, item = recorded
    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    assert (await _record_prior(session, drop["id"]))[0] == "unknown"
    await _tick()
    resp = await async_client.put(
        f"/api/me/collection-snapshot/{item.id}",
        json={"ownership_state": "missing"},
        headers=_headers(member),
    )
    assert resp.status_code == 200, resp.text
    t_edit = (await _record(session, item)).state_changed_at
    assert t_edit is not None

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "need"
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", t_edit)


# Hand-off: the record prior moves between this goal's drops as the row prior does.


@pytest_asyncio.fixture
async def two_own_drops(async_client, session, group, goal, recorded, member) -> tuple[dict, dict]:
    """A raises the record missing→have (and the row need→have); B lands on both."""
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    a = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    await _tick()
    b = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    raised = await _record(session, item)
    assert await _record_prior(session, a["id"]) == ("missing", raised.state_changed_at, _LONG_AGO)
    assert await _record_prior(session, b["id"]) == (None, None, None)
    await _tick()
    return a, b


async def test_record_prior_deleting_a_then_b_hands_off_and_reverts(
    async_client, session, group, goal, recorded, two_own_drops, member, owner
):
    _, _, item = recorded
    a, b = two_own_drops
    a_prior = await _record_prior(session, a["id"])
    assert (await _delete(async_client, group, goal["id"], a["id"], member)).status_code == 204
    assert (await _record(session, item)).ownership_state == "have"
    assert await _record_prior(session, b["id"]) == a_prior
    assert (await _delete(async_client, group, goal["id"], b["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", _LONG_AGO)
    assert await _state_of(async_client, group, goal, member, owner) == "need"


async def test_record_prior_deleting_b_then_a_reverts(
    async_client, session, group, goal, recorded, two_own_drops, member, owner
):
    _, _, item = recorded
    a, b = two_own_drops
    assert (await _delete(async_client, group, goal["id"], b["id"], member)).status_code == 204
    assert (await _record(session, item)).ownership_state == "have"
    assert (await _delete(async_client, group, goal["id"], a["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", _LONG_AGO)


async def _raise_edit_raise(
    async_client, session, group, goal, recorded, member
) -> tuple[dict, dict, str]:
    """A creates the record (prior `unknown`, no clock); the member un-Haves it at
    t_edit; B raises it again (prior `missing`, changed at t_edit). The priors differ,
    so a test can tell which one survived. Returns (a, b, t_edit)."""
    _, _, item = recorded
    a = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    await _tick()
    await _set_own_state(async_client, group, goal, member, "need")
    edited = await _record(session, item)
    assert edited.ownership_state == "missing"
    t_edit = edited.state_changed_at
    await _tick()
    b = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    raised = await _record(session, item)
    a_state, a_at, a_changed_at = await _record_prior(session, a["id"])
    assert (a_state, a_changed_at) == ("unknown", None)
    assert await _record_prior(session, b["id"]) == ("missing", raised.state_changed_at, t_edit)
    assert datetime.fromisoformat(raised.state_changed_at) > datetime.fromisoformat(a_at)
    await _tick()
    return a, b, t_edit


async def test_both_record_priors_deleting_a_then_b_reverts_to_the_latest(
    async_client, session, group, goal, recorded, member, owner
):
    _, _, item = recorded
    a, b, t_edit = await _raise_edit_raise(async_client, session, group, goal, recorded, member)
    b_prior = await _record_prior(session, b["id"])
    assert (await _delete(async_client, group, goal["id"], a["id"], member)).status_code == 204
    assert await _record_prior(session, b["id"]) == b_prior  # A's earlier prior is discarded
    assert (await _delete(async_client, group, goal["id"], b["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", t_edit)


async def test_both_record_priors_deleting_b_then_a_hands_the_latest_to_a(
    async_client, session, group, goal, recorded, member, owner
):
    _, _, item = recorded
    a, b, t_edit = await _raise_edit_raise(async_client, session, group, goal, recorded, member)
    b_prior = await _record_prior(session, b["id"])
    assert (await _delete(async_client, group, goal["id"], b["id"], member)).status_code == 204
    assert await _record_prior(session, a["id"]) == b_prior
    assert (await _record(session, item)).ownership_state == "have"
    assert (await _delete(async_client, group, goal["id"], a["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", t_edit)


# The other static reads the record through the merge (R-S1-9).


async def test_the_other_statics_merged_state_follows_the_revert(
    async_client, session, group, goal, recorded, member, owner
):
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    group_b, goal_b = await _second_static(session, owner, member, item)
    await _row_in(session, goal_b, member, state="need", state_changed_at=_LONG_AGO, own=False)
    goal_b_ref = {"id": goal_b.id}

    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    seen = await _participant_of(async_client, group_b, goal_b_ref, member, owner)
    assert (seen["state"], seen["state_from_record"]) == ("have", True)
    await _tick()

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    seen = await _participant_of(async_client, group_b, goal_b_ref, member, owner)
    assert (seen["state"], seen["state_from_record"]) == ("need", False)


async def test_a_pre_drop_have_in_the_other_static_stands_after_the_undo(
    async_client, session, group, goal, recorded, member, owner
):
    """vet M-10: the revert carries the record's old clock, so B's own Have from before
    the drop is not a Have that yields to a newer un-Have."""
    profile, main, item = recorded
    await _put_record(session, profile, main, item, ownership="missing", state_changed_at=_LONG_AGO)
    group_b, goal_b = await _second_static(session, owner, member, item)
    await _row_in(session, goal_b, member, state="have", state_changed_at=_BEFORE_THE_DROP, own=True)
    goal_b_ref = {"id": goal_b.id}

    drop = (await _log(async_client, group, goal, member, recipient_id=member.id)).json()
    seen = await _participant_of(async_client, group_b, goal_b_ref, member, owner)
    assert (seen["state"], seen["state_from_record"]) == ("have", True)
    await _tick()

    assert (await _delete(async_client, group, goal["id"], drop["id"], member)).status_code == 204
    record = await _record(session, item)
    assert (record.ownership_state, record.state_changed_at) == ("missing", _LONG_AGO)
    seen = await _participant_of(async_client, group_b, goal_b_ref, member, owner)
    assert (seen["state"], seen["state_from_record"]) == ("have", False)


# ── R-P0-3: participant self-upsert ──────────────────────────────────────────


async def test_viewer_cannot_self_upsert(async_client, session, group, goal, viewer):
    resp = await async_client.patch(
        _participants_url(group.id, goal["id"]), json={"state": "need"}, headers=_headers(viewer)
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers cannot track farms"
    rows = await session.execute(
        select(RewardParticipantState).where(RewardParticipantState.user_id == viewer.id)
    )
    assert rows.scalars().all() == []


async def test_member_self_upsert_stores_token_and_ignores_rank_on_create(
    async_client, group, goal, member
):
    """S2a-1 delta (h): a member's count is stored (on the row: the goal has no catalog item)."""
    resp = await async_client.patch(
        _participants_url(group.id, goal["id"]),
        json={"state": "need", "token_count": 45, "priority_rank": 1, "notes": "soon"},
        headers=_headers(member),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "need"
    assert data["notes"] == "soon"
    assert data["token_count"] == 45
    assert data["count_from_record"] is False
    assert data["priority_rank"] is None


async def test_member_self_upsert_stores_token_and_ignores_rank_on_update(
    async_client, group, goal, owner, member
):
    seeded = await async_client.patch(
        f"{_participants_url(group.id, goal['id'])}/{member.id}",
        json={"state": "want", "token_count": 10, "priority_rank": 2},
        headers=_headers(owner),
    )
    assert seeded.status_code == 200
    assert (seeded.json()["token_count"], seeded.json()["priority_rank"]) == (10, 2)

    resp = await async_client.patch(
        _participants_url(group.id, goal["id"]),
        json={"state": "need", "token_count": 45, "priority_rank": 1},
        headers=_headers(member),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "need"
    assert data["token_count"] == 45
    assert data["priority_rank"] == 2


async def test_lead_self_upsert_stores_token_and_rank(async_client, group, goal, lead):
    resp = await async_client.patch(
        _participants_url(group.id, goal["id"]),
        json={"state": "need", "token_count": 45, "priority_rank": 1},
        headers=_headers(lead),
    )
    assert resp.status_code == 200
    assert resp.json()["token_count"] == 45
    assert resp.json()["priority_rank"] == 1


async def test_lead_route_refuses_viewer_target(async_client, session, group, goal, lead, viewer):
    resp = await async_client.patch(
        f"{_participants_url(group.id, goal['id'])}/{viewer.id}",
        json={"state": "need"},
        headers=_headers(lead),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Viewers can't be tracked"
    rows = await session.execute(
        select(RewardParticipantState).where(RewardParticipantState.user_id == viewer.id)
    )
    assert rows.scalars().all() == []


# ── R-P0-4 / R-P0-2: the wire ────────────────────────────────────────────────


async def test_participants_response_carries_member_role(
    async_client, session, group, goal, participants, owner, lead, member, outsider
):
    # A participant row whose user is no longer a member resolves to None.
    await _add_participant(session, goal["id"], group.id, outsider)
    lead_self = await async_client.patch(
        _participants_url(group.id, goal["id"]), json={"state": "want"}, headers=_headers(lead)
    )
    assert lead_self.json()["member_role"] == "lead"
    for_member = await async_client.patch(
        f"{_participants_url(group.id, goal['id'])}/{member.id}",
        json={"state": "want"},
        headers=_headers(owner),
    )
    assert for_member.json()["member_role"] == "member"

    roles = {
        p["user_id"]: p["member_role"]
        for p in await _participants(async_client, group, goal, owner)
    }
    assert roles[lead.id] == "lead"
    assert roles[member.id] == "member"
    assert roles[outsider.id] is None


async def test_drop_response_carries_recipient_prior_state(
    async_client, group, goal, participants, lead, member, owner
):
    created = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert created["recipient_prior_state"] == "need"
    unassigned = (await _log(async_client, group, goal, lead)).json()
    assert unassigned["recipient_prior_state"] is None

    by_id = {d["id"]: d for d in await _drops(async_client, group, goal, owner)}
    assert by_id[created["id"]]["recipient_prior_state"] == "need"
    assert by_id[unassigned["id"]]["recipient_prior_state"] is None


# ── Concurrency guard: the goal row is locked on every drop write ────────────
# SQLite ignores FOR UPDATE, so the race itself can't run here. These compile each
# statement the route issues for PostgreSQL and assert the lock is there (and, for a
# delete, taken before the drop is read).


def _record_pg_sql(session: AsyncSession, monkeypatch) -> list[str]:
    from sqlalchemy.dialects import postgresql

    seen: list[str] = []
    real_execute = session.execute

    async def recording_execute(statement, *args, **kwargs):
        try:
            seen.append(str(statement.compile(dialect=postgresql.dialect())))
        except Exception:  # raw text / DDL: not a select we care about
            seen.append("")
        return await real_execute(statement, *args, **kwargs)

    monkeypatch.setattr(session, "execute", recording_execute)
    return seen


def _goal_lock_index(sql: list[str]) -> int | None:
    for i, text in enumerate(sql):
        if "FROM collection_goals" in text and "FOR UPDATE" in text:
            return i
    return None


async def test_delete_drop_locks_the_goal_row_before_reading_the_drop(
    async_client, session, group, goal, participants, lead, member, monkeypatch
):
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()

    sql = _record_pg_sql(session, monkeypatch)
    resp = await _delete(async_client, group, goal["id"], drop["id"], lead)
    assert resp.status_code == 204

    lock = _goal_lock_index(sql)
    first_drop_read = next(i for i, text in enumerate(sql) if "FROM reward_drop_log" in text)
    assert lock is not None, "delete_drop must SELECT the goal FOR UPDATE"
    assert lock < first_drop_read, "the lock must precede the drop read"


async def test_log_drop_locks_the_goal_row(
    async_client, session, group, goal, participants, lead, member, monkeypatch
):
    sql = _record_pg_sql(session, monkeypatch)
    resp = await _log(async_client, group, goal, lead, recipient_id=member.id)
    assert resp.status_code == 201
    assert _goal_lock_index(sql) is not None, "log_drop must SELECT the goal FOR UPDATE"
