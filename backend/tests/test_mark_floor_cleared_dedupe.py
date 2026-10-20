"""Issue #326: mark-floor-cleared credits a floor's books once per player per week.

`POST .../mark-floor-cleared` must skip any player who already holds an
`earned` page-ledger entry for the same tier snapshot, week and floor. The
route stays backward-compatible for the Dalamud plugin: 201 and a
`{"message": ...}` body, with an `xrp_` API key and no CSRF header.
"""

from collections import Counter

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PageLedgerEntry, User
from tests.factories import (
    create_page_ledger_entry,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
)


@pytest_asyncio.fixture
async def world(session: AsyncSession, test_user: User):
    group = await create_static_group(session, test_user)
    tier = await create_tier_snapshot(session, group)
    a = await create_snapshot_player(session, tier, name="Alpha O'Neil", job="PLD", role="tank", position="T1")
    b = await create_snapshot_player(session, tier, name="Bravo", job="WHM", role="healer", position="H1", sort_order=1)
    c = await create_snapshot_player(session, tier, name="Çharlie ★", job="BLM", role="caster", position="R2", sort_order=2)
    await session.commit()
    return {"group": group, "tier": tier, "a": a, "b": b, "c": c}


def _url(world) -> str:
    return f"/api/static-groups/{world['group'].id}/tiers/{world['tier'].id}/mark-floor-cleared"


def _payload(players, *, week: int = 1, floor: str = "M9S") -> dict:
    return {"weekNumber": week, "floor": floor, "playerIds": [p.id for p in players]}


async def _earned_counts(session: AsyncSession, tier, *, week: int, floor: str) -> Counter:
    """How many `earned` rows each player holds for (tier, week, floor)."""
    result = await session.execute(
        select(PageLedgerEntry.player_id).where(
            PageLedgerEntry.tier_snapshot_id == tier.id,
            PageLedgerEntry.week_number == week,
            PageLedgerEntry.floor == floor,
            PageLedgerEntry.transaction_type == "earned",
        )
    )
    return Counter(result.scalars().all())


async def _post(client: AsyncClient, world, payload: dict, headers: dict[str, str]):
    response = await client.post(_url(world), json=payload, headers=headers)
    assert response.status_code == 201, response.text
    assert set(response.json()) == {"message"}, response.text
    return response


async def test_reposting_the_same_request_leaves_one_earned_entry_per_player(
    client, session, auth_headers, world
):
    players = [world["a"], world["b"], world["c"]]
    await _post(client, world, _payload(players), auth_headers)
    await _post(client, world, _payload(players), auth_headers)

    counts = await _earned_counts(session, world["tier"], week=1, floor="M9S")
    assert counts == Counter({p.id: 1 for p in players})


async def test_mixed_request_credits_only_the_players_not_yet_credited(
    client, session, auth_headers, test_user, world
):
    # A was already credited for week 1 / M9S (e.g. by the Books card or the plugin).
    await create_page_ledger_entry(session, world["tier"], world["a"], test_user, week_number=1, floor="M9S")
    await session.commit()

    await _post(client, world, _payload([world["a"], world["b"], world["c"]]), auth_headers)

    counts = await _earned_counts(session, world["tier"], week=1, floor="M9S")
    assert counts == Counter({world["a"].id: 1, world["b"].id: 1, world["c"].id: 1})


async def test_every_player_already_credited_creates_nothing_and_still_returns_201(
    client, session, auth_headers, test_user, world
):
    for p in (world["a"], world["b"]):
        await create_page_ledger_entry(session, world["tier"], p, test_user, week_number=3, floor="M10S")
    await session.commit()

    await _post(client, world, _payload([world["a"], world["b"]], week=3, floor="M10S"), auth_headers)

    counts = await _earned_counts(session, world["tier"], week=3, floor="M10S")
    assert counts == Counter({world["a"].id: 1, world["b"].id: 1})


async def test_a_different_week_or_floor_still_credits_while_the_same_one_does_not(
    client, session, auth_headers, test_user, world
):
    a = world["a"]
    await create_page_ledger_entry(session, world["tier"], a, test_user, week_number=1, floor="M9S")
    await session.commit()

    await _post(client, world, _payload([a], week=1, floor="M9S"), auth_headers)
    await _post(client, world, _payload([a], week=2, floor="M9S"), auth_headers)
    await _post(client, world, _payload([a], week=1, floor="M10S"), auth_headers)

    assert await _earned_counts(session, world["tier"], week=1, floor="M9S") == Counter({a.id: 1})
    assert await _earned_counts(session, world["tier"], week=2, floor="M9S") == Counter({a.id: 1})
    assert await _earned_counts(session, world["tier"], week=1, floor="M10S") == Counter({a.id: 1})


async def test_only_an_earned_entry_in_the_same_tier_blocks_a_credit(
    client, session, auth_headers, test_user, world
):
    """A `spent`/`missed` row, or an `earned` row in another tier, is not a credit for this one."""
    a, b, c = world["a"], world["b"], world["c"]
    await create_page_ledger_entry(
        session, world["tier"], a, test_user, week_number=1, floor="M9S", transaction_type="spent", quantity=-4
    )
    await create_page_ledger_entry(
        session, world["tier"], b, test_user, week_number=1, floor="M9S", transaction_type="missed", quantity=0
    )
    other_tier = await create_tier_snapshot(session, world["group"], tier_id="other-tier", is_active=False)
    other_c = await create_snapshot_player(session, other_tier, name="Çharlie ★")
    await create_page_ledger_entry(session, other_tier, other_c, test_user, week_number=1, floor="M9S")
    # C is already credited in THIS tier, so the request must skip C.
    await create_page_ledger_entry(session, world["tier"], c, test_user, week_number=1, floor="M9S")
    await session.commit()

    await _post(client, world, _payload([a, b, c]), auth_headers)

    counts = await _earned_counts(session, world["tier"], week=1, floor="M9S")
    assert counts == Counter({a.id: 1, b.id: 1, c.id: 1})


async def test_plugin_api_key_repost_is_deduplicated_and_keeps_the_contract(
    client, session, auth_headers, world
):
    """The Dalamud plugin: Bearer xrp_ key, camelCase JSON, no CSRF header."""
    minted = await client.post("/api/auth/api-keys", json={"name": "#326 key"}, headers=auth_headers)
    assert minted.status_code == 201, minted.text
    raw_key = minted.json()["key"]

    for _ in range(2):
        response = await client.request(
            "POST", _url(world), json=_payload([world["a"], world["b"]], week=4),
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 201, response.text
        assert set(response.json()) == {"message"}, response.text

    counts = await _earned_counts(session, world["tier"], week=4, floor="M9S")
    assert counts == Counter({world["a"].id: 1, world["b"].id: 1})
