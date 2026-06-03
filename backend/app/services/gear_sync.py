"""Shared gear sync logic used by both manual sync endpoint and auto-sync background task."""

from dataclasses import dataclass, field
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

MIN_EXPECTED_GEAR_SLOTS = 8


@dataclass
class SyncDiagnostics:
    """Structured diagnostics for a sync attempt."""

    provider: str = "unknown"
    mode: str = "manual_sync"
    lodestone_id: int | None = None
    requested_name: str | None = None
    requested_server: str | None = None
    returned_name: str | None = None
    returned_server: str | None = None
    registered_job: str | None = None
    upstream_active_job: str | None = None
    stored_avg_ilvl: int = 0
    upstream_avg_ilvl: int = 0
    gear_slot_count: int = 0
    missing_slot_count: int = 0
    lower_slot_count: int = 0
    refresh_attempted: bool = False
    refresh_status: str | None = None
    sync_decision: str = "applied"
    warnings: list[str] = field(default_factory=list)


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
    skipped: bool = False
    skip_reason: str | None = None
    diagnostics: SyncDiagnostics | None = None


def _compute_avg_ilvl(gear: list[dict[str, Any]], key: str = "equippedItemLevel") -> int:
    slots = [g for g in gear if (g.get(key) or 0) > 0]
    if not slots:
        return 0
    return round(sum(g[key] for g in slots) / len(slots))


def _compute_slot_ilvl_map(gear: list[dict[str, Any]], key: str = "equippedItemLevel") -> dict[str, int]:
    return {
        g["slot"]: g[key]
        for g in gear
        if g.get("slot") and (g.get(key) or 0) > 0
    }


