"""add_schedule_category_and_content

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-06-04

Adds category, content_id, content_name columns to schedule_sessions
for event categorization (raid/farm/reclear/prog/social/other) and
content linking (e.g., mount farm trial or raid tier).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w3x4y5z6a7b8"
down_revision: Union[str, None] = "v2w3x4y5z6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "schedule_sessions" not in inspector.get_table_names():
        return

    existing = [col["name"] for col in inspector.get_columns("schedule_sessions")]

    if "category" not in existing:
        op.add_column("schedule_sessions", sa.Column("category", sa.String(20), nullable=True))

    if "content_id" not in existing:
        op.add_column("schedule_sessions", sa.Column("content_id", sa.String(50), nullable=True))

    if "content_name" not in existing:
        op.add_column("schedule_sessions", sa.Column("content_name", sa.String(200), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "schedule_sessions" not in inspector.get_table_names():
        return

    existing = [col["name"] for col in inspector.get_columns("schedule_sessions")]

    for col in ("content_name", "content_id", "category"):
        if col in existing:
            op.drop_column("schedule_sessions", col)
