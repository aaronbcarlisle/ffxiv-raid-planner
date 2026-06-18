"""Add static_character_registrations table

Revision ID: a7b8c9d0e1f2
Revises: b1c2d3e4f5a6
Create Date: 2026-06-18 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a7b8c9d0e1f2"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "static_character_registrations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "static_group_id",
            sa.String(36),
            sa.ForeignKey("static_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "snapshot_player_id",
            sa.String(36),
            sa.ForeignKey("snapshot_players.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "player_character_id",
            sa.String(36),
            sa.ForeignKey("player_characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("manual_character_name", sa.String(100), nullable=True),
        sa.Column("manual_world", sa.String(100), nullable=True),
        sa.Column("manual_data_center", sa.String(50), nullable=True),
        sa.Column("role_in_static", sa.String(20), nullable=False, server_default="alt"),
        sa.Column("job", sa.String(10), nullable=True),
        sa.Column("is_primary_for_static", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("last_synced_at", sa.Text, nullable=True),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
        sa.UniqueConstraint(
            "static_group_id", "snapshot_player_id", "player_character_id",
            name="uq_static_player_character",
        ),
    )
    op.create_index(
        "ix_static_char_reg_static_group",
        "static_character_registrations",
        ["static_group_id"],
    )
    op.create_index(
        "ix_static_char_reg_snapshot_player",
        "static_character_registrations",
        ["snapshot_player_id"],
    )
    op.create_index(
        "ix_static_char_reg_player_character",
        "static_character_registrations",
        ["player_character_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_static_char_reg_player_character")
    op.drop_index("ix_static_char_reg_snapshot_player")
    op.drop_index("ix_static_char_reg_static_group")
    op.drop_table("static_character_registrations")
