"""
Loot Tracking Schemas

Pydantic schemas for loot log entries and page ledger entries.
"""

from pydantic import BaseModel, ConfigDict, Field
from enum import Enum


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase (preserves uppercase like Roman numerals)"""
    components = string.split("_")
    # Capitalize first letter only, preserve rest (e.g., "II" -> "II", not "Ii")
    return components[0] + "".join(x[0].upper() + x[1:] if x else "" for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase conversion for API responses"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,  # Ensure JSON output uses camelCase
    )


class LootMethodEnum(str, Enum):
    """How the loot was obtained"""

    DROP = "drop"
    BOOK = "book"
    TOME = "tome"


class TransactionTypeEnum(str, Enum):
    """Type of page ledger transaction"""

    EARNED = "earned"
    SPENT = "spent"
    MISSED = "missed"
    ADJUSTMENT = "adjustment"


# Loot Log Schemas


class LootLogEntryCreate(CamelModel):
    """Request schema for creating a loot log entry"""

    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    item_slot: str  # "weapon", "head", etc.
    recipient_player_id: str
    method: LootMethodEnum
    notes: str | None = None
    weapon_job: str | None = None  # "DRG", "WHM", etc. for weapon slots
    is_extra: bool = False  # True if extra/off-job loot


class LootLogEntryUpdate(CamelModel):
    """Request schema for updating a loot log entry"""

    week_number: int | None = Field(None, ge=1)
    floor: str | None = None
    item_slot: str | None = None
    recipient_player_id: str | None = None
    method: LootMethodEnum | None = None
    notes: str | None = None
    weapon_job: str | None = None
    is_extra: bool | None = None


class LootLogEntryResponse(CamelModel):
    """Response schema for a loot log entry"""

    id: int
    tier_snapshot_id: str
    week_number: int
    floor: str
    item_slot: str
    recipient_player_id: str
    recipient_player_name: str  # Populated from join
    method: str
    notes: str | None
    weapon_job: str | None  # "DRG", "WHM", etc. for weapon slots
    is_extra: bool  # True if extra/off-job loot
    created_at: str
    created_by_user_id: str
    created_by_username: str  # Populated from join

    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)


# Page Ledger Schemas


class PageLedgerEntryCreate(CamelModel):
    """Request schema for creating a page ledger entry"""

    player_id: str
    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    book_type: str  # "I", "II", "III", "IV"
    transaction_type: TransactionTypeEnum
    quantity: int  # +1 for earned, -N for spent, 0 for missed
    notes: str | None = None


class PageLedgerEntryResponse(CamelModel):
    """Response schema for a page ledger entry"""

    id: int
    tier_snapshot_id: str
    player_id: str
    player_name: str  # Populated from join
    week_number: int
    floor: str
    book_type: str
    transaction_type: str
    quantity: int
    notes: str | None
    created_at: str
    created_by_user_id: str
    created_by_username: str  # Populated from join

    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)


class PageBalanceResponse(CamelModel):
    """Response schema for a player's page balance"""

    player_id: str
    player_name: str
    book_I: int
    book_II: int
    book_III: int
    book_IV: int


class MarkFloorClearedRequest(CamelModel):
    """Request schema for batch marking players as having cleared a floor"""

    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    player_ids: list[str]  # Players who cleared
    notes: str | None = None


# Material Log Schemas


class MaterialTypeEnum(str, Enum):
    """Type of upgrade material"""

    TWINE = "twine"  # Left-side armor augmentation
    GLAZE = "glaze"  # Accessory augmentation
    SOLVENT = "solvent"  # Weapon augmentation
    UNIVERSAL_TOMESTONE = "universal_tomestone"  # Tome weapon upgrade


class MaterialLogEntryCreate(CamelModel):
    """Request schema for creating a material log entry"""

    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", "M11S" (floors that drop materials)
    material_type: MaterialTypeEnum
    recipient_player_id: str
    method: LootMethodEnum = LootMethodEnum.DROP
    # Which slot was augmented (null for universal_tomestone which marks tome weapon as "have")
    # Values: "weapon", "head", "body", etc., or "tome_weapon" for solvent augmenting tome weapon
    slot_augmented: str | None = None
    notes: str | None = None


class MaterialLogEntryUpdate(CamelModel):
    """Request schema for updating a material log entry"""

    week_number: int | None = Field(None, ge=1)
    floor: str | None = None
    material_type: MaterialTypeEnum | None = None
    recipient_player_id: str | None = None
    method: LootMethodEnum | None = None
    slot_augmented: str | None = None
    notes: str | None = None


class MaterialLogEntryResponse(CamelModel):
    """Response schema for a material log entry"""

    id: int
    tier_snapshot_id: str
    week_number: int
    floor: str
    material_type: str
    recipient_player_id: str
    recipient_player_name: str  # Populated from join
    method: str
    slot_augmented: str | None  # Which slot was augmented (null for universal_tomestone)
    notes: str | None
    created_at: str
    created_by_user_id: str
    created_by_username: str  # Populated from join

    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)


class MaterialBalanceResponse(CamelModel):
    """Response schema for a player's material received count"""

    player_id: str
    player_name: str
    twine: int  # Total twine received
    glaze: int  # Total glaze received
    solvent: int  # Total solvent received
    universal_tomestone: int  # Total universal tomestones received


class WeekOperationResponse(CamelModel):
    """Response schema for week management operations (start-next-week, revert-week)"""

    current_week: int
    week_start_date: str
