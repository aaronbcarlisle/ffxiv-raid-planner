"""
Tests for the legacy MountFarmProgress bridge integration.

Covers:
  - wants_mount=True surfaces suggestion without explicit intent
  - has_mount=True shows member as owned
  - wants_mount=False applies pass penalty
  - totem_count >= token_cost triggers can-buy signal
  - legacy data does not influence dossier_farm_match
  - explicit PlayerCollectionIntent takes priority over legacy data (no double-count)
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import User
from app.models.collection_catalog_item import CollectionCatalogItem
from app.models.mount_farm_progress import MountFarmProgress
from app.models.player_collection_intent import PlayerCollectionIntent
from app.models.player_profile import PlayerProfile
from app.services.collection_suggestion_service import (
    SUGGESTION_WEIGHTS,
    compute_suggestions,
    dossier_farm_match,
)
from tests.factories import (
    create_membership,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

_NOW = datetime.now(timezone.utc).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_catalog_with_duty_key(
    session: AsyncSession,
    *,
    name: str,
    source_duty_key: str,
    token_cost: int | None = 99,
    source_type: str | None = "extreme",
    source_duty_name: str | None = None,
) -> CollectionCatalogItem:
    item = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name=name,
        category="mount",
        source_duty_key=source_duty_key,
        source_duty_name=source_duty_name or source_duty_key,
        source_type=source_type,
        token_cost=token_cost,
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(item)
    return item


def _make_farm_progress(
    session: AsyncSession,
    group_id: str,
    user_id: str,
    trial_id: str,
    *,
    has_mount: bool = False,
    wants_mount: bool = True,
    totem_count: int = 0,
) -> MountFarmProgress:
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


def _make_intent(
    session: AsyncSession,
    profile_id: str,
    catalog_item_id: str,
    *,
    intent: str = "hunting",
    visibility: str = "static_only",
) -> PlayerCollectionIntent:
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


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_username="bridge_owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_username="bridge_member")


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


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_legacy_wants_mount_surfaces_suggestion(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """wants_mount=True alone must produce a positive-score suggestion without any
    PlayerCollectionIntent or CollectionGoal.
    """
    catalog = _make_catalog_with_duty_key(
        session, name="Legacy EX Mount", source_duty_key="bridge-test-ex-1"
    )
    _make_farm_progress(session, group.id, member.id, "bridge-test-ex-1", wants_mount=True)
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)

    assert len(suggestions) == 1
    s = suggestions[0]
    assert s.catalog_item_id == catalog.id
    assert s.static_goal_id is None

    member_entry = next(m for m in s.members if m.user_id == member.id)
    assert member_entry.intent == "hunting"
    assert "Hunting (legacy)" in member_entry.reasons
    assert s.suggested_farm_score > 0


async def test_legacy_has_mount_shows_as_owned(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """has_mount=True must display member as ownership_state='have' (already owns it)."""
    catalog = _make_catalog_with_duty_key(
        session, name="Owned Legacy Mount", source_duty_key="bridge-test-owned-1"
    )
    _make_farm_progress(
        session, group.id, member.id, "bridge-test-owned-1",
        has_mount=True, wants_mount=True,
    )
    # Need a second intent from owner to surface the suggestion at all
    _make_intent(session, owner_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    assert len(suggestions) == 1
    s = suggestions[0]

    member_entry = next(m for m in s.members if m.user_id == member.id)
    assert member_entry.ownership_state == "have"
    assert "Have (legacy)" in member_entry.reasons


async def test_legacy_wants_false_is_neutral(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """wants_mount=False must NOT apply a pass penalty — it is neutral (same as no legacy row).

    The old UI defaults to wants_mount=True when a row is created. False means the member
    unchecked the box, but that legacy state should not suppress suggestions — it's treated
    as neutral, not as an explicit Pass/Hidden intent.
    """
    catalog = _make_catalog_with_duty_key(
        session, name="Neutral Wants-False Mount", source_duty_key="bridge-test-optout-1"
    )
    _make_farm_progress(
        session, group.id, member.id, "bridge-test-optout-1", wants_mount=False
    )
    # Owner intent to surface the item
    _make_intent(session, owner_profile.id, catalog.id, intent="hunting", visibility="static_only")
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    s = next(sug for sug in suggestions if sug.catalog_item_id == catalog.id)
    member_entry = next(m for m in s.members if m.user_id == member.id)
    # No pass penalty: reason should NOT contain "Pass (legacy)"
    assert "Pass (legacy)" not in member_entry.reasons
    # wants_mount=False is excluded from signal_map, so member falls to "No data" — same as
    # any member with no legacy row. Score is neutral, not negatively boosted.
    assert "Hunting (legacy)" not in member_entry.reasons


async def test_legacy_totem_count_triggers_can_buy(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """totem_count >= token_cost must surface a 'Can buy (legacy)' signal."""
    catalog = _make_catalog_with_duty_key(
        session, name="Can Buy Legacy", source_duty_key="bridge-test-canbuy-1", token_cost=99
    )
    _make_farm_progress(
        session, group.id, member.id, "bridge-test-canbuy-1",
        wants_mount=True, totem_count=99,
    )
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    s = next(sug for sug in suggestions if sug.catalog_item_id == catalog.id)
    member_entry = next(m for m in s.members if m.user_id == member.id)
    assert member_entry.can_buy is True
    assert "Can buy (legacy)" in member_entry.reasons
    assert member_entry.token_count == 99


async def test_legacy_data_does_not_influence_dossier_match(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """MountFarmProgress (static-scoped) must never appear in dossier_farm_match results.

    Only explicit dossier_public PlayerCollectionIntent drives dossier matching.
    """
    from app.models.collection_goal import CollectionGoal

    # A catalog item that has legacy data but no dossier_public intent
    _make_catalog_with_duty_key(
        session, name="Legacy No Dossier", source_duty_key="bridge-dossier-test-1"
    )
    _make_farm_progress(
        session, group.id, member.id, "bridge-dossier-test-1", wants_mount=True
    )

    # An active goal on a different item (so dossier_farm_match has static_item_ids to compare)
    goal_catalog = CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=str(uuid.uuid4()),
        name="Active Farm Goal",
        category="mount",
        is_curated=True,
        is_active=True,
        updated_at=_NOW,
    )
    session.add(goal_catalog)
    await session.flush()

    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        goal_type="mount",
        title="Active Goal",
        status="farming",
        catalog_item_id=goal_catalog.id,
    )
    session.add(goal)
    await session.flush()

    result = await dossier_farm_match(session, group.id, member_profile.id)
    # No dossier_public intent → match score must be 0
    assert result["match_score"] == 0
    assert result["shared_goals"] == []


async def test_explicit_intent_takes_priority_over_legacy(
    session: AsyncSession,
    owner: User,
    member: User,
    owner_profile: PlayerProfile,
    member_profile: PlayerProfile,
    group,
):
    """When both PlayerCollectionIntent and MountFarmProgress exist, intent is used.
    The score must not double-count: legacy_wants_mount weight must NOT be added
    on top of hunting_intent.
    """
    catalog = _make_catalog_with_duty_key(
        session, name="Both Sources", source_duty_key="bridge-test-both-1", token_cost=99
    )
    _make_intent(
        session, member_profile.id, catalog.id, intent="hunting", visibility="static_only"
    )
    _make_farm_progress(
        session, group.id, member.id, "bridge-test-both-1",
        wants_mount=True, totem_count=10,
    )
    await session.flush()

    suggestions = await compute_suggestions(session, group.id, owner)
    s = next(sug for sug in suggestions if sug.catalog_item_id == catalog.id)
    member_entry = next(m for m in s.members if m.user_id == member.id)

    # Explicit intent wins — reasons should say "Hunting", not "Hunting (legacy)"
    assert "Hunting" in member_entry.reasons
    assert "Hunting (legacy)" not in member_entry.reasons
    assert member_entry.intent == "hunting"
