"""add_profile_share_code

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-06-05

Adds share_code and share_enabled columns to player_profiles for
shareable profile URLs and public profile viewing.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "z6a7b8c9d0e1"
down_revision: Union[str, None] = "y5z6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "player_profiles",
        sa.Column("share_code", sa.String(8), nullable=True),
    )
    op.add_column(
        "player_profiles",
        sa.Column("share_enabled", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_player_profiles_share_code", "player_profiles", ["share_code"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_player_profiles_share_code", table_name="player_profiles")
    op.drop_column("player_profiles", "share_enabled")
    op.drop_column("player_profiles", "share_code")
