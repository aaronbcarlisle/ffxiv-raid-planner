"""AD1b Task 3: GET /api/admin/logs (R-AD-H).

Rows are inserted directly through the ORM with fixed ``created_at`` strings
in the helper's own form (``datetime(..., tzinfo=timezone.utc).isoformat()``,
i.e. ``+00:00``) except where a test explicitly varies the input format
(``Z``, an offset, date-only, or a raw un-encoded ``+``).
"""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import AuditLog, User
from tests.factories import create_static_group, create_user

pytestmark = pytest.mark.asyncio


def _iso(dt: datetime) -> str:
    return dt.isoformat()


T1 = datetime(2026, 9, 29, 9, 0, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 9, 29, 10, 0, 0, tzinfo=timezone.utc)
T3 = datetime(2026, 9, 29, 11, 0, 0, tzinfo=timezone.utc)


async def _insert_row(
    session: AsyncSession,
    *,
    actor: User,
    action: str,
    target_type: str = "static",
    target_id: str = "target-1",
    target_label: str = "Target One",
    static_group_id: str | None = "group-1",
    credential: str = "cookie",
    created_at: str,
    old_values: dict | None = None,
    new_values: dict | None = None,
) -> AuditLog:
    row = AuditLog(
        created_at=created_at,
        actor_user_id=actor.id,
        actor_label=actor.effective_name,
        credential=credential,
        admin_override=False,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        static_group_id=static_group_id,
        old_values=old_values,
        new_values=new_values,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@pytest_asyncio.fixture
async def admin_user(session: AsyncSession) -> User:
    user = await create_user(
        session, discord_id="999888777666555442", discord_username="logs_api_admin"
    )
    user.is_admin = True
    await session.commit()
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(admin_user.id)}"}


@pytest_asyncio.fixture
async def actor_a(session: AsyncSession) -> User:
    return await create_user(session, discord_id="1000000000000000001", discord_username="actor_a")


@pytest_asyncio.fixture
async def actor_b(session: AsyncSession) -> User:
    return await create_user(session, discord_id="1000000000000000002", discord_username="actor_b")


