"""Static Finder V2 fit on `GET /api/discovery/statics` (Stage 4 SF1a, Task 1).

The V1 golden (F3): `tests/golden/discovery_v1.json` holds four captures of the
endpoint made on the base commit, each with its statement count, against a
pinned fixture (fixed share codes and `updated_at` values). Regenerate it only
on that base with `DISCOVERY_GOLDEN_WRITE=1 pytest tests/test_discovery_fit_v2.py
-k v1_response_unchanged`. `test_v1_response_unchanged` strips the additive keys
(`fitV2`, `fitCounts`, `viewer`) and sorts `objectiveCategories` (built from a
set, so its order varies with hash randomisation), then compares the rest and
the statement count, so a V1 request stays byte-for-byte and an `id` key would
fail it (OWNER-3).
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.bis_target_set import BiSTargetSet
from app.models.player_goal import PlayerGoal
from app.models.static_objective_goal import StaticObjectiveGoal
from tests.factories import (
    create_personal_availability_template,
    create_player_job_profile,
    create_player_profile,
    create_static_group,
)

pytestmark = pytest.mark.asyncio

ENDPOINT = "/api/discovery/statics"
# The router places raid nights on their next occurrence from datetime.now(UTC) (R-SF-C), so
# local times move with DST. Every route test here runs on this pin (a Wednesday; New York
# on EDT, London on BST, Sydney on AEST), the same one test_finder_fit.py uses.
FROZEN_NOW = datetime(2026, 6, 3, 12, tzinfo=UTC)


class _FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return FROZEN_NOW if tz is None else FROZEN_NOW.astimezone(tz)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.discovery.datetime", _FrozenDatetime)
GOLDEN_PATH = Path(__file__).parent / "golden" / "discovery_v1.json"
ADDITIVE_TOP_KEYS = ("fitCounts", "viewer")
ADDITIVE_ITEM_KEYS = ("fitV2",)

NY_EVENING = ["20:00", "20:30", "21:00", "21:30", "22:00", "22:30"]  # Fri/Sat 20:00-23:00


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _listing(
    *,
    recruitment_status: str = "open",
    description: str | None = "We raid on weekends",
    intensity: str | None = "midcore",
    languages: list[str] | None = None,
    data_center: str | None = "Aether",
    server: str | None = "Jenova",
    timezone: str | None = "America/New_York",
    needed_roles: tuple[str, ...] | list[str] | None = ("tank", "healer"),
    needed_jobs: tuple[str, ...] | list[str] | None = ("WAR", "WHM"),
    schedule_days: tuple[str, ...] | list[str] | None = ("Saturday", "Sunday"),
    schedule_start_time: str | None = "20:00",
    schedule_end_time: str | None = "23:00",
    show_member_count: bool = False,
    recruiting_roles: list[dict] | None = None,
    communication_style: dict | None = None,
    contact_method: str | None = None,
    contact_value: str | None = None,
) -> dict:
    """The `_discovery_settings` shape from test_discovery.py; `None` for a list omits its key."""
    discovery: dict = {
        "enabled": True,
        "recruitmentStatus": recruitment_status,
        "description": description,
        "intensity": intensity,
        "languages": list(languages) if languages is not None else ["en"],
        "dataCenter": data_center,
        "server": server,
        "timezone": timezone,
        "scheduleDays": list(schedule_days) if schedule_days is not None else None,
        "scheduleStartTime": schedule_start_time,
        "scheduleEndTime": schedule_end_time,
        "showMemberCount": show_member_count,
    }
    if needed_roles is not None:
        discovery["neededRoles"] = list(needed_roles)
    if needed_jobs is not None:
        discovery["neededJobs"] = list(needed_jobs)
    if recruiting_roles is not None:
        discovery["recruitingRoles"] = recruiting_roles
    if communication_style is not None:
        discovery["communicationStyle"] = communication_style
    if contact_method is not None:
        discovery["contactMethod"] = contact_method
        discovery["contactValue"] = contact_value
    return {"discovery": discovery}


async def _static(
    session: AsyncSession,
    owner: User,
    *,
    name: str,
    share_code: str,
    updated_at: str,
    settings: dict,
    objectives: list[tuple[str, str]] = (),  # type: ignore[assignment]
):
    group = await create_static_group(
        session, owner, name=name, share_code=share_code, is_public=True, settings=settings
    )
    group.updated_at = updated_at
    for category, priority in objectives:
        session.add(
            StaticObjectiveGoal(
                id=str(uuid.uuid4()),
                static_group_id=group.id,
                category=category,
                title=f"Static objective ({category})",
                priority=priority,
                created_at=_now(),
                updated_at=_now(),
            )
        )
    await session.flush()
    return group


async def _goal(session: AsyncSession, profile, category: str, *, is_public: bool = True) -> None:
    session.add(
        PlayerGoal(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            title=f"Goal ({category})",
            goal_type="raid",
            objective_category=category,
            intent_level="want",
            is_public=is_public,
            created_at=_now(),
            updated_at=_now(),
        )
    )
    await session.flush()


async def _public_bis(session: AsyncSession, job_profile) -> None:
    session.add(
        BiSTargetSet(
            id=str(uuid.uuid4()),
            owner_type="player_job_profile",
            owner_id=job_profile.id,
            job_profile_id=job_profile.id,
            profile_id=job_profile.profile_id,
            job=job_profile.job,
            name="Main BiS",
            purpose="savage",
            source_type="manual",
            import_status="linked_only",
            is_active=True,
            is_public=True,
            created_at=_now(),
            updated_at=_now(),
        )
    )
    await session.flush()


@pytest_asyncio.fixture
async def world(
    session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    auth_headers_user2: dict,
    auth_headers_user3: dict,
) -> SimpleNamespace:
    """Five pinned listings, a discoverable viewer (user 2) and a private viewer (user 3)."""
    alpha = await _static(
        session, test_user, name="Alpha Raiders", share_code="ALPHA1",
        updated_at="2026-05-05T10:00:00+00:00",
        settings=_listing(show_member_count=True),
        objectives=[("savage_bis", "required")],
    )
    bravo = await _static(
        session, test_user, name="Bravo Brigade", share_code="BRAVO2",
        updated_at="2026-05-04T10:00:00+00:00",
        settings=_listing(
            description="Ultimate prog four nights a week. Voice required, no exceptions.",
            intensity="hardcore", languages=["en", "de"], data_center="Light", server="Odin",
            timezone="Europe/London", needed_roles=["melee"], needed_jobs=["DRG"],
            schedule_days=["Friday"], schedule_start_time="19:00", schedule_end_time="22:00",
            communication_style={"voiceRequirement": "required"},
            contact_method="discord", contact_value="bravo#0001",
        ),
        objectives=[("ultimate_clear", "required")],
    )
    charlie = await _static(
        session, test_user, name="Charlie Casuals", share_code="CHARL3",
        updated_at="2026-05-03T10:00:00+00:00",
        settings=_listing(
            intensity="casual", languages=["ja", "en"], data_center="Elemental",
            server="Tonberry", timezone="Asia/Tokyo", needed_roles=["caster"],
            needed_jobs=["BLM", "SMN"], schedule_days=["Monday", "Wednesday"],
            schedule_start_time="21:00", schedule_end_time="00:00",
        ),
        objectives=[("gil_farm", "optional")],
    )
    delta = await _static(
        session, test_user, name="Delta Dragoons", share_code="DELTA4",
        updated_at="2026-05-02T10:00:00+00:00",
        settings=_listing(
            needed_roles=None, needed_jobs=None,
            recruiting_roles=[
                {"role": "melee", "priority": "needed", "jobs": []},
                {"role": "healer", "priority": "nice_to_have", "jobs": ["SGE"]},
            ],
            schedule_days=["Friday", "Saturday"],
        ),
        objectives=[("savage_bis", "required"), ("savage_mount", "optional")],
    )
    echo = await _static(
        session, test_user, name="Echo Eight", share_code="ECHO05",
        updated_at="2026-05-01T10:00:00+00:00",
        settings=_listing(
            description=None, timezone="Australia/Sydney", needed_roles=["ranged"],
            needed_jobs=["BRD"], schedule_days=["FR", "SA"],
            schedule_start_time=None, schedule_end_time=None,
        ),
    )

    viewer_profile = await create_player_profile(session, test_user_2, visibility="discoverable")
    drg = await create_player_job_profile(
        session, viewer_profile, job="DRG", role="melee", priority="main"
    )
    await create_player_job_profile(
        session, viewer_profile, job="WHM", role="healer", priority="flex"
    )
    for day in ("FR", "SA"):
        await create_personal_availability_template(
            session, test_user_2, day_of_week=day, slots=NY_EVENING, timezone="America/New_York"
        )
    await _goal(session, viewer_profile, "savage_bis")
    await _public_bis(session, drg)

    private_profile = await create_player_profile(session, test_user_3, visibility="private")
    await create_player_job_profile(
        session, private_profile, job="DRG", role="melee", priority="main"
    )
    await _goal(session, private_profile, "gil_farm")

    return SimpleNamespace(
        owner=test_user,
        viewer=test_user_2,
        viewer_headers=auth_headers_user2,
        private=test_user_3,
        private_headers=auth_headers_user3,
        groups={"alpha": alpha, "bravo": bravo, "charlie": charlie, "delta": delta, "echo": echo},
    )


async def _get_counted(
    client: AsyncClient,
    session: AsyncSession,
    engine,
    count_statements,
    params: dict,
    headers: dict | None,
) -> tuple[dict, int]:
    # Start from an empty identity map so a load can't be skipped because the
    # previous request already loaded the row (test_availability_layering.py).
    session.expunge_all()
    with count_statements(engine) as counts:
        resp = await client.get(ENDPOINT, params=params, headers=headers)
        assert resp.status_code == 200, resp.text
    return resp.json(), counts.n


def _normalise_v1(body: dict) -> dict:
    """Drop the additive keys and sort the set-built `objectiveCategories`."""
    out = {k: v for k, v in body.items() if k not in ADDITIVE_TOP_KEYS}
    items = []
    for item in body["items"]:
        clean = {k: v for k, v in item.items() if k not in ADDITIVE_ITEM_KEYS}
        if "objectiveCategories" in clean:
            clean["objectiveCategories"] = sorted(clean["objectiveCategories"])
        items.append(clean)
    out["items"] = items
    return out


# (name, who, params): who is "viewer" (discoverable), "private" or None (guest)
GOLDEN_CAPTURES: list[tuple[str, str | None, dict]] = [
    ("discoverable_sort_name", "viewer", {"sort": "name"}),
    ("private_viewer", "private", {}),
    ("guest", None, {}),
    (
        "discoverable_filtered",
        "viewer",
        {
            "scheduleOverlap": "true",
            "hideGoalConflicts": "true",
            "hideConflicts": "true",
            "goalCategory": "savage_bis",
        },
    ),
]


def _headers_for(world: SimpleNamespace, who: str | None) -> dict | None:
    if who == "viewer":
        return world.viewer_headers
    if who == "private":
        return world.private_headers
    return None


async def test_v1_response_unchanged(
    client: AsyncClient, session: AsyncSession, engine, count_statements, world: SimpleNamespace
):
    captured: dict[str, dict] = {}
    for name, who, params in GOLDEN_CAPTURES:
        body, n = await _get_counted(
            client, session, engine, count_statements, params, _headers_for(world, who)
        )
        captured[name] = {"statements": n, "response": _normalise_v1(body)}

    if os.environ.get("DISCOVERY_GOLDEN_WRITE"):
        GOLDEN_PATH.parent.mkdir(exist_ok=True)
        GOLDEN_PATH.write_text(
            json.dumps(captured, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
        )
        pytest.skip(f"golden written to {GOLDEN_PATH}")

    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    assert list(golden) == sorted(name for name, _, _ in GOLDEN_CAPTURES)
    for name, _, _ in GOLDEN_CAPTURES:
        assert captured[name]["response"] == golden[name]["response"], name
        assert captured[name]["statements"] == golden[name]["statements"], name


# ---------------------------------------------------------------------------
# fitV2 (R-SF-A, E, F, G)
# ---------------------------------------------------------------------------


async def _get(client: AsyncClient, params: dict, headers: dict | None = None) -> dict:
    resp = await client.get(ENDPOINT, params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _by_code(body: dict) -> dict[str, dict]:
    return {item["shareCode"]: item for item in body["items"]}


def _names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


async def test_fit_v2_off_leaves_new_fields_null_and_no_id(client: AsyncClient, world):
    for headers in (world.viewer_headers, world.private_headers, None):
        body = await _get(client, {}, headers)
        assert body["fitCounts"] is None
        assert body["viewer"] is None
        assert body["total"] == 5
        for item in body["items"]:
            assert item["fitV2"] is None
            assert "id" not in item


async def test_id_only_with_fit_v2_and_signed_in(client: AsyncClient, world):
    signed_in = await _get(client, {"fitV2": "true"}, world.viewer_headers)
    assert {i["shareCode"]: i["id"] for i in signed_in["items"]} == {
        g.share_code: g.id for g in world.groups.values()
    }
    guest = await _get(client, {"fitV2": "true"})
    assert guest["total"] == 5
    assert all("id" not in item for item in guest["items"])


async def test_fit_v2_on_for_discoverable_viewer(client: AsyncClient, world):
    body = await _get(client, {"fitV2": "true"}, world.viewer_headers)
    assert body["viewer"] == {"mainJob": "DRG", "mainRole": "melee", "missing": []}
    assert all(item["fitV2"] is not None for item in body["items"])
    assert sum(body["fitCounts"].values()) == body["total"] == 5
    items = _by_code(body)
    delta = items["DELTA4"]["fitV2"]
    assert delta["tier"] == "strong"
    assert delta["role"] == {
        "status": "match", "matchedJob": "DRG", "matchedRole": "melee", "priority": "needed",
        "isMain": True, "asRole": None,
    }
    assert delta["schedule"]["status"] == "match"
    assert delta["schedule"]["basis"] == "time"
    assert [n["coverage"] for n in delta["schedule"]["nights"]] == ["full", "full"]
    assert [(r["kind"], r["status"]) for r in delta["reasons"]] == [
        ("role", "match"), ("schedule", "match"), ("goals", "match"), ("bis", "match"),
    ]
    # V1's fields are still there and unchanged next to the new object.
    assert items["DELTA4"]["fitSummary"]["jobs"]["status"] == "unknown"
    # Echo has no times: day basis with no local times.
    echo = items["ECHO05"]["fitV2"]
    assert echo["schedule"]["basis"] == "day"
    assert echo["schedule"]["nights"][0] == {
        "day": "FR", "localDay": None, "localStart": None, "localEnd": None, "coverage": "full",
    }


async def test_private_profile_gets_fit_v2_but_no_fit_summary(client: AsyncClient, world):
    body = await _get(client, {"fitV2": "true"}, world.private_headers)
    assert body["viewer"]["mainJob"] == "DRG"
    assert body["viewer"]["missing"] == ["template"]
    for item in body["items"]:
        assert item["fitV2"] is not None
        assert item["fitSummary"] is None
        assert item["goalAlignment"] is None
    # The private viewer's public gil_farm goal feeds their own V2 fit (Charlie wants gil_farm).
    charlie = _by_code(body)["CHARL3"]["fitV2"]
    assert {
        "kind": "goals", "status": "match",
        "params": {"aligned": 1, "partial": 0, "conflicts": 0, "missing": 0},
    } in charlie["reasons"]
    assert charlie["schedule"]["status"] == "unknown"  # no typical week


async def test_guest_fit_v2_is_ignored(client: AsyncClient, world):
    recent = await _get(client, {"sort": "recent"})
    body = await _get(client, {"fitV2": "true", "sort": "best", "asRole": "tank"})
    assert body["viewer"] is None
    assert body["fitCounts"] is None
    assert all(item["fitV2"] is None for item in body["items"])
    assert _names(body) == _names(recent)


async def test_as_role_changes_only_role_fit(client: AsyncClient, world):
    plain = await _get(client, {"fitV2": "true"}, world.viewer_headers)
    as_tank = await _get(client, {"fitV2": "true", "asRole": "tank"}, world.viewer_headers)

    def strip(body: dict) -> dict:
        out = {k: v for k, v in body.items() if k != "fitCounts"}
        out["items"] = []
        for item in body["items"]:
            fit = dict(item["fitV2"])
            fit.pop("role")
            fit.pop("tier")
            fit["reasons"] = [r for r in fit["reasons"] if r["kind"] != "role"]
            out["items"].append({**item, "fitV2": fit})
        return out

    assert strip(plain) == strip(as_tank)
    tank = _by_code(as_tank)
    assert all(item["fitV2"]["role"]["asRole"] == "tank" for item in tank.values())
    assert tank["ALPHA1"]["fitV2"]["role"]["status"] == "match"  # legacy tank needed (WAR)
    assert tank["DELTA4"]["fitV2"]["role"]["status"] == "none"
    assert _by_code(plain)["DELTA4"]["fitV2"]["role"]["status"] == "match"
    assert as_tank["fitCounts"] != plain["fitCounts"]


async def test_sort_best_orders_by_tier_then_matches_then_recency(
    client: AsyncClient, session: AsyncSession, world
):
    # Foxtrot is the newest listing and a "good" fit (alt WHM hits healer needed, every night
    # free, no objectives), so recent would put it first and best puts it after Delta.
    await _static(
        session, world.owner, name="Foxtrot Flex", share_code="FOXTR6",
        updated_at="2026-05-06T10:00:00+00:00",
        settings=_listing(needed_roles=["healer"], needed_jobs=["WHM"],
                          schedule_days=["Friday", "Saturday"]),
    )
    body = await _get(client, {"fitV2": "true", "sort": "best"}, world.viewer_headers)
    tiers = [(i["name"], i["fitV2"]["tier"]) for i in body["items"]]
    assert tiers == [
        ("Delta Dragoons", "strong"),
        ("Foxtrot Flex", "good"),
        ("Alpha Raiders", "partial"),
        ("Bravo Brigade", "weak"),  # two match reasons (role, bis), newer than Echo
        ("Echo Eight", "weak"),  # two match reasons (schedule, bis)
        ("Charlie Casuals", "weak"),  # one match reason (bis)
    ]
    recent = await _get(client, {"fitV2": "true", "sort": "recent"}, world.viewer_headers)
    assert _names(recent)[0] == "Foxtrot Flex"


async def _viewer_with_friday_template(session, user, *, tz="America/New_York"):
    profile = await create_player_profile(session, user, visibility="discoverable")
    await create_player_job_profile(session, profile, job="DRG", role="melee", priority="main")
    await create_player_job_profile(session, profile, job="WHM", role="healer", priority="flex")
    await create_personal_availability_template(
        session, user, day_of_week="FR", slots=NY_EVENING, timezone=tz
    )
    return profile


async def test_schedule_partial_caps_the_tier(
    client: AsyncClient, session: AsyncSession, test_user, test_user_2, auth_headers_user2
):
    await _viewer_with_friday_template(session, test_user_2)
    melee_needed = [{"role": "melee", "priority": "needed", "jobs": []}]
    healer_nice = [{"role": "healer", "priority": "nice_to_have", "jobs": []}]
    await _static(
        session, test_user, name="A two nights", share_code="CAPAAA",
        updated_at="2026-05-03T10:00:00+00:00",
        settings=_listing(needed_roles=None, needed_jobs=None, recruiting_roles=melee_needed,
                          schedule_days=["Friday", "Saturday"]),
    )
    await _static(
        session, test_user, name="B two nights", share_code="CAPBBB",
        updated_at="2026-05-02T10:00:00+00:00",
        settings=_listing(needed_roles=None, needed_jobs=None, recruiting_roles=healer_nice,
                          schedule_days=["Friday", "Saturday"]),
    )
    await _static(
        session, test_user, name="C friday only", share_code="CAPCCC",
        updated_at="2026-05-01T10:00:00+00:00",
        settings=_listing(needed_roles=None, needed_jobs=None, recruiting_roles=melee_needed,
                          schedule_days=["Friday"]),
    )
    body = await _get(client, {"fitV2": "true"}, auth_headers_user2)
    items = _by_code(body)
    assert items["CAPAAA"]["fitV2"]["role"]["status"] == "match"
    assert items["CAPAAA"]["fitV2"]["schedule"]["status"] == "partial"
    assert items["CAPAAA"]["fitV2"]["tier"] == "partial"
    assert items["CAPBBB"]["fitV2"]["role"]["status"] == "partial"
    assert items["CAPBBB"]["fitV2"]["role"]["priority"] == "nice_to_have"
    assert items["CAPBBB"]["fitV2"]["tier"] == "partial"
    assert items["CAPCCC"]["fitV2"]["schedule"]["status"] == "match"
    assert items["CAPCCC"]["fitV2"]["tier"] == "strong"
    assert body["fitCounts"] == {"strong": 1, "good": 0, "partial": 2, "weak": 0, "unknown": 0}
    # V1's fitSummary keeps its own reading of the same listing (the cap is V2-only): V1 reads
    # no jobs from a recruitingRoles-only listing (jobs unknown), one shared day (partial) and
    # a public BiS (ready), which _compute_overall calls good.
    assert items["CAPAAA"]["fitSummary"]["jobs"]["status"] == "unknown"
    assert items["CAPAAA"]["fitSummary"]["overall"] == "good"


async def test_fit_counts_cover_the_whole_list_before_pagination(client: AsyncClient, world):
    body = await _get(client, {"fitV2": "true", "limit": 2}, world.viewer_headers)
    assert len(body["items"]) == 2
    assert body["total"] == 5
    assert sum(body["fitCounts"].values()) == 5


async def test_schedule_overlap_uses_the_v2_status(client: AsyncClient, world):
    body = await _get(client, {"fitV2": "true", "scheduleOverlap": "true"}, world.viewer_headers)
    assert sorted(_names(body)) == ["Alpha Raiders", "Delta Dragoons", "Echo Eight"]
    for item in body["items"]:
        assert item["fitV2"]["schedule"]["status"] in ("match", "partial")


async def test_hide_goal_conflicts_works_for_a_private_profile(client: AsyncClient, world):
    """F4: the private viewer's public gil_farm goal conflicts with Alpha, Bravo and Delta."""
    with_v2 = await _get(
        client, {"fitV2": "true", "hideGoalConflicts": "true"}, world.private_headers
    )
    assert sorted(_names(with_v2)) == ["Charlie Casuals", "Echo Eight"]
    without = await _get(client, {"hideGoalConflicts": "true"}, world.private_headers)
    assert without["total"] == 5  # today's discoverable-only gate keeps them all


