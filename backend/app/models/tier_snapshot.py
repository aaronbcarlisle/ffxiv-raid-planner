"""Tier Snapshot model - per-tier roster state for a static group"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .snapshot_player import SnapshotPlayer
    from .static_group import StaticGroup


class TierSnapshot(Base):
    """
    Tier Snapshot - represents a roster state for a specific raid tier.

    Each static group can have multiple tier snapshots (one per raid tier),
    allowing the roster to change between tiers while preserving history.
    """

    __tablename__ = "tier_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Which static group this snapshot belongs to
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Which raid tier this snapshot is for (e.g., "aac-cruiserweight", "aac-light-heavyweight")
    tier_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Content type for future ultimate support
    content_type: Mapped[str] = mapped_column(String(20), nullable=False, default="savage")

    # Whether this is the currently active tier for the group
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", back_populates="tier_snapshots")
    players: Mapped[list["SnapshotPlayer"]] = relationship(
        "SnapshotPlayer",
        back_populates="tier_snapshot",
        cascade="all, delete-orphan",
        order_by="SnapshotPlayer.sort_order",
    )

    # Unique constraint: one snapshot per tier per group
    __table_args__ = (
        UniqueConstraint("static_group_id", "tier_id", name="uq_group_tier"),
    )

    @property
    def player_count(self) -> int:
        """Get count of configured players"""
        if not self.players:
            return 0
        return sum(1 for p in self.players if p.configured)

    def __repr__(self) -> str:
        return f"<TierSnapshot(id={self.id}, tier_id={self.tier_id}, static_group_id={self.static_group_id})>"
