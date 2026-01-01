"""add_loot_tracking_tables

Revision ID: e036708b4e61
Revises: 8e34a613492c
Create Date: 2026-01-01 00:33:07.813343

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e036708b4e61"
down_revision: Union[str, Sequence[str], None] = "8e34a613492c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create loot_log_entries table
    op.create_table(
        "loot_log_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tier_snapshot_id", sa.String(length=36), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("floor", sa.String(length=10), nullable=False),
        sa.Column("item_slot", sa.String(length=20), nullable=False),
        sa.Column("recipient_player_id", sa.String(length=36), nullable=False),
        sa.Column("method", sa.Enum("drop", "book", "tome", name="lootmethod"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["tier_snapshot_id"], ["tier_snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_player_id"], ["snapshot_players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_loot_log_entries_id"), "loot_log_entries", ["id"], unique=False)

    # Create page_ledger_entries table
    op.create_table(
        "page_ledger_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tier_snapshot_id", sa.String(length=36), nullable=False),
        sa.Column("player_id", sa.String(length=36), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("floor", sa.String(length=10), nullable=False),
        sa.Column("book_type", sa.String(length=10), nullable=False),
        sa.Column(
            "transaction_type",
            sa.Enum("earned", "spent", "missed", "adjustment", name="transactiontype"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["tier_snapshot_id"], ["tier_snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"], ["snapshot_players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_page_ledger_entries_id"), "page_ledger_entries", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop page_ledger_entries table
    op.drop_index(op.f("ix_page_ledger_entries_id"), table_name="page_ledger_entries")
    op.drop_table("page_ledger_entries")

    # Drop loot_log_entries table
    op.drop_index(op.f("ix_loot_log_entries_id"), table_name="loot_log_entries")
    op.drop_table("loot_log_entries")

    # Drop enum types (PostgreSQL only)
    # SQLite will ignore this
    op.execute("DROP TYPE IF EXISTS lootmethod")
    op.execute("DROP TYPE IF EXISTS transactiontype")
