"""Pydantic schemas for schedule/session endpoints"""

from enum import Enum
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model with camelCase aliases for JSON serialization"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class RsvpStatusEnum(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    TENTATIVE = "tentative"


class InitialRsvpStatusEnum(str, Enum):
    NONE = "none"
    NO_RESPONSE = "no_response"
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    TENTATIVE = "tentative"


class EventCategoryEnum(str, Enum):
    RAID = "raid"
    ULTIMATE = "ultimate"
    FARM = "farm"
    RECLEAR = "reclear"
    PROG = "prog"
    SOCIAL = "social"
    OTHER = "other"


class WebhookMentionTargetEnum(str, Enum):
    NONE = "none"
    HERE = "here"
    ROLE = "role"


_DISCORD_ROLE_ID_RE = re.compile(r"^(?:<@&)?(\d{17,20})>?$")


def normalize_discord_role_id(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    match = _DISCORD_ROLE_ID_RE.fullmatch(value)
    if not match:
        raise ValueError("Discord role ID must be a 17-20 digit role ID or <@&ROLE_ID> mention")
    return match.group(1)


class BannerSourceTypeEnum(str, Enum):
    UPLOADED = "uploaded"
    DUTY_PRESET = "duty_preset"
    EXTERNAL_URL = "external_url"


class ScheduleSessionCreate(CamelModel):
    title: str
    description: str | None = None
    start_time: str
    end_time: str
    timezone: str
    is_recurring: bool = False
    recurrence_rule: str | None = None
    track_availability: bool = True
    initial_rsvp_status: InitialRsvpStatusEnum | None = None
    category: EventCategoryEnum | None = None
    content_id: str | None = None
    content_name: str | None = None
    banner_url: str | None = None
    banner_key: str | None = None
    banner_source_type: BannerSourceTypeEnum | None = None


class ScheduleSessionUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    timezone: str | None = None
    is_recurring: bool | None = None
    recurrence_rule: str | None = None
    track_availability: bool | None = None
    category: EventCategoryEnum | None = None
    content_id: str | None = None
    content_name: str | None = None
    banner_url: str | None = None
    banner_key: str | None = None
    banner_source_type: BannerSourceTypeEnum | None = None


class RsvpCreate(CamelModel):
    status: RsvpStatusEnum
    note: str | None = None


class RsvpResponse(CamelModel):
    id: str
    session_id: str
    user_id: str
    username: str | None = None
    status: RsvpStatusEnum
    note: str | None = None
    updated_at: str


class ScheduleSessionResponse(CamelModel):
    id: str
    static_group_id: str
    created_by_id: str
    title: str
    description: str | None = None
    start_time: str
    end_time: str
    timezone: str
    is_recurring: bool
    recurrence_rule: str | None = None
    track_availability: bool = True
    category: str | None = None
    content_id: str | None = None
    content_name: str | None = None
    banner_url: str | None = None
    banner_key: str | None = None
    banner_source_type: str | None = None
    created_at: str
    updated_at: str
    rsvps: list[RsvpResponse] = []


class ExceptionTypeEnum(str, Enum):
    CANCELLED = "cancelled"
    EDITED = "edited"


class ScheduleExceptionCreate(CamelModel):
    """Create or upsert an exception for one occurrence of a recurring session."""
    occurrence_date: str          # ISO date e.g. "2025-07-06"
    type: ExceptionTypeEnum
    override_start_time: str | None = None
    override_end_time: str | None = None
    override_title: str | None = None
    override_description: str | None = None
    override_banner_url: str | None = None
    override_banner_key: str | None = None
    cancellation_reason: str | None = None


class ScheduleExceptionResponse(CamelModel):
    id: str
    session_id: str
    occurrence_date: str
    type: str
    override_start_time: str | None = None
    override_end_time: str | None = None
    override_title: str | None = None
    override_description: str | None = None
    override_banner_url: str | None = None
    override_banner_key: str | None = None
    cancellation_reason: str | None = None
    created_by_id: str
    created_at: str
    updated_at: str


class OccurrenceResponse(CamelModel):
    """A single generated occurrence (may have exception overrides applied)."""
    occurrence_date: str
    start_time: str
    end_time: str
    title: str
    description: str | None = None
    banner_url: str | None = None
    banner_key: str | None = None
    banner_source_type: str | None = None
    is_exception: bool = False
    exception_id: str | None = None


# ==================== Availability Schemas ====================


class AvailabilitySubmit(CamelModel):
    date: str
    slots: list[str]


class UserAvailabilityResponse(CamelModel):
    id: str
    user_id: str
    username: str | None = None
    date: str
    slots: list[str]


class AvailabilityDateSummary(CamelModel):
    date: str
    responses: list[UserAvailabilityResponse]


# ==================== Availability Template Schemas ====================

VALID_DAYS = {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}


class AvailabilityTemplateSubmit(CamelModel):
    day_of_week: str  # MO TU WE TH FR SA SU
    slots: list[str]


class AvailabilityTemplateResponse(CamelModel):
    id: str
    user_id: str
    username: str | None = None
    day_of_week: str
    slots: list[str]


class AvailabilityTemplateDaySummary(CamelModel):
    day_of_week: str
    responses: list[AvailabilityTemplateResponse]


# ==================== Personal Availability Template Schemas ====================


class PersonalAvailabilityTemplateSubmit(CamelModel):
    day_of_week: str  # MO TU WE TH FR SA SU
    slots: list[str]
    timezone: str = "UTC"


class PersonalAvailabilityTemplateResponse(CamelModel):
    id: str
    user_id: str
    day_of_week: str
    slots: list[str]
    timezone: str


class PersonalAvailabilityTemplateDaySummary(CamelModel):
    day_of_week: str
    slots: list[str]
    timezone: str


class ScheduleSettingsUpdate(CamelModel):
    webhook_url: str | None = None
    reminder_channel_label: str | None = None
    mention_target: WebhookMentionTargetEnum | None = None
    mention_role_id: str | None = None
    enable_at_start_reminder: bool | None = Field(default=None, alias="enableAtStartReminder")
    enable_15m_reminder: bool | None = Field(default=None, alias="enable15mReminder")
    enable_24h_reminder: bool | None = Field(default=None, alias="enable24hReminder")
    enable_1h_reminder: bool | None = Field(default=None, alias="enable1hReminder")
    enable_6h_reminder: bool | None = Field(default=None, alias="enable6hReminder")
    enable_12h_reminder: bool | None = Field(default=None, alias="enable12hReminder")
    enable_missing_rsvp_reminder: bool | None = None

    @field_validator("mention_role_id")
    @classmethod
    def validate_mention_role_id(cls, value: str | None) -> str | None:
        return normalize_discord_role_id(value)

    @model_validator(mode="after")
    def validate_role_target(self) -> "ScheduleSettingsUpdate":
        if self.mention_target == WebhookMentionTargetEnum.ROLE and not self.mention_role_id:
            raise ValueError("mentionRoleId is required when mentionTarget is role")
        return self


class ScheduleSettingsResponse(CamelModel):
    id: str | None = None
    static_group_id: str
    webhook_configured: bool = False
    webhook_url_masked: str | None = None
    reminder_channel_label: str | None = None
    mention_target: WebhookMentionTargetEnum = WebhookMentionTargetEnum.NONE
    mention_role_id: str | None = None
    enable_at_start_reminder: bool = Field(default=False, alias="enableAtStartReminder")
    enable_15m_reminder: bool = Field(default=False, alias="enable15mReminder")
    enable_24h_reminder: bool = Field(default=False, alias="enable24hReminder")
    enable_1h_reminder: bool = Field(default=False, alias="enable1hReminder")
    enable_6h_reminder: bool = Field(default=False, alias="enable6hReminder")
    enable_12h_reminder: bool = Field(default=False, alias="enable12hReminder")
    enable_missing_rsvp_reminder: bool = False
    calendar_enabled: bool = False
    calendar_url: str | None = None
    calendar_token_created_at: str | None = None
    webhook_last_delivery_status: int | None = None
    webhook_last_delivery_error: str | None = None
    can_manage: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class TestReminderResponse(CamelModel):
    ok: bool
    message: str


class CalendarTokenResponse(CamelModel):
    calendar_enabled: bool
    calendar_url: str | None = None
    calendar_token_created_at: str | None = None
