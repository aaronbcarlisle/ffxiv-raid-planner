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
from app.models import (
    CollectionCatalogItem,
    MemberRole,
    MountFarmProgress,
    PlayerCollectionIntent,
    PlayerCollectionSnapshot,
    PlayerProfile,
)
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_membership,
    create_player_character,
    create_player_profile,
)

# ---------------------------------------------------------------------------
# Coverage registry (vet I-2)
# ---------------------------------------------------------------------------

RECORD_HANDLERS = (
    "upsert_snapshot",
    "update_mount_farm_progress",
    "bulk_update_mount_farm_progress",
    "plugin_sync_collections",
)

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


# ---------------------------------------------------------------------------
# The mount-farm bridge: update_mount_farm_progress, bulk_update_mount_farm_progress
# ---------------------------------------------------------------------------

TRIAL_ID = "s2a1-record-trial"
CLIENT_CLOCK = "2000-01-01T00:00:00+00:00"


def _farm_url(group, bulk: bool = False) -> str:
    url = f"/api/static-groups/{group.id}/mount-farms/progress"
    return f"{url}/bulk" if bulk else url


async def _farm_item(
    session: AsyncSession,
    name: str = "Farm Mount",
    *,
    game_mount_id: int | None = None,
    token_item_id: int | None = None,
) -> CollectionCatalogItem:
    """A catalog mount the bridge finds from TRIAL_ID, with the plugin's game ids if given."""
    item = await create_catalog_item(session, name=name)
    item.source_duty_key = TRIAL_ID
    item.is_active = True
    item.game_mount_id = game_mount_id
    item.token_item_id = token_item_id
    await session.flush()
    return item


async def _member_of(session: AsyncSession, group, user, *, main_name: str):
    """Make `user` a member of `group` with a profile and a main; returns (profile, main)."""
    await create_membership(session, user, group, role=MemberRole.MEMBER)
    profile = await create_player_profile(session, user)
    main = await create_player_character(session, profile, name=main_name, is_main=True)
    return profile, main


