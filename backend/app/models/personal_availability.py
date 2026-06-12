"""Personal Availability Template - user-level typical weekly availability."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .user import User


class PersonalAvailabilityTemplate(Base):
    """A user's personal typical weekly availability, independent of any static.

    Unlike AvailabilityTemplate (which is per-static), this is global
    per user -- their standing availability across all statics.
    day_of_week uses iCal BYDAY keys: MO TU WE TH FR SA SU.
    """

    __tablename__ = "personal_availability_templates"

    __table_args__ = (
        UniqueConstraint(
            "user_id", "day_of_week",
            name="uq_personal_avail_template_user_day",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    day_of_week: Mapped[str] = mapped_column(String(2), nullable=False)
    slots: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of time strings
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<PersonalAvailabilityTemplate(user={self.user_id}, day={self.day_of_week})>"
