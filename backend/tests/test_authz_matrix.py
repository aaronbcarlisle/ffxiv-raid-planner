"""AUTHZ: every mutation route against its ruled minimum role (R-P0-8).

The table is `tests/authz_matrix.py`. Each probe builds its own world (V6c):
owner calls to DELETE routes would wreck a shared one.
"""

import uuid
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fastapi.routing import iter_route_contexts
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.models import MemberRole, ScheduleSettings, StaticContentSuggestionVote, User
from tests.authz_matrix import ROUTES, AuthzRoute
from tests.factories import (
    create_catalog_item,
    create_collection_goal,
    create_content_suggestion,
    create_invitation,
    create_join_request,
    create_loot_log_entry,
    create_material_log_entry,
    create_membership,
    create_objective_goal,
    create_page_ledger_entry,
    create_participant_state,
    create_reward_drop,
    create_roster_bis_target_set,
    create_schedule_exception,
    create_schedule_session,
    create_snapshot_player,
    create_split_clear_assignment,
    create_static_character_registration,
    create_static_group,
    create_tier_snapshot,
    create_user,
    create_weekly_assignment,
)

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_ERROR = "csrf_validation_failed"

CS = "/api/static-groups/{group_id}/content-suggestions"
# R-P0-6 / HS-35 #2 (a): the only static-scoped writes a viewer may make.
VIEWER_ALLOWLIST = {
    ("POST", CS),
    ("PATCH", CS + "/{suggestion_id}"),
    ("DELETE", CS + "/{suggestion_id}"),
    ("PUT", CS + "/{suggestion_id}/vote"),
    ("DELETE", CS + "/{suggestion_id}/vote"),
    ("DELETE", "/api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/claim"),
}


def live_mutation_routes() -> set[tuple[str, str]]:
    return {
        (method, rc.path)
        for rc in iter_route_contexts(app.routes)
        for method in (rc.methods or ())
        if method in MUTATING
    }


# ── The world ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class World:
    u: dict[str, User]
    group: Any
    tier: Any
    card: dict[str, Any]
    goal: Any
    drop: dict[str, Any]
    suggestion: dict[str, Any]
    sched: Any
    exception_date: str
    future_date: str
    future_start: str
    future_end: str
    loot: Any
    material: Any
    join_request: Any
    accepted_request: Any
    invitation: Any
    reg: dict[str, Any]
    split: Any
    objective: Any
    catalog_item: Any
    roster_bis: Any
    assignment: Any
    caller: str = field(default="owner")

    def as_(self, caller: str) -> "World":
        return replace(self, caller=caller)

    @property
    def me(self) -> User:
        return self.u[self.caller]

    @property
    def my_card(self):
        return self.card[self.caller]

    @property
    def my_drop(self):
        return self.drop[self.caller]

    @property
    def my_suggestion(self):
        return self.suggestion[self.caller]

    @property
    def my_reg(self):
        return self.reg[self.caller]


