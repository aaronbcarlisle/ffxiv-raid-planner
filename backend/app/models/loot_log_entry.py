"""
Loot Log Entry Model

Tracks individual loot drops and how they were obtained.
"""

from sqlalchemy import CheckConstraint, Integer, String, Text, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .static_character_registration import StaticCharacterRegistration


class LootLogEntry(Base):
    __tablename__ = "loot_log_entries"
    __table_args__ = (
        CheckConstraint("week_number > 0", name="ck_loot_log_entries_week_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("tier_snapshots.id"), nullable=False, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", etc.
    item_slot: Mapped[str] = mapped_column(String(20), nullable=False)  # "weapon", "head", etc.
    recipient_player_id: Mapped[str] = mapped_column(String(36), ForeignKey("snapshot_players.id"), nullable=False, index=True)
    # Use explicit string values to match PostgreSQL enum (avoids Python enum name vs value issue)
    method: Mapped[str] = mapped_column(
        SQLEnum("drop", "book", "tome", "purchase", name="lootmethod", create_type=False),
        nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    weapon_job: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "DRG", "WHM", etc. for weapon slots
    is_extra: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True if extra/off-job loot
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

    # Optional character identity snapshot (from StaticCharacterRegistration)
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
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="loot_log_entries")
    recipient_player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="loot_log_entries")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    recipient_character_registration: Mapped["StaticCharacterRegistration | None"] = relationship(
        "StaticCharacterRegistration", foreign_keys=[recipient_character_registration_id]
    )
