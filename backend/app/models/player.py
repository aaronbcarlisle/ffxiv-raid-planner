"""Player model"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .static import Static


class Player(Base):
    """Player model"""

    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    static_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("statics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    job: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    position: Mapped[str | None] = mapped_column(String(5), nullable=True)  # T1, H2, M1, etc.
    tank_role: Mapped[str | None] = mapped_column(String(5), nullable=True)  # MT, OT
    configured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_substitute: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lodestone_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bis_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    fflogs_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_sync: Mapped[str | None] = mapped_column(Text, nullable=True)
    gear: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tome_weapon: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relationships
    static: Mapped["Static"] = relationship("Static", back_populates="players")

    def __repr__(self) -> str:
        return f"<Player(id={self.id}, name={self.name}, job={self.job})>"