async def _friday_night_listings(session, owner):
    friday = await _static(
        session, owner, name="Friday Night", share_code="FRINYC",
        updated_at="2026-05-02T10:00:00+00:00",
        settings=_listing(schedule_days=["Friday"]),
    )
    no_days = await _static(
        session, owner, name="No Days", share_code="NODAYS",
        updated_at="2026-05-01T10:00:00+00:00",
        settings=_listing(schedule_days=None),
    )
    return friday, no_days


async def test_day_group_uses_the_viewers_calendar(
    client: AsyncClient, session: AsyncSession, test_user, test_user_2, test_user_3,
    auth_headers_user2, auth_headers_user3,
):
    await _friday_night_listings(session, test_user)
    # A Sydney viewer's template row with a valid slot: without one the listing would fall
    # to the day basis and be judged on its own FR (dropped, for the wrong reason).
    await create_personal_availability_template(
        session, test_user_2, day_of_week="SA", slots=["09:00"], timezone="Australia/Sydney"
    )
    await create_personal_availability_template(
        session, test_user_3, day_of_week="FR", slots=["20:00"], timezone="America/New_York"
    )
    params = {"fitV2": "true", "dayGroup": "weekends"}
    sydney = await _get(client, params, auth_headers_user2)
    assert _names(sydney) == ["Friday Night"]
    assert sydney["items"][0]["fitV2"]["schedule"]["nights"][0]["localDay"] == "SA"
    new_york = await _get(client, params, auth_headers_user3)
    assert _names(new_york) == []
    weeknights = await _get(client, {"fitV2": "true", "dayGroup": "weeknights"}, auth_headers_user3)
    assert _names(weeknights) == ["Friday Night"]  # No Days is dropped whenever dayGroup is set


