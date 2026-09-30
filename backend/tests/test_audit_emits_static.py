"""AD1b Task 2: product-router destructive emits.

Covers static.updated / static.deleted / static.ownership_transferred /
static.duplicated (static_groups.py), member.added / member.removed /
member.role_changed (static_groups.py), tier.deleted / player.deleted
(tiers.py) and week.reverted (loot_tracking.py) — R-AD-A/B/F/G. Every 4xx
path is asserted to leave zero audit rows.
"""

import asyncio

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import AuditLog, MemberRole, Membership, StaticGroup, User
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def admin_user(session: AsyncSession) -> User:
    user = await create_user(
        session, discord_id="999888777666555443", discord_username="static_audit_admin"
    )
    user.is_admin = True
    await session.flush()
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(admin_user.id)}"}


async def _audit_rows(session: AsyncSession) -> list[AuditLog]:
    result = await session.execute(select(AuditLog).order_by(AuditLog.id))
    return list(result.scalars().all())


async def _role_of(session: AsyncSession, user_id: str, group_id: str) -> str | None:
    result = await session.execute(
        select(Membership.role).where(
            Membership.user_id == user_id, Membership.static_group_id == group_id
        )
    )
    return result.scalar_one_or_none()


async def _mint_api_key(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    """Mint a real xrp_ key for whichever user's cookie/JWT headers are given."""
    response = await client.post(
        "/api/auth/api-keys", json={"name": "Static Audit Test Key"}, headers=headers
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['key']}"}


# ── Static verbs ────────────────────────────────────────────────────────────


class TestStaticUpdateEmits:
    async def test_owner_update_emits_changed_keys_only(
        self, client: AsyncClient, session, test_user, test_group, auth_headers
    ):
        old_name = test_group.name

        response = await client.put(
            f"/api/static-groups/{test_group.id}",
            json={"name": "Renamed Static", "is_public": True},
            headers=auth_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "static.updated"
        assert row.target_type == "static"
        assert row.target_id == test_group.id
        assert row.static_group_id == test_group.id
        assert row.old_values == {"name": old_name, "is_public": False}
        assert row.new_values == {"name": "Renamed Static", "is_public": True}
        assert row.admin_override is False

    async def test_update_with_no_actual_change_writes_nothing(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        response = await client.put(
            f"/api/static-groups/{test_group.id}",
            json={"name": test_group.name},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert await _audit_rows(session) == []

    async def test_settings_secrets_stripped_both_sides(
        self, client: AsyncClient, session, test_user, auth_headers
    ):
        group = await create_static_group(
            session,
            owner=test_user,
            name="Secret Static",
            settings={"discovery": {"webhookUrl": "https://old-hook", "other": "old-keep"}},
        )

        response = await client.put(
            f"/api/static-groups/{group.id}",
            json={
                "settings": {
                    "discovery": {
                        "webhook_url": "https://new-hook-1",
                        "webhookUrl": "https://new-hook-2",
                        "other": "new-keep",
                    }
                }
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        old_discovery = row.old_values["settings"]["discovery"]
        new_discovery = row.new_values["settings"]["discovery"]
        assert "webhook_url" not in old_discovery and "webhookUrl" not in old_discovery
        assert "webhook_url" not in new_discovery and "webhookUrl" not in new_discovery
        assert old_discovery == {"other": "old-keep"}
        assert new_discovery == {"other": "new-keep"}

    async def test_admin_non_member_update_is_override(
        self, client: AsyncClient, session, test_group, admin_headers
    ):
        response = await client.put(
            f"/api/static-groups/{test_group.id}",
            json={"name": "Admin Renamed"},
            headers=admin_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is True

    async def test_admin_real_owner_update_and_delete_are_not_override(
        self, client: AsyncClient, session, admin_user, admin_headers
    ):
        own_group = await create_static_group(session, owner=admin_user, name="Admin Owned")

        response = await client.put(
            f"/api/static-groups/{own_group.id}",
            json={"name": "Admin Renamed Own"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        await asyncio.sleep(0.02)

        response = await client.delete(
            f"/api/static-groups/{own_group.id}", headers=admin_headers
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 2
        assert rows[0].action == "static.updated"
        assert rows[0].admin_override is False
        assert rows[1].action == "static.deleted"
        assert rows[1].admin_override is False


class TestStaticDeleteEmits:
    async def test_delete_emits_and_row_survives_group(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        group_id = test_group.id
        old_name = test_group.name
        old_share_code = test_group.share_code

        response = await client.delete(
            f"/api/static-groups/{group_id}", headers=auth_headers
        )
        assert response.status_code == 204

        result = await session.execute(select(StaticGroup).where(StaticGroup.id == group_id))
        assert result.scalar_one_or_none() is None

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "static.deleted"
        assert row.target_type == "static"
        assert row.target_id == group_id
        assert row.static_group_id == group_id
        assert row.old_values == {
            "name": old_name,
            "share_code": old_share_code,
            "is_public": False,
        }

    async def test_admin_member_seat_delete_is_override(
        self, client: AsyncClient, session, test_user, test_group, admin_user, admin_headers
    ):
        await create_membership(session, admin_user, test_group, role=MemberRole.MEMBER)

        response = await client.delete(
            f"/api/static-groups/{test_group.id}", headers=admin_headers
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is True


class TestOwnershipTransferEmits:
    async def test_transfer_to_member_emits_old_new_owner(
        self, client: AsyncClient, session, test_user, test_user_2, test_group, auth_headers
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/transfer-ownership"
            f"?new_owner_id={test_user_2.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "static.ownership_transferred"
        assert row.old_values == {"owner_id": test_user.id}
        assert row.new_values == {"owner_id": test_user_2.id}

    async def test_transfer_to_non_member_404_writes_nothing(
        self, client: AsyncClient, session, test_user_3, test_group, auth_headers
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/transfer-ownership"
            f"?new_owner_id={test_user_3.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert await _audit_rows(session) == []

    async def test_admin_non_member_transfer_demotes_real_owner(
        self,
        client: AsyncClient,
        session,
        test_user,
        test_user_2,
        test_group,
        admin_user,
        admin_headers,
    ):
        old_id, new_id, admin_id, group_id = (
            test_user.id,
            test_user_2.id,
            admin_user.id,
            test_group.id,
        )
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{group_id}/transfer-ownership"
            f"?new_owner_id={new_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200

        session.expire_all()
        assert await _role_of(session, old_id, group_id) == MemberRole.LEAD.value
        assert await _role_of(session, new_id, group_id) == MemberRole.OWNER.value
        assert await _role_of(session, admin_id, group_id) is None
        group = await session.get(StaticGroup, group_id)
        assert group.owner_id == new_id

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is True
        assert rows[0].old_values == {"owner_id": old_id}
        assert rows[0].new_values == {"owner_id": new_id}

    async def test_admin_with_member_seat_keeps_own_row(
        self,
        client: AsyncClient,
        session,
        test_user,
        test_user_2,
        test_group,
        admin_user,
        admin_headers,
    ):
        old_id, new_id, admin_id, group_id = (
            test_user.id,
            test_user_2.id,
            admin_user.id,
            test_group.id,
        )
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
        await create_membership(session, admin_user, test_group, role=MemberRole.MEMBER)

        response = await client.post(
            f"/api/static-groups/{group_id}/transfer-ownership"
            f"?new_owner_id={new_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200

        session.expire_all()
        assert await _role_of(session, admin_id, group_id) == MemberRole.MEMBER.value
        assert await _role_of(session, old_id, group_id) == MemberRole.LEAD.value
        assert await _role_of(session, new_id, group_id) == MemberRole.OWNER.value


    async def test_admin_real_owner_transfer_is_not_override(
        self,
        client: AsyncClient,
        session,
        test_user_2,
        admin_user,
        admin_headers,
    ):
        own_group = await create_static_group(session, owner=admin_user, name="Admin Owned 3")
        await create_membership(session, test_user_2, own_group, role=MemberRole.MEMBER)
        group_id, admin_id, new_id = own_group.id, admin_user.id, test_user_2.id

        response = await client.post(
            f"/api/static-groups/{group_id}/transfer-ownership?new_owner_id={new_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200

        session.expire_all()
        assert await _role_of(session, admin_id, group_id) == MemberRole.LEAD.value
        assert await _role_of(session, new_id, group_id) == MemberRole.OWNER.value
        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is False



class TestDuplicateEmits:
    async def test_duplicate_emits_source_and_target_ids(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/duplicate",
            json={"newName": "Copy Static", "copyTiers": False, "copyPlayers": False},
            headers=auth_headers,
        )
        assert response.status_code == 201
        new_group_id = response.json()["id"]

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "static.duplicated"
        assert row.target_id == new_group_id
        assert row.static_group_id == test_group.id
        assert row.new_values == {"source_group_id": test_group.id, "name": "Copy Static"}
        assert row.admin_override is False


# ── Member verbs ─────────────────────────────────────────────────────────────


class TestMemberAddEmits:
    async def test_add_emits_role(
        self, client: AsyncClient, session, test_user_2, test_group, auth_headers
    ):
        response = await client.post(
            f"/api/static-groups/{test_group.id}/members"
            f"?user_id={test_user_2.id}&role=member",
            headers=auth_headers,
        )
        assert response.status_code == 201

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "member.added"
        assert row.target_type == "user"
        assert row.target_id == test_user_2.id
        assert row.target_label == test_user_2.effective_name
        assert row.new_values == {"role": "member"}
        assert row.admin_override is False


class TestMemberRoleChangeEmits:
    async def test_role_change_emits_old_new(
        self, client: AsyncClient, session, test_user_2, test_group, auth_headers
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)

        response = await client.put(
            f"/api/static-groups/{test_group.id}/members/{test_user_2.id}",
            json={"role": "lead"},
            headers=auth_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "member.role_changed"
        assert row.old_values == {"role": "member"}
        assert row.new_values == {"role": "lead"}

    async def test_admin_member_seat_self_role_change_is_override(
        self, client: AsyncClient, session, test_group, admin_user, admin_headers
    ):
        await create_membership(session, admin_user, test_group, role=MemberRole.MEMBER)
        group_id, admin_id = test_group.id, admin_user.id

        response = await client.put(
            f"/api/static-groups/{group_id}/members/{admin_id}",
            json={"role": "lead"},
            headers=admin_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].action == "member.role_changed"
        assert rows[0].admin_override is True

    async def test_role_change_with_api_key_is_api_key_credential(
        self,
        client: AsyncClient,
        session,
        test_user_2,
        test_user_3,
        test_group,
        auth_headers_user2,
    ):
        # test_user_2 is a real lead of test_group; test_user_3 is a member
        # a lead can demote member->viewer (not ->lead) using a minted xrp_
        # key (the plugin-key scenario).
        await create_membership(session, test_user_2, test_group, role=MemberRole.LEAD)
        await create_membership(session, test_user_3, test_group, role=MemberRole.MEMBER)
        api_key_headers = await _mint_api_key(client, auth_headers_user2)

        response = await client.put(
            f"/api/static-groups/{test_group.id}/members/{test_user_3.id}",
            json={"role": "viewer"},
            headers=api_key_headers,
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].credential == "api_key"


class TestMemberRemoveEmits:
    async def test_manager_removes_member_with_linked_card(
        self, client: AsyncClient, session, test_user, test_user_2, test_group, auth_headers
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
        tier = await create_tier_snapshot(session, test_group)
        player = await create_snapshot_player(session, tier, name="Linked Card")
        player.user_id = test_user_2.id
        await session.flush()

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/members/{test_user_2.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "member.removed"
        assert row.old_values == {"role": "member", "unlinked_player_count": 1}
        assert row.admin_override is False

    async def test_self_leave_actor_equals_target(
        self, client: AsyncClient, session, test_user_2, test_group, auth_headers_user2
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/members/{test_user_2.id}"
            f"?unlink_players=false",
            headers=auth_headers_user2,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "member.removed"
        assert row.actor_user_id == row.target_id == test_user_2.id
        assert row.old_values == {"role": "member", "unlinked_player_count": 0}

    async def test_admin_real_owner_remove_is_not_override(
        self, client: AsyncClient, session, admin_user, admin_headers, test_user_2
    ):
        own_group = await create_static_group(session, owner=admin_user, name="Admin Owned 2")
        await create_membership(session, test_user_2, own_group, role=MemberRole.MEMBER)

        response = await client.delete(
            f"/api/static-groups/{own_group.id}/members/{test_user_2.id}",
            headers=admin_headers,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is False

    async def test_removing_owner_writes_nothing(
        self, client: AsyncClient, session, test_user, test_user_2, test_group, auth_headers_user2
    ):
        await create_membership(session, test_user_2, test_group, role=MemberRole.LEAD)

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/members/{test_user.id}",
            headers=auth_headers_user2,
        )
        assert response.status_code == 403
        assert await _audit_rows(session) == []


# ── Tier / player / week ─────────────────────────────────────────────────────


class TestTierDeleteEmits:
    async def test_delete_tier_emits(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        tier = await create_tier_snapshot(session, test_group)
        tier_slug, tier_id, is_active = tier.tier_id, tier.id, tier.is_active

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/tiers/{tier_slug}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "tier.deleted"
        assert row.target_type == "tier"
        assert row.target_id == tier_id
        assert row.old_values == {"tier_id": tier_slug, "is_active": is_active}

    async def test_admin_real_owner_delete_tier_is_not_override(
        self, client: AsyncClient, session, admin_user, admin_headers
    ):
        own_group = await create_static_group(session, owner=admin_user, name="Admin Owned 3")
        tier = await create_tier_snapshot(session, own_group)

        response = await client.delete(
            f"/api/static-groups/{own_group.id}/tiers/{tier.tier_id}",
            headers=admin_headers,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is False


class TestPlayerDeleteEmits:
    async def test_delete_player_emits_name(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        tier = await create_tier_snapshot(session, test_group)
        player = await create_snapshot_player(session, tier, name="Doomed Card")

        response = await client.delete(
            f"/api/static-groups/{test_group.id}/tiers/{tier.tier_id}/players/{player.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "player.deleted"
        assert row.old_values["name"] == "Doomed Card"


class TestWeekRevertEmits:
    async def test_start_then_revert_emits_week_diff(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        tier = await create_tier_snapshot(session, test_group)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{tier.tier_id}/start-next-week",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["currentWeek"] == 2

        await asyncio.sleep(0.02)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{tier.tier_id}/revert-week",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["currentWeek"] == 1

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "week.reverted"
        assert row.target_type == "tier"
        assert row.target_id == tier.id
        assert row.target_label == tier.tier_id
        assert row.old_values == {"week": 2}
        assert row.new_values == {"week": 1}

    async def test_revert_at_week_one_writes_nothing(
        self, client: AsyncClient, session, test_group, auth_headers
    ):
        tier = await create_tier_snapshot(session, test_group)

        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{tier.tier_id}/revert-week",
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert await _audit_rows(session) == []
