"""Analytics data retention task -- aggregates old events and cleans up."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
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
        # Claim today's run with INSERT ... ON CONFLICT DO NOTHING.
        # Only the first worker to insert succeeds; others get rowcount=0 and skip.
        try:
            marker_stmt = pg_insert(AnalyticsDailyAggregate).values(
                date=today,
                metric_name="_retention_ran",
                metric_value=1.0,
                dimension_key="daily_check",
                dimensions=None,
            ).on_conflict_do_nothing(
                constraint="uq_daily_aggregate_metric"
            )
            result = await session.execute(marker_stmt)
            await session.commit()

            if result.rowcount == 0:
                logger.debug("retention_already_ran", date=today)
                return
        except IntegrityError:
            await session.rollback()
            logger.debug("retention_already_ran_conflict", date=today)
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

        # Bulk upsert aggregates using ON CONFLICT DO UPDATE
        aggregated_count = 0
        for row in old_events:
            dim_key = f"event_name={row.event_name}"
            stmt = pg_insert(AnalyticsDailyAggregate).values(
                date=row.date,
                metric_name="event_count",
                metric_value=row.count,
                dimension_key=dim_key,
                dimensions={"event_name": row.event_name},
            ).on_conflict_do_update(
                constraint="uq_daily_aggregate_metric",
                set_={"metric_value": AnalyticsDailyAggregate.metric_value + row.count},
            )
            await session.execute(stmt)
            aggregated_count += row.count

        # Delete old raw events
        events_result = await session.execute(
            delete(AnalyticsEvent).where(AnalyticsEvent.created_at < cutoff)
        )

        # Delete old error reports
        errors_result = await session.execute(
            delete(ErrorReport).where(ErrorReport.created_at < cutoff)
        )

        await session.commit()

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
