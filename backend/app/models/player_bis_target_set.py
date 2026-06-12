"""Player BiS Target Set model - per-job BiS target tracking."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_job_profile import PlayerJobProfile
    from .player_profile import PlayerProfile


VALID_BIS_PURPOSES = frozenset({
    "savage", "ultimate", "prog", "farm", "speed", "comfort", "custom",
})

VALID_BIS_SOURCE_TYPES = frozenset({
    "etro", "xivgear", "ariyala", "manual", "custom_link",
})

VALID_BIS_IMPORT_STATUSES = frozenset({
    "linked_only", "imported", "import_failed", "unsupported",
})


class PlayerBisTargetSet(Base):
    """One BiS target configuration for a specific job profile.

    A player can have multiple BiS target sets per job (e.g. a
    prog set and a farm set). At most one is marked active at a time;
    that invariant is enforced at the application layer, not the DB.
    """

    __tablename__ = "player_bis_target_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    job_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_job_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    job: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="savage")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    import_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="linked_only",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    item_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    job_profile: Mapped["PlayerJobProfile"] = relationship(
        "PlayerJobProfile", back_populates="bis_targets",
    )
