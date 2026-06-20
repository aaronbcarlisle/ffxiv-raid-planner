"""CollectionGoal model — static-group-level collection/farm goals"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User

# Reward types — what is being tracked
COLLECTION_GOAL_TYPES = frozenset({
    "mount", "token", "minion", "orchestrion", "glam", "custom_reward",
    "weapon", "weapon_coffer", "title", "clear_count",
})
COLLECTION_GOAL_STATUSES = frozenset({"wanted", "farming", "scheduled", "complete"})

# Content types — where the reward comes from
COLLECTION_CONTENT_TYPES = frozenset({
    "extreme", "savage", "ultimate", "criterion",
    "chaotic_alliance", "field_operation", "custom",
})


class CollectionGoal(Base):
    __tablename__ = "collection_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("static_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    goal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    content_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="wanted")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    linked_duty_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linked_reward_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    priority_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    completed_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<CollectionGoal(group={self.static_group_id!r}, title={self.title!r}, type={self.goal_type})>"
