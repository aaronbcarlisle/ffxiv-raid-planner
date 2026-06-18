"""Add character registration fields to loot_log_entries

Revision ID: a9b0c1d2e3f4
Revises: a8b9c0d1e2f3
Create Date: 2026-06-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a9b0c1d2e3f4"
down_revision = "a8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "loot_log_entries",
        sa.Column(
            "recipient_character_registration_id",
            sa.String(36),
            sa.ForeignKey("static_character_registrations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "loot_log_entries",
        sa.Column("recipient_character_name", sa.String(100), nullable=True),
    )
    op.create_index(
        "ix_loot_log_char_registration",
        "loot_log_entries",
        ["recipient_character_registration_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_loot_log_char_registration", "loot_log_entries")
    op.drop_column("loot_log_entries", "recipient_character_name")
    op.drop_column("loot_log_entries", "recipient_character_registration_id")
