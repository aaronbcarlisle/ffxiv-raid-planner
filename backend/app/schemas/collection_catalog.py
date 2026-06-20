"""Pydantic schemas for collection catalog items"""

from pydantic import BaseModel


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
