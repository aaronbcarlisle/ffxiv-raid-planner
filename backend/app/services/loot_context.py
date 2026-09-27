"""Shared loot-tracking context helpers.

Moved verbatim from `app.routers.loot_tracking` (R-PH2-B) so `services/player_overview.py`
can reuse them without importing a router module. `loot_tracking.py` re-imports these
under its original private names, so every call site there is unchanged.
"""

from datetime import datetime, timezone

from app.models import MaterialLogEntry, SnapshotPlayer, TierSnapshot

# Tier ID to floor names mapping (must match frontend/src/gamedata/raid-tiers.ts).
# When adding a new tier, update both this dict and the frontend raid-tiers.ts.
# Unknown tiers fall back to generic ["F1S", "F2S", "F3S", "F4S"] names.
TIER_FLOOR_NAMES: dict[str, list[str]] = {
    "aac-heavyweight": ["M9S", "M10S", "M11S", "M12S"],
    "aac-cruiserweight": ["M5S", "M6S", "M7S", "M8S"],
    "aac-light-heavyweight": ["M1S", "M2S", "M3S", "M4S"],
    "anabaseios": ["P9S", "P10S", "P11S", "P12S"],
}


def tier_floor_names(tier_id: str) -> list[str]:
    """Floor names for a tier id, falling back to generic F1S…F4S names."""
    return TIER_FLOOR_NAMES.get(tier_id, [f"F{i}S" for i in range(1, 5)])


def calculate_week_number(tier: TierSnapshot) -> int:
    """Calculate current week number based on tier start date"""
    start_date_str = tier.week_start_date or tier.created_at
    start_date = datetime.fromisoformat(start_date_str)
    now = datetime.now(timezone.utc)
    weeks_since_start = (now - start_date).days // 7
    return weeks_since_start + 1


def player_to_priority_dict(player: SnapshotPlayer) -> dict:
    """Convert a SnapshotPlayer ORM model to a dict matching the TypeScript SnapshotPlayer shape.

    Note: weaponPriorities is omitted because the priority calculator only uses gear slots,
    role, job, and loot adjustment — weapon priorities are a UI-only concern for weapon drops.
    """
    return {
        "id": player.id,
        "name": player.name,
        "job": player.job,
        "role": player.role,
        "position": player.position,
        "gear": player.gear or [],
        "tomeWeapon": player.tome_weapon or {},
        "lootAdjustment": player.loot_adjustment or 0,
        "priorityModifier": player.priority_modifier or 0,
        "configured": player.configured,
        "isSubstitute": player.is_substitute,
    }


def material_entry_to_priority_dict(entry: MaterialLogEntry) -> dict:
    """Convert a MaterialLogEntry ORM model to a dict for the priority calculator."""
    return {
        "materialType": entry.material_type,
        "recipientPlayerId": entry.recipient_player_id,
        "slotAugmented": entry.slot_augmented,
    }
