"""Analytics models for tracking usage, errors, and aggregated metrics."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Float, Integer, String, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AnalyticsEvent(Base):
    """Stores tracked user actions (navigation, feature usage, etc.)."""

    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    event_category: Mapped[str] = mapped_column(String(30), nullable=False)
    event_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    event_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __repr__(self) -> str:
        return f"<AnalyticsEvent(id={self.id}, event_name={self.event_name})>"


class ErrorReport(Base):
    """Stores error occurrences from frontend and backend."""

    __tablename__ = "error_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    error_type: Mapped[str] = mapped_column(String(30), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    context: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __repr__(self) -> str:
        return f"<ErrorReport(id={self.id}, error_type={self.error_type}, severity={self.severity})>"


class AnalyticsDailyAggregate(Base):
    """Rolled-up daily statistics for dashboard queries."""

    __tablename__ = "analytics_daily_aggregates"
    __table_args__ = (
        UniqueConstraint("date", "metric_name", "dimension_key", name="uq_daily_aggregate_metric"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    dimension_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dimensions: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<AnalyticsDailyAggregate(id={self.id}, date={self.date}, metric={self.metric_name})>"
