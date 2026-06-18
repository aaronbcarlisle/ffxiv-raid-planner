"""Tests for Split Clear Planner endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="split_owner", discord_username="owner")

@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_id="split_lead", discord_username="lead")

@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="split_member", discord_username="member")

@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_id="split_viewer", discord_username="viewer")

@pytest.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}

@pytest.fixture
def lead_headers(lead: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(lead.id)}"}

@pytest.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}

@pytest.fixture
def viewer_headers(viewer: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(viewer.id)}"}

@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User):
    return await create_static_group(session, owner, name="Split Test Static")

@pytest_asyncio.fixture
async def group_with_lead(session: AsyncSession, group, lead: User, member: User, viewer: User):
    await create_membership(session, lead, group, role=MemberRole.LEAD)
    await create_membership(session, member, group, role=MemberRole.MEMBER)
    await create_membership(session, viewer, group, role=MemberRole.VIEWER)
    return group

@pytest_asyncio.fixture
async def tier(session: AsyncSession, group):
    return await create_tier_snapshot(session, group)

@pytest_asyncio.fixture
async def player(session: AsyncSession, tier):
    return await create_snapshot_player(session, tier, name="Warrior Main", job="WAR")

@pytest_asyncio.fixture
async def player2(session: AsyncSession, tier):
    return await create_snapshot_player(session, tier, name="Healer Alt", job="WHM", sort_order=1)

# Helper: enable split mode on a group
async def _enable(client: AsyncClient, group_id: str, headers: dict) -> None:
    r = await client.put(
        f"/api/static-groups/{group_id}/split-clear/settings",
        json={"enabled": True},
        headers=headers,
    )
    assert r.status_code == 200


# ── GET /split-clear ──────────────────────────────────────────────────────────

async def test_get_split_clear_default_disabled(
    client: AsyncClient, group_with_lead, owner_headers: dict
):
    """Split mode is off by default."""
    r = await client.get(f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert body["assignments"] == []


async def test_get_split_clear_viewer_allowed(
    client: AsyncClient, group_with_lead, viewer_headers: dict
):
    """Viewers can read the split-clear state."""
    r = await client.get(f"/api/static-groups/{group_with_lead.id}/split-clear", headers=viewer_headers)
    assert r.status_code == 200


# ── PUT /split-clear/settings ─────────────────────────────────────────────────

async def test_owner_can_enable_split_clear(
    client: AsyncClient, group_with_lead, owner_headers: dict
):
    r = await client.put(
        f"/api/static-groups/{group_with_lead.id}/split-clear/settings",
        json={"enabled": True},
        headers=owner_headers,
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True


async def test_lead_can_toggle_split_clear(
    client: AsyncClient, group_with_lead, lead_headers: dict
):
    r = await client.put(
        f"/api/static-groups/{group_with_lead.id}/split-clear/settings",
        json={"enabled": True},
        headers=lead_headers,
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True


async def test_member_cannot_enable_split_clear(
    client: AsyncClient, group_with_lead, member_headers: dict
):
    r = await client.put(
        f"/api/static-groups/{group_with_lead.id}/split-clear/settings",
        json={"enabled": True},
        headers=member_headers,
    )
    assert r.status_code == 403


async def test_enable_split_clear_does_not_affect_other_statics(
    client: AsyncClient, session: AsyncSession, owner: User, owner_headers: dict, group_with_lead
):
    """Enabling split mode on one static doesn't bleed into another."""
    other = await create_static_group(session, owner, name="Other Static")
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.get(f"/api/static-groups/{other.id}/split-clear", headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["enabled"] is False


# ── PATCH /split-clear/{player_id} ───────────────────────────────────────────

async def test_upsert_requires_split_mode_enabled(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    """Assignment PATCH is blocked with 409 when split mode is off."""
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={"mainCharacterName": "Test"},
        headers=owner_headers,
    )
    assert r.status_code == 409


async def test_upsert_assignment_creates_new(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={
            "mainCharacterName": "WarriorMain",
            "mainCharacterWorld": "Tonberry",
            "altCharacterName": "WarriorAlt",
            "altCharacterWorld": "Tonberry",
            "runACharacter": "main",
            "runBCharacter": "alt",
            "lootTarget": "funnel_main",
            "runACleared": False,
            "runBCleared": False,
        },
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["snapshotPlayerId"] == player.id
    assert body["mainCharacterName"] == "WarriorMain"
    assert body["runACharacter"] == "main"
    assert body["runBCharacter"] == "alt"
    assert body["lootTarget"] == "funnel_main"
    assert body["runACleared"] is False
    assert body["runBCleared"] is False


async def test_patch_preserves_unrelated_fields(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    """Patching one field must not wipe others."""
    await _enable(client, group_with_lead.id, owner_headers)
    # Seed full assignment
    await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={
            "mainCharacterName": "MainName",
            "mainCharacterWorld": "Moogle",
            "altCharacterName": "AltName",
            "altCharacterWorld": "Moogle",
            "runACharacter": "main",
            "runBCharacter": "alt",
            "lootTarget": "normal",
            "notes": "keep me",
        },
        headers=owner_headers,
    )
    # Only update runACleared
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={"runACleared": True},
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mainCharacterName"] == "MainName"
    assert body["altCharacterName"] == "AltName"
    assert body["runACharacter"] == "main"
    assert body["notes"] == "keep me"
    assert body["runACleared"] is True
    assert body["runBCleared"] is False  # unchanged


async def test_separate_run_a_and_run_b_cleared(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    """runACleared and runBCleared are stored and returned independently."""
    await _enable(client, group_with_lead.id, owner_headers)
    await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={"runACleared": True, "runBCleared": False},
        headers=owner_headers,
    )
    r = await client.get(f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers)
    assignment = r.json()["assignments"][0]
    assert assignment["runACleared"] is True
    assert assignment["runBCleared"] is False


async def test_get_returns_assignments_after_upsert(
    client: AsyncClient, group_with_lead, player, player2, owner_headers: dict
):
    await _enable(client, group_with_lead.id, owner_headers)
    for p in [player, player2]:
        await client.patch(
            f"/api/static-groups/{group_with_lead.id}/split-clear/{p.id}",
            json={
                "mainCharacterName": f"Main{p.name}",
                "mainCharacterWorld": "Tonberry",
                "altCharacterName": f"Alt{p.name}",
                "altCharacterWorld": "Tonberry",
                "runACharacter": "main",
                "runBCharacter": "alt",
            },
            headers=owner_headers,
        )
    r = await client.get(
        f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers
    )
    assert r.status_code == 200
    assert len(r.json()["assignments"]) == 2


async def test_member_cannot_edit_assignment(
    client: AsyncClient, group_with_lead, player, owner_headers: dict, member_headers: dict
):
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={"mainCharacterName": "Hack"},
        headers=member_headers,
    )
    assert r.status_code == 403


async def test_cross_static_player_is_rejected(
    client: AsyncClient, session: AsyncSession, owner: User, owner_headers: dict,
    group_with_lead, player
):
    """A player from another static must not be attachable to this plan."""
    other = await create_static_group(session, owner, name="Other Static")
    other_tier = await create_tier_snapshot(session, other)
    foreign_player = await create_snapshot_player(session, other_tier, name="Infiltrator")

    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{foreign_player.id}",
        json={"mainCharacterName": "Test"},
        headers=owner_headers,
    )
    assert r.status_code == 404


# ── POST /split-clear/reset-week ──────────────────────────────────────────────

async def test_reset_week_clears_all_flags(
    client: AsyncClient, group_with_lead, player, player2, owner_headers: dict
):
    await _enable(client, group_with_lead.id, owner_headers)
    for p in [player, player2]:
        await client.patch(
            f"/api/static-groups/{group_with_lead.id}/split-clear/{p.id}",
            json={"runACleared": True, "runBCleared": True},
            headers=owner_headers,
        )

    r = await client.post(
        f"/api/static-groups/{group_with_lead.id}/split-clear/reset-week",
        headers=owner_headers,
    )
    assert r.status_code == 204

    r2 = await client.get(
        f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers
    )
    for a in r2.json()["assignments"]:
        assert a["runACleared"] is False
        assert a["runBCleared"] is False
