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
    """Create material_log_entries table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if table already exists - if so, nothing to do
    if "material_log_entries" in inspector.get_table_names():
        return

    # Create enum type if it doesn't exist (using raw SQL for reliability)
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'materialtype') THEN
                CREATE TYPE materialtype AS ENUM ('twine', 'glaze', 'solvent');
            END IF;
        END $$;
    """))

    # Create table using raw SQL to avoid any SQLAlchemy enum creation issues
    bind.execute(sa.text("""
        CREATE TABLE material_log_entries (
            id SERIAL PRIMARY KEY,
            tier_snapshot_id VARCHAR(36) NOT NULL REFERENCES tier_snapshots(id) ON DELETE CASCADE,
            week_number INTEGER NOT NULL,
            floor VARCHAR(10) NOT NULL,
            material_type materialtype NOT NULL,
            recipient_player_id VARCHAR(36) NOT NULL REFERENCES snapshot_players(id) ON DELETE CASCADE,
            notes TEXT,
            created_at TEXT NOT NULL,
            created_by_user_id VARCHAR(36) NOT NULL REFERENCES users(id)
        );
    """))

    # Create indexes
    bind.execute(sa.text("CREATE INDEX ix_material_log_entries_tier_snapshot_id ON material_log_entries(tier_snapshot_id);"))
    bind.execute(sa.text("CREATE INDEX ix_material_log_entries_week_number ON material_log_entries(week_number);"))
    bind.execute(sa.text("CREATE INDEX ix_material_log_entries_tier_week ON material_log_entries(tier_snapshot_id, week_number);"))


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
