"""
Loot Log Entry Model

Tracks individual loot drops and how they were obtained.
"""

from sqlalchemy import Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class LootMethod(str, enum.Enum):
    DROP = "drop"  # Direct drop from boss
    BOOK = "book"  # Purchased with books
    TOME = "tome"  # Purchased with tomestones


class LootLogEntry(Base):
    __tablename__ = "loot_log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier_snapshot_id: Mapped[int] = mapped_column(Integer, ForeignKey("tier_snapshots.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", etc.
    item_slot: Mapped[str] = mapped_column(String(20), nullable=False)  # "weapon", "head", etc.
    recipient_player_id: Mapped[int] = mapped_column(Integer, ForeignKey("snapshot_players.id"), nullable=False)
    method: Mapped[str] = mapped_column(SQLEnum(LootMethod), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)  # ISO timestamp
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="loot_log_entries")
    recipient_player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="loot_log_entries")
    created_by: Mapped["User"] = relationship("User")