async def test_viewer_tz_is_the_fallback_display_zone(
    client: AsyncClient, session: AsyncSession, test_user, test_user_2, auth_headers_user2
):
    await _static(
        session, test_user, name="Friday Night", share_code="FRINYC",
        updated_at="2026-05-02T10:00:00+00:00",
        settings=_listing(schedule_days=["Friday"], schedule_start_time="19:00",
                          schedule_end_time="22:00"),
    )
    params = {"fitV2": "true", "dayGroup": "weekends", "viewerTz": "Australia/Sydney"}
    sydney = await _get(client, params, auth_headers_user2)
    assert _names(sydney) == ["Friday Night"]
    fit = sydney["items"][0]["fitV2"]
    assert fit["schedule"]["status"] == "unknown"
    assert fit["schedule"]["nights"] == [{
        "day": "FR", "localDay": "SA", "localStart": "09:00", "localEnd": "12:00", "coverage": None,
    }]
    assert fit["missing"] == ["template", "jobs"]
    assert sydney["viewer"] == {"mainJob": None, "mainRole": None, "missing": ["template", "jobs"]}

    bad = await _get(client, {"fitV2": "true", "viewerTz": "Not/AZone"}, auth_headers_user2)
    assert bad["items"][0]["fitV2"]["schedule"]["nights"] == []
    dropped = await _get(client, {**params, "viewerTz": "Not/AZone"}, auth_headers_user2)
    assert dropped["total"] == 0


