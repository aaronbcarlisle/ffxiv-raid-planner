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
    recruitment_status: str = Field(default="closed", description="open | limited | closed")
    description: str | None = None
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


class DiscoveryListItem(CamelModel):
    """Public-safe DTO returned by the discovery endpoint"""

    name: str
    share_code: str
    recruitment_status: str
    description: str | None = None
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


class DiscoveryListResponse(CamelModel):
    """Response wrapper for discovery endpoint"""

    items: list[DiscoveryListItem]
    total: int
