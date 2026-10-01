"""PROV-1 PV-2: loot, material and book writes record provenance (R-PV-6 .. R-PV-8).

Route tests for the six handlers in routers/loot_tracking.py that create or move
a row: create_loot_log_entry, update_loot_log_entry, create_page_ledger_entry,
mark_floor_cleared, create_material_log_entry and update_material_log_entry.
PV-3 adds log_drop (routers/collection_goals.py), the farm-drop write.
Every case reads the stored row back from the database.

`covers(handler)` records which test functions exercise which handler in
`COVERED` (vet I-4). PV-3's completeness guard reads it, so a handler counts as
covered only while a test function decorated for it exists. Route tests are
module-level functions so every recorded name resolves on this module.
"""

from collections.abc import Callable
from types import SimpleNamespace

import pytest_asyncio
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import LootLogEntry, MaterialLogEntry, MemberRole, PageLedgerEntry
from app.models.reward_drop_log import RewardDropLog
from tests.factories import (
    create_collection_goal,
    create_loot_log_entry,
    create_material_log_entry,
    create_membership,
    create_snapshot_player,
    create_static_character_registration,
    create_user,
)

# ---------------------------------------------------------------------------
# Coverage registry (vet I-4)
# ---------------------------------------------------------------------------

HANDLERS = (
    "create_loot_log_entry",
    "update_loot_log_entry",
    "create_page_ledger_entry",
    "mark_floor_cleared",
    "create_material_log_entry",
    "update_material_log_entry",
    "log_drop",
)

# handler name -> the test functions decorated with @covers(handler)
COVERED: dict[str, list[str]] = {}


def covers(handler: str) -> Callable:
    """Record the decorated test's name under `handler` at import; return it unchanged."""

    def decorate(fn):
        COVERED.setdefault(handler, []).append(fn.__name__)
        return fn

    return decorate


# ---------------------------------------------------------------------------
# Response key sets, copied from the HEAD schemas (R-PV-8: no shape change)
# ---------------------------------------------------------------------------

LOOT_KEYS = {
    "id",
    "tierSnapshotId",
    "weekNumber",
    "floor",
    "itemSlot",
    "recipientPlayerId",
    "recipientPlayerName",
    "recipientCharacterRegistrationId",
    "recipientCharacterName",
    "method",
    "notes",
    "weaponJob",
    "isExtra",
    "createdAt",
    "createdByUserId",
    "createdByUsername",
}
PAGE_LEDGER_KEYS = {
    "id",
    "tierSnapshotId",
    "playerId",
    "playerName",
    "weekNumber",
    "floor",
    "bookType",
    "transactionType",
    "quantity",
    "notes",
    "createdAt",
    "createdByUserId",
    "createdByUsername",
}
MARK_FLOOR_CLEARED_KEYS = {"message"}
MATERIAL_KEYS = {
    "id",
    "tierSnapshotId",
    "weekNumber",
    "floor",
    "materialType",
    "recipientPlayerId",
    "recipientPlayerName",
    "method",
    "slotAugmented",
    "notes",
    "createdAt",
    "createdByUserId",
    "createdByUsername",
}


# ---------------------------------------------------------------------------
# Fixture world and helpers
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def world(session, test_user, test_user_2, test_user_3, test_group, test_tier):
    """O owns the static. M claims PM (primary R1 "Main Name", alt R2), M2 claims
    PM2 (no registration), and PU is unclaimed."""
    await create_membership(session, test_user_2, test_group, role=MemberRole.MEMBER)
    await create_membership(session, test_user_3, test_group, role=MemberRole.MEMBER)
    pm = await create_snapshot_player(session, test_tier, name="PM", position="M1")
    pm.user_id = test_user_2.id
    pm2 = await create_snapshot_player(session, test_tier, name="PM2", position="M2", sort_order=1)
    pm2.user_id = test_user_3.id
    pu = await create_snapshot_player(session, test_tier, name="PU", position="R1", sort_order=2)
    await session.flush()
    r1 = await create_static_character_registration(
        session, test_group, pm, manual_character_name="Main Name", is_primary_for_static=True
    )
    r2 = await create_static_character_registration(
        session, test_group, pm, manual_character_name="Alt Name"
    )
    return SimpleNamespace(
        owner=test_user,
        member=test_user_2,
        member2=test_user_3,
        group=test_group,
        tier=test_tier,
        pm=pm,
        pm2=pm2,
        pu=pu,
        r1=r1,
        r2=r2,
    )


