"""add schedule reminder presets and availability tracking

Revision ID: 9b1c2d3e4f5a
Revises: 68f4fa00c30f
Create Date: 2026-06-08

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b1c2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "68f4fa00c30f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    schedule_columns = _column_names("schedule_sessions")
    if schedule_columns and "track_availability" not in schedule_columns:
        op.add_column(
            "schedule_sessions",
            sa.Column(
                "track_availability",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )

    settings_columns = _column_names("schedule_settings")
    if settings_columns:
        for column_name in (
            "enable_at_start_reminder",
            "enable_15m_reminder",
            "enable_6h_reminder",
            "enable_12h_reminder",
        ):
            if column_name not in settings_columns:
                op.add_column(
                    "schedule_settings",
                    sa.Column(
                        column_name,
                        sa.Boolean(),
                        nullable=False,
                        server_default=sa.false(),
                    ),
                )


def downgrade() -> None:
    settings_columns = _column_names("schedule_settings")
    for column_name in (
        "enable_12h_reminder",
        "enable_6h_reminder",
        "enable_15m_reminder",
        "enable_at_start_reminder",
    ):
        if column_name in settings_columns:
            op.drop_column("schedule_settings", column_name)

    schedule_columns = _column_names("schedule_sessions")
    if "track_availability" in schedule_columns:
        op.drop_column("schedule_sessions", "track_availability")
