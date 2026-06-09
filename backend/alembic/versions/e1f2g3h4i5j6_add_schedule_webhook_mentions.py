"""Add schedule webhook mention settings

Revision ID: e1f2g3h4i5j6
Revises: w3x4y5z6a7b8
Create Date: 2026-06-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e1f2g3h4i5j6"
down_revision: str | None = "w3x4y5z6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "schedule_settings",
        sa.Column("mention_target", sa.String(length=20), nullable=False, server_default="none"),
    )
    op.add_column(
        "schedule_settings",
        sa.Column("mention_role_id", sa.String(length=32), nullable=True),
    )
    op.alter_column("schedule_settings", "mention_target", server_default=None)


def downgrade() -> None:
    op.drop_column("schedule_settings", "mention_role_id")
    op.drop_column("schedule_settings", "mention_target")
