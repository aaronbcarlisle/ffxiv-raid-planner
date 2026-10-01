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
    # The recipient's participant state that log_drop replaced (need/want → have);
    # NULL when the drop caused no flip. Deleting the drop restores it (R-P0-2).
    recipient_prior_state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # When that flip happened (the drop's created_at, ISO text). It travels with the
    # prior when a delete hands it to another drop, so a plugin sync or manual edit
    # made after the flip still wins over a restore. NULL whenever the prior is NULL.
    recipient_prior_state_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Write provenance (PROV-1, R-PV-1): how the drop was logged and which API key
    # wrote it; NULL on drops that predate PROV-1. The writer and recipient are
    # created_by_id and recipient_user_id above.
    logged_via: Mapped[str | None] = mapped_column(String(10), nullable=True)
    api_key_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    # The recipient's character (S2a-1, B11): which character the drop went to,
    # its name at write time, and its source (PROV-1's character-source values).
    # SET NULL acts on Postgres only (SQLite runs without PRAGMA foreign_keys);
    # the name survives an unlink.
    recipient_character_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("player_characters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recipient_character_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_character_source: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # The recipient's collection record before the drop raised it (R-S1-13,
    # R-S1-14): its ownership state, when the raise happened (the record's new
    # state_changed_at), and the record's state_changed_at before the raise
    # (vet M-10). Undo reverts the record only while it is unchanged since.
    recipient_record_prior_state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    recipient_record_prior_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipient_record_prior_changed_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    goal: Mapped["CollectionGoal"] = relationship("CollectionGoal", foreign_keys=[goal_id])
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id])
    recipient: Mapped["User | None"] = relationship("User", foreign_keys=[recipient_user_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<RewardDropLog(goal={self.goal_id}, recipient={self.recipient_user_id}, at={self.dropped_at})>"
