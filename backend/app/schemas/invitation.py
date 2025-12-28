"""Pydantic schemas for Invitations"""

from pydantic import BaseModel, ConfigDict, Field

from .static_group import MemberRoleEnum


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


# --- Invitation Schemas ---


class InvitationCreate(CamelModel):
    """Schema for creating a new invitation"""

    role: MemberRoleEnum = Field(
        default=MemberRoleEnum.MEMBER,
        description="Role to assign when invitation is accepted",
    )
    expires_in_days: int | None = Field(
        default=7,
        ge=1,
        le=30,
        description="Number of days until expiration (null for no expiration)",
    )
    max_uses: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description="Maximum number of times this invitation can be used",
    )


class InvitationResponse(CamelModel):
    """Schema for invitation response"""

    id: str
    static_group_id: str
    invite_code: str
    role: MemberRoleEnum
    expires_at: str | None = None
    max_uses: int | None = None
    use_count: int = 0
    is_active: bool = True
    is_valid: bool = True
    created_at: str
    created_by_id: str
    # Include group name for display
    static_group_name: str | None = None


class InvitationPreview(CamelModel):
    """Schema for public invitation preview (before accepting)"""

    invite_code: str
    static_group_name: str
    static_group_id: str
    role: MemberRoleEnum
    is_valid: bool
    expires_at: str | None = None
    # Whether the current user is already a member
    already_member: bool = False


class InvitationAcceptResponse(CamelModel):
    """Schema for accepting an invitation"""

    success: bool
    message: str
    static_group_id: str | None = None
    share_code: str | None = None
    role: MemberRoleEnum | None = None
