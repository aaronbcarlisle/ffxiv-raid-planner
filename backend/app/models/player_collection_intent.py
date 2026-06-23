"""PlayerCollectionIntent — player's voluntary intent/interest in a collection reward."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .collection_catalog_item import CollectionCatalogItem
    from .player_profile import PlayerProfile

INTENT_VALUES = frozenset({"hunting", "interested", "pass", "hidden"})
INTENT_PRIORITIES = frozenset({"high", "medium", "low"})
INTENT_VISIBILITIES = frozenset({"private", "static_only", "dossier_public"})


class PlayerCollectionIntent(Base):
    """Player-controlled intent for a specific catalog reward.

    Facts (ownership, token count) live in PlayerCollectionSnapshot.
    This model stores only what the player voluntarily expresses:
    whether they want this reward and who is allowed to see that preference.

    Visibility rules:
      - private: only the player can see it
      - static_only: visible to leads/members in shared statics
      - dossier_public: visible in the public dossier / Static Finder
    """

    __tablename__ = "player_collection_intents"

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

    intent: Mapped[str] = mapped_column(String(15), nullable=False, default="interested")
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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
            name="uq_player_collection_intent_profile_item",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerCollectionIntent(profile={self.profile_id!r}, "
            f"item={self.catalog_item_id!r}, intent={self.intent!r}, "
            f"visibility={self.visibility!r})>"
        )
