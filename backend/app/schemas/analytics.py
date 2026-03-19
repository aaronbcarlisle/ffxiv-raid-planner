"""Pydantic schemas for analytics and error reporting."""

from pydantic import Field

from .tier_snapshot import CamelModel


# --- Request Schemas ---


class AnalyticsEventIn(CamelModel):
    """A single analytics event from the frontend."""

    event_category: str
    event_name: str
    event_data: dict | None = None
    page_url: str | None = None


class AnalyticsEventBatch(CamelModel):
    """Batch of analytics events (max 50 per request)."""

    session_id: str = Field(default="", max_length=36)
    events: list[AnalyticsEventIn] = Field(min_length=1, max_length=50)


class ErrorReportIn(CamelModel):
    """A single error report from the frontend."""

    fingerprint: str
    error_type: str
    message: str
    stack_trace: str | None = None
    context: dict
    severity: str = "error"


# --- Response Schemas ---


class OverviewResponse(CamelModel):
    """KPI overview for the admin analytics dashboard."""

    total_users: int
    total_statics: int
    avg_claimed_cards: float
    # Explicit aliases: to_camel uses .title() which capitalizes letters after
    # digits (e.g. "24h" → "24H"), so we override to get correct camelCase.
    errors_24h: int = Field(serialization_alias="errors24h")
    users_change_7d: int = Field(serialization_alias="usersChange7d")
    statics_change_7d: int = Field(serialization_alias="staticsChange7d")


class GrowthPoint(CamelModel):
    """A single date/count point in a growth time series."""

    date: str
    count: int


class GrowthResponse(CamelModel):
    """Time-series growth data for users and statics."""

    users: list[GrowthPoint]
    statics: list[GrowthPoint]


class TopUserItem(CamelModel):
    """A user entry in the top users list."""

    user_id: str
    username: str
    avatar_url: str | None
    statics_created: int
    statics_joined: int
    last_active: str | None


class TopStaticItem(CamelModel):
    """A static entry in the top statics list."""

    static_id: str
    name: str
    member_count: int
    loot_entries: int
    last_log: str | None


class UsageEventItem(CamelModel):
    """A single event type's usage statistics."""

    event_name: str
    category: str
    count: int
    unique_users: int


class UsageResponse(CamelModel):
    """Feature usage statistics."""

    events: list[UsageEventItem]
    total_events: int


class ErrorGroupItem(CamelModel):
    """A grouped error entry (aggregated by fingerprint)."""

    fingerprint: str
    message: str
    error_type: str
    severity: str
    source: str
    count: int
    affected_users: int
    first_seen: str
    last_seen: str
    is_reviewed: bool


class ErrorGroupListResponse(CamelModel):
    """Paginated list of grouped errors."""

    errors: list[ErrorGroupItem]
    total: int
    page: int
    page_size: int


class ErrorDetailItem(CamelModel):
    """A single error occurrence."""

    id: int
    user_id: str | None
    session_id: str | None
    message: str
    stack_trace: str | None
    context: dict
    severity: str
    source: str
    created_at: str


class ErrorGroupDetailResponse(CamelModel):
    """Detailed view of a single error group with recent occurrences."""

    fingerprint: str
    message: str
    error_type: str
    count: int
    affected_users: int
    first_seen: str
    last_seen: str
    is_reviewed: bool
    occurrences: list[ErrorDetailItem]
