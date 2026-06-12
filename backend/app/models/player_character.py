"""Player Character model - user-owned linked FFXIV character."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_gear_snapshot import PlayerGearSnapshot
    from .player_profile import PlayerProfile


class PlayerCharacter(Base):
    """A linked FFXIV character belonging to a user's player profile.

    Stores Lodestone identity data and serves as the anchor for
    gear snapshots. Designed to support multiple characters per user,
    with one marked as the main character.
    """

    __tablename__ = "player_characters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Link to player profile
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Lodestone identity
    lodestone_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    server: Mapped[str] = mapped_column(String(100), nullable=False)
    data_center: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Main character flag
    is_main: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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
        "PlayerProfile", back_populates="characters",
    )
    gear_snapshots: Mapped[list["PlayerGearSnapshot"]] = relationship(
        "PlayerGearSnapshot",
        back_populates="character",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PlayerCharacter(id={self.id}, name={self.name}, server={self.server})>"
