"""
Page Ledger Entry Model

Tracks earning and spending of book pages (tokens) for each player.
Source of truth for book balances.
"""

from sqlalchemy import CheckConstraint, Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PageLedgerEntry(Base):
    __tablename__ = "page_ledger_entries"
    __table_args__ = (
        CheckConstraint("week_number > 0", name="ck_page_ledger_entries_week_positive"),
    )

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

    # Write provenance (PROV-1, R-PV-1): how the row was logged and which API key
    # wrote it. NULL on rows that predate PROV-1 ("unknown origin"), and api_key_id
    # is NULL for a web write.
    logged_via: Mapped[str | None] = mapped_column(String(10), nullable=True)
    api_key_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    # Whose card this was for when the row was written (R-PV-3): the card's claimant
    # at that moment, NULL for an unclaimed card. "On behalf" is created_by_user_id
    # != recipient_user_id, derived because the card's claimant changes over time.
    recipient_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Character identity snapshot (R-PV-4), resolved like loot's: the explicit
    # registration, else an explicit name, else the card's main for this static.
    recipient_character_registration_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("static_character_registrations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recipient_character_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # "explicit" when the client named the character, "default" when the server filled
    # in the card's main (B15); NULL when nothing resolved or the row predates PROV-1.
    recipient_character_source: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="page_ledger_entries")
    player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="page_ledger_entries")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
