"""Pydantic schemas"""

from .invitation import (
    InvitationAcceptResponse,
    InvitationCreate,
    InvitationPreview,
    InvitationResponse,
)
from .static_group import (
    GroupSourceEnum,
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
    LinkedPlayerInfo,
    LinkedUserInfo,
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
    WeaponPrioritiesUpdate,
    WeaponPriority,
    WeaponPrioritySettingsUpdate,
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
    "LinkedPlayerInfo",
    "LinkedUserInfo",
    "TomeWeaponStatus",
    # Invitation
    "InvitationAcceptResponse",
    "InvitationCreate",
    "InvitationPreview",
    "InvitationResponse",
    # Static Group
    "GroupSourceEnum",
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
    "WeaponPrioritiesUpdate",
    "WeaponPriority",
    "WeaponPrioritySettingsUpdate",
    # User/Auth
    "DiscordAuthUrl",
    "DiscordCallback",
    "RefreshTokenRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
]