async def build_world(session: AsyncSession) -> World:
    """One static with every role, and one of each object a mutation route targets."""
    names = ("owner", "lead", "member", "member2", "viewer", "outsider", "applicant", "applicant2")
    u = {n: await create_user(session, discord_id=f"authz_{n}", discord_username=n) for n in names}

    group = await create_static_group(session, u["owner"], settings={"splitClearMode": True})
    await create_membership(session, u["lead"], group, role=MemberRole.LEAD)
    await create_membership(session, u["member"], group, role=MemberRole.MEMBER)
    await create_membership(session, u["member2"], group, role=MemberRole.MEMBER)
    await create_membership(session, u["viewer"], group, role=MemberRole.VIEWER)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    tier = await create_tier_snapshot(session, group)
    tier.week_start_date = (now - timedelta(days=15)).isoformat()  # week 3: revert-week can run

    card = {}
    for i, (name, job, role, pos) in enumerate(
        (
            ("member", "DRG", "melee", "M1"),
            ("viewer", "WHM", "healer", "H1"),
            ("lead", "PLD", "tank", "MT"),
            ("open", "BLM", "caster", "R1"),
        )
    ):
        player = await create_snapshot_player(
            session, tier, name=f"{name} card", job=job, role=role, position=pos, sort_order=i
        )
        if name != "open":
            player.user_id = u[name].id
        card[name] = player

    goal = await create_collection_goal(session, group, u["owner"])
    await create_participant_state(session, goal, u["member"])
    await create_participant_state(session, goal, u["member2"])
    drop = {
        # The viewer's drop was logged before a demotion to viewer.
        n: await create_reward_drop(session, goal, u[n], recipient=u[n] if n != "viewer" else None)
        for n in ("member", "viewer", "member2")
    }

    suggestion = {
        n: await create_content_suggestion(session, group, u[n], title=f"{n} idea")
        for n in ("viewer", "member", "member2")
    }
    session.add(
        StaticContentSuggestionVote(
            id=str(uuid.uuid4()),
            suggestion_id=suggestion["member2"].id,
            user_id=u["viewer"].id,
            vote="want",
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )
    )

    start = now + timedelta(days=1)
    sched = await create_schedule_session(
        session,
        group,
        u["owner"],
        start_time=start.isoformat(),
        end_time=(start + timedelta(hours=2)).isoformat(),
        is_recurring=True,
        recurrence_rule="FREQ=WEEKLY",
    )
    exception_date = (start + timedelta(days=7)).date().isoformat()
    await create_schedule_exception(session, sched, u["owner"], occurrence_date=exception_date)
    session.add(
        ScheduleSettings(
            id=str(uuid.uuid4()),
            static_group_id=group.id,
            webhook_url="https://discord.com/api/webhooks/1/authz-probe",
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )
    )

    loot = await create_loot_log_entry(session, tier, card["open"], u["owner"])
    material = await create_material_log_entry(session, tier, card["open"], u["owner"])
    await create_page_ledger_entry(session, tier, card["open"], u["owner"])

    reg = {
        n: await create_static_character_registration(
            session, group, card[n], manual_character_name=f"{n} alt"
        )
        for n in ("member", "viewer", "open")
    }

    world = World(
        u=u,
        group=group,
        tier=tier,
        card=card,
        goal=goal,
        drop=drop,
        suggestion=suggestion,
        sched=sched,
        exception_date=exception_date,
        future_date=(start + timedelta(days=14)).date().isoformat(),
        future_start=(start + timedelta(days=3)).isoformat(),
        future_end=(start + timedelta(days=3, hours=2)).isoformat(),
        loot=loot,
        material=material,
        join_request=await create_join_request(session, group, u["applicant"]),
        accepted_request=await create_join_request(
            session, group, u["applicant2"], status="accepted"
        ),
        invitation=await create_invitation(session, group, u["owner"]),
        reg=reg,
        split=await create_split_clear_assignment(session, group, card["open"]),
        objective=await create_objective_goal(session, group, u["owner"]),
        catalog_item=await create_catalog_item(session),
        roster_bis=await create_roster_bis_target_set(session, group, card["open"], u["owner"]),
        assignment=await create_weekly_assignment(session, group, tier, player=card["open"]),
    )
    await session.commit()
    return world


@pytest_asyncio.fixture
async def world(session: AsyncSession) -> World:
    return await build_world(session)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """No probe may reach the network: stub the outbound calls owner probes trigger."""

    async def _refuse(self, request):
        raise RuntimeError(f"AUTHZ probe tried the network: {request.url}")

    async def _identity(lodestone_id):
        return {
            "lodestone_name": "Probe Character",
            "lodestone_server": "Tonberry",
            "lodestone_avatar_url": "https://example.invalid/avatar.png",
        }

    async def _webhook_ok(*args, **kwargs):
        return True, 204, ""

    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", _refuse)
    monkeypatch.setattr("app.routers.lodestone._fetch_tomestone_identity", _identity)
    monkeypatch.setattr("app.routers.schedule.post_schedule_webhook", _webhook_ok)
    monkeypatch.setattr("app.routers.schedule._post_or_edit_webhook", _noop)


# ── Sending a row's request ──────────────────────────────────────────────────


async def send(client: AsyncClient, row: AuthzRoute, world: World, caller: str) -> httpx.Response:
    """Send the row's request as `caller` through the CSRF-injecting client methods."""
    params, query, body = row.build(world.as_(caller))
    url = row.path.format(**params)
    kwargs: dict[str, Any] = {
        "headers": {"Authorization": f"Bearer {create_access_token(world.u[caller].id)}"}
    }
    if query:
        kwargs["params"] = query
    method = row.method.lower()
    if body is not None and method == "delete":
        # httpx's delete() takes no body; inject CSRF exactly as the client's verbs do.
        client._inject_csrf_header(kwargs)
        return await client.request("DELETE", url, json=body, **kwargs)
    if body is not None:
        kwargs["json"] = body
    return await getattr(client, method)(url, **kwargs)


