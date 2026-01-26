"""add_slot_augmented_to_material_log

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-01-25 17:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6g7h8i9j0k1"
down_revision: Union[str, None] = "e5f6g7h8i9j0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add slot_augmented column to material_log_entries table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if column already exists
    columns = [c["name"] for c in inspector.get_columns("material_log_entries")]
    if "slot_augmented" in columns:
        return

    # Add the column (nullable since existing entries won't have it)
    op.add_column(
        "material_log_entries",
        sa.Column("slot_augmented", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    """Remove slot_augmented column from material_log_entries table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if column exists before attempting to drop (idempotent)
    columns = [c["name"] for c in inspector.get_columns("material_log_entries")]
    if "slot_augmented" not in columns:
        return

    op.drop_column("material_log_entries", "slot_augmented")
