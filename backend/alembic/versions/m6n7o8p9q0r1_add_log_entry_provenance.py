"""Add write-provenance columns to the loot, material, book and farm-drop logs

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-10-01

PROV-1 (design/redesign/plans/2026-09-30-prov1-provenance.md, R-PV-1, R-PV-3,
R-PV-4, R-PV-9, HS-36). 18 nullable columns, no server default, no backfill
(existing rows stay NULL, meaning "unknown origin"):

  logged_via                          x4  loot, material, page ledger, reward drop
  api_key_id (FK api_keys, SET NULL)  x4  same four tables
  recipient_user_id (FK users)        x3  loot, material, page ledger
  recipient_character_source          x3  loot, material, page ledger
  recipient_character_registration_id x2  material, page ledger (loot has it)
  recipient_character_name            x2  material, page ledger (loot has it)

Indexes (SQLAlchemy's default names, so create_all and this chain agree):
recipient_user_id x3 and recipient_character_registration_id x2.

Idempotent add-column and add-index guards, per l5m6n7o8p9q0: dev SQLite
picks the columns up from the models (create_all / _add_missing_columns), so
the guards keep this a no-op there and it does real work only on a database
built by the migration chain (production, the migration-exec CI job).

Downgrade drops each index before its column, because SQLite refuses to drop
an indexed column.
"""

import sqlalchemy as sa

from alembic import op

revision = "m6n7o8p9q0r1"
down_revision = "l5m6n7o8p9q0"
branch_labels = None
depends_on = None

TIER_TABLES = ("loot_log_entries", "material_log_entries", "page_ledger_entries")
ALL_TABLES = (*TIER_TABLES, "reward_drop_log")
CHARACTER_PAIR_TABLES = ("material_log_entries", "page_ledger_entries")


def _columns(table: str) -> list[sa.Column]:
    """The new columns for `table`, in a fixed order."""
    cols: list[sa.Column] = [
        sa.Column("logged_via", sa.String(10), nullable=True),
        sa.Column(
            "api_key_id",
            sa.String(36),
            sa.ForeignKey("api_keys.id", ondelete="SET NULL", name=f"fk_{table}_api_key_id"),
            nullable=True,
        ),
    ]
    if table in TIER_TABLES:
        cols.append(
            sa.Column(
                "recipient_user_id",
                sa.String(36),
                sa.ForeignKey(
                    "users.id", ondelete="SET NULL", name=f"fk_{table}_recipient_user_id"
                ),
                nullable=True,
            )
        )
        cols.append(sa.Column("recipient_character_source", sa.String(10), nullable=True))
    if table in CHARACTER_PAIR_TABLES:
        cols.append(
            sa.Column(
                "recipient_character_registration_id",
                sa.String(36),
                sa.ForeignKey(
                    "static_character_registrations.id",
                    ondelete="SET NULL",
                    name=f"fk_{table}_recipient_character_registration_id",
                ),
                nullable=True,
            )
        )
        cols.append(sa.Column("recipient_character_name", sa.String(100), nullable=True))
    return cols


def _indexed_columns(table: str) -> list[str]:
    """Columns of `table` that get an ix_<table>_<column> index."""
    names: list[str] = []
    if table in TIER_TABLES:
        names.append("recipient_user_id")
    if table in CHARACTER_PAIR_TABLES:
        names.append("recipient_character_registration_id")
    return names


def upgrade() -> None:
    bind = op.get_bind()
    for table in ALL_TABLES:
        existing = {c["name"] for c in sa.inspect(bind).get_columns(table)}
        # batch_alter_table so SQLite can add the FK columns too (a plain add_column
        # with a ForeignKey raises there); on Postgres it is a straight ALTER TABLE.
        with op.batch_alter_table(table) as batch_op:
            for column in _columns(table):
                if column.name not in existing:
                    batch_op.add_column(column)

        indexes = {i["name"] for i in sa.inspect(bind).get_indexes(table)}
        for name in _indexed_columns(table):
            index_name = f"ix_{table}_{name}"
            if index_name not in indexes:
                op.create_index(index_name, table, [name])


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(ALL_TABLES):
        indexes = {i["name"] for i in sa.inspect(bind).get_indexes(table)}
        for name in _indexed_columns(table):
            index_name = f"ix_{table}_{name}"
            if index_name in indexes:
                op.drop_index(index_name, table_name=table)

        # _columns() lists only this revision's columns: loot's character pair
        # predates it and stays.
        existing = {c["name"] for c in sa.inspect(bind).get_columns(table)}
        with op.batch_alter_table(table) as batch_op:
            for column in reversed(_columns(table)):
                if column.name in existing:
                    batch_op.drop_column(column.name)
