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
    role_interest: list[str] | None = Field(default=None)
    job_interest: list[str] | None = Field(default=None)
    availability_note: str | None = Field(default=None, max_length=300)
    contact_discord: str | None = Field(default=None, max_length=100)

    @field_validator("role_interest")
    @classmethod
    def validate_role_interest(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned = []
        for role in v:
            lower = role.lower()
            if lower not in VALID_ROLE_INTERESTS:
                raise ValueError(f"Invalid role: {role}. Must be one of: {', '.join(sorted(VALID_ROLE_INTERESTS))}")
            cleaned.append(lower)
        return cleaned if cleaned else None

    @field_validator("job_interest")
    @classmethod
    def validate_job_interest(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned = []
        for job in v:
            lower = job.lower()
            if lower not in VALID_JOBS:
                raise ValueError(f"Invalid job: {job}")
            cleaned.append(lower)
        return cleaned if cleaned else None


class RequesterInfo(CamelModel):
    id: str
    display_name: str | None = None
    avatar_url: str | None = None


class JoinRequestResponse(CamelModel):
    id: str
    static_group_id: str
    static_group_name: str | None = None
    requester_user_id: str
    requester: RequesterInfo | None = None
    status: JoinRequestStatusEnum
    message: str | None = None
    role_interest: list[str] | None = None
    job_interest: list[str] | None = None
    availability_note: str | None = None
    contact_discord: str | None = None
    created_at: str
    updated_at: str
    resolved_at: str | None = None
    resolved_by_user_id: str | None = None


class JoinRequestListResponse(CamelModel):
    items: list[JoinRequestResponse]
    pending_count: int = 0
