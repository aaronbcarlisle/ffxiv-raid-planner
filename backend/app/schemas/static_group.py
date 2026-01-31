"""Pydantic schemas for Static Groups and Memberships"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases for JSON serialization"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,  # Ensure JSON output uses camelCase
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

# Priority mode for loot distribution
PriorityMode = Literal["automatic", "manual", "disabled"]


# --- Static Settings Schema ---


class StaticSettingsSchema(CamelModel):
    """Settings for a static group (loot priority, etc.)"""

    loot_priority: list[RoleType] = Field(
        default=["melee", "ranged", "caster", "tank", "healer"],
        description="Role priority order for loot distribution",
    )
    hide_setup_banners: bool = Field(
        default=False,
        description="Hide 'Unclaimed' banners on player cards",
    )
    hide_bis_banners: bool = Field(
        default=False,
        description="Hide 'No BiS configured' banners on player cards",
    )
    # Priority settings (Phase 1 enhancement)
    priority_mode: PriorityMode = Field(
        default="automatic",
        description="Priority calculation mode: automatic (system calculates), manual (show but don't suggest), disabled (equal priority)",
    )
    job_priority_modifiers: dict[str, int] | None = Field(
        default=None,
        description="Per-job priority adjustments, e.g., {'PCT': 20, 'WAR': -10}. Values must be between -100 and 100.",
        json_schema_extra={
            "additionalProperties": {"type": "integer", "minimum": -100, "maximum": 100}
        },
    )
    show_priority_scores: bool = Field(
        default=True,
        description="Whether to show priority scores in the UI",
    )
    enable_enhanced_scoring: bool = Field(
        default=False,
        description="Enable drought bonus and balance penalty in priority calculation",
    )

    @field_validator("job_priority_modifiers")
    @classmethod
    def validate_job_priority_modifiers(cls, v: dict[str, int] | None) -> dict[str, int] | None:
        """Validate that all job modifier values are within -100 to +100 range"""
        if v is not None:
            for job, modifier in v.items():
                if not -100 <= modifier <= 100:
                    raise ValueError(
                        f"Job modifier for {job} must be between -100 and 100, got {modifier}"
                    )
        return v


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
    # True if user_role is granted via admin privileges (not actual membership)
    is_admin_access: bool = False


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
    # True if user_role is granted via admin privileges (not actual membership)
    is_admin_access: bool = False


class StaticGroupListItem(CamelModel):
    """Schema for static group in a list (user's dashboard)"""

    id: str
    name: str
    share_code: str
    is_public: bool
    owner_id: str
    member_count: int = 0
    user_role: MemberRoleEnum | None = None
    # Always false for dashboard list items (admin uses admin dashboard)
    is_admin_access: bool = False
    source: GroupSourceEnum = GroupSourceEnum.MEMBERSHIP
    settings: StaticSettingsSchema | None = None
    created_at: str
    updated_at: str


class DuplicateGroupRequest(CamelModel):
    """Schema for duplicating a static group with all tiers/players"""

    new_name: str = Field(..., min_length=1, max_length=100, description="Name for the duplicated group")
    copy_tiers: bool = Field(default=True, description="Whether to copy tier snapshots")
    copy_players: bool = Field(default=True, description="Whether to copy players (requires copy_tiers)")


class AdminStaticGroupListItem(CamelModel):
    """Schema for static group in admin list (includes owner info)"""

    id: str
    name: str
    share_code: str
    is_public: bool
    owner_id: str
    owner: OwnerInfo | None = None
    member_count: int = 0
    tier_count: int = 0
    created_at: str
    updated_at: str


class AdminStaticGroupListResponse(CamelModel):
    """Paginated response for admin static group list"""

    items: list[AdminStaticGroupListItem]
    total: int
    limit: int
    offset: int


class InteractedUserInfo(CamelModel):
    """User who has interacted with a group (member or linked player)"""

    user: MemberInfo  # Basic user info (LinkedUserInfo extends this with member_role)
    is_member: bool
    member_role: str | None = None  # Only present if is_member=True
