"""player_character lodestone_id nullable

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-26

Makes player_characters.lodestone_id nullable. Characters auto-provisioned from
a Dalamud plugin gear sync have no Lodestone verification yet (the plugin only
reports the in-game name + world); a later website "link character" backfills
the verified id.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("player_characters", schema=None) as batch_op:
        batch_op.alter_column(
            "lodestone_id",
            existing_type=sa.String(length=50),
            nullable=True,
        )


def downgrade() -> None:
    # Plugin-provisioned characters have a NULL lodestone_id and cannot satisfy
    # the restored NOT NULL constraint; drop them before re-adding it so the
    # downgrade doesn't fail on real data.
    op.execute("DELETE FROM player_characters WHERE lodestone_id IS NULL")
    with op.batch_alter_table("player_characters", schema=None) as batch_op:
        batch_op.alter_column(
            "lodestone_id",
            existing_type=sa.String(length=50),
            nullable=False,
        )
