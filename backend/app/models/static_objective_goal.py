"""StaticObjectiveGoal model — raid/progression objectives for static groups."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User

VALID_OBJECTIVE_CATEGORIES = frozenset({
    "ultimate_clear",
    "ultimate_farm",
    "savage_bis",
    "savage_mount",
    "savage_achievement",
    "savage_alt_jobs",
    "criterion_title",
    "gil_farm",
    "loot_farm",
    "custom",
})

VALID_OBJECTIVE_PRIORITIES = frozenset({
    "required",
    "preferred",
    "optional",
    "not_doing",
})


class StaticObjectiveGoal(Base):
    """Raid and progression objectives set by a static group.

    Distinct from CollectionGoal (mount/reward farms). These represent
    static-level goals like clearing ultimates, achieving savage BiS,
    or farming specific content. Used for goal alignment matching with
    player personal goals.
    """

    __tablename__ = "static_objective_goals"

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

    category: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship(
        "StaticGroup", foreign_keys=[static_group_id],
    )
    created_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by_id],
    )

    def __repr__(self) -> str:
        return (
            f"<StaticObjectiveGoal(id={self.id}, category={self.category!r}, "
            f"priority={self.priority!r}, title={self.title!r})>"
        )
