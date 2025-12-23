"""Pydantic schemas for Player"""

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


# Gear slot types
GearSlot = Literal[
    "weapon",
    "head",
    "body",
    "hands",
    "legs",
    "feet",
    "earring",
    "necklace",
    "bracelet",
    "ring1",
    "ring2",
]

GearSource = Literal["raid", "tome"]

RaidPosition = Literal["T1", "T2", "H1", "H2", "M1", "M2", "R1", "R2"]

TankRoleType = Literal["MT", "OT"]


class TomeWeaponStatus(CamelModel):
    """Tome weapon tracking status"""

    pursuing: bool = Field(default=False, description="Whether pursuing tome weapon")
    has_item: bool = Field(default=False, description="Has the tome weapon")
    is_augmented: bool = Field(default=False, description="Tome weapon is augmented")


class GearSlotStatus(CamelModel):
    """Status of a single gear slot"""

    slot: GearSlot
    bis_source: GearSource = Field(default="raid", description="Where BiS comes from")
    has_item: bool = Field(default=False, description="Player has this item")
    is_augmented: bool = Field(default=False, description="Item is augmented (tome only)")
    item_name: str | None = Field(default=None, description="Optional item name")
    item_level: int | None = Field(default=None, description="Optional item level")


class PlayerCreate(CamelModel):
    """Schema for creating a new player"""

    name: str = Field(default="", max_length=100, description="Player name")
    job: str = Field(default="", max_length=10, description="Job abbreviation")
    role: str = Field(default="", max_length=20, description="Role")
    position: RaidPosition | None = Field(default=None, description="Raid position")
    tank_role: TankRoleType | None = Field(default=None, description="Tank role")
    configured: bool = Field(default=False, description="Is player configured")
    sort_order: int = Field(default=0, description="Sort order")
    is_substitute: bool = Field(default=False, description="Is substitute player")
    notes: str | None = Field(default=None, description="Player notes")
    lodestone_id: str | None = Field(default=None, description="Lodestone ID")
    bis_link: str | None = Field(default=None, description="BiS link")
    fflogs_id: int | None = Field(default=None, description="FFLogs ID")
    gear: list[GearSlotStatus] = Field(default_factory=list, description="Gear status")
    tome_weapon: TomeWeaponStatus = Field(
        default_factory=TomeWeaponStatus, description="Tome weapon status"
    )


class PlayerUpdate(CamelModel):
    """Schema for updating a player"""

    name: str | None = Field(default=None, max_length=100)
    job: str | None = Field(default=None, max_length=10)
    role: str | None = Field(default=None, max_length=20)
    position: RaidPosition | None = Field(default=None)
    tank_role: TankRoleType | None = Field(default=None)
    configured: bool | None = Field(default=None)
    sort_order: int | None = Field(default=None)
    is_substitute: bool | None = Field(default=None)
    notes: str | None = Field(default=None)
    lodestone_id: str | None = Field(default=None)
    bis_link: str | None = Field(default=None)
    fflogs_id: int | None = Field(default=None)
    gear: list[GearSlotStatus] | None = Field(default=None)
    tome_weapon: TomeWeaponStatus | None = Field(default=None)


class PlayerResponse(CamelModel):
    """Schema for player response"""

    id: str
    static_id: str
    name: str
    job: str
    role: str
    position: RaidPosition | None = None
    tank_role: TankRoleType | None = None
    configured: bool
    sort_order: int
    is_substitute: bool
    notes: str | None = None
    lodestone_id: str | None = None
    bis_link: str | None = None
    fflogs_id: int | None = None
    last_sync: str | None = None
    gear: list[GearSlotStatus]
    tome_weapon: TomeWeaponStatus
    created_at: str
    updated_at: str
