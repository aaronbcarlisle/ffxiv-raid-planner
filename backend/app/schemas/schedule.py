"""Pydantic schemas for schedule/session endpoints"""

from enum import Enum

from pydantic import BaseModel, ConfigDict
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


class ScheduleSessionCreate(CamelModel):
    title: str
    description: str | None = None
    start_time: str
    end_time: str
    timezone: str
    is_recurring: bool = False
    recurrence_rule: str | None = None


class ScheduleSessionUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    timezone: str | None = None
    is_recurring: bool | None = None
    recurrence_rule: str | None = None


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
    created_at: str
    updated_at: str
    rsvps: list[RsvpResponse] = []


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
