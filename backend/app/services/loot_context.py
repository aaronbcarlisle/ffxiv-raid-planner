"""Shared loot-tracking context helpers.

Moved verbatim from `app.routers.loot_tracking` (R-PH2-B) so `services/player_overview.py`
can reuse them without importing a router module. `loot_tracking.py` re-imports these
under its original private names, so every call site there is unchanged.

Also owns the client-default priority mirror (`CLIENT_DEFAULT_PRIORITY_SETTINGS`) and
the two settings helpers built on it (`served_settings`, `effective_priority_settings`)
that let a server-side ranking agree with what the Loot tab computes client-side.
"""

from datetime import datetime, timezone

from app.models import MaterialLogEntry, SnapshotPlayer, TierSnapshot
from app.schemas.static_group import StaticSettingsSchema

# Client-side priority defaults (must match frontend/src/utils/constants.ts DEFAULT_SETTINGS).
# The Loot tab ranks with `{...DEFAULT_SETTINGS, ...group.settings}` (Loot.tsx), so a
# server-side ranking that must agree with it merges the served settings over these.
# Only the priority-relevant keys are mirrored. When changing DEFAULT_SETTINGS there,
# update this dict too. Note the role order differs from StaticSettingsSchema's own
# default (melee, ranged, caster, ...): the schema default only applies once a blob exists.
CLIENT_DEFAULT_PRIORITY_SETTINGS: dict = {
    "lootPriority": ["melee", "caster", "ranged", "tank", "healer"],
    "priorityMode": "automatic",
    "jobPriorityModifiers": None,
    "showPriorityScores": True,
    "enableEnhancedScoring": False,
}


def served_settings(raw: dict | None) -> dict:
    """The settings blob as the static-group API serves it.

    Mirrors `routers/static_groups.py` `settings_to_schema` + the response model:
    an empty or missing blob is served as `null` (the client then spreads nothing),
    so it is `{}` here; otherwise the schema fills every default and the dump keeps
    `None` values (the static-group routes use no `exclude_none`).
    A non-object blob raises `ValidationError`, never `TypeError`.
    """
    if not raw:
        return {}
    return StaticSettingsSchema.model_validate(raw).model_dump(by_alias=True)


def effective_priority_settings(raw: dict | None) -> dict:
    """The settings the client ranks with: served settings over the client defaults."""
    return {**CLIENT_DEFAULT_PRIORITY_SETTINGS, **served_settings(raw)}


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
