"""
Tests for the Player Hub → shared model write-through bridge.

Covers:
  - wants_mount=True via PATCH endpoint writes PlayerCollectionIntent (hunting, static_only)
  - wants_mount=True when existing intent is pass/hidden → does NOT overwrite
  - wants_mount=True when existing intent has dossier_public visibility → preserves higher visibility
  - wants_mount=False → neutral, no intent written
  - has_mount=True → writes PlayerCollectionSnapshot (have, player_hub)
  - has_mount=False → updates snapshot to missing (when not plugin-confirmed)
  - has_mount=False → does NOT downgrade a plugin-confirmed 'have'
  - totem_count → writes PlayerCollectionSnapshot.token_count (when not plugin)
  - totem_count → does NOT overwrite plugin snapshot token_count
  - No PlayerProfile → auto-creates a private profile, then writes intent
  - No CollectionCatalogItem for trial → silently skips
  - compute_suggestions uses written intent, legacy adapter not double-counted
  - music/minion/weapon intents work through shared model independently
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth_utils import create_access_token
from app.models import User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.player_collection_intent import PlayerCollectionIntent
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.player_profile import PlayerProfile
from app.services.collection_suggestion_service import compute_suggestions
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()
_TRIAL_ID = "bridge-wt-test-ex1"
_TRIAL_ID_2 = "bridge-wt-test-ex2"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_catalog(session, *, trial_id: str = _TRIAL_ID, category: str = "mount", name: str = "Test Mount") -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name=name,
        category=category,
        source_duty_key=trial_id,
        source_duty_name="Test Trial (EX)",
        source_type="extreme",
        token_name="Test Totem",
        token_cost=99,
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _make_intent(session, profile_id, catalog_item_id, *, intent="hunting", visibility="private") -> PlayerCollectionIntent:
    row = PlayerCollectionIntent(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        intent=intent,
        priority="medium",
        visibility=visibility,
        updated_at=_NOW,
    )
    session.add(row)
    return row


def _make_snapshot(session, profile_id, catalog_item_id, *, ownership_state="missing", source="player_hub", token_count=None) -> PlayerCollectionSnapshot:
    row = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile_id,
        catalog_item_id=catalog_item_id,
        ownership_state=ownership_state,
        source=source,
        confidence="medium",
        token_count=token_count,
        updated_at=_NOW,
    )
    session.add(row)
    return row


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    return await create_user(session, discord_username="wt_user")


@pytest_asyncio.fixture
async def user_profile(session: AsyncSession, user: User) -> PlayerProfile:
    return await create_player_profile(session, user)


@pytest_asyncio.fixture
async def group(session: AsyncSession, user: User):
    # create_static_group already adds the creator as owner (member of the group)
    return await create_static_group(session, user)


@pytest.fixture
def headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ── Tests: wants_mount write-through ─────────────────────────────────────────

async def test_wants_mount_true_writes_hunting_intent(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH wants_mount=True must create a hunting/static_only intent."""
    catalog = _make_catalog(session)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == user_profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    intent = result.scalar_one_or_none()
    assert intent is not None, "Intent should have been created"
    assert intent.intent == "hunting"
    assert intent.visibility == "static_only"
    assert intent.priority == "medium"


