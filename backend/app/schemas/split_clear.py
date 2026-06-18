"""Schemas for the manual Split Clear Planner V1."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(x[0].upper() + x[1:] if x else "" for x in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


RunSlot = Literal["main", "alt"] | None
LootTarget = Literal["funnel_main", "funnel_job", "normal"]


class SplitClearSettingsUpdate(CamelModel):
    enabled: bool


class SplitClearAssignmentUpdate(CamelModel):
    """Partial assignment update; omitted fields remain unchanged."""

    main_character_name: str | None = Field(default=None, max_length=100)
    main_character_world: str | None = Field(default=None, max_length=100)
    alt_character_name: str | None = Field(default=None, max_length=100)
    alt_character_world: str | None = Field(default=None, max_length=100)
    run_a_character: RunSlot = None
    run_b_character: RunSlot = None
    loot_target: LootTarget | None = None
    loot_target_job: str | None = Field(default=None, max_length=10)
    run_a_cleared: bool | None = None
    run_b_cleared: bool | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator(
        "main_character_name",
        "main_character_world",
        "alt_character_name",
        "alt_character_world",
        "loot_target_job",
        "notes",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("loot_target_job")
    @classmethod
    def normalize_job(cls, value: str | None) -> str | None:
        return value.upper() if value else None

class SplitClearAssignmentResponse(CamelModel):
    id: str
    snapshot_player_id: str
    main_character_name: str | None
    main_character_world: str | None
    alt_character_name: str | None
    alt_character_world: str | None
    run_a_character: RunSlot
    run_b_character: RunSlot
    loot_target: str
    loot_target_job: str | None
    run_a_cleared: bool
    run_b_cleared: bool
    notes: str | None
    updated_at: str


class SplitClearResponse(CamelModel):
    enabled: bool
    assignments: list[SplitClearAssignmentResponse]
