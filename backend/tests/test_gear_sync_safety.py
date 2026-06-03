"""Tests for gear sync safety gates and Tomestone refresh integration."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.gear_sync import sync_player_gear_from_provider
from app.services.tomestone_provider import TomestoneProvider


def _gear_slot(
    *,
    slot: str,
    bis_source: str = "raid",
    item_id: int = 1001,
    item_level: int = 795,
    item_name: str = "Test Weapon",
    current_source: str = "crafted",
    has_item: bool = False,
    equipped_item_id: int | None = None,
    equipped_item_level: int | None = None,
    equipped_item_name: str | None = None,
):
    d = {
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
    if equipped_item_level is not None:
        d["equippedItemLevel"] = equipped_item_level
    if equipped_item_id is not None:
        d["equippedItemId"] = equipped_item_id
    if equipped_item_name is not None:
        d["equippedItemName"] = equipped_item_name
    return d


def _full_gear_set(*, ilvl: int = 795, current_source: str = "crafted"):
    """Create a full 11-slot gear set."""
    slots = ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]
    return [
        _gear_slot(
            slot=s,
            equipped_item_level=ilvl,
            equipped_item_id=1000 + i,
            equipped_item_name=f"Test {s.title()}",
            current_source=current_source,
        )
        for i, s in enumerate(slots)
    ]


def _mock_player(
    *,
    job: str = "DRG",
    gear: list | None = None,
    lodestone_name: str | None = None,
    lodestone_server: str | None = None,
):
    player = MagicMock()
    player.id = "player-1"
    player.job = job
    player.gear = gear or []
    player.lodestone_id = None
    player.last_sync = None
    player.updated_at = None
    player.lodestone_name = lodestone_name
    player.lodestone_server = lodestone_server
    player.lodestone_avatar_url = None
    player.last_sync_source = None
    player.last_synced_job = None
    return player


def _xivapi_payload(
    *,
    job: str = "DRG",
    gear_ids: dict[str, int] | None = None,
    source: str = "xivapi",
    name: str = "Test Char",
    server: str = "Gilgamesh",
):
    """Build a minimal XIVAPI-shape payload."""
    if gear_ids is None:
        gear_ids = {
            "MainHand": 2001,
            "Head": 2002,
            "Body": 2003,
            "Hands": 2004,
            "Legs": 2005,
            "Feet": 2006,
            "Earrings": 2007,
            "Necklace": 2008,
            "Bracelets": 2009,
            "Ring1": 2010,
            "Ring2": 2011,
        }
    gear = {slot: {"ID": item_id} for slot, item_id in gear_ids.items()}
    return {
        "Character": {
            "ID": 12345,
            "Name": name,
            "Server": server,
            "Avatar": None,
            "GearSet": {
                "Class": {"Abbreviation": job},
                "Level": 100,
                "Gear": gear,
            },
        },
        "__source": source,
    }


def _mock_item_info(item_id: int, *, level: int = 795, name: str = "Test Item"):
    return {"id": item_id, "name": name, "level": level, "icon": "test.png"}


# ---------------------------------------------------------------------------
# Auto-sync: Job mismatch gate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_skips_job_mismatch():
    """Auto-sync should skip when upstream job doesn't match registered job."""
    player = _mock_player(job="BRD", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="MCH")

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], {}))),
        patch("app.routers.lodestone.fetch_item_from_garland", new=AsyncMock(return_value=_mock_item_info(2001))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is True
    assert result.skip_reason == "skipped_job_mismatch"
    assert result.payload_changed is False


@pytest.mark.asyncio
async def test_manual_sync_allows_job_mismatch_with_warning():
    """Manual sync should apply gear even with job mismatch, but include a warning."""
    player = _mock_player(job="BRD", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="MCH")

    equipped_lookup = {
        "weapon": {"item_id": 2001, "item_level": 795, "item_name": "Test Weapon", "item_icon": "w.png", "current_source": "savage", "has_equipped_item": True, "lookup_succeeded": True},
    }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped_lookup))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, is_auto=False)

    assert result.skipped is False
    assert result.job_mismatch_warning is not None
    assert "MCH" in result.job_mismatch_warning
    assert "BRD" in result.job_mismatch_warning


# ---------------------------------------------------------------------------
# Auto-sync: Lower item level gate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_skips_lower_avg_ilvl():
    """Auto-sync should skip when upstream average iLv is lower than stored."""
    player = _mock_player(job="DRG", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="DRG")

    lower_equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        lower_equipped[slot] = {
            "item_id": 3001, "item_level": 530, "item_name": "Old Gear",
            "item_icon": "old.png", "current_source": "crafted",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], lower_equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is True
    assert result.skip_reason == "skipped_lower_item_level"


@pytest.mark.asyncio
async def test_auto_sync_allows_same_or_higher_ilvl():
    """Auto-sync should proceed when upstream iLv is same or higher."""
    player = _mock_player(job="DRG", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="DRG")

    same_equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        same_equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], same_equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is False


