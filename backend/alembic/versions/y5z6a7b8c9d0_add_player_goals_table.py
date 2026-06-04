"""add_player_goals_table

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-06-04

Adds player_goals table for solo player collection hunting and personal
goal tracking, independent of static group membership.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "y5z6a7b8c9d0"
down_revision: Union[str, None] = "x4y5z6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "player_goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id", sa.String(36),
            sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal_type", sa.String(30), nullable=False),
        sa.Column("category", sa.String(30), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("current_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_count", sa.Integer(), nullable=True),
        sa.Column("source_content", sa.String(200), nullable=True),
        sa.Column("source_item", sa.String(200), nullable=True),
        sa.Column(
            "linked_character_id", sa.String(36),
            sa.ForeignKey("player_characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("linked_job", sa.String(10), nullable=True),
        sa.Column("due_date", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("ix_player_goals_profile_id", "player_goals", ["profile_id"])


def downgrade() -> None:
    op.drop_table("player_goals")
