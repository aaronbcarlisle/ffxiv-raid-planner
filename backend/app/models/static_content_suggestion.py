"""StaticContentSuggestion and StaticContentSuggestionVote models."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User
    from .static_objective_goal import StaticObjectiveGoal

VALID_SUGGESTION_CATEGORIES = frozenset({
    "ultimate_clear",
    "ultimate_farm",
    "savage_bis",
    "savage_mount",
    "savage_achievement",
    "savage_alt_jobs",
    "criterion_title",
    "gil_farm",
    "loot_farm",
    "mount_farm",
    "custom",
})

VALID_SUGGESTION_STATUSES = frozenset({
    "open",
    "promoted",
    "closed",
    "rejected",
})

VALID_VOTE_VALUES = frozenset({
    "must_have",
    "want",
    "willing",
    "not_interested",
    "avoid",
})


class StaticContentSuggestion(Base):
    """Member-proposed content suggestion for a static group.

    Not an official static goal — these are informal proposals that members
    can vote on. Leads/owners can promote them to StaticObjectiveGoal.
    """

    __tablename__ = "static_content_suggestions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("static_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    suggested_by_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    promoted_goal_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("static_objective_goals.id", ondelete="SET NULL"),
        nullable=True,
    )

    category: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id], back_populates="content_suggestions")
    suggested_by: Mapped["User"] = relationship("User", foreign_keys=[suggested_by_user_id])
    promoted_goal: Mapped["StaticObjectiveGoal | None"] = relationship(
        "StaticObjectiveGoal", foreign_keys=[promoted_goal_id]
    )
    votes: Mapped[list["StaticContentSuggestionVote"]] = relationship(
        "StaticContentSuggestionVote", back_populates="suggestion", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<StaticContentSuggestion(id={self.id}, category={self.category!r}, "
            f"status={self.status!r}, title={self.title!r})>"
        )


class StaticContentSuggestionVote(Base):
    """A member's vote on a content suggestion.

    One vote per user per suggestion (enforced by UniqueConstraint).
    Upsert: overwrite existing vote rather than creating a duplicate.
    """

    __tablename__ = "static_content_suggestion_votes"
    __table_args__ = (
        UniqueConstraint("suggestion_id", "user_id", name="uq_suggestion_vote_per_user"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    suggestion_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("static_content_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    vote: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    # Relationships
    suggestion: Mapped["StaticContentSuggestion"] = relationship(
        "StaticContentSuggestion", back_populates="votes"
    )
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<StaticContentSuggestionVote(suggestion_id={self.suggestion_id}, "
            f"user_id={self.user_id}, vote={self.vote!r})>"
        )
