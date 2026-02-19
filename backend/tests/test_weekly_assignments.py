"""Tests for weekly assignment endpoints

Tests cover:
- GET /{groupId}/weekly-assignments (list with filters)
- POST /{groupId}/weekly-assignments (create single)
- PUT /{groupId}/weekly-assignments/{id} (update)
- DELETE /{groupId}/weekly-assignments/{id} (delete single)
- POST /{groupId}/weekly-assignments/bulk (bulk create)
- DELETE /{groupId}/weekly-assignments/bulk (bulk delete)
- DELETE /{groupId}/tiers/{tierId}/page-ledger/week/{week} (clear week page ledger)
"""

import json as json_lib

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User, PageLedgerEntry
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
    create_weekly_assignment,
)

# --- Shared fixtures ---


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="wa_owner", discord_username="owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="wa_member", discord_username="member")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User):
    return await create_static_group(session, owner=owner, name="WA Test Static")


@pytest_asyncio.fixture
async def tier(session: AsyncSession, group):
    return await create_tier_snapshot(session, group, tier_id="aac-lightweight")


@pytest_asyncio.fixture
async def player1(session: AsyncSession, tier):
    return await create_snapshot_player(session, tier, name="Tank", job="WAR", role="tank", position="T1")


@pytest_asyncio.fixture
async def player2(session: AsyncSession, tier):
    return await create_snapshot_player(session, tier, name="Healer", job="WHM", role="healer", position="H1", sort_order=1)


@pytest_asyncio.fixture
async def member_with_role(session: AsyncSession, member: User, group):
    await create_membership(session, member, group, role=MemberRole.MEMBER)
    return member


@pytest_asyncio.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


@pytest_asyncio.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


def _url(group_id: str, suffix: str = "") -> str:
    return f"/api/static-groups/{group_id}/weekly-assignments{suffix}"


def _ledger_url(group_id: str, tier_id: str, week: int) -> str:
    return f"/api/static-groups/{group_id}/tiers/{tier_id}/page-ledger/week/{week}"


async def _delete_with_body(client: AsyncClient, url: str, json: dict, headers: dict):
    """httpx delete() doesn't support json body. Use request() with CSRF injection."""
    # Access the CSRF token from CSRFAwareClient (set during __init__)
    csrf_token = getattr(client, "_csrf_token", None)
    all_headers = {**headers, "Content-Type": "application/json"}
    if csrf_token:
        all_headers["X-CSRF-Token"] = csrf_token
    return await client.request(
        "DELETE",
        url,
        content=json_lib.dumps(json).encode(),
        headers=all_headers,
    )


# --- List ---


