"""StaticCharacterRegistration — per-static character identity layer.

Links a roster slot (SnapshotPlayer) to a specific character the player
intends to bring to this static.  Supports Player Hub linked characters
(playerCharacterId FK) and manual fallback fields.

A player may have multiple registrations for one static:
  - exactly one with is_primary_for_static=True (their "main" for this static)
  - any number with is_primary_for_static=False (alts for this static)

This model is the shared source of truth for:
  Split Planner   — character candidates for run A / run B
  Roster          — character badges and management UI
  (V2) Loot Log   — preferred loot recipient character
  (V2) Summary    — main-only vs include-alts aggregation
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_character import PlayerCharacter
    from .snapshot_player import SnapshotPlayer
    from .static_group import StaticGroup


class StaticCharacterRegistration(Base):
    __tablename__ = "static_character_registrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Which static and which roster slot this registration belongs to
    static_group_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("static_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_player_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("snapshot_players.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Preferred: link to a Player Hub character
    player_character_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("player_characters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Manual fallback when no Player Hub character is linked
    manual_character_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manual_world: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manual_data_center: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Static-specific role metadata
    role_in_static: Mapped[str] = mapped_column(
        String(20), nullable=False, default="alt"
    )  # main | alt | substitute | manual
    job: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_primary_for_static: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual"
    )  # player_hub | lodestone | manual

    # Sync freshness (copied from PlayerCharacter at registration time)
    last_synced_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
        onupdate=lambda: datetime.now(timezone.utc).isoformat(),
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship(
        "StaticGroup", back_populates="character_registrations",
    )
    snapshot_player: Mapped["SnapshotPlayer"] = relationship(
        "SnapshotPlayer", back_populates="character_registrations",
    )
    player_character: Mapped["PlayerCharacter | None"] = relationship(
        "PlayerCharacter", back_populates="static_registrations",
    )

    __table_args__ = (
        # A player may only register the same PlayerHub character once per static
        UniqueConstraint(
            "static_group_id", "snapshot_player_id", "player_character_id",
            name="uq_static_player_character",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<StaticCharacterRegistration("
            f"id={self.id}, player={self.snapshot_player_id}, "
            f"char={self.player_character_id or self.manual_character_name}, "
            f"primary={self.is_primary_for_static})>"
        )
