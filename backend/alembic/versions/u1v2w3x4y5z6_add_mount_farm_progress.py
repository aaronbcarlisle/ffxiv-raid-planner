"""add_mount_farm_progress

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-06-04

Adds mount_farm_progress table for tracking per-member mount/totem
progress on Extreme trials within a static group.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "u1v2w3x4y5z6"
down_revision: Union[str, None] = "s9t0u1v2w3x4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "mount_farm_progress" not in existing_tables:
        op.create_table(
            "mount_farm_progress",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("static_group_id", sa.String(36), sa.ForeignKey("static_groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("trial_id", sa.String(50), nullable=False),
            sa.Column("has_mount", sa.Boolean, nullable=False, server_default=sa.text("0")),
            sa.Column("wants_mount", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column("totem_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("updated_at", sa.Text, nullable=False),
            sa.Column("updated_by_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.UniqueConstraint("static_group_id", "user_id", "trial_id", name="uq_mount_farm_progress"),
        )
        op.create_index("ix_mount_farm_progress_static_group_id", "mount_farm_progress", ["static_group_id"])
        op.create_index("ix_mount_farm_progress_user_id", "mount_farm_progress", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "mount_farm_progress" in existing_tables:
        op.drop_index("ix_mount_farm_progress_user_id", table_name="mount_farm_progress")
        op.drop_index("ix_mount_farm_progress_static_group_id", table_name="mount_farm_progress")
        op.drop_table("mount_farm_progress")
