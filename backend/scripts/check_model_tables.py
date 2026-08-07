#!/usr/bin/env python3
"""Assert every SQLAlchemy model has a real table, with every column, in the
migrated database.

Catches the class of bug where a model change ships without anyone writing the
Alembic migration for it. Local dev never notices, because
``database.create_tables()`` runs ``Base.metadata.create_all`` and builds every
table straight from the models -- and ``_add_missing_columns`` then ALTERs dev
SQLite to add any column a table is missing. Production only runs
``alembic upgrade head``, so the table (or column) simply never exists there:

  * a model with no migration       -> ``UndefinedTableError`` in production
  * a new column with no migration  -> ``UndefinedColumnError`` in production

Both work perfectly on every developer's machine.

That is exactly how ``player_collection_snapshots`` and
``player_collection_intents`` reached production missing: they shipped with the
Collections Center feature, create_all covered them in dev, and nothing
compared the model set against what the migration chain actually builds.

Run this against a database built by the migration chain (not by create_all) --
in CI that is the ``migration-exec`` job, which has already run
``alembic upgrade head`` against a real PostgreSQL service. Exits non-zero and
names the offending tables.

Usage:
    DATABASE_URL=postgresql://... python scripts/check_model_tables.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

import app.models  # noqa: E402,F401  (imported for its side effect: registers every model)
from app.config import get_settings  # noqa: E402
from app.database import Base  # noqa: E402

# Tables that legitimately exist in a database without a matching model.
# `alembic_version` is Alembic's own bookkeeping. `players` and `statics` are
# pre-Alembic leftovers: no migration creates or drops them, so they exist only
# in the long-lived production database, never in one built from base.
KNOWN_UNMAPPED = frozenset({"alembic_version", "players", "statics"})


async def _reflect() -> tuple[set[str], dict[str, set[str]]]:
    """Return the database's table names and each table's column names."""
    engine = create_async_engine(get_settings().async_database_url)
    try:
        async with engine.connect() as conn:
            tables = set(await conn.run_sync(lambda c: inspect(c).get_table_names()))
            columns = {
                t: await conn.run_sync(
                    lambda c, n=t: {col["name"] for col in inspect(c).get_columns(n)}
                )
                for t in tables
            }
            return tables, columns
    finally:
        await engine.dispose()


def main() -> int:
    model_tables = set(Base.metadata.tables)
    db_tables, db_columns = asyncio.run(_reflect())

    missing = sorted(model_tables - db_tables)
    unmapped = sorted(db_tables - model_tables - KNOWN_UNMAPPED)

    # Same bug, different exception: `_add_missing_columns` in app/database.py
    # auto-ALTERs dev SQLite to add any model column the table lacks, so a
    # column shipped without a migration is invisible locally and raises
    # UndefinedColumnError in production. Only meaningful for tables that exist.
    missing_columns: dict[str, list[str]] = {}
    for name in sorted(model_tables & db_tables):
        absent = {c.name for c in Base.metadata.tables[name].columns} - db_columns[name]
        if absent:
            missing_columns[name] = sorted(absent)

    print(f"Models: {len(model_tables)} tables | Database: {len(db_tables)} tables")

    if missing:
        print("")
        print("FAIL: these models have no table in the migrated database:")
        for t in missing:
            print(f"  - {t}")
        print("")
        print(
            "A model was added without an Alembic migration. `create_all` hides this\n"
            "in dev; production runs migrations only, so these tables would not exist\n"
            "there and every query against them would 500.\n"
            "\n"
            "Fix: add a migration that creates them "
            "(`alembic revision -m 'add <table>'`)."
        )
        return 1

    if missing_columns:
        print("")
        print("FAIL: these model columns are missing from the migrated database:")
        for t, cols in missing_columns.items():
            print(f"  - {t}: {', '.join(cols)}")
        print("")
        print(
            "A column was added to a model without an Alembic migration.\n"
            "`_add_missing_columns` in app/database.py ALTERs dev SQLite to add it\n"
            "automatically, so this works locally; production runs migrations only\n"
            "and every query selecting these columns would 500.\n"
            "\n"
            "Fix: add a migration that adds them "
            "(`alembic revision -m 'add <column> to <table>'`)."
        )
        return 1

    if unmapped:
        # Not a failure: a table can outlive its model during a staged removal.
        # Surfaced so the drift is visible rather than silent.
        print("")
        print("NOTE: tables present in the database with no matching model:")
        for t in unmapped:
            print(f"  - {t}")
        print("(Not a failure. Add to KNOWN_UNMAPPED if intentional.)")

    print("")
    print("OK: every model has a table, with every column, in the migrated database.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
