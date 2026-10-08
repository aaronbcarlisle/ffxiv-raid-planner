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

import asyncio
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
    RewardDropLog,
    RewardParticipantState,
)
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_collection_goal,
    create_membership,
    create_participant_state,
    create_player_character,
    create_player_profile,
    create_static_group,
)

# ---------------------------------------------------------------------------
# Coverage registry (vet I-2)
# ---------------------------------------------------------------------------

RECORD_HANDLERS = (
    "upsert_snapshot",
    "update_mount_farm_progress",
    "bulk_update_mount_farm_progress",
    "plugin_sync_collections",
    "upsert_participant_state",
    "upsert_participant_state_for_user",
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


# ---------------------------------------------------------------------------
# upsert_participant_state and upsert_participant_state_for_user (Track's PATCH routes)
# ---------------------------------------------------------------------------


def _participants_url(group, goal, target_user=None) -> str:
    url = f"/api/static-groups/{group.id}/collection-goals/{goal.id}/participants"
    return url if target_user is None else f"{url}/{target_user.id}"


async def _tracked_goal(
    session: AsyncSession, group, creator, item, *, title: str = "Tracked Mount"
):
    """A farm goal of `group` that names the catalog item."""
    goal = await create_collection_goal(session, group, creator, title=title)
    goal.catalog_item_id = item.id
    await session.flush()
    return goal


async def _put_record(
    session: AsyncSession,
    profile,
    character,
    item,
    *,
    ownership: str,
    token_count: int | None = None,
    source: str = "plugin",
) -> PlayerCollectionSnapshot:
    """A record written long ago by nobody in particular (a pre-S2a-1 plugin sync)."""
    record = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        character_id=None if character is None else character.id,
        catalog_item_id=item.id,
        ownership_state=ownership,
        token_count=token_count,
        source=source,
        confidence="high",
        updated_at=CLIENT_CLOCK,
        state_changed_at=CLIENT_CLOCK,
        token_count_updated_at=CLIENT_CLOCK if token_count is not None else None,
    )
    session.add(record)
    await session.flush()
    return record


