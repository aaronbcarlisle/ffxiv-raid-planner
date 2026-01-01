"""
Loot Tracking Schemas

Pydantic schemas for loot log entries and page ledger entries.
"""

from pydantic import BaseModel, Field
from enum import Enum


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


class LootLogEntryCreate(BaseModel):
    """Request schema for creating a loot log entry"""

    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    item_slot: str  # "weapon", "head", etc.
    recipient_player_id: str
    method: LootMethodEnum
    notes: str | None = None


class LootLogEntryResponse(BaseModel):
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
    created_at: str
    created_by_user_id: str
    created_by_username: str  # Populated from join

    model_config = {"from_attributes": True}


# Page Ledger Schemas


class PageLedgerEntryCreate(BaseModel):
    """Request schema for creating a page ledger entry"""

    player_id: str
    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    book_type: str  # "I", "II", "III", "IV"
    transaction_type: TransactionTypeEnum
    quantity: int  # +1 for earned, -N for spent, 0 for missed
    notes: str | None = None


class PageLedgerEntryResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class PageBalanceResponse(BaseModel):
    """Response schema for a player's page balance"""

    player_id: str
    player_name: str
    book_I: int
    book_II: int
    book_III: int
    book_IV: int


class MarkFloorClearedRequest(BaseModel):
    """Request schema for batch marking players as having cleared a floor"""

    week_number: int = Field(..., ge=1)
    floor: str  # "M9S", "M10S", etc.
    player_ids: list[str]  # Players who cleared
    notes: str | None = None
