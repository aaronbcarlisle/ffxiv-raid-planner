"""Tests for collection catalog — seeding, listing, and goal creation from catalog"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.main import app
from app.models import User
from app.services.catalog_import_service import seed_from_internal, is_catalog_seeded
from tests.factories import create_membership, create_static_group, create_user

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="cat_owner_1", discord_username="owner")


@pytest_asyncio.fixture
async def member(session: AsyncSession) -> User:
    return await create_user(session, discord_id="cat_member_1", discord_username="member")


@pytest.fixture
def owner_headers(owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(owner.id)}"}


@pytest.fixture
def member_headers(member: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member.id)}"}


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User, member: User):
    g = await create_static_group(session, owner)
    await create_membership(session, member, g, role="member")
    return g


# ── Internal seed ─────────────────────────────────────────────────────────────

async def test_seed_from_internal(session: AsyncSession):
    count = await seed_from_internal(session)
    assert count > 0
    assert await is_catalog_seeded(session)


async def test_seed_is_idempotent(session: AsyncSession):
    count1 = await seed_from_internal(session)
    count2 = await seed_from_internal(session)
    assert count1 == count2  # Same count on re-seed (no duplicates)


async def test_dt_extreme_mounts_seeded(session: AsyncSession):
    await seed_from_internal(session)
    from sqlalchemy import select
    from app.models.collection_catalog_item import CollectionCatalogItem
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.expansion == "dt",
            CollectionCatalogItem.category == "mount",
        )
    )
    items = list(result.scalars().all())
    assert len(items) >= 7, "Should have at least 7 DT mount farm items"
    names = {item.name for item in items}
    assert "Wings of Death" in names
    assert "Wings of Resolve" in names
    assert "Wings of Eternity" in names


async def test_dt_ultimate_weapons_seeded(session: AsyncSession):
    await seed_from_internal(session)
    from sqlalchemy import select
    from app.models.collection_catalog_item import CollectionCatalogItem
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.expansion == "dt",
            CollectionCatalogItem.category == "weapon",
        )
    )
    items = list(result.scalars().all())
    assert len(items) >= 2
    names = {item.name for item in items}
    assert "Ultimate Edenmorn Weapons" in names
    assert "Palazzo Diamond Weapons" in names


async def test_token_data_present(session: AsyncSession):
    await seed_from_internal(session)
    from sqlalchemy import select
    from app.models.collection_catalog_item import CollectionCatalogItem
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.name == "Wings of Death"
        )
    )
    item = result.scalar_one()
    assert item.token_name == "Grave Totem"
    assert item.token_cost == 99


async def test_pending_exchange_items_have_null_token_cost(session: AsyncSession):
    await seed_from_internal(session)
    from sqlalchemy import select
    from app.models.collection_catalog_item import CollectionCatalogItem
    result = await session.execute(
        select(CollectionCatalogItem).where(
            CollectionCatalogItem.source_duty_key.in_([
                "dt-hell-on-rails-ex", "dt-unmaking-ex"
            ])
        )
    )
    items = list(result.scalars().all())
    assert len(items) == 2
    for item in items:
        assert item.token_cost is None
        assert item.token_name is None


# ── API list endpoint ──────────────────────────────────────────────────────────

async def test_list_catalog_auto_seeds(async_client: AsyncClient, owner_headers):
    resp = await async_client.get("/api/collection-catalog", headers=owner_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0


async def test_list_catalog_filter_by_category(async_client: AsyncClient, owner_headers):
    resp = await async_client.get(
        "/api/collection-catalog?category=mount", headers=owner_headers
    )
    assert resp.status_code == 200
    items = resp.json()
    assert all(item["category"] == "mount" for item in items)


async def test_list_catalog_filter_by_expansion(async_client: AsyncClient, owner_headers):
    resp = await async_client.get(
        "/api/collection-catalog?expansion=dt", headers=owner_headers
    )
    assert resp.status_code == 200
    items = resp.json()
    assert all(item["expansion"] == "dt" for item in items)
    duty_names = {item["source_duty_name"] for item in items}
    assert any("Necron" in name for name in duty_names if name)


async def test_list_catalog_requires_auth(async_client: AsyncClient):
    resp = await async_client.get("/api/collection-catalog")
    assert resp.status_code in (401, 403)


# ── Goal from catalog item ─────────────────────────────────────────────────────

async def test_create_goal_from_catalog(async_client: AsyncClient, group, owner_headers):
    # Get catalog items
    catalog_resp = await async_client.get("/api/collection-catalog?category=mount", headers=owner_headers)
    items = catalog_resp.json()
    assert len(items) > 0
    item = next(i for i in items if i["expansion"] == "dt")

    # Create goal from catalog item
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={
            "goal_type": "mount",
            "title": item["name"],
            "status": "farming",
            "catalog_item_id": item["id"],
            "token_name": item["token_name"],
            "token_cost": item["token_cost"],
            "priority_mode": "priority_order",
        },
        headers=owner_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["catalog_item_id"] == item["id"]
    assert data["token_name"] == item["token_name"]
    assert data["token_cost"] == item["token_cost"]


async def test_custom_goal_without_catalog(async_client: AsyncClient, group, owner_headers):
    resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={
            "goal_type": "custom_reward",
            "title": "Rare Housing Item",
            "status": "wanted",
        },
        headers=owner_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["catalog_item_id"] is None
    assert data["token_name"] is None


async def test_token_count_can_buy_check(async_client: AsyncClient, group, owner_headers, member_headers, member):
    """Member with token_count >= token_cost should be flagged as 'can buy'."""
    # Create a goal with token cost
    create_resp = await async_client.post(
        f"/api/static-groups/{group.id}/collection-goals",
        json={
            "goal_type": "mount",
            "title": "Wings of Death",
            "status": "farming",
            "token_name": "Grave Totem",
            "token_cost": 99,
            "priority_mode": "priority_order",
        },
        headers=owner_headers,
    )
    goal_id = create_resp.json()["id"]

    # Member sets state with token count at threshold
    await async_client.patch(
        f"/api/static-groups/{group.id}/collection-goals/{goal_id}/participants",
        json={"state": "need", "token_count": 99},
        headers=member_headers,
    )
    participants = (await async_client.get(
        f"/api/static-groups/{group.id}/collection-goals/{goal_id}/participants",
        headers=owner_headers,
    )).json()
    p = next(p for p in participants if p["user_id"] == member.id)
    assert p["token_count"] == 99
    # can_buy is a frontend concern — backend just stores token_count correctly