# ---------------------------------------------------------------------------
# Auto-sync: Incomplete payload gate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_skips_incomplete_payload():
    """Auto-sync should skip when upstream returns too few gear slots."""
    player = _mock_player(job="DRG", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="DRG", gear_ids={"MainHand": 2001, "Head": 2002})

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], {}))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is True
    assert result.skip_reason == "skipped_incomplete_payload"


# ---------------------------------------------------------------------------
# Auto-sync: Missing slot protection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_preserves_gear_when_upstream_missing_slot():
    """Auto-sync should preserve stored gear when upstream omits a slot."""
    gear = _full_gear_set(ilvl=790)
    player = _mock_player(job="DRG", gear=gear)
    payload = _xivapi_payload(job="DRG")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }
    # ring2 is intentionally missing from equipped

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is False
    ring2_slot = next((s for s in result.gear if s["slot"] == "ring2"), None)
    assert ring2_slot is not None
    assert ring2_slot.get("equippedItemLevel") == 790


@pytest.mark.asyncio
async def test_manual_sync_clears_missing_slots():
    """Manual sync should clear gear when upstream omits a slot (existing behavior)."""
    gear = _full_gear_set(ilvl=790)
    player = _mock_player(job="DRG", gear=gear)
    payload = _xivapi_payload(job="DRG")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, is_auto=False)

    assert result.skipped is False
    ring2_slot = next((s for s in result.gear if s["slot"] == "ring2"), None)
    assert ring2_slot is not None
    assert ring2_slot.get("hasItem") is False


# ---------------------------------------------------------------------------
# Auto-sync: Slot-level item level protection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_preserves_slot_with_higher_stored_ilvl():
    """Auto-sync should not downgrade a slot's item level even if overall avg is higher."""
    gear = _full_gear_set(ilvl=790)
    gear[0]["equippedItemLevel"] = 800
    player = _mock_player(job="DRG", gear=gear)
    payload = _xivapi_payload(job="DRG")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    weapon = next((s for s in result.gear if s["slot"] == "weapon"), None)
    assert weapon is not None
    assert weapon.get("equippedItemLevel") == 800
    assert result.diagnostics is not None
    assert result.diagnostics.lower_slot_count >= 1


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_diagnostics_include_safe_fields_only():
    """Diagnostics should not contain secrets."""
    player = _mock_player(job="DRG", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="DRG")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, is_auto=True)

    diag = result.diagnostics
    assert diag is not None
    assert diag.provider == "xivapi"
    assert diag.mode == "auto_sync"
    assert diag.lodestone_id == 12345
    assert diag.registered_job == "DRG"
    assert diag.upstream_active_job == "DRG"
    assert diag.stored_avg_ilvl > 0
    assert diag.upstream_avg_ilvl > 0
    diag_str = str(vars(diag))
    assert "token" not in diag_str.lower()
    assert "authorization" not in diag_str.lower()
    assert "bearer" not in diag_str.lower()


# ---------------------------------------------------------------------------
# Tomestone refresh
# ---------------------------------------------------------------------------


class _TomestoneSettings:
    def __init__(self, token: str = ""):
        self.tomestone_api_token = token


def _mock_http_response(status_code: int, payload=None, *, text: str = ""):
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    response.headers = {}
    response.json.return_value = payload
    return response


def _mock_http_client(response):
    client = AsyncMock()
    client.get.return_value = response
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


@pytest.mark.asyncio
async def test_refresh_character_returns_queued_on_200():
    provider = TomestoneProvider(_TomestoneSettings("test-token"))
    response = _mock_http_response(200)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        status = await provider.refresh_character(14112966)

    assert status == "refresh_queued"


@pytest.mark.asyncio
async def test_refresh_character_returns_rate_limited_on_429():
    provider = TomestoneProvider(_TomestoneSettings("test-token"))
    response = _mock_http_response(429)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        status = await provider.refresh_character(14112966)

    assert status == "rate_limited"


@pytest.mark.asyncio
async def test_refresh_character_returns_forbidden_on_403():
    provider = TomestoneProvider(_TomestoneSettings("test-token"))
    response = _mock_http_response(403)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        status = await provider.refresh_character(14112966)

    assert status == "forbidden"


@pytest.mark.asyncio
async def test_refresh_character_returns_bad_response_on_500():
    provider = TomestoneProvider(_TomestoneSettings("test-token"))
    response = _mock_http_response(500)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        status = await provider.refresh_character(14112966)

    assert status == "bad_response"


@pytest.mark.asyncio
async def test_refresh_character_returns_not_supported_without_token():
    provider = TomestoneProvider(_TomestoneSettings(""))
    status = await provider.refresh_character(14112966)
    assert status == "not_supported"


@pytest.mark.asyncio
async def test_refresh_character_returns_unavailable_on_timeout():
    import httpx
    provider = TomestoneProvider(_TomestoneSettings("test-token"))

    client = AsyncMock()
    client.get.side_effect = httpx.TimeoutException("slow")
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=client):
        status = await provider.refresh_character(14112966)

    assert status == "upstream_unavailable"


