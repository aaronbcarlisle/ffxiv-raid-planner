"""Snapshot Player model - player within a tier snapshot"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .tier_snapshot import TierSnapshot
    from .user import User


class SnapshotPlayer(Base):
    """
    Snapshot Player - represents a player slot within a tier snapshot.

    Similar to the legacy Player model but linked to TierSnapshot instead of Static.
    Optionally links to a User account for self-service editing.
    """

    __tablename__ = "snapshot_players"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Which tier snapshot this player belongs to
    tier_snapshot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tier_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Optional link to user account (for self-service editing)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Player info
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    job: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    position: Mapped[str | None] = mapped_column(String(5), nullable=True)  # T1, H2, M1, etc.
    tank_role: Mapped[str | None] = mapped_column(String(5), nullable=True)  # MT, OT
    template_role: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Expected role for slot
    configured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_substitute: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # External links
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lodestone_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bis_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    fflogs_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_sync: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Gear tracking (JSON arrays/objects)
    gear: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tome_weapon: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    tier_snapshot: Mapped["TierSnapshot"] = relationship("TierSnapshot", back_populates="players")
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<SnapshotPlayer(id={self.id}, name={self.name}, job={self.job})>"
