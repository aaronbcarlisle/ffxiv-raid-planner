"""add_content_type_to_collection_goals

Revision ID: f4g5h6i7j8k9
Revises: cg01a2b3c4d5e
Create Date: 2026-06-14

Adds content_type and content_key columns to collection_goals.
content_type separates "where the reward comes from" (extreme/savage/ultimate/…)
from goal_type which tracks "what is being collected" (mount/weapon/title/…).
Both columns are nullable for backward compat — existing rows get NULL.
Also expands the valid goal_type value set (no DB constraint, validated in app layer).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f4g5h6i7j8k9"
down_revision: Union[str, None] = "73ec5962fd7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collection_goals",
        sa.Column("content_type", sa.String(30), nullable=True),
    )
    op.add_column(
        "collection_goals",
        sa.Column("content_key", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("collection_goals", "content_key")
    op.drop_column("collection_goals", "content_type")
