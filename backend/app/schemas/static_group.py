"""Pydantic schemas for Static Groups and Memberships"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class MemberRoleEnum(str, Enum):
    """Membership role enum for API"""

    OWNER = "owner"
    LEAD = "lead"
    MEMBER = "member"
    VIEWER = "viewer"


class GroupSourceEnum(str, Enum):
    """How user is associated with a group"""

    MEMBERSHIP = "membership"
    LINKED = "linked"


# Role type for loot priority
RoleType = Literal["tank", "healer", "melee", "ranged", "caster"]


# --- Static Settings Schema ---


class StaticSettingsSchema(CamelModel):
    """Settings for a static group (loot priority, etc.)"""

    loot_priority: list[RoleType] = Field(
        default=["melee", "ranged", "caster", "tank", "healer"],
        description="Role priority order for loot distribution",
    )


# --- Membership Schemas ---


class MembershipBase(CamelModel):
    """Base membership schema"""

    role: MemberRoleEnum = Field(default=MemberRoleEnum.MEMBER)


class MembershipCreate(MembershipBase):
    """Schema for adding a member to a static group"""

    user_id: str = Field(..., description="User ID to add")


class MembershipUpdate(CamelModel):
    """Schema for updating a membership"""

    role: MemberRoleEnum = Field(..., description="New role for the member")


class MemberInfo(CamelModel):
    """Basic member info for responses"""

    id: str
    discord_id: str
    discord_username: str
    discord_avatar: str | None = None
    avatar_url: str | None = None
    display_name: str | None = None


class MembershipResponse(CamelModel):
    """Schema for membership response"""

    id: str
    user_id: str
    static_group_id: str
    role: MemberRoleEnum
    joined_at: str
    user: MemberInfo | None = None


# --- Static Group Schemas ---


class StaticGroupCreate(CamelModel):
    """Schema for creating a new static group"""

    name: str = Field(..., min_length=1, max_length=100, description="Group name")
    is_public: bool = Field(default=False, description="Whether group is publicly viewable")
    settings: StaticSettingsSchema | None = Field(default=None, description="Group settings")


class StaticGroupUpdate(CamelModel):
    """Schema for updating a static group"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_public: bool | None = Field(default=None)
    settings: StaticSettingsSchema | None = Field(default=None, description="Group settings")


class OwnerInfo(CamelModel):
    """Owner info for responses"""

    id: str
    discord_username: str
    discord_avatar: str | None = None
    avatar_url: str | None = None
    display_name: str | None = None


class StaticGroupResponse(CamelModel):
    """Schema for static group response (without members)"""

    id: str
    name: str
    share_code: str
    is_public: bool
    owner_id: str
    settings: StaticSettingsSchema | None = None
    created_at: str
    updated_at: str
    member_count: int = 0
    # User's role in this group (if authenticated)
    user_role: MemberRoleEnum | None = None


class StaticGroupWithMembers(CamelModel):
    """Schema for static group response with members"""

    id: str
    name: str
    share_code: str
    is_public: bool
    owner_id: str
    owner: OwnerInfo | None = None
    members: list[MembershipResponse] = Field(default_factory=list)
    settings: StaticSettingsSchema | None = None
    created_at: str
    updated_at: str
    # User's role in this group (if authenticated)
    user_role: MemberRoleEnum | None = None


class StaticGroupListItem(CamelModel):
    """Schema for static group in a list (user's dashboard)"""

    id: str
    name: str
    share_code: str
    is_public: bool
    owner_id: str
    member_count: int = 0
    user_role: MemberRoleEnum | None = None
    source: GroupSourceEnum = GroupSourceEnum.MEMBERSHIP
    settings: StaticSettingsSchema | None = None
    created_at: str
    updated_at: str


class DuplicateGroupRequest(CamelModel):
    """Schema for duplicating a static group with all tiers/players"""

    new_name: str = Field(..., min_length=1, max_length=100, description="Name for the duplicated group")
    copy_tiers: bool = Field(default=True, description="Whether to copy tier snapshots")
    copy_players: bool = Field(default=True, description="Whether to copy players (requires copy_tiers)")
