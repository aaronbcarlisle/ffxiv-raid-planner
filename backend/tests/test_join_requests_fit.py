"""Applicant fit on `GET /api/static-groups/{id}/join-requests?fit=true` (Stage 4 RH1a, Task 1).

The V1 golden: `tests/golden/join_requests_v1.json` holds the group list response
for a pinned fixture (fixed ids and timestamps: one pending, one under-review and
one declined request) taken with `include_resolved=true` and no `fit`, plus its
statement count, captured on the base commit 6739b9f5. Regenerate it only on that
base with `JOIN_REQUESTS_GOLDEN_WRITE=1 pytest tests/test_join_requests_fit.py
-k v1_response_unchanged`. `test_v1_response_unchanged` deletes each item's
additive `fit` key and compares the rest and the statement count, so a request
without `fit` stays byte-for-byte (the plugin contract).
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

from app.auth_utils import create_access_token
from app.models import JoinRequest, Membership, MemberRole, StaticGroup, User
from tests.factories import (
    create_membership,
    create_personal_availability_template,
    create_player_job_profile,
    create_player_profile,
    create_static_group,
    create_user,
)

pytestmark = pytest.mark.asyncio

GOLDEN_PATH = Path(__file__).parent / "golden" / "join_requests_v1.json"
ADDITIVE_ITEM_KEYS = ("fit",)

T0 = "2026-09-01T00:00:00+00:00"
# Both routers place raid nights from datetime.now(UTC); pinned to the Wednesday
# test_discovery_fit_v2.py uses so the applicant fit and the Finder fit share a clock.
FROZEN_NOW = datetime(2026, 6, 3, 12, tzinfo=UTC)
NY_EVENING = ["20:00", "20:30", "21:00", "21:30", "22:00", "22:30"]  # Fri 20:00-23:00


class _FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return FROZEN_NOW if tz is None else FROZEN_NOW.astimezone(tz)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.join_requests.datetime", _FrozenDatetime)
    monkeypatch.setattr("app.routers.discovery.datetime", _FrozenDatetime)


def _listing(
    *,
    recruitment_status: str = "open",
    timezone: str | None = "America/New_York",
    recruiting_roles: list[dict] | None = None,
    schedule_days: list[str] | None = None,
    schedule_start_time: str | None = "20:00",
    schedule_end_time: str | None = "23:00",
) -> dict:
    """A listing in the shape `DiscoveryTab` saves; `timezone=None` omits the key (M4)."""
    discovery: dict = {
        "enabled": True,
        "recruitmentStatus": recruitment_status,
        "description": "Friday melee wanted",
        "recruitingRoles": recruiting_roles
        if recruiting_roles is not None
        else [{"role": "melee", "priority": "needed", "jobs": []}],
        "scheduleDays": schedule_days if schedule_days is not None else ["FR"],
        "scheduleStartTime": schedule_start_time,
        "scheduleEndTime": schedule_end_time,
    }
    if timezone is not None:
        discovery["timezone"] = timezone
    return {"discovery": discovery}


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ---------------------------------------------------------------------------
# Pinned fixture for the golden (fixed ids, fixed timestamps)
# ---------------------------------------------------------------------------


def _pinned_user(index: int, name: str) -> User:
    return User(
        id=f"00000000-0000-4000-8000-0000000000{index:02d}",
        discord_id=f"8000000000000000{index:02d}",
        discord_username=name,
        created_at=T0,
        updated_at=T0,
    )


@pytest_asyncio.fixture
async def pinned(session: AsyncSession) -> SimpleNamespace:
    """One listing with a pending, an under-review and a declined request."""
    owner = _pinned_user(1, "rh1a_owner")
    pending_user = _pinned_user(2, "rh1a_pending")
    review_user = _pinned_user(3, "rh1a_review")
    declined_user = _pinned_user(4, "rh1a_declined")
    session.add_all([owner, pending_user, review_user, declined_user])
    await session.flush()

    group = StaticGroup(
        id="00000000-0000-4000-8000-0000000000b1",
        name="Pinned Static",
        owner_id=owner.id,
        share_code="RH1AGL",
        is_public=True,
        settings=_listing(),
        created_at=T0,
        updated_at=T0,
    )
    session.add(group)
    session.add(
        Membership(
            id="00000000-0000-4000-8000-0000000000c1",
            user_id=owner.id,
            static_group_id=group.id,
            role=MemberRole.OWNER.value,
            joined_at=T0,
            updated_at=T0,
        )
    )
    await session.flush()

    rows = [
        JoinRequest(
            id="00000000-0000-4000-8000-0000000000d1",
            static_group_id=group.id,
            requester_user_id=pending_user.id,
            status="pending",
            message="Friday DRG here",
            role_interest=["melee"],
            job_interest=["drg"],
            selected_job="drg",
            selected_role="melee",
            created_at="2026-09-20T10:00:00+00:00",
            updated_at="2026-09-20T10:00:00+00:00",
        ),
        JoinRequest(
            id="00000000-0000-4000-8000-0000000000d2",
            static_group_id=group.id,
            requester_user_id=review_user.id,
            status="under_review",
            message="Can flex to caster",
            role_interest=["melee", "caster"],
            job_interest=["drg", "blm"],
            selected_job="drg",
            selected_role="melee",
            created_at="2026-09-19T10:00:00+00:00",
            updated_at="2026-09-19T12:00:00+00:00",
        ),
        JoinRequest(
            id="00000000-0000-4000-8000-0000000000d3",
            static_group_id=group.id,
            requester_user_id=declined_user.id,
            status="declined",
            message=None,
            role_interest=["tank"],
            job_interest=["war"],
            selected_job="war",
            selected_role="tank",
            resolved_at="2026-09-18T12:00:00+00:00",
            resolved_by_user_id=owner.id,
            created_at="2026-09-18T10:00:00+00:00",
            updated_at="2026-09-18T12:00:00+00:00",
        ),
    ]
    session.add_all(rows)
    await session.flush()
    await session.commit()
    return SimpleNamespace(
        owner=owner,
        owner_headers=_headers(owner),
        group=group,
        pending_user=pending_user,
        review_user=review_user,
        declined_user=declined_user,
    )


async def _list_counted(
    client: AsyncClient,
    session: AsyncSession,
    engine,
    count_statements,
    group_id: str,
    params: dict,
    headers: dict,
) -> tuple[dict, int]:
    # Start from an empty identity map so a load can't be skipped because the
    # previous request already loaded the row (test_discovery_fit_v2.py).
    session.expunge_all()
    with count_statements(engine) as counts:
        resp = await client.get(
            f"/api/static-groups/{group_id}/join-requests", params=params, headers=headers
        )
        assert resp.status_code == 200, resp.text
    return resp.json(), counts.n


def _normalise_v1(body: dict) -> dict:
    """Drop each item's additive `fit` key."""
    out = dict(body)
    out["items"] = [
        {k: v for k, v in item.items() if k not in ADDITIVE_ITEM_KEYS} for item in body["items"]
    ]
    return out


