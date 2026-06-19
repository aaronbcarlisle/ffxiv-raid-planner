"""Manual split-clear planning for a roster slot."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_character import PlayerCharacter
    from .snapshot_player import SnapshotPlayer
    from .static_group import StaticGroup


class SplitClearAssignment(Base):
    """One split plan row for a player in a tier roster.

    Character assignment can be backed by a Player Hub PlayerCharacter link
    (run_a/b_character_link_id) or by legacy manual text fields.  When a link
    exists it takes precedence; text fields serve as the fallback for players
    without linked characters.
    """

    __tablename__ = "split_clear_assignments"
    __table_args__ = (
        UniqueConstraint("static_group_id", "snapshot_player_id", name="uq_split_clear_player"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    snapshot_player_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("snapshot_players.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Player Hub character links (nullable; link takes precedence over text fields)
    run_a_character_link_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_characters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    run_b_character_link_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_characters.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Legacy manual text fields — kept for backward compat and manual-entry fallback
    main_character_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    main_character_world: Mapped[str | None] = mapped_column(String(100), nullable=True)
    alt_character_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    alt_character_world: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Run slot label — 'main' | 'alt' | None.  When a character link exists this
    # is derived from PlayerCharacter.is_main; for manual entries it is set explicitly.
    run_a_character: Mapped[str | None] = mapped_column(String(10), nullable=True)
    run_b_character: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Loot target — 'funnel_main' | 'funnel_job' | 'normal'
    loot_target: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    loot_target_job: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Weekly state is manual and run-specific.
    run_a_cleared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    run_b_cleared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", back_populates="split_clear_assignments")
    player: Mapped["SnapshotPlayer"] = relationship("SnapshotPlayer")
    run_a_character_link: Mapped["PlayerCharacter | None"] = relationship(
        "PlayerCharacter", foreign_keys=[run_a_character_link_id]
    )
    run_b_character_link: Mapped["PlayerCharacter | None"] = relationship(
        "PlayerCharacter", foreign_keys=[run_b_character_link_id]
    )
