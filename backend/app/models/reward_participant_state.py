"""RewardParticipantState — per-player need/want/have/pass state for a collection goal"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .collection_goal import CollectionGoal
    from .static_group import StaticGroup
    from .user import User

PARTICIPANT_STATES = frozenset({"need", "want", "have", "pass"})
PARTICIPANT_SOURCES = frozenset({"manual", "player_hub", "plugin"})


class RewardParticipantState(Base):
    __tablename__ = "reward_participant_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    goal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("collection_goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )

    state: Mapped[str] = mapped_column(String(10), nullable=False, default="want")
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    last_synced_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_manual_override_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    goal: Mapped["CollectionGoal"] = relationship("CollectionGoal", foreign_keys=[goal_id])
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id])

    __table_args__ = (
        UniqueConstraint("goal_id", "user_id", name="uq_reward_participant_goal_user"),
    )

    def __repr__(self) -> str:
        return f"<RewardParticipantState(goal={self.goal_id}, user={self.user_id}, state={self.state})>"
