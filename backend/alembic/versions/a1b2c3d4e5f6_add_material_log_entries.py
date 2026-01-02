"""add_material_log_entries

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-01-01 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create material_log_entries table and materialtype enum."""
    bind = op.get_bind()

    # Use DO block to safely create enum only if it doesn't exist
    # This is atomic and works correctly with asyncpg
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'materialtype') THEN
                CREATE TYPE materialtype AS ENUM ('twine', 'glaze', 'solvent');
            END IF;
        END
        $$;
    """))

    # Check if table already exists before creating
    inspector = sa.inspect(bind)
    if "material_log_entries" in inspector.get_table_names():
        return  # Table already exists, nothing to do

    # Create the table
    op.create_table(
        "material_log_entries",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("tier_snapshot_id", sa.String(36), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("floor", sa.String(10), nullable=False),
        sa.Column(
            "material_type",
            sa.Enum("twine", "glaze", "solvent", name="materialtype", create_type=False),
            nullable=False,
        ),
        sa.Column("recipient_player_id", sa.String(36), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["tier_snapshot_id"],
            ["tier_snapshots.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_player_id"],
            ["snapshot_players.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
        ),
    )
    op.create_index("ix_material_log_entries_tier_snapshot_id", "material_log_entries", ["tier_snapshot_id"])
    op.create_index("ix_material_log_entries_week_number", "material_log_entries", ["week_number"])
    # Composite index for common query pattern (tier + week filtering)
    op.create_index(
        "ix_material_log_entries_tier_week",
        "material_log_entries",
        ["tier_snapshot_id", "week_number"],
    )


def downgrade() -> None:
    """Drop material_log_entries table and materialtype enum."""
    # Check if table exists before dropping indexes
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "material_log_entries" in inspector.get_table_names():
        op.drop_index("ix_material_log_entries_tier_week", table_name="material_log_entries")
        op.drop_index("ix_material_log_entries_week_number", table_name="material_log_entries")
        op.drop_index("ix_material_log_entries_tier_snapshot_id", table_name="material_log_entries")
        op.drop_table("material_log_entries")

    # Drop the enum type (PostgreSQL only)
    materialtype_enum = sa.Enum("twine", "glaze", "solvent", name="materialtype")
    materialtype_enum.drop(op.get_bind(), checkfirst=True)
