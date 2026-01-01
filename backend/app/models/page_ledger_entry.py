"""
Page Ledger Entry Model

Tracks earning and spending of book pages (tokens) for each player.
Source of truth for book balances.
"""

from sqlalchemy import Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class TransactionType(str, enum.Enum):
    EARNED = "earned"  # Got book from clearing floor
    SPENT = "spent"  # Spent books to purchase gear
    MISSED = "missed"  # Marked present but didn't get book (e.g., duplicate role in PF)
    ADJUSTMENT = "adjustment"  # Manual correction


class PageLedgerEntry(Base):
    __tablename__ = "page_ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier_snapshot_id: Mapped[int] = mapped_column(Integer, ForeignKey("tier_snapshots.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("snapshot_players.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", etc.
    book_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "I", "II", "III", "IV"
    transaction_type: Mapped[str] = mapped_column(SQLEnum(TransactionType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # +1 (earned), -N (spent), 0 (missed)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)  # ISO timestamp
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="page_ledger_entries")
    player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="page_ledger_entries")
    created_by: Mapped["User"] = relationship("User")
