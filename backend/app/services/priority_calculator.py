"""
Priority Calculator Service

Python port of frontend/src/utils/priority.ts
Calculates loot priority rankings for the Dalamud plugin API.

The frontend TypeScript implementation is the source of truth for the algorithm.
This port produces identical ordering for the same well-formed inputs (as sent
by the web UI). For partial/incomplete data from API callers, the backend merges
advancedOptions with defaults to prevent KeyError — see _get_advanced_options.
"""

from __future__ import annotations

from typing import Any


# ==================== Constants (mirrored from frontend gamedata) ====================

# Slot value weights for priority calculations (from costs.ts:104-116)
SLOT_VALUE_WEIGHTS: dict[str, float] = {
    "weapon": 3.0,
    "body": 1.5,
    "legs": 1.5,
    "head": 1.0,
    "hands": 1.0,
    "feet": 1.0,
    "earring": 0.8,
    "necklace": 0.8,
    "bracelet": 0.8,
    "ring1": 0.8,
    "ring2": 0.8,
}

# Upgrade material to applicable slot mapping (from loot-tables.ts:119-123)
UPGRADE_MATERIAL_SLOTS: dict[str, list[str]] = {
    "twine": ["head", "body", "hands", "legs", "feet"],
    "glaze": ["earring", "necklace", "bracelet", "ring1", "ring2"],
    "solvent": ["weapon"],
}

# Floor loot tables (from loot-tables.ts:32-61)
FLOOR_GEAR_DROPS: dict[int, list[str]] = {
    1: ["earring", "necklace", "bracelet", "ring"],
    2: ["head", "hands", "feet"],
    3: ["body", "legs"],
    4: ["weapon"],
}

FLOOR_UPGRADE_MATERIALS: dict[int, list[str]] = {
    1: [],
    2: ["glaze", "universal_tomestone"],
    3: ["twine", "solvent"],
    4: [],
}

# Default advanced options (from types/index.ts:280-294)
DEFAULT_ADVANCED_OPTIONS: dict[str, Any] = {
    "showPriorityScores": True,
    "preset": "balanced",
    "enableEnhancedFairness": False,
    "droughtBonusMultiplier": 10,
    "droughtBonusCapWeeks": 5,
    "balancePenaltyMultiplier": 15,
    "balancePenaltyCapDrops": 3,
    "useMultipliers": True,
    "rolePriorityMultiplier": 25,
    "gearNeededMultiplier": 10,
    "lootReceivedPenalty": 15,
    "useWeightedNeed": True,
    "useLootAdjustments": True,
}


# ==================== Helper functions ====================


def _get_advanced_options(settings: dict) -> dict:
    """Get advanced options from settings with defaults.

    The frontend uses all-or-nothing semantics:
      settings.prioritySettings?.advancedOptions || DEFAULT_ADVANCED_OPTIONS
    which means a partial object is used as-is (no merge).

    The backend intentionally merges with defaults to guard against KeyError on
    partial dicts from older clients or API callers. For well-formed data from the
    web UI, the result is identical since all keys are always present.
    Falls back to defaults if advancedOptions is missing, empty, or not a dict.
    """
    priority_settings = settings.get("prioritySettings") or {}
    advanced = priority_settings.get("advancedOptions")
    if advanced and isinstance(advanced, dict):
        # Merge with defaults so missing keys don't cause KeyError
        return {**DEFAULT_ADVANCED_OPTIONS, **advanced}
    return dict(DEFAULT_ADVANCED_OPTIONS)


def _get_effective_priority_mode(settings: dict) -> str:
    """Get the effective priority mode from settings.

    Prefers new prioritySettings.mode over legacy priorityMode.
    """
    priority_settings = settings.get("prioritySettings") or {}
    if priority_settings.get("mode"):
        return priority_settings["mode"]
    return settings.get("priorityMode") or "automatic"


def requires_augmentation(slot: dict) -> bool:
    """Check if a BiS slot requires augmentation to be complete.

    Port of calculations.ts:requiresAugmentation
    """
    bis_source = slot.get("bisSource")
    if not bis_source:
        return False
    if bis_source != "tome":
        return False

    item_name = slot.get("itemName")
    if item_name:
        name = item_name.lower()
        return name.startswith("aug.") or name.startswith("augmented")

    # 'tome' bisSource with no item name - assume augmented is target
    return True