@pytest.mark.asyncio
async def test_refresh_character_does_not_log_token(caplog):
    """Ensure the API token never appears in log output."""
    secret_token = "super-secret-tomestone-token-12345"
    provider = TomestoneProvider(_TomestoneSettings(secret_token))
    response = _mock_http_response(200)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=_mock_http_client(response)):
        await provider.refresh_character(14112966)

    for record in caplog.records:
        assert secret_token not in record.getMessage()


@pytest.mark.asyncio
async def test_refresh_uses_correct_url():
    """Verify the refresh endpoint URL matches what Tomestone's browser button uses."""
    provider = TomestoneProvider(_TomestoneSettings("test-token"))
    response = _mock_http_response(200)
    client = _mock_http_client(response)

    with patch("app.services.tomestone_provider.httpx.AsyncClient", return_value=client):
        await provider.refresh_character(14112966)

    call_args = client.get.call_args
    assert call_args[0][0] == "https://tomestone.gg/character/update/14112966"


# ---------------------------------------------------------------------------
# Auto-sync: Identity mismatch (stale provider data)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auto_sync_skips_server_mismatch():
    """Auto-sync should skip when upstream server doesn't match stored linked server."""
    player = _mock_player(
        job="DRG",
        gear=_full_gear_set(ilvl=790),
        lodestone_name="Lylarai Ivalice",
        lodestone_server="Balmung",
    )
    payload = _xivapi_payload(job="DRG", server="Tonberry")

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], {}))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is True
    assert result.skip_reason == "skipped_identity_mismatch"
    assert result.diagnostics is not None
    assert any("identity_mismatch" in w for w in result.diagnostics.warnings)


@pytest.mark.asyncio
async def test_auto_sync_skips_name_mismatch():
    """Auto-sync should skip when upstream name doesn't match stored linked name."""
    player = _mock_player(
        job="DRG",
        gear=_full_gear_set(ilvl=790),
        lodestone_name="Lylarai Ivalice",
        lodestone_server="Gilgamesh",
    )
    payload = _xivapi_payload(job="DRG", name="Different Character", server="Gilgamesh")

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], {}))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is True
    assert result.skip_reason == "skipped_identity_mismatch"


@pytest.mark.asyncio
async def test_manual_sync_allows_identity_mismatch_with_warning():
    """Manual sync should proceed with identity mismatch but include warnings."""
    player = _mock_player(
        job="DRG",
        gear=_full_gear_set(ilvl=790),
        lodestone_name="Lylarai Ivalice",
        lodestone_server="Balmung",
    )
    payload = _xivapi_payload(job="DRG", server="Tonberry")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, is_auto=False)

    assert result.skipped is False
    assert result.diagnostics is not None
    assert any("identity_mismatch" in w for w in result.diagnostics.warnings)


@pytest.mark.asyncio
async def test_auto_sync_passes_when_identity_matches():
    """Auto-sync should not skip when identity matches (case-insensitive)."""
    player = _mock_player(
        job="DRG",
        gear=_full_gear_set(ilvl=790),
        lodestone_name="Lylarai Ivalice",
        lodestone_server="Gilgamesh",
    )
    payload = _xivapi_payload(job="DRG", name="Lylarai Ivalice", server="Gilgamesh")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is False


@pytest.mark.asyncio
async def test_auto_sync_ignores_identity_when_not_stored():
    """Auto-sync should not check identity when no linked name/server is stored."""
    player = _mock_player(
        job="DRG",
        gear=_full_gear_set(ilvl=790),
    )
    payload = _xivapi_payload(job="DRG", name="Any Name", server="Any Server")

    equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        equipped[slot] = {
            "item_id": 3001, "item_level": 795, "item_name": "Good Gear",
            "item_icon": "g.png", "current_source": "savage",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, source_prefix="auto_", is_auto=True)

    assert result.skipped is False


# ---------------------------------------------------------------------------
# Diagnostics: lower avg iLv warning for manual sync
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_manual_sync_includes_lower_ilvl_warning():
    """Manual sync should include a lower avg iLv warning in diagnostics."""
    player = _mock_player(job="DRG", gear=_full_gear_set(ilvl=790))
    payload = _xivapi_payload(job="DRG")

    lower_equipped = {}
    for slot in ["weapon", "head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1", "ring2"]:
        lower_equipped[slot] = {
            "item_id": 3001, "item_level": 530, "item_name": "Old Gear",
            "item_icon": "old.png", "current_source": "crafted",
            "has_equipped_item": True, "lookup_succeeded": True,
        }

    with (
        patch("app.services.gear_sync._fetch_character_payload", new=AsyncMock(return_value=payload)),
        patch("app.services.gear_sync._build_equipped_slots", new=AsyncMock(return_value=([], lower_equipped))),
    ):
        result = await sync_player_gear_from_provider(player, 12345, is_auto=False)

    assert result.skipped is False
    assert result.diagnostics is not None
    assert any("lower_avg_ilvl" in w for w in result.diagnostics.warnings)