async def test_display_zone_tie_goes_to_the_first_row_by_id(
    client: AsyncClient, session: AsyncSession, test_user, test_user_2, auth_headers_user2
):
    """Two template rows with one updated_at: the router orders by (updated_at desc, id)."""
    await _static(
        session, test_user, name="Friday Night", share_code="FRINYC",
        updated_at="2026-05-02T10:00:00+00:00", settings=_listing(schedule_days=["Friday"]),
    )
    from app.models.personal_availability import PersonalAvailabilityTemplate

    for row_id, day, tz in (
        ("00000000-0000-0000-0000-000000000002", "SA", "Europe/London"),
        ("00000000-0000-0000-0000-000000000001", "FR", "America/New_York"),
    ):
        session.add(PersonalAvailabilityTemplate(
            id=row_id, user_id=test_user_2.id, day_of_week=day, slots=json.dumps(["20:00"]),
            timezone=tz, updated_at="2026-05-01T00:00:00+00:00",
        ))
    await session.flush()
    body = await _get(client, {"fitV2": "true"}, auth_headers_user2)
    night = body["items"][0]["fitV2"]["schedule"]["nights"][0]
    assert (night["localDay"], night["localStart"]) == ("FR", "20:00")  # New York, id ...0001


async def test_goal_category_accepts_a_comma_separated_union(client: AsyncClient, world):
    union = await _get(client, {"goalCategory": "savage_bis,ultimate_clear"})
    assert sorted(_names(union)) == ["Alpha Raiders", "Bravo Brigade", "Delta Dragoons"]
    single = await _get(client, {"goalCategory": "savage_bis"})
    assert sorted(_names(single)) == ["Alpha Raiders", "Delta Dragoons"]
    stripped = await _get(client, {"goalCategory": " savage_bis , ,ultimate_clear"})
    assert sorted(_names(stripped)) == ["Alpha Raiders", "Bravo Brigade", "Delta Dragoons"]


