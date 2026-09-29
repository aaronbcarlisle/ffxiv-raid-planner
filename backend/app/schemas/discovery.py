"""Pydantic schemas for static discovery API"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, SerializeAsAny

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


# --- Static Finder V2 fit (Stage 4 SF1a, plan R-SF-A) — additive, null without fitV2 ---


class FitNight(CamelModel):
    """One listed raid night (R-SF-C).

    Contract: `localDay`/`localStart`/`localEnd` are present whenever the listing
    has times (start, end and a loadable listing zone), in the viewer's display
    zone: the newest typical-week row's zone, else `viewerTz`, else UTC. They are
    None only when the window can't be placed on a clock. `coverage` is None when
    the viewer has no typical week to test; `FitV2Schedule.basis` names how
    coverage was judged.
    """
    day: str  # the listing's iCal code
    local_day: str | None  # viewer's iCal code of the raid start; None when the window isn't placed
    local_start: str | None  # "HH:MM" in the viewer's display zone
    local_end: str | None
    coverage: Literal["full", "part", "none"] | None  # None: no typical week to test


class FitV2Role(CamelModel):
    status: Literal["match", "partial", "none", "unknown"]
    matched_job: str | None = None
    matched_role: str | None = None
    priority: Literal["needed", "nice_to_have"] | None = None
    is_main: bool = False
    as_role: str | None = None


class FitV2Schedule(CamelModel):
    """`basis` names how coverage was judged: "time" per 30-minute slot against the
    viewer's typical week, "day" by weekday only (or not at all: status "unknown").
    `nights` has one entry per listed day whenever the listing has days; each carries
    local times whenever the listing has times (see FitNight)."""
    status: Literal["match", "partial", "conflict", "unknown"]
    basis: Literal["time", "day"]
    nights: list[FitNight] = Field(default_factory=list)


class FitReason(CamelModel):
    """One reason row; it carries no English, the frontend owns the copy (R-SF-P)."""
    kind: Literal["role", "schedule", "goals", "comms", "bis"]
    status: Literal["match", "partial", "conflict"]
    params: dict[str, Any] = Field(default_factory=dict)


class FitV2(CamelModel):
    tier: Literal["strong", "good", "partial", "weak", "unknown"]
    missing: list[Literal["template", "jobs"]] = Field(default_factory=list)
    role: FitV2Role
    schedule: FitV2Schedule
    reasons: list[FitReason] = Field(default_factory=list)

    @classmethod
    def from_raw(cls, raw: dict) -> "FitV2":
        """Convert `finder_fit.compute_fit_v2()` dict output to the schema object."""
        role = raw["role"]
        schedule = raw["schedule"]
        return cls(
            tier=raw["tier"],
            missing=raw["missing"],
            role=FitV2Role(
                status=role["status"],
                matched_job=role["matched_job"],
                matched_role=role["matched_role"],
                priority=role["priority"],
                is_main=role["is_main"],
                as_role=role["as_role"],
            ),
            schedule=FitV2Schedule(
                status=schedule["status"],
                basis=schedule["basis"],
                nights=[FitNight(**night) for night in schedule["nights"]],
            ),
            reasons=[FitReason(**reason) for reason in raw["reasons"]],
        )


class FitCounts(CamelModel):
    """Tier counts over the whole filtered set, before pagination (R-SF-F)."""
    strong: int = 0
    good: int = 0
    partial: int = 0
    weak: int = 0
    unknown: int = 0


class FitViewer(CamelModel):
    main_job: str | None
    main_role: str | None
    missing: list[Literal["template", "jobs"]] = Field(default_factory=list)


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
    # Static Finder V2 fit — None for guests or without fitV2 (R-SF-A)
    fit_v2: FitV2 | None = None


class FinderListItem(DiscoveryListItem):
    """A list item for a signed-in fitV2 caller: carries the static's id (OWNER-3).

    Built only on that path, so guests and V1 requests get no `id` key at all
    (tests/test_discovery.py guards "must not leak internal IDs").
    """

    id: str


class DiscoveryListResponse(CamelModel):
    """Response wrapper for discovery endpoint"""

    # SerializeAsAny: a FinderListItem keeps its `id`; a plain item has no `id` key.
    items: list[SerializeAsAny[DiscoveryListItem]]
    total: int
    fit_counts: FitCounts | None = None
    viewer: FitViewer | None = None
