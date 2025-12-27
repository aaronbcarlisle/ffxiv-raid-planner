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
from .tier_snapshot import (
    RolloverRequest,
    RolloverResponse,
    SnapshotPlayerCreate,
    SnapshotPlayerResponse,
    SnapshotPlayerUpdate,
    TierSnapshotCreate,
    TierSnapshotResponse,
    TierSnapshotUpdate,
    TierSnapshotWithPlayers,
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
    # Player (legacy)
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
    # Tier Snapshot
    "RolloverRequest",
    "RolloverResponse",
    "SnapshotPlayerCreate",
    "SnapshotPlayerResponse",
    "SnapshotPlayerUpdate",
    "TierSnapshotCreate",
    "TierSnapshotResponse",
    "TierSnapshotUpdate",
    "TierSnapshotWithPlayers",
    # User/Auth
    "DiscordAuthUrl",
    "DiscordCallback",
    "RefreshTokenRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
]