def _base(world) -> str:
    return f"/api/static-groups/{world.group.id}/tiers/{world.tier.id}"


def _loot_payload(player, **overrides) -> dict:
    return {
        "weekNumber": 1,
        "floor": "M9S",
        "itemSlot": "head",
        "recipientPlayerId": player.id,
        "method": "drop",
        **overrides,
    }


def _material_payload(player, **overrides) -> dict:
    return {
        "weekNumber": 1,
        "floor": "M11S",
        "materialType": "twine",
        "recipientPlayerId": player.id,
        "method": "drop",
        **overrides,
    }


def _mark_floor_cleared_payload(players, week_number: int = 1) -> dict:
    return {"weekNumber": week_number, "floor": "M9S", "playerIds": [p.id for p in players]}


async def _mint_key(client: AsyncClient, headers: dict[str, str]) -> tuple[str, str]:
    """Mint a real xrp_ key for the user behind `headers`; returns (raw key, key id)."""
    response = await client.post("/api/auth/api-keys", json={"name": "PV-2 key"}, headers=headers)
    assert response.status_code == 201, response.text
    body = response.json()
    return body["key"], body["id"]


async def _key_request(
    client: AsyncClient, method: str, url: str, raw_key: str, json: dict
) -> Response:
    """A plugin-shaped request: Bearer xrp_ key, camelCase JSON and no CSRF header.

    `AsyncClient.request` bypasses the CSRF header the fixture client injects on
    post/put, which is the plugin contract (the plugin sends only Authorization).
    """
    response = await client.request(
        method, url, json=json, headers={"Authorization": f"Bearer {raw_key}"}
    )
    assert "X-CSRF-Token" not in response.request.headers
    return response


