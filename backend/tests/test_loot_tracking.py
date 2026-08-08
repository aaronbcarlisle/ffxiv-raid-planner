"""Tests for loot log endpoints.

Covers: character registration snapshot, validation, and legacy player-only flows.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from tests.factories import (
    create_loot_log_entry,
    create_membership,
    create_player_character,
    create_player_profile,
    create_snapshot_player,
    create_static_character_registration,
    create_static_group,
    create_tier_snapshot,
    create_user,
)
from app.models import MemberRole


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def group_and_tier(session: AsyncSession, test_user: User):
    group = await create_static_group(session, test_user)
    tier = await create_tier_snapshot(session, group)
    return group, tier


@pytest_asyncio.fixture
async def player(session: AsyncSession, group_and_tier):
    group, tier = group_and_tier
    return await create_snapshot_player(session, tier, name="R'in Ivalice", job="MCH")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _loot_payload(player, **overrides):
    return {
        "weekNumber": 1,
        "floor": "M9S",
        "itemSlot": "head",
        "recipientPlayerId": player.id,
        "method": "drop",
        **overrides,
    }


# ---------------------------------------------------------------------------
# Test: legacy player-only loot entry still works
# ---------------------------------------------------------------------------

class TestLegacyPlayerOnlyLoot:
    @pytest.mark.asyncio
    async def test_create_loot_entry_without_character_registration(
        self,
        client: AsyncClient,
        auth_headers: dict,
        group_and_tier,
        player,
    ):
        """Loot entries without any character registration must succeed and store null fields."""
        group, tier = group_and_tier
        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player),
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["recipientPlayerId"] == player.id
        assert data["recipientCharacterRegistrationId"] is None
        assert data["recipientCharacterName"] is None


# ---------------------------------------------------------------------------
# Test: loot log accepts character registration (manual fallback name)
# ---------------------------------------------------------------------------

class TestLootWithManualRegistration:
    @pytest.mark.asyncio
    async def test_character_registration_manual_name_snapshotted(
        self,
        client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession,
        group_and_tier,
        player,
    ):
        """When a manual registration is linked, the manual_character_name is snapshotted."""
        group, tier = group_and_tier
        reg = await create_static_character_registration(
            session,
            group,
            player,
            manual_character_name="R'in Ivalice",
            role_in_static="main",
            is_primary_for_static=True,
        )

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(
                player,
                recipientCharacterRegistrationId=reg.id,
            ),
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["recipientCharacterRegistrationId"] == reg.id
        assert data["recipientCharacterName"] == "R'in Ivalice"

    @pytest.mark.asyncio
    async def test_caller_provided_name_takes_precedence(
        self,
        client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession,
        group_and_tier,
        player,
    ):
        """If caller supplies recipientCharacterName, it overrides the backend resolution."""
        group, tier = group_and_tier
        reg = await create_static_character_registration(
            session,
            group,
            player,
            manual_character_name="Auto Resolved Name",
            is_primary_for_static=True,
        )

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(
                player,
                recipientCharacterRegistrationId=reg.id,
                recipientCharacterName="Caller Provided Name",
            ),
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["recipientCharacterName"] == "Caller Provided Name"


# ---------------------------------------------------------------------------
# Test: loot log resolves Player Hub character name from backend
# ---------------------------------------------------------------------------

class TestLootWithPlayerHubRegistration:
    @pytest.mark.asyncio
    async def test_player_hub_character_name_snapshotted(
        self,
        client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession,
        test_user: User,
        group_and_tier,
        player,
    ):
        """When a Player Hub linked registration is used, the backend resolves name from PlayerCharacter."""
        group, tier = group_and_tier
        profile = await create_player_profile(session, test_user)
        character = await create_player_character(
            session,
            profile,
            name="R'in Ivalice",
            server="Tonberry",
        )
        reg = await create_static_character_registration(
            session,
            group,
            player,
            player_character=character,
            role_in_static="main",
            is_primary_for_static=True,
        )

        # Note: caller sends no recipientCharacterName — backend must resolve it
        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(
                player,
                recipientCharacterRegistrationId=reg.id,
            ),
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["recipientCharacterRegistrationId"] == reg.id
        assert data["recipientCharacterName"] == "R'in Ivalice"


# ---------------------------------------------------------------------------
# Test: registration from another static is rejected
# ---------------------------------------------------------------------------

class TestLootCharacterRegistrationValidation:
    @pytest.mark.asyncio
    async def test_registration_from_another_static_rejected(
        self,
        client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession,
        test_user: User,
        group_and_tier,
        player,
    ):
        """Using a registration from a different static must return 400."""
        group, tier = group_and_tier

        # Create a second static group and a registration in it
        other_group = await create_static_group(
            session,
            test_user,
            name="Other Static",
        )
        other_tier = await create_tier_snapshot(session, other_group)
        other_player = await create_snapshot_player(session, other_tier, name="Other Player")
        other_reg = await create_static_character_registration(
            session,
            other_group,
            other_player,
            manual_character_name="Foreign Character",
        )

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(
                player,
                recipientCharacterRegistrationId=other_reg.id,
            ),
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "does not belong" in response.json()["detail"].lower() or response.status_code == 400

    @pytest.mark.asyncio
    async def test_registration_for_wrong_player_rejected(
        self,
        client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession,
        test_user: User,
        group_and_tier,
        player,
    ):
        """Using another player's registration must return 400."""
        group, tier = group_and_tier

        # Create a second player in the same static and a registration for them
        other_player = await create_snapshot_player(session, tier, name="A'money Alala", job="NIN")
        other_reg = await create_static_character_registration(
            session,
            group,
            other_player,
            manual_character_name="A'money Alala",
        )

        # Attempt to log loot for `player` but supply `other_player`'s registration
        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(
                player,
                recipientCharacterRegistrationId=other_reg.id,
            ),
            headers=auth_headers,
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Test: update endpoints distinguish explicit null (clear) from absent (keep)
# ---------------------------------------------------------------------------

