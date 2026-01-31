"""Pydantic schemas for Weekly Assignment operations"""

from pydantic import Field

from .static_group import CamelModel


class WeeklyAssignmentCreate(CamelModel):
    """Schema for creating a weekly assignment"""

    tier_id: str = Field(..., description="Tier identifier (e.g., 'aac-lightweight')")
    week: int = Field(..., ge=1, description="Week number (1-indexed)")
    floor: str = Field(..., description="Floor identifier (e.g., 'M9S')")
    slot: str = Field(..., description="Slot identifier (e.g., 'head', 'body', 'twine')")
    player_id: str | None = Field(default=None, description="Player ID to assign")
    sort_order: int = Field(default=0, description="Order for multiple assignments")
    did_not_drop: bool = Field(default=False, description="Mark slot as did not drop")


class WeeklyAssignmentUpdate(CamelModel):
    """Schema for updating a weekly assignment"""

    player_id: str | None = Field(default=None, description="Player ID to assign")
    sort_order: int | None = Field(default=None, description="Order for multiple assignments")
    did_not_drop: bool | None = Field(default=None, description="Mark slot as did not drop")


class WeeklyAssignmentResponse(CamelModel):
    """Schema for weekly assignment response"""

    id: str
    static_group_id: str
    tier_id: str
    week: int
    floor: str
    slot: str
    player_id: str | None = None
    player_name: str | None = None  # Convenience field
    player_job: str | None = None  # Convenience field
    sort_order: int
    did_not_drop: bool
    created_at: str
    updated_at: str


class WeeklyAssignmentBulkCreate(CamelModel):
    """Schema for bulk creating weekly assignments"""

    tier_id: str = Field(..., description="Tier identifier")
    week: int = Field(..., ge=1, description="Week number")
    assignments: list[WeeklyAssignmentCreate] = Field(
        ..., description="List of assignments to create"
    )


class WeeklyAssignmentBulkDelete(CamelModel):
    """Schema for bulk deleting weekly assignments"""

    tier_id: str = Field(..., description="Tier identifier")
    week: int = Field(..., ge=1, description="Week number")
    floor: str | None = Field(default=None, description="Optional floor filter")
    slot: str | None = Field(default=None, description="Optional slot filter")
