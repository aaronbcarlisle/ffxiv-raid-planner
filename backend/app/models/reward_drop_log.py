"""RewardDropLog — drop history for a collection goal"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .collection_goal import CollectionGoal
    from .static_group import StaticGroup
    from .user import User


class RewardDropLog(Base):
    __tablename__ = "reward_drop_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    goal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("collection_goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    dropped_at: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    goal: Mapped["CollectionGoal"] = relationship("CollectionGoal", foreign_keys=[goal_id])
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id])
    recipient: Mapped["User | None"] = relationship("User", foreign_keys=[recipient_user_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<RewardDropLog(goal={self.goal_id}, recipient={self.recipient_user_id}, at={self.dropped_at})>"
