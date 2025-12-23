"""Static (raid group) model"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .player import Player


class Static(Base):
    """Static (raid group) model"""

    __tablename__ = "statics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), nullable=False)
    share_code: Mapped[str] = mapped_column(String(6), unique=True, nullable=False, index=True)
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    players: Mapped[list["Player"]] = relationship(
        "Player",
        back_populates="static",
        cascade="all, delete-orphan",
        order_by="Player.sort_order",
    )

    def __repr__(self) -> str:
        return f"<Static(id={self.id}, name={self.name}, share_code={self.share_code})>"
