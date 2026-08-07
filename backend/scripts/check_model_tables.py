#!/usr/bin/env python3
"""Assert every SQLAlchemy model has a real table in the migrated database.

Catches the class of bug where a model ships without anyone writing the
Alembic migration for it. Local dev never notices, because
``database.create_tables()`` runs ``Base.metadata.create_all`` and builds every
table straight from the models. Production only runs ``alembic upgrade head``,
so the table simply never exists there and every read 500s with
``UndefinedTableError``.

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


async def _actual_tables() -> set[str]:
    engine = create_async_engine(get_settings().async_database_url)
    try:
        async with engine.connect() as conn:
            return set(await conn.run_sync(lambda c: inspect(c).get_table_names()))
    finally:
        await engine.dispose()


def main() -> int:
    model_tables = set(Base.metadata.tables)
    db_tables = asyncio.run(_actual_tables())

    missing = sorted(model_tables - db_tables)
    unmapped = sorted(db_tables - model_tables - KNOWN_UNMAPPED)

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

    if unmapped:
        # Not a failure: a table can outlive its model during a staged removal.
        # Surfaced so the drift is visible rather than silent.
        print("")
        print("NOTE: tables present in the database with no matching model:")
        for t in unmapped:
            print(f"  - {t}")
        print("(Not a failure. Add to KNOWN_UNMAPPED if intentional.)")

    print("")
    print("OK: every model has a table in the migrated database.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
