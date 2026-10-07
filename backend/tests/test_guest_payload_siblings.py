"""GUEST-2 R-G2-2 / R-G2-12: no member identity on the guest-reachable reads.

Eight GETs a share-code visitor can call carry members' Discord identity today:
the tier and its players (`linkedUser`), `/members` (`user`), `/linked-players`
and the four loot-history reads (`createdByUsername`). The gate on each is
`check_view_permission(...) is not None`: every member (viewers included), an
admin and a member's `xrp_` key keep identity; an anonymous caller, a signed-in
outsider and the outsider's key get `linkedUser: null` (with `userId` kept),
`members[].user: null`, `linked-players: []` and `createdByUsername: null`.

R-G2-12: `by-code` and `GET /{id}` leave `contactMethod`/`contactValue` out of
`settings.discovery` for a no-role caller unless the static is listed in the
Finder (`is_discoverable`). The ORM `settings` are never mutated.
"""

from collections.abc import Callable

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import MemberRole, User
from tests.factories import (
    create_loot_log_entry,
    create_material_log_entry,
    create_membership,
    create_page_ledger_entry,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

MEMBER_ROLES = ("owner", "lead", "member", "viewer")
ALL_USERS = (*MEMBER_ROLES, "outsider", "admin")
CLAIMERS = ("owner", "member", "viewer")
IDENTITY_KEYS = ("discordUsername", "discordId", "discordAvatar", "avatarUrl", "displayName")

CONTACT_KEYS = ("contactMethod", "contactValue")
CONTACT = "g2-lead-contact"
OTHER_DISCOVERY = {
    "description": "G2 recruiting copy",
    "neededRoles": ["healer"],
    "dataCenter": "Aether",
}


def _handle(who: str) -> str:
    return f"g2-{who}-handle"


def _discord_id(i: int) -> str:
    return f"90000000000000000{i}"


def _seeded_identity() -> list[str]:
    """Every identity string seeded for the six users (handles, ids, avatars, names)."""
    out: list[str] = []
    for i, who in enumerate(ALL_USERS, start=1):
        out += [_handle(who), _discord_id(i), f"g2avatarhash{i}", f"g2-{who}-display"]
    return out


def _bearer(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _discovery(*, enabled: bool, status: str = "open") -> dict:
    return {
        "enabled": enabled,
        "recruitmentStatus": status,
        "contactMethod": "discord",
        "contactValue": CONTACT,
        **OTHER_DISCOVERY,
    }


@pytest_asyncio.fixture
async def world(session: AsyncSession, client: AsyncClient) -> dict:
    users: dict[str, User] = {}
    for i, who in enumerate(ALL_USERS, start=1):
        user = await create_user(
            session,
            discord_id=_discord_id(i),
            discord_username=_handle(who),
            discord_avatar=f"g2avatarhash{i}",
        )
        user.display_name = f"g2-{who}-display"
        users[who] = user
    users["admin"].is_admin = True

    # Unlisted (listing off) with a saved contact: R-G2-12's main case.
    group = await create_static_group(
        session,
        users["owner"],
        name="G2 Public Static",
        share_code="G2PUBL",
        is_public=True,
        settings={"discovery": _discovery(enabled=False)},
    )
    await create_membership(session, users["lead"], group, role=MemberRole.LEAD)
    await create_membership(session, users["member"], group, role=MemberRole.MEMBER)
    await create_membership(session, users["viewer"], group, role=MemberRole.VIEWER)

    tier = await create_tier_snapshot(session, group)
    players = {}
    for i, (key, position) in enumerate(
        (("owner", "T1"), ("member", "H1"), ("viewer", "M1"), ("unclaimed", "R1"))
    ):
        player = await create_snapshot_player(
            session, tier, name=f"G2 Card {key}", position=position, sort_order=i
        )
        if key in CLAIMERS:
            player.user_id = users[key].id
        players[key] = player
    await session.flush()

    # One entry per loot-history log, each logged by the lead.
    await create_loot_log_entry(session, tier, players["member"], users["lead"])
    await create_page_ledger_entry(session, tier, players["member"], users["lead"])
    await create_material_log_entry(session, tier, players["member"], users["lead"])

    # Listed in the Finder (enabled + open), and enabled-but-paused (not discoverable).
    listed = await create_static_group(
        session,
        users["owner"],
        name="G2 Listed Static",
        share_code="G2LIST",
        is_public=True,
        settings={"discovery": _discovery(enabled=True)},
    )
    paused = await create_static_group(
        session,
        users["owner"],
        name="G2 Paused Static",
        share_code="G2PAUS",
        is_public=True,
        settings={"discovery": _discovery(enabled=True, status="paused")},
    )

    private = await create_static_group(
        session, users["owner"], name="G2 Private Static", share_code="G2PRIV", is_public=False
    )
    private_tier = await create_tier_snapshot(session, private)
    await session.commit()

    keys: dict[str, str] = {}
    for who in ("member", "outsider"):
        created = await client.post(
            "/api/auth/api-keys", json={"name": f"G2 {who} key"}, headers=_bearer(users[who])
        )
        assert created.status_code == 201
        keys[who] = created.json()["key"]
        # The key must resolve to its owner, or a no-identity result proves nothing.
        me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {keys[who]}"})
        assert me.status_code == 200
        assert me.json()["discordUsername"] == _handle(who)

    return {
        "users": users,
        "group": group,
        "tier": tier,
        "players": players,
        "listed": listed,
        "paused": paused,
        "private": private,
        "private_tier": private_tier,
        "keys": keys,
    }


def _base(world: dict) -> str:
    return f"/api/static-groups/{world['group'].id}"


ROUTES: dict[str, Callable[[dict], str]] = {
    "tier": lambda w: f"{_base(w)}/tiers/{w['tier'].id}",
    "players": lambda w: f"{_base(w)}/tiers/{w['tier'].id}/players",
    "members": lambda w: f"{_base(w)}/members",
    "linked-players": lambda w: f"{_base(w)}/linked-players",
    "loot-log": lambda w: f"{_base(w)}/tiers/{w['tier'].id}/loot-log",
    "page-ledger": lambda w: f"{_base(w)}/tiers/{w['tier'].id}/page-ledger",
    "player-page-ledger": (
        lambda w: f"{_base(w)}/tiers/{w['tier'].id}/players/{w['players']['member'].id}/page-ledger"
    ),
    "material-log": lambda w: f"{_base(w)}/tiers/{w['tier'].id}/material-log",
}
LOOT_ROUTES = ("loot-log", "page-ledger", "player-page-ledger", "material-log")

NO_ROLE_CALLERS = ("anonymous", "outsider", "outsider-key")
IDENTITY_CALLERS = ("owner", "lead", "member", "viewer", "admin", "member-key")


def _headers(world: dict, caller: str) -> dict[str, str]:
    if caller == "anonymous":
        return {}
    if caller.endswith("-key"):
        return {"Authorization": f"Bearer {world['keys'][caller.removesuffix('-key')]}"}
    return _bearer(world["users"][caller])


def _tier_players(route: str, body) -> list[dict]:
    return body["players"] if route == "tier" else body


def _claimer_of(world: dict) -> dict[str, str]:
    """player id -> the claiming user's role key."""
    return {world["players"][who].id: who for who in CLAIMERS}


def _assert_no_identity(route: str, response, world: dict) -> None:
    assert response.status_code == 200
    for needle in _seeded_identity():
        assert needle not in response.text, f"{needle!r} leaked on {route}"
    for key in IDENTITY_KEYS:
        assert key not in response.text, f"{key} leaked on {route}"

    body = response.json()
    users = world["users"]
    if route in ("tier", "players"):
        players = _tier_players(route, body)
        assert len(players) == 4
        claimer_of = _claimer_of(world)
        for p in players:
            assert p["linkedUser"] is None
            expected = claimer_of.get(p["id"])
            assert p["userId"] == (users[expected].id if expected else None)
    elif route == "members":
        assert len(body) == 4
        assert {m["role"] for m in body} == set(MEMBER_ROLES)
        assert {m["userId"] for m in body} == {users[r].id for r in MEMBER_ROLES}
        for m in body:
            assert m["user"] is None
    elif route == "linked-players":
        assert body == []
    else:
        assert len(body) == 1
        for entry in body:
            assert entry["createdByUsername"] is None
            assert entry["createdByUserId"] == users["lead"].id


def _assert_identity(route: str, response, world: dict) -> None:
    assert response.status_code == 200
    body = response.json()
    if route in ("tier", "players"):
        claimer_of = _claimer_of(world)
        players = _tier_players(route, body)
        claimed = [p for p in players if p["userId"]]
        assert len(claimed) == 3
        for p in claimed:
            who = claimer_of[p["id"]]
            assert p["linkedUser"]["discordUsername"] == _handle(who)
            assert p["linkedUser"]["membershipRole"] == who
    elif route == "members":
        assert {m["user"]["discordUsername"] for m in body} == {_handle(r) for r in MEMBER_ROLES}
    elif route == "linked-players":
        assert {lp["user"]["discordUsername"] for lp in body} == {_handle(r) for r in CLAIMERS}
    else:
        assert len(body) == 1
        assert all(entry["createdByUsername"] == _handle("lead") for entry in body)


@pytest.mark.parametrize("route", list(ROUTES))
class TestNoRoleCallerGetsNoIdentity:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("caller", NO_ROLE_CALLERS)
    async def test_no_identity(self, client: AsyncClient, world: dict, route: str, caller: str):
        response = await client.get(ROUTES[route](world), headers=_headers(world, caller))
        _assert_no_identity(route, response, world)


@pytest.mark.parametrize("route", list(ROUTES))
class TestRoleHoldersKeepIdentity:
    """(pin) Members, viewers, an admin non-member and a member's key are unchanged."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("caller", IDENTITY_CALLERS)
    async def test_identity(self, client: AsyncClient, world: dict, route: str, caller: str):
        response = await client.get(ROUTES[route](world), headers=_headers(world, caller))
        _assert_identity(route, response, world)


class TestUnchangedPaths:
    """(pin)"""

    @pytest.mark.asyncio
    async def test_private_static_tier_refuses_anonymous(self, client: AsyncClient, world: dict):
        response = await client.get(
            f"/api/static-groups/{world['private'].id}/tiers/{world['private_tier'].id}"
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_member_write_returns_linked_user(self, client: AsyncClient, world: dict):
        player = world["players"]["member"]
        response = await client.put(
            f"{_base(world)}/tiers/{world['tier'].id}/players/{player.id}",
            json={"rosterNote": "g2 note"},
            headers=_bearer(world["users"]["member"]),
        )
        assert response.status_code == 200
        assert response.json()["linkedUser"]["discordUsername"] == _handle("member")


def _membership_map_sql(sql: str) -> bool:
    """The tier route's membership-role map: memberships filtered by a user_id IN list."""
    return "FROM memberships" in sql and "memberships.user_id IN" in sql


class TestQueryBudget:
    """(pin, vet M-14) No-role callers skip the membership-map query."""

    @pytest.mark.asyncio
    async def test_no_role_tier_read_skips_membership_map(
        self, client: AsyncClient, world: dict, engine, count_statements
    ):
        url = ROUTES["tier"](world)
        runs = {}
        for caller in ("anonymous", "outsider", "owner"):
            with (
                count_statements(engine) as total,
                count_statements(engine, match=_membership_map_sql) as mmap,
            ):
                response = await client.get(url, headers=_headers(world, caller))
            assert response.status_code == 200
            runs[caller] = (total.n, mmap.n)

        assert runs["anonymous"][0] < runs["owner"][0]
        # Outsider and owner take the same auth path; only the map query separates them.
        assert runs["outsider"][0] == runs["owner"][0] - 1
        assert runs["owner"][1] == 1
        assert runs["anonymous"][1] == 0
        assert runs["outsider"][1] == 0


def _lookup_urls(group) -> list[str]:
    return [
        f"/api/static-groups/by-code/{group.share_code}",
        f"/api/static-groups/{group.id}",
    ]


def _assert_contact_absent(response) -> None:
    assert response.status_code == 200
    discovery = response.json()["settings"]["discovery"]
    for key in CONTACT_KEYS:
        assert key not in discovery
    for key, value in OTHER_DISCOVERY.items():
        assert discovery[key] == value
    assert "recruitmentStatus" in discovery
    assert "enabled" in discovery
    assert CONTACT not in response.text


def _assert_contact_present(response) -> None:
    assert response.status_code == 200
    discovery = response.json()["settings"]["discovery"]
    assert discovery["contactMethod"] == "discord"
    assert discovery["contactValue"] == CONTACT


@pytest.mark.parametrize("which", [0, 1], ids=["by-code", "by-id"])
class TestListingContact:
    """R-G2-12: the recruiting contact leaves the lookups only for an unlisted static."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("static", ["group", "paused"], ids=["listing-off", "paused"])
    @pytest.mark.parametrize("caller", NO_ROLE_CALLERS)
    async def test_unlisted_no_role_caller_gets_no_contact(
        self, client: AsyncClient, world: dict, which: int, static: str, caller: str
    ):
        response = await client.get(
            _lookup_urls(world[static])[which], headers=_headers(world, caller)
        )
        _assert_contact_absent(response)

    @pytest.mark.asyncio
    async def test_listed_anonymous_keeps_contact(
        self, client: AsyncClient, world: dict, which: int
    ):
        """(pin) The Finder publishes a listed static's contact anyway."""
        response = await client.get(_lookup_urls(world["listed"])[which])
        _assert_contact_present(response)

    @pytest.mark.asyncio
    async def test_unlisted_member_keeps_contact(
        self, client: AsyncClient, world: dict, which: int
    ):
        """(pin)"""
        response = await client.get(
            _lookup_urls(world["group"])[which], headers=_bearer(world["users"]["member"])
        )
        _assert_contact_present(response)

    @pytest.mark.asyncio
    async def test_repeat_reads_leave_orm_settings_intact(
        self, client: AsyncClient, world: dict, which: int
    ):
        url = _lookup_urls(world["group"])[which]
        _assert_contact_absent(await client.get(url))
        _assert_contact_absent(await client.get(url))
        _assert_contact_present(await client.get(url, headers=_bearer(world["users"]["member"])))
        # The session is shared with the app, so this is the object the routes serialized.
        assert world["group"].settings["discovery"]["contactValue"] == CONTACT
        assert world["group"].settings["discovery"]["contactMethod"] == "discord"