def _is_slot_complete(slot: dict) -> bool:
    """Check if a gear slot is complete (BiS achieved).

    Port of calculations.ts:isSlotComplete
    """
    bis_source = slot.get("bisSource")
    if not bis_source:
        return False
    if not slot.get("hasItem"):
        return False
    if bis_source == "raid":
        return True
    if bis_source == "base_tome":
        return True
    if bis_source == "crafted":
        return True
    if not requires_augmentation(slot):
        return True
    return slot.get("isAugmented", False)


# ==================== Priority calculation functions ====================


def _calculate_job_based_priority(player: dict, settings: dict) -> float:
    """Calculate job-based priority for a player.

    Port of priority.ts:calculateJobBasedPriority
    """
    priority_settings = settings.get("prioritySettings") or {}
    job_config = priority_settings.get("jobBasedConfig")
    if not job_config:
        return 0

    player_job = (player.get("job") or "").upper()
    jobs_list = job_config.get("jobs", [])
    groups_list = job_config.get("groups", [])

    # Find the job entry
    job_entry = None
    for j in jobs_list:
        if (j.get("job") or "").upper() == player_job:
            job_entry = j
            break
    if not job_entry:
        return 0

    # Find the group
    group = None
    for g in groups_list:
        if g.get("id") == job_entry.get("groupId"):
            group = g
            break
    if not group:
        return 0

    # Calculate priority
    max_group_sort = max((g.get("sortOrder", 0) for g in groups_list), default=0)
    group_priority = (max_group_sort - group.get("sortOrder", 0) + 1) * 50

    jobs_in_group = [j for j in jobs_list if j.get("groupId") == job_entry.get("groupId")]
    max_job_sort = max((j.get("sortOrder", 0) for j in jobs_in_group), default=0)
    job_order_bonus = (max_job_sort - job_entry.get("sortOrder", 0)) * 5

    return group.get("basePriority", 0) + group_priority + job_order_bonus + job_entry.get("priorityOffset", 0)


def _calculate_player_based_priority(player: dict, settings: dict) -> float:
    """Calculate player-based priority for a player.

    Port of priority.ts:calculatePlayerBasedPriority
    """
    priority_settings = settings.get("prioritySettings") or {}
    player_config = priority_settings.get("playerBasedConfig")
    if not player_config:
        return 0

    player_id = player.get("id")
    players_list = player_config.get("players", [])
    groups_list = player_config.get("groups", [])

    # Find the player entry
    player_entry = None
    for p in players_list:
        if p.get("playerId") == player_id:
            player_entry = p
            break
    if not player_entry:
        return 0

    # Find the group
    group = None
    for g in groups_list:
        if g.get("id") == player_entry.get("groupId"):
            group = g
            break
    if not group:
        return 0

    # Calculate priority
    max_group_sort = max((g.get("sortOrder", 0) for g in groups_list), default=0)
    group_priority = (max_group_sort - group.get("sortOrder", 0) + 1) * 50

    players_in_group = [p for p in players_list if p.get("groupId") == player_entry.get("groupId")]
    max_player_sort = max((p.get("sortOrder", 0) for p in players_in_group), default=0)
    player_order_bonus = (max_player_sort - player_entry.get("sortOrder", 0)) * 5

    return group.get("basePriority", 0) + group_priority + player_order_bonus + player_entry.get("priorityOffset", 0)


