"""add_mount_farm_source_tracking

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-06-04

Adds source tracking columns to mount_farm_progress for automation support:
ownership_source, totem_source, last_imported_at, last_plugin_sync_at,
last_manual_override_at.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v2w3x4y5z6a7"
down_revision: Union[str, None] = "u1v2w3x4y5z6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "mount_farm_progress" not in inspector.get_table_names():
        return

    existing_columns = [col["name"] for col in inspector.get_columns("mount_farm_progress")]

    if "ownership_source" not in existing_columns:
        op.add_column(
            "mount_farm_progress",
            sa.Column("ownership_source", sa.String(20), nullable=False, server_default="manual"),
        )

    if "totem_source" not in existing_columns:
        op.add_column(
            "mount_farm_progress",
            sa.Column("totem_source", sa.String(20), nullable=False, server_default="manual"),
        )

    if "last_imported_at" not in existing_columns:
        op.add_column(
            "mount_farm_progress",
            sa.Column("last_imported_at", sa.Text, nullable=True),
        )

    if "last_plugin_sync_at" not in existing_columns:
        op.add_column(
            "mount_farm_progress",
            sa.Column("last_plugin_sync_at", sa.Text, nullable=True),
        )

    if "last_manual_override_at" not in existing_columns:
        op.add_column(
            "mount_farm_progress",
            sa.Column("last_manual_override_at", sa.Text, nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "mount_farm_progress" not in inspector.get_table_names():
        return

    existing_columns = [col["name"] for col in inspector.get_columns("mount_farm_progress")]

    for col in ("last_manual_override_at", "last_plugin_sync_at", "last_imported_at", "totem_source", "ownership_source"):
        if col in existing_columns:
            op.drop_column("mount_farm_progress", col)
