"""add_catalog_game_ids

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-21

Adds game_mount_id and token_item_id to collection_catalog_items.
These are stable game IDs from Mount.exd and Item.exd (Lumina/SaintCoinach)
used by the Dalamud plugin for IsMountUnlocked() and InventoryManager scans.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "fa1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collection_catalog_items",
        sa.Column("token_item_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "collection_catalog_items",
        sa.Column("game_mount_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("collection_catalog_items", "game_mount_id")
    op.drop_column("collection_catalog_items", "token_item_id")
