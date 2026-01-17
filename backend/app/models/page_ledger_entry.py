"""
Page Ledger Entry Model

Tracks earning and spending of book pages (tokens) for each player.
Source of truth for book balances.
"""

from sqlalchemy import Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PageLedgerEntry(Base):
    __tablename__ = "page_ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("tier_snapshots.id"), nullable=False, index=True)
    player_id: Mapped[str] = mapped_column(String(36), ForeignKey("snapshot_players.id"), nullable=False, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", etc.
    book_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "I", "II", "III", "IV"
    # Use explicit string values to match PostgreSQL enum (avoids Python enum name vs value issue)
    transaction_type: Mapped[str] = mapped_column(
        SQLEnum("earned", "spent", "missed", "adjustment", name="transactiontype", create_type=False),
        nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # +1 (earned), -N (spent), 0 (missed)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)  # ISO timestamp
    created_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="page_ledger_entries")
    player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="page_ledger_entries")
    created_by: Mapped["User"] = relationship("User")
