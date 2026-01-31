"""Pydantic schemas for Static Groups and Memberships"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.constants import VALID_JOBS


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

# Legacy priority mode for backward compatibility
LegacyPriorityMode = Literal["automatic", "manual", "disabled"]

# New priority system mode
PrioritySystemMode = Literal["role-based", "job-based", "player-based", "manual-planning", "disabled"]

# Preset types for advanced options
PriorityPreset = Literal["balanced", "strict-fairness", "gear-need-focus", "custom"]


# --- Priority Config Schemas ---


class PriorityGroupConfig(CamelModel):
    """Configuration for a priority group (used in job-based and player-based modes)"""

    id: str = Field(..., description="Unique identifier for this group")
    name: str = Field(..., description="Display name for this group")
    sort_order: int = Field(default=0, description="Order in the list")
    base_priority: int = Field(default=0, description="Base priority for items in this group")


class JobPriorityConfig(CamelModel):
    """Job configuration within a group (for job-based mode)"""

    job: str = Field(..., description="Job abbreviation (e.g., 'DRG', 'WAR')")
    group_id: str = Field(..., description="ID of the group this job belongs to")
    sort_order: int = Field(default=0, description="Order within the group")
    priority_offset: int = Field(default=0, description="Priority adjustment for this job")


class PlayerPriorityConfig(CamelModel):
    """Player configuration within a group (for player-based mode)"""

    player_id: str = Field(..., description="ID of the player")
    group_id: str = Field(..., description="ID of the group this player belongs to")
    sort_order: int = Field(default=0, description="Order within the group")
    priority_offset: int = Field(default=0, description="Priority adjustment for this player")


class RoleBasedConfig(CamelModel):
    """Configuration for role-based priority mode"""

    role_order: list[RoleType] = Field(
        default=["melee", "ranged", "caster", "tank", "healer"],
        description="Role priority order",
    )


class JobBasedConfig(CamelModel):
    """Configuration for job-based priority mode"""

    groups: list[PriorityGroupConfig] = Field(default_factory=list, description="Job groups")
    jobs: list[JobPriorityConfig] = Field(default_factory=list, description="Job configurations")
    show_advanced_controls: bool = Field(default=False, description="Show priority offset inputs")


class PlayerBasedConfig(CamelModel):
    """Configuration for player-based priority mode"""

    groups: list[PriorityGroupConfig] = Field(default_factory=list, description="Player groups")
    players: list[PlayerPriorityConfig] = Field(default_factory=list, description="Player configurations")
    show_advanced_controls: bool = Field(default=False, description="Show priority offset inputs")


class AdvancedPriorityOptions(CamelModel):
    """Advanced priority calculation options"""

    show_priority_scores: bool = Field(default=True, description="Show priority scores in UI")
    preset: PriorityPreset = Field(default="balanced", description="Active preset")

    # Enhanced fairness options
    enable_enhanced_fairness: bool = Field(default=False, description="Enable drought bonus and balance penalty")
    drought_bonus_multiplier: int = Field(default=10, description="Points per week since last drop")
    drought_bonus_cap_weeks: int = Field(default=5, description="Max weeks to count for drought bonus")
    balance_penalty_multiplier: int = Field(default=15, description="Penalty per excess drop")
    balance_penalty_cap_drops: int = Field(default=3, description="Max excess drops to penalize")

    # Core multipliers
    role_priority_multiplier: int = Field(default=25, description="Points per role rank")
    gear_needed_multiplier: int = Field(default=10, description="Points per weighted gear need")
    loot_received_penalty: int = Field(default=15, description="Penalty per loot received")
    use_weighted_need: bool = Field(default=True, description="Weight gear slots by value")
    use_loot_adjustments: bool = Field(default=True, description="Apply per-player loot adjustments")


class StaticPrioritySettings(CamelModel):
    """Complete priority settings for a static group"""

    mode: PrioritySystemMode = Field(default="role-based", description="Priority system mode")

    # Mode-specific configs
    role_based_config: RoleBasedConfig | None = Field(default=None, description="Role-based mode config")
    job_based_config: JobBasedConfig | None = Field(default=None, description="Job-based mode config")
    player_based_config: PlayerBasedConfig | None = Field(default=None, description="Player-based mode config")

    # Advanced options (shared across modes)
    advanced_options: AdvancedPriorityOptions = Field(
        default_factory=AdvancedPriorityOptions,
        description="Advanced priority calculation options",
    )


# --- Static Settings Schema ---


class StaticSettingsSchema(CamelModel):
    """Settings for a static group (loot priority, etc.)"""

    loot_priority: list[RoleType] = Field(
        default=["melee", "ranged", "caster", "tank", "healer"],
        description="Role priority order for loot distribution (legacy, use priority_settings.role_based_config for new)",
    )
    hide_setup_banners: bool = Field(
        default=False,
        description="Hide 'Unclaimed' banners on player cards",
    )
    hide_bis_banners: bool = Field(
        default=False,
        description="Hide 'No BiS configured' banners on player cards",
    )
    # Legacy priority settings (for backward compatibility)
    priority_mode: LegacyPriorityMode = Field(
        default="automatic",
        description="Legacy priority calculation mode (automatic/manual/disabled)",
    )
    job_priority_modifiers: dict[str, int] | None = Field(
        default=None,
        description="Legacy per-job priority adjustments, e.g., {'PCT': 20, 'WAR': -10}. Values must be between -100 and 100.",
        json_schema_extra={
            "additionalProperties": {"type": "integer", "minimum": -100, "maximum": 100}
        },
    )
    show_priority_scores: bool = Field(
        default=True,
        description="Legacy: whether to show priority scores in the UI",
    )
    enable_enhanced_scoring: bool = Field(
        default=False,
        description="Legacy: enable drought bonus and balance penalty",
    )

    # New priority system (Phase 2)
    priority_settings: StaticPrioritySettings | None = Field(
        default=None,
        description="New priority system configuration. When set, overrides legacy priority fields.",
    )

    @field_validator("job_priority_modifiers")
    @classmethod
    def validate_job_priority_modifiers(cls, v: dict[str, int] | None) -> dict[str, int] | None:
        """Validate and normalize job modifier keys to uppercase"""
        if v is not None:
            normalized = {}
            for job, modifier in v.items():
                # Normalize to uppercase for consistent storage
                job_upper = job.upper()
                # Validate job abbreviation against whitelist
                if job.lower() not in VALID_JOBS:
                    valid_jobs_str = ", ".join(sorted(j.upper() for j in VALID_JOBS))
                    raise ValueError(
                        f"Invalid job abbreviation: {job}. Valid jobs: {valid_jobs_str}"
                    )
                # Validate modifier range
                if not -100 <= modifier <= 100:
                    raise ValueError(
                        f"Job modifier for {job} must be between -100 and 100, got {modifier}"
                    )
                normalized[job_upper] = modifier
            return normalized
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
