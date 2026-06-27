"""User model for Discord OAuth authentication"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .membership import Membership
    from .static_group import StaticGroup


class User(Base):
    """User model - represents a Discord-authenticated user"""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    discord_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    discord_username: Mapped[str] = mapped_column(String(100), nullable=False)
    discord_discriminator: Mapped[str | None] = mapped_column(String(10), nullable=True)
    discord_avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Admin flag - grants super-user access to all statics
    # Can only be set via direct DB access or ADMIN_DISCORD_IDS env var
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    last_login_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    activity_display_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="named"
    )
    # User-level navigation preference (applies across all statics + devices).
    # 'remember' = views reopen on your last tab; 'reset' = always open on the
    # default tab. Replaces the earlier remember_sub_tabs/remember_static_tab pair.
    tab_persistence: Mapped[str] = mapped_column(
        String(20), nullable=False, default="remember", server_default="remember"
    )

    # Relationships
    memberships: Mapped[list["Membership"]] = relationship(
        "Membership",
        foreign_keys="Membership.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    owned_groups: Mapped[list["StaticGroup"]] = relationship(
        "StaticGroup",
        foreign_keys="StaticGroup.owner_id",
        back_populates="owner",
    )

    @property
    def avatar_url(self) -> str | None:
        """Get full Discord avatar URL"""
        if self.discord_avatar:
            return f"https://cdn.discordapp.com/avatars/{self.discord_id}/{self.discord_avatar}.png"

        # Discord's default avatar uses (user_id >> 22) % 6 for numeric snowflakes.
        # Dev auth and legacy local users may have placeholder IDs, so fall back to
        # a deterministic string-based index to avoid frontend crashes.
        if self.discord_id.isdigit():
            index = (int(self.discord_id) >> 22) % 6
        else:
            index = sum(self.discord_id.encode("utf-8")) % 6

        return f"https://cdn.discordapp.com/embed/avatars/{index}.png"

    @property
    def effective_name(self) -> str:
        """Get display name or fall back to Discord username"""
        return self.display_name or self.discord_username

    def __repr__(self) -> str:
        return f"<User(id={self.id}, discord_username={self.discord_username})>"
