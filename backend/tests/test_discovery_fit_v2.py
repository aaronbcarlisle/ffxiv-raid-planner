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
    await create_player_job_profile(session, viewer_profile, job="WHM", role="healer", priority="flex")
    for day in ("FR", "SA"):
        await create_personal_availability_template(
            session, test_user_2, day_of_week=day, slots=NY_EVENING, timezone="America/New_York"
        )
    await _goal(session, viewer_profile, "savage_bis")
    await _public_bis(session, drg)

    private_profile = await create_player_profile(session, test_user_3, visibility="private")
    await create_player_job_profile(session, private_profile, job="DRG", role="melee", priority="main")
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
