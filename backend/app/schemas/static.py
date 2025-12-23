"""Pydantic schemas for Static"""

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


class StaticSettings(CamelModel):
    """Static settings schema"""

    display_order: list[str] = Field(
        default=["tank", "healer", "melee", "ranged", "caster"],
        description="Role order for display",
    )
    loot_priority: list[str] = Field(
        default=["melee", "ranged", "caster", "tank", "healer"],
        description="Role order for loot priority",
    )
    timezone: str = Field(default="America/New_York", description="Static timezone")
    auto_sync: bool = Field(default=False, description="Auto-sync enabled")
    sync_frequency: Literal["daily", "weekly"] = Field(
        default="weekly", description="Sync frequency"
    )


class StaticCreate(CamelModel):
    """Schema for creating a new static"""

    name: str = Field(..., min_length=1, max_length=100, description="Static name")
    tier: str = Field(..., description="Raid tier ID")
    settings: StaticSettings | None = Field(default=None, description="Optional custom settings")


class StaticUpdate(CamelModel):
    """Schema for updating a static"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    tier: str | None = Field(default=None)
    settings: StaticSettings | None = Field(default=None)


class StaticResponse(CamelModel):
    """Schema for static response (without players)"""

    id: str
    name: str
    tier: str
    share_code: str
    settings: StaticSettings
    created_at: str
    updated_at: str


# Forward reference for PlayerResponse (resolved in __init__.py)
class StaticWithPlayers(CamelModel):
    """Schema for static response with players"""

    id: str
    name: str
    tier: str
    share_code: str
    settings: StaticSettings
    players: list["PlayerResponse"] = Field(default_factory=list)
    created_at: str
    updated_at: str


# Import here to avoid circular imports
from .player import PlayerResponse  # noqa: E402, F401

StaticWithPlayers.model_rebuild()
