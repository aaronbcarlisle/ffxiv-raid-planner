"""add_collection_plugin_sync

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Create Date: 2026-06-21

Adds last_manual_override_at to reward_participant_states for collision avoidance
between plugin sync and manual participant state overrides.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "z6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reward_participant_states",
        sa.Column("last_manual_override_at", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reward_participant_states", "last_manual_override_at")
