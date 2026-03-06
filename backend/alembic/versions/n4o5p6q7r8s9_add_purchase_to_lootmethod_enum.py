"""add_purchase_to_lootmethod_enum

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-03-06 12:00:00.000000

Add 'purchase' value to the lootmethod PostgreSQL enum type.
This supports the self-purchase flow where members log their own tome/book purchases.
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "n4o5p6q7r8s9"
down_revision: Union[str, None] = "m3n4o5p6q7r8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'purchase' to lootmethod enum."""
    op.execute("ALTER TYPE lootmethod ADD VALUE IF NOT EXISTS 'purchase'")


def downgrade() -> None:
    """Remove 'purchase' from lootmethod enum.

    PostgreSQL doesn't support removing enum values directly.
    A full enum recreation would be needed, but since this is additive
    and backward-compatible, downgrade is a no-op.
    """
    pass
