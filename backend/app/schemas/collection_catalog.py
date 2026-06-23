"""Pydantic schemas for collection catalog items"""

from pydantic import BaseModel, ConfigDict


def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CatalogItemResponse(BaseModel):
    id: str
    external_source: str
    external_id: str | None
    name: str
    category: str
    expansion: str | None
    patch: str | None
    icon_url: str | None
    image_url: str | None
    source_text: str | None
    source_type: str | None
    source_duty_name: str | None
    source_duty_key: str | None
    token_name: str | None
    token_cost: int | None
    token_item_id: int | None = None
    game_mount_id: int | None = None
    tradeable: bool | None
    rarity_owned_percent: float | None
    is_curated: bool
    notes: str | None = None

    model_config = {"from_attributes": True}


class CatalogSyncResult(BaseModel):
    seeded: bool = False
    synced_from_api: bool = False
    counts: dict[str, int] = {}
    error: str | None = None


class AuditEntry(BaseModel):
    total: int
    plugin_ready_mount: int
    manual_only_mount: int
    plugin_ready_token: int
    manual_only_token: int


class DtAuditDetail(BaseModel):
    total_mounts: int
    plugin_ready_mounts: int
    manual_only_mounts: int
    total_tokens: int
    plugin_ready_tokens: int
    manual_only_tokens: int
    missing_mount_ids: list[str]
    missing_token_ids: list[str]


class VerifiedIdMapping(BaseModel):
    """One entry from the plugin Lumina resolver — describes a single catalog row's resolved IDs."""

    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)

    source_duty_key: str
    reward_name: str
    game_mount_id: int | None = None
    token_name: str | None = None
    token_item_id: int | None = None
    confidence: str  # "exact" | "ambiguous" | "none"
    reason: str = ""
    token_reason: str | None = None
    verified_by: str = "plugin_lumina"  # "plugin_lumina" | "manual_verified"
    verified_at: str = ""


class VerifiedIdImportResult(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, serialize_by_alias=True)

    updated: int = 0
    already_set: int = 0
    skipped: int = 0
    errors: list[str] = []


class CatalogAuditReport(BaseModel):
    total: int
    plugin_ready_mounts: int
    manual_only_mounts: int
    plugin_ready_tokens: int
    manual_only_tokens: int
    by_category: dict[str, AuditEntry]
    by_expansion: dict[str, AuditEntry]
    dt_detail: DtAuditDetail
