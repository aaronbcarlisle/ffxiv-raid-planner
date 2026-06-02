"""Shared gear sync logic used by both manual sync endpoint and auto-sync background task."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from ..logging_config import get_logger
from ..models.snapshot_player import SnapshotPlayer
from ..routers.lodestone import (
    _build_equipped_slots,
    _calculate_has_item,
    _calculate_is_augmented,
    _coerce_int,
    _derive_source_from_bis,
    _fetch_character_payload,
    _normalize_player_gear,
    _sanitize_avatar_url,
)

logger = get_logger(__name__)


@dataclass
class GearSyncResult:
    """Result of syncing a player's gear from an external provider."""

    updated_slots: int
    bis_matched_count: int
    payload_changed: bool
    sync_source: str
    synced_job: str | None
    job_mismatch_warning: str | None
    lodestone_name: str | None
    lodestone_server: str | None
    lodestone_avatar_url: str | None
    gear: list[dict[str, Any]]
    last_sync: str


async def sync_player_gear_from_provider(
    player: SnapshotPlayer,
    lodestone_id: int,
    *,
    source_prefix: str = "",
) -> GearSyncResult:
    """Fetch gear from Lodestone/Tomestone and update a player's gear state.

    This function modifies the player object in-place but does NOT commit.
    The caller is responsible for flushing/committing the session.

    Args:
        player: The SnapshotPlayer to update.
        lodestone_id: Numeric Lodestone character ID.
        source_prefix: Optional prefix for sync_source (e.g. "auto_" for background syncs).

    Returns:
        GearSyncResult with sync diagnostics.
    """
    previous_gear = [dict(g) for g in _normalize_player_gear(player.gear)]
    previous_avg_ilvl = 0
    prev_ilvl_slots = [g for g in previous_gear if (g.get("equippedItemLevel") or 0) > 0]
    if prev_ilvl_slots:
        previous_avg_ilvl = round(
            sum(g["equippedItemLevel"] for g in prev_ilvl_slots) / len(prev_ilvl_slots)
        )

    data = await _fetch_character_payload(
        lodestone_id,
        require_usable_gear=True,
        dev_error_codes=False,
        no_cache=True,
    )
    character = data["Character"]
    raw_source = str(data.get("__source") or "xivapi")
    sync_source = f"{source_prefix}{raw_source}" if source_prefix else raw_source
    gear_set = character.get("GearSet", {})
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set, dict) else {}

    active_class = gear_set.get("Class", {}) if isinstance(gear_set, dict) else {}
    synced_job = active_class.get("Abbreviation") if isinstance(active_class, dict) else None

    _, equipped_by_slot = await _build_equipped_slots(gear_items)

    current_gear = [dict(g) for g in previous_gear]
    updated_count = 0

    for gear_slot in current_gear:
        slot_name = gear_slot.get("slot")
        if not slot_name:
            continue

        equipped = equipped_by_slot.get(slot_name)
        previous_state = dict(gear_slot)
        existing_source = gear_slot.get("currentSource")
        exact_item_match = bool(
            equipped
            and _coerce_int(gear_slot.get("itemId"))
            and _coerce_int(gear_slot.get("itemId")) == _coerce_int(equipped.get("item_id"))
        )

        if not equipped:
            gear_slot["currentSource"] = "unknown"
            gear_slot["hasItem"] = False
            gear_slot["isAugmented"] = False
            gear_slot.pop("equippedItemId", None)
            gear_slot.pop("equippedItemLevel", None)
            gear_slot.pop("equippedItemName", None)
            gear_slot.pop("equippedItemIcon", None)
        else:
            next_source = equipped.get("current_source", "unknown")
            if next_source == "unknown":
                if exact_item_match:
                    next_source = _derive_source_from_bis(gear_slot.get("bisSource"))
                elif existing_source and existing_source != "unknown":
                    next_source = existing_source

            gear_slot["currentSource"] = next_source
            gear_slot["hasItem"] = _calculate_has_item(gear_slot, equipped)
            gear_slot["isAugmented"] = _calculate_is_augmented(
                gear_slot,
                {**equipped, "current_source": next_source},
                bool(gear_slot["hasItem"]),
            )
            if equipped.get("has_equipped_item"):
                gear_slot["equippedItemId"] = equipped.get("item_id")
                gear_slot["equippedItemLevel"] = equipped.get("item_level")
                gear_slot["equippedItemName"] = equipped.get("item_name")
                gear_slot["equippedItemIcon"] = equipped.get("item_icon")

        if gear_slot != previous_state:
            updated_count += 1

    bis_matched_count = sum(1 for s in current_gear if s.get("hasItem"))
    payload_changed = updated_count > 0
    now = datetime.now(timezone.utc).isoformat()
    lodestone_name = str(character.get("Name") or "") or None
    lodestone_server = str(character.get("Server") or "") or None
    avatar_value = character.get("Avatar")
    existing_avatar_url = getattr(player, "lodestone_avatar_url", None)
    lodestone_avatar_url = _sanitize_avatar_url(avatar_value) or existing_avatar_url

    new_avg_ilvl = 0
    new_ilvl_slots = [g for g in current_gear if (g.get("equippedItemLevel") or 0) > 0]
    if new_ilvl_slots:
        new_avg_ilvl = round(
            sum(g["equippedItemLevel"] for g in new_ilvl_slots) / len(new_ilvl_slots)
        )

    job_mismatch_warning = None
    player_job = player.job
    if synced_job and player_job and synced_job.upper() != player_job.upper():
        job_mismatch_warning = (
            f"Synced gear appears to be for {synced_job}, but this player is set as "
            f"{player_job}. Lodestone may still be showing a previous gearset."
        )

    # Update player in-place (caller commits)
    player.gear = [dict(g) for g in current_gear]
    player.lodestone_id = str(lodestone_id)
    player.last_sync = now
    player.updated_at = now
    if hasattr(player, "lodestone_name"):
        player.lodestone_name = lodestone_name
    if hasattr(player, "lodestone_server"):
        player.lodestone_server = lodestone_server
    if hasattr(player, "lodestone_avatar_url"):
        player.lodestone_avatar_url = lodestone_avatar_url
    if hasattr(player, "last_sync_source"):
        player.last_sync_source = sync_source
    if hasattr(player, "last_synced_job"):
        player.last_synced_job = synced_job

    logger.info(
        "gear_sync_complete",
        player_id=player.id,
        lodestone_id=lodestone_id,
        lodestone_name=lodestone_name,
        lodestone_server=lodestone_server,
        sync_source=sync_source,
        synced_job=synced_job,
        player_job=player_job,
        previous_avg_ilvl=previous_avg_ilvl,
        new_avg_ilvl=new_avg_ilvl,
        updated_slots=updated_count,
        payload_changed=payload_changed,
        job_mismatch=bool(job_mismatch_warning),
        sync_timestamp=now,
    )

    return GearSyncResult(
        updated_slots=updated_count,
        bis_matched_count=bis_matched_count,
        payload_changed=payload_changed,
        sync_source=sync_source,
        synced_job=synced_job,
        job_mismatch_warning=job_mismatch_warning,
        lodestone_name=lodestone_name,
        lodestone_server=lodestone_server,
        lodestone_avatar_url=lodestone_avatar_url,
        gear=current_gear,
        last_sync=now,
    )
