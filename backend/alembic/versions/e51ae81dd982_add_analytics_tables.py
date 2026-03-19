"""add_analytics_tables

Revision ID: e51ae81dd982
Revises: n4o5p6q7r8s9
Create Date: 2026-03-19 03:27:09.285602

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e51ae81dd982"
down_revision: Union[str, Sequence[str], None] = "n4o5p6q7r8s9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create analytics_events, error_reports, and analytics_daily_aggregates tables."""
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("event_category", sa.String(length=30), nullable=False),
        sa.Column("event_name", sa.String(length=50), nullable=False),
        sa.Column("event_data", sa.JSON(), nullable=True),
        sa.Column("page_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_session_id", "analytics_events", ["session_id"])
    op.create_index("ix_analytics_events_event_name", "analytics_events", ["event_name"])

    op.create_table(
        "error_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("error_type", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False),
        sa.Column("source", sa.String(length=10), nullable=False),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_error_reports_fingerprint", "error_reports", ["fingerprint"])
    op.create_index("ix_error_reports_user_id", "error_reports", ["user_id"])

    op.create_table(
        "analytics_daily_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("metric_name", sa.String(length=50), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=False),
        sa.Column("dimension_key", sa.String(length=100), nullable=True),
        sa.Column("dimensions", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date", "metric_name", "dimension_key", name="uq_daily_aggregate_metric"),
    )
    op.create_index("ix_analytics_daily_aggregates_metric_name", "analytics_daily_aggregates", ["metric_name"])


def downgrade() -> None:
    """Drop analytics_events, error_reports, and analytics_daily_aggregates tables."""
    op.drop_index("ix_analytics_daily_aggregates_metric_name", table_name="analytics_daily_aggregates")
    op.drop_table("analytics_daily_aggregates")

    op.drop_index("ix_error_reports_user_id", table_name="error_reports")
    op.drop_index("ix_error_reports_fingerprint", table_name="error_reports")
    op.drop_table("error_reports")

    op.drop_index("ix_analytics_events_event_name", table_name="analytics_events")
    op.drop_index("ix_analytics_events_session_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_user_id", table_name="analytics_events")
    op.drop_table("analytics_events")
