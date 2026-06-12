"""add last_plugin_seen_at to gear snapshots

Revision ID: f7e8d9c0b1a2
Revises: 9b1c2d3e4f5a
Create Date: 2026-06-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7e8d9c0b1a2"
down_revision: Union[str, Sequence[str], None] = "9b1c2d3e4f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_plugin_seen_at column for plugin heartbeat tracking."""
    with op.batch_alter_table("player_gear_snapshots", schema=None) as batch_op:
        batch_op.add_column(sa.Column("last_plugin_seen_at", sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove last_plugin_seen_at column."""
    with op.batch_alter_table("player_gear_snapshots", schema=None) as batch_op:
        batch_op.drop_column("last_plugin_seen_at")
