"""Pydantic schemas for CollectionGoal, RewardParticipantState, and RewardDropLog"""

from typing import Literal

from pydantic import BaseModel, Field

CollectionGoalType = Literal[
    "mount", "token", "minion", "orchestrion", "glam", "custom_reward",
    "weapon", "weapon_coffer", "title", "clear_count",
]
CollectionGoalStatus = Literal["wanted", "farming", "scheduled", "complete"]
CollectionContentType = Literal[
    "extreme", "savage", "ultimate", "criterion",
    "chaotic_alliance", "field_operation", "custom",
]
CollectionPriorityMode = Literal[
    "everyone_gets_one", "priority_order", "free_roll", "desired_only", "custom",
]

ParticipantState = Literal["need", "want", "have", "pass"]
ParticipantSource = Literal["manual", "player_hub", "plugin"]


# ── Collection Goal ─────────────────────────────────────────────────────────

class CollectionGoalCreate(BaseModel):
    goal_type: CollectionGoalType
    content_type: CollectionContentType | None = None
    content_key: str | None = Field(None, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    status: CollectionGoalStatus = "wanted"
    priority_mode: CollectionPriorityMode | None = None
    summary: str | None = None
    linked_duty_id: str | None = None
    linked_reward_id: str | None = None
    target_count: int | None = Field(None, ge=0)
    current_count: int | None = Field(None, ge=0)
    note: str | None = None
    catalog_item_id: str | None = None
    token_name: str | None = None
    token_cost: int | None = Field(None, ge=0)


class CollectionGoalFromSuggestion(BaseModel):
    """Create a goal pre-seeded with participant states from the suggestion engine."""
    catalog_item_id: str
    status: CollectionGoalStatus = "wanted"


class CollectionGoalUpdate(BaseModel):
    goal_type: CollectionGoalType | None = None
    content_type: CollectionContentType | None = None
    content_key: str | None = Field(None, max_length=50)
    title: str | None = Field(None, min_length=1, max_length=200)
    status: CollectionGoalStatus | None = None
    priority_mode: CollectionPriorityMode | None = None
    summary: str | None = None
    linked_duty_id: str | None = None
    linked_reward_id: str | None = None
    target_count: int | None = Field(None, ge=0)
    current_count: int | None = Field(None, ge=0)
    note: str | None = None
    completed_at: str | None = None
    token_name: str | None = None
    token_cost: int | None = Field(None, ge=0)


class ParticipantSummary(BaseModel):
    need: int = 0
    want: int = 0
    have: int = 0
    passing: int = 0
    total: int = 0


class CollectionGoalResponse(BaseModel):
    id: str
    static_group_id: str
    created_by_id: str | None
    goal_type: str
    content_type: str | None
    content_key: str | None
    title: str
    status: str
    priority_mode: str | None
    summary: str | None
    linked_duty_id: str | None
    linked_reward_id: str | None
    target_count: int | None
    current_count: int | None
    note: str | None
    created_at: str
    updated_at: str
    completed_at: str | None
    catalog_item_id: str | None = None
    token_name: str | None = None
    token_cost: int | None = None
    participant_summary: ParticipantSummary | None = None

    model_config = {"from_attributes": True}


# ── Participant States ───────────────────────────────────────────────────────

class ParticipantStateUpsert(BaseModel):
    state: ParticipantState
    token_count: int | None = Field(None, ge=0)
    priority_rank: int | None = Field(None, ge=1)
    notes: str | None = None


class ParticipantStateResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    static_group_id: str
    state: str
    token_count: int | None
    priority_rank: int | None
    source: str
    last_synced_at: str | None
    last_manual_override_at: str | None = None
    notes: str | None
    updated_at: str
    # Resolved display fields
    display_name: str | None = None

    model_config = {"from_attributes": True}


# ── Drop Log ─────────────────────────────────────────────────────────────────

class RewardDropCreate(BaseModel):
    recipient_user_id: str | None = None
    quantity: int = Field(1, ge=1, le=99)
    dropped_at: str | None = None
    notes: str | None = None


class RewardDropResponse(BaseModel):
    id: str
    goal_id: str
    static_group_id: str
    recipient_user_id: str | None
    created_by_id: str | None
    quantity: int
    dropped_at: str
    notes: str | None
    created_at: str
    recipient_display_name: str | None = None

    model_config = {"from_attributes": True}