async def sync_player_gear_from_provider(
    player: SnapshotPlayer,
    lodestone_id: int,
    *,
    source_prefix: str = "",
    is_auto: bool = False,
) -> GearSyncResult:
    """Fetch gear from Lodestone/Tomestone and update a player's gear state.

    This function modifies the player object in-place but does NOT commit.
    The caller is responsible for flushing/committing the session.

    When is_auto=True, conservative safety gates are applied:
    - Job mismatch blocks sync
    - Lower item level blocks sync
    - Incomplete payload blocks sync
    - Missing upstream slots preserve stored gear
    """
    previous_gear = [dict(g) for g in _normalize_player_gear(player.gear)]
    previous_avg_ilvl = _compute_avg_ilvl(previous_gear)
    stored_slot_ilvls = _compute_slot_ilvl_map(previous_gear)

    stored_name = getattr(player, "lodestone_name", None)
    stored_server = getattr(player, "lodestone_server", None)

    diag = SyncDiagnostics(
        mode="auto_sync" if is_auto else "manual_sync",
        lodestone_id=lodestone_id,
        registered_job=player.job,
        stored_avg_ilvl=previous_avg_ilvl,
        requested_name=stored_name,
        requested_server=stored_server,
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

    diag.provider = raw_source
    diag.returned_name = str(character.get("Name") or "") or None
    diag.returned_server = str(character.get("Server") or "") or None
    diag.upstream_active_job = synced_job
    diag.gear_slot_count = len(gear_items) if isinstance(gear_items, dict) else 0

    def _make_skip_result(reason: str) -> GearSyncResult:
        diag.sync_decision = reason
        logger.info(
            "gear_sync_skipped",
            player_id=player.id,
            lodestone_id=lodestone_id,
            reason=reason,
            mode=diag.mode,
            registered_job=player.job,
            upstream_job=synced_job,
            stored_avg_ilvl=previous_avg_ilvl,
        )
        return GearSyncResult(
            updated_slots=0,
            bis_matched_count=sum(1 for s in previous_gear if s.get("hasItem")),
            payload_changed=False,
            sync_source=sync_source,
            synced_job=synced_job,
            job_mismatch_warning=None,
            lodestone_name=diag.returned_name,
            lodestone_server=diag.returned_server,
            lodestone_avatar_url=None,
            gear=previous_gear,
            last_sync=datetime.now(timezone.utc).isoformat(),
            skipped=True,
            skip_reason=reason,
            diagnostics=diag,
        )

    # --- Safety gate 1: Job mismatch ---
    player_job = player.job
    job_mismatch_warning = None
    if synced_job and player_job and synced_job.upper() != player_job.upper():
        job_mismatch_warning = (
            f"Synced gear appears to be for {synced_job}, but this player is set as "
            f"{player_job}. Lodestone may still be showing a previous gearset."
        )
        if is_auto:
            return _make_skip_result("skipped_job_mismatch")

    # --- Safety gate 2: Identity mismatch (stale/cached provider data) ---
    identity_mismatch = False
    if stored_server and diag.returned_server:
        if stored_server.lower().strip() != diag.returned_server.lower().strip():
            identity_mismatch = True
            diag.warnings.append(
                f"upstream_identity_mismatch: expected server {stored_server}, "
                f"got {diag.returned_server}"
            )
    if stored_name and diag.returned_name:
        if stored_name.lower().strip() != diag.returned_name.lower().strip():
            identity_mismatch = True
            diag.warnings.append(
                f"upstream_identity_mismatch: expected name {stored_name}, "
                f"got {diag.returned_name}"
            )
    if identity_mismatch and is_auto:
        return _make_skip_result("skipped_identity_mismatch")

    # --- Safety gate 3: Incomplete payload ---
    if isinstance(gear_items, dict) and len(gear_items) < MIN_EXPECTED_GEAR_SLOTS:
        diag.warnings.append(f"upstream_incomplete: only {len(gear_items)} slots")
        if is_auto:
            return _make_skip_result("skipped_incomplete_payload")

    _, equipped_by_slot = await _build_equipped_slots(gear_items)

    # --- Safety gate 4: Lower average item level ---
    upstream_ilvls = []
    for slot_data in equipped_by_slot.values():
        ilvl = slot_data.get("item_level") or 0
        if ilvl > 0:
            upstream_ilvls.append(ilvl)
    upstream_avg_ilvl = round(sum(upstream_ilvls) / len(upstream_ilvls)) if upstream_ilvls else 0
    diag.upstream_avg_ilvl = upstream_avg_ilvl

    if is_auto and previous_avg_ilvl > 0 and upstream_avg_ilvl > 0:
        if upstream_avg_ilvl < previous_avg_ilvl:
            return _make_skip_result("skipped_lower_item_level")

    current_gear = [dict(g) for g in previous_gear]
    updated_count = 0
    lower_slot_count = 0
    missing_slot_count = 0

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
            # --- Safety gate 5: Missing slot protection ---
            # For auto-sync, never clear stored gear when upstream omits a slot.
            if is_auto:
                missing_slot_count += 1
                continue

            gear_slot["currentSource"] = "unknown"
            gear_slot["hasItem"] = False
            gear_slot["isAugmented"] = False
            gear_slot.pop("equippedItemId", None)
            gear_slot.pop("equippedItemLevel", None)
            gear_slot.pop("equippedItemName", None)
            gear_slot.pop("equippedItemIcon", None)
        else:
            # --- Slot-level item level protection for auto-sync ---
            if is_auto:
                stored_ilvl = stored_slot_ilvls.get(slot_name, 0)
                upstream_ilvl = equipped.get("item_level") or 0
                if stored_ilvl > 0 and upstream_ilvl > 0 and upstream_ilvl < stored_ilvl:
                    lower_slot_count += 1
                    continue

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

    diag.missing_slot_count = missing_slot_count
    diag.lower_slot_count = lower_slot_count

    bis_matched_count = sum(1 for s in current_gear if s.get("hasItem"))
    payload_changed = updated_count > 0
    now = datetime.now(timezone.utc).isoformat()
    lodestone_name = str(character.get("Name") or "") or None
    lodestone_server = str(character.get("Server") or "") or None
    avatar_value = character.get("Avatar")
    existing_avatar_url = getattr(player, "lodestone_avatar_url", None)
    lodestone_avatar_url = _sanitize_avatar_url(avatar_value) or existing_avatar_url

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

    diag.sync_decision = "applied"
    if job_mismatch_warning:
        diag.warnings.append(f"job_mismatch: {synced_job} vs {player_job}")
    if missing_slot_count:
        diag.warnings.append(f"missing_upstream_slots: {missing_slot_count}")
    if lower_slot_count:
        diag.warnings.append(f"lower_slot_ilvl_preserved: {lower_slot_count}")
    if previous_avg_ilvl > 0 and upstream_avg_ilvl > 0 and upstream_avg_ilvl < previous_avg_ilvl:
        diag.warnings.append(
            f"lower_avg_ilvl: upstream {upstream_avg_ilvl} vs stored {previous_avg_ilvl}"
        )

    new_avg_ilvl = _compute_avg_ilvl(current_gear)

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
        mode=diag.mode,
        missing_slots=missing_slot_count,
        lower_slots=lower_slot_count,
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
        diagnostics=diag,
    )
