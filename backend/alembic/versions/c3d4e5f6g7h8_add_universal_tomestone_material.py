"""add_universal_tomestone_material

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-01-08 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add universal_tomestone to materialtype enum."""
    bind = op.get_bind()

    # Check if we're using PostgreSQL (has pg_type)
    try:
        result = bind.execute(
            sa.text("SELECT 1 FROM pg_type WHERE typname = 'materialtype'")
        )
        is_postgresql = result.fetchone() is not None
    except Exception:
        # SQLite or other database - no enum modification needed
        is_postgresql = False

    if is_postgresql:
        # Add new value to PostgreSQL enum
        bind.execute(
            sa.text("ALTER TYPE materialtype ADD VALUE IF NOT EXISTS 'universal_tomestone'")
        )


def downgrade() -> None:
    """
    Note: PostgreSQL does not support removing enum values easily.
    This downgrade only works if no rows use 'universal_tomestone'.
    In practice, you would need to:
    1. Update or delete rows using this value
    2. Recreate the enum and table
    """
    # For safety, we don't automatically remove the enum value
    # Manual intervention required if downgrade is truly needed
    pass
