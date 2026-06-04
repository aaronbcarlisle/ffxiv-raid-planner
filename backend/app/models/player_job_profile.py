"""Player Job Profile model - main/alt job tracking with readiness."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_gear_snapshot import PlayerGearSnapshot
    from .player_profile import PlayerProfile

# Valid job priority levels
VALID_JOB_PRIORITIES = frozenset({
    "main", "preferred_alt", "flex", "emergency", "casual",
})

# Valid gear readiness states
VALID_READINESS_STATES = frozenset({
    "ready", "needs_gear", "in_progress", "not_ready", "unknown",
})


class PlayerJobProfile(Base):
    """Tracks a player's relationship with a specific job.

    Captures priority (main, alt, flex, etc.), gear readiness,
    and optional notes. Links to the latest gear snapshot for
    that job if available.

    Used for:
    - Solo gear tracking dashboard
    - Static Finder applications (which job to apply as)
    - Alliance/large-scale role planning
    - Loot priority planning
    """

    __tablename__ = "player_job_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Link to player profile
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Job identity
    job: Mapped[str] = mapped_column(String(10), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    # Priority level
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="flex",
    )

    # Gear readiness
    readiness: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown",
    )

    # Optional notes (e.g., "missing weapon", "needs ring2")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Link to latest gear snapshot for this job (if synced)
    gear_snapshot_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_gear_snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Timestamps
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
        "PlayerProfile", back_populates="job_profiles",
    )
    gear_snapshot: Mapped["PlayerGearSnapshot | None"] = relationship(
        "PlayerGearSnapshot", foreign_keys=[gear_snapshot_id],
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerJobProfile(id={self.id}, job={self.job}, "
            f"priority={self.priority}, readiness={self.readiness})>"
        )
