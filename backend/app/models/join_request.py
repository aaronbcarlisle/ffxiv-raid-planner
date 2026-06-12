"""Join Request model - applications to join static groups from discovery"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, Index
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

    # Profile-connected application fields (all nullable for backwards compat)
    player_profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="SET NULL"), nullable=True
    )
    player_character_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_characters.id", ondelete="SET NULL"), nullable=True
    )
    selected_job: Mapped[str | None] = mapped_column(String(10), nullable=True)
    selected_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    included_alt_jobs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    gear_snapshot_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    availability_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    readiness_at_apply: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_share_code_at_apply: Mapped[str | None] = mapped_column(String(8), nullable=True)
    profile_visibility_at_apply: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_share_enabled_at_apply: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Character identity snapshot (immutable at application time)
    character_name_at_apply: Mapped[str | None] = mapped_column(String(100), nullable=True)
    character_world_at_apply: Mapped[str | None] = mapped_column(String(50), nullable=True)
    character_dc_at_apply: Mapped[str | None] = mapped_column(String(50), nullable=True)
    character_avatar_url_at_apply: Mapped[str | None] = mapped_column(Text, nullable=True)
    character_lodestone_id_at_apply: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Roster onboarding — tracks the SnapshotPlayer created from this application
    roster_player_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("snapshot_players.id", ondelete="SET NULL"), nullable=True
    )

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
