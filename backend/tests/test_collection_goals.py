"""Tests for collection goals, participant states, and drop log endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.models import User
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="owner_cg_1", discord_username="owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="member_cg_1", discord_username="member")


@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_id="outsider_cg_1", discord_username="outsider")


@pytest.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


@pytest.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


@pytest.fixture
def outsider_headers(outsider: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(outsider.id)}"}


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, member: User):
    g = await create_static_group(session, owner)
    await create_membership(session, member, g, role="member")
    return g


# ── Goal CRUD ────────────────────────────────────────────────────────────────

async def test_create_goal(async_client: AsyncClient, group, owner_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={
            "goal_type": "mount",
            "content_type": "extreme",
            "title": "Necron EX Mount",
            "status": "farming",
            "priority_mode": "priority_order",
        },
        headers=owner_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Necron EX Mount"
    assert data["goal_type"] == "mount"
    assert data["priority_mode"] == "priority_order"
    assert data["participant_summary"]["total"] == 0


async def test_list_goals_returns_participant_summary(async_client: AsyncClient, group, owner_headers):
    await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "orchestrion", "title": "Boss Theme Roll", "status": "wanted"},
        headers=owner_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    goals = resp.json()
    assert len(goals) >= 1
    assert "participant_summary" in goals[0]


async def test_member_can_list_goals(async_client: AsyncClient, group, member_headers):
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals",
        headers=member_headers,
    )
    assert resp.status_code == 200


async def test_outsider_cannot_list_goals(async_client: AsyncClient, group, outsider_headers):
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals",
        headers=outsider_headers,
    )
    assert resp.status_code in (403, 404)


async def test_member_cannot_create_goal(async_client: AsyncClient, group, member_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Should Fail", "status": "wanted"},
        headers=member_headers,
    )
    assert resp.status_code == 403


async def test_update_goal_status_to_complete(async_client: AsyncClient, group, owner_headers):
    create_resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Test Mount", "status": "farming"},
        headers=owner_headers,
    )
    goal_id = create_resp.json()["id"]

    resp = await async_client.put(
        f"/api/static-groups/{group.id}/collection-goals/{goal_id}",
        json={"status": "complete"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "complete"
    assert data["completed_at"] is not None


async def test_delete_goal(async_client: AsyncClient, group, owner_headers):
    create_resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Delete Me", "status": "wanted"},
        headers=owner_headers,
    )
    goal_id = create_resp.json()["id"]

    resp = await async_client.delete(
        f"/api/static-groups/{group.id}/collection-goals/{goal_id}",
        headers=owner_headers,
    )
    assert resp.status_code == 204


# ── Participant States ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def goal(async_client: AsyncClient, group, owner_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={"goal_type": "mount", "title": "Farm Mount", "status": "farming", "priority_mode": "priority_order"},
        headers=owner_headers,
    )
    return resp.json()


async def test_member_sets_own_state(async_client: AsyncClient, group, goal, member_headers):
    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "need", "token_count": 45},
        headers=member_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "need"
    assert data["token_count"] == 45


async def test_owner_sets_state_for_member(async_client: AsyncClient, group, goal, owner_headers, member):
    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants/{member.id}",
        json={"state": "have"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["state"] == "have"


async def test_list_participants(async_client: AsyncClient, group, goal, owner_headers, member_headers, member):
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "want"},
        headers=member_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    participants = resp.json()
    assert any(p["user_id"] == member.id for p in participants)


async def test_participant_summary_reflects_states(async_client: AsyncClient, group, goal, owner_headers, member_headers):
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "need"},
        headers=member_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals",
        headers=owner_headers,
    )
    goals = resp.json()
    target = next(g for g in goals if g["id"] == goal["id"])
    assert target["participant_summary"]["need"] == 1
    assert target["participant_summary"]["total"] == 1


async def test_priority_order_resolves_next_recipient(async_client: AsyncClient, group, goal, owner_headers, member_headers, member, owner):
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants/{member.id}",
        json={"state": "need", "priority_rank": 1},
        headers=owner_headers,
    )
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants/{owner.id}",
        json={"state": "need", "priority_rank": 2},
        headers=owner_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        headers=owner_headers,
    )
    participants = resp.json()
    need_sorted = [p for p in participants if p["state"] == "need"]
    assert need_sorted[0]["user_id"] == member.id  # rank 1 comes first


# ── Drop Log ──────────────────────────────────────────────────────────────────

async def test_log_drop(async_client: AsyncClient, group, goal, member_headers, member):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/drops",
        json={"recipient_user_id": member.id, "quantity": 1, "notes": "First clear!"},
        headers=member_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recipient_user_id"] == member.id
    assert data["quantity"] == 1


async def test_log_drop_auto_advances_state_to_have(
    async_client: AsyncClient, group, goal, owner_headers, member_headers, member
):
    # Member sets state to "need"
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "need"},
        headers=member_headers,
    )
    # Log drop to member — should advance to "have"
    await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/drops",
        json={"recipient_user_id": member.id},
        headers=owner_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        headers=owner_headers,
    )
    participants = resp.json()
    member_state = next(p for p in participants if p["user_id"] == member.id)
    assert member_state["state"] == "have"


async def test_list_drops(async_client: AsyncClient, group, goal, owner_headers, member):
    await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/drops",
        json={"recipient_user_id": member.id},
        headers=owner_headers,
    )
    resp = await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/drops",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_drop_without_recipient(async_client: AsyncClient, group, goal, member_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/drops",
        json={"quantity": 1, "notes": "No one needed it"},
        headers=member_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["recipient_user_id"] is None


# ── Mount farm compatibility ──────────────────────────────────────────────────

async def test_mount_goal_type_accepted(async_client: AsyncClient, group, owner_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={
            "goal_type": "mount",
            "content_type": "extreme",
            "content_key": "dt-valigarmanda",
            "title": "Valigarmanda EX Mount",
            "status": "farming",
            "priority_mode": "everyone_gets_one",
        },
        headers=owner_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["goal_type"] == "mount"
    assert data["content_key"] == "dt-valigarmanda"


async def test_manual_state_coexists_with_plugin_source(async_client: AsyncClient, group, goal, member_headers):
    # Set manual state
    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "need"},
        headers=member_headers,
    )
    assert resp.json()["source"] == "manual"
    # Verify manual source is preserved
    resp2 = await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal['id']}/participants",
        json={"state": "want"},
        headers=member_headers,
    )
    assert resp2.json()["state"] == "want"
    assert resp2.json()["source"] == "manual"
