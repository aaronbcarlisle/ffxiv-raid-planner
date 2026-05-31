"""Schedule models - raid session scheduling and RSVPs"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static_group import StaticGroup
    from .user import User


class ScheduleSession(Base):
    """A scheduled raid session for a static group."""

    __tablename__ = "schedule_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    start_time: Mapped[str] = mapped_column(Text, nullable=False)
    end_time: Mapped[str] = mapped_column(Text, nullable=False)

    timezone: Mapped[str] = mapped_column(String(50), nullable=False)

    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurrence_rule: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup", back_populates="schedule_sessions")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    rsvps: Mapped[list["ScheduleRsvp"]] = relationship(
        "ScheduleRsvp", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ScheduleSession(id={self.id}, title={self.title}, group={self.static_group_id})>"


class ScheduleRsvp(Base):
    """An RSVP response from a member for a scheduled session."""

    __tablename__ = "schedule_rsvps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedule_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    session: Mapped["ScheduleSession"] = relationship("ScheduleSession", back_populates="rsvps")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<ScheduleRsvp(session={self.session_id}, user={self.user_id}, status={self.status})>"


class ScheduleSettings(Base):
    """Scheduler integration settings for one static group."""

    __tablename__ = "schedule_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    webhook_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_channel_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    enable_24h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enable_1h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enable_missing_rsvp_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calendar_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calendar_token: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    calendar_token_created_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup")


class DiscordMessageMapping(Base):
    """Maps a schedule session to its Discord webhook message for edit-in-place."""

    __tablename__ = "schedule_discord_messages"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "occurrence_start_time",
            name="uq_discord_msg_session_occurrence",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedule_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    occurrence_start_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    webhook_message_id: Mapped[str] = mapped_column(Text, nullable=False)
    webhook_thread_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_posted_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_edited_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_rsvp_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    session: Mapped["ScheduleSession"] = relationship("ScheduleSession")


class ScheduleReminderDelivery(Base):
    """Delivery log used to dedupe scheduled reminder sends."""

    __tablename__ = "schedule_reminder_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "reminder_type",
            "occurrence_start_time",
            name="uq_schedule_reminder_delivery_occurrence",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedule_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reminder_type: Mapped[str] = mapped_column(String(50), nullable=False)
    occurrence_start_time: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    session: Mapped["ScheduleSession"] = relationship("ScheduleSession")
