"""Pydantic schemas for CollectionGoal CRUD"""

from typing import Literal

from pydantic import BaseModel, Field

# Reward type — what is being tracked
CollectionGoalType = Literal[
    "mount", "token", "minion", "orchestrion", "glam", "custom_reward",
    "weapon", "weapon_coffer", "title", "clear_count",
]
CollectionGoalStatus = Literal["wanted", "farming", "scheduled", "complete"]
# Content type — where the reward comes from
CollectionContentType = Literal[
    "extreme", "savage", "ultimate", "criterion",
    "chaotic_alliance", "field_operation", "custom",
]


class CollectionGoalCreate(BaseModel):
    goal_type: CollectionGoalType
    content_type: CollectionContentType | None = None
    content_key: str | None = Field(None, max_length=50)
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
    content_type: CollectionContentType | None = None
    content_key: str | None = Field(None, max_length=50)
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
    content_type: str | None
    content_key: str | None
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
