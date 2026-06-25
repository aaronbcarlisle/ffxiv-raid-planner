"""CollectionCatalogItem — global FFXIV reward catalog (mounts, music, minions, etc.)"""

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

CATALOG_CATEGORIES = frozenset({
    "mount", "orchestrion", "minion", "glam", "title",
    "weapon", "emote", "hairstyle", "card", "other",
})

CATALOG_EXPANSIONS = frozenset({
    "arr", "hw", "sb", "shb", "ew", "dt",
})

EXTERNAL_SOURCES = frozenset({
    "ffxiv_collect", "manual", "internal",
})


class CollectionCatalogItem(Base):
    __tablename__ = "collection_catalog_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    external_source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    external_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    patch: Mapped[str | None] = mapped_column(String(10), nullable=True)
    expansion: Mapped[str | None] = mapped_column(String(10), nullable=True)

    icon_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_duty_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_duty_key: Mapped[str | None] = mapped_column(String(100), nullable=True)

    token_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    token_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Stable game IDs from Mount.exd / Item.exd (via Lumina/SaintCoinach).
    # Used by the Dalamud plugin for IsMountUnlocked() and InventoryManager scans.
    # Null means IDs have not yet been verified for this entry.
    game_mount_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    tradeable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    rarity_owned_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_curated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return f"<CollectionCatalogItem({self.category}: {self.name!r})>"
