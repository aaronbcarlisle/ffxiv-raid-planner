"""Mount Farm Tracker Schemas"""

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    components = string.split("_")
    return components[0] + "".join(x[0].upper() + x[1:] if x else "" for x in components[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


# --- Manual update schemas (existing) ---

class MountFarmProgressUpdate(CamelModel):
    trial_id: str
    user_id: str | None = None
    has_mount: bool | None = None
    wants_mount: bool | None = None
    totem_count: int | None = Field(None, ge=0, le=999)
    notes: str | None = None


class MountFarmProgressBulkUpdate(CamelModel):
    updates: list[MountFarmProgressUpdate]


# --- Plugin sync schemas ---

class MountSyncItem(CamelModel):
    """A single mount ownership entry from the plugin."""
    mount_id: int
    trial_id: str | None = None
    owned: bool = False


class TotemSyncItem(CamelModel):
    """A single totem count entry from the plugin."""
    item_id: int
    trial_id: str | None = None
    count: int = 0
    totem_name: str | None = None
    found_in: list[str] | None = None


class PluginMountFarmSync(CamelModel):
    """Payload sent by the Dalamud plugin for mount farm sync."""
    character_name: str | None = None
    character_world: str | None = None
    mounts: list[MountSyncItem] = []
    totems: list[TotemSyncItem] = []
    source: str = "plugin"
    plugin_version: str | None = None
    synced_at: str | None = None


class PluginSyncResult(CamelModel):
    """Response after processing plugin mount farm sync."""
    mounts_updated: int = 0
    totems_updated: int = 0
    mounts_unchanged: int = 0
    totems_unchanged: int = 0
    unknown_trials: list[str] = []
    synced_at: str


# --- Response schemas ---

class MemberProgressResponse(CamelModel):
    user_id: str
    display_name: str
    discord_username: str | None = None
    discord_avatar: str | None = None
    trial_id: str
    has_mount: bool = False
    wants_mount: bool = True
    totem_count: int = 0
    notes: str | None = None
    updated_at: str | None = None
    ownership_source: str = "manual"
    totem_source: str = "manual"
    last_imported_at: str | None = None
    last_plugin_sync_at: str | None = None
    last_manual_override_at: str | None = None


class TrialSummaryResponse(CamelModel):
    trial_id: str
    total_members: int
    members_complete: int
    members_missing: int
    members_wanting: int
    members_can_buy: int
    member_progress: list[MemberProgressResponse]


class MountFarmResponse(CamelModel):
    trials: list[TrialSummaryResponse]
    current_user_id: str | None = None


class FarmScoreResponse(CamelModel):
    trial_id: str
    score: float
    members_missing: int
    members_wanting: int
    members_close_to_target: int
    members_can_buy: int


# --- Plugin catalog schemas ---

class MountFarmCatalogEntry(CamelModel):
    trial_id: str
    expansion: str
    duty_name: str
    mount_name: str
    mount_id: int | None = None
    totem_name: str | None = None
    totem_item_id: int | None = None
    totem_target: int = 99


class MountFarmCatalogResponse(CamelModel):
    entries: list[MountFarmCatalogEntry]
    version: str = "1"
