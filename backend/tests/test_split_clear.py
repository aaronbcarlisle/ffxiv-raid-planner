"""Tests for Split Clear Planner endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from tests.factories import (
    create_membership,
    create_player_character,
    create_player_profile,
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


# ── Character link tests ──────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def linked_player(session: AsyncSession, tier, owner: User):
    """Roster player with user_id set so we can link characters."""
    sp = await create_snapshot_player(session, tier, name="Linked Player", job="DRG")
    sp.user_id = owner.id
    await session.flush()
    return sp


@pytest_asyncio.fixture
async def owner_profile(session: AsyncSession, owner: User):
    return await create_player_profile(session, owner)


@pytest_asyncio.fixture
async def main_char(session: AsyncSession, owner_profile):
    return await create_player_character(session, owner_profile, name="Rin Ivalice", server="Balmung", is_main=True)


@pytest_asyncio.fixture
async def alt_char(session: AsyncSession, owner_profile):
    return await create_player_character(session, owner_profile, name="Rin Altone", server="Balmung", is_main=False)


@pytest_asyncio.fixture
async def alt_char2(session: AsyncSession, owner_profile):
    return await create_player_character(session, owner_profile, name="Rin Healcat", server="Balmung", is_main=False)


async def test_character_link_assigned_to_run_a(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    linked_player, main_char, alt_char, owner_headers: dict,
):
    """A Player Hub character link can be set for Run A."""
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{linked_player.id}",
        json={"runACharacterLinkId": main_char.id, "runACharacter": "main"},
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["runACharacterLinkId"] == main_char.id
    assert body["runACharacter"] == "main"


async def test_second_alt_can_be_assigned_to_run_b(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    linked_player, main_char, alt_char, alt_char2, owner_headers: dict,
):
    """The second alt character (not just the first) can be selected for Run B."""
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{linked_player.id}",
        json={
            "runACharacterLinkId": main_char.id,
            "runBCharacterLinkId": alt_char2.id,
            "runACharacter": "main",
            "runBCharacter": "alt",
        },
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["runACharacterLinkId"] == main_char.id
    assert body["runBCharacterLinkId"] == alt_char2.id


async def test_same_character_in_both_runs_allowed(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    linked_player, main_char, owner_headers: dict,
):
    """Same character in both runs is allowed at API level (UI warns, not server)."""
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{linked_player.id}",
        json={
            "runACharacterLinkId": main_char.id,
            "runBCharacterLinkId": main_char.id,
        },
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["runACharacterLinkId"] == main_char.id
    assert body["runBCharacterLinkId"] == main_char.id


async def test_character_from_another_player_rejected(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    player, main_char, owner_headers: dict,
):
    """A character that belongs to a different user cannot be linked."""
    # `player` has no user_id set — so any character link attempt fails
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={"runACharacterLinkId": main_char.id},
        headers=owner_headers,
    )
    assert r.status_code == 422


async def test_character_from_another_user_rejected(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    owner: User, owner_headers: dict, tier,
):
    """A character owned by a different user is rejected even with a valid user_id on the player."""
    other_user = await create_user(session, discord_id="other_user_sc")
    other_profile = await create_player_profile(session, other_user)
    other_char = await create_player_character(session, other_profile, name="Intruder", is_main=True)

    # Roster player is linked to owner, but character belongs to other_user
    sp = await create_snapshot_player(session, tier, name="Owner Player", job="WAR", sort_order=5)
    sp.user_id = owner.id
    await session.flush()

    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{sp.id}",
        json={"runACharacterLinkId": other_char.id},
        headers=owner_headers,
    )
    assert r.status_code == 422


async def test_legacy_text_assignment_still_works(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    """Manual text-only assignment (no character link) is still accepted."""
    await _enable(client, group_with_lead.id, owner_headers)
    r = await client.patch(
        f"/api/static-groups/{group_with_lead.id}/split-clear/{player.id}",
        json={
            "mainCharacterName": "ManualMain",
            "mainCharacterWorld": "Tonberry",
            "altCharacterName": "ManualAlt",
            "altCharacterWorld": "Tonberry",
            "runACharacter": "main",
            "runBCharacter": "alt",
        },
        headers=owner_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mainCharacterName"] == "ManualMain"
    assert body["runACharacterLinkId"] is None
    assert body["runBCharacterLinkId"] is None


async def test_get_returns_player_characters_dict(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    linked_player, main_char, alt_char, owner_headers: dict,
):
    """GET returns playerCharacters dict with linked chars keyed by snapshot player id."""
    r = await client.get(
        f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers
    )
    assert r.status_code == 200
    body = r.json()
    assert "playerCharacters" in body
    chars = body["playerCharacters"].get(linked_player.id, [])
    # main first (is_main=True), then alts
    names = [c["name"] for c in chars]
    assert "Rin Ivalice" in names
    assert "Rin Altone" in names
    assert chars[0]["isMain"] is True


async def test_multiple_alts_returned_for_roster_player(
    client: AsyncClient, session: AsyncSession, group_with_lead,
    linked_player, main_char, alt_char, alt_char2, owner_headers: dict,
):
    """All alt characters (including a second alt) appear in playerCharacters."""
    r = await client.get(
        f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers
    )
    body = r.json()
    chars = body["playerCharacters"].get(linked_player.id, [])
    assert len(chars) == 3
    alt_names = {c["name"] for c in chars if not c["isMain"]}
    assert "Rin Altone" in alt_names
    assert "Rin Healcat" in alt_names


async def test_player_without_linked_user_has_no_characters(
    client: AsyncClient, group_with_lead, player, owner_headers: dict
):
    """Players without user_id get an empty list in playerCharacters."""
    r = await client.get(
        f"/api/static-groups/{group_with_lead.id}/split-clear", headers=owner_headers
    )
    body = r.json()
    # player has no user_id, so should not appear in playerCharacters at all
    assert player.id not in body["playerCharacters"]
