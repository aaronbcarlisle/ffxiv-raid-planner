"""AD1b Task 1: the admin_override seam and the admin-verb audit emits.

Covers permissions.is_admin_override / admin_override_for (R-AD-A, OWNER-1:
override = the action was allowed ONLY by admin status), the error-review
emits (error.reviewed / error.unreviewed / error.batch_reviewed), the catalog
emits (catalog.seeded / catalog.synced, R-AD-C) and player.admin_assigned
(R-AD-E). Every 4xx path is asserted to leave zero audit rows (R-AD-B).
"""

import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import AuditLog, MemberRole, Membership, User
from app.models.analytics import ErrorReport
from app.permissions import (
    ADMIN_VIRTUAL_ID_PREFIX,
    admin_override_for,
    create_admin_membership,
    is_admin_override,
)
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

FP_A = "a" * 64
FP_B = "b" * 64


@pytest_asyncio.fixture
async def admin_user(session: AsyncSession) -> User:
    user = await create_user(
        session, discord_id="999888777666555444", discord_username="audit_admin"
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


async def _seed_errors(
    session: AsyncSession, fingerprint: str, messages: list[str]
) -> None:
    """One ErrorReport per message; created_at ascends so 'first' is deterministic."""
    for index, message in enumerate(messages):
        session.add(
            ErrorReport(
                fingerprint=fingerprint,
                error_type="TypeError",
                message=message,
                severity="error",
                source="frontend",
                is_reviewed=False,
                created_at=f"2026-01-01T00:00:0{index}+00:00",
            )
        )
    await session.flush()


# ── Seam ──────────────────────────────────────────────────────────────────────


class TestIsAdminOverride:
    def test_none_is_not_override(self):
        assert is_admin_override(None) is False

    def test_real_membership_is_not_override(self):
        real = Membership(
            id=str(uuid.uuid4()), user_id="u", static_group_id="g", role="owner"
        )
        assert is_admin_override(real) is False

    def test_virtual_row_is_override(self):
        virtual = create_admin_membership("u", "g")
        assert virtual.id.startswith(ADMIN_VIRTUAL_ID_PREFIX)
        assert is_admin_override(virtual) is True


class TestAdminOverrideFor:
    """OWNER-1: True only when the actor holds the virtual row AND has no real
    membership or a real role below the check's min_role."""

    @pytest_asyncio.fixture
    async def group(self, session: AsyncSession, test_user: User):
        return await create_static_group(session, owner=test_user, name="Seam Static")

    async def test_not_a_member(self, session, admin_user, group):
        virtual = create_admin_membership(admin_user.id, group.id)
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, MemberRole.LEAD
        ) is True
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, None
        ) is True

    async def test_real_member_seat_below_lead(self, session, admin_user, group):
        await create_membership(session, admin_user, group, role=MemberRole.MEMBER)
        virtual = create_admin_membership(admin_user.id, group.id)
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, MemberRole.LEAD
        ) is True

    async def test_real_lead_meets_lead(self, session, admin_user, group):
        await create_membership(session, admin_user, group, role=MemberRole.LEAD)
        virtual = create_admin_membership(admin_user.id, group.id)
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, MemberRole.LEAD
        ) is False

    async def test_real_lead_below_owner(self, session, admin_user, group):
        await create_membership(session, admin_user, group, role=MemberRole.LEAD)
        virtual = create_admin_membership(admin_user.id, group.id)
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, MemberRole.OWNER
        ) is True

    async def test_real_owner_meets_owner(self, session, admin_user):
        owned = await create_static_group(session, owner=admin_user, name="Admin's Own")
        virtual = create_admin_membership(admin_user.id, owned.id)
        assert await admin_override_for(
            session, admin_user.id, owned.id, virtual, MemberRole.OWNER
        ) is False

    async def test_real_member_with_no_min_role(self, session, admin_user, group):
        await create_membership(session, admin_user, group, role=MemberRole.MEMBER)
        virtual = create_admin_membership(admin_user.id, group.id)
        assert await admin_override_for(
            session, admin_user.id, group.id, virtual, None
        ) is False

    async def test_non_virtual_membership_short_circuits(
        self, session, engine, admin_user, group, count_statements
    ):
        real = await create_membership(session, admin_user, group, role=MemberRole.LEAD)
        with count_statements(engine) as counts:
            assert await admin_override_for(
                session, admin_user.id, group.id, real, MemberRole.OWNER
            ) is False
        assert counts.n == 0


# ── Error verbs ───────────────────────────────────────────────────────────────