def calculate_priority_score(player: dict, settings: dict) -> int:
    """Calculate overall priority score for a player.

    Higher score = higher priority for loot.

    Port of priority.ts:calculatePriorityScore (lines 154-238)
    """
    mode = _get_effective_priority_mode(settings)

    # Disabled/Manual Planning mode: all players have equal priority
    if mode in ("disabled", "manual-planning"):
        return 0

    # Job-based mode
    if mode == "job-based":
        score = _calculate_job_based_priority(player, settings)
        advanced = _get_advanced_options(settings)

        loot_adj = player.get("lootAdjustment") or 0
        if loot_adj and advanced.get("useLootAdjustments", True):
            loot_multiplier = (
                advanced["lootReceivedPenalty"]
                if advanced.get("useMultipliers", True)
                else DEFAULT_ADVANCED_OPTIONS["lootReceivedPenalty"]
            )
            score += loot_adj * loot_multiplier
        return round(score)

    # Player-based mode
    if mode == "player-based":
        score = _calculate_player_based_priority(player, settings)
        advanced = _get_advanced_options(settings)

        loot_adj = player.get("lootAdjustment") or 0
        if loot_adj and advanced.get("useLootAdjustments", True):
            loot_multiplier = (
                advanced["lootReceivedPenalty"]
                if advanced.get("useMultipliers", True)
                else DEFAULT_ADVANCED_OPTIONS["lootReceivedPenalty"]
            )
            score += loot_adj * loot_multiplier
        return round(score)

    # Role-based mode (default, 'automatic', 'manual')
    advanced = _get_advanced_options(settings)

    priority_settings = settings.get("prioritySettings") or {}
    role_based_config = priority_settings.get("roleBasedConfig") or {}
    role_order = role_based_config.get("roleOrder") or settings.get("lootPriority") or []
    player_role = player.get("role", "")
    role_index = role_order.index(player_role) if player_role in role_order else -1

    # Role priority
    role_priority_multiplier = (
        advanced["rolePriorityMultiplier"]
        if advanced.get("useMultipliers", True)
        else DEFAULT_ADVANCED_OPTIONS["rolePriorityMultiplier"]
    )
    role_priority = 0 if role_index == -1 else (5 - role_index) * role_priority_multiplier

    # Weighted need
    gear = player.get("gear", [])
    weighted_need_raw = sum(
        SLOT_VALUE_WEIGHTS.get(g.get("slot", ""), 1)
        for g in gear
        if not _is_slot_complete(g)
    )
    weighted_need = weighted_need_raw if advanced.get("useWeightedNeed", True) else 0

    # Gear multiplier
    gear_multiplier = (
        advanced["gearNeededMultiplier"]
        if advanced.get("useMultipliers", True)
        else DEFAULT_ADVANCED_OPTIONS["gearNeededMultiplier"]
    )

    # Job modifier
    job_modifiers = settings.get("jobPriorityModifiers") or {}
    job_modifier = job_modifiers.get((player.get("job") or "").upper(), 0)

    # Player modifier
    player_modifier = player.get("priorityModifier") or 0

    score = round(role_priority + weighted_need * gear_multiplier + job_modifier + player_modifier)

    # Loot adjustment
    loot_adj = player.get("lootAdjustment") or 0
    if loot_adj and advanced.get("useLootAdjustments", True):
        loot_multiplier = (
            advanced["lootReceivedPenalty"]
            if advanced.get("useMultipliers", True)
            else DEFAULT_ADVANCED_OPTIONS["lootReceivedPenalty"]
        )
        score += loot_adj * loot_multiplier

    return score


def _sort_priority_entries(entries: list[dict]) -> list[dict]:
    """Sort priority entries by score (desc), then name (asc) for ties.

    Note: Uses Python string ordering for tie-breaking. The frontend uses
    localeCompare, which may differ for non-ASCII names. Both produce stable
    deterministic ordering; in practice FFXIV character names are ASCII.
    """
    return sorted(entries, key=lambda e: (-e["score"], e["playerName"]))


def get_priority_for_item(
    players: list[dict],
    slot: str,
    settings: dict,
) -> list[dict]:
    """Get priority list for a specific gear slot.

    Port of priority.ts:getPriorityForItem (lines 346-367)
    """
    entries = []
    for p in players:
        gear = p.get("gear", [])
        slot_gear = next((g for g in gear if g.get("slot") == slot), None)
        if slot_gear and slot_gear.get("bisSource") == "raid" and not slot_gear.get("hasItem"):
            entries.append({
                "playerId": p["id"],
                "playerName": p.get("name", ""),
                "job": p.get("job", ""),
                "score": calculate_priority_score(p, settings),
            })

    return _sort_priority_entries(entries)


def get_priority_for_ring(
    players: list[dict],
    settings: dict,
) -> list[dict]:
    """Get priority list for ring drops (either ring1 or ring2).

    Port of priority.ts:getPriorityForRing (lines 373-393)
    """
    entries = []
    for p in players:
        gear = p.get("gear", [])
        ring1 = next((g for g in gear if g.get("slot") == "ring1"), None)
        ring2 = next((g for g in gear if g.get("slot") == "ring2"), None)
        needs_ring1 = ring1 and ring1.get("bisSource") == "raid" and not ring1.get("hasItem")
        needs_ring2 = ring2 and ring2.get("bisSource") == "raid" and not ring2.get("hasItem")

        if needs_ring1 or needs_ring2:
            entries.append({
                "playerId": p["id"],
                "playerName": p.get("name", ""),
                "job": p.get("job", ""),
                "score": calculate_priority_score(p, settings),
            })

    return _sort_priority_entries(entries)


