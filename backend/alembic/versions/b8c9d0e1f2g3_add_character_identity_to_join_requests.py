"""add_character_identity_to_join_requests

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-06

Stores applicant character identity (name, world, data center, avatar)
at application time so leader review shows FFXIV character info instead
of only Discord display name.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2g3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.add_column(
            sa.Column("character_name_at_apply", sa.String(100), nullable=True)
        )
        batch_op.add_column(
            sa.Column("character_world_at_apply", sa.String(50), nullable=True)
        )
        batch_op.add_column(
            sa.Column("character_dc_at_apply", sa.String(50), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "character_avatar_url_at_apply", sa.Text(), nullable=True
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.drop_column("character_avatar_url_at_apply")
        batch_op.drop_column("character_dc_at_apply")
        batch_op.drop_column("character_world_at_apply")
        batch_op.drop_column("character_name_at_apply")
