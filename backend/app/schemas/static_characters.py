"""Schemas for Static Character Registrations."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(x[0].upper() + x[1:] if x else "" for x in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


RoleInStatic = Literal["main", "alt", "substitute", "manual"]
RegistrationSource = Literal["player_hub", "lodestone", "manual"]


class CharacterRegistrationCreate(CamelModel):
    snapshot_player_id: str = Field(max_length=36)
    player_character_id: str | None = Field(default=None, max_length=36)
    manual_character_name: str | None = Field(default=None, max_length=100)
    manual_world: str | None = Field(default=None, max_length=100)
    manual_data_center: str | None = Field(default=None, max_length=50)
    role_in_static: RoleInStatic = "alt"
    job: str | None = Field(default=None, max_length=10)
    is_primary_for_static: bool = False
    source: RegistrationSource = "manual"


class CharacterRegistrationUpdate(CamelModel):
    role_in_static: RoleInStatic | None = None
    job: str | None = Field(default=None, max_length=10)
    is_primary_for_static: bool | None = None
    manual_character_name: str | None = Field(default=None, max_length=100)
    manual_world: str | None = Field(default=None, max_length=100)
    manual_data_center: str | None = Field(default=None, max_length=50)


class LinkedCharacterSummary(CamelModel):
    """Minimal summary of the linked PlayerHub character, embedded in registrations."""
    id: str
    name: str
    server: str
    data_center: str | None
    is_main: bool
    avatar_url: str | None
    last_synced_at: str | None


class CharacterRegistrationResponse(CamelModel):
    id: str
    static_group_id: str
    snapshot_player_id: str
    player_character_id: str | None
    manual_character_name: str | None
    manual_world: str | None
    manual_data_center: str | None
    role_in_static: str
    job: str | None
    is_primary_for_static: bool
    source: str
    last_synced_at: str | None
    created_at: str
    updated_at: str
    # Resolved display fields (populated by router from linked character)
    resolved_name: str | None
    resolved_world: str | None
    resolved_data_center: str | None
    linked_character: LinkedCharacterSummary | None


class StaticCharacterRegistrationsResponse(CamelModel):
    """All registrations for a static, keyed by snapshot_player_id."""
    registrations: dict[str, list[CharacterRegistrationResponse]]
    # Player Hub characters available to link but not yet registered, keyed by snapshot_player_id.
    available_for_linking: dict[str, list[LinkedCharacterSummary]] = {}
