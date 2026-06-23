"""Tests for catalog_id_import_service: verified game-ID ingestion.

Covers:
  - exact confidence → game_mount_id updated in catalog row
  - exact confidence → token_item_id updated in catalog row
  - both IDs updated in a single call (mount + token)
  - non-exact confidence (ambiguous, none) → skipped, no DB write
  - already-set game_mount_id → not overwritten (already_set counted)
  - already-set token_item_id → not overwritten (already_set counted)
  - missing source_duty_key match → counted as skipped with error
  - empty mappings list → returns zero counts
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection_catalog_item import CollectionCatalogItem
from app.schemas.collection_catalog import VerifiedIdMapping
from app.services.catalog_id_import_service import import_verified_ids

pytestmark = pytest.mark.asyncio


_NOW = datetime.now(timezone.utc).isoformat()


def _catalog_item(
    *,
    source_duty_key: str,
    name: str = "Test Mount",
    category: str = "mount",
    game_mount_id: int | None = None,
    token_item_id: int | None = None,
    is_active: bool = True,
) -> CollectionCatalogItem:
    return CollectionCatalogItem(
        id=str(uuid.uuid4()),
        external_source="internal",
        external_id=source_duty_key,
        name=name,
        category=category,
        expansion="dt",
        source_duty_key=source_duty_key,
        game_mount_id=game_mount_id,
        token_item_id=token_item_id,
        is_active=is_active,
        is_curated=True,
        updated_at=_NOW,
    )


def _mapping(
    *,
    source_duty_key: str,
    reward_name: str = "Test Mount",
    game_mount_id: int | None = None,
    token_item_id: int | None = None,
    confidence: str = "exact",
    verified_by: str = "plugin_lumina",
) -> VerifiedIdMapping:
    return VerifiedIdMapping(
        source_duty_key=source_duty_key,
        reward_name=reward_name,
        game_mount_id=game_mount_id,
        token_item_id=token_item_id,
        confidence=confidence,
        reason="",
        verified_by=verified_by,
        verified_at=datetime.now(timezone.utc).isoformat(),
    )


# ──────────────────────────────────────────────────────────────────────────────


async def test_exact_confidence_sets_game_mount_id(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-valigarmanda")
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-valigarmanda", game_mount_id=12345)],
    )

    assert result.updated == 1
    assert result.already_set == 0
    assert result.skipped == 0
    assert result.errors == []
    await session.refresh(item)
    assert item.game_mount_id == 12345


async def test_exact_confidence_sets_token_item_id(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-zoraal-ja")
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-zoraal-ja", token_item_id=36810)],
    )

    assert result.updated == 1
    await session.refresh(item)
    assert item.token_item_id == 36810
    # mount_id was not in mapping — stays null
    assert item.game_mount_id is None


async def test_exact_confidence_sets_both_ids(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-sphene")
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-sphene", game_mount_id=9000, token_item_id=9001)],
    )

    assert result.updated == 1
    await session.refresh(item)
    assert item.game_mount_id == 9000
    assert item.token_item_id == 9001


async def test_non_exact_confidence_skipped(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-recollection")
    session.add(item)
    await session.flush()

    for confidence in ("ambiguous", "none"):
        r = await import_verified_ids(
            session,
            [_mapping(source_duty_key="dt-recollection", game_mount_id=777, confidence=confidence)],
        )
        assert r.skipped == 1, f"confidence={confidence} should be skipped"
        assert r.updated == 0

    await session.refresh(item)
    assert item.game_mount_id is None


async def test_already_set_game_mount_id_not_overwritten(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-necron-embrace", game_mount_id=111)
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-necron-embrace", game_mount_id=999)],
    )

    assert result.updated == 0
    assert result.already_set == 1
    await session.refresh(item)
    # Original value is preserved
    assert item.game_mount_id == 111


async def test_already_set_token_item_id_not_overwritten(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-hell-on-rails", token_item_id=222)
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-hell-on-rails", token_item_id=888)],
    )

    assert result.updated == 0
    assert result.already_set == 1
    await session.refresh(item)
    assert item.token_item_id == 222


async def test_partial_already_set_updates_missing_only(session: AsyncSession) -> None:
    """If game_mount_id is set but token_item_id is null → update token only."""
    item = _catalog_item(source_duty_key="dt-unmaking", game_mount_id=500)
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-unmaking", game_mount_id=500, token_item_id=501)],
    )

    # token_item_id was null → updated; game_mount_id was already set → not overwritten
    assert result.updated == 1
    await session.refresh(item)
    assert item.game_mount_id == 500  # unchanged
    assert item.token_item_id == 501  # newly set


async def test_missing_source_duty_key_counted_as_skipped(session: AsyncSession) -> None:
    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-does-not-exist", game_mount_id=123)],
    )

    assert result.skipped == 1
    assert result.updated == 0
    assert len(result.errors) == 1
    assert "dt-does-not-exist" in result.errors[0]


async def test_empty_mappings_returns_zero_counts(session: AsyncSession) -> None:
    result = await import_verified_ids(session, [])

    assert result.updated == 0
    assert result.already_set == 0
    assert result.skipped == 0
    assert result.errors == []


async def test_inactive_catalog_row_not_matched(session: AsyncSession) -> None:
    item = _catalog_item(source_duty_key="dt-windward-wilds", is_active=False)
    session.add(item)
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-windward-wilds", game_mount_id=42)],
    )

    assert result.skipped == 1
    await session.refresh(item)
    assert item.game_mount_id is None


async def test_non_mount_category_not_matched(session: AsyncSession) -> None:
    """The import service only touches category=mount rows. An orchestrion row is untouched."""
    mount = _catalog_item(source_duty_key="dt-valigarmanda-2", name="Wings Again", category="mount")
    orchestrion = _catalog_item(
        source_duty_key="dt-valigarmanda-2",
        name="Some Track",
        category="orchestrion",
    )
    session.add_all([mount, orchestrion])
    await session.flush()

    result = await import_verified_ids(
        session,
        [_mapping(source_duty_key="dt-valigarmanda-2", game_mount_id=5555)],
    )

    # Only the mount row should have been updated
    assert result.updated == 1
    await session.refresh(mount)
    await session.refresh(orchestrion)
    assert mount.game_mount_id == 5555
    assert orchestrion.game_mount_id is None


async def test_multiple_mappings_in_one_call(session: AsyncSession) -> None:
    items = [
        _catalog_item(source_duty_key=f"dt-duty-{i}", name=f"Mount {i}")
        for i in range(3)
    ]
    session.add_all(items)
    await session.flush()

    mappings = [
        _mapping(source_duty_key=f"dt-duty-{i}", game_mount_id=100 + i)
        for i in range(3)
    ]
    result = await import_verified_ids(session, mappings)

    assert result.updated == 3
    assert result.skipped == 0
    for i, item in enumerate(items):
        await session.refresh(item)
        assert item.game_mount_id == 100 + i
