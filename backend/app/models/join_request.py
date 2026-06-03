"""Join Request model - applications to join static groups from discovery"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class JoinRequest(Base):
    __tablename__ = "static_join_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requester_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )

    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    role_interest: Mapped[list | None] = mapped_column(JSON, nullable=True)
    job_interest: Mapped[list | None] = mapped_column(JSON, nullable=True)
    availability_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_discord: Mapped[str | None] = mapped_column(String(100), nullable=True)

    resolved_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", back_populates="join_requests")
    requester: Mapped["User"] = relationship("User", foreign_keys=[requester_user_id])
    resolved_by: Mapped["User | None"] = relationship("User", foreign_keys=[resolved_by_user_id])

    # No DB-level unique constraint — a user may have multiple rows (cancelled,
    # declined, then a new pending). The router enforces one-pending-at-a-time.
    __table_args__ = (
        Index("ix_join_requests_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<JoinRequest(id={self.id}, group={self.static_group_id}, user={self.requester_user_id}, status={self.status})>"
