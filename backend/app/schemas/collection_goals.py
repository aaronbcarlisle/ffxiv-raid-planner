"""Pydantic schemas for CollectionGoal CRUD"""

from typing import Literal

from pydantic import BaseModel, Field

CollectionGoalType = Literal["mount", "token", "minion", "orchestrion", "glam", "custom_reward"]
CollectionGoalStatus = Literal["wanted", "farming", "scheduled", "complete"]


class CollectionGoalCreate(BaseModel):
    goal_type: CollectionGoalType
    title: str = Field(..., min_length=1, max_length=200)
    status: CollectionGoalStatus = "wanted"
    summary: str | None = None
    linked_duty_id: str | None = None
    linked_reward_id: str | None = None
    target_count: int | None = Field(None, ge=0)
    current_count: int | None = Field(None, ge=0)
    note: str | None = None


class CollectionGoalUpdate(BaseModel):
    goal_type: CollectionGoalType | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    status: CollectionGoalStatus | None = None
    summary: str | None = None
    linked_duty_id: str | None = None
    linked_reward_id: str | None = None
    target_count: int | None = Field(None, ge=0)
    current_count: int | None = Field(None, ge=0)
    note: str | None = None
    completed_at: str | None = None


class CollectionGoalResponse(BaseModel):
    id: str
    static_group_id: str
    created_by_id: str | None
    goal_type: str
    title: str
    status: str
    summary: str | None
    linked_duty_id: str | None
    linked_reward_id: str | None
    target_count: int | None
    current_count: int | None
    note: str | None
    created_at: str
    updated_at: str
    completed_at: str | None

    model_config = {"from_attributes": True}
