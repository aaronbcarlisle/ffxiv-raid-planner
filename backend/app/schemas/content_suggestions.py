"""Pydantic schemas for static group content suggestions."""

from pydantic import BaseModel, ConfigDict, Field

from .static_group import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class VoteSummary(CamelModel):
    must_have: int = 0
    want: int = 0
    willing: int = 0
    not_interested: int = 0
    avoid: int = 0
    total: int = 0
    conflict_count: int = 0


class SuggestionVoterInfo(CamelModel):
    user_id: str
    display_name: str | None = None
    avatar_url: str | None = None


class SuggestionResponse(CamelModel):
    id: str
    static_group_id: str
    category: str
    title: str
    description: str | None = None
    status: str
    suggested_by_user_id: str
    suggested_by_display_name: str | None = None
    promoted_goal_id: str | None = None
    vote_summary: VoteSummary
    current_user_vote: str | None = None
    created_at: str
    updated_at: str


class SuggestionCreate(CamelModel):
    category: str = Field(..., description="One of the valid suggestion categories")
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class SuggestionUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, description="open | closed | rejected")


class SuggestionVoteUpsert(CamelModel):
    vote: str = Field(..., description="must_have | want | willing | not_interested | avoid")
    note: str | None = Field(default=None, max_length=500)


class PromoteToGoalRequest(CamelModel):
    priority: str = Field(..., description="required | preferred | optional")
    title: str | None = Field(default=None, max_length=200, description="Override title (uses suggestion title if omitted)")
    description: str | None = Field(default=None, max_length=2000)
