"""PlayerCollectionSnapshot — factual per-player collection state (facts only, no intent)."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
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

    Character records (S2a-1, R-S1-2/R-S1-3): a row belongs to one of the
    profile's characters (`character_id` set), or to the profile itself when
    it has no character (`character_id` NULL). Two partial unique indexes keep
    one row per (character, item) and one profile-level row per
    (profile, item). Every index carries both postgresql_where and
    sqlite_where: without the predicate the profile-level index is plain
    unique on (profile, item) and every alt's row collides with the main's.
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

    # The character whose record this is; NULL for a profile-level row (a
    # profile with no character). CASCADE acts on Postgres only: SQLite runs
    # without PRAGMA foreign_keys here, so the code deletes an unlinked
    # character's rows explicitly (R-S1-6) and the FK is the backstop.
    character_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("player_characters.id", ondelete="CASCADE"),
        nullable=True,
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

    # Write provenance (R-PV-1 vocabulary): who last wrote the row and through
    # which channel; NULL on rows that predate S2a-1 ("unknown origin").
    updated_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_via: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # When ownership_state and token_count last changed (ISO text). updated_at
    # moves on every write, so the merge compares these instead (R-S1-7).
    state_changed_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_count_updated_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    profile: Mapped["PlayerProfile"] = relationship(
        "PlayerProfile", foreign_keys=[profile_id]
    )
    catalog_item: Mapped["CollectionCatalogItem"] = relationship(
        "CollectionCatalogItem", foreign_keys=[catalog_item_id]
    )

    __table_args__ = (
        Index(
            "uq_pcs_character_item",
            "character_id", "catalog_item_id",
            unique=True,
            postgresql_where=text("character_id IS NOT NULL"),
            sqlite_where=text("character_id IS NOT NULL"),
        ),
        Index(
            "uq_pcs_profile_item_no_character",
            "profile_id", "catalog_item_id",
            unique=True,
            postgresql_where=text("character_id IS NULL"),
            sqlite_where=text("character_id IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerCollectionSnapshot(profile={self.profile_id!r}, "
            f"item={self.catalog_item_id!r}, state={self.ownership_state!r})>"
        )
