"""Tests for the Static Finder fit score — service unit tests and API integration tests.

Privacy rules tested:
- Private goals (is_public=False) are never used in fit computation
- Private BiS targets (is_public=False) are never used in fit computation
- Unauthenticated requests receive fitSummary=null for every listing
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.bis_target_set import BiSTargetSet
from app.models.personal_availability import PersonalAvailabilityTemplate
from app.models.player_goal import PlayerGoal
from app.models.player_job_profile import PlayerJobProfile
from app.models.player_profile import PlayerProfile
from app.models.static_objective_goal import StaticObjectiveGoal
from app.services.fit_score import (
    compute_fit_summary,
    _compute_goal_fit,
    _compute_job_fit,
    _compute_schedule_fit,
    _compute_comms_fit,
    _compute_bis_fit,
    _compute_overall,
)
from tests.factories import create_static_group, create_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _create_discoverable_static(session: AsyncSession, owner: User, **discovery_overrides) -> tuple:
    """Create a discoverable static group and return (group, discovery_dict)."""
    discovery = {
        "enabled": True,
        "recruitmentStatus": "open",
        "languages": ["en"],
        "scheduleDays": ["Saturday", "Sunday"],
        "neededJobs": ["WAR", "BRD"],
        "communicationStyle": {"voiceRequirement": "preferred"},
    }
    discovery.update(discovery_overrides)
    group = await create_static_group(
        session, owner, is_public=True, settings={"discovery": discovery}
    )
    return group, discovery


async def _create_profile(session: AsyncSession, user: User) -> PlayerProfile:
    profile = PlayerProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        visibility="discoverable",
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(profile)
    await session.flush()
    return profile


async def _create_job_profile(
    session: AsyncSession,
    profile: PlayerProfile,
    job: str = "BRD",
    priority: str = "main",
) -> PlayerJobProfile:
    jp = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        job=job,
        role="ranged",
        priority=priority,
        readiness="ready",
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(jp)
    await session.flush()
    return jp


async def _create_player_goal(
    session: AsyncSession,
    profile: PlayerProfile,
    category: str = "savage_bis",
    is_public: bool = True,
) -> PlayerGoal:
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        title=f"Test goal ({category})",
        goal_type="raid",
        objective_category=category,
        intent_level="want",
        is_public=is_public,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(goal)
    await session.flush()
    return goal


async def _create_bis_target(
    session: AsyncSession,
    job_profile: PlayerJobProfile,
    is_public: bool = True,
) -> BiSTargetSet:
    bis = BiSTargetSet(
        id=str(uuid.uuid4()),
        owner_type="player_job_profile",
        owner_id=job_profile.id,
        job_profile_id=job_profile.id,
        profile_id=job_profile.profile_id,
        job=job_profile.job,
        name="Main BIS",
        purpose="savage",
        source_type="manual",
        import_status="linked_only",
        is_active=True,
        is_public=is_public,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(bis)
    await session.flush()
    return bis


async def _create_static_objective(
    session: AsyncSession,
    group,
    category: str = "savage_bis",
    priority: str = "required",
) -> StaticObjectiveGoal:
    obj = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        category=category,
        title=f"Static objective ({category})",
        priority=priority,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(obj)
    await session.flush()
    return obj


def _discovery_settings(**overrides) -> dict:
    base = {
        "discovery": {
            "enabled": True,
            "recruitmentStatus": "open",
            "languages": ["en"],
            "scheduleDays": ["Saturday", "Sunday"],
            "neededJobs": ["WAR", "WHM"],
        }
    }
    base["discovery"].update(overrides)
    return base


ENDPOINT = "/api/discovery/statics"


# ===========================================================================
# Unit tests — pure service functions (no DB)
# ===========================================================================


class TestGoalFit:
    def test_aligned_exact_match(self):
        goals = [{"category": "savage_bis"}]
        objectives = [{"category": "savage_bis"}]
        result = _compute_goal_fit(goals, objectives)
        assert result["aligned"] == 1
        assert result["conflicts"] == 0

    def test_conflict_incompatible_categories(self):
        goals = [{"category": "gil_farm"}]
        objectives = [{"category": "ultimate_clear"}]
        result = _compute_goal_fit(goals, objectives)
        assert result["conflicts"] == 1
        assert result["aligned"] == 0

    def test_partial_related_categories(self):
        goals = [{"category": "loot_farm"}]
        objectives = [{"category": "savage_bis"}]
        result = _compute_goal_fit(goals, objectives)
        assert result["partial"] == 1

    def test_missing_no_player_goals(self):
        goals = []
        objectives = [{"category": "savage_bis"}, {"category": "ultimate_clear"}]
        result = _compute_goal_fit(goals, objectives)
        assert result["missing"] == 2

    def test_no_static_objectives_returns_zeros(self):
        goals = [{"category": "savage_bis"}]
        result = _compute_goal_fit(goals, [])
        assert result == {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}


class TestJobFit:
    def test_main_job_match(self):
        result = _compute_job_fit(["BRD", "MCH"], {"neededJobs": ["WAR", "BRD"]})
        assert result["status"] == "match"
        assert "BRD" in result["matchedJobs"]

    def test_alt_job_match_gives_partial(self):
        result = _compute_job_fit(["DRG", "BRD"], {"neededJobs": ["WAR", "BRD"]})
        assert result["status"] == "partial"

    def test_no_match(self):
        result = _compute_job_fit(["DRG", "MNK"], {"neededJobs": ["WAR", "BRD"]})
        assert result["status"] == "none"

    def test_no_listing_data(self):
        result = _compute_job_fit(["BRD"], None)
        assert result["status"] == "unknown"

    def test_no_recruiting_jobs_unknown(self):
        result = _compute_job_fit(["BRD"], {"scheduleDays": ["Saturday"]})
        assert result["status"] == "unknown"


class TestScheduleFit:
    def test_two_day_overlap_is_match(self):
        avail = {"days": ["SA", "SU", "MO"]}
        listing = {"scheduleDays": ["Saturday", "Sunday"]}
        result = _compute_schedule_fit(avail, listing)
        assert result["status"] == "match"

    def test_one_day_overlap_is_partial(self):
        avail = {"days": ["SA"]}
        listing = {"scheduleDays": ["Saturday", "Sunday"]}
        result = _compute_schedule_fit(avail, listing)
        assert result["status"] == "partial"

    def test_zero_overlap_is_conflict(self):
        avail = {"days": ["MO", "TU"]}
        listing = {"scheduleDays": ["Saturday", "Sunday"]}
        result = _compute_schedule_fit(avail, listing)
        assert result["status"] == "conflict"

    def test_no_availability_is_unknown(self):
        result = _compute_schedule_fit(None, {"scheduleDays": ["Saturday"]})
        assert result["status"] == "unknown"

    def test_no_listing_is_unknown(self):
        result = _compute_schedule_fit({"days": ["SA"]}, None)
        assert result["status"] == "unknown"


class TestCommsFit:
    def test_voice_required_text_only_is_conflict(self):
        listing = {"communicationStyle": {"voiceRequirement": "required"}}
        result = _compute_comms_fit([], "text_only", listing)
        assert result["status"] == "conflict"

    def test_language_match(self):
        listing = {"languages": ["en", "ja"]}
        result = _compute_comms_fit(["en"], None, listing)
        assert result["status"] == "match"

    def test_language_no_overlap_is_partial(self):
        listing = {"languages": ["ja"]}
        result = _compute_comms_fit(["en"], None, listing)
        assert result["status"] == "partial"

    def test_no_data_is_unknown(self):
        result = _compute_comms_fit([], None, None)
        assert result["status"] == "unknown"


class TestBisFit:
    def test_public_bis_for_main_job_is_ready(self):
        targets = [{"job": "BRD", "is_public": True}]
        result = _compute_bis_fit(["BRD"], targets)
        assert result["status"] == "ready"

    def test_no_bis_targets_is_unknown(self):
        result = _compute_bis_fit(["BRD"], [])
        assert result["status"] == "unknown"

    def test_no_player_jobs_is_unknown(self):
        result = _compute_bis_fit([], [{"job": "BRD", "is_public": True}])
        assert result["status"] == "unknown"

    def test_private_bis_filtered_by_caller(self):
        # Caller is responsible for filtering; service defensively returns partial
        targets = [{"job": "BRD", "is_public": False}]
        result = _compute_bis_fit(["BRD"], targets)
        # Private target should not count as ready
        assert result["status"] == "partial"


class TestOverall:
    def test_strong_when_goal_aligned_no_conflicts(self):
        goal_counts = {"aligned": 1, "partial": 0, "conflicts": 0, "missing": 0}
        result = _compute_overall(
            goal_counts,
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
        )
        assert result == "strong"

    def test_weak_on_goal_conflict(self):
        goal_counts = {"aligned": 0, "partial": 0, "conflicts": 1, "missing": 0}
        result = _compute_overall(
            goal_counts,
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
        )
        assert result == "weak"

    def test_weak_on_schedule_conflict(self):
        goal_counts = {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}
        result = _compute_overall(
            goal_counts,
            {"status": "unknown"},
            {"status": "conflict"},
            {"status": "unknown"},
            {"status": "unknown"},
        )
        assert result == "weak"

    def test_weak_on_comms_conflict(self):
        goal_counts = {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}
        result = _compute_overall(
            goal_counts,
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "conflict"},
            {"status": "unknown"},
        )
        assert result == "weak"

    def test_unknown_when_all_unknown(self):
        goal_counts = {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}
        result = _compute_overall(
            goal_counts,
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
            {"status": "unknown"},
        )
        assert result == "unknown"


# ===========================================================================
# Integration tests — API endpoint
# ===========================================================================


pytestmark = pytest.mark.asyncio


async def test_unauthenticated_returns_null_fit_summary(
    client: AsyncClient, session: AsyncSession, test_user: User
):
    """Unauthenticated requests must receive fitSummary=null for all listings."""
    group, _ = await _create_discoverable_static(session, test_user)
    await _create_static_objective(session, group)

    resp = await client.get(ENDPOINT)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item.get("fitSummary") is None


async def test_authenticated_with_profile_returns_fit_summary(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """Authenticated user with a discoverable profile gets fitSummary."""
    group, _ = await _create_discoverable_static(session, test_user)
    await _create_static_objective(session, group, category="savage_bis")

    # Create profile for user_2
    profile = await _create_profile(session, test_user_2)
    jp = await _create_job_profile(session, profile, job="BRD", priority="main")
    await _create_player_goal(session, profile, category="savage_bis", is_public=True)
    await _create_bis_target(session, jp, is_public=True)

    resp = await client.get(ENDPOINT, headers=auth_headers_user2)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1

    item = next(i for i in data["items"] if i["shareCode"] == group.share_code)
    fs = item.get("fitSummary")
    assert fs is not None
    assert "overall" in fs
    assert fs["goals"]["aligned"] >= 1


async def test_goal_conflict_gives_weak_overall(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """Player with a goal incompatible with the static's objectives gets overall=weak."""
    group, _ = await _create_discoverable_static(session, test_user)
    # Static wants ultimate_clear
    await _create_static_objective(session, group, category="ultimate_clear")

    # Player wants gil_farm (incompatible with ultimate_clear)
    profile = await _create_profile(session, test_user_2)
    await _create_player_goal(session, profile, category="gil_farm", is_public=True)

    resp = await client.get(ENDPOINT, headers=auth_headers_user2)
    assert resp.status_code == 200
    data = resp.json()
    item = next(i for i in data["items"] if i["shareCode"] == group.share_code)
    fs = item["fitSummary"]
    assert fs is not None
    assert fs["goals"]["conflicts"] >= 1
    assert fs["overall"] == "weak"


