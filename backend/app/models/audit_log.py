"""Site-wide admin/action audit log (spec: design/redesign/specs/2026-08-08-admin-v2-spec.md §3.1).

One row per audited mutation, written in the SAME session as the mutation so
the pair commits (or rolls back) atomically. Rows must survive both user
deletion (actor FK SET NULL + denormalized actor_label) and static deletion
(static_group_id is intentionally NOT a foreign key).
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AuditLog(Base):
    """One row per audited admin/destructive action."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Text ISO-8601 UTC, indexed — lexicographic range queries (repo convention)
    created_at: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Denormalized; survives user deletion
    actor_label: Mapped[str] = mapped_column(String(100), nullable=False)
    # 'cookie' | 'api_key' | 'system' ('cookie' includes legacy Authorization-header JWTs)
    credential: Mapped[str] = mapped_column(String(10), nullable=False)
    # X-View-As target if the header was present
    impersonating_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Action rode the admin virtual-owner bypass (actor is admin AND not a real member)
    admin_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Dot-namespaced: 'static.deleted', 'loot.logged', 'user.banned', ...
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # String(64), not 36: error-review targets are SHA-256 fingerprints (ErrorReport.fingerprint)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_label: Mapped[str] = mapped_column(String(200), nullable=False)
    # No FK: rows must survive static deletion; id retained for filtering
    static_group_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Changed fields only on update; full state on create; never secrets
    old_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # String(64), matching the middleware's inbound X-Request-ID cap — the stored
    # value must equal the response header / structlog / error-report value exactly
    # or per-request correlation (this column's only purpose) silently breaks.
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_audit_log_target", "target_type", "target_id"),
    )
