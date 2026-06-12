"""Player Gear Snapshot model - character-owned gear data per job."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_character import PlayerCharacter

# Valid sync sources
VALID_SYNC_SOURCES = frozenset({
    "plugin", "tomestone", "xivapi", "lodestone", "manual", "roster_sync", "unknown",
})


class PlayerGearSnapshot(Base):
    """Latest gear snapshot for a character + job combination.

    Stores the same gear JSON format as SnapshotPlayer.gear but owned
    by a PlayerCharacter rather than a static roster slot. One snapshot
    per character per job — updated in place on each sync.

    Can later be copied to create immutable application-time snapshots.
    """

    __tablename__ = "player_gear_snapshots"
    __table_args__ = (
        UniqueConstraint("character_id", "job", name="uq_player_gear_character_job"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Link to character
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_characters.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Which job this gear is for
    job: Mapped[str] = mapped_column(String(10), nullable=False)

    # Gear data — same JSON format as SnapshotPlayer.gear
    # [{slot, bisSource, currentSource, hasItem, isAugmented, itemLevel, ...}]
    gear: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Average item level across equipped slots
    avg_item_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Sync metadata
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    synced_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_plugin_seen_at: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    character: Mapped["PlayerCharacter"] = relationship(
        "PlayerCharacter", back_populates="gear_snapshots",
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerGearSnapshot(id={self.id}, character_id={self.character_id}, "
            f"job={self.job}, avg_ilvl={self.avg_item_level})>"
        )
