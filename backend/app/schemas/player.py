"""Pydantic schemas for Player Profile, Character, Gear, and Job endpoints."""

from pydantic import Field

from .user import CamelModel


# --- Player Profile ---

class PlayerProfileResponse(CamelModel):
    """Player profile summary (owner view)."""

    id: str
    user_id: str
    visibility: str
    share_code: str | None = None
    share_enabled: bool = False
    bio: str | None = None
    created_at: str
    updated_at: str
    characters: list["PlayerCharacterResponse"] = []
    job_profiles: list["PlayerJobProfileResponse"] = []


class PublicPlayerProfileResponse(CamelModel):
    """Read-only public profile view via share code. No private fields."""

    id: str
    bio: str | None = None
    characters: list["PlayerCharacterResponse"] = []
    job_profiles: list["PlayerJobProfileResponse"] = []


class PlayerProfileUpdate(CamelModel):
    """Update player profile fields."""

    visibility: str | None = Field(default=None, max_length=20)
    bio: str | None = Field(default=None, max_length=500)
    share_enabled: bool | None = None


# --- Player Character ---

class PlayerCharacterResponse(CamelModel):
    """Linked FFXIV character."""

    id: str
    lodestone_id: str
    name: str
    server: str
    data_center: str | None = None
    avatar_url: str | None = None
    is_main: bool
    created_at: str
    updated_at: str


class PlayerCharacterCreate(CamelModel):
    """Link a new FFXIV character."""

    lodestone_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    server: str = Field(..., min_length=1, max_length=100)
    data_center: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=2000)
    is_main: bool = True


class PlayerCharacterUpdate(CamelModel):
    """Update a linked character."""

    is_main: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=100)
    server: str | None = Field(default=None, min_length=1, max_length=100)
    data_center: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=2000)


# --- Gear Snapshot ---

class GearSnapshotResponse(CamelModel):
    """Gear snapshot for a character + job."""

    id: str
    character_id: str
    job: str
    gear: list[dict]
    avg_item_level: int
    source: str
    synced_at: str | None = None
    last_plugin_seen_at: str | None = None
    created_at: str
    updated_at: str


class GearSyncRequest(CamelModel):
    """Request to sync gear for a character."""

    job: str | None = None  # If None, sync currently equipped job
    force_refresh: bool = False


class GearSyncResult(CamelModel):
    """Result of a gear sync operation."""

    snapshot_id: str
    job: str
    avg_item_level: int
    source: str
    synced_at: str
    slot_count: int
    gear: list[dict]


# --- Player BiS Target Set ---

class PlayerBisTargetSetResponse(CamelModel):
    """One BiS target configuration for a specific job profile (player hub view).

    profile_id / job_profile_id are nullable because the underlying bis_target_sets
    table is now shared across player hub and roster contexts.
    """

    id: str
    owner_type: str = "player_job_profile"
    owner_id: str = ""
    profile_id: str | None = None
    job_profile_id: str | None = None
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
    created_at: str
    updated_at: str


class PlayerBisTargetSetCreate(CamelModel):
    """Create a new BiS target set via the legacy player-scoped endpoint."""

    name: str = Field(..., min_length=1, max_length=200)
    purpose: str = Field(default="savage", max_length=20)
    source_type: str = Field(default="manual", max_length=20)
    external_url: str | None = Field(default=None, max_length=2000)
    import_status: str = Field(default="linked_only", max_length=20)
    patch: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


