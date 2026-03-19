"""Analytics data retention task -- aggregates old events and cleans up."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from ..database import async_session_maker
from ..logging_config import get_logger
from ..models.analytics import AnalyticsDailyAggregate, AnalyticsEvent, ErrorReport

logger = get_logger(__name__)

RETENTION_DAYS = 90
CHECK_INTERVAL_HOURS = 6


async def run_retention() -> None:
    """Aggregate events older than 90 days and delete raw data."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async with async_session_maker() as session:
        # Check if already ran today (idempotent)
        existing = await session.execute(
            select(AnalyticsDailyAggregate.id).where(
                AnalyticsDailyAggregate.date == today,
                AnalyticsDailyAggregate.metric_name == "_retention_ran",
                AnalyticsDailyAggregate.dimension_key == "daily_check",
            )
        )
        if existing.scalar_one_or_none() is not None:
            logger.debug("retention_already_ran", date=today)
            return

        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
        ).isoformat()

        # Aggregate old events by date + event_name
        old_events_result = await session.execute(
            select(
                func.substr(AnalyticsEvent.created_at, 1, 10).label("date"),
                AnalyticsEvent.event_name,
                func.count(AnalyticsEvent.id).label("count"),
            )
            .where(AnalyticsEvent.created_at < cutoff)
            .group_by(
                func.substr(AnalyticsEvent.created_at, 1, 10),
                AnalyticsEvent.event_name,
            )
        )
        old_events = old_events_result.all()

        # Upsert aggregates (works on both PostgreSQL and SQLite)
        aggregated_count = 0
        for row in old_events:
            dim_key = f"event_name={row.event_name}"
            # Check if aggregate exists
            existing_agg = await session.execute(
                select(AnalyticsDailyAggregate).where(
                    AnalyticsDailyAggregate.date == row.date,
                    AnalyticsDailyAggregate.metric_name == "event_count",
                    AnalyticsDailyAggregate.dimension_key == dim_key,
                )
            )
            agg = existing_agg.scalar_one_or_none()
            if agg:
                agg.metric_value += row.count
            else:
                session.add(AnalyticsDailyAggregate(
                    date=row.date,
                    metric_name="event_count",
                    metric_value=row.count,
                    dimension_key=dim_key,
                    dimensions={"event_name": row.event_name},
                ))
            aggregated_count += row.count

        # Delete old raw events
        events_result = await session.execute(
            delete(AnalyticsEvent).where(AnalyticsEvent.created_at < cutoff)
        )

        # Delete old error reports
        errors_result = await session.execute(
            delete(ErrorReport).where(ErrorReport.created_at < cutoff)
        )

        # Mark retention as complete AFTER all work succeeds
        # If this fails due to a race (another worker inserted first), that's fine —
        # the work is idempotent (upsert aggregates, already-deleted rows are no-ops).
        try:
            session.add(AnalyticsDailyAggregate(
                date=today,
                metric_name="_retention_ran",
                metric_value=1.0,
                dimension_key="daily_check",
                dimensions=None,
            ))
            await session.commit()
        except IntegrityError:
            await session.rollback()
            logger.debug("retention_marker_conflict", date=today)
            return

        logger.info(
            "retention_completed",
            aggregated_events=aggregated_count,
            deleted_events=events_result.rowcount,
            deleted_errors=errors_result.rowcount,
        )


async def retention_loop() -> None:
    """Run retention check on a repeating interval."""
    while True:
        try:
            await run_retention()
        except Exception as e:
            logger.error("retention_task_failed", error=str(e))
        await asyncio.sleep(CHECK_INTERVAL_HOURS * 3600)
