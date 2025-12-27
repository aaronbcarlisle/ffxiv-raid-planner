"""Pydantic schemas"""

from .player import (
    GearSlotStatus,
    PlayerCreate,
    PlayerResponse,
    PlayerUpdate,
    TomeWeaponStatus,
)
from .static import (
    StaticCreate,
    StaticResponse,
    StaticSettings,
    StaticUpdate,
    StaticWithPlayers,
)
from .static_group import (
    MemberInfo,
    MemberRoleEnum,
    MembershipCreate,
    MembershipResponse,
    MembershipUpdate,
    OwnerInfo,
    StaticGroupCreate,
    StaticGroupListItem,
    StaticGroupResponse,
    StaticGroupUpdate,
    StaticGroupWithMembers,
)
from .user import (
    DiscordAuthUrl,
    DiscordCallback,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)

__all__ = [
    # Player
    "GearSlotStatus",
    "PlayerCreate",
    "PlayerResponse",
    "PlayerUpdate",
    "TomeWeaponStatus",
    # Static (legacy)
    "StaticCreate",
    "StaticResponse",
    "StaticSettings",
    "StaticUpdate",
    "StaticWithPlayers",
    # Static Group
    "MemberInfo",
    "MemberRoleEnum",
    "MembershipCreate",
    "MembershipResponse",
    "MembershipUpdate",
    "OwnerInfo",
    "StaticGroupCreate",
    "StaticGroupListItem",
    "StaticGroupResponse",
    "StaticGroupUpdate",
    "StaticGroupWithMembers",
    # User/Auth
    "DiscordAuthUrl",
    "DiscordCallback",
    "RefreshTokenRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
]