class TestUpdateClearSemantics:
    """PUT clear semantics for slot_augmented and notes.

    Legacy V1 edit modals send explicit null with intent to clear; v2 sends the
    '' sentinel. Both must clear. An absent field must leave the stored value
    unchanged, and an invalid slot string stays ignored.
    """

    async def _create_material_entry(self, client, auth_headers, group, tier, player):
        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log",
            json={
                "weekNumber": 1,
                "floor": "M11S",
                "materialType": "twine",
                "recipientPlayerId": player.id,
                "method": "drop",
                "slotAugmented": "head",
                "notes": "initial note",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["slotAugmented"] == "head"
        assert data["notes"] == "initial note"
        return data["id"]

    async def _create_loot_entry(self, client, auth_headers, group, tier, player):
        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player, notes="initial note"),
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["notes"] == "initial note"
        return response.json()["id"]

    @pytest.mark.asyncio
    async def test_material_update_null_clears_slot_augmented(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """Explicit null must clear slot_augmented (legacy V1's clear wire shape)."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"slotAugmented": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["slotAugmented"] is None

    @pytest.mark.asyncio
    async def test_material_update_empty_string_clears_slot_augmented(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """The '' sentinel keeps clearing slot_augmented (v2's clear wire shape)."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"slotAugmented": ""},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["slotAugmented"] is None

    @pytest.mark.asyncio
    async def test_material_update_absent_slot_augmented_left_unchanged(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """A payload that omits slotAugmented must not touch the stored value."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"weekNumber": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["weekNumber"] == 2
        assert response.json()["slotAugmented"] == "head"

    @pytest.mark.asyncio
    async def test_material_update_invalid_slot_still_ignored(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """An unknown slot string is ignored (long-standing behavior, must not clear)."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"slotAugmented": "garbage"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["slotAugmented"] == "head"

    @pytest.mark.asyncio
    async def test_material_update_null_clears_notes(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """Explicit null must clear notes."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"notes": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] is None

    @pytest.mark.asyncio
    async def test_material_update_empty_string_clears_notes(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """The '' sentinel clears notes and normalizes to null (not stored as '')."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"notes": ""},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] is None

    @pytest.mark.asyncio
    async def test_material_update_absent_notes_left_unchanged(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """A payload that omits notes must not touch the stored value."""
        group, tier = group_and_tier
        entry_id = await self._create_material_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log/{entry_id}",
            json={"weekNumber": 3},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] == "initial note"

    @pytest.mark.asyncio
    async def test_loot_update_null_clears_notes(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """Explicit null must clear notes on loot-log entries too."""
        group, tier = group_and_tier
        entry_id = await self._create_loot_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log/{entry_id}",
            json={"notes": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] is None

    @pytest.mark.asyncio
    async def test_loot_update_absent_notes_left_unchanged(
        self, client: AsyncClient, auth_headers: dict, group_and_tier, player,
    ):
        """A loot-log payload that omits notes must not touch the stored value."""
        group, tier = group_and_tier
        entry_id = await self._create_loot_entry(client, auth_headers, group, tier, player)

        response = await client.put(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log/{entry_id}",
            json={"weekNumber": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] == "initial note"