async def _row(session: AsyncSession, goal, user) -> RewardParticipantState | None:
    result = await session.execute(
        select(RewardParticipantState)
        .where(
            RewardParticipantState.goal_id == goal.id,
            RewardParticipantState.user_id == user.id,
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


@covers_record("upsert_participant_state")
async def test_track_have_raises_the_members_record_and_writes_the_row_with_one_clock(
    client, session, test_user, test_user_2, test_group, auth_headers_user2
):
    """R-S1-10: Have goes to the character the chain names, and the row and record share `now`."""
    _, main = await _member_of(session, test_group, test_user_2, main_name="Track Main")
    item = await create_catalog_item(session, name="Track Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await session.commit()

    response = await client.patch(
        _participants_url(test_group, goal), json={"state": "have"}, headers=auth_headers_user2
    )
    assert response.status_code == 200, response.text

    (record,) = await _all_records(session)
    assert (record.character_id, record.catalog_item_id, record.ownership_state) == (
        main.id,
        item.id,
        "have",
    )
    assert (record.source, record.confidence) == ("manual", "medium")
    assert (record.updated_by_user_id, record.updated_via) == (test_user_2.id, "web")
    row = await _row(session, goal, test_user_2)
    assert (row.state, row.source) == ("have", "manual")
    assert (row.updated_by_user_id, row.updated_via) == (test_user_2.id, "web")
    assert record.state_changed_at is not None
    assert record.state_changed_at == row.state_changed_at == record.updated_at == row.updated_at


@covers_record("upsert_participant_state")
async def test_track_need_over_a_record_have_un_haves_it_and_the_other_static_reads_want(
    client, session, test_user, test_user_2, test_group, auth_headers, auth_headers_user2
):
    """Q6, Q3: V1's "My status" Need un-Haves the record; a Have row elsewhere yields to Want."""
    profile, main = await _member_of(session, test_group, test_user_2, main_name="Unhave Main")
    other = await create_static_group(session, test_user, name="Second Static")
    await create_membership(session, test_user_2, other, role=MemberRole.MEMBER)
    item = await create_catalog_item(session, name="Unhave Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    other_goal = await _tracked_goal(session, other, test_user, item, title="Elsewhere")
    await _put_record(session, profile, main, item, ownership="have", source="plugin")
    other_row = await create_participant_state(session, other_goal, test_user_2, state="have")
    other_row.source = "plugin"
    other_row.state_changed_at = CLIENT_CLOCK
    await session.commit()

    before = await client.get(_participants_url(other, other_goal), headers=auth_headers)
    assert [p["state"] for p in before.json() if p["user_id"] == test_user_2.id] == ["have"]

    response = await client.patch(
        _participants_url(test_group, goal), json={"state": "need"}, headers=auth_headers_user2
    )
    assert response.status_code == 200, response.text
    assert response.json()["state"] == "need"

    (record,) = await _all_records(session)
    assert record.ownership_state == "missing"
    assert (record.updated_by_user_id, record.updated_via) == (test_user_2.id, "web")
    assert record.state_changed_at == (await _row(session, goal, test_user_2)).state_changed_at

    after = await client.get(_participants_url(other, other_goal), headers=auth_headers)
    elsewhere = next(p for p in after.json() if p["user_id"] == test_user_2.id)
    assert (elsewhere["state"], elsewhere["state_from_record"]) == ("want", True)


@covers_record("upsert_participant_state")
async def test_track_pass_leaves_the_record_untouched(
    client, session, test_user, test_user_2, test_group, auth_headers_user2
):
    profile, main = await _member_of(session, test_group, test_user_2, main_name="Pass Main")
    item = await create_catalog_item(session, name="Pass Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _put_record(session, profile, main, item, ownership="have")
    await session.commit()

    response = await client.patch(
        _participants_url(test_group, goal), json={"state": "pass"}, headers=auth_headers_user2
    )
    assert response.status_code == 200, response.text

    (record,) = await _all_records(session)
    assert (record.ownership_state, record.source, record.updated_at, record.state_changed_at) == (
        "have",
        "plugin",
        CLIENT_CLOCK,
        CLIENT_CLOCK,
    )
    assert (record.updated_by_user_id, record.updated_via) == (None, None)
    assert (await _row(session, goal, test_user_2)).state == "pass"


@covers_record("upsert_participant_state")
async def test_track_have_over_a_record_that_already_has_it_writes_nothing_to_the_record(
    client, session, test_user, test_user_2, test_group, auth_headers_user2
):
    """The plugin's Have keeps its source and writer when the member only agrees with it."""
    profile, main = await _member_of(session, test_group, test_user_2, main_name="Agree Main")
    item = await create_catalog_item(session, name="Agree Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _put_record(session, profile, main, item, ownership="have")
    await session.commit()

    response = await client.patch(
        _participants_url(test_group, goal), json={"state": "have"}, headers=auth_headers_user2
    )
    assert response.status_code == 200, response.text

    (record,) = await _all_records(session)
    assert (record.source, record.updated_at, record.updated_by_user_id) == (
        "plugin",
        CLIENT_CLOCK,
        None,
    )
    assert (await _row(session, goal, test_user_2)).state == "have"


@covers_record("upsert_participant_state")
async def test_track_member_count_goes_to_the_record_on_the_api_key_channel_and_rank_is_dropped(
    client, session, test_user, test_user_2, test_group, auth_headers_user2
):
    """Delta (h): a member's count is stored, on the record; `priority_rank` stays a lead's."""
    _, main = await _member_of(session, test_group, test_user_2, main_name="Count Main")
    item = await create_catalog_item(session, name="Count Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers_user2)

    response = await client.request(
        "PATCH",
        _participants_url(test_group, goal),
        json={"state": "need", "token_count": 7, "priority_rank": 1},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["token_count"], body["count_from_record"], body["priority_rank"]) == (
        7,
        True,
        None,
    )

    (record,) = await _all_records(session)
    assert (record.character_id, record.token_count, record.ownership_state) == (
        main.id,
        7,
        "unknown",
    )
    assert record.token_count_updated_at is not None and record.state_changed_at is None
    assert (record.updated_by_user_id, record.updated_via) == (test_user_2.id, "api_key")
    row = await _row(session, goal, test_user_2)
    assert (row.state, row.token_count, row.priority_rank) == ("need", None, None)


@covers_record("upsert_participant_state_for_user")
async def test_lead_route_for_a_member_writes_the_row_as_a_correction_and_no_record(
    client, session, test_user, test_user_2, test_group, auth_headers
):
    """R-S1-10: a lead's edit for another member is the row alone, writer = the lead."""
    profile, main = await _member_of(session, test_group, test_user_2, main_name="Corrected Main")
    item = await create_catalog_item(session, name="Corrected Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _put_record(session, profile, main, item, ownership="have")
    await session.commit()

    response = await client.patch(
        _participants_url(test_group, goal, test_user_2),
        json={"state": "need", "token_count": 9, "priority_rank": 2},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _row(session, goal, test_user_2)
    assert (row.state, row.token_count, row.priority_rank) == ("need", 9, 2)
    assert (row.updated_by_user_id, row.updated_via) == (test_user.id, "web")
    (record,) = await _all_records(session)
    assert (record.ownership_state, record.token_count, record.updated_at) == (
        "have",
        None,
        CLIENT_CLOCK,
    )
    assert (record.updated_by_user_id, record.updated_via) == (None, None)


@covers_record("upsert_participant_state_for_user")
async def test_lead_route_aimed_at_the_lead_follows_the_self_rules(
    client, session, test_user, test_group, auth_headers, world
):
    """R-S1-10: a lead editing their own cell writes their record, and may set a rank."""
    _, main, _, item = world
    goal = await _tracked_goal(session, test_group, test_user, item)
    await session.commit()

    response = await client.patch(
        _participants_url(test_group, goal, test_user),
        json={"state": "have", "token_count": 4, "priority_rank": 1},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    (record,) = await _all_records(session)
    assert (record.character_id, record.ownership_state, record.token_count) == (
        main.id,
        "have",
        4,
    )
    assert (record.updated_by_user_id, record.updated_via) == (test_user.id, "web")
    row = await _row(session, goal, test_user)
    assert (row.state, row.token_count, row.priority_rank) == ("have", None, 1)
    assert (row.updated_by_user_id, row.updated_via) == (test_user.id, "web")
    assert row.state_changed_at == record.state_changed_at


# ---------------------------------------------------------------------------
# The remaining row writers (C3): the plugin sync's rows, log_drop's flip, delete_drop's restore.
# These reach `write_row`, not the record door, so they carry no @covers_record.
# ---------------------------------------------------------------------------


async def _row_with_history(
    session: AsyncSession, goal, user, *, state: str, token_count: int | None = None
) -> RewardParticipantState:
    """A member's row written long ago by nobody in particular (pre-S2a-1 stamps)."""
    row = await create_participant_state(session, goal, user, state=state)
    row.token_count = token_count
    row.updated_at = CLIENT_CLOCK
    row.state_changed_at = CLIENT_CLOCK
    row.token_count_updated_at = CLIENT_CLOCK if token_count is not None else None
    await session.flush()
    return row


async def test_plugin_sync_rows_record_the_member_and_the_api_key_channel(
    client, session, test_user, test_group, auth_headers
):
    """A created Have row, a raised row and a recounted row all name the member and the channel."""
    new_item = await _farm_item(session, "New Row Mount", game_mount_id=4501)
    raise_item = await _farm_item(session, "Raised Row Mount", game_mount_id=4502)
    count_item = await _farm_item(session, "Counted Row Mount", token_item_id=4503)
    new_goal = await _tracked_goal(session, test_group, test_user, new_item, title="New")
    raise_goal = await _tracked_goal(session, test_group, test_user, raise_item, title="Raise")
    count_goal = await _tracked_goal(session, test_group, test_user, count_item, title="Count")
    await _row_with_history(session, raise_goal, test_user, state="need")
    await _row_with_history(session, count_goal, test_user, state="need", token_count=3)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "POST",
        SYNC_URL,
        json={
            "mounts": [{"mountId": 4501, "owned": True}, {"mountId": 4502, "owned": True}],
            "currencies": [{"itemId": 4503, "count": 40}],
            "syncedAt": CLIENT_CLOCK,
        },
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["statesUpdated"], body["tokenCountsUpdated"], body["skippedLocked"]) == (2, 1, 0)
    server_clock = body["syncedAt"]
    assert server_clock != CLIENT_CLOCK

    created = await _row(session, new_goal, test_user)
    assert (created.state, created.source) == ("have", "plugin")
    assert created.last_synced_at == server_clock
    assert created.state_changed_at == created.updated_at == server_clock
    raised = await _row(session, raise_goal, test_user)
    assert (raised.state, raised.source) == ("have", "plugin")
    assert raised.state_changed_at == server_clock
    counted = await _row(session, count_goal, test_user)
    assert (counted.state, counted.token_count, counted.state_changed_at) == (
        "need",
        40,
        CLIENT_CLOCK,
    )
    assert counted.token_count_updated_at == counted.updated_at == server_clock
    for row in (created, raised, counted):
        assert (row.updated_by_user_id, row.updated_via) == (test_user.id, "api_key")


async def test_plugin_sync_that_changes_nothing_leaves_a_row_unstamped_by_state(
    client, session, test_user, test_group, auth_headers
):
    """An unchanged count writes nothing; a Have the plugin already set keeps its state clock."""
    have_item = await _farm_item(session, "Settled Mount", game_mount_id=4511)
    count_item = await _farm_item(session, "Settled Count", token_item_id=4512)
    have_goal = await _tracked_goal(session, test_group, test_user, have_item, title="Settled")
    count_goal = await _tracked_goal(session, test_group, test_user, count_item, title="Same")
    have_row = await _row_with_history(session, have_goal, test_user, state="have")
    have_row.source = "plugin"
    await _row_with_history(session, count_goal, test_user, state="need", token_count=40)
    await session.commit()
    raw_key = await _mint_key(client, auth_headers)

    response = await client.request(
        "POST",
        SYNC_URL,
        json={
            "mounts": [{"mountId": 4511, "owned": True}],
            "currencies": [{"itemId": 4512, "count": 40}],
        },
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["statesUpdated"], body["statesUnchanged"], body["tokenCountsUpdated"]) == (0, 1, 0)

    settled = await _row(session, have_goal, test_user)
    assert settled.state_changed_at == CLIENT_CLOCK
    same = await _row(session, count_goal, test_user)
    assert (same.updated_at, same.updated_by_user_id) == (CLIENT_CLOCK, None)
    assert same.updated_via is None


async def _log_drop_for(client, group, goal, recipient, headers):
    response = await client.post(
        f"/api/static-groups/{group.id}/collection-goals/{goal.id}/drops",
        json={"recipient_user_id": recipient.id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_drop_flip_records_the_logger_and_moves_the_state_clock(
    client, session, test_user, test_user_2, test_group, auth_headers
):
    """A lead logs a drop for a member: the flipped row names the lead (a correction)."""
    await _member_of(session, test_group, test_user_2, main_name="Dropped Main")
    item = await create_catalog_item(session, name="Dropped Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _row_with_history(session, goal, test_user_2, state="need")
    await session.commit()

    drop = await _log_drop_for(client, test_group, goal, test_user_2, auth_headers)

    row = await _row(session, goal, test_user_2)
    assert row.state == "have"
    assert (row.updated_by_user_id, row.updated_via) == (test_user.id, "web")
    assert row.state_changed_at != CLIENT_CLOCK
    stored = (
        await session.execute(
            select(RewardDropLog)
            .where(RewardDropLog.id == drop["id"])
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert row.state_changed_at == row.updated_at == stored.recipient_prior_state_at


async def test_drop_that_flips_nothing_leaves_the_row_alone(
    client, session, test_user, test_user_2, test_group, auth_headers
):
    await _member_of(session, test_group, test_user_2, main_name="Pass Dropped Main")
    item = await create_catalog_item(session, name="Pass Dropped Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _row_with_history(session, goal, test_user_2, state="pass")
    await session.commit()

    await _log_drop_for(client, test_group, goal, test_user_2, auth_headers)

    row = await _row(session, goal, test_user_2)
    assert (row.state, row.updated_at, row.updated_by_user_id, row.updated_via) == (
        "pass",
        CLIENT_CLOCK,
        None,
        None,
    )


async def test_drop_delete_restore_records_the_deleter_and_moves_the_state_clock(
    client, session, test_user, test_user_2, test_group, auth_headers, auth_headers_user2
):
    """The member logs their own drop (writer = member); the owner deletes it (writer = owner)."""
    await _member_of(session, test_group, test_user_2, main_name="Restored Main")
    item = await create_catalog_item(session, name="Restored Mount")
    goal = await _tracked_goal(session, test_group, test_user, item)
    await _row_with_history(session, goal, test_user_2, state="need")
    await session.commit()

    drop = await _log_drop_for(client, test_group, goal, test_user_2, auth_headers_user2)
    flipped = await _row(session, goal, test_user_2)
    assert (flipped.state, flipped.updated_by_user_id) == ("have", test_user_2.id)
    flip_clock = flipped.state_changed_at
    await asyncio.sleep(0.02)  # cross a Windows clock tick

    response = await client.delete(
        f"/api/static-groups/{test_group.id}/collection-goals/{goal.id}/drops/{drop['id']}",
        headers=auth_headers,
    )
    assert response.status_code == 204, response.text

    row = await _row(session, goal, test_user_2)
    assert row.state == "need"
    assert (row.updated_by_user_id, row.updated_via) == (test_user.id, "web")
    assert row.state_changed_at == row.updated_at
    assert row.state_changed_at != flip_clock
