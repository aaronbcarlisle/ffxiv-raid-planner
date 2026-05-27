"""add schedule and availability tables

Revision ID: cd9366d7e965
Revises: e51ae81dd982
Create Date: 2026-05-27 10:52:33.239306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd9366d7e965'
down_revision: Union[str, Sequence[str], None] = 'e51ae81dd982'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_availability, schedule_sessions, and schedule_rsvps tables."""
    op.create_table(
        "user_availability",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("static_group_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("slots", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["static_group_id"], ["static_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "static_group_id", "user_id", "date", name="uq_availability_group_user_date"
        ),
    )
    op.create_index(
        "ix_user_availability_static_group_id", "user_availability", ["static_group_id"]
    )
    op.create_index("ix_user_availability_user_id", "user_availability", ["user_id"])

    op.create_table(
        "schedule_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("static_group_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_time", sa.Text(), nullable=False),
        sa.Column("end_time", sa.Text(), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column("is_recurring", sa.Boolean(), nullable=False),
        sa.Column("recurrence_rule", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["static_group_id"], ["static_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_schedule_sessions_static_group_id", "schedule_sessions", ["static_group_id"]
    )

    op.create_table(
        "schedule_rsvps",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["schedule_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_rsvps_session_id", "schedule_rsvps", ["session_id"])
    op.create_index("ix_schedule_rsvps_user_id", "schedule_rsvps", ["user_id"])


def downgrade() -> None:
    """Drop schedule_rsvps, schedule_sessions, and user_availability tables."""
    op.drop_index("ix_schedule_rsvps_user_id", table_name="schedule_rsvps")
    op.drop_index("ix_schedule_rsvps_session_id", table_name="schedule_rsvps")
    op.drop_table("schedule_rsvps")

    op.drop_index("ix_schedule_sessions_static_group_id", table_name="schedule_sessions")
    op.drop_table("schedule_sessions")

    op.drop_index("ix_user_availability_user_id", table_name="user_availability")
    op.drop_index("ix_user_availability_static_group_id", table_name="user_availability")
    op.drop_table("user_availability")