async def _stored(session: AsyncSession, model, row_id: int):
    """Read the row back from the database, not from the session's identity map."""
    result = await session.execute(
        select(model).where(model.id == row_id).execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _stored_ledger_by_player(session: AsyncSession, world) -> dict:
    result = await session.execute(
        select(PageLedgerEntry)
        .where(PageLedgerEntry.tier_snapshot_id == world.tier.id)
        .execution_options(populate_existing=True)
    )
    return {row.player_id: row for row in result.scalars().all()}


def _reads_character_tables(statement: str) -> bool:
    """SELECTs that read static_character_registrations or player_characters (vet I-2)."""
    text = statement.lower()
    return text.lstrip().startswith("select") and (
        "static_character_registrations" in text or "player_characters" in text
    )


def _assert_no_character(row) -> None:
    assert row.recipient_character_registration_id is None
    assert row.recipient_character_name is None
    assert row.recipient_character_source is None


def _assert_main_defaulted(row, world) -> None:
    assert row.recipient_character_registration_id == world.r1.id
    assert row.recipient_character_name == "Main Name"
    assert row.recipient_character_source == "default"


def _assert_every_provenance_column_null(row) -> None:
    assert row.logged_via is None
    assert row.api_key_id is None
    assert row.recipient_user_id is None
    assert row.recipient_character_source is None


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_covered_registry_lists_every_handler_once_per_test():
    assert set(COVERED) == set(HANDLERS)
    names = [name for tests in COVERED.values() for name in tests]
    assert len(names) == len(set(names)), "a route test carries exactly one @covers"
    for name in names:
        assert callable(globals()[name]), name


# ---------------------------------------------------------------------------
# create_loot_log_entry
# ---------------------------------------------------------------------------


@covers("create_loot_log_entry")
async def test_loot_create_owner_jwt_defaults_the_cards_main(client, session, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/loot-log", json=_loot_payload(world.pm), headers=auth_headers
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.created_by_user_id == world.owner.id
    assert row.recipient_user_id == world.member.id  # on behalf: creator != recipient
    _assert_main_defaulted(row, world)
    # vet M-6: the existing response fields carry the defaulted main where they were null.
    assert response.json()["recipientCharacterRegistrationId"] == world.r1.id
    assert response.json()["recipientCharacterName"] == "Main Name"


@covers("create_loot_log_entry")
async def test_loot_create_cookie_jwt_is_web(client, session, world):
    client.cookies.set("access_token", create_access_token(world.owner.id))
    response = await client.post(f"{_base(world)}/loot-log", json=_loot_payload(world.pm))
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.recipient_user_id == world.member.id
    _assert_main_defaulted(row, world)


@covers("create_loot_log_entry")
async def test_loot_create_cookie_plus_xrp_header_is_web_with_no_key(
    client, session, auth_headers, world
):
    raw_key, _key_id = await _mint_key(client, auth_headers)
    client.cookies.set("access_token", create_access_token(world.owner.id))
    response = await client.post(
        f"{_base(world)}/loot-log",
        json=_loot_payload(world.pm),
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "web"  # the cookie authenticated the request
    assert row.api_key_id is None


@covers("create_loot_log_entry")
async def test_loot_create_owner_key_records_the_minted_key(client, session, auth_headers, world):
    raw_key, key_id = await _mint_key(client, auth_headers)
    response = await _key_request(
        client, "POST", f"{_base(world)}/loot-log", raw_key, _loot_payload(world.pm)
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "api_key"
    assert row.api_key_id == key_id
    assert row.created_by_user_id == world.owner.id
    assert row.recipient_user_id == world.member.id
    _assert_main_defaulted(row, world)


@covers("create_loot_log_entry")
async def test_loot_create_member_key_self_purchase(client, session, auth_headers_user2, world):
    raw_key, key_id = await _mint_key(client, auth_headers_user2)
    response = await _key_request(
        client,
        "POST",
        f"{_base(world)}/loot-log",
        raw_key,
        _loot_payload(world.pm, method="purchase"),
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "api_key"
    assert row.api_key_id == key_id
    assert row.recipient_user_id == row.created_by_user_id == world.member.id  # self
    _assert_main_defaulted(row, world)


@covers("create_loot_log_entry")
async def test_loot_create_explicit_alt_beats_the_default(client, session, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/loot-log",
        json=_loot_payload(world.pm, recipientCharacterRegistrationId=world.r2.id),
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.recipient_user_id == world.member.id
    assert row.recipient_character_registration_id == world.r2.id
    assert row.recipient_character_name == "Alt Name"
    assert row.recipient_character_source == "explicit"


@covers("create_loot_log_entry")
async def test_loot_create_unclaimed_card_without_registration(
    client, session, auth_headers, world
):
    response = await client.post(
        f"{_base(world)}/loot-log", json=_loot_payload(world.pu), headers=auth_headers
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, LootLogEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.recipient_user_id is None
    _assert_no_character(row)


# ---------------------------------------------------------------------------
# create_material_log_entry
# ---------------------------------------------------------------------------


@covers("create_material_log_entry")
async def test_material_create_owner_jwt_defaults_the_cards_main(
    client, session, auth_headers, world
):
    response = await client.post(
        f"{_base(world)}/material-log", json=_material_payload(world.pm), headers=auth_headers
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, MaterialLogEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.created_by_user_id == world.owner.id
    assert row.recipient_user_id == world.member.id
    _assert_main_defaulted(row, world)


@covers("create_material_log_entry")
async def test_material_create_member_key_self_purchase(
    client, session, auth_headers_user2, world
):
    raw_key, key_id = await _mint_key(client, auth_headers_user2)
    response = await _key_request(
        client,
        "POST",
        f"{_base(world)}/material-log",
        raw_key,
        _material_payload(world.pm, method="purchase"),
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, MaterialLogEntry, response.json()["id"])
    assert row.logged_via == "api_key"
    assert row.api_key_id == key_id
    assert row.recipient_user_id == row.created_by_user_id == world.member.id
    _assert_main_defaulted(row, world)


# ---------------------------------------------------------------------------
# create_page_ledger_entry
# ---------------------------------------------------------------------------


@covers("create_page_ledger_entry")
async def test_page_ledger_create_owner_jwt_spent_row_defaults_the_cards_main(
    client, session, auth_headers, world
):
    response = await client.post(
        f"{_base(world)}/page-ledger",
        json={
            "playerId": world.pm.id,
            "weekNumber": 1,
            "floor": "M9S",
            "bookType": "I",
            "transactionType": "spent",
            "quantity": -4,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, PageLedgerEntry, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.created_by_user_id == world.owner.id
    assert row.recipient_user_id == world.member.id
    _assert_main_defaulted(row, world)


# ---------------------------------------------------------------------------
# mark_floor_cleared
# ---------------------------------------------------------------------------


@covers("mark_floor_cleared")
async def test_mark_floor_cleared_owner_key_three_cards(client, session, auth_headers, world):
    raw_key, key_id = await _mint_key(client, auth_headers)
    response = await _key_request(
        client,
        "POST",
        f"{_base(world)}/mark-floor-cleared",
        raw_key,
        _mark_floor_cleared_payload([world.pm, world.pm2, world.pu]),
    )
    assert response.status_code == 201, response.text

    rows = await _stored_ledger_by_player(session, world)
    assert set(rows) == {world.pm.id, world.pm2.id, world.pu.id}
    for row in rows.values():
        assert row.logged_via == "api_key"
        assert row.api_key_id == key_id
        assert row.created_by_user_id == world.owner.id
        assert row.transaction_type == "earned"

    assert rows[world.pm.id].recipient_user_id == world.member.id
    _assert_main_defaulted(rows[world.pm.id], world)

    assert rows[world.pm2.id].recipient_user_id == world.member2.id
    _assert_no_character(rows[world.pm2.id])

    assert rows[world.pu.id].recipient_user_id is None
    _assert_no_character(rows[world.pu.id])


@covers("mark_floor_cleared")
async def test_mark_floor_cleared_character_reads_cost_the_same_for_one_card_and_three(
    client, engine, auth_headers, world, count_statements
):
    """vet I-2: registrations and names are read in a fixed number of SELECTs.

    Only SELECTs on the two character tables are counted: the ORM issues one
    INSERT per row, so a total count would differ by design.
    """
    with count_statements(engine, match=_reads_character_tables) as one:
        response = await client.post(
            f"{_base(world)}/mark-floor-cleared",
            json=_mark_floor_cleared_payload([world.pm], week_number=1),
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text
    with count_statements(engine, match=_reads_character_tables) as three:
        response = await client.post(
            f"{_base(world)}/mark-floor-cleared",
            json=_mark_floor_cleared_payload([world.pm, world.pm2, world.pu], week_number=2),
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text

    assert one.n >= 1
    assert three.n == one.n


# ---------------------------------------------------------------------------
# update_loot_log_entry (R-PV-7)
# ---------------------------------------------------------------------------


async def _loot_logged_for_pm(client, session, auth_headers, world) -> int:
    """A web row for PM whose character defaulted to R1 / "Main Name"."""
    response = await client.post(
        f"{_base(world)}/loot-log", json=_loot_payload(world.pm), headers=auth_headers
    )
    assert response.status_code == 201, response.text
    entry_id = response.json()["id"]
    _assert_main_defaulted(await _stored(session, LootLogEntry, entry_id), world)
    return entry_id


@covers("update_loot_log_entry")
async def test_loot_update_moving_to_a_card_without_a_main_clears_the_character(
    client, session, auth_headers, world
):
    entry_id = await _loot_logged_for_pm(client, session, auth_headers, world)

    response = await client.put(
        f"{_base(world)}/loot-log/{entry_id}",
        json={"recipientPlayerId": world.pm2.id},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, entry_id)
    assert row.recipient_player_id == world.pm2.id
    assert row.recipient_user_id == world.member2.id
    _assert_no_character(row)  # nothing stale survives the reassignment


@covers("update_loot_log_entry")
async def test_loot_update_moving_with_an_explicit_name_keeps_the_name(
    client, session, auth_headers, world
):
    entry_id = await _loot_logged_for_pm(client, session, auth_headers, world)

    response = await client.put(
        f"{_base(world)}/loot-log/{entry_id}",
        json={"recipientPlayerId": world.pm2.id, "recipientCharacterName": "Typed Name"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, entry_id)
    assert row.recipient_user_id == world.member2.id
    assert row.recipient_character_registration_id is None
    assert row.recipient_character_name == "Typed Name"
    assert row.recipient_character_source == "explicit"


@covers("update_loot_log_entry")
async def test_loot_update_registration_without_a_name_takes_its_name(
    client, session, auth_headers, world
):
    entry_id = await _loot_logged_for_pm(client, session, auth_headers, world)

    response = await client.put(
        f"{_base(world)}/loot-log/{entry_id}",
        json={"recipientCharacterRegistrationId": world.r2.id},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, entry_id)
    assert row.recipient_player_id == world.pm.id
    assert row.recipient_user_id == world.member.id  # same card: untouched
    assert row.recipient_character_registration_id == world.r2.id
    assert row.recipient_character_name == "Alt Name"
    assert row.recipient_character_source == "explicit"


@covers("update_loot_log_entry")
async def test_loot_update_name_only_keeps_the_registration_and_marks_explicit(
    client, session, auth_headers, world
):
    """R-PV-7, same card: a sent name that differs is stored as today (the
    registration stays) and the client named the character, so `explicit`."""
    entry_id = await _loot_logged_for_pm(client, session, auth_headers, world)

    response = await client.put(
        f"{_base(world)}/loot-log/{entry_id}",
        json={"recipientCharacterName": "Typed Name"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, entry_id)
    assert row.recipient_player_id == world.pm.id
    assert row.recipient_user_id == world.member.id  # same card: untouched
    assert row.recipient_character_registration_id == world.r1.id  # kept
    assert row.recipient_character_name == "Typed Name"
    assert row.recipient_character_source == "explicit"


@covers("update_loot_log_entry")
async def test_loot_update_v1_full_payload_on_a_legacy_row_leaves_its_nulls(
    client, session, auth_headers, world
):
    """vet I-3: a pre-PROV-1 row, edited through the full payload (superset of what any shell sends)."""
    legacy = await create_loot_log_entry(
        session,
        world.tier,
        world.pm,
        world.owner,
        item_slot="weapon",
        weapon_job="MCH",
        notes="old note",
    )
    legacy.recipient_character_registration_id = world.r1.id
    legacy.recipient_character_name = "Main Name"
    await session.flush()
    _assert_every_provenance_column_null(legacy)

    # Full payload superset: AddLootEntryModal.tsx:375-395 shows V1 and V2 send only changed fields; only notes change.
    response = await client.put(
        f"{_base(world)}/loot-log/{legacy.id}",
        json={
            "weekNumber": 1,
            "floor": "M9S",
            "itemSlot": "weapon",
            "recipientPlayerId": world.pm.id,
            "method": "drop",
            "weaponJob": "MCH",
            "notes": "edited note",
            "recipientCharacterRegistrationId": world.r1.id,
            "recipientCharacterName": "Main Name",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, legacy.id)
    assert row.notes == "edited note"
    assert row.recipient_player_id == world.pm.id
    assert row.recipient_character_registration_id == world.r1.id
    assert row.recipient_character_name == "Main Name"
    _assert_every_provenance_column_null(row)


@covers("update_loot_log_entry")
async def test_loot_update_logged_via_and_api_key_id_never_change(
    client, session, auth_headers, world
):
    raw_key, key_id = await _mint_key(client, auth_headers)
    created = await _key_request(
        client, "POST", f"{_base(world)}/loot-log", raw_key, _loot_payload(world.pm)
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["id"]

    response = await client.put(
        f"{_base(world)}/loot-log/{entry_id}",
        json={"recipientPlayerId": world.pm2.id, "notes": "moved on the web"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, LootLogEntry, entry_id)
    assert row.recipient_user_id == world.member2.id  # the move landed
    assert row.logged_via == "api_key"
    assert row.api_key_id == key_id


# ---------------------------------------------------------------------------
# update_material_log_entry (R-PV-7)
# ---------------------------------------------------------------------------


@covers("update_material_log_entry")
async def test_material_update_moving_to_a_card_without_a_main_clears_the_character(
    client, session, auth_headers, world
):
    created = await client.post(
        f"{_base(world)}/material-log", json=_material_payload(world.pm), headers=auth_headers
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["id"]
    _assert_main_defaulted(await _stored(session, MaterialLogEntry, entry_id), world)

    response = await client.put(
        f"{_base(world)}/material-log/{entry_id}",
        json={"recipientPlayerId": world.pm2.id},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, MaterialLogEntry, entry_id)
    assert row.recipient_player_id == world.pm2.id
    assert row.recipient_user_id == world.member2.id
    _assert_no_character(row)


@covers("update_material_log_entry")
async def test_material_update_v1_full_payload_on_a_legacy_row_leaves_its_nulls(
    client, session, auth_headers, world
):
    """vet I-3: a pre-PROV-1 row, edited through V1's LogMaterialModal payload."""
    legacy = await create_material_log_entry(
        session,
        world.tier,
        world.pm,
        world.owner,
        floor="M11S",
        material_type="twine",
        slot_augmented="head",
        notes="old note",
    )
    _assert_every_provenance_column_null(legacy)
    _assert_no_character(legacy)

    # What LogMaterialModal.tsx:335-345 sends on every edit; only notes change.
    response = await client.put(
        f"{_base(world)}/material-log/{legacy.id}",
        json={
            "weekNumber": 1,
            "floor": "M11S",
            "materialType": "twine",
            "recipientPlayerId": world.pm.id,
            "method": "drop",
            "slotAugmented": "head",
            "notes": "edited note",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    row = await _stored(session, MaterialLogEntry, legacy.id)
    assert row.notes == "edited note"
    assert row.recipient_player_id == world.pm.id
    _assert_every_provenance_column_null(row)
    _assert_no_character(row)


# ---------------------------------------------------------------------------
# No shape change (R-PV-8)
# ---------------------------------------------------------------------------


@covers("create_loot_log_entry")
async def test_loot_create_response_keys_unchanged(client, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/loot-log", json=_loot_payload(world.pm), headers=auth_headers
    )
    assert response.status_code == 201, response.text
    assert set(response.json()) == LOOT_KEYS


@covers("update_loot_log_entry")
async def test_loot_update_response_keys_unchanged(client, auth_headers, world):
    created = await client.post(
        f"{_base(world)}/loot-log", json=_loot_payload(world.pm), headers=auth_headers
    )
    assert created.status_code == 201, created.text
    response = await client.put(
        f"{_base(world)}/loot-log/{created.json()['id']}",
        json={"recipientPlayerId": world.pm2.id},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert set(response.json()) == LOOT_KEYS


@covers("create_page_ledger_entry")
async def test_page_ledger_create_response_keys_unchanged(client, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/page-ledger",
        json={
            "playerId": world.pm.id,
            "weekNumber": 1,
            "floor": "M9S",
            "bookType": "I",
            "transactionType": "spent",
            "quantity": -4,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert set(response.json()) == PAGE_LEDGER_KEYS


@covers("mark_floor_cleared")
async def test_mark_floor_cleared_response_keys_unchanged(client, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/mark-floor-cleared",
        json=_mark_floor_cleared_payload([world.pm, world.pm2, world.pu]),
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert set(response.json()) == MARK_FLOOR_CLEARED_KEYS


@covers("create_material_log_entry")
async def test_material_create_response_keys_unchanged(client, auth_headers, world):
    response = await client.post(
        f"{_base(world)}/material-log", json=_material_payload(world.pm), headers=auth_headers
    )
    assert response.status_code == 201, response.text
    assert set(response.json()) == MATERIAL_KEYS


@covers("update_material_log_entry")
async def test_material_update_response_keys_unchanged(client, auth_headers, world):
    created = await client.post(
        f"{_base(world)}/material-log", json=_material_payload(world.pm), headers=auth_headers
    )
    assert created.status_code == 201, created.text
    response = await client.put(
        f"{_base(world)}/material-log/{created.json()['id']}",
        json={"recipientPlayerId": world.pm2.id},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert set(response.json()) == MATERIAL_KEYS


# ---------------------------------------------------------------------------
# log_drop (PV-3): a farm drop records only the channel and the key (B11)
# ---------------------------------------------------------------------------

# Copied from RewardDropResponse at HEAD (vet M-6): no field is added or removed.
DROP_KEYS = {
    "id",
    "goal_id",
    "static_group_id",
    "recipient_user_id",
    "created_by_id",
    "quantity",
    "dropped_at",
    "notes",
    "created_at",
    "recipient_display_name",
    "recipient_prior_state",
}


async def _drop_world(session, world):
    """A farm goal in the world's static, plus a lead who is not the owner."""
    goal = await create_collection_goal(session, world.group, world.owner)
    lead = await create_user(session, discord_id="pv3_lead", discord_username="pv3lead")
    await create_membership(session, lead, world.group, role=MemberRole.LEAD)
    await session.flush()
    return goal, lead


def _drops_url(world, goal) -> str:
    return f"/api/static-groups/{world.group.id}/collection-goals/{goal.id}/drops"


@covers("log_drop")
async def test_drop_member_jwt_own_drop_is_web_with_no_key(
    client, session, auth_headers_user2, world
):
    goal, _lead = await _drop_world(session, world)
    response = await client.post(
        _drops_url(world, goal),
        json={"recipient_user_id": world.member.id},
        headers=auth_headers_user2,
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, RewardDropLog, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.created_by_id == world.member.id
    assert row.recipient_user_id == world.member.id


@covers("log_drop")
async def test_drop_member_key_own_drop_records_the_minted_key(
    client, session, auth_headers_user2, world
):
    goal, _lead = await _drop_world(session, world)
    raw_key, key_id = await _mint_key(client, auth_headers_user2)
    response = await _key_request(
        client, "POST", _drops_url(world, goal), raw_key, {"recipient_user_id": world.member.id}
    )
    assert response.status_code == 201, response.text  # no CSRF header: the plugin contract

    row = await _stored(session, RewardDropLog, response.json()["id"])
    assert row.logged_via == "api_key"
    assert row.api_key_id == key_id
    assert row.created_by_id == world.member.id
    assert row.recipient_user_id == world.member.id


@covers("log_drop")
async def test_drop_lead_jwt_for_a_member_is_derivably_on_behalf(client, session, world):
    goal, lead = await _drop_world(session, world)
    response = await client.post(
        _drops_url(world, goal),
        json={"recipient_user_id": world.member.id},
        headers={"Authorization": f"Bearer {create_access_token(lead.id)}"},
    )
    assert response.status_code == 201, response.text

    row = await _stored(session, RewardDropLog, response.json()["id"])
    assert row.logged_via == "web"
    assert row.api_key_id is None
    assert row.created_by_id == lead.id
    assert row.recipient_user_id == world.member.id
    assert row.created_by_id != row.recipient_user_id  # "on behalf" needs no new column


@covers("log_drop")
async def test_drop_response_keys_unchanged(client, session, auth_headers, world):
    goal, _lead = await _drop_world(session, world)
    response = await client.post(
        _drops_url(world, goal),
        json={"recipient_user_id": world.member.id},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert set(response.json()) == DROP_KEYS
