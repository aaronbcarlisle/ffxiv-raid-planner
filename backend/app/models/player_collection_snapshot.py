"""PlayerCollectionSnapshot — factual per-player collection state (facts only, no intent)."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .collection_catalog_item import CollectionCatalogItem
    from .player_profile import PlayerProfile

SNAPSHOT_OWNERSHIP_STATES = frozenset({"have", "missing", "unknown"})
SNAPSHOT_SOURCES = frozenset({"plugin", "player_hub", "manual"})
SNAPSHOT_CONFIDENCES = frozenset({"high", "medium", "low"})


class PlayerCollectionSnapshot(Base):
    """Factual collection ownership state for a player profile.

    Written by plugin sync (stable game_mount_id required for "have") or
    manually by the player. Never stores intent — only what the player
    factually owns or is missing.

    Collisions:
      - Plugin "have" never downgrades an existing "have".
      - Manual entries take priority over plugin for ownership_state.
      - token_count is always updated from the most recent plugin sync.
    """

    __tablename__ = "player_collection_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    catalog_item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("collection_catalog_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    ownership_state: Mapped[str] = mapped_column(
        String(10), nullable=False, default="unknown"
    )

    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    confidence: Mapped[str] = mapped_column(String(10), nullable=False, default="low")

    last_synced_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )

    profile: Mapped["PlayerProfile"] = relationship(
        "PlayerProfile", foreign_keys=[profile_id]
    )
    catalog_item: Mapped["CollectionCatalogItem"] = relationship(
        "CollectionCatalogItem", foreign_keys=[catalog_item_id]
    )

    __table_args__ = (
        UniqueConstraint(
            "profile_id", "catalog_item_id",
            name="uq_player_collection_snapshot_profile_item",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerCollectionSnapshot(profile={self.profile_id!r}, "
            f"item={self.catalog_item_id!r}, state={self.ownership_state!r})>"
        )