def _error_code(resp: httpx.Response) -> Any:
    try:
        payload = resp.json()
    except ValueError:
        return None
    return payload.get("error") if isinstance(payload, dict) else None


def _params(rows: list[AuthzRoute], probe: str) -> list:
    out = []
    for row in rows:
        reasons = [reason for name, reason in row.gaps if name == probe]
        marks = [pytest.mark.xfail(strict=True, reason=reasons[0])] if reasons else []
        out.append(pytest.param(row, id=row.id, marks=marks))
    return out


VIEWER_DENIED = [r for r in ROUTES if r.static_scoped and r.min_role != "viewer"]
MEMBER_DENIED = [r for r in ROUTES if r.min_role in ("lead", "owner")]
VIEWER_ALLOWED = [r for r in ROUTES if r.min_role == "viewer"]
WITH_BUILD = [r for r in ROUTES if r.build is not None]


# ── R-P0-8.1: completeness (the CI gate) ─────────────────────────────────────


def test_route_table_is_complete():
    live = live_mutation_routes()
    table = {(r.method, r.path) for r in ROUTES if not r.dev_only or (r.method, r.path) in live}
    missing = sorted(live - table)
    extra = sorted(table - live)
    assert not missing and not extra, (
        "AUTHZ table out of date (tests/authz_matrix.py).\n"
        + "".join(f"  missing: {m} {p}\n" for m, p in missing)
        + "".join(f"  extra:   {m} {p}\n" for m, p in extra)
    )


def test_route_table_rows_are_well_formed():
    roles = set("public optional user self viewer member lead owner admin admin_or_key dev".split())
    ids = [r.id for r in ROUTES]
    assert len(ids) == len(set(ids)), "duplicate (method, path, variant) rows"
    keys = [(r.method, r.path) for r in ROUTES]
    for row in ROUTES:
        assert row.min_role in roles, row.id
        assert row.gate in {"depends", "helper", "inline"}, row.id
        assert row.intent, row.id
        assert row.variant or keys.count((row.method, row.path)) == 1, f"{row.id} needs a variant"
        assert not row.static_scoped or row.build is not None, f"{row.id} has no build"


# ── R-P0-8.2: a viewer is refused every static write above viewer ────────────


@pytest.mark.parametrize("row", _params(VIEWER_DENIED, "viewer"))
async def test_viewer_is_refused(client, world, row):
    resp = await send(client, row, world, "viewer")
    assert resp.status_code == 403, f"{row.id}: viewer got {resp.status_code} {resp.text[:200]}"
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: 403 came from CSRF, not the gate"


# ── R-P0-8.3: a member is refused every lead/owner write ─────────────────────


@pytest.mark.parametrize("row", _params(MEMBER_DENIED, "member"))
async def test_member_is_refused(client, world, row):
    resp = await send(client, row, world, "member")
    assert resp.status_code == 403, f"{row.id}: member got {resp.status_code} {resp.text[:200]}"
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: 403 came from CSRF, not the gate"


# ── R-P0-8.4: the viewer allowlist is exact, and those calls go through ──────


def test_viewer_allowlist_is_exact():
    viewer_rows = {(r.method, r.path) for r in VIEWER_ALLOWED}
    extra = sorted(viewer_rows - VIEWER_ALLOWLIST)
    missing = sorted(VIEWER_ALLOWLIST - viewer_rows)
    assert not extra and not missing, f"viewer rows extra: {extra} missing: {missing}"


@pytest.mark.parametrize("row", _params(VIEWER_ALLOWED, "allowed"))
async def test_viewer_allowlist_call_is_not_refused(client, world, row):
    resp = await send(client, row, world, "viewer")
    assert resp.status_code != 403, f"{row.id}: viewer got 403 {resp.text[:200]}"


# ── R-P0-8.5: the row's allowed actor gets through (so every build is valid) ─


@pytest.mark.parametrize("row", _params(WITH_BUILD, "actor"))
async def test_allowed_actor_gets_through(client, world, row):
    resp = await send(client, row, world, row.actor)
    ok = 200 <= resp.status_code < 300 or (
        400 <= resp.status_code < 500 and resp.status_code not in {401, 403, 404, 405, 422}
    )
    assert ok and _error_code(resp) != CSRF_ERROR, (
        f"{row.id}: {row.actor} got {resp.status_code} {resp.text[:300]}"
    )
