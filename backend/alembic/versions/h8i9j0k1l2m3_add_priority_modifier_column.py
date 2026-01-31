"""add_priority_modifier_column

Revision ID: h8i9j0k1l2m3
Revises: i9j0k1l2m3n4
Create Date: 2026-01-30 20:00:00.000000

Adds priority_modifier column to snapshot_players table for per-player
priority adjustments. Values range from -100 to +100, defaulting to 0.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("snapshot_players")]

    # Add priority_modifier column (integer, default 0)
    if "priority_modifier" not in existing_columns:
        op.add_column(
            "snapshot_players",
            sa.Column("priority_modifier", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    # WARNING: Downgrading will drop the priority_modifier column and
    # permanently delete all player priority modifier data. Only run
    # this if you are sure this data is no longer needed or has been backed up.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("snapshot_players")]

    if "priority_modifier" in existing_columns:
        op.drop_column("snapshot_players", "priority_modifier")
