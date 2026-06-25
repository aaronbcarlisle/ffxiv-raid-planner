"""Plugin collection sync schemas"""

from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    components = string.split("_")
    return components[0] + "".join(x[0].upper() + x[1:] if x else "" for x in components[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class CollectionMountItem(CamelModel):
    """Mount ownership entry from the plugin."""
    mount_id: int | None = None
    trial_id: str | None = None  # matches source_duty_key in catalog
    owned: bool = False


class CollectionTokenItem(CamelModel):
    """Token/currency count from the plugin inventory."""
    item_id: int | None = None
    token_name: str | None = None
    count: int = 0
    found_in: list[str] | None = None


class PluginCollectionSyncPayload(CamelModel):
    """Payload sent by the Dalamud plugin for collection state sync."""
    character_name: str | None = None
    character_world: str | None = None
    plugin_version: str | None = None
    mounts: list[CollectionMountItem] = []
    currencies: list[CollectionTokenItem] = []
    synced_at: str | None = None


class CollectionSyncResult(CamelModel):
    """Response after processing plugin collection sync."""
    states_updated: int = 0
    states_unchanged: int = 0
    token_counts_updated: int = 0
    skipped_locked: int = 0
    skipped_no_id: int = 0  # mounts in payload that had no stable game_mount_id for ownership
    unknown_items: list[str] = []
    synced_at: str
