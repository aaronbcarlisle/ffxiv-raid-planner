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
from pathlib import Path
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import JoinRequest, Membership, MemberRole, StaticGroup, User

pytestmark = pytest.mark.asyncio

GOLDEN_PATH = Path(__file__).parent / "golden" / "join_requests_v1.json"
ADDITIVE_ITEM_KEYS = ("fit",)

T0 = "2026-09-01T00:00:00+00:00"


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
