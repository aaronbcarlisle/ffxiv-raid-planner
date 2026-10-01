"""AUTHZ: every mutation route against its ruled minimum role (R-P0-8).

The table is `tests/authz_matrix.py`. Each probe builds its own world (V6c):
owner calls to DELETE routes would wreck a shared one.
"""

import re
import uuid
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import pytest
import pytest_asyncio
from fastapi.routing import iter_route_contexts
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.middleware.csrf import CSRF_HEADER_NAME
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
WORLD_USERS = (
    "owner", "lead", "member", "member2", "viewer", "outsider", "applicant", "applicant2",
    "admin",
)

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
    tier2: Any
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

    @property
    def other_card(self):
        """A card the caller does not hold: the lead's, or the member's when the caller is lead."""
        return self.card["member" if self.caller == "lead" else "lead"]


async def build_world(session: AsyncSession, *, public: bool = False) -> World:
    """One static with every role, and one of each object a mutation route targets.

    `public` makes the static public: the outsider probe's world (B17). It adds no object.
    """
    u = {
        n: await create_user(session, discord_id=f"authz_{n}", discord_username=n)
        for n in WORLD_USERS
    }

    # The admin is outside the static. Used by the admin-key plugin row, the admin-assign
    # actor probe and the admin-key probe.
    u["admin"].is_admin = True
    group = await create_static_group(
        session, u["owner"], settings={"splitClearMode": True}, is_public=public
    )
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
    # A second tier where no one holds a card: the claim probe's viewer must be cardless.
    tier2 = await create_tier_snapshot(
        session, group, tier_id="aac-light-heavyweight", is_active=False
    )
    card["open2"] = await create_snapshot_player(session, tier2, name="open2 card", job="SAM")

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
        tier2=tier2,
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


@pytest_asyncio.fixture
async def public_world(session: AsyncSession) -> World:
    """The same world with a public static: the outsider probe's target (B17)."""
    return await build_world(session, public=True)


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


async def _request(
    client: AsyncClient,
    method: str,
    url: str,
    *,
    token: str | None,
    query: dict | None = None,
    body: Any = None,
) -> httpx.Response:
    """One request through the CSRF-injecting client methods. `token=None` sends no credential."""
    kwargs: dict[str, Any] = {}
    if token is not None:
        kwargs["headers"] = {"Authorization": f"Bearer {token}"}
    if query:
        kwargs["params"] = query
    method = method.lower()
    if body is not None and method == "delete":
        # httpx's delete() takes no body; inject CSRF exactly as the client's verbs do.
        client._inject_csrf_header(kwargs)
        return await client.request("DELETE", url, json=body, **kwargs)
    if body is not None:
        kwargs["json"] = body
    return await getattr(client, method)(url, **kwargs)


async def send(
    client: AsyncClient, row: AuthzRoute, world: World, caller: str, *, as_: str | None = None
) -> httpx.Response:
    """Send the row's request with `caller`'s JWT through the CSRF-injecting client methods.

    The build runs as `as_` (default `caller`): a probe that is not the row's actor still
    addresses the actor's objects, and a caller with no card can't break a `w.my_card` build.
    """
    params, query, body = row.build(world.as_(as_ or caller))
    return await _request(
        client,
        row.method,
        row.path.format(**params),
        token=create_access_token(world.u[caller].id),
        query=query,
        body=body,
    )


def blank_url(row: AuthzRoute) -> str:
    """The path of a build-less row: every `{param}` is "1"."""
    return re.sub(r"\{[^}]+\}", "1", row.path)


async def send_blank(
    client: AsyncClient, row: AuthzRoute, *, token: str | None = None
) -> httpx.Response:
    """A build-less row's request: every path param "1", no body, no query."""
    return await _request(client, row.method, blank_url(row), token=token)


