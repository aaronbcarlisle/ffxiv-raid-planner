"""Pydantic schemas for static discovery API"""

from pydantic import BaseModel, ConfigDict, Field

from .static_group import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class DiscoverySettings(CamelModel):
    """Discovery settings stored under StaticGroup.settings['discovery']"""

    enabled: bool = False
    recruitment_status: str = Field(default="closed", description="open | selective | paused | closed (legacy: limited)")
    description: str | None = None
    contact_method: str | None = Field(
        default=None, description="discord | discord_server | url | text"
    )
    contact_value: str | None = Field(default=None, max_length=200)
    intensity: str | None = Field(default=None, description="casual | midcore | hardcore")
    languages: list[str] | None = None
    data_center: str | None = None
    server: str | None = None
    timezone: str | None = None
    needed_roles: list[str] | None = None
    needed_jobs: list[str] | None = None
    schedule_days: list[str] | None = None
    schedule_start_time: str | None = None
    schedule_end_time: str | None = None
    show_member_count: bool = False
    recruiting_roles: list[dict] | None = None
    communication_style: dict | None = None


class GoalAlignmentSummarySlim(CamelModel):
    """Compact alignment summary for discovery cards."""
    aligned: int = 0
    partial: int = 0
    conflicts: int = 0
    missing: int = 0
    unknown: int = 0


class FitGoals(CamelModel):
    """Goal dimension of the fit summary."""
    aligned: int = 0
    partial: int = 0
    conflicts: int = 0
    missing: int = 0


class FitJobs(CamelModel):
    """Job dimension of the fit summary."""
    status: str = "unknown"  # "match"|"partial"|"none"|"unknown"
    matched_jobs: list[str] = Field(default_factory=list)


class FitSchedule(CamelModel):
    """Schedule dimension of the fit summary."""
    status: str = "unknown"  # "match"|"partial"|"conflict"|"unknown"


class FitComms(CamelModel):
    """Communications/language dimension of the fit summary."""
    status: str = "unknown"  # "match"|"partial"|"conflict"|"unknown"


class FitBis(CamelModel):
    """BiS readiness dimension of the fit summary."""
    status: str = "unknown"  # "ready"|"partial"|"unknown"


class FitSummary(CamelModel):
    """Deterministic, explainable fit summary for a player vs. a static listing.

    Only computed for authenticated users with a discoverable PlayerProfile.
    Private goals and BiS targets are never used.
    """
    overall: str  # "strong"|"good"|"partial"|"weak"|"unknown"
    goals: FitGoals
    jobs: FitJobs
    schedule: FitSchedule
    comms: FitComms
    bis: FitBis


class DiscoveryListItem(CamelModel):
    """Public-safe DTO returned by the discovery endpoint"""

    name: str
    share_code: str
    recruitment_status: str
    description: str | None = None
    contact_method: str | None = None
    contact_value: str | None = None
    needed_roles: list[str] | None = None
    needed_jobs: list[str] | None = None
    schedule_days: list[str] | None = None
    schedule_start_time: str | None = None
    schedule_end_time: str | None = None
    timezone: str | None = None
    languages: list[str] | None = None
    intensity: str | None = None
    data_center: str | None = None
    server: str | None = None
    member_count: int = 0
    last_updated: str | None = None
    recruiting_roles: list[dict] | None = None
    communication_style: dict | None = None
    # Goal fields (public — only official static objective categories)
    objective_categories: list[str] = Field(default_factory=list)
    goal_alignment: GoalAlignmentSummarySlim | None = None
    # Fit summary — None when unauthenticated or player has no discoverable profile
    fit_summary: FitSummary | None = None


class DiscoveryListResponse(CamelModel):
    """Response wrapper for discovery endpoint"""

    items: list[DiscoveryListItem]
    total: int
