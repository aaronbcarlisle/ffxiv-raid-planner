"""Pydantic schemas for the shared BiS Target Set API (/api/bis-targets)."""

from pydantic import Field

from .user import CamelModel


class BiSTargetSetResponse(CamelModel):
    """Shared BiS target set — works for player hub and roster contexts."""

    id: str
    owner_type: str
    owner_id: str

    job_profile_id: str | None = None
    snapshot_player_id: str | None = None
    group_id: str | None = None
    profile_id: str | None = None

    job: str
    name: str
    purpose: str
    source_type: str
    external_url: str | None = None
    import_status: str
    is_active: bool
    patch: str | None = None
    item_level: int | None = None
    notes: str | None = None
    items_json: dict | None = None

    created_by: str | None = None
    created_at: str
    updated_at: str


class BiSTargetSetCreate(CamelModel):
    """Create a new BiS target set (shared endpoint)."""

    owner_type: str = Field(..., max_length=30)
    owner_id: str = Field(..., max_length=36)

    # Caller must supply group_id when owner_type is roster_member_job or static_tier_job
    group_id: str | None = Field(default=None, max_length=36)

    name: str = Field(..., min_length=1, max_length=200)
    purpose: str = Field(default="savage", max_length=20)
    source_type: str = Field(default="manual", max_length=20)
    external_url: str | None = Field(default=None, max_length=2000)
    import_status: str = Field(default="linked_only", max_length=20)
    patch: str | None = Field(default=None, max_length=20)
    item_level: int | None = None
    notes: str | None = Field(default=None, max_length=500)


class BiSTargetSetUpdate(CamelModel):
    """Update a BiS target set (all fields optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = Field(default=None, max_length=20)
    source_type: str | None = Field(default=None, max_length=20)
    external_url: str | None = Field(default=None, max_length=2000)
    import_status: str | None = Field(default=None, max_length=20)
    patch: str | None = Field(default=None, max_length=20)
    item_level: int | None = None
    notes: str | None = Field(default=None, max_length=500)
