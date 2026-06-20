"""add_character_links_to_split_clear

Revision ID: b1c2d3e4f5a6
Revises: split01a2b3c4
Create Date: 2026-06-18

Adds run_a_character_link_id and run_b_character_link_id to split_clear_assignments,
referencing player_characters. Old text fields (main_character_name, alt_character_name,
etc.) are kept for backward compatibility and manual-entry fallback.
"""

from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a6"
down_revision = "split01a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "split_clear_assignments",
        sa.Column(
            "run_a_character_link_id",
            sa.String(36),
            sa.ForeignKey("player_characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "split_clear_assignments",
        sa.Column(
            "run_b_character_link_id",
            sa.String(36),
            sa.ForeignKey("player_characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_split_clear_run_a_link",
        "split_clear_assignments",
        ["run_a_character_link_id"],
    )
    op.create_index(
        "ix_split_clear_run_b_link",
        "split_clear_assignments",
        ["run_b_character_link_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_split_clear_run_b_link", table_name="split_clear_assignments")
    op.drop_index("ix_split_clear_run_a_link", table_name="split_clear_assignments")
    op.drop_column("split_clear_assignments", "run_b_character_link_id")
    op.drop_column("split_clear_assignments", "run_a_character_link_id")
