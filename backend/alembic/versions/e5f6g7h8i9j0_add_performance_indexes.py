"""add_performance_indexes

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-01-09 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6g7h8i9j0"
down_revision: Union[str, None] = "d4e5f6g7h8i9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check for existing indexes before creating to make migration idempotent
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def index_exists(table_name: str, index_name: str) -> bool:
        indexes = inspector.get_indexes(table_name)
        return any(idx["name"] == index_name for idx in indexes)

    # SnapshotPlayer indexes
    if not index_exists("snapshot_players", "ix_snapshot_players_position"):
        op.create_index(
            "ix_snapshot_players_position",
            "snapshot_players",
            ["position"],
        )

    # LootLogEntry indexes - composite for week-based queries
    if not index_exists("loot_log_entries", "ix_loot_log_entries_tier_week"):
        op.create_index(
            "ix_loot_log_entries_tier_week",
            "loot_log_entries",
            ["tier_snapshot_id", "week_number"],
        )

    if not index_exists("loot_log_entries", "ix_loot_log_entries_floor"):
        op.create_index(
            "ix_loot_log_entries_floor",
            "loot_log_entries",
            ["floor"],
        )

    # PageLedgerEntry indexes - critical for balance calculations
    if not index_exists("page_ledger_entries", "ix_page_ledger_entries_player_id"):
        op.create_index(
            "ix_page_ledger_entries_player_id",
            "page_ledger_entries",
            ["player_id"],
        )

    if not index_exists("page_ledger_entries", "ix_page_ledger_entries_player_week"):
        op.create_index(
            "ix_page_ledger_entries_player_week",
            "page_ledger_entries",
            ["player_id", "week_number"],
        )

    # MaterialLogEntry indexes
    if not index_exists("material_log_entries", "ix_material_log_entries_tier_week"):
        op.create_index(
            "ix_material_log_entries_tier_week",
            "material_log_entries",
            ["tier_snapshot_id", "week_number"],
        )


def downgrade() -> None:
    # Check for existing indexes before dropping to make migration idempotent
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def index_exists(table_name: str, index_name: str) -> bool:
        indexes = inspector.get_indexes(table_name)
        return any(idx["name"] == index_name for idx in indexes)

    if index_exists("material_log_entries", "ix_material_log_entries_tier_week"):
        op.drop_index("ix_material_log_entries_tier_week", table_name="material_log_entries")

    if index_exists("page_ledger_entries", "ix_page_ledger_entries_player_week"):
        op.drop_index("ix_page_ledger_entries_player_week", table_name="page_ledger_entries")

    if index_exists("page_ledger_entries", "ix_page_ledger_entries_player_id"):
        op.drop_index("ix_page_ledger_entries_player_id", table_name="page_ledger_entries")

    if index_exists("loot_log_entries", "ix_loot_log_entries_floor"):
        op.drop_index("ix_loot_log_entries_floor", table_name="loot_log_entries")

    if index_exists("loot_log_entries", "ix_loot_log_entries_tier_week"):
        op.drop_index("ix_loot_log_entries_tier_week", table_name="loot_log_entries")

    if index_exists("snapshot_players", "ix_snapshot_players_position"):
        op.drop_index("ix_snapshot_players_position", table_name="snapshot_players")
