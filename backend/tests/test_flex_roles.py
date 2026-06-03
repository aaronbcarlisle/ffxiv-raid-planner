"""Tests for roster personalization."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)


async def _setup_static(session: AsyncSession):
    owner = await create_user(
        session,
        discord_id="flex_owner",
        discord_username="flex_owner",
    )
    member = await create_user(
        session,
        discord_id="flex_member",
        discord_username="flex_member",
    )
    other_member = await create_user(
        session,
        discord_id="flex_other_member",
        discord_username="flex_other_member",
    )
    lead = await create_user(
        session,
        discord_id="flex_lead",
        discord_username="flex_lead",
    )
    viewer = await create_user(
        session,
        discord_id="flex_viewer",
        discord_username="flex_viewer",
    )
    static_group = await create_static_group(session, owner=owner, name="Flex Static")
    await create_membership(session, member, static_group, role=MemberRole.MEMBER)
    await create_membership(session, other_member, static_group, role=MemberRole.MEMBER)
    await create_membership(session, lead, static_group, role=MemberRole.LEAD)
    await create_membership(session, viewer, static_group, role=MemberRole.VIEWER)
    tier = await create_tier_snapshot(session, static_group, tier_id="aac-flex")
    own_player = await create_snapshot_player(session, tier, name="Own Player", job="DRG")
    own_player.user_id = member.id
    other_player = await create_snapshot_player(session, tier, name="Other Player", job="BRD")
    other_player.user_id = other_member.id
    viewer_player = await create_snapshot_player(session, tier, name="Viewer Player", job="WHM")
    viewer_player.user_id = viewer.id
    await session.flush()
    return {
        "owner": owner,
        "member": member,
        "lead": lead,
        "viewer": viewer,
        "group": static_group,
        "tier": tier,
        "own_player": own_player,
        "other_player": other_player,
        "viewer_player": viewer_player,
    }


def _headers(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.mark.asyncio
async def test_claimed_member_can_edit_own_flex_roles(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['own_player'].id}",
        json={
            "rosterTitle": "Reclear gremlin",
            "rosterNote": "Can swap for prog nights.",
            "flexRoles": ["R1", "H2"],
        },
        headers=_headers(data["member"].id),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rosterTitle"] == "Reclear gremlin"
    assert payload["rosterNote"] == "Can swap for prog nights."
    assert payload["flexRoles"] == ["R1", "H2"]


@pytest.mark.asyncio
async def test_owner_and_lead_can_edit_any_flex_roles(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    owner_response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['other_player'].id}",
        json={"flexRoles": ["MT"]},
        headers=_headers(data["owner"].id),
    )
    lead_response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['other_player'].id}",
        json={"flexRoles": ["ST", "M2"]},
        headers=_headers(data["lead"].id),
    )

    assert owner_response.status_code == 200
    assert owner_response.json()["flexRoles"] == ["MT"]
    assert lead_response.status_code == 200
    assert lead_response.json()["flexRoles"] == ["ST", "M2"]


@pytest.mark.asyncio
async def test_member_cannot_edit_another_players_flex_roles(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['other_player'].id}",
        json={"flexRoles": ["H1"]},
        headers=_headers(data["member"].id),
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_edit_flex_roles(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['viewer_player'].id}",
        json={"flexRoles": ["H1"]},
        headers=_headers(data["viewer"].id),
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_invalid_flex_role_value_is_rejected(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['own_player'].id}",
        json={"flexRoles": ["Caster"]},
        headers=_headers(data["member"].id),
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_roster_personalization_length_limits_are_rejected(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    title_response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['own_player'].id}",
        json={"rosterTitle": "x" * 41},
        headers=_headers(data["member"].id),
    )
    note_response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['own_player'].id}",
        json={"rosterNote": "x" * 161},
        headers=_headers(data["member"].id),
    )

    assert title_response.status_code == 422
    assert note_response.status_code == 422


@pytest.mark.asyncio
async def test_flex_roles_persist_after_refresh(
    client: AsyncClient,
    session: AsyncSession,
):
    data = await _setup_static(session)

    update_response = await client.put(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players/{data['own_player'].id}",
        json={"rosterTitle": "Alt job enjoyer", "rosterNote": "Happy to flex.", "flexRoles": ["R1", "H2"]},
        headers=_headers(data["member"].id),
    )
    list_response = await client.get(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players",
        headers=_headers(data["member"].id),
    )

    assert update_response.status_code == 200
    assert list_response.status_code == 200
    refreshed = next(
        player for player in list_response.json() if player["id"] == data["own_player"].id
    )
    assert refreshed["rosterTitle"] == "Alt job enjoyer"
    assert refreshed["rosterNote"] == "Happy to flex."
    assert refreshed["flexRoles"] == ["R1", "H2"]


@pytest.mark.asyncio
async def test_list_snapshot_players_accepts_uuid_in_tier_path(
    client: AsyncClient,
    session: AsyncSession,
):
    """Regression: the plugin auto-detect stores the snapshot UUID, not the slug.

    Both `tier.id` (UUID) and `tier.tier_id` (slug) must resolve to the same
    snapshot. The other tier endpoints already accept both; this guards against
    the list-players endpoint regressing back to slug-only lookup.
    """
    data = await _setup_static(session)

    by_slug = await client.get(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].tier_id}/players",
        headers=_headers(data["member"].id),
    )
    by_uuid = await client.get(
        f"/api/static-groups/{data['group'].id}/tiers/{data['tier'].id}/players",
        headers=_headers(data["member"].id),
    )

    assert by_slug.status_code == 200
    assert by_uuid.status_code == 200
    assert by_slug.json() == by_uuid.json()
