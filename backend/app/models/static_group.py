"""Static Group model - persistent team identity across raid tiers"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .invitation import Invitation
    from .membership import Membership
    from .tier_snapshot import TierSnapshot
    from .user import User


class StaticGroup(Base):
    """
    Static Group - represents a persistent raid team.

    Unlike the legacy Static model (which is tier-specific),
    StaticGroup persists across raid tiers with separate roster snapshots.
    """

    __tablename__ = "static_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Owner - the user who created this static group
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # Share code for public/viewer access
    share_code: Mapped[str] = mapped_column(
        String(6), unique=True, nullable=False, index=True
    )

    # Visibility: private (members only) or public (anyone with link can view)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    memberships: Mapped[list["Membership"]] = relationship(
        "Membership",
        back_populates="static_group",
        cascade="all, delete-orphan",
    )
    tier_snapshots: Mapped[list["TierSnapshot"]] = relationship(
        "TierSnapshot",
        back_populates="static_group",
        cascade="all, delete-orphan",
        order_by="TierSnapshot.created_at.desc()",
    )
    invitations: Mapped[list["Invitation"]] = relationship(
        "Invitation",
        back_populates="static_group",
        cascade="all, delete-orphan",
        order_by="Invitation.created_at.desc()",
    )

    @property
    def member_count(self) -> int:
        """Get count of all members"""
        return len(self.memberships) if self.memberships else 0

    def __repr__(self) -> str:
        return f"<StaticGroup(id={self.id}, name={self.name}, owner_id={self.owner_id})>"