class TestErrorReviewEmits:
    async def test_review_emits_one_row(
        self, client: AsyncClient, session, admin_user, admin_headers
    ):
        await _seed_errors(session, FP_A, ["first message", "second message"])
        await _seed_errors(session, FP_B, ["other group"])

        response = await client.post(
            f"/api/admin/analytics/errors/{FP_A}/review", headers=admin_headers
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "error.reviewed"
        assert row.target_type == "error"
        assert row.target_id == FP_A
        assert row.target_label == "first message"
        assert row.actor_user_id == admin_user.id
        assert row.credential == "cookie"
        assert row.request_id is not None
        assert row.admin_override is False
        assert row.static_group_id is None
        assert row.old_values is None
        assert row.new_values == {"is_reviewed": True, "rows": 2}

    async def test_unreview_emits_one_row(
        self, client: AsyncClient, session, admin_headers
    ):
        await _seed_errors(session, FP_A, ["only message"])

        response = await client.post(
            f"/api/admin/analytics/errors/{FP_A}/unreview", headers=admin_headers
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].action == "error.unreviewed"
        assert rows[0].target_id == FP_A
        assert rows[0].target_label == "only message"
        assert rows[0].new_values == {"is_reviewed": False, "rows": 1}

    async def test_batch_review_emits_one_row(
        self, client: AsyncClient, session, admin_headers
    ):
        await _seed_errors(session, FP_A, ["m1", "m2"])
        await _seed_errors(session, FP_B, ["m3"])

        response = await client.post(
            "/api/admin/analytics/errors/batch-review",
            json={"fingerprints": [FP_A, FP_B], "action": "review"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["count"] == 3

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "error.batch_reviewed"
        assert row.target_type == "error"
        assert row.target_id == FP_A
        assert row.target_label == "2 error groups"
        assert row.credential == "cookie"
        assert row.admin_override is False
        assert row.new_values == {
            "action": "review",
            "fingerprints": [FP_A, FP_B],
            "rows": 3,
        }

    async def test_unknown_fingerprint_404_writes_nothing(
        self, client: AsyncClient, session, admin_headers
    ):
        await _seed_errors(session, FP_A, ["exists"])

        for path in (f"/api/admin/analytics/errors/{FP_B}/review",
                     f"/api/admin/analytics/errors/{FP_B}/unreview"):
            response = await client.post(path, headers=admin_headers)
            assert response.status_code == 404

        response = await client.post(
            "/api/admin/analytics/errors/batch-review",
            json={"fingerprints": [FP_B], "action": "unreview"},
            headers=admin_headers,
        )
        assert response.status_code == 404

        assert await _audit_rows(session) == []


# ── Catalog verbs ─────────────────────────────────────────────────────────────


class TestCatalogEmits:
    async def test_seed_emits_counts(
        self, client: AsyncClient, session, admin_user, admin_headers
    ):
        response = await client.post(
            "/api/admin/collection-catalog/seed", headers=admin_headers
        )
        assert response.status_code == 200
        body = response.json()
        assert body["seeded"] is True
        count = body["counts"]["internal"]
        assert count > 0

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "catalog.seeded"
        assert row.target_type == "catalog"
        assert row.target_id == "collection-catalog"
        assert row.target_label == "Collection catalog"
        assert row.actor_user_id == admin_user.id
        assert row.credential == "cookie"
        assert row.admin_override is False
        assert row.static_group_id is None
        assert row.new_values == {"internal": count}

    async def test_sync_success_emits_counts(
        self, client: AsyncClient, session, admin_headers
    ):
        counts = {"mount": 3, "minion": 1, "skipped": 2}

        async def fake_sync(session):
            return counts

        with patch("app.routers.collection_catalog.sync_from_ffxiv_collect", fake_sync):
            response = await client.post(
                "/api/admin/collection-catalog/sync", headers=admin_headers
            )
        assert response.status_code == 200
        assert response.json()["synced_from_api"] is True

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].action == "catalog.synced"
        assert rows[0].target_id == "collection-catalog"
        assert rows[0].credential == "cookie"
        assert rows[0].new_values == counts

    async def test_sync_failure_writes_nothing(
        self, client: AsyncClient, session, admin_headers
    ):
        async def failing_sync(session):
            raise RuntimeError("collect is down")

        with patch("app.routers.collection_catalog.sync_from_ffxiv_collect", failing_sync):
            response = await client.post(
                "/api/admin/collection-catalog/sync", headers=admin_headers
            )
        assert response.status_code == 200
        body = response.json()
        assert body["synced_from_api"] is False
        assert body["error"] == "collect is down"

        assert await _audit_rows(session) == []


# ── Admin-assign ──────────────────────────────────────────────────────────────


class TestAdminAssignEmits:
    @pytest_asyncio.fixture
    async def roster(self, session: AsyncSession, test_user: User):
        """A static owned by test_user with one unclaimed card. IDs are cached:
        _assign_player_impl expires the session after its commit."""
        group = await create_static_group(session, owner=test_user, name="Assign Static")
        tier = await create_tier_snapshot(session, group, tier_id="aac-lightweight")
        player = await create_snapshot_player(session, tier, name="Unclaimed Card", job="DRG")
        return SimpleNamespace(
            group=group,
            tier=tier,
            group_id=group.id,
            tier_id=tier.tier_id,
            player_id=player.id,
            player_name=player.name,
        )

    def _url(self, roster, verb: str) -> str:
        return (
            f"/api/static-groups/{roster.group_id}/tiers/{roster.tier_id}"
            f"/players/{roster.player_id}/{verb}"
        )

    async def test_admin_not_a_member_is_override(
        self, client: AsyncClient, session, admin_user, admin_headers, test_user_2, roster
    ):
        admin_id, target_id = admin_user.id, test_user_2.id

        response = await client.post(
            self._url(roster, "admin-assign"),
            json={"userId": target_id, "createMembership": True, "membershipRole": "member"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["userId"] == target_id

        rows = await _audit_rows(session)
        assert len(rows) == 1
        row = rows[0]
        assert row.action == "player.admin_assigned"
        assert row.target_type == "player"
        assert row.target_id == roster.player_id
        assert row.target_label == roster.player_name
        assert row.static_group_id == roster.group_id
        assert row.actor_user_id == admin_id
        assert row.credential == "cookie"
        assert row.request_id is not None
        assert row.admin_override is True
        assert row.old_values == {"user_id": None}
        assert row.new_values["user_id"] == target_id
        assert row.new_values["membership_created"] is True
        assert row.new_values.get("unlinked_player_id") is None

    async def test_admin_who_is_real_owner_is_not_override(
        self, client: AsyncClient, session, admin_user, admin_headers, test_user_2
    ):
        group = await create_static_group(session, owner=admin_user, name="Admin Owned")
        tier = await create_tier_snapshot(session, group, tier_id="aac-lightweight")
        player = await create_snapshot_player(session, tier, name="Owner Card")
        url = f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/players/{player.id}/admin-assign"
        target_id = test_user_2.id

        response = await client.post(url, json={"userId": target_id}, headers=admin_headers)
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].action == "player.admin_assigned"
        assert rows[0].admin_override is False
        assert rows[0].new_values["membership_created"] is False

    async def test_admin_with_real_lead_seat_is_override(
        self, client: AsyncClient, session, admin_user, admin_headers, test_user_2, roster
    ):
        await create_membership(session, admin_user, roster.group, role=MemberRole.LEAD)
        target_id = test_user_2.id

        response = await client.post(
            self._url(roster, "admin-assign"), json={"userId": target_id}, headers=admin_headers
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].admin_override is True

    async def test_reassign_records_unlinked_player(
        self, client: AsyncClient, session, admin_headers, test_user_2, roster
    ):
        other = await create_snapshot_player(session, roster.tier, name="Other Card", job="WAR")
        other.user_id = test_user_2.id
        await session.flush()
        other_id, target_id = other.id, test_user_2.id

        response = await client.post(
            self._url(roster, "admin-assign"), json={"userId": target_id}, headers=admin_headers
        )
        assert response.status_code == 200

        rows = await _audit_rows(session)
        assert len(rows) == 1
        assert rows[0].new_values["user_id"] == target_id
        assert rows[0].new_values["unlinked_player_id"] == other_id
        assert rows[0].new_values["membership_created"] is False

    async def test_unknown_target_user_404_writes_nothing(
        self, client: AsyncClient, session, admin_headers, roster
    ):
        response = await client.post(
            self._url(roster, "admin-assign"),
            json={"userId": "no-such-user"},
            headers=admin_headers,
        )
        assert response.status_code == 404
        assert await _audit_rows(session) == []

    async def test_owner_assign_writes_nothing(
        self, client: AsyncClient, session, auth_headers, test_user_2, roster
    ):
        """Wave 2 owns the owner-assign verb: no row in AD1b."""
        target_id = test_user_2.id

        response = await client.post(
            self._url(roster, "owner-assign"), json={"userId": target_id}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["userId"] == target_id
        assert await _audit_rows(session) == []
