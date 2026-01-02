"""add_static_group_settings

Revision ID: f1a2b3c4d5e6
Revises: e036708b4e61
Create Date: 2026-01-01 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e036708b4e61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add settings JSON column to static_groups."""
    with op.batch_alter_table("static_groups", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("settings", sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    """Remove settings column from static_groups."""
    with op.batch_alter_table("static_groups", schema=None) as batch_op:
        batch_op.drop_column("settings")
