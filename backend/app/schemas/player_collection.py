"""Schemas for player collection intent, snapshot, and smart suggestions."""

from pydantic import BaseModel


# ── Intent ────────────────────────────────────────────────────────────────────

class CollectionIntentUpsert(BaseModel):
    intent: str  # hunting | interested | pass | hidden
    priority: str = "medium"  # high | medium | low
    visibility: str = "private"  # private | static_only | dossier_public
    notes: str | None = None


class CollectionIntentResponse(BaseModel):
    id: str
    profile_id: str
    catalog_item_id: str
    intent: str
    priority: str
    visibility: str
    notes: str | None
    updated_at: str

    model_config = {"from_attributes": True}


# ── Snapshot ──────────────────────────────────────────────────────────────────

class CollectionSnapshotResponse(BaseModel):
    id: str
    profile_id: str
    catalog_item_id: str
    ownership_state: str
    token_count: int | None
    source: str
    confidence: str
    last_synced_at: str | None
    updated_at: str

    model_config = {"from_attributes": True}


# ── Suggestions ───────────────────────────────────────────────────────────────

class MemberSuggestionEntry(BaseModel):
    user_id: str
    display_name: str | None
    ownership_state: str  # have | missing | unknown
    intent: str | None  # hunting | interested | pass | hidden | null
    token_count: int | None
    can_buy: bool
    confidence: str  # high | medium | low
    reasons: list[str]


class StaticCollectionSuggestion(BaseModel):
    catalog_item_id: str
    catalog_item_name: str
    catalog_item_category: str | None  # mount | orchestrion | minion | weapon | etc.
    expansion: str | None  # e.g. "DT", "EW", "SHB"
    source_duty_name: str | None
    source_type: str | None  # extreme | savage | ultimate | criterion | etc.
    static_goal_id: str | None
    suggested_farm_score: float
    reason_summary: str
    members: list[MemberSuggestionEntry]


# ── Personal catalog (merged view) ───────────────────────────────────────────

class CatalogPlayerEntry(BaseModel):
    """A catalog item merged with the current player's intent and snapshot."""
    catalog_item_id: str
    catalog_item_name: str
    catalog_item_category: str | None
    expansion: str | None
    source_duty_name: str | None
    source_type: str | None
    # Player state (None when no record exists)
    ownership_state: str | None   # have | missing | unknown | null
    intent: str | None             # hunting | interested | pass | hidden | null
    priority: str | None
    visibility: str | None         # private | static_only | dossier_public | null
    token_count: int | None
    snapshot_source: str | None    # plugin | player_hub | manual | null
    last_synced_at: str | None


class CollectionSnapshotUpsert(BaseModel):
    ownership_state: str   # have | missing | unknown
    token_count: int | None = None


# ── Dossier public hunting list ───────────────────────────────────────────────

class DossierHuntingEntry(BaseModel):
    catalog_item_id: str
    catalog_item_name: str
    catalog_item_category: str
    source_duty_name: str | None
    source_type: str | None
    intent: str  # hunting | interested
    priority: str
