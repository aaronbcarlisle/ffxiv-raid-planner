"""R-P0-6 (P0a Task 2): the viewer write gaps.

A viewer may not claim a player card, write mount-farm progress, or mark a
split run cleared. Self-release of one's own card stays open (a demoted member
can still unlink). Rulings R-P0-6 and V13 in
design/redesign/plans/2026-09-30-p0-safety.md.
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.database import get_session
from app.main import app
from app.models import MemberRole, User
from app.models.split_clear import SplitClearAssignment
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio

TRIAL_ID = "dt-valigarmanda"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="vwg_owner", discord_username="owner")


@pytest_asyncio.fixture
async def lead(session: AsyncSession) -> User:
    return await create_user(session, discord_id="vwg_lead", discord_username="lead")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="vwg_member", discord_username="member")


@pytest_asyncio.fixture
async def viewer(session: AsyncSession) -> User:
    return await create_user(session, discord_id="vwg_viewer", discord_username="viewer")


@pytest_asyncio.fixture
async def outsider(session: AsyncSession) -> User:
    return await create_user(session, discord_id="vwg_outsider", discord_username="outsider")


@pytest_asyncio.fixture
async def admin(session: AsyncSession) -> User:
    user = await create_user(session, discord_id="vwg_admin", discord_username="admin")
    user.is_admin = True
    await session.flush()
    return user


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, lead: User, member: User, viewer: User):
    g = await create_static_group(session, owner, is_public=True)
    await create_membership(session, lead, g, role=MemberRole.LEAD)
    await create_membership(session, member, g, role=MemberRole.MEMBER)
    await create_membership(session, viewer, g, role=MemberRole.VIEWER)
    return g


@pytest_asyncio.fixture
async def tier(session: AsyncSession, group):
    return await create_tier_snapshot(session, group)


def _claim_url(group, tier, player) -> str:
    return f"/api/static-groups/{group.id}/tiers/{tier.tier_id}/players/{player.id}/claim"


def _progress_url(group) -> str:
    return f"/api/static-groups/{group.id}/mount-farms/progress"


def _mark_url(group) -> str:
    return f"/api/static-groups/{group.id}/split-clear/mark-run-cleared"


# ── Claim ────────────────────────────────────────────────────────────────────


async def test_viewer_cannot_claim_player_card(async_client, session, group, tier, viewer):
    player = await create_snapshot_player(session, tier, name="Card")
    resp = await async_client.post(_claim_url(group, tier, player), headers=_headers(viewer))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers can't claim player cards"
    await session.refresh(player)
    assert player.user_id is None


async def test_member_can_claim_player_card(async_client, session, group, tier, member):
    player = await create_snapshot_player(session, tier, name="Card")
    resp = await async_client.post(_claim_url(group, tier, player), headers=_headers(member))
    assert resp.status_code == 200
    await session.refresh(player)
    assert player.user_id == member.id


async def test_admin_non_member_can_claim_player_card(async_client, session, group, tier, admin):
    player = await create_snapshot_player(session, tier, name="Card")
    resp = await async_client.post(_claim_url(group, tier, player), headers=_headers(admin))
    assert resp.status_code == 200
    await session.refresh(player)
    assert player.user_id == admin.id


async def test_viewer_can_release_own_card(async_client, session, group, tier, viewer):
    """Self-release stays open: a member demoted to viewer can still unlink."""
    player = await create_snapshot_player(session, tier, name="Card")
    player.user_id = viewer.id
    await session.flush()
    resp = await async_client.delete(_claim_url(group, tier, player), headers=_headers(viewer))
    assert resp.status_code == 200
    await session.refresh(player)
    assert player.user_id is None


# ── Mount-farm progress ──────────────────────────────────────────────────────


async def test_viewer_cannot_patch_own_mount_farm_progress(async_client, group, viewer):
    resp = await async_client.patch(
        _progress_url(group), json={"trialId": TRIAL_ID, "hasMount": True}, headers=_headers(viewer)
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers cannot track farms"


async def test_viewer_cannot_patch_another_users_mount_farm_progress(
    async_client, group, viewer, member
):
    """The viewer check comes before the lead check for other users."""
    resp = await async_client.patch(
        _progress_url(group),
        json={"trialId": TRIAL_ID, "hasMount": True, "userId": member.id},
        headers=_headers(viewer),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Viewers cannot track farms"


async def test_member_can_patch_own_mount_farm_progress(async_client, group, member):
    resp = await async_client.patch(
        _progress_url(group), json={"trialId": TRIAL_ID, "totemCount": 3}, headers=_headers(member)
    )
    assert resp.status_code == 200
    assert resp.json()["totemCount"] == 3


async def test_lead_targeting_viewer_gets_400(async_client, group, lead, viewer):
    resp = await async_client.patch(
        _progress_url(group),
        json={"trialId": TRIAL_ID, "hasMount": True, "userId": viewer.id},
        headers=_headers(lead),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Viewers can't be tracked"


async def test_lead_can_target_member(async_client, group, lead, member):
    resp = await async_client.patch(
        _progress_url(group),
        json={"trialId": TRIAL_ID, "hasMount": True, "userId": member.id},
        headers=_headers(lead),
    )
    assert resp.status_code == 200
    assert resp.json()["hasMount"] is True


# ── mark-run-cleared ─────────────────────────────────────────────────────────


async def test_outsider_cannot_mark_run_cleared_on_public_static(
    async_client, session, group, tier, outsider
):
    row = await _assignment(session, group, tier)
    resp = await async_client.post(_mark_url(group), json={"run": "A"}, headers=_headers(outsider))
    assert resp.status_code == 403
    await session.refresh(row)
    assert row.run_a_cleared is False


async def test_viewer_cannot_mark_run_cleared(async_client, session, group, tier, viewer):
    row = await _assignment(session, group, tier)
    resp = await async_client.post(_mark_url(group), json={"run": "A"}, headers=_headers(viewer))
    assert resp.status_code == 403
    await session.refresh(row)
    assert row.run_a_cleared is False


async def _assignment(session, group, tier) -> SplitClearAssignment:
    player = await create_snapshot_player(session, tier, name="Card")
    row = SplitClearAssignment(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        snapshot_player_id=player.id,
        run_a_cleared=False,
        run_b_cleared=False,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(row)
    await session.flush()
    return row


async def test_member_can_mark_run_cleared(async_client, session, group, tier, member):
    row = await _assignment(session, group, tier)
    resp = await async_client.post(_mark_url(group), json={"run": "A"}, headers=_headers(member))
    assert resp.status_code == 204
    await session.refresh(row)
    assert row.run_a_cleared is True


async def test_member_with_xrp_key_and_no_csrf_can_mark_run_cleared(
    async_client, session, group, tier, member
):
    """Plugin contract: a member's xrp_ key, no CSRF header, still gets 204."""
    created = await async_client.post(
        "/api/auth/api-keys", json={"name": "Plugin"}, headers=_headers(member)
    )
    assert created.status_code == 201
    raw_key = created.json()["key"]
    assert raw_key.startswith("xrp_")
    row = await _assignment(session, group, tier)

    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as raw:
            resp = await raw.post(
                _mark_url(group),
                json={"run": "B"},
                headers={"Authorization": f"Bearer {raw_key}"},
            )
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 204
    await session.refresh(row)
    assert row.run_b_cleared is True