async def test_private_goals_excluded_from_fit(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """Goals with is_public=False must not affect the fit score."""
    group, _ = await _create_discoverable_static(session, test_user)
    await _create_static_objective(session, group, category="ultimate_clear")

    profile = await _create_profile(session, test_user_2)
    # Private goal that WOULD conflict — must be ignored
    await _create_player_goal(session, profile, category="gil_farm", is_public=False)

    resp = await client.get(ENDPOINT, headers=auth_headers_user2)
    assert resp.status_code == 200
    data = resp.json()
    item = next(i for i in data["items"] if i["shareCode"] == group.share_code)
    fs = item["fitSummary"]
    assert fs is not None
    # No conflicts from the private goal
    assert fs["goals"]["conflicts"] == 0


async def test_private_bis_targets_excluded_from_fit(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """BiS targets with is_public=False must not show as 'ready' in fit score."""
    group, _ = await _create_discoverable_static(session, test_user)

    profile = await _create_profile(session, test_user_2)
    jp = await _create_job_profile(session, profile, job="BRD", priority="main")
    # Private BiS target — must not count
    await _create_bis_target(session, jp, is_public=False)

    resp = await client.get(ENDPOINT, headers=auth_headers_user2)
    assert resp.status_code == 200
    data = resp.json()
    item = next(i for i in data["items"] if i["shareCode"] == group.share_code)
    fs = item["fitSummary"]
    assert fs is not None
    # Private BiS should not give ready status
    assert fs["bis"]["status"] != "ready"


async def test_hide_goal_conflicts_filter(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """hideGoalConflicts=true removes statics with fit goal conflicts."""
    group, _ = await _create_discoverable_static(session, test_user)
    await _create_static_objective(session, group, category="ultimate_clear")

    profile = await _create_profile(session, test_user_2)
    await _create_player_goal(session, profile, category="gil_farm", is_public=True)

    # Without filter — static appears
    resp = await client.get(ENDPOINT, headers=auth_headers_user2)
    assert resp.status_code == 200
    share_codes = [i["shareCode"] for i in resp.json()["items"]]
    assert group.share_code in share_codes

    # With filter — static is excluded
    resp = await client.get(
        ENDPOINT, params={"hideGoalConflicts": "true"}, headers=auth_headers_user2
    )
    assert resp.status_code == 200
    share_codes = [i["shareCode"] for i in resp.json()["items"]]
    assert group.share_code not in share_codes


async def test_schedule_overlap_filter(
    client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers_user2: dict,
):
    """scheduleOverlap=true only includes statics with match or partial schedule."""
    # Static schedules Monday/Tuesday
    group, _ = await _create_discoverable_static(
        session, test_user, scheduleDays=["Monday", "Tuesday"]
    )

    profile = await _create_profile(session, test_user_2)
    # Player available Saturday/Sunday (no overlap)
    avail = PersonalAvailabilityTemplate(
        id=str(uuid.uuid4()),
        user_id=test_user_2.id,
        day_of_week="SA",
        slots="[]",
        timezone="UTC",
        updated_at=_now(),
    )
    session.add(avail)
    avail2 = PersonalAvailabilityTemplate(
        id=str(uuid.uuid4()),
        user_id=test_user_2.id,
        day_of_week="SU",
        slots="[]",
        timezone="UTC",
        updated_at=_now(),
    )
    session.add(avail2)
    await session.flush()

    resp = await client.get(
        ENDPOINT, params={"scheduleOverlap": "true"}, headers=auth_headers_user2
    )
    assert resp.status_code == 200
    share_codes = [i["shareCode"] for i in resp.json()["items"]]
    # Static with no schedule overlap should be excluded
    assert group.share_code not in share_codes