async def _all_records(session: AsyncSession) -> list[PlayerCollectionSnapshot]:
    """Every record in the database, read back rather than from the identity map."""
    result = await session.execute(
        select(PlayerCollectionSnapshot).execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


async def _progress(session: AsyncSession, group, user) -> MountFarmProgress:
    result = await session.execute(
        select(MountFarmProgress)
        .where(
            MountFarmProgress.static_group_id == group.id,
            MountFarmProgress.user_id == user.id,
            MountFarmProgress.trial_id == TRIAL_ID,
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _intent(session: AsyncSession, profile, item) -> PlayerCollectionIntent:
    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.catalog_item_id == item.id,
        )
    )
    return result.scalar_one()


@covers_record("update_mount_farm_progress")
async def test_mount_farm_patch_for_yourself_writes_your_cards_alt_as_you_on_the_web(
    client, session, test_user_2, test_group, auth_headers_user2
):
    """R-S1-10: a member's own edit writes the record the chain names in this static."""
    profile, _ = await _member_of(session, test_group, test_user_2, main_name="Member Main")
    alt = await create_player_character(session, profile, name="Member Alt", is_main=False)
    await create_claimed_card(session, test_group, test_user_2, alt)
    item = await _farm_item(session)
    await session.commit()

    response = await client.patch(
        _farm_url(test_group),
        json={"trial_id": TRIAL_ID, "has_mount": True, "totem_count": 5},
        headers=auth_headers_user2,
    )
    assert response.status_code == 200, response.text

    (row,) = await _all_records(session)
    assert row.character_id == alt.id
    assert (row.catalog_item_id, row.ownership_state, row.token_count) == (item.id, "have", 5)
    assert (row.source, row.confidence) == ("player_hub", "medium")
    assert row.updated_by_user_id == test_user_2.id
    assert row.updated_via == "web"


@covers_record("update_mount_farm_progress")
async def test_mount_farm_patch_with_an_api_key_is_api_key(
    client, session, test_user, test_group, auth_headers, world
):
    _, main, _, _ = world
    await _farm_item(session)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "PATCH",
        _farm_url(test_group),
        json={"trial_id": TRIAL_ID, "has_mount": False},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text

    (row,) = await _all_records(session)
    assert (row.character_id, row.ownership_state) == (main.id, "missing")
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "api_key"


@covers_record("update_mount_farm_progress")
async def test_mount_farm_patch_by_a_lead_for_a_member_writes_no_record(
    client, session, test_user_2, test_group, auth_headers, world
):
    """R-S1-10: a lead's edit for someone else writes their farm row and intent, no record."""
    member_profile, member_main = await _member_of(
        session, test_group, test_user_2, main_name="Member Main"
    )
    await create_claimed_card(session, test_group, test_user_2, member_main)
    item = await _farm_item(session)
    await session.commit()

    response = await client.patch(
        _farm_url(test_group),
        json={
            "trial_id": TRIAL_ID,
            "user_id": test_user_2.id,
            "has_mount": True,
            "wants_mount": True,
            "totem_count": 7,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    progress = await _progress(session, test_group, test_user_2)
    assert (progress.has_mount, progress.wants_mount, progress.totem_count) == (True, True, 7)
    intent = await _intent(session, member_profile, item)
    assert (intent.intent, intent.visibility) == ("hunting", "static_only")
    assert await _all_records(session) == []


@covers_record("bulk_update_mount_farm_progress")
async def test_mount_farm_bulk_writes_only_the_leads_own_record(
    client, session, test_user, test_user_2, test_group, auth_headers, world
):
    _, _, alt, _ = world
    await create_claimed_card(session, test_group, test_user, alt)
    member_profile, _ = await _member_of(
        session, test_group, test_user_2, main_name="Member Main"
    )
    item = await _farm_item(session)
    await session.commit()

    response = await client.put(
        _farm_url(test_group, bulk=True),
        json={
            "updates": [
                {"trial_id": TRIAL_ID, "has_mount": True, "totem_count": 4},
                {
                    "trial_id": TRIAL_ID,
                    "user_id": test_user_2.id,
                    "has_mount": True,
                    "wants_mount": True,
                },
            ]
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    (row,) = await _all_records(session)
    assert row.character_id == alt.id
    assert (row.ownership_state, row.token_count, row.source) == ("have", 4, "player_hub")
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "web"
    assert (await _progress(session, test_group, test_user_2)).has_mount is True
    assert (await _intent(session, member_profile, item)).intent == "hunting"


@covers_record("bulk_update_mount_farm_progress")
async def test_mount_farm_bulk_with_an_api_key_is_api_key(
    client, session, test_user, test_group, auth_headers, world
):
    _, main, _, _ = world
    await _farm_item(session)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "PUT",
        _farm_url(test_group, bulk=True),
        json={"updates": [{"trial_id": TRIAL_ID, "has_mount": True}]},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text

    (row,) = await _all_records(session)
    assert (row.character_id, row.ownership_state) == (main.id, "have")
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "api_key"


# ---------------------------------------------------------------------------
# plugin_sync_collections (the plugin's collections sync)
# ---------------------------------------------------------------------------

SYNC_URL = "/api/plugin/collections/sync"


@covers_record("plugin_sync_collections")
async def test_plugin_sync_with_an_api_key_writes_the_mains_record_in_sync_mode(
    client, session, test_user, auth_headers, world
):
    """No static in play: the sync aims at the main, raises Have, and stamps the server clock."""
    profile, main, _, _ = world
    owned = await _farm_item(session, "Owned Mount", game_mount_id=4401)
    counted = await _farm_item(session, "Counted Mount", token_item_id=4402)
    session.add(
        PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            character_id=main.id,
            catalog_item_id=counted.id,
            ownership_state="have",
            token_count=3,
            source="manual",
            confidence="medium",
            updated_at=CLIENT_CLOCK,
        )
    )
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "POST",
        SYNC_URL,
        json={
            "mounts": [{"mountId": 4401, "owned": True}],
            "currencies": [{"itemId": 4402, "count": 40}],
            "syncedAt": CLIENT_CLOCK,
        },
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text
    server_clock = response.json()["syncedAt"]
    assert server_clock != CLIENT_CLOCK

    rows = {row.catalog_item_id: row for row in await _all_records(session)}
    assert set(rows) == {owned.id, counted.id}
    for row in rows.values():
        assert row.character_id == main.id
        assert row.source == "plugin"
        assert row.last_synced_at == server_clock
        assert row.updated_by_user_id == test_user.id
        assert row.updated_via == "api_key"
    assert (rows[owned.id].ownership_state, rows[owned.id].confidence) == ("have", "high")
    # A count-only report keeps the Have and the row becomes the plugin's (sync mode).
    assert (rows[counted.id].ownership_state, rows[counted.id].token_count) == ("have", 40)


@covers_record("plugin_sync_collections")
async def test_plugin_sync_with_a_jwt_is_web(client, session, test_user, auth_headers, world):
    _, main, _, _ = world
    await _farm_item(session, game_mount_id=4401)
    await session.commit()

    response = await client.post(
        SYNC_URL, json={"mounts": [{"mountId": 4401, "owned": True}]}, headers=auth_headers
    )
    assert response.status_code == 200, response.text

    (row,) = await _all_records(session)
    assert row.character_id == main.id
    assert row.updated_by_user_id == test_user.id
    assert row.updated_via == "web"


@covers_record("plugin_sync_collections")
async def test_plugin_sync_without_a_profile_writes_no_record(client, session, auth_headers):
    await _farm_item(session, game_mount_id=4401, token_item_id=4402)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "POST",
        SYNC_URL,
        json={
            "mounts": [{"mountId": 4401, "owned": True}],
            "currencies": [{"itemId": 4402, "count": 40}],
        },
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text

    assert await _all_records(session) == []
    assert (await session.execute(select(PlayerProfile))).scalars().all() == []