async def send_admin_row(
    client: AsyncClient, world: World, row: AuthzRoute, caller: str, how: str
) -> httpx.Response:
    """R-A2-6's send rule: a row with a build sends it, built as the row's actor, a build-less
    row sends "1" path params and no body. `how` is "jwt" (the CSRF client) or "key" (bare)."""
    if row.build is None:
        url, query, body = blank_url(row), None, None
    else:
        params, query, body = row.build(world.as_(row.actor))
        url = row.path.format(**params)
    if how == "jwt":
        return await _request(
            client, row.method, url, token=create_access_token(world.u[caller].id),
            query=query, body=body,
        )
    assert how == "key", how
    if query:
        url += "?" + urlencode(query)
    return await _send_bare(row.method, url, await _mint_key(client, world.u[caller]), body)

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
ANON_REFUSED = [r for r in ROUTES if r.min_role not in ("public", "optional", "dev")]
LEAD_DENIED = [r for r in ROUTES if r.min_role == "owner"]
ADMIN_ROWS = [r for r in ROUTES if r.min_role in ("admin", "admin_or_key")]
ADMIN_JWT_ONLY = [r for r in ADMIN_ROWS if r.min_role == "admin"]
OUTSIDER_DENIED = [r for r in ROUTES if r.static_scoped]
# Every gap probe name → the rows that probe covers. A row's `gaps` may name only a probe that
# runs on that row (R-A2-13). Task 3 adds `stranger`.
PROBES: dict[str, list[AuthzRoute]] = {
    "viewer": VIEWER_DENIED,
    "member": MEMBER_DENIED,
    "lead": LEAD_DENIED,
    "allowed": VIEWER_ALLOWED,
    "actor": WITH_BUILD,
    "anon": ANON_REFUSED,
    "nonadmin": ADMIN_ROWS,
    "outsider": OUTSIDER_DENIED,
}
# Rows with a `{group_id}` or `{share_code}` path that are not static-scoped (R-A2-11): each
# is a deliberate exception to "a static in the path is a static-scoped row".
GROUP_PATH_EXCEPTIONS = {
    # self: any role but the owner leaves (the owner is refused inline)
    "DELETE /api/static-groups/{group_id}/members/{user_id} [leave]",
    # admin: the non-admin probe (R-A2-6) covers it
    "POST /api/static-groups/{group_id}/tiers/{tier_id}/players/{player_id}/admin-assign",
    # user: the caller applies as a non-member, by design (a share code names a static)
    "POST /api/static-groups/{share_code}/join-requests",
}


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
        assert row.actor in WORLD_USERS, f"{row.id}: actor {row.actor!r} is not a world user"
        assert row.plugin or row.plugin_body is None, f"{row.id}: plugin_body on a non-plugin row"
        assert not row.plugin or row.build is not None, f"{row.id}: plugin row has no build"
        for name, _reason in row.gaps:
            assert name in PROBES, f"{row.id}: gap names no probe: {name!r}"
            assert row.id in {r.id for r in PROBES[name]}, f"{row.id}: probe {name!r} skips it"
    by_id = set(ids)
    stale = sorted(GROUP_PATH_EXCEPTIONS - by_id)
    assert not stale, f"GROUP_PATH_EXCEPTIONS has ids that are not rows: {stale}"
    for row in ROUTES:
        in_path = "{group_id}" in row.path or "{share_code}" in row.path
        if in_path and not row.static_scoped:
            assert row.id in GROUP_PATH_EXCEPTIONS, (
                f"{row.id}: a static in the path but not static-scoped (retype it, or add it to "
                "GROUP_PATH_EXCEPTIONS with the reason)"
            )


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


# ── R-A2-12: a lead is refused every owner-only write ────────────────────────


@pytest.mark.parametrize("row", _params(LEAD_DENIED, "lead"))
async def test_lead_is_refused(client, world, row):
    resp = await send(client, row, world, "lead")
    assert resp.status_code == 403, f"{row.id}: lead got {resp.status_code} {resp.text[:200]}"
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: 403 came from CSRF, not the gate"


# ── R-A2-5: an anonymous caller is refused every authenticated write ─────────


@pytest.mark.parametrize("row", _params(ANON_REFUSED, "anon"))
async def test_anonymous_is_refused(client, row):
    """No credential, no body, every path param "1": every auth gate answers before validation."""
    resp = await send_blank(client, row)
    assert resp.status_code == 401, f"{row.id}: anonymous got {resp.status_code} {resp.text[:200]}"
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: refusal came from CSRF, not the gate"


# ── R-A2-6: a non-admin is refused the admin rows, by JWT and by key ─────────


@pytest.mark.parametrize("how", ("jwt", "key"))
@pytest.mark.parametrize("row", _params(ADMIN_ROWS, "nonadmin"))
async def test_non_admin_is_refused(client, world, row, how):
    """The static's owner (the strongest non-admin) is refused with exactly 403."""
    resp = await send_admin_row(client, world, row, "owner", how)
    assert resp.status_code == 403, (
        f"{row.id}: owner's {how} got {resp.status_code} {resp.text[:200]}"
    )
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: 403 came from CSRF, not the gate"


@pytest.mark.parametrize("row", _params(ADMIN_JWT_ONLY, "nonadmin"))
async def test_admin_key_is_refused_on_jwt_only_rows(client, world, row):
    """`admin` rows refuse any key, the admin's own included (`admin_or_key` rows allow it)."""
    resp = await send_admin_row(client, world, row, "admin", "key")
    assert resp.status_code == 403, (
        f"{row.id}: admin's key got {resp.status_code} {resp.text[:200]}"
    )
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: 403 came from CSRF, not the gate"


# ── R-A2-17 (B17): a non-member of a public static is refused every static write ─


