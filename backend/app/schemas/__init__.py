"""Pydantic schemas"""

from .static import (
    StaticCreate,
    StaticUpdate,
    StaticResponse,
    StaticSettings,
    StaticWithPlayers,
)
from .player import (
    PlayerCreate,
    PlayerUpdate,
    PlayerResponse,
    GearSlotStatus,
    TomeWeaponStatus,
)

__all__ = [
    "StaticCreate",
    "StaticUpdate",
    "StaticResponse",
    "StaticSettings",
    "StaticWithPlayers",
    "PlayerCreate",
    "PlayerUpdate",
    "PlayerResponse",
    "GearSlotStatus",
    "TomeWeaponStatus",
]
