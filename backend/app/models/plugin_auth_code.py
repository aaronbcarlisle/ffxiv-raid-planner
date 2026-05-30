"""Plugin authorization code model — short-lived PKCE codes for browser sign-in."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .user import User


class PluginAuthCode(Base):
    """
    Single-use authorization code for the plugin's loopback OAuth flow.

    Issued by /api/auth/api-keys/plugin-auth/authorize (authenticated) and
    redeemed at /api/auth/api-keys/plugin-auth/exchange via PKCE proof.

    Only the SHA-256 hash of the raw code is persisted; the code itself is
    returned once to the frontend so it can redirect to the loopback URI.
    """

    __tablename__ = "plugin_auth_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    code_challenge: Mapped[str] = mapped_column(String(128), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(Text, nullable=False)

    expires_at: Mapped[str] = mapped_column(Text, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    user: Mapped["User"] = relationship("User")