class TestListWeeklyAssignments:
    @pytest.mark.asyncio
    async def test_list_empty(self, client: AsyncClient, group, owner_headers):
        resp = await client.get(_url(group.id), headers=owner_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_assignments(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.get(_url(group.id), headers=owner_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["slot"] == "head"
        assert data[0]["playerName"] == "Tank"

    @pytest.mark.asyncio
    async def test_list_filter_by_tier(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        # Filter by tier_id slug
        resp = await client.get(_url(group.id), params={"tier_id": tier.tier_id}, headers=owner_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        # Filter by tier UUID also works
        resp = await client.get(_url(group.id), params={"tier_id": tier.id}, headers=owner_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_list_filter_by_week_and_floor(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="head")
        await create_weekly_assignment(session, group, tier, player=player1, week=2, floor="M10S", slot="body")
        await session.commit()

        resp = await client.get(_url(group.id), params={"week": 1}, headers=owner_headers)
        assert len(resp.json()) == 1

        resp = await client.get(_url(group.id), params={"floor": "M10S"}, headers=owner_headers)
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_list_viewer_access(self, client: AsyncClient, session, group, tier, player1, member_headers, member_with_role):
        """Members (viewers) can list assignments."""
        await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.get(_url(group.id), headers=member_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# --- Create ---


class TestCreateWeeklyAssignment:
    @pytest.mark.asyncio
    async def test_create_happy_path(self, client: AsyncClient, group, tier, player1, owner_headers):
        resp = await client.post(
            _url(group.id),
            json={"tierId": tier.tier_id, "week": 1, "floor": "M9S", "slot": "head", "playerId": player1.id},
            headers=owner_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["slot"] == "head"
        assert data["playerId"] == player1.id
        assert data["playerName"] == "Tank"

    @pytest.mark.asyncio
    async def test_create_null_player(self, client: AsyncClient, group, tier, owner_headers):
        """Creating with null player_id (unassigned slot) works."""
        resp = await client.post(
            _url(group.id),
            json={"tierId": tier.tier_id, "week": 1, "floor": "M9S", "slot": "head", "playerId": None},
            headers=owner_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["playerId"] is None

    @pytest.mark.asyncio
    async def test_create_duplicate_409(self, client: AsyncClient, group, tier, player1, owner_headers):
        """Duplicate assignment returns 409."""
        payload = {"tierId": tier.tier_id, "week": 1, "floor": "M9S", "slot": "head", "playerId": player1.id}
        resp1 = await client.post(_url(group.id), json=payload, headers=owner_headers)
        assert resp1.status_code == 201

        resp2 = await client.post(_url(group.id), json=payload, headers=owner_headers)
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_create_null_duplicate_409(self, client: AsyncClient, group, tier, owner_headers):
        """Duplicate NULL player_id assignment returns 409 (tests .is_(None) fix)."""
        payload = {"tierId": tier.tier_id, "week": 1, "floor": "M9S", "slot": "head", "playerId": None}
        resp1 = await client.post(_url(group.id), json=payload, headers=owner_headers)
        assert resp1.status_code == 201

        resp2 = await client.post(_url(group.id), json=payload, headers=owner_headers)
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_create_invalid_tier(self, client: AsyncClient, group, owner_headers):
        resp = await client.post(
            _url(group.id),
            json={"tierId": "nonexistent", "week": 1, "floor": "M9S", "slot": "head"},
            headers=owner_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_permission_denied(self, client: AsyncClient, group, tier, member_headers, member_with_role):
        """Members cannot create assignments."""
        resp = await client.post(
            _url(group.id),
            json={"tierId": tier.tier_id, "week": 1, "floor": "M9S", "slot": "head"},
            headers=member_headers,
        )
        assert resp.status_code == 403


# --- Update ---


class TestUpdateWeeklyAssignment:
    @pytest.mark.asyncio
    async def test_update_player(self, client: AsyncClient, session, group, tier, player1, player2, owner_headers):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.put(
            _url(group.id, f"/{assignment.id}"),
            json={"playerId": player2.id},
            headers=owner_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["playerId"] == player2.id
        assert resp.json()["playerName"] == "Healer"

    @pytest.mark.asyncio
    async def test_update_sort_order(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.put(
            _url(group.id, f"/{assignment.id}"),
            json={"sortOrder": 5},
            headers=owner_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["sortOrder"] == 5

    @pytest.mark.asyncio
    async def test_update_did_not_drop(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.put(
            _url(group.id, f"/{assignment.id}"),
            json={"didNotDrop": True},
            headers=owner_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["didNotDrop"] is True

    @pytest.mark.asyncio
    async def test_update_not_found(self, client: AsyncClient, group, owner_headers):
        resp = await client.put(
            _url(group.id, "/nonexistent-id"),
            json={"sortOrder": 1},
            headers=owner_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_permission_denied(self, client: AsyncClient, session, group, tier, player1, member_headers, member_with_role):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.put(
            _url(group.id, f"/{assignment.id}"),
            json={"sortOrder": 1},
            headers=member_headers,
        )
        assert resp.status_code == 403


# --- Delete ---


class TestDeleteWeeklyAssignment:
    @pytest.mark.asyncio
    async def test_delete_happy_path(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.delete(_url(group.id, f"/{assignment.id}"), headers=owner_headers)
        assert resp.status_code == 204

        # Verify deleted
        resp = await client.get(_url(group.id), headers=owner_headers)
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_delete_not_found(self, client: AsyncClient, group, owner_headers):
        resp = await client.delete(_url(group.id, "/nonexistent-id"), headers=owner_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_permission_denied(self, client: AsyncClient, session, group, tier, player1, member_headers, member_with_role):
        assignment = await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.delete(_url(group.id, f"/{assignment.id}"), headers=member_headers)
        assert resp.status_code == 403


# --- Bulk Create ---


class TestBulkCreateWeeklyAssignments:
    @pytest.mark.asyncio
    async def test_bulk_create_happy_path(self, client: AsyncClient, group, tier, player1, player2, owner_headers):
        resp = await client.post(
            _url(group.id, "/bulk"),
            json={
                "tierId": tier.tier_id,
                "week": 1,
                "assignments": [
                    {"floor": "M9S", "slot": "head", "playerId": player1.id},
                    {"floor": "M9S", "slot": "body", "playerId": player2.id},
                ],
            },
            headers=owner_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_bulk_create_skips_duplicates(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        """Existing assignments are silently skipped."""
        await create_weekly_assignment(session, group, tier, player=player1, floor="M9S", slot="head")
        await session.commit()

        resp = await client.post(
            _url(group.id, "/bulk"),
            json={
                "tierId": tier.tier_id,
                "week": 1,
                "assignments": [
                    {"floor": "M9S", "slot": "head", "playerId": player1.id},  # duplicate
                    {"floor": "M9S", "slot": "body", "playerId": player1.id},  # new
                ],
            },
            headers=owner_headers,
        )
        assert resp.status_code == 201
        assert len(resp.json()) == 1  # Only the new one

    @pytest.mark.asyncio
    async def test_bulk_create_skips_invalid_players(self, client: AsyncClient, group, tier, player1, owner_headers):
        """Invalid player IDs are silently skipped."""
        resp = await client.post(
            _url(group.id, "/bulk"),
            json={
                "tierId": tier.tier_id,
                "week": 1,
                "assignments": [
                    {"floor": "M9S", "slot": "head", "playerId": player1.id},
                    {"floor": "M9S", "slot": "body", "playerId": "nonexistent-player"},
                ],
            },
            headers=owner_headers,
        )
        assert resp.status_code == 201
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_bulk_create_null_dedup(self, client: AsyncClient, group, tier, owner_headers):
        """Multiple NULL player_id entries for same floor/slot are de-duped within the same request."""
        resp = await client.post(
            _url(group.id, "/bulk"),
            json={
                "tierId": tier.tier_id,
                "week": 1,
                "assignments": [
                    {"floor": "M9S", "slot": "head", "playerId": None},
                    {"floor": "M9S", "slot": "head", "playerId": None},  # duplicate within request
                ],
            },
            headers=owner_headers,
        )
        assert resp.status_code == 201
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_bulk_create_permission_denied(self, client: AsyncClient, group, tier, member_headers, member_with_role):
        resp = await client.post(
            _url(group.id, "/bulk"),
            json={"tierId": tier.tier_id, "week": 1, "assignments": []},
            headers=member_headers,
        )
        assert resp.status_code == 403


# --- Bulk Delete ---


class TestBulkDeleteWeeklyAssignments:
    @pytest.mark.asyncio
    async def test_bulk_delete_all(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="head")
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="body")
        await session.commit()

        resp = await _delete_with_body(client, _url(group.id, "/bulk"), {"tierId": tier.tier_id, "week": 1}, owner_headers)
        assert resp.status_code == 204

        # Verify all deleted
        resp = await client.get(_url(group.id), headers=owner_headers)
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_bulk_delete_filter_by_floor(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="head")
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M10S", slot="body")
        await session.commit()

        resp = await _delete_with_body(client, _url(group.id, "/bulk"), {"tierId": tier.tier_id, "week": 1, "floor": "M9S"}, owner_headers)
        assert resp.status_code == 204

        resp = await client.get(_url(group.id), headers=owner_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["floor"] == "M10S"

    @pytest.mark.asyncio
    async def test_bulk_delete_filter_by_slot(self, client: AsyncClient, session, group, tier, player1, owner_headers):
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="head")
        await create_weekly_assignment(session, group, tier, player=player1, week=1, floor="M9S", slot="body")
        await session.commit()

        resp = await _delete_with_body(client, _url(group.id, "/bulk"), {"tierId": tier.tier_id, "week": 1, "slot": "head"}, owner_headers)
        assert resp.status_code == 204

        resp = await client.get(_url(group.id), headers=owner_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["slot"] == "body"

    @pytest.mark.asyncio
    async def test_bulk_delete_permission_denied(self, client: AsyncClient, group, tier, member_headers, member_with_role):
        resp = await _delete_with_body(client, _url(group.id, "/bulk"), {"tierId": tier.tier_id, "week": 1}, member_headers)
        assert resp.status_code == 403


# --- Clear Week Page Ledger ---


class TestClearWeekPageLedger:
    @pytest_asyncio.fixture
    async def ledger_entries(self, session: AsyncSession, tier, player1, owner: User):
        """Create page ledger entries for testing."""
        from datetime import datetime, timezone

        entries = []
        for floor, book_type in [("M9S", "I"), ("M10S", "II")]:
            entry = PageLedgerEntry(
                tier_snapshot_id=tier.id,
                player_id=player1.id,
                week_number=1,
                floor=floor,
                book_type=book_type,
                transaction_type="earned",
                quantity=1,
                created_at=datetime.now(timezone.utc).isoformat(),
                created_by_user_id=owner.id,
            )
            session.add(entry)
            entries.append(entry)
        await session.flush()
        await session.commit()
        return entries

    @pytest.mark.asyncio
    async def test_clear_happy_path(self, client: AsyncClient, session, group, tier, player1, owner, owner_headers, ledger_entries):
        resp = await client.delete(
            _ledger_url(group.id, tier.id, 1),
            headers=owner_headers,
        )
        assert resp.status_code == 204

        # Verify entries are gone
        from sqlalchemy import select
        result = await session.execute(
            select(PageLedgerEntry).where(
                PageLedgerEntry.tier_snapshot_id == tier.id,
                PageLedgerEntry.week_number == 1,
            )
        )
        assert len(result.scalars().all()) == 0

    @pytest.mark.asyncio
    async def test_clear_idempotent(self, client: AsyncClient, group, tier, owner_headers):
        """Clearing a week with no entries is a no-op (204)."""
        resp = await client.delete(
            _ledger_url(group.id, tier.id, 99),
            headers=owner_headers,
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_clear_permission_denied(self, client: AsyncClient, group, tier, member_headers, member_with_role):
        resp = await client.delete(
            _ledger_url(group.id, tier.id, 1),
            headers=member_headers,
        )
        assert resp.status_code == 403
