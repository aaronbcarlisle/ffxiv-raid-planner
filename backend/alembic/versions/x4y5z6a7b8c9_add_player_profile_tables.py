"""add_player_profile_tables

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-06-04

Adds player_profiles, player_characters, player_gear_snapshots, and
player_job_profiles tables for solo player profile, character linking,
gear tracking, and alt job management independent of static membership.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "x4y5z6a7b8c9"
down_revision: Union[str, None] = "w3x4y5z6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Player profiles (1:1 with users)
    op.create_table(
        "player_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, unique=True,
        ),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="private"),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("ix_player_profiles_user_id", "player_profiles", ["user_id"])

    # Player characters (linked FFXIV characters)
    op.create_table(
        "player_characters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id", sa.String(36),
            sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("lodestone_id", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("server", sa.String(100), nullable=False),
        sa.Column("data_center", sa.String(50), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_main", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("ix_player_characters_profile_id", "player_characters", ["profile_id"])
    op.create_index("ix_player_characters_lodestone_id", "player_characters", ["lodestone_id"])

    # Player gear snapshots (per character per job)
    op.create_table(
        "player_gear_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "character_id", sa.String(36),
            sa.ForeignKey("player_characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job", sa.String(10), nullable=False),
        sa.Column("gear", sa.JSON(), nullable=False),
        sa.Column("avg_item_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("synced_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.UniqueConstraint("character_id", "job", name="uq_player_gear_character_job"),
    )
    op.create_index(
        "ix_player_gear_snapshots_character_id",
        "player_gear_snapshots", ["character_id"],
    )

    # Player job profiles (main/alt job tracking)
    op.create_table(
        "player_job_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id", sa.String(36),
            sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job", sa.String(10), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="flex"),
        sa.Column("readiness", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "gear_snapshot_id", sa.String(36),
            sa.ForeignKey("player_gear_snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index(
        "ix_player_job_profiles_profile_id",
        "player_job_profiles", ["profile_id"],
    )


def downgrade() -> None:
    op.drop_table("player_job_profiles")
    op.drop_table("player_gear_snapshots")
    op.drop_table("player_characters")
    op.drop_table("player_profiles")
