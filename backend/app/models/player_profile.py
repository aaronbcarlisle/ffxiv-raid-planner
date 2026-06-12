"""Player Profile model - user-owned profile independent of static membership."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player_character import PlayerCharacter
    from .player_goal import PlayerGoal
    from .player_job_profile import PlayerJobProfile
    from .user import User

# Valid visibility values
VALID_VISIBILITIES = frozenset({"private", "shareable", "discoverable"})


class PlayerProfile(Base):
    """User-owned player profile, independent of any static group.

    Supports solo players who want to track gear, manage jobs, and
    eventually apply to statics or share their profile.
    """

    __tablename__ = "player_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # One-to-one with User
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # Profile visibility
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default="private",
    )

    # Shareable profile code (like StaticGroup.share_code)
    share_code: Mapped[str | None] = mapped_column(
        String(8), nullable=True, unique=True, index=True,
    )
    share_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # Optional short bio / notes
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    characters: Mapped[list["PlayerCharacter"]] = relationship(
        "PlayerCharacter",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="PlayerCharacter.is_main.desc(), PlayerCharacter.created_at",
    )
    job_profiles: Mapped[list["PlayerJobProfile"]] = relationship(
        "PlayerJobProfile",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    goals: Mapped[list["PlayerGoal"]] = relationship(
        "PlayerGoal",
        back_populates="profile",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PlayerProfile(id={self.id}, user_id={self.user_id}, visibility={self.visibility})>"
