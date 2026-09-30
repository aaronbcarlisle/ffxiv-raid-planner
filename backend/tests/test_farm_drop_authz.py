"""SEC-1 (P0a Task 1): who may log a farm drop, drop delete with prior-state
restore, and the participant self-upsert limits.

Rulings R-P0-1 … R-P0-4 in design/redesign/plans/2026-09-30-p0-safety.md.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, Membership, User
from app.models.reward_drop_log import RewardDropLog
from app.models.reward_participant_state import RewardParticipantState
from tests.factories import create_membership, create_static_group, create_user

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


async def test_delete_skips_restore_when_synced_after_drop(
    async_client, session, group, goal, participants, lead, member, owner
):
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert drop["recipient_prior_state"] == "need"
    participants["member"].last_synced_at = _later_than(drop["created_at"])
    await session.flush()

    assert (await _delete(async_client, group, goal["id"], drop["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"


async def test_delete_skips_restore_when_manually_overridden_after_drop(
    async_client, session, group, goal, participants, lead, member, owner
):
    drop = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    participants["member"].last_manual_override_at = _later_than(drop["created_at"])
    await session.flush()

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
    async_client, session, group, goal, participants, lead, member, column: str
) -> tuple[dict, dict]:
    """A at t1 flips need→have; `column` is written at t1+1min; B at t1+2min has prior NULL."""
    a = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert a["recipient_prior_state"] == "need"
    setattr(participants["member"], column, _later_than(a["created_at"], minutes=1))
    await session.flush()
    b = (await _log(async_client, group, goal, lead, recipient_id=member.id)).json()
    assert b["recipient_prior_state"] is None
    (await _drop_row(session, b["id"])).created_at = _later_than(a["created_at"], minutes=2)
    await session.flush()
    return a, b


_STATE_WRITE_COLUMNS = ["last_synced_at", "last_manual_override_at"]


@pytest.mark.parametrize("column", _STATE_WRITE_COLUMNS)
async def test_state_write_between_drops_keeps_have_deleting_a_then_b(
    async_client, session, group, goal, participants, lead, member, owner, column
):
    a, b = await _log_a_write_b(
        async_client, session, group, goal, participants, lead, member, column
    )
    assert (await _delete(async_client, group, goal["id"], a["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"
    assert (await _delete(async_client, group, goal["id"], b["id"], lead)).status_code == 204
    assert await _state_of(async_client, group, goal, member, owner) == "have"


@pytest.mark.parametrize("column", _STATE_WRITE_COLUMNS)
async def test_state_write_between_drops_keeps_have_deleting_b_then_a(
    async_client, session, group, goal, participants, lead, member, owner, column
):
    a, b = await _log_a_write_b(
        async_client, session, group, goal, participants, lead, member, column
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


async def test_member_self_upsert_ignores_token_and_rank_on_create(
    async_client, group, goal, member
):
    resp = await async_client.patch(
        _participants_url(group.id, goal["id"]),
        json={"state": "need", "token_count": 45, "priority_rank": 1, "notes": "soon"},
        headers=_headers(member),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "need"
    assert data["notes"] == "soon"
    assert data["token_count"] is None
    assert data["priority_rank"] is None


async def test_member_self_upsert_ignores_token_and_rank_on_update(
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
    assert data["token_count"] == 10
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
