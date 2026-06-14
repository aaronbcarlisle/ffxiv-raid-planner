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
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


VALID_ROLE_INTERESTS = frozenset({"tank", "healer", "melee", "ranged", "caster"})
VALID_READINESS_STATES = frozenset({"ready", "needs_gear", "in_progress", "not_ready", "unknown"})


class JoinRequestCreate(CamelModel):
    message: str | None = Field(default=None, max_length=500)
    role_interest: list[str] | None = Field(default=None)
    job_interest: list[str] | None = Field(default=None)
    availability_note: str | None = Field(default=None, max_length=300)
    contact_discord: str | None = Field(default=None, max_length=100)

    # Profile-connected fields (optional — backwards compatible)
    player_profile_id: str | None = Field(default=None)
    player_character_id: str | None = Field(default=None)
    selected_job: str | None = Field(default=None)
    selected_role: str | None = Field(default=None)
    included_alt_jobs: list[dict] | None = Field(default=None)
    gear_snapshot_summary: dict | None = Field(default=None)
    availability_summary: dict | None = Field(default=None)
    include_exact_availability: bool = Field(default=False)
    readiness_at_apply: str | None = Field(default=None)
    profile_share_code_at_apply: str | None = Field(default=None, max_length=8)
    # Goal alignment snapshot (summary counts at apply time, no private goal details)
    goal_alignment_snapshot: dict | None = Field(default=None)
    # Character identity snapshot
    character_name_at_apply: str | None = Field(default=None, max_length=100)
    character_world_at_apply: str | None = Field(default=None, max_length=50)
    character_dc_at_apply: str | None = Field(default=None, max_length=50)
    character_avatar_url_at_apply: str | None = Field(default=None)

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

    @field_validator("selected_job")
    @classmethod
    def validate_selected_job(cls, v: str | None) -> str | None:
        if v is None:
            return None
        lower = v.lower()
        if lower not in VALID_JOBS:
            raise ValueError(f"Invalid job: {v}")
        return lower

    @field_validator("selected_role")
    @classmethod
    def validate_selected_role(cls, v: str | None) -> str | None:
        if v is None:
            return None
        lower = v.lower()
        if lower not in VALID_ROLE_INTERESTS:
            raise ValueError(f"Invalid role: {v}. Must be one of: {', '.join(sorted(VALID_ROLE_INTERESTS))}")
        return lower

    @field_validator("readiness_at_apply")
    @classmethod
    def validate_readiness(cls, v: str | None) -> str | None:
        if v is None:
            return None
        lower = v.lower()
        if lower not in VALID_READINESS_STATES:
            raise ValueError(f"Invalid readiness: {v}. Must be one of: {', '.join(sorted(VALID_READINESS_STATES))}")
        return lower


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
    # Profile-connected fields
    player_profile_id: str | None = None
    player_character_id: str | None = None
    selected_job: str | None = None
    selected_role: str | None = None
    included_alt_jobs: list[dict] | None = None
    gear_snapshot_summary: dict | None = None
    availability_summary: dict | None = None
    readiness_at_apply: str | None = None
    profile_share_code_at_apply: str | None = None
    goal_alignment_snapshot: dict | None = None
    profile_visibility_at_apply: str | None = None
    profile_share_enabled_at_apply: bool | None = None
    # Character identity snapshot
    character_name_at_apply: str | None = None
    character_world_at_apply: str | None = None
    character_dc_at_apply: str | None = None
    character_avatar_url_at_apply: str | None = None
    character_lodestone_id_at_apply: str | None = None
    # Roster onboarding
    roster_player_id: str | None = None
    created_at: str
    updated_at: str
    resolved_at: str | None = None
    resolved_by_user_id: str | None = None


class LinkRosterRequest(CamelModel):
    roster_player_id: str = Field(..., min_length=1)


class JoinRequestListResponse(CamelModel):
    items: list[JoinRequestResponse]
    pending_count: int = 0
