"""add_weapon_priority_and_tracking_fields

Revision ID: 8e34a613492c
Revises: c94640ed9426
Create Date: 2025-12-31 23:47:50.186316

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8e34a613492c"
down_revision: Union[str, Sequence[str], None] = "c94640ed9426"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add weapon priority columns to snapshot_players
    with op.batch_alter_table("snapshot_players", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("weapon_priorities", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(
            sa.Column(
                "weapon_priorities_locked", sa.Boolean(), nullable=False, server_default="0"
            )
        )
        batch_op.add_column(
            sa.Column("weapon_priorities_locked_by", sa.String(length=36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("weapon_priorities_locked_at", sa.Text(), nullable=True)
        )

    # Add weapon priority settings and week tracking to tier_snapshots
    with op.batch_alter_table("tier_snapshots", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("weapon_priorities_auto_lock_date", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "weapon_priorities_global_lock", sa.Boolean(), nullable=False, server_default="0"
            )
        )
        batch_op.add_column(
            sa.Column("weapon_priorities_global_locked_by", sa.String(length=36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("weapon_priorities_global_locked_at", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("current_week", sa.Integer(), nullable=False, server_default="1")
        )
        batch_op.add_column(sa.Column("week_start_date", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove weapon priority columns from snapshot_players
    with op.batch_alter_table("snapshot_players", schema=None) as batch_op:
        batch_op.drop_column("weapon_priorities_locked_at")
        batch_op.drop_column("weapon_priorities_locked_by")
        batch_op.drop_column("weapon_priorities_locked")
        batch_op.drop_column("weapon_priorities")

    # Remove weapon priority settings and week tracking from tier_snapshots
    with op.batch_alter_table("tier_snapshots", schema=None) as batch_op:
        batch_op.drop_column("week_start_date")
        batch_op.drop_column("current_week")
        batch_op.drop_column("weapon_priorities_global_locked_at")
        batch_op.drop_column("weapon_priorities_global_locked_by")
        batch_op.drop_column("weapon_priorities_global_lock")
        batch_op.drop_column("weapon_priorities_auto_lock_date")
