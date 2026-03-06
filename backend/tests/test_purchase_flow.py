"""Tests for the self-purchase loot logging flow.

Covers permission-sensitive purchase behavior:
- Members can log purchases for their own linked player
- Members cannot log purchases for other players
- Viewers cannot log purchases
- Leads/owners can log purchases for anyone
- Non-members are rejected (unless admin)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MemberRole
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio


async def _setup_group_with_players(session: AsyncSession):
    """Create a group with owner, tier, and two players (one linked to owner)."""
    owner = await create_user(session, discord_username="owner")
    group = await create_static_group(session, owner, name="Purchase Test Static")
    tier = await create_tier_snapshot(session, group)

    # Player linked to owner
    player_owned = await create_snapshot_player(
        session, tier, name="Owner Player", job="WAR", role="tank", position="T1",
    )
    player_owned.user_id = owner.id
    await session.flush()

    # Unlinked player
    player_other = await create_snapshot_player(
        session, tier, name="Other Player", job="WHM", role="healer", position="H1", sort_order=1,
    )

    return owner, group, tier, player_owned, player_other


def _loot_payload(player_id: str, method: str = "purchase") -> dict:
    return {
        "weekNumber": 1,
        "floor": "M9S",
        "itemSlot": "head",
        "recipientPlayerId": player_id,
        "method": method,
    }


def _material_payload(player_id: str, method: str = "purchase") -> dict:
    return {
        "weekNumber": 1,
        "floor": "M10S",
        "materialType": "twine",
        "recipientPlayerId": player_id,
        "method": method,
    }


class TestMemberSelfPurchaseLoot:
    """Members can log purchase loot for their own linked player."""

    async def test_member_can_purchase_for_own_player(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        # Create a member with a linked player
        member = await create_user(session, discord_username="member")
        await create_membership(session, member, group, role=MemberRole.MEMBER)
        player_member = await create_snapshot_player(
            session, tier, name="Member Player", job="DRG", role="melee", position="M1", sort_order=2,
        )
        player_member.user_id = member.id
        await session.flush()

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(member.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_member.id),
            headers=headers,
        )
        assert response.status_code == 201

    async def test_member_cannot_purchase_for_other_player(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        member = await create_user(session, discord_username="member2")
        await create_membership(session, member, group, role=MemberRole.MEMBER)

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(member.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_other.id),
            headers=headers,
        )
        assert response.status_code == 403

    async def test_viewer_cannot_log_purchases(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        viewer = await create_user(session, discord_username="viewer")
        await create_membership(session, viewer, group, role=MemberRole.VIEWER)
        player_viewer = await create_snapshot_player(
            session, tier, name="Viewer Player", job="BRD", role="ranged", position="R1", sort_order=2,
        )
        player_viewer.user_id = viewer.id
        await session.flush()

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(viewer.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_viewer.id),
            headers=headers,
        )
        assert response.status_code == 403

    async def test_lead_can_purchase_for_anyone(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        lead = await create_user(session, discord_username="lead")
        await create_membership(session, lead, group, role=MemberRole.LEAD)

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(lead.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_other.id),
            headers=headers,
        )
        assert response.status_code == 201

    async def test_owner_can_purchase_for_anyone(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(owner.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_other.id),
            headers=headers,
        )
        assert response.status_code == 201

    async def test_non_member_rejected(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        outsider = await create_user(session, discord_username="outsider")

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(outsider.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/loot-log",
            json=_loot_payload(player_other.id),
            headers=headers,
        )
        assert response.status_code == 403


class TestMemberSelfPurchaseMaterial:
    """Members can log purchase materials for their own linked player."""

    async def test_member_can_purchase_material_for_own_player(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, _ = await _setup_group_with_players(session)

        member = await create_user(session, discord_username="mat_member")
        await create_membership(session, member, group, role=MemberRole.MEMBER)
        player_member = await create_snapshot_player(
            session, tier, name="Mat Member Player", job="NIN", role="melee", position="M2", sort_order=3,
        )
        player_member.user_id = member.id
        await session.flush()

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(member.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log",
            json=_material_payload(player_member.id),
            headers=headers,
        )
        assert response.status_code == 201

    async def test_member_cannot_purchase_material_for_other(
        self, client: AsyncClient, session: AsyncSession,
    ):
        owner, group, tier, _, player_other = await _setup_group_with_players(session)

        member = await create_user(session, discord_username="mat_member2")
        await create_membership(session, member, group, role=MemberRole.MEMBER)

        from app.auth_utils import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token(member.id)}"}

        response = await client.post(
            f"/api/static-groups/{group.id}/tiers/{tier.id}/material-log",
            json=_material_payload(player_other.id),
            headers=headers,
        )
        assert response.status_code == 403
