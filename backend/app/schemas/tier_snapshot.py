"""Pydantic schemas for Tier Snapshots and Snapshot Players"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# --- Gear Source Categories ---

GearSourceCategory = Literal[
    "savage",    # iLv 790/795 - Raid drop gear
    "tome_up",   # iLv 790 - Augmented tomestone
    "catchup",   # iLv 780/785 - Catch-up gear (alliance raid)
    "tome",      # iLv 780 - Unaugmented tomestone
    "relic",     # iLv 770/775 - Relic weapon
    "crafted",   # iLv 770 - Crafted pentamelded
    "prep",      # iLv 770/775 - Previous tier BiS
    "normal",    # iLv 760/765 - Normal raid
    "unknown",   # Unset state
]

# --- Gear Status Schemas (reused from player) ---


# Planning markers for gear acquisition strategy
PlanningMarker = Literal[
    "craft",     # 🔨 Plan to craft
    "pages",     # 📃 Buy with pages
    "floor4",    # ♻️ Floor 4 pages
    "alliance",  # 💰 Alliance/Hunts
    "improve",   # ◀️ Improve next
    "token",     # 💾 Have token
]


class GearSlotStatus(CamelModel):
    """Gear slot status"""

    slot: str
    bis_source: Literal["raid", "tome"] = "raid"
    current_source: GearSourceCategory = "unknown"  # What's actually equipped
    has_item: bool = False
    is_augmented: bool = False
    item_name: str | None = None
    item_level: int | None = None
    item_icon: str | None = None
    item_stats: dict[str, int] | None = None
    markers: list[PlanningMarker] = Field(default_factory=list)  # Planning markers


class TomeWeaponStatus(CamelModel):
    """Tome weapon status"""

    pursuing: bool = False
    has_item: bool = False
    is_augmented: bool = False


class WeaponPriority(CamelModel):
    """Weapon priority entry"""

    job: str
    weapon_name: str | None = None
    received: bool = False
    received_date: str | None = None


# --- Linked User Info ---


class LinkedUserInfo(CamelModel):
    """Info about a user linked to a player card"""

    id: str
    discord_id: str
    discord_username: str
    discord_avatar: str | None = None
    avatar_url: str | None = None
    display_name: str | None = None


class LinkedPlayerInfo(CamelModel):
    """Info about a player card that is linked to a user"""

    player_id: str
    player_name: str
    player_job: str
    tier_id: str
    user: LinkedUserInfo


# --- Snapshot Player Schemas ---


class SnapshotPlayerCreate(CamelModel):
    """Schema for creating a snapshot player"""

    name: str = ""
    job: str = ""
    role: str = ""
    position: str | None = None
    tank_role: str | None = None
    template_role: str | None = None
    configured: bool = False
    sort_order: int = 0
    is_substitute: bool = False
    user_id: str | None = None
    notes: str | None = None
    lodestone_id: str | None = None
    bis_link: str | None = None
    fflogs_id: int | None = None
    gear: list[GearSlotStatus] | None = None
    tome_weapon: TomeWeaponStatus | None = None
    loot_adjustment: int = 0
    page_adjustments: dict[str, int] = Field(
        default_factory=lambda: {"I": 0, "II": 0, "III": 0, "IV": 0}
    )


class SnapshotPlayerUpdate(CamelModel):
    """Schema for updating a snapshot player"""

    name: str | None = None
    job: str | None = None
    role: str | None = None
    position: str | None = None
    tank_role: str | None = None
    template_role: str | None = None
    configured: bool | None = None
    sort_order: int | None = None
    is_substitute: bool | None = None
    user_id: str | None = None
    notes: str | None = None
    lodestone_id: str | None = None
    bis_link: str | None = None
    fflogs_id: int | None = None
    gear: list[GearSlotStatus] | None = None
    tome_weapon: TomeWeaponStatus | None = None
    loot_adjustment: int | None = None
    page_adjustments: dict[str, int] | None = None


class SnapshotPlayerResponse(CamelModel):
    """Schema for snapshot player response"""

    id: str
    tier_snapshot_id: str
    user_id: str | None = None
    linked_user: LinkedUserInfo | None = None
    name: str
    job: str
    role: str
    position: str | None = None
    tank_role: str | None = None
    template_role: str | None = None
    configured: bool
    sort_order: int
    is_substitute: bool
    notes: str | None = None
    lodestone_id: str | None = None
    bis_link: str | None = None
    fflogs_id: int | None = None
    last_sync: str | None = None
    gear: list[GearSlotStatus] = Field(default_factory=list)
    tome_weapon: TomeWeaponStatus = Field(default_factory=TomeWeaponStatus)
    weapon_priorities: list[WeaponPriority] = Field(default_factory=list)
    weapon_priorities_locked: bool = False
    weapon_priorities_locked_by: str | None = None
    weapon_priorities_locked_at: str | None = None
    loot_adjustment: int = 0
    page_adjustments: dict[str, int] = Field(
        default_factory=lambda: {"I": 0, "II": 0, "III": 0, "IV": 0}
    )
    created_at: str
    updated_at: str


# --- Tier Snapshot Schemas ---


class TierSnapshotCreate(CamelModel):
    """Schema for creating a tier snapshot"""

    tier_id: str = Field(..., description="Raid tier ID (e.g., 'aac-cruiserweight')")
    content_type: Literal["savage", "ultimate"] = "savage"
    is_active: bool = True


class TierSnapshotUpdate(CamelModel):
    """Schema for updating a tier snapshot"""

    is_active: bool | None = None


class TierSnapshotResponse(CamelModel):
    """Schema for tier snapshot response (without players)"""

    id: str
    static_group_id: str
    tier_id: str
    content_type: str
    is_active: bool
    player_count: int = 0
    weapon_priorities_auto_lock_date: str | None = None
    weapon_priorities_global_lock: bool = False
    weapon_priorities_global_locked_by: str | None = None
    weapon_priorities_global_locked_at: str | None = None
    current_week: int = 1
    week_start_date: str | None = None
    created_at: str
    updated_at: str


class TierSnapshotWithPlayers(CamelModel):
    """Schema for tier snapshot response with players"""

    id: str
    static_group_id: str
    tier_id: str
    content_type: str
    is_active: bool
    players: list[SnapshotPlayerResponse] = Field(default_factory=list)
    weapon_priorities_auto_lock_date: str | None = None
    weapon_priorities_global_lock: bool = False
    weapon_priorities_global_locked_by: str | None = None
    weapon_priorities_global_locked_at: str | None = None
    current_week: int = 1
    week_start_date: str | None = None
    created_at: str
    updated_at: str


# --- Weapon Priority Schemas ---


class WeaponPrioritiesUpdate(CamelModel):
    """Schema for updating a player's weapon priorities"""

    weapon_priorities: list[WeaponPriority]


class WeaponPrioritySettingsUpdate(CamelModel):
    """Schema for updating tier-level weapon priority settings"""

    weapon_priorities_auto_lock_date: str | None = None
    weapon_priorities_global_lock: bool | None = None


# --- Rollover Schemas ---


class RolloverRequest(CamelModel):
    """Schema for rollover request"""

    target_tier_id: str = Field(..., description="Target tier ID to roll over to")
    reset_gear: bool = Field(
        default=False, description="Whether to reset gear progress (keep players, clear gear)"
    )


class RolloverResponse(CamelModel):
    """Schema for rollover response"""

    source_snapshot: TierSnapshotResponse
    target_snapshot: TierSnapshotWithPlayers
    players_copied: int
