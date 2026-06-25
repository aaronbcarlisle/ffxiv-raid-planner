"""add_collection_plugin_sync

Revision ID: fa1b2c3d4e5f
Revises: e4f5g6h7i8j9
Create Date: 2026-06-21

Adds last_manual_override_at to reward_participant_states for collision avoidance
between plugin sync and manual participant state overrides.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "fa1b2c3d4e5f"
down_revision: Union[str, None] = "e4f5g6h7i8j9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reward_participant_states",
        sa.Column("last_manual_override_at", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reward_participant_states", "last_manual_override_at")
