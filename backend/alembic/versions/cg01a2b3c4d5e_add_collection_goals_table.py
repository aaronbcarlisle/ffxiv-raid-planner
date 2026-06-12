"""add_collection_goals_table

Revision ID: cg01a2b3c4d5e
Revises: f7e8d9c0b1a2
Create Date: 2026-06-11

Adds collection_goals table for static-group-level collection/farm goals
(mounts, tokens, minions, orchestrion rolls, glamour, custom rewards).
Goals are owned by the static group and can only be created/edited/deleted
by owner or lead; members have read access only.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "cg01a2b3c4d5e"
down_revision: Union[str, None] = "f7e8d9c0b1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "collection_goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "static_group_id",
            sa.String(36),
            sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("goal_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="wanted"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("linked_duty_id", sa.String(50), nullable=True),
        sa.Column("linked_reward_id", sa.String(50), nullable=True),
        sa.Column("target_count", sa.Integer(), nullable=True),
        sa.Column("current_count", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("completed_at", sa.Text(), nullable=True),
    )
    op.create_index("ix_collection_goals_static_group_id", "collection_goals", ["static_group_id"])


def downgrade() -> None:
    op.drop_index("ix_collection_goals_static_group_id", table_name="collection_goals")
    op.drop_table("collection_goals")
