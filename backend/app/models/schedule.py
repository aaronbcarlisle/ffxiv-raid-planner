"""Schedule models - raid session scheduling and RSVPs"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Boolean, UniqueConstraint
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
    track_availability: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")

    # Event categorization (optional, backwards-compatible)
    # category: raid / farm / reclear / prog / social / other
    category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Link to specific game content (e.g., mount farm trial_id or raid tier floor)
    content_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Banner (optional) — sourceType: uploaded | duty_preset | external_url
    banner_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    banner_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    banner_source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Per-event Discord delivery controls. Null reminder fields inherit static defaults.
    mirror_to_discord: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    send_discord_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    reminder_offsets_minutes: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_rsvp_reminder_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

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
    mention_target: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    mention_role_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enable_at_start_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_15m_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_24h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_1h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_6h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_12h_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    enable_missing_rsvp_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calendar_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calendar_token: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    calendar_token_created_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Discord Guild Scheduled Events (bot, not webhook)
    discord_bot_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    discord_guild_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

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
    last_delivery_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_delivery_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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


class ScheduleException(Base):
    """An override for a single occurrence of a recurring series.

    type='cancelled' — the occurrence is skipped entirely.
    type='edited'    — occurrence inherits overrides for the set fields only.
    """

    __tablename__ = "schedule_exceptions"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "occurrence_date",
            name="uq_schedule_exception_session_occurrence",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedule_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # ISO date of the occurrence being overridden, e.g. "2025-07-06"
    occurrence_date: Mapped[str] = mapped_column(String(20), nullable=False)
    # 'cancelled' or 'edited'
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Edited overrides — only non-null fields are applied; null means "inherit from series"
    override_start_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_end_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    override_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_banner_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_banner_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    session: Mapped["ScheduleSession"] = relationship("ScheduleSession")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])


class DiscordInstallClaim(Base):
    """Short-lived claim token used to link a static to a Discord guild.

    Flow:
      1. Lead clicks "Connect Discord" → POST /schedule-discord/install-claim
         Backend creates this row and returns the plain claim_code to the frontend.
      2. Lead invites the XIVRaidPlanner bot to their server.
      3. Lead runs /xrp link <claim_code> in the server.
      4. Bot POSTs /api/discord/slash-claim with code + guild info.
      5. Backend hashes the code, finds this row, creates StaticDiscordLink.

    The plain claim_code is NEVER stored — only SHA-256(code) is persisted.
    """

    __tablename__ = "discord_install_claims"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    claim_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    oauth_state: Mapped[str | None] = mapped_column(String(128), nullable=True)

    expires_at: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | claimed | expired | revoked
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    discord_guild_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    discord_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    claimed_by_discord_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])


class StaticDiscordLink(Base):
    """Active link between one static group and a Discord guild.

    Created when a DiscordInstallClaim is successfully claimed.
    Multiple statics can link to the same guild (one row per static).
    """

    __tablename__ = "static_discord_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("static_groups.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    discord_guild_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    discord_guild_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    schedule_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    announcement_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    voice_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    linked_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # connected | permission_missing | disconnected
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="connected")

    permissions_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    last_permission_check_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    static_group: Mapped["StaticGroup"] = relationship("StaticGroup")
    linked_by: Mapped["User"] = relationship("User", foreign_keys=[linked_by_user_id])


class ScheduleDiscordMirror(Base):
    """Tracks a Discord Guild Scheduled Event that mirrors one app occurrence.

    One row per (session_id, occurrence_date) pair pushed to Discord.
    Recurring series creates one row per concrete mirrored occurrence.
    """

    __tablename__ = "schedule_discord_mirrors"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "occurrence_date",
            name="uq_discord_mirror_session_occurrence",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedule_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # ISO date of the occurrence, e.g. "2025-07-06". None for single (non-recurring) events.
    occurrence_date: Mapped[str | None] = mapped_column(String(20), nullable=True)

    discord_guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    discord_scheduled_event_id: Mapped[str] = mapped_column(Text, nullable=False)
    discord_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # sync_status: not_synced | pending | synced | failed | manual_action_needed
    sync_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    last_synced_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Track whether the Discord event's cover image matches the current app banner
    banner_hash_synced: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    session: Mapped["ScheduleSession"] = relationship("ScheduleSession")
