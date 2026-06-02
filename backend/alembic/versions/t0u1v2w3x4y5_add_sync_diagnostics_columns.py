"""add_sync_diagnostics_columns

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-06-02

Adds last_sync_source and last_synced_job columns to snapshot_players
for gear sync diagnostics and job mismatch detection.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "t0u1v2w3x4y5"
down_revision: Union[str, None] = "s9t0u1v2w3x4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("snapshot_players")]

    if "last_sync_source" not in existing_columns:
        op.add_column(
            "snapshot_players",
            sa.Column("last_sync_source", sa.String(30), nullable=True),
        )

    if "last_synced_job" not in existing_columns:
        op.add_column(
            "snapshot_players",
            sa.Column("last_synced_job", sa.String(10), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("snapshot_players")]

    if "last_synced_job" in existing_columns:
        op.drop_column("snapshot_players", "last_synced_job")

    if "last_sync_source" in existing_columns:
        op.drop_column("snapshot_players", "last_sync_source")
