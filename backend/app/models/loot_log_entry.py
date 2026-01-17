"""
Loot Log Entry Model

Tracks individual loot drops and how they were obtained.
"""

from sqlalchemy import Integer, String, Text, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class LootLogEntry(Base):
    __tablename__ = "loot_log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("tier_snapshots.id"), nullable=False, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", etc.
    item_slot: Mapped[str] = mapped_column(String(20), nullable=False)  # "weapon", "head", etc.
    recipient_player_id: Mapped[str] = mapped_column(String(36), ForeignKey("snapshot_players.id"), nullable=False, index=True)
    # Use explicit string values to match PostgreSQL enum (avoids Python enum name vs value issue)
    method: Mapped[str] = mapped_column(
        SQLEnum("drop", "book", "tome", name="lootmethod", create_type=False),
        nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    weapon_job: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "DRG", "WHM", etc. for weapon slots
    is_extra: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True if extra/off-job loot
    created_at: Mapped[str] = mapped_column(Text, nullable=False)  # ISO timestamp
    created_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="loot_log_entries")
    recipient_player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="loot_log_entries")
    created_by: Mapped["User"] = relationship("User")
