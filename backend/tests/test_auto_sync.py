"""Tests for the auto-sync background task."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.tasks.auto_sync import _is_due, _parse_settings, run_auto_sync_cycle
from tests.factories import (
    create_membership,
    create_snapshot_player,
    create_static_group,
    create_tier_snapshot,
)


def _gear_slot(
    *,
    slot: str,
    bis_source: str = "raid",
    item_id: int = 1001,
    item_level: int = 795,
    item_name: str = "Test Weapon",
    current_source: str = "crafted",
    has_item: bool = False,
):
    return {
        "slot": slot,
        "bisSource": bis_source,
        "itemId": item_id,
        "itemLevel": item_level,
        "itemName": item_name,
        "itemIcon": None,
        "currentSource": current_source,
        "hasItem": has_item,
        "isAugmented": False,
    }


@pytest.fixture
def patch_session_maker(engine):
    """Patch async_session_maker in auto_sync to use the test database."""
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    with patch("app.tasks.auto_sync.async_session_maker", maker):
        yield maker


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------


def test_is_due_returns_true_when_never_synced():
    assert _is_due(None, 8) is True


def test_is_due_returns_true_when_last_sync_is_old():
    old = (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat()
    assert _is_due(old, 8) is True


def test_is_due_returns_false_when_recently_synced():
    recent = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    assert _is_due(recent, 8) is False


def test_is_due_handles_malformed_timestamp():
    assert _is_due("not-a-date", 8) is True


def test_parse_settings_handles_dict():
    assert _parse_settings({"autoSyncEnabled": True}) == {"autoSyncEnabled": True}


def test_parse_settings_handles_none():
    assert _parse_settings(None) == {}


def test_parse_settings_handles_string():
    assert _parse_settings("garbage") == {}


# ---------------------------------------------------------------------------
# Integration tests for auto-sync cycle
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def auto_sync_settings():
    with patch("app.tasks.auto_sync.INTER_PLAYER_DELAY_SECONDS", 0):
        yield


@pytest.mark.asyncio
async def test_auto_sync_skips_statics_without_setting(session, test_user, patch_session_maker):
    """Statics without autoSyncEnabled are ignored."""
    group = await create_static_group(session, owner=test_user)
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[_gear_slot(slot="weapon")],
    )
    player.lodestone_id = "910001"
    await session.commit()

    with patch("app.tasks.auto_sync.sync_player_gear_from_provider") as mock_sync:
        await run_auto_sync_cycle()
        mock_sync.assert_not_called()


@pytest.mark.asyncio
async def test_auto_sync_syncs_linked_players_when_enabled(session, test_user, patch_session_maker):
    """Players with lodestone_id are synced when the static has autoSyncEnabled."""
    group = await create_static_group(session, owner=test_user)
    group.settings = {"autoSyncEnabled": True, "autoSyncIntervalHours": 8}
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[_gear_slot(slot="weapon")],
    )
    player.lodestone_id = "910001"
    await session.commit()

    mock_result = AsyncMock()
    with patch("app.tasks.auto_sync.sync_player_gear_from_provider", mock_result):
        await run_auto_sync_cycle()
        mock_result.assert_called_once()
        call_kwargs = mock_result.call_args
        assert call_kwargs[1]["source_prefix"] == "auto_"


@pytest.mark.asyncio
async def test_auto_sync_skips_recently_synced_players(session, test_user, patch_session_maker):
    """Players synced within the interval window are skipped."""
    group = await create_static_group(session, owner=test_user)
    group.settings = {"autoSyncEnabled": True, "autoSyncIntervalHours": 8}
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[_gear_slot(slot="weapon")],
    )
    player.lodestone_id = "910001"
    player.last_sync = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    await session.commit()

    with patch("app.tasks.auto_sync.sync_player_gear_from_provider") as mock_sync:
        await run_auto_sync_cycle()
        mock_sync.assert_not_called()


@pytest.mark.asyncio
async def test_auto_sync_skips_players_without_lodestone_id(session, test_user, patch_session_maker):
    """Players without a linked lodestone_id are skipped."""
    group = await create_static_group(session, owner=test_user)
    group.settings = {"autoSyncEnabled": True, "autoSyncIntervalHours": 8}
    tier = await create_tier_snapshot(session, static_group=group)
    await create_snapshot_player(
        session,
        tier,
        gear=[_gear_slot(slot="weapon")],
    )
    await session.commit()

    with patch("app.tasks.auto_sync.sync_player_gear_from_provider") as mock_sync:
        await run_auto_sync_cycle()
        mock_sync.assert_not_called()


@pytest.mark.asyncio
async def test_auto_sync_failure_does_not_crash_loop(session, test_user, patch_session_maker):
    """A failing player sync should not crash the entire cycle."""
    group = await create_static_group(session, owner=test_user)
    group.settings = {"autoSyncEnabled": True, "autoSyncIntervalHours": 8}
    tier = await create_tier_snapshot(session, static_group=group)
    player = await create_snapshot_player(
        session,
        tier,
        gear=[_gear_slot(slot="weapon")],
    )
    player.lodestone_id = "910001"
    await session.commit()

    mock_sync = AsyncMock(side_effect=Exception("Provider down"))
    with patch("app.tasks.auto_sync.sync_player_gear_from_provider", mock_sync):
        # Should not raise
        await run_auto_sync_cycle()
