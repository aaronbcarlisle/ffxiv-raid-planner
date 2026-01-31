"""add_weekly_assignments_table

Revision ID: j0k1l2m3n4o5
Revises: h8i9j0k1l2m3
Create Date: 2026-01-31 10:00:00.000000

Creates the weekly_assignments table for Manual Planning mode.
Allows leads/owners to pre-plan loot assignments per week.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "j0k1l2m3n4o5"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "weekly_assignments" not in existing_tables:
        op.create_table(
            "weekly_assignments",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "static_group_id",
                sa.String(36),
                sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("tier_id", sa.String(50), nullable=False, index=True),
            sa.Column("week", sa.Integer(), nullable=False),
            sa.Column("floor", sa.String(10), nullable=False),
            sa.Column("slot", sa.String(20), nullable=False),
            sa.Column(
                "player_id",
                sa.String(36),
                sa.ForeignKey("snapshot_players.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("did_not_drop", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.UniqueConstraint(
                "static_group_id",
                "tier_id",
                "week",
                "floor",
                "slot",
                "player_id",
                name="uq_weekly_assignment_slot_player",
            ),
        )


def downgrade() -> None:
    # WARNING: Downgrading will drop the weekly_assignments table and
    # permanently delete all manual planning assignment data. Only run
    # this if you are sure this data is no longer needed or has been backed up.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "weekly_assignments" in existing_tables:
        op.drop_table("weekly_assignments")