def get_priority_for_upgrade_material(
    players: list[dict],
    material: str,
    settings: dict,
    material_log: list[dict] | None = None,
) -> list[dict]:
    """Get priority list for upgrade material (twine/glaze/solvent).

    Port of priority.ts:getPriorityForUpgradeMaterial (lines 409-502)
    """
    applicable_slots = UPGRADE_MATERIAL_SLOTS.get(material, [])

    # Count received materials without a recorded slot
    received_counts: dict[str, int] = {}
    if material_log:
        for entry in material_log:
            if entry.get("materialType") == material and not entry.get("slotAugmented"):
                pid = entry.get("recipientPlayerId", "")
                received_counts[pid] = received_counts.get(pid, 0) + 1

    entries = []
    for p in players:
        gear = p.get("gear", [])

        # Count unaugmented tome pieces for this material type
        unaugmented = [
            g for g in gear
            if g.get("slot") in applicable_slots
            and g.get("bisSource") == "tome"
            and g.get("hasItem")
            and not g.get("isAugmented")
            and requires_augmentation(g)
        ]

        unaugmented_count = len(unaugmented)

        # For solvent, also check tome weapon (needs augmentation)
        if material == "solvent":
            tome_weapon = p.get("tomeWeapon") or {}
            if tome_weapon.get("pursuing") and tome_weapon.get("hasItem") and not tome_weapon.get("isAugmented"):
                unaugmented_count += 1

        # Subtract already-received
        received = received_counts.get(p["id"], 0)
        if unaugmented_count - received <= 0:
            continue

        effective_need = max(0, unaugmented_count - received)

        advanced = _get_advanced_options(settings)
        loot_penalty = (
            advanced["lootReceivedPenalty"]
            if advanced.get("useMultipliers", True)
            else DEFAULT_ADVANCED_OPTIONS["lootReceivedPenalty"]
        )

        entries.append({
            "playerId": p["id"],
            "playerName": p.get("name", ""),
            "job": p.get("job", ""),
            "score": calculate_priority_score(p, settings) + effective_need * loot_penalty,
        })

    return _sort_priority_entries(entries)


def get_priority_for_universal_tomestone(
    players: list[dict],
    settings: dict,
    material_log: list[dict] | None = None,
) -> list[dict]:
    """Get priority list for Universal Tomestone.

    Port of priority.ts:getPriorityForUniversalTomestone (lines 514-552)
    """
    # Count received universal tomestones
    received_counts: dict[str, int] = {}
    if material_log:
        for entry in material_log:
            if entry.get("materialType") == "universal_tomestone":
                pid = entry.get("recipientPlayerId", "")
                received_counts[pid] = received_counts.get(pid, 0) + 1

    entries = []
    for p in players:
        tome_weapon = p.get("tomeWeapon") or {}
        needs_tome_weapon = tome_weapon.get("pursuing") and not tome_weapon.get("hasItem")

        if not needs_tome_weapon:
            continue

        # Only need 1 per player
        received = received_counts.get(p["id"], 0)
        if received > 0:
            continue

        entries.append({
            "playerId": p["id"],
            "playerName": p.get("name", ""),
            "job": p.get("job", ""),
            "score": calculate_priority_score(p, settings),
        })

    return _sort_priority_entries(entries)


def calculate_floor_priority(
    players: list[dict],
    floor: int,
    settings: dict,
    material_log: list[dict] | None = None,
) -> dict[str, list[dict]]:
    """Calculate priority for all drops on a given floor.

    Returns a dict mapping drop type (slot name or material name) to priority list.
    """
    result: dict[str, list[dict]] = {}

    # Gear drops
    gear_drops = FLOOR_GEAR_DROPS.get(floor, [])
    for slot in gear_drops:
        if slot == "ring":
            result["ring"] = get_priority_for_ring(players, settings)
        else:
            result[slot] = get_priority_for_item(players, slot, settings)

    # Upgrade material drops
    material_drops = FLOOR_UPGRADE_MATERIALS.get(floor, [])
    for material in material_drops:
        if material == "universal_tomestone":
            result["universal_tomestone"] = get_priority_for_universal_tomestone(
                players, settings, material_log
            )
        else:
            result[material] = get_priority_for_upgrade_material(
                players, material, settings, material_log
            )

    return result


def calculate_all_floors_priority(
    players: list[dict],
    settings: dict,
    material_log: list[dict] | None = None,
) -> dict[str, dict[str, list[dict]]]:
    """Calculate priority for all 4 floors.

    Returns {"floor1": {...}, "floor2": {...}, "floor3": {...}, "floor4": {...}}
    """
    return {
        f"floor{floor}": calculate_floor_priority(players, floor, settings, material_log)
        for floor in range(1, 5)
    }
