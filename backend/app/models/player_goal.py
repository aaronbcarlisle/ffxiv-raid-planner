"""Player Goal model - flexible goal/collection tracking for solo players."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_character import PlayerCharacter
    from .player_profile import PlayerProfile

VALID_GOAL_TYPES = frozenset({
    "collection", "mount_farm", "totem_farm", "weekly_clear",
    "personal", "gear", "raid", "custom",
})

VALID_GOAL_STATUSES = frozenset({
    "active", "completed", "paused", "abandoned",
})

COLLECTION_GOAL_TYPES = frozenset({
    "collection", "mount_farm", "totem_farm", "weekly_clear",
})


class PlayerGoal(Base):
    """Flexible goal/collection tracker owned by a player profile.

    Supports both collection hunting (mount farms, totem progress,
    weekly clears) and personal goals (checklists, gear targets,
    raid objectives). Uses goal_type to distinguish categories.

    Count-based goals use current_count/target_count.
    Boolean goals leave target_count as None.
    """

    __tablename__ = "player_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    goal_type: Mapped[str] = mapped_column(String(30), nullable=False)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active",
    )

    current_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    source_content: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_item: Mapped[str | None] = mapped_column(String(200), nullable=True)

    linked_character_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_characters.id", ondelete="SET NULL"),
        nullable=True,
    )
    linked_job: Mapped[str | None] = mapped_column(String(10), nullable=True)

    due_date: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    # Relationships
    profile: Mapped["PlayerProfile"] = relationship(
        "PlayerProfile", back_populates="goals",
    )
    linked_character: Mapped["PlayerCharacter | None"] = relationship(
        "PlayerCharacter", foreign_keys=[linked_character_id],
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerGoal(id={self.id}, title={self.title!r}, "
            f"goal_type={self.goal_type}, status={self.status})>"
        )
