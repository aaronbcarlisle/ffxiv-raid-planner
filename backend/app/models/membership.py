"""Membership model - user <-> static group relationship with roles"""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class MemberRole(str, Enum):
    """Membership roles with hierarchical permissions"""

    OWNER = "owner"  # Full control, can delete group
    LEAD = "lead"  # Can edit roster, manage members (except owner)
    MEMBER = "member"  # Can edit own character's gear
    VIEWER = "viewer"  # Read-only access


# Permission hierarchy for comparison
ROLE_HIERARCHY = {
    MemberRole.OWNER: 4,
    MemberRole.LEAD: 3,
    MemberRole.MEMBER: 2,
    MemberRole.VIEWER: 1,
}


class Membership(Base):
    """
    Membership - represents a user's membership in a static group.

    Each user can have different roles in different static groups.
    """

    __tablename__ = "memberships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id"), nullable=False, index=True
    )

    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=MemberRole.MEMBER.value
    )

    # Timestamps
    joined_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    static_group: Mapped["StaticGroup"] = relationship(
        "StaticGroup", back_populates="memberships"
    )

    # Unique constraint: one membership per user per static group
    __table_args__ = (
        UniqueConstraint("user_id", "static_group_id", name="uq_user_static_group"),
    )

    @property
    def role_enum(self) -> MemberRole:
        """Get role as enum"""
        return MemberRole(self.role)

    @property
    def role_level(self) -> int:
        """Get numeric role level for comparison"""
        return ROLE_HIERARCHY.get(self.role_enum, 0)

    def can_edit_roster(self) -> bool:
        """Check if this member can edit the roster"""
        return self.role_enum in (MemberRole.OWNER, MemberRole.LEAD)

    def can_manage_members(self) -> bool:
        """Check if this member can manage other members"""
        return self.role_enum in (MemberRole.OWNER, MemberRole.LEAD)

    def can_delete_group(self) -> bool:
        """Check if this member can delete the static group"""
        return self.role_enum == MemberRole.OWNER

    def can_change_visibility(self) -> bool:
        """Check if this member can change public/private setting"""
        return self.role_enum == MemberRole.OWNER

    def __repr__(self) -> str:
        return f"<Membership(user_id={self.user_id}, static_group_id={self.static_group_id}, role={self.role})>"
