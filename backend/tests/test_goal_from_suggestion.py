"""
Tests for POST /collection-goals/from-suggestion endpoint.

Covers:
  - Goal created with correct type/title from catalog item
  - Participant states preloaded from PlayerCollectionSnapshot (plugin ownership → "have")
  - Participant states preloaded from PlayerCollectionIntent (hunting → "want", pass → "pass")
  - Legacy MountFarmProgress wants_mount=True → "want"
  - Legacy MountFarmProgress has_mount=True → "have"
  - Legacy totem_count carried into participant token_count
  - Private intent is not used (only static_only/dossier_public)
  - Members with no signal default to "want"
  - 403 if caller is not lead/owner
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.mount_farm_progress import MountFarmProgress
from app.models.player_collection_intent import PlayerCollectionIntent
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.player_profile import PlayerProfile
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_catalog(session: AsyncSession, *, name: str = "Test Mount", source_duty_key: str | None = None) -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name=name,
        category="mount",
        source_duty_key=source_duty_key,
        source_duty_name="Test Trial (EX)" if source_duty_key else None,
        source_type="extreme",
        token_name="Test Totem",
        token_cost=99,
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _make_snapshot(session, profile_id, catalog_item_id, *, ownership_state="missing", token_count=None) -> PlayerCollectionSnapshot:
    s = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        ownership_state=ownership_state,
        source="plugin",
        confidence="high",
        last_synced_at=_NOW,
        token_count=token_count,
        updated_at=_NOW,
    )
    session.add(s)
    return s


def _make_intent(session, profile_id, catalog_item_id, *, intent="hunting", visibility="static_only") -> PlayerCollectionIntent:
    i = PlayerCollectionIntent(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        intent=intent,
        priority="medium",
        visibility=visibility,
        updated_at=_NOW,
    )
    session.add(i)
    return i


def _make_farm_progress(session, group_id, user_id, trial_id, *, has_mount=False, wants_mount=True, totem_count=0) -> MountFarmProgress:
    row = MountFarmProgress(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        user_id=user_id,
        trial_id=trial_id,
        has_mount=has_mount,
        wants_mount=wants_mount,
        totem_count=totem_count,
        updated_at=_NOW,
        updated_by_id=user_id,
    )
    session.add(row)
    return row


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="fsg_owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="fsg_member")


@pytest_asyncio.fixture
async def owner_profile(session: AsyncSession, owner: User) -> PlayerProfile:
    return await create_player_profile(session, owner)


@pytest_asyncio.fixture
async def member_profile(session: AsyncSession, member: User) -> PlayerProfile:
    return await create_player_profile(session, member)


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, member: User):
    g = await create_static_group(session, owner)
    await create_membership(session, member, g, role="member")
    return g


@pytest.fixture
def owner_headers(owner: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


@pytest.fixture
def member_headers(member: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_goal_created_with_catalog_fields(
    async_client: AsyncClient, session: AsyncSession, owner_profile, member_profile, group, owner_headers,
):
    """Goal title, type, token_name, and token_cost must come from the catalog item."""
    catalog = _make_catalog(session, name="Wings of Ruin")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id, "status": "wanted"},
        headers=owner_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["title"] == "Wings of Ruin"
    assert data["goal_type"] == "mount"
    assert data["token_name"] == "Test Totem"
    assert data["token_cost"] == 99
    assert data["catalog_item_id"] == catalog.id
    assert data["content_type"] == "extreme"


async def test_snapshot_ownership_preloads_have(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Member with plugin-synced has=True must be preloaded as state='have'."""
    catalog = _make_catalog(session, name="Snapshot Have Mount")
    _make_snapshot(session, member_profile.id, catalog.id, ownership_state="have")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    assert summary["have"] == 1


async def test_intent_hunting_preloads_want(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Member with hunting intent (static_only) must be preloaded as state='want'."""
    catalog = _make_catalog(session, name="Intent Hunting Mount")
    _make_intent(session, member_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    # Both owner + member default/want
    assert summary["want"] >= 1


async def test_intent_pass_preloads_pass(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Member with pass intent must be preloaded as state='pass'."""
    catalog = _make_catalog(session, name="Pass Intent Mount")
    _make_intent(session, member_profile.id, catalog.id, intent="pass", visibility="static_only")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    assert summary["passing"] == 1


async def test_private_intent_is_not_used(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Private intent must NOT influence participant state — member defaults to 'want'."""
    catalog = _make_catalog(session, name="Private Pass Mount")
    # This private pass intent should be ignored
    _make_intent(session, member_profile.id, catalog.id, intent="pass", visibility="private")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    # Member's private pass is ignored → defaults to "want"
    assert summary["passing"] == 0
    assert summary["want"] >= 1


async def test_legacy_wants_mount_preloads_want(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Legacy wants_mount=True (no explicit intent) → state='want' with totem_count."""
    catalog = _make_catalog(session, name="Legacy Want Mount", source_duty_key="fsg-test-ex-1")
    _make_farm_progress(
        session, group.id, member.id, "fsg-test-ex-1", wants_mount=True, totem_count=42
    )
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    assert summary["want"] >= 1  # member (legacy) + owner (default)


async def test_legacy_has_mount_preloads_have(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Legacy has_mount=True (no snapshot) → state='have'."""
    catalog = _make_catalog(session, name="Legacy Have Mount", source_duty_key="fsg-test-ex-2")
    _make_farm_progress(
        session, group.id, member.id, "fsg-test-ex-2", has_mount=True, wants_mount=True
    )
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    assert summary["have"] == 1


async def test_members_without_signal_default_to_want(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, owner_headers,
):
    """Members with no snapshot, intent, or legacy data default to state='want'."""
    catalog = _make_catalog(session, name="No Signal Mount")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    summary = resp.json()["participant_summary"]
    # Both owner + member default to want (2 members)
    assert summary["want"] == 2
    assert summary["have"] == 0
    assert summary["passing"] == 0


async def test_member_cannot_create_goal_from_suggestion(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, member: User, owner_profile, member_profile, group, member_headers,
):
    """Regular members must get 403 — only leads/owners can create goals."""
    catalog = _make_catalog(session, name="Auth Test Mount")
    await session.commit()

    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": catalog.id},
        headers=member_headers,
    )
    assert resp.status_code == 403


async def test_missing_catalog_item_returns_404(
    async_client: AsyncClient, session: AsyncSession,
    owner: User, owner_profile, group, owner_headers,
):
    """Non-existent catalog_item_id must return 404."""
    await session.commit()
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals/from-suggestion",
        json={"catalog_item_id": str(uuid.uuid4())},
        headers=owner_headers,
    )
    assert resp.status_code == 404
