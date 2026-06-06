"""Mount Farm Progress model - tracks per-member mount/totem progress for EX trials"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class MountFarmProgress(Base):
    __tablename__ = "mount_farm_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trial_id: Mapped[str] = mapped_column(String(50), nullable=False)

    has_mount: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    wants_mount: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    totem_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source tracking: where the data came from
    # Values: manual, plugin, tomestone, unknown
    ownership_source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    totem_source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")

    # Sync timestamps
    last_imported_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_plugin_sync_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_manual_override_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", foreign_keys=[static_group_id])
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    updated_by: Mapped["User"] = relationship("User", foreign_keys=[updated_by_id])

    __table_args__ = (
        UniqueConstraint("static_group_id", "user_id", "trial_id", name="uq_mount_farm_progress"),
    )

    def __repr__(self) -> str:
        return f"<MountFarmProgress(group={self.static_group_id}, user={self.user_id}, trial={self.trial_id})>"
