"""add_split_clear_assignments

Revision ID: split01a2b3c4
Revises: u2v3w4x5y6z7
Create Date: 2026-06-18

Adds the split_clear_assignments table for tracking per-player run/alt
assignments in split-clear mode. split_clear_mode flag is stored in the
existing static_groups.settings JSON column — no schema change needed there.
"""

from alembic import op
import sqlalchemy as sa

revision = "split01a2b3c4"
down_revision = "u2v3w4x5y6z7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "split_clear_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "static_group_id",
            sa.String(36),
            sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "snapshot_player_id",
            sa.String(36),
            sa.ForeignKey("snapshot_players.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("main_character_name", sa.String(100), nullable=True),
        sa.Column("main_character_world", sa.String(100), nullable=True),
        sa.Column("alt_character_name", sa.String(100), nullable=True),
        sa.Column("alt_character_world", sa.String(100), nullable=True),
        sa.Column("run_a_character", sa.String(10), nullable=True),
        sa.Column("run_b_character", sa.String(10), nullable=True),
        sa.Column("loot_target", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("loot_target_job", sa.String(30), nullable=True),
        sa.Column("run_a_cleared", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("run_b_cleared", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
        sa.UniqueConstraint("static_group_id", "snapshot_player_id", name="uq_split_clear_player"),
    )
    op.create_index(
        "ix_split_clear_assignments_static_group_id",
        "split_clear_assignments",
        ["static_group_id"],
    )
    op.create_index(
        "ix_split_clear_assignments_snapshot_player_id",
        "split_clear_assignments",
        ["snapshot_player_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_split_clear_assignments_snapshot_player_id",
        table_name="split_clear_assignments",
    )
    op.drop_index(
        "ix_split_clear_assignments_static_group_id",
        table_name="split_clear_assignments",
    )
    op.drop_table("split_clear_assignments")