async def test_wants_mount_false_does_not_write_intent(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH wants_mount=False is neutral — must NOT create or touch any intent."""
    catalog = _make_catalog(session)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": False},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == user_profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    assert result.scalar_one_or_none() is None, "No intent must be created for wants_mount=False"


async def test_wants_mount_does_not_override_explicit_pass(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """wants_mount=True must NOT overwrite an existing pass/hidden intent."""
    catalog = _make_catalog(session)
    _make_intent(session, user_profile.id, catalog.id, intent="pass", visibility="static_only")
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == user_profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    intent = result.scalar_one()
    assert intent.intent == "pass", "Pass intent must be preserved — bridge must not override explicit opt-out"


async def test_wants_mount_preserves_higher_visibility(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """wants_mount=True on existing dossier_public intent must NOT downgrade visibility."""
    catalog = _make_catalog(session)
    _make_intent(session, user_profile.id, catalog.id, intent="interested", visibility="dossier_public")
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == user_profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    intent = result.scalar_one()
    assert intent.intent == "hunting", "Intent should be upgraded to hunting"
    assert intent.visibility == "dossier_public", "Higher visibility must be preserved"


async def test_wants_mount_upgrades_private_to_static_only(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """wants_mount=True on existing private/interested intent upgrades to static_only."""
    catalog = _make_catalog(session)
    _make_intent(session, user_profile.id, catalog.id, intent="interested", visibility="private")
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == user_profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    intent = result.scalar_one()
    assert intent.intent == "hunting"
    assert intent.visibility == "static_only"


# ── Tests: has_mount / snapshot write-through ─────────────────────────────────

async def test_has_mount_true_writes_have_snapshot(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH has_mount=True must create/update PlayerCollectionSnapshot to 'have'."""
    catalog = _make_catalog(session)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "has_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == user_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one_or_none()
    assert snap is not None
    assert snap.ownership_state == "have"
    assert snap.source == "player_hub"


async def test_has_mount_false_writes_missing_snapshot(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH has_mount=False must create/update snapshot to 'missing' (non-plugin case)."""
    catalog = _make_catalog(session)
    _make_snapshot(session, user_profile.id, catalog.id, ownership_state="have", source="player_hub")
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "has_mount": False},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == user_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one()
    assert snap.ownership_state == "missing"


async def test_has_mount_false_does_not_downgrade_plugin_have(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH has_mount=False must NOT downgrade a plugin-confirmed 'have'."""
    catalog = _make_catalog(session)
    _make_snapshot(session, user_profile.id, catalog.id, ownership_state="have", source="plugin")
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "has_mount": False},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == user_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one()
    assert snap.ownership_state == "have", "Plugin-confirmed 'have' must not be downgraded"


async def test_totem_count_writes_snapshot_token_count(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH totem_count writes PlayerCollectionSnapshot.token_count."""
    catalog = _make_catalog(session)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "totem_count": 42},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == user_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one_or_none()
    assert snap is not None
    assert snap.token_count == 42


async def test_totem_count_does_not_overwrite_plugin_snapshot(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """PATCH totem_count must NOT overwrite token_count on a plugin-owned snapshot."""
    catalog = _make_catalog(session)
    _make_snapshot(session, user_profile.id, catalog.id, source="plugin", token_count=77)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "totem_count": 10},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == user_profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog.id,
        )
    )
    snap = result.scalar_one()
    assert snap.token_count == 77, "Plugin snapshot token_count must be preserved"


# ── Tests: silent skip cases ──────────────────────────────────────────────────

async def test_no_profile_bridge_auto_creates_profile(
    async_client: AsyncClient, session: AsyncSession, group, headers, user,
):
    """Bridge auto-creates a minimal PlayerProfile when none exists, then writes intent."""
    catalog = _make_catalog(session)
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": _TRIAL_ID, "wants_mount": True},
        headers=headers,
    )
    # MFP write must succeed
    assert resp.status_code == 200

    # A profile must now exist for the user
    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    assert profile is not None, "Bridge must auto-create a PlayerProfile"
    assert profile.visibility == "private"

    # Intent must also have been written via the new profile
    intent_result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog.id,
        )
    )
    intent = intent_result.scalar_one_or_none()
    assert intent is not None, "Bridge must write intent after auto-creating profile"
    assert intent.intent == "hunting"


async def test_no_catalog_item_bridge_skips_silently(
    async_client: AsyncClient, session: AsyncSession, user_profile, group, headers,
):
    """Write-through silently skips when trial_id has no matching catalog item."""
    await session.commit()

    resp = await async_client.patch(
        f"/api/static-groups/{group.id}/mount-farms/progress",
        json={"trial_id": "no-such-trial-id", "wants_mount": True},
        headers=headers,
    )
    assert resp.status_code == 200

    result = await session.execute(select(PlayerCollectionIntent))
    assert result.scalars().all() == []


# ── Tests: suggestion engine integration ──────────────────────────────────────

async def test_suggestion_uses_written_intent_not_legacy_fallback(
    session: AsyncSession,
    user: User,
    user_profile: PlayerProfile,
    group,
):
    """After write-through, compute_suggestions uses PlayerCollectionIntent (priority over legacy)."""
    from app.models.mount_farm_progress import MountFarmProgress

    catalog = _make_catalog(session)
    # Simulate MFP row (legacy adapter would pick this up)
    mfp = MountFarmProgress(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        user_id=user.id,
        trial_id=_TRIAL_ID,
        has_mount=False,
        wants_mount=True,
        totem_count=0,
        updated_at=_NOW,
        updated_by_id=user.id,
    )
    session.add(mfp)

    # Also write the intent (simulating what write-through would do)
    _make_intent(session, user_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, user)
    assert len(suggestions) == 1
    member_entry = next(m for m in suggestions[0].members if m.user_id == user.id)

    # Intent source should win: "Hunting" (not "Hunting (legacy)")
    assert "Hunting" in member_entry.reasons
    assert "Hunting (legacy)" not in member_entry.reasons


async def test_static_suggestions_use_static_only_written_intent(
    session: AsyncSession,
    user: User,
    user_profile: PlayerProfile,
    group,
):
    """static_only intent written by bridge must appear in compute_suggestions for the static."""
    catalog = _make_catalog(session)
    _make_intent(session, user_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, user)
    assert len(suggestions) == 1
    assert suggestions[0].catalog_item_id == catalog.id


async def test_private_written_intent_does_not_appear_in_suggestions(
    session: AsyncSession,
    user: User,
    user_profile: PlayerProfile,
    group,
):
    """Private intent (e.g. if user manually set it) must NOT appear in static suggestions."""
    catalog = _make_catalog(session)
    _make_intent(session, user_profile.id, catalog.id, intent="hunting", visibility="private")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, user)
    # Private intent should not produce a suggestion for the static
    assert len(suggestions) == 0


async def test_non_mount_catalog_item_intent_works_without_mfp(
    session: AsyncSession,
    user: User,
    user_profile: PlayerProfile,
    group,
):
    """Music/minion/weapon intents flow through shared model without any MountFarmProgress row."""
    music_catalog = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name="Some Orchestrion Roll",
        category="orchestrion",
        source_duty_key=_TRIAL_ID,
        source_duty_name="Test Trial (EX)",
        source_type="extreme",
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(music_catalog)

    # Music intent via shared model, no MFP row
    _make_intent(session, user_profile.id, music_catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, user)
    assert any(s.catalog_item_id == music_catalog.id for s in suggestions), \
        "Music intent via PlayerCollectionIntent must appear in suggestions even without MFP"
