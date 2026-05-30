"""add lodestone fields, schedule_settings, and schedule_reminder_deliveries

Revision ID: o5p6q7r8s9t0
Revises: cd9366d7e965
Create Date: 2026-05-29 02:13:25.953332

Adds:
  - snapshot_players: lodestone_name, lodestone_server, lodestone_avatar_url,
                      roster_title, roster_note, flex_roles
  - schedule_settings table (per-static webhook/reminder/calendar config)
  - schedule_reminder_deliveries table (idempotency log for sent reminders)

Note: down_revision re-parented to cd9366d7e965 (the current head on main:
add_schedule_and_availability_tables) so that schedule_reminder_deliveries'
FK to schedule_sessions resolves and no second alembic head is created.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "o5p6q7r8s9t0"
down_revision: Union[str, None] = "cd9366d7e965"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # snapshot_players — new identity and roster columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("snapshot_players", schema=None) as batch_op:
        batch_op.add_column(sa.Column("lodestone_name", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("lodestone_server", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("lodestone_avatar_url", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("roster_title", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("roster_note", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "flex_roles",
                sa.Text(),
                nullable=True,
                comment="JSON array of backup raid slots, e.g. [\"R1\", \"H2\"]",
            )
        )

    # ------------------------------------------------------------------
    # schedule_settings — per-static webhook, reminder, and calendar config
    # ------------------------------------------------------------------
    op.create_table(
        "schedule_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("static_group_id", sa.String(length=36), nullable=False),
        sa.Column("webhook_url", sa.Text(), nullable=True),
        sa.Column("reminder_channel_label", sa.String(length=100), nullable=True),
        sa.Column("enable_24h_reminder", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("enable_1h_reminder", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "enable_missing_rsvp_reminder",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("calendar_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("calendar_token", sa.String(length=128), nullable=True),
        sa.Column("calendar_token_created_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["static_group_id"], ["static_groups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("static_group_id", name="uq_schedule_settings_static_group"),
        sa.UniqueConstraint("calendar_token", name="uq_schedule_settings_calendar_token"),
    )
    op.create_index(
        "ix_schedule_settings_static_group_id",
        "schedule_settings",
        ["static_group_id"],
        unique=True,
    )
    op.create_index(
        "ix_schedule_settings_calendar_token",
        "schedule_settings",
        ["calendar_token"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # schedule_reminder_deliveries — idempotency log for sent reminders
    # ------------------------------------------------------------------
    op.create_table(
        "schedule_reminder_deliveries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("reminder_type", sa.String(length=50), nullable=False),
        sa.Column("occurrence_start_time", sa.Text(), nullable=False),
        sa.Column("sent_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["schedule_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id",
            "reminder_type",
            "occurrence_start_time",
            name="uq_reminder_delivery_per_occurrence",
        ),
    )
    op.create_index(
        "ix_schedule_reminder_deliveries_session_id",
        "schedule_reminder_deliveries",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_table("schedule_reminder_deliveries")

    op.drop_index("ix_schedule_settings_calendar_token", table_name="schedule_settings")
    op.drop_index("ix_schedule_settings_static_group_id", table_name="schedule_settings")
    op.drop_table("schedule_settings")

    with op.batch_alter_table("snapshot_players", schema=None) as batch_op:
        batch_op.drop_column("flex_roles")
        batch_op.drop_column("roster_note")
        batch_op.drop_column("roster_title")
        batch_op.drop_column("lodestone_avatar_url")
        batch_op.drop_column("lodestone_server")
        batch_op.drop_column("lodestone_name")
