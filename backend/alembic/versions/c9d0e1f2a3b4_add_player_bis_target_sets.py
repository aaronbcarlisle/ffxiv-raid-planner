"""add_player_bis_target_sets

Revision ID: c9d0e1f2a3b4
Revises: cg01a2b3c4d5e
Create Date: 2026-06-12

Adds player_bis_target_sets table for per-job BiS target configuration.
Linked to player_job_profiles with CASCADE delete so targets disappear
when the owning job profile is removed.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "cg01a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "player_bis_target_sets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id", sa.String(36),
            sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_profile_id", sa.String(36),
            sa.ForeignKey("player_job_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job", sa.String(10), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False, server_default="savage"),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("external_url", sa.Text, nullable=True),
        sa.Column("import_status", sa.String(20), nullable=False, server_default="linked_only"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("item_level", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("items_json", sa.JSON, nullable=True),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
    )
    op.create_index(
        "ix_player_bis_target_sets_profile_id",
        "player_bis_target_sets", ["profile_id"],
    )
    op.create_index(
        "ix_player_bis_target_sets_job_profile_id",
        "player_bis_target_sets", ["job_profile_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_player_bis_target_sets_job_profile_id", table_name="player_bis_target_sets")
    op.drop_index("ix_player_bis_target_sets_profile_id", table_name="player_bis_target_sets")
    op.drop_table("player_bis_target_sets")
