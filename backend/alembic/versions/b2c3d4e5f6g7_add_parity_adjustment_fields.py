"""add_parity_adjustment_fields

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-02 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("snapshot_players")]

    # Add loot_adjustment column (integer, default 0)
    if "loot_adjustment" not in existing_columns:
        op.add_column(
            "snapshot_players",
            sa.Column("loot_adjustment", sa.Integer(), nullable=False, server_default="0"),
        )

    # Add page_adjustments column (JSON, default {"I": 0, "II": 0, "III": 0, "IV": 0})
    if "page_adjustments" not in existing_columns:
        op.add_column(
            "snapshot_players",
            sa.Column(
                "page_adjustments",
                sa.JSON(),
                nullable=False,
                server_default='{"I": 0, "II": 0, "III": 0, "IV": 0}',
            ),
        )


def downgrade() -> None:
    op.drop_column("snapshot_players", "page_adjustments")
    op.drop_column("snapshot_players", "loot_adjustment")
