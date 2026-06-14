"""add_objective_category_to_player_goals

Revision ID: 73ec5962fd7d
Revises: s1t2u3v4w5x6
Create Date: 2026-06-14 01:03:12.338803

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "73ec5962fd7d"
down_revision: Union[str, Sequence[str], None] = "s1t2u3v4w5x6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add objective_category column to player_goals."""
    with op.batch_alter_table("player_goals", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("objective_category", sa.String(length=30), nullable=True)
        )


def downgrade() -> None:
    """Remove objective_category column from player_goals."""
    with op.batch_alter_table("player_goals", schema=None) as batch_op:
        batch_op.drop_column("objective_category")
