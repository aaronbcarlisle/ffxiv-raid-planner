"""Shared BiS Target Set model — owner_type / owner_id pattern.

A single table that backs both Player Hub job profile BiS tracking and
roster-member BiS planning. owner_type + owner_id identify the owning entity
across multiple tables without a fixed FK constraint.

Two typed nullable FKs are kept for cascade-delete and SQLAlchemy relationship
support:
  - job_profile_id  → player_job_profiles (owner_type = 'player_job_profile')
  - snapshot_player_id → snapshot_players   (owner_type = 'roster_member_job')
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_job_profile import PlayerJobProfile


VALID_OWNER_TYPES = frozenset({
    "player_job_profile",
    "roster_member_job",
    "static_tier_job",
    "custom",
})

VALID_BIS_PURPOSES = frozenset({
    # Legacy short-form (kept for compatibility)
    "savage", "ultimate", "prog", "farm", "speed", "comfort", "custom",
    # Expanded purpose vocabulary
    "savage_prog", "savage_reclear", "week1", "alt_job", "parse",
})

VALID_BIS_SOURCE_TYPES = frozenset({
    "preset", "etro", "xivgear", "ariyala", "manual", "custom_link",
})

VALID_BIS_IMPORT_STATUSES = frozenset({
    "linked_only", "imported", "import_failed", "unsupported",
})


class BiSTargetSet(Base):
    """Shared BiS target — works for player job profiles and roster member jobs.

    One active target per owner + job is enforced at the application layer.
    """

    __tablename__ = "bis_target_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Generic owner reference
    owner_type: Mapped[str] = mapped_column(String(30), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # Typed FK for player hub context
    job_profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_job_profiles.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    # Typed FK for roster context
    snapshot_player_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("snapshot_players.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )

    # Denormalized breadcrumbs for permission checks and quick lookup
    group_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    profile_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    job: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="savage")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    import_status: Mapped[str] = mapped_column(String(20), nullable=False, default="linked_only")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    patch: Mapped[str | None] = mapped_column(String(20), nullable=True)
    item_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    job_profile: Mapped["PlayerJobProfile | None"] = relationship(
        "PlayerJobProfile",
        foreign_keys=[job_profile_id],
        back_populates="bis_targets",
    )

    __table_args__ = (
        Index("ix_bis_target_sets_owner", "owner_type", "owner_id"),
    )
