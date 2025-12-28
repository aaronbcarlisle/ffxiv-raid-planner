"""Invitation model - invite links for joining static groups"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class Invitation(Base):
    """
    Invitation - represents an invite link to join a static group.

    Invitations can be created by owners/leads and used by anyone with the code.
    They can have expiration dates, usage limits, and can be revoked.
    """

    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # The invite code (like share code, but specifically for joining)
    invite_code: Mapped[str] = mapped_column(
        String(12), nullable=False, unique=True, index=True
    )

    # Role that will be assigned when invitation is accepted
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="member"
    )

    # Optional expiration
    expires_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Usage limits
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Can be revoked
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", back_populates="invitations")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])

    @property
    def is_expired(self) -> bool:
        """Check if invitation has expired"""
        if not self.expires_at:
            return False
        expires = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) > expires

    @property
    def is_exhausted(self) -> bool:
        """Check if invitation has reached max uses"""
        if self.max_uses is None:
            return False
        return self.use_count >= self.max_uses

    @property
    def is_valid(self) -> bool:
        """Check if invitation can still be used"""
        return self.is_active and not self.is_expired and not self.is_exhausted

    def __repr__(self) -> str:
        return f"<Invitation(code={self.invite_code}, group_id={self.static_group_id}, uses={self.use_count}/{self.max_uses})>"