async def _mint_api_key(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    response = await client.post(
        "/api/auth/api-keys", json={"name": "Logs API Test Key"}, headers=headers
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['key']}"}


# ── Auth ─────────────────────────────────────────────────────────────────


class TestAuth:
    async def test_non_admin_jwt_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/admin/logs", headers=auth_headers)
        assert response.status_code == 403

    async def test_admin_api_key_403(
        self, client: AsyncClient, admin_headers: dict
    ):
        api_key_headers = await _mint_api_key(client, admin_headers)
        response = await client.get("/api/admin/logs", headers=api_key_headers)
        assert response.status_code == 403


# ── Listing, ordering, filters ──────────────────────────────────────────


class TestListingAndOrdering:
    async def test_no_filters_returns_all_rows_ordered(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a, actor_b
    ):
        row_early = await _insert_row(
            session, actor=actor_a, action="static.updated", created_at=_iso(T1)
        )
        row_tie_1 = await _insert_row(
            session, actor=actor_a, action="static.deleted", created_at=_iso(T2)
        )
        row_tie_2 = await _insert_row(
            session, actor=actor_b, action="member.added", created_at=_iso(T2)
        )
        row_latest = await _insert_row(
            session, actor=actor_b, action="error.reviewed", created_at=_iso(T3)
        )
        assert row_tie_2.id > row_tie_1.id

        response = await client.get("/api/admin/logs", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 4
        assert body["page"] == 1
        assert body["pageSize"] == 50
        ids = [item["id"] for item in body["items"]]
        # created_at desc, id desc — the T2 tie resolves higher-id-first.
        assert ids == [row_latest.id, row_tie_2.id, row_tie_1.id, row_early.id]


class TestFilters:
    async def test_actor_filter(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a, actor_b
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))
        await _insert_row(session, actor=actor_b, action="static.deleted", created_at=_iso(T2))

        response = await client.get(
            "/api/admin/logs", params={"actor": actor_a.id}, headers=admin_headers
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["actorUserId"] == actor_a.id

    async def test_target_type_and_id_filter(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(
            session,
            actor=actor_a,
            action="tier.deleted",
            target_type="tier",
            target_id="snap-1",
            created_at=_iso(T1),
        )
        await _insert_row(
            session,
            actor=actor_a,
            action="player.deleted",
            target_type="player",
            target_id="player-1",
            created_at=_iso(T2),
        )

        response = await client.get(
            "/api/admin/logs",
            params={"target_type": "tier", "target_id": "snap-1"},
            headers=admin_headers,
        )
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["targetType"] == "tier"
        assert body["items"][0]["targetId"] == "snap-1"

    async def test_static_id_filter(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(
            session,
            actor=actor_a,
            action="static.updated",
            static_group_id="group-A",
            created_at=_iso(T1),
        )
        await _insert_row(
            session,
            actor=actor_a,
            action="static.updated",
            static_group_id="group-B",
            created_at=_iso(T2),
        )

        response = await client.get(
            "/api/admin/logs", params={"static_id": "group-A"}, headers=admin_headers
        )
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["staticGroupId"] == "group-A"

    async def test_credential_filter(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(
            session,
            actor=actor_a,
            action="member.role_changed",
            credential="cookie",
            created_at=_iso(T1),
        )
        await _insert_row(
            session,
            actor=actor_a,
            action="member.role_changed",
            credential="api_key",
            created_at=_iso(T2),
        )

        response = await client.get(
            "/api/admin/logs", params={"credential": "api_key"}, headers=admin_headers
        )
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["credential"] == "api_key"


class TestActionPrefix:
    async def test_prefix_matches_family_only(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))
        await _insert_row(session, actor=actor_a, action="static.deleted", created_at=_iso(T2))
        await _insert_row(
            session, actor=actor_a, action="statics.other", created_at=_iso(T3)
        )
        await _insert_row(
            session,
            actor=actor_a,
            action="member.added",
            created_at=_iso(datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc)),
        )

        response = await client.get(
            "/api/admin/logs", params={"action": "static."}, headers=admin_headers
        )
        body = response.json()
        actions = {item["action"] for item in body["items"]}
        assert actions == {"static.updated", "static.deleted"}

    async def test_action_case_insensitive(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))

        response = await client.get(
            "/api/admin/logs", params={"action": "STATIC."}, headers=admin_headers
        )
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["action"] == "static.updated"

    async def test_percent_and_underscore_are_literal(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="error.reviewed", created_at=_iso(T1))
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T2))

        no_wildcard = await client.get(
            "/api/admin/logs", params={"action": "err%"}, headers=admin_headers
        )
        assert no_wildcard.json()["total"] == 0

        no_underscore_match = await client.get(
            "/api/admin/logs", params={"action": "static_"}, headers=admin_headers
        )
        assert no_underscore_match.json()["total"] == 0


