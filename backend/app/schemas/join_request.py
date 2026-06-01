"""Pydantic schemas for Static Join Requests"""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.constants import VALID_JOBS


def to_camel(string: str) -> str:
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class JoinRequestStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


VALID_ROLE_INTERESTS = frozenset({"tank", "healer", "melee", "ranged", "caster"})


class JoinRequestCreate(CamelModel):
    message: str | None = Field(default=None, max_length=500)
    role_interest: str | None = Field(default=None)
    job_interest: str | None = Field(default=None)
    availability_note: str | None = Field(default=None, max_length=300)

    @field_validator("role_interest")
    @classmethod
    def validate_role_interest(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in VALID_ROLE_INTERESTS:
            raise ValueError(f"Invalid role: {v}. Must be one of: {', '.join(sorted(VALID_ROLE_INTERESTS))}")
        return v.lower() if v else None

    @field_validator("job_interest")
    @classmethod
    def validate_job_interest(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in VALID_JOBS:
            raise ValueError(f"Invalid job: {v}")
        return v.lower() if v else None


class RequesterInfo(CamelModel):
    id: str
    discord_username: str
    discord_avatar: str | None = None
    avatar_url: str | None = None
    display_name: str | None = None


class JoinRequestResponse(CamelModel):
    id: str
    static_group_id: str
    static_group_name: str | None = None
    requester_user_id: str
    requester: RequesterInfo | None = None
    status: JoinRequestStatusEnum
    message: str | None = None
    role_interest: str | None = None
    job_interest: str | None = None
    availability_note: str | None = None
    created_at: str
    updated_at: str
    resolved_at: str | None = None
    resolved_by_user_id: str | None = None


class JoinRequestListResponse(CamelModel):
    items: list[JoinRequestResponse]
    pending_count: int = 0
