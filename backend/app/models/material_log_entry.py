"""
Material Log Entry Model

Tracks upgrade material distribution (Twine, Glaze, Solvent).
"""

from sqlalchemy import Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MaterialLogEntry(Base):
    __tablename__ = "material_log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tier_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("tier_snapshots.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(String(10), nullable=False)  # "M9S", "M10S", "M11S"
    # Material type: twine (left-side armor), glaze (accessories), solvent (weapon), universal_tomestone (weapon upgrade)
    material_type: Mapped[str] = mapped_column(
        SQLEnum("twine", "glaze", "solvent", "universal_tomestone", name="materialtype", create_type=False),
        nullable=False
    )
    recipient_player_id: Mapped[str] = mapped_column(String(36), ForeignKey("snapshot_players.id"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)  # ISO timestamp
    created_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="material_log_entries")
    recipient_player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer", back_populates="material_log_entries")
    created_by: Mapped["User"] = relationship("User")