class TestDateRange:
    async def test_from_inclusive_to_exclusive_at_exact_timestamp(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))
        row_at_t2 = await _insert_row(
            session, actor=actor_a, action="static.deleted", created_at=_iso(T2)
        )
        await _insert_row(session, actor=actor_a, action="error.reviewed", created_at=_iso(T3))

        from_response = await client.get(
            "/api/admin/logs", params={"from": _iso(T2)}, headers=admin_headers
        )
        from_ids = {item["id"] for item in from_response.json()["items"]}
        assert row_at_t2.id in from_ids

        to_response = await client.get(
            "/api/admin/logs", params={"to": _iso(T2)}, headers=admin_headers
        )
        to_ids = {item["id"] for item in to_response.json()["items"]}
        assert row_at_t2.id not in to_ids

    async def test_to_format_variants_select_same_rows(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))
        await _insert_row(session, actor=actor_a, action="static.deleted", created_at=_iso(T2))

        # All three name the same instant, 2026-09-30T00:00:00 UTC — strictly
        # after both rows (T1=09:00, T2=10:00 UTC on the 29th) so both are
        # selected by the exclusive "to" boundary.
        cutoff_z = "2026-09-30T00:00:00Z"
        cutoff_offset = "2026-09-30T05:30:00%2B05:30"
        cutoff_date = "2026-09-30"

        r_z = await client.get("/api/admin/logs", params={"to": cutoff_z}, headers=admin_headers)
        r_date = await client.get(
            "/api/admin/logs", params={"to": cutoff_date}, headers=admin_headers
        )
        r_offset = await client.get(
            f"/api/admin/logs?to={cutoff_offset}", headers=admin_headers
        )

        assert r_z.status_code == r_date.status_code == r_offset.status_code == 200
        ids_z = {item["id"] for item in r_z.json()["items"]}
        ids_date = {item["id"] for item in r_date.json()["items"]}
        ids_offset = {item["id"] for item in r_offset.json()["items"]}
        assert ids_z == ids_date
        assert ids_z == ids_offset
        assert len(ids_z) == 2

    async def test_raw_literal_plus_in_offset_is_422(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        await _insert_row(session, actor=actor_a, action="static.updated", created_at=_iso(T1))

        # Sent as a literal query string (not params=), so httpx does NOT
        # percent-encode the '+' — Starlette's query parser then decodes it
        # as a space, and the resulting string fails datetime.fromisoformat.
        response = await client.get(
            "/api/admin/logs?to=2026-09-29T05:30:00+05:30", headers=admin_headers
        )
        assert response.status_code == 422

    async def test_garbage_from_is_422(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict
    ):
        response = await client.get(
            "/api/admin/logs", params={"from": "garbage"}, headers=admin_headers
        )
        assert response.status_code == 422


class TestPaginationValidation:
    async def test_page_size_over_100_is_422(self, client: AsyncClient, admin_headers: dict):
        response = await client.get(
            "/api/admin/logs", params={"page_size": 101}, headers=admin_headers
        )
        assert response.status_code == 422

    async def test_page_zero_is_422(self, client: AsyncClient, admin_headers: dict):
        response = await client.get(
            "/api/admin/logs", params={"page": 0}, headers=admin_headers
        )
        assert response.status_code == 422

    async def test_total_independent_of_page(
        self, client: AsyncClient, session: AsyncSession, admin_headers: dict, actor_a
    ):
        for i, ts in enumerate([T1, T2, T3]):
            await _insert_row(
                session,
                actor=actor_a,
                action="static.updated",
                target_id=f"t{i}",
                created_at=_iso(ts),
            )

        page1 = await client.get(
            "/api/admin/logs", params={"page": 1, "page_size": 1}, headers=admin_headers
        )
        page2 = await client.get(
            "/api/admin/logs", params={"page": 2, "page_size": 1}, headers=admin_headers
        )
        assert page1.json()["total"] == 3
        assert page2.json()["total"] == 3
        assert len(page1.json()["items"]) == 1
        assert len(page2.json()["items"]) == 1
        assert page1.json()["items"][0]["id"] != page2.json()["items"][0]["id"]


class TestCredentialValidation:
    async def test_invalid_credential_is_422(self, client: AsyncClient, admin_headers: dict):
        response = await client.get(
            "/api/admin/logs", params={"credential": "cookiex"}, headers=admin_headers
        )
        assert response.status_code == 422


# ── Secret stripping + end-to-end ────────────────────────────────────────


class TestSecretStrippingAndEndToEnd:
    async def test_webhook_secret_absent_from_response(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_headers: dict,
        auth_headers: dict,
        test_user,
    ):
        group = await create_static_group(
            session,
            owner=test_user,
            name="Secret Static Logs",
            settings={"discovery": {"webhookUrl": "https://old-hook"}},
        )

        update_response = await client.put(
            f"/api/static-groups/{group.id}",
            json={"settings": {"discovery": {"webhook_url": "https://new-hook", "other": "keep"}}},
            headers=auth_headers,
        )
        assert update_response.status_code == 200

        logs_response = await client.get(
            "/api/admin/logs", params={"static_id": group.id}, headers=admin_headers
        )
        assert logs_response.status_code == 200
        body_text = logs_response.text
        assert "old-hook" not in body_text
        assert "new-hook" not in body_text
        assert "webhook_url" not in body_text
        assert "webhookUrl" not in body_text

        row = logs_response.json()["items"][0]
        assert row["action"] == "static.updated"
        assert row["newValues"]["settings"]["discovery"] == {"other": "keep"}

    async def test_end_to_end_delete_then_find_via_static_id(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_headers: dict,
        auth_headers: dict,
        test_user,
    ):
        group = await create_static_group(
            session, owner=test_user, name="Deleted Static For Logs"
        )
        group_id = group.id

        delete_response = await client.delete(
            f"/api/static-groups/{group_id}", headers=auth_headers
        )
        assert delete_response.status_code == 204

        logs_response = await client.get(
            "/api/admin/logs", params={"static_id": group_id}, headers=admin_headers
        )
        assert logs_response.status_code == 200
        body = logs_response.json()
        assert body["total"] == 1
        row = body["items"][0]
        assert row["action"] == "static.deleted"
        assert row["staticGroupId"] == group_id
        assert row["targetId"] == group_id
