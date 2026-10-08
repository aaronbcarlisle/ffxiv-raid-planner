"""S2a-1a·2: collection-record writes record who wrote and through which channel.

Route tests for the handlers that reach `write_record`. B1 covers the Hub PUT,
`upsert_snapshot` (routers/player_collection.py); B2 and B3 append the plugin
sync, the bridge, Track and the farm routes to `RECORD_HANDLERS`.

`covers_record(handler)` records which test functions exercise which handler in
`RECORD_COVERED` (vet I-2), the twin of `COVERED` in test_write_provenance.py.
B3's completeness guard reads it, so a handler counts as covered only while a
test function decorated for it exists. Route tests are module-level functions so
every recorded name resolves on this module. B2 and B3 only append: a name to
`RECORD_HANDLERS` and decorated tests below.
"""

import uuid
from collections.abc import Callable

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import PlayerCollectionSnapshot
from tests.factories import (
    create_catalog_item,
    create_player_character,
    create_player_profile,
)

# ---------------------------------------------------------------------------
# Coverage registry (vet I-2)
# ---------------------------------------------------------------------------

RECORD_HANDLERS = ("upsert_snapshot",)

# handler name -> the test functions decorated with @covers_record(handler)
RECORD_COVERED: dict[str, list[str]] = {}


def covers_record(handler: str) -> Callable:
    """Record the decorated test's name under `handler` at import; return it unchanged."""

    def decorate(fn):
        RECORD_COVERED.setdefault(handler, []).append(fn.__name__)
        return fn

    return decorate


def test_record_covered_registry_lists_every_handler_once_per_test():
    assert set(RECORD_COVERED) == set(RECORD_HANDLERS)
    names = [name for tests in RECORD_COVERED.values() for name in tests]
    assert len(names) == len(set(names)), "a route test carries exactly one @covers_record"
    for name in names:
        assert callable(globals()[name]), name


def test_covers_record_registers_by_function_name_and_returns_the_function():
    before = {handler: list(tests) for handler, tests in RECORD_COVERED.items()}
    try:

        @covers_record("probe_handler")
        def probe_test():
            return "kept"

        assert RECORD_COVERED["probe_handler"] == ["probe_test"]
        assert probe_test() == "kept"
    finally:
        RECORD_COVERED.clear()
        RECORD_COVERED.update(before)


# ---------------------------------------------------------------------------
# Fixture world and helpers
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def world(session, test_user):
    """A profile with a main and an alt, and one catalog item."""
    profile = await create_player_profile(session, test_user)
    main = await create_player_character(session, profile, name="Main Char", is_main=True)
    alt = await create_player_character(session, profile, name="Alt Char", is_main=False)
    item = await create_catalog_item(session, name="Provenance Mount")
    await session.commit()
    return profile, main, alt, item


def _url(item, character_id: str | None = None) -> str:
    url = f"/api/me/collection-snapshot/{item.id}"
    return url if character_id is None else f"{url}?character_id={character_id}"


async def _mint_key(client: AsyncClient, headers: dict[str, str]) -> str:
    """Mint a real xrp_ key for the user behind `headers`; returns the raw key."""
    response = await client.post("/api/auth/api-keys", json={"name": "S2a-1 key"}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["key"]


async def _stored(session: AsyncSession, profile) -> list[PlayerCollectionSnapshot]:
    """Read the rows back from the database, not from the session's identity map."""
    result = await session.execute(
        select(PlayerCollectionSnapshot)
        .where(PlayerCollectionSnapshot.profile_id == profile.id)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# upsert_snapshot (the Hub PUT)
# ---------------------------------------------------------------------------


@covers_record("upsert_snapshot")
async def test_hub_put_with_a_jwt_records_the_caller_and_the_web_channel(
    client, session, test_user, auth_headers, world
):
    profile, main, _, item = world

    response = await client.put(
        _url(item), json={"ownership_state": "have"}, headers=auth_headers
    )
    assert response.status_code == 200, response.text

    (row,) = await _stored(session, profile)
    assert row.character_id == main.id
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "web"


@covers_record("upsert_snapshot")
async def test_hub_put_with_the_cookie_is_web(client, session, test_user, world):
    profile, _, alt, item = world
    client.cookies.set("access_token", create_access_token(test_user.id))

    response = await client.put(_url(item, alt.id), json={"ownership_state": "missing"})
    assert response.status_code == 200, response.text

    (row,) = await _stored(session, profile)
    assert row.character_id == alt.id
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "web"


@covers_record("upsert_snapshot")
async def test_hub_put_with_a_cookie_plus_an_xrp_header_is_still_web(
    client, session, test_user, auth_headers, world
):
    profile, _, _, item = world
    raw_key = await _mint_key(client, auth_headers)
    client.cookies.set("access_token", create_access_token(test_user.id))

    response = await client.put(
        _url(item),
        json={"ownership_state": "have"},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text

    (row,) = await _stored(session, profile)
    assert row.updated_via == "web"  # the cookie authenticated the request


@covers_record("upsert_snapshot")
async def test_hub_put_with_an_api_key_is_api_key(client, session, test_user, auth_headers, world):
    profile, main, _, item = world
    raw_key = await _mint_key(client, auth_headers)

    # AsyncClient.request bypasses the CSRF header the fixture client injects on put,
    # which is how an xrp_ client calls: only Authorization.
    response = await client.request(
        "PUT",
        _url(item),
        json={"ownership_state": "have"},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert "X-CSRF-Token" not in response.request.headers
    assert response.status_code == 200, response.text

    (row,) = await _stored(session, profile)
    assert row.character_id == main.id
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "api_key"


@covers_record("upsert_snapshot")
async def test_hub_put_for_another_users_character_is_404_and_writes_nothing(
    client, session, test_user_2, auth_headers, world
):
    """R-S1-16: the row stays CALLER_SCOPED; a stranger's character id is not found."""
    profile, _, _, item = world
    other_profile = await create_player_profile(session, test_user_2)
    theirs = await create_player_character(session, other_profile, name="Theirs", is_main=True)
    await session.commit()

    response = await client.put(
        _url(item, theirs.id), json={"ownership_state": "have"}, headers=auth_headers
    )

    assert response.status_code == 404
    everything = await session.execute(select(PlayerCollectionSnapshot))
    assert everything.scalars().all() == []


@covers_record("upsert_snapshot")
async def test_hub_put_for_a_made_up_character_id_is_404(client, session, auth_headers, world):
    _, _, _, item = world

    response = await client.put(
        _url(item, str(uuid.uuid4())), json={"ownership_state": "have"}, headers=auth_headers
    )

    assert response.status_code == 404
    everything = await session.execute(select(PlayerCollectionSnapshot))
    assert everything.scalars().all() == []
