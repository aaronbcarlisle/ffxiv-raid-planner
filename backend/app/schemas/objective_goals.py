"""Pydantic schemas for StaticObjectiveGoal CRUD."""

from pydantic import Field

from .user import CamelModel


class StaticObjectiveGoalCreate(CamelModel):
    """Create a new static objective goal."""

    category: str = Field(..., max_length=30)
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: str = Field(..., max_length=20)


class StaticObjectiveGoalUpdate(CamelModel):
    """Update an existing static objective goal."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: str | None = Field(default=None, max_length=20)


class StaticObjectiveGoalResponse(CamelModel):
    """Static objective goal response."""

    id: str
    static_group_id: str
    created_by_id: str | None
    category: str
    title: str
    description: str | None
    priority: str
    created_at: str
    updated_at: str
