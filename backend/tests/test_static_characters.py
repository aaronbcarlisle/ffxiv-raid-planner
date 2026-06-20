"""Tests for Static Character Registrations endpoints"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from app.models.player_character import PlayerCharacter
from app.models.player_profile import PlayerProfile
from app.models.snapshot_player import SnapshotPlayer
from app.models.static_character_registration import StaticCharacterRegistration
from app.models.static_group import StaticGroup
from app.models.tier_snapshot import TierSnapshot
from tests.factories import (
    create_membership,
    create_player_character,
    create_player_profile,
    create_snapshot_player,
    create_static_character_registration,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="scr_owner", discord_username="owner")

@pytest_asyncio.fixture
async def player_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="scr_player", discord_username="playeruser")

@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_id="scr_outsider", discord_username="outsider")

@pytest.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}

@pytest.fixture
def player_headers(player_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(player_user.id)}"}

@pytest.fixture
def outsider_headers(outsider: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(outsider.id)}"}

@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User) -> StaticGroup:
    return await create_static_group(session, owner, name="Character Reg Test Static")

@pytest_asyncio.fixture
async def group_with_player(
    session: AsyncSession, group: StaticGroup, player_user: User
) -> StaticGroup:
    await create_membership(session, player_user, group, role=MemberRole.MEMBER)
    return group

@pytest_asyncio.fixture
async def tier(session: AsyncSession, group: StaticGroup) -> TierSnapshot:
    return await create_tier_snapshot(session, group)

@pytest_asyncio.fixture
async def player_slot(
    session: AsyncSession,
    tier: TierSnapshot,
    player_user: User,
) -> SnapshotPlayer:
    sp = await create_snapshot_player(session, tier, name="Yuki Sunfire", job="DRK")
    # Link roster slot to the player user
    sp.user_id = player_user.id
    await session.flush()
    return sp

@pytest_asyncio.fixture
async def player_profile(session: AsyncSession, player_user: User) -> PlayerProfile:
    return await create_player_profile(session, player_user)

@pytest_asyncio.fixture
async def player_char(
    session: AsyncSession, player_profile: PlayerProfile
) -> PlayerCharacter:
    return await create_player_character(
        session,
        player_profile,
        name="Yuki Sunfire",
        server="Tonberry",
        data_center="Elemental",
        is_main=True,
    )

@pytest_asyncio.fixture
async def alt_char(
    session: AsyncSession, player_profile: PlayerProfile
) -> PlayerCharacter:
    return await create_player_character(
        session,
        player_profile,
        name="Yuki Moonfire",
        server="Tonberry",
        data_center="Elemental",
        is_main=False,
    )

@pytest_asyncio.fixture
async def existing_reg(
    session: AsyncSession,
    group: StaticGroup,
    player_slot: SnapshotPlayer,
    player_char: PlayerCharacter,
) -> StaticCharacterRegistration:
    return await create_static_character_registration(
        session,
        group,
        player_slot,
        player_character=player_char,
        role_in_static="main",
        is_primary_for_static=True,
    )


# ── GET /character-registrations ──────────────────────────────────────────────

async def test_list_registrations_owner(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.get(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "registrations" in data
    player_id = existing_reg.snapshot_player_id
    assert player_id in data["registrations"]
    regs = data["registrations"][player_id]
    assert len(regs) == 1
    assert regs[0]["id"] == existing_reg.id
    assert regs[0]["isPrimaryForStatic"] is True
    assert regs[0]["resolvedName"] == "Yuki Sunfire"
    assert regs[0]["resolvedWorld"] == "Tonberry"


async def test_list_registrations_returns_empty_when_none(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
) -> None:
    resp = await client.get(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["registrations"] == {}


async def test_list_registrations_forbidden_for_outsider(
    client: AsyncClient,
    outsider_headers: dict,
    group: StaticGroup,
) -> None:
    resp = await client.get(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=outsider_headers,
    )
    assert resp.status_code in (403, 404)


# ── POST /character-registrations ─────────────────────────────────────────────

async def test_create_registration_with_player_hub_char(
    client: AsyncClient,
    owner_headers: dict,
    group_with_player: StaticGroup,
    player_slot: SnapshotPlayer,
    player_char: PlayerCharacter,
) -> None:
    resp = await client.post(
        f"/api/static-groups/{group_with_player.id}/character-registrations",
        headers=owner_headers,
        json={
            "snapshotPlayerId": player_slot.id,
            "playerCharacterId": player_char.id,
            "roleInStatic": "main",
            "isPrimaryForStatic": True,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["playerCharacterId"] == player_char.id
    assert body["source"] == "player_hub"
    assert body["resolvedName"] == "Yuki Sunfire"
    assert body["linkedCharacter"] is not None
    assert body["linkedCharacter"]["isMain"] is True


async def test_player_can_register_own_character(
    client: AsyncClient,
    player_headers: dict,
    group_with_player: StaticGroup,
    player_slot: SnapshotPlayer,
    player_char: PlayerCharacter,
) -> None:
    resp = await client.post(
        f"/api/static-groups/{group_with_player.id}/character-registrations",
        headers=player_headers,
        json={
            "snapshotPlayerId": player_slot.id,
            "playerCharacterId": player_char.id,
            "roleInStatic": "main",
        },
    )
    assert resp.status_code == 201


async def test_player_cannot_register_another_users_character(
    client: AsyncClient,
    player_headers: dict,
    session: AsyncSession,
    group_with_player: StaticGroup,
    player_slot: SnapshotPlayer,
) -> None:
    # Create a character owned by a different user (the owner)
    owner_obj = await create_user(session, discord_id="another_owner_x", discord_username="anotherowner")
    profile = await create_player_profile(session, owner_obj)
    other_char = await create_player_character(session, profile, name="Stranger", server="Tonberry")

    resp = await client.post(
        f"/api/static-groups/{group_with_player.id}/character-registrations",
        headers=player_headers,
        json={
            "snapshotPlayerId": player_slot.id,
            "playerCharacterId": other_char.id,
            "roleInStatic": "alt",
        },
    )
    assert resp.status_code == 422


async def test_create_registration_duplicate_rejected(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    player_slot: SnapshotPlayer,
    player_char: PlayerCharacter,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.post(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
        json={
            "snapshotPlayerId": player_slot.id,
            "playerCharacterId": player_char.id,
            "roleInStatic": "alt",
        },
    )
    assert resp.status_code == 409


async def test_create_manual_registration_fallback(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    player_slot: SnapshotPlayer,
) -> None:
    resp = await client.post(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
        json={
            "snapshotPlayerId": player_slot.id,
            "manualCharacterName": "Yuki Sunfire",
            "manualWorld": "Tonberry",
            "roleInStatic": "alt",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["source"] == "manual"
    assert body["resolvedName"] == "Yuki Sunfire"
    assert body["linkedCharacter"] is None


async def test_create_registration_requires_identity_source(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    player_slot: SnapshotPlayer,
) -> None:
    resp = await client.post(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
        json={"snapshotPlayerId": player_slot.id, "roleInStatic": "alt"},
    )
    assert resp.status_code == 422


# ── PATCH /character-registrations/{reg_id} ───────────────────────────────────

async def test_update_registration_role(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.patch(
        f"/api/static-groups/{group.id}/character-registrations/{existing_reg.id}",
        headers=owner_headers,
        json={"roleInStatic": "substitute"},
    )
    assert resp.status_code == 200
    assert resp.json()["roleInStatic"] == "substitute"


async def test_update_registration_player_can_edit_own(
    client: AsyncClient,
    player_headers: dict,
    group_with_player: StaticGroup,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.patch(
        f"/api/static-groups/{group_with_player.id}/character-registrations/{existing_reg.id}",
        headers=player_headers,
        json={"job": "DRK"},
    )
    assert resp.status_code == 200
    assert resp.json()["job"] == "DRK"


async def test_outsider_cannot_update_registration(
    client: AsyncClient,
    outsider_headers: dict,
    group: StaticGroup,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.patch(
        f"/api/static-groups/{group.id}/character-registrations/{existing_reg.id}",
        headers=outsider_headers,
        json={"roleInStatic": "substitute"},
    )
    assert resp.status_code in (403, 404)


# ── POST /set-primary ─────────────────────────────────────────────────────────

async def test_set_primary_demotes_existing(
    client: AsyncClient,
    session: AsyncSession,
    owner_headers: dict,
    group: StaticGroup,
    player_slot: SnapshotPlayer,
    player_char: PlayerCharacter,
    alt_char: PlayerCharacter,
    existing_reg: StaticCharacterRegistration,
) -> None:
    # existing_reg is already primary; create a second registration
    alt_reg = await create_static_character_registration(
        session,
        group,
        player_slot,
        player_character=alt_char,
        role_in_static="alt",
        is_primary_for_static=False,
    )

    resp = await client.post(
        f"/api/static-groups/{group.id}/character-registrations/{alt_reg.id}/set-primary",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["isPrimaryForStatic"] is True
    assert body["roleInStatic"] == "main"

    # Old primary should have been demoted — confirm via list endpoint
    list_resp = await client.get(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
    )
    regs = list_resp.json()["registrations"][player_slot.id]
    # alt_reg is now first (sorted primary-first)
    primary_ids = [r["id"] for r in regs if r["isPrimaryForStatic"]]
    assert primary_ids == [alt_reg.id]


# ── DELETE /character-registrations/{reg_id} ──────────────────────────────────

async def test_delete_registration(
    client: AsyncClient,
    owner_headers: dict,
    group: StaticGroup,
    existing_reg: StaticCharacterRegistration,
) -> None:
    resp = await client.delete(
        f"/api/static-groups/{group.id}/character-registrations/{existing_reg.id}",
        headers=owner_headers,
    )
    assert resp.status_code == 204

    # Should no longer appear in list
    list_resp = await client.get(
        f"/api/static-groups/{group.id}/character-registrations",
        headers=owner_headers,
    )
    assert list_resp.json()["registrations"] == {}


async def test_delete_wrong_group_returns_404(
    client: AsyncClient,
    session: AsyncSession,
    owner_headers: dict,
    existing_reg: StaticCharacterRegistration,
) -> None:
    other_owner = await create_user(session, discord_id="other_g_owner", discord_username="otherowner")
    other_group = await create_static_group(session, other_owner, name="Other Group")
    resp = await client.delete(
        f"/api/static-groups/{other_group.id}/character-registrations/{existing_reg.id}",
        headers=owner_headers,
    )
    assert resp.status_code in (403, 404)
