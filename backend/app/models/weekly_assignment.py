"""
Weekly Assignment Model

Tracks pre-planned loot assignments for Manual Planning mode.
Allows leads/owners to assign specific players to specific loot slots per week.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WeeklyAssignment(Base):
    """
    Weekly loot assignment for Manual Planning mode.

    Represents a pre-planned assignment of a player to a specific loot slot
    for a given week and floor. Multiple players can be assigned to the same
    slot (in priority order via sort_order).
    """

    __tablename__ = "weekly_assignments"
    __table_args__ = (
        UniqueConstraint(
            "static_group_id",
            "tier_id",
            "week",
            "floor",
            "slot",
            "player_id",
            name="uq_weekly_assignment_slot_player",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("static_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tier_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g., "aac-lightweight"
    week: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # "M9S", "M10S", etc.
    slot: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "head", "body", "twine", etc.
    player_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("snapshot_players.id", ondelete="SET NULL"),
        nullable=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    did_not_drop: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship(
        "StaticGroup", foreign_keys=[static_group_id]
    )
    player: Mapped["SnapshotPlayer"] = relationship(
        "SnapshotPlayer", foreign_keys=[player_id]
    )

    def __repr__(self) -> str:
        return (
            f"<WeeklyAssignment(id={self.id}, tier={self.tier_id}, "
            f"week={self.week}, floor={self.floor}, slot={self.slot})>"
        )
