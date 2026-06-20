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
