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


class ParticipantRecordView(BaseModel):
    """The member's character record behind a farm row (S2a-1, R-S1-9), as merged."""

    character_id: str | None
    ownership_state: str
    token_count: int | None
    source: str
    updated_by_user_id: str | None = None
    updated_via: str | None = None
    state_changed_at: str | None = None
    token_count_updated_at: str | None = None
    last_synced_at: str | None = None

    model_config = {"from_attributes": True}


class ParticipantStateResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    static_group_id: str
    # `state`, `token_count` and `source` carry the merged values (R-S1-9).
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
    # The user's role in the static; None when they are no longer a member (R-P0-4).
    member_role: str | None = None
    # The row's provenance and the merge (S2a-1, R-S1-9): additive and optional.
    updated_by_user_id: str | None = None
    updated_via: str | None = None
    state_changed_at: str | None = None
    token_count_updated_at: str | None = None
    state_from_record: bool = False
    count_from_record: bool = False
    record: ParticipantRecordView | None = None
    # True when the count gate withheld this member's counts from the caller
    # (R-S2-13, vet I-1): a null `token_count` alone can also mean "no count yet".
    count_hidden: bool

    model_config = {"from_attributes": True}


class ParticipantWriteResponse(ParticipantStateResponse):
    """A farm-status PATCH's response (R-S2-11, R-S2-15): the cell as written, plus
    `undo_token`, which puts the write back exactly for ten minutes through the undo
    route. Null when minting failed; the write still committed."""

    undo_token: str | None = None


# A bulk Need's token for its 200 cells is about 60 KB (tests pin the room); a longer
# string is no token, refused before it is decrypted.
UNDO_TOKEN_MAX_LENGTH = 131_072


class UndoRequest(BaseModel):
    """The undo route's body (R-S2-11): an `undo_token` a farm-status write returned."""

    token: str = Field(..., min_length=1, max_length=UNDO_TOKEN_MAX_LENGTH)


class UndoResponse(BaseModel):
    """What an undo did, by part (a cell's row, and its record when the write wrote
    one): `restored` parts were put back; `skipped` ones had changed since (R-S2-11)."""

    restored: int
    skipped: int


class RecordOnlyCellResponse(BaseModel):
    """A claimant's record for a goal's item when they have no row for the goal (Q1, R-S2-13).

    `state` is `"have"` when the record says so, else null; `token_count` and the
    record's count follow the count gate, and `count_hidden` says when it withheld them.
    """

    user_id: str
    display_name: str | None = None
    member_role: str
    state: Literal["have"] | None
    token_count: int | None
    count_hidden: bool
    record: ParticipantRecordView


class GoalParticipantsResponse(BaseModel):
    """One goal's cells for the Progress tab (R-S2-13): its merged rows, as
    `list_participants` returns them, and its record-only cells."""

    goal_id: str
    participants: list[ParticipantStateResponse]
    record_only: list[RecordOnlyCellResponse]


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
    # The state the drop flipped the recipient out of (need/want); None when it caused no flip.
    recipient_prior_state: str | None = None

    model_config = {"from_attributes": True}