@pytest.mark.parametrize("row", _params(OUTSIDER_DENIED, "outsider"))
async def test_outsider_is_refused(client, public_world, row):
    """403 from `require_membership`, 404 from an inline lookup. The build runs as the row's actor
    (the outsider holds no card); the same build passes the actor probe, so a 404 isn't a bad build.
    """
    resp = await send(client, row, public_world, "outsider", as_=row.actor)
    assert resp.status_code in (403, 404), (
        f"{row.id}: outsider got {resp.status_code} {resp.text[:200]}"
    )
    assert _error_code(resp) != CSRF_ERROR, f"{row.id}: refusal came from CSRF, not the gate"


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


# ── R-P0-8.6: the plugin contract (bare xrp_ key, no CSRF, 2xx) ──────────────

G = "/api/static-groups/{group_id}"
T = G + "/tiers/{tier_id}"
# Transcribed from XIVRaidPlannerPlugin/Api/RaidPlannerClient.cs, pinned by row id so that
# un-flagging one variant of a pair (loot-log [purchase] while [drop] stays) fails
# test_plugin_rows_match_the_client. plugin/player/gear-sync (single) is not called by the
# client, and plugin-auth/exchange is public: neither belongs here.
PLUGIN_ROW_IDS = {
    f"POST {T}/loot-log [purchase]",
    f"POST {T}/loot-log [drop]",
    f"POST {T}/material-log [purchase]",
    f"POST {T}/material-log [drop]",
    f"POST {T}/mark-floor-cleared",
    "POST /api/plugin/mount-farms/sync",
    "POST /api/plugin/collections/sync",
    "POST /api/plugin/player/batch-gear-sync",
    "POST /api/admin/collection-catalog/import-verified-ids",
    f"POST {G}/split-clear/mark-run-cleared",
    f"PUT {T}/players/{{player_id}} [own]",
}
# The GET calls the client makes, sent as the member (the gear route on their own card).
PLUGIN_GETS = [
    "/api/auth/me",
    "/api/static-groups",
    G + "/tiers",
    T + "/priority",
    T + "/current-week",
    T + "/players",
    T + "/players/{player_id}/gear",
    G + "/split-clear",
    "/api/plugin/mount-farms/catalog",
]
PLUGIN_ROWS = [r for r in ROUTES if r.plugin]


def test_plugin_rows_match_the_client():
    flagged = {r.id for r in PLUGIN_ROWS}
    assert flagged == PLUGIN_ROW_IDS, (
        f"plugin rows differ from the client. unflagged: {sorted(PLUGIN_ROW_IDS - flagged)}"
        f" flagged but not called: {sorted(flagged - PLUGIN_ROW_IDS)}"
    )


async def _mint_key(client: AsyncClient, user: User) -> str:
    """Mint an xrp_ key under the user's JWT, the way the Settings page does."""
    resp = await client.post(
        "/api/auth/api-keys",
        json={"name": "AUTHZ plugin contract"},
        headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
    )
    assert resp.status_code == 201, resp.text
    key = resp.json()["key"]
    assert key.startswith("xrp_")
    return key


async def _send_bare(method: str, url: str, key: str, body: Any = None) -> httpx.Response:
    """The plugin's request: only `Authorization`. No auth cookie, no CSRF header or cookie.

    A fresh client (the test client carries a CSRF cookie and injects the header) on the same app.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as bare:
        assert not bare.cookies
        resp = await bare.request(
            method, url, json=body, headers={"Authorization": f"Bearer {key}"}
        )
    sent = {name.lower() for name in resp.request.headers}
    assert "cookie" not in sent and CSRF_HEADER_NAME.lower() not in sent, sent
    return resp


@pytest.mark.parametrize("row", [pytest.param(r, id=r.id) for r in PLUGIN_ROWS])
async def test_plugin_mutation_works_with_a_bare_key(client, world, row):
    """A JWT-only regression on a plugin route fails here (the plugin sends no CSRF token)."""
    params, query, body = row.build(world.as_(row.actor))
    if row.plugin_body is not None:
        body = row.plugin_body(world.as_(row.actor))
    key = await _mint_key(client, world.u[row.actor])
    url = row.path.format(**params)
    if query:
        url += "?" + urlencode(query)
    resp = await _send_bare(row.method, url, key, body)
    assert 200 <= resp.status_code < 300, (
        f"{row.id}: key of {row.actor} got {resp.status_code} {resp.text[:300]}"
    )


@pytest.mark.parametrize("path", PLUGIN_GETS)
async def test_plugin_read_works_with_a_bare_key(client, world, path):
    me = world.as_("member")
    url = path.format(group_id=world.group.id, tier_id=world.tier.tier_id, player_id=me.my_card.id)
    resp = await _send_bare("GET", url, await _mint_key(client, me.me))
    assert 200 <= resp.status_code < 300, f"GET {path}: got {resp.status_code} {resp.text[:300]}"
