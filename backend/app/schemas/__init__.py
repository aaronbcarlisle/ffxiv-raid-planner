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
    # Static
    "StaticCreate",
    "StaticResponse",
    "StaticSettings",
    "StaticUpdate",
    "StaticWithPlayers",
    # User/Auth
    "DiscordAuthUrl",
    "DiscordCallback",
    "RefreshTokenRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
]
