"""API Key model for plugin/external authentication"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .user import User


class ApiKey(Base):
    """
    API Key - allows external applications (e.g., Dalamud plugin) to authenticate
    without Discord OAuth. Keys use xrp_ prefix for easy identification.

    Only the SHA-256 hash of the key is stored. The raw key is shown once at creation.
    """

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Owner of this key
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # SHA-256 hash of the full key (for lookup)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    # First 8 chars of the key for display (e.g., "xrp_a1b2...")
    key_prefix: Mapped[str] = mapped_column(String(12), nullable=False)

    # User-provided label
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Permission scopes (JSON array, e.g., ["priority:read", "loot:write"])
    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Usage tracking
    last_used_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional expiration
    expires_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Active flag (can be revoked without deletion)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<ApiKey(id={self.id}, name={self.name}, user_id={self.user_id})>"
