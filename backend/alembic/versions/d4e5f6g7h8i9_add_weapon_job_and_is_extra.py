"""add_weapon_job_and_is_extra

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-01-08 23:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6g7h8i9"
down_revision: Union[str, None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("loot_log_entries")]

    # Add weapon_job column (string, nullable for non-weapon entries)
    if "weapon_job" not in existing_columns:
        op.add_column(
            "loot_log_entries",
            sa.Column("weapon_job", sa.String(10), nullable=True),
        )

    # Add is_extra column (boolean, default False)
    if "is_extra" not in existing_columns:
        op.add_column(
            "loot_log_entries",
            sa.Column("is_extra", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    op.drop_column("loot_log_entries", "is_extra")
    op.drop_column("loot_log_entries", "weapon_job")
