"""Pydantic schemas"""

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
    GearSlotStatus,
    RolloverRequest,
    RolloverResponse,
    SnapshotPlayerCreate,
    SnapshotPlayerResponse,
    SnapshotPlayerUpdate,
    TierSnapshotCreate,
    TierSnapshotResponse,
    TierSnapshotUpdate,
    TierSnapshotWithPlayers,
    TomeWeaponStatus,
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
    # Gear Status (from tier_snapshot)
    "GearSlotStatus",
    "TomeWeaponStatus",
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
