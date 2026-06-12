"""Persisted activity log for static group events."""

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class StaticActivityLog(Base):
    """One row per notable event in a static group (mount obtained, plugin sync, etc.)."""

    __tablename__ = "static_activity_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'named' | 'anonymous' | 'system'
    actor_display: Mapped[str] = mapped_column(String(20), nullable=False, default="named")
    # 'mount_obtained' | 'totem_updated' | 'tracking_started' | 'plugin_sync'
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    trial_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup")
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_user_id])
