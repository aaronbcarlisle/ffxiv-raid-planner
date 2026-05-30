"""Availability models - When2Meet-style availability grid"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .user import User


class UserAvailability(Base):
    """A user's available time slots for a specific date within a static group."""

    __tablename__ = "user_availability"

    __table_args__ = (
        UniqueConstraint(
            "static_group_id", "user_id", "date",
            name="uq_availability_group_user_date",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    date: Mapped[str] = mapped_column(String(10), nullable=False)
    slots: Mapped[str] = mapped_column(Text, nullable=False)

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<UserAvailability(group={self.static_group_id}, user={self.user_id}, date={self.date})>"


class AvailabilityTemplate(Base):
    """A user's typical weekly availability pattern, keyed by day-of-week.

    Unlike UserAvailability (which is date-specific), this represents
    standing availability — e.g. "I'm always free on Saturday evenings."
    day_of_week uses iCal BYDAY keys: MO TU WE TH FR SA SU.
    """

    __tablename__ = "schedule_availability_templates"

    __table_args__ = (
        UniqueConstraint(
            "static_group_id", "user_id", "day_of_week",
            name="uq_avail_template_group_user_day",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    day_of_week: Mapped[str] = mapped_column(String(2), nullable=False)
    slots: Mapped[str] = mapped_column(Text, nullable=False)

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AvailabilityTemplate(group={self.static_group_id}, user={self.user_id}, day={self.day_of_week})>"