async def test_fit_v2_adds_no_statements_for_a_discoverable_viewer(
    client: AsyncClient, session: AsyncSession, engine, count_statements, world
):
    _, off = await _get_counted(client, session, engine, count_statements, {}, world.viewer_headers)
    _, on = await _get_counted(
        client, session, engine, count_statements, {"fitV2": "true"}, world.viewer_headers
    )
    assert on - off == 0


async def test_fit_v2_statement_count_is_independent_of_listing_count(
    client: AsyncClient, session: AsyncSession, engine, count_statements,
    test_user, test_user_2, auth_headers_user2,
):
    await _viewer_with_friday_template(session, test_user_2)
    await _static(
        session, test_user, name="Static 0", share_code="STAT00",
        updated_at="2026-05-01T10:00:00+00:00", settings=_listing(),
        objectives=[("savage_bis", "required")],
    )
    _, one = await _get_counted(
        client, session, engine, count_statements, {"fitV2": "true"}, auth_headers_user2
    )
    for index in range(1, 5):
        await _static(
            session, test_user, name=f"Static {index}", share_code=f"STAT0{index}",
            updated_at=f"2026-05-0{index + 1}T10:00:00+00:00", settings=_listing(),
            objectives=[("savage_bis", "required")],
        )
    body, five = await _get_counted(
        client, session, engine, count_statements, {"fitV2": "true"}, auth_headers_user2
    )
    assert body["total"] == 5
    assert one == five