async def test_v1_response_unchanged(
    client: AsyncClient, session: AsyncSession, engine, count_statements, pinned: SimpleNamespace
):
    body, n = await _list_counted(
        client, session, engine, count_statements, pinned.group.id,
        {"include_resolved": "true"}, pinned.owner_headers,
    )
    captured = {"statements": n, "response": _normalise_v1(body)}

    if os.environ.get("JOIN_REQUESTS_GOLDEN_WRITE"):
        GOLDEN_PATH.parent.mkdir(exist_ok=True)
        GOLDEN_PATH.write_text(
            json.dumps(captured, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
        )
        pytest.skip(f"golden written to {GOLDEN_PATH}")

    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    assert [item["status"] for item in captured["response"]["items"]] == [
        "pending", "under_review", "declined",
    ]
    assert captured["response"] == golden["response"]
    assert captured["statements"] == golden["statements"]


async def test_fit_key_is_null_without_the_flag(
    client: AsyncClient, pinned: SimpleNamespace
):
    """The additive key is present as null on every row without `?fit=true`."""
    resp = await client.get(
        f"/api/static-groups/{pinned.group.id}/join-requests",
        params={"include_resolved": "true"}, headers=pinned.owner_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 3
    assert all("fit" in item and item["fit"] is None for item in items)


# ---------------------------------------------------------------------------
# Applicant fit (R-RH-C)
# ---------------------------------------------------------------------------


async def _applicant_with_template(session: AsyncSession, user: User, *, template: bool = True):
    profile = await create_player_profile(session, user, visibility="private")
    await create_player_job_profile(session, profile, job="DRG", role="melee", priority="main")
    if template:
        await create_personal_availability_template(
            session, user, day_of_week="FR", slots=NY_EVENING, timezone="America/New_York"
        )
    return profile


async def _post_request(client: AsyncClient, share_code: str, headers: dict, profile_id: str) -> dict:
    resp = await client.post(
        f"/api/static-groups/{share_code}/join-requests",
        json={
            "roleInterest": ["melee"], "jobInterest": ["drg"], "selectedJob": "drg",
            "playerProfileId": profile_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _insert_request(
    session: AsyncSession, group: StaticGroup, user: User, *, status: str = "pending", **fields
) -> JoinRequest:
    row = JoinRequest(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        requester_user_id=user.id,
        status=status,
        created_at=T0,
        updated_at=T0,
        **fields,
    )
    session.add(row)
    await session.flush()
    await session.commit()
    return row


async def _list_fit(client: AsyncClient, group_id: str, headers: dict) -> dict[str, dict]:
    resp = await client.get(
        f"/api/static-groups/{group_id}/join-requests",
        params={"include_resolved": "true", "fit": "true"}, headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {item["id"]: item for item in resp.json()["items"]}


@pytest_asyncio.fixture
async def listing(session: AsyncSession, test_user: User) -> StaticGroup:
    return await create_static_group(
        session, test_user, name="Friday Melee", is_public=True, settings=_listing()
    )


async def test_applicant_with_friday_template_matches(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup,
    test_user: User, test_user_2: User, auth_headers: dict, auth_headers_user2: dict,
):
    profile = await _applicant_with_template(session, test_user_2)
    created = await _post_request(client, listing.share_code, auth_headers_user2, profile.id)
    assert created["fit"] is None  # the create response carries the key as null

    fit = (await _list_fit(client, listing.id, auth_headers))[created["id"]]["fit"]
    assert fit["role"]["status"] == "match"
    assert fit["role"]["asRole"] == "melee"
    assert fit["schedule"]["status"] == "match"
    assert fit["schedule"]["nights"][0]["localStart"] == "20:00"  # the listing's zone
    assert [
        {"kind": r["kind"], "status": r["status"]} for r in fit["reasons"] if r["kind"] == "role"
    ] == [{"kind": "role", "status": "match"}]
    assert fit["missing"] == []
    assert fit["tier"] == "strong"


async def test_applicant_fit_equals_the_finder_fit(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup,
    test_user_2: User, auth_headers: dict, auth_headers_user2: dict,
):
    """Criterion 2: the same user's Finder fit (`fitV2`, `asRole=melee`) for this listing."""
    profile = await _applicant_with_template(session, test_user_2)
    created = await _post_request(client, listing.share_code, auth_headers_user2, profile.id)
    applicant_fit = (await _list_fit(client, listing.id, auth_headers))[created["id"]]["fit"]

    finder = await client.get(
        "/api/discovery/statics", params={"fitV2": "true", "asRole": "melee"},
        headers=auth_headers_user2,
    )
    assert finder.status_code == 200, finder.text
    finder_fit = next(
        item["fitV2"] for item in finder.json()["items"] if item["shareCode"] == listing.share_code
    )

    def strip(fit: dict) -> dict:
        return {
            "tier": fit["tier"], "role": fit["role"], "schedule": fit["schedule"]["status"],
            "reasons": fit["reasons"],
        }

    assert strip(applicant_fit) == strip(finder_fit)
    assert applicant_fit["tier"] == "strong"


async def test_no_template_caps_the_tier(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup,
    test_user_3: User, auth_headers: dict, auth_headers_user3: dict,
):
    """OWNER-5: a main DRG with no typical week reads strong but is capped at partial."""
    profile = await _applicant_with_template(session, test_user_3, template=False)
    created = await _post_request(client, listing.share_code, auth_headers_user3, profile.id)
    fit = (await _list_fit(client, listing.id, auth_headers))[created["id"]]["fit"]
    assert fit["schedule"]["status"] == "unknown"
    assert "template" in fit["missing"]
    assert fit["tier"] == "partial"
    assert [r["status"] for r in fit["reasons"] if r["kind"] == "role"] == ["match"]


async def test_claimed_role_without_a_profile(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup, auth_headers: dict,
):
    """The engine honours asRole without jobs, so the role matches and the cap applies."""
    applicant = await create_user(session, discord_username="no_profile")
    row = await _insert_request(session, listing, applicant, role_interest=["melee"])
    fit = (await _list_fit(client, listing.id, auth_headers))[row.id]["fit"]
    assert fit["role"]["status"] == "match"
    assert fit["role"]["asRole"] == "melee"
    assert fit["tier"] == "partial"
    assert fit["missing"] == ["template", "jobs"]


async def test_no_role_and_no_profile_is_unknown(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup, auth_headers: dict,
):
    applicant = await create_user(session, discord_username="blank")
    row = await _insert_request(session, listing, applicant)
    fit = (await _list_fit(client, listing.id, auth_headers))[row.id]["fit"]
    assert fit["tier"] == "unknown"
    assert fit["missing"] == ["template", "jobs"]


async def test_selected_role_outside_the_role_keys_gives_no_as_role(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup, auth_headers: dict,
):
    applicant = await create_user(session, discord_username="dps")
    row = await _insert_request(
        session, listing, applicant, selected_role="dps", role_interest=["melee"],
    )
    fit = (await _list_fit(client, listing.id, auth_headers))[row.id]["fit"]
    assert fit["role"]["asRole"] is None


async def test_listing_without_a_timezone_uses_the_day_basis(
    client: AsyncClient, session: AsyncSession, test_user: User, test_user_2: User,
    auth_headers: dict, auth_headers_user2: dict,
):
    """M4: no `timezone` key never reaches `load_zone(None)`; a Friday template is judged by day."""
    group = await create_static_group(
        session, test_user, name="No Zone", is_public=True, settings=_listing(timezone=None)
    )
    profile = await _applicant_with_template(session, test_user_2)
    created = await _post_request(client, group.share_code, auth_headers_user2, profile.id)
    fit = (await _list_fit(client, group.id, auth_headers))[created["id"]]["fit"]
    assert fit["schedule"]["basis"] == "day"
    assert fit["schedule"]["status"] == "match"


async def test_resolved_rows_have_no_fit(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup, auth_headers: dict,
):
    """M5: a declined request carries `fit: null` while the waiting ones carry a fit."""
    pending = await _insert_request(
        session, listing, await create_user(session, discord_username="p"), role_interest=["melee"],
    )
    review = await _insert_request(
        session, listing, await create_user(session, discord_username="r"),
        status="under_review", role_interest=["melee"],
    )
    declined = await _insert_request(
        session, listing, await create_user(session, discord_username="d"),
        status="declined", role_interest=["melee"], resolved_at=T0,
    )
    items = await _list_fit(client, listing.id, auth_headers)
    assert items[pending.id]["fit"] is not None
    assert items[review.id]["fit"] is not None
    assert items[declined.id]["fit"] is None


async def test_group_without_discovery_gives_no_fit(
    client: AsyncClient, session: AsyncSession, test_user: User, auth_headers: dict,
):
    group = await create_static_group(session, test_user, name="Plain", is_public=True)
    row = await _insert_request(
        session, group, await create_user(session, discord_username="x"), role_interest=["melee"],
    )
    items = await _list_fit(client, group.id, auth_headers)
    assert items[row.id]["fit"] is None


async def test_member_cannot_list_with_fit(
    client: AsyncClient, session: AsyncSession, listing: StaticGroup,
    test_user_2: User, auth_headers_user2: dict,
):
    await create_membership(session, test_user_2, listing, role=MemberRole.MEMBER)
    resp = await client.get(
        f"/api/static-groups/{listing.id}/join-requests", params={"fit": "true"},
        headers=auth_headers_user2,
    )
    assert resp.status_code == 403


async def test_statement_count_is_constant_in_waiting_applicants(
    client: AsyncClient, session: AsyncSession, engine, count_statements, listing: StaticGroup,
    test_user_2: User, auth_headers: dict, auth_headers_user2: dict,
):
    """One waiting applicant with a profile, jobs and a template (every conditional
    load runs) issues the same statements as three."""
    profile = await _applicant_with_template(session, test_user_2)
    await _post_request(client, listing.share_code, auth_headers_user2, profile.id)

    _, without = await _list_counted(
        client, session, engine, count_statements, listing.id,
        {"include_resolved": "true"}, auth_headers,
    )
    _, one = await _list_counted(
        client, session, engine, count_statements, listing.id,
        {"include_resolved": "true", "fit": "true"}, auth_headers,
    )
    assert one > without  # the fit loads really ran

    for name in ("second", "third"):
        user = await create_user(session, discord_username=name)
        await _applicant_with_template(session, user)
        await _insert_request(session, listing, user, role_interest=["melee"], selected_role="melee")

    body, three = await _list_counted(
        client, session, engine, count_statements, listing.id,
        {"include_resolved": "true", "fit": "true"}, auth_headers,
    )
    assert len([i for i in body["items"] if i["fit"] is not None]) == 3
    assert one == three
