"""add_reward_participant_states_and_drop_log

Revision ID: d3e4f5g6h7i8
Revises: b1c2d3e4f5a6
Create Date: 2026-06-20

Adds priority_mode to collection_goals, and two new tables:
  reward_participant_states  — per-player need/want/have/pass state per goal
  reward_drop_log            — drop history per goal
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d3e4f5g6h7i8"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collection_goals",
        sa.Column("priority_mode", sa.String(30), nullable=True),
    )

    op.create_table(
        "reward_participant_states",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "goal_id",
            sa.String(36),
            sa.ForeignKey("collection_goals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "static_group_id",
            sa.String(36),
            sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state", sa.String(10), nullable=False, server_default="want"),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("priority_rank", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("last_synced_at", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.UniqueConstraint("goal_id", "user_id", name="uq_reward_participant_goal_user"),
    )
    op.create_index("ix_reward_participant_states_goal_id", "reward_participant_states", ["goal_id"])
    op.create_index("ix_reward_participant_states_static_group_id", "reward_participant_states", ["static_group_id"])

    op.create_table(
        "reward_drop_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "goal_id",
            sa.String(36),
            sa.ForeignKey("collection_goals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "static_group_id",
            sa.String(36),
            sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("dropped_at", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("ix_reward_drop_log_goal_id", "reward_drop_log", ["goal_id"])
    op.create_index("ix_reward_drop_log_static_group_id", "reward_drop_log", ["static_group_id"])


def downgrade() -> None:
    op.drop_index("ix_reward_drop_log_static_group_id", table_name="reward_drop_log")
    op.drop_index("ix_reward_drop_log_goal_id", table_name="reward_drop_log")
    op.drop_table("reward_drop_log")

    op.drop_index("ix_reward_participant_states_static_group_id", table_name="reward_participant_states")
    op.drop_index("ix_reward_participant_states_goal_id", table_name="reward_participant_states")
    op.drop_table("reward_participant_states")

    op.drop_column("collection_goals", "priority_mode")
