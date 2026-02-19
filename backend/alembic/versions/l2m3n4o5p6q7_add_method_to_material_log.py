"""add_method_to_material_log

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-02-18 12:00:00.000000

Add method column (drop/book) to material_log_entries table,
reusing the existing 'lootmethod' DB enum from loot_log_entries.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add method column to material_log_entries table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if column already exists (idempotent)
    columns = [c["name"] for c in inspector.get_columns("material_log_entries")]
    if "method" in columns:
        return

    op.add_column(
        "material_log_entries",
        sa.Column("method", sa.String(10), server_default="drop", nullable=False),
    )


def downgrade() -> None:
    """Remove method column from material_log_entries table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if column exists before attempting to drop (idempotent)
    columns = [c["name"] for c in inspector.get_columns("material_log_entries")]
    if "method" not in columns:
        return

    op.drop_column("material_log_entries", "method")