class PlayerBisTargetSetUpdate(CamelModel):
    """Update a BiS target set via the legacy player-scoped endpoint."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = Field(default=None, max_length=20)
    source_type: str | None = Field(default=None, max_length=20)
    external_url: str | None = Field(default=None, max_length=2000)
    import_status: str | None = Field(default=None, max_length=20)
    patch: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


# --- Player Job Profile ---

class PlayerJobProfileResponse(CamelModel):
    """Job profile (main/alt/flex tracking)."""

    id: str
    job: str
    role: str
    priority: str
    readiness: str
    notes: str | None = None
    gear_snapshot_id: str | None = None
    gear_snapshot: GearSnapshotResponse | None = None
    bis_targets: list["PlayerBisTargetSetResponse"] = []
    created_at: str
    updated_at: str


class PlayerJobProfileCreate(CamelModel):
    """Create a new job profile."""

    job: str = Field(..., min_length=2, max_length=10)
    role: str = Field(..., min_length=2, max_length=20)
    priority: str = Field(default="flex", max_length=20)
    readiness: str = Field(default="unknown", max_length=20)
    notes: str | None = Field(default=None, max_length=500)


class PlayerJobProfileUpdate(CamelModel):
    """Update a job profile."""

    priority: str | None = Field(default=None, max_length=20)
    readiness: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


# --- Player Goals ---

class PlayerGoalResponse(CamelModel):
    """Player goal (collection/hunt or personal)."""

    id: str
    title: str
    description: str | None = None
    goal_type: str
    category: str | None = None
    status: str
    current_count: int = 0
    target_count: int | None = None
    source_content: str | None = None
    source_item: str | None = None
    linked_character_id: str | None = None
    linked_job: str | None = None
    due_date: str | None = None
    created_at: str
    updated_at: str


class PlayerGoalCreate(CamelModel):
    """Create a new player goal."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    goal_type: str = Field(..., max_length=30)
    category: str | None = Field(default=None, max_length=30)
    status: str = Field(default="active", max_length=20)
    current_count: int = Field(default=0, ge=0)
    target_count: int | None = Field(default=None, ge=1)
    source_content: str | None = Field(default=None, max_length=200)
    source_item: str | None = Field(default=None, max_length=200)
    linked_character_id: str | None = Field(default=None, max_length=36)
    linked_job: str | None = Field(default=None, max_length=10)
    due_date: str | None = Field(default=None, max_length=30)


class PlayerGoalUpdate(CamelModel):
    """Update a player goal."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, max_length=20)
    current_count: int | None = Field(default=None, ge=0)
    target_count: int | None = Field(default=None, ge=1)
    source_content: str | None = Field(default=None, max_length=200)
    source_item: str | None = Field(default=None, max_length=200)
    linked_character_id: str | None = Field(default=None, max_length=36)
    linked_job: str | None = Field(default=None, max_length=10)
    due_date: str | None = Field(default=None, max_length=30)


# --- Plugin Gear Sync ---

class PluginPlayerGearSlot(CamelModel):
    """Single gear slot from plugin sync."""

    slot: str
    has_item: bool = False
    current_source: str = "unknown"
    is_augmented: bool = False
    item_id: int | None = None
    item_name: str | None = None
    item_level: int | None = None
    item_icon: str | None = None
    materia: list[dict] | None = None


class PluginPlayerGearSyncRequest(CamelModel):
    """Plugin gear sync payload for player-owned character."""

    character_name: str = Field(..., min_length=1, max_length=100)
    character_world: str = Field(..., min_length=1, max_length=100)
    job: str = Field(..., min_length=2, max_length=10)
    gear: list[PluginPlayerGearSlot]
    source: str = "plugin"
    plugin_version: str | None = None


class PluginPlayerGearSyncResult(CamelModel):
    """Result of plugin player gear sync."""

    character_id: str
    snapshot_id: str
    job: str
    avg_item_level: int
    slot_count: int
    source: str
    synced_at: str
    gear_changed: bool = True
    last_plugin_seen_at: str | None = None


# --- Plugin Batch Gearset Sync ---

class PluginGearsetEntry(CamelModel):
    """One saved gearset from the plugin (single job)."""

    gearset_index: int = -1
    gearset_name: str = Field(default="", max_length=100)
    job: str = Field(..., min_length=2, max_length=10)
    class_job_id: int = 0
    gear: list[PluginPlayerGearSlot]


class PluginBatchGearsetSyncRequest(CamelModel):
    """Batch payload: multiple saved gearsets uploaded in one call."""

    character_name: str = Field(..., min_length=1, max_length=100)
    character_world: str = Field(..., min_length=1, max_length=100)
    gearsets: list[PluginGearsetEntry]
    source: str = "plugin"
    plugin_version: str | None = None


class PluginBatchGearsetSyncJobResult(CamelModel):
    """Per-job result inside a batch sync response."""

    job: str
    snapshot_id: str
    gear_changed: bool
    avg_item_level: int
    last_plugin_seen_at: str


class PluginBatchGearsetSyncResult(CamelModel):
    """Result of a batch gearset sync call."""

    character_id: str
    total_synced: int
    total_unchanged: int
    synced_jobs: list[PluginBatchGearsetSyncJobResult]


# Rebuild forward references
PlayerProfileResponse.model_rebuild()
PublicPlayerProfileResponse.model_rebuild()
PlayerJobProfileResponse.model_rebuild()
PlayerBisTargetSetResponse.model_rebuild()
