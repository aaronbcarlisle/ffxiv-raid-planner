#!/usr/bin/env python3
"""Add any model columns missing from the local SQLite dev DB (non-destructive).

The dev DB is built with SQLAlchemy create_all, which creates missing *tables*
but never adds columns to a table that already exists. As features add columns
via Alembic migrations (which the dev DB isn't on), the dev DB drifts and
queries fail with "no such column". This compares every mapped model table to
the actual sqlite schema and ALTER-ADDs the missing columns, preserving data.

Run from backend/ with the venv:  python scripts/reconcile_dev_db.py
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import Boolean, Integer, Float, Numeric  # noqa: E402
from sqlalchemy.types import NullType  # noqa: E402

import app.models  # noqa: F401,E402  (registers all models on Base.metadata)
from app.database import Base  # noqa: E402
from app.config import get_settings  # noqa: E402

settings = get_settings()


def sqlite_type(col) -> str:
    t = col.type
    if isinstance(t, Boolean):
        return "BOOLEAN"
    if isinstance(t, (Integer,)):
        return "INTEGER"
    if isinstance(t, (Float, Numeric)):
        return "REAL"
    if isinstance(t, NullType):
        return "TEXT"
    return "TEXT"


def default_clause(col) -> str:
    """A DEFAULT clause for NOT NULL columns (SQLite requires one to ALTER ADD)."""
    if col.nullable:
        return ""
    sd = col.server_default
    if sd is not None:
        # Render common server defaults. sa.true()/sa.false() may stringify as
        # "true"/"false" or "1"/"0" depending on SQLAlchemy/dialect.
        txt = str(getattr(sd, "arg", "")).strip().lower()
        if txt in {"true", "1"}:
            return " NOT NULL DEFAULT 1"
        if txt in {"false", "0"}:
            return " NOT NULL DEFAULT 0"
    # Fall back to the Python-side default (e.g. default=True) before guessing,
    # so a boolean column that defaults to True isn't backfilled as 0/false.
    pd = getattr(col, "default", None)
    if pd is not None and getattr(pd, "is_scalar", False):
        val = pd.arg
        if isinstance(val, bool):
            return f" NOT NULL DEFAULT {1 if val else 0}"
        if isinstance(val, (int, float)):
            return f" NOT NULL DEFAULT {val}"
    if isinstance(col.type, Boolean):
        return " NOT NULL DEFAULT 0"
    if isinstance(col.type, (Integer, Float, Numeric)):
        return " NOT NULL DEFAULT 0"
    # Fall back: add as nullable to avoid failing on TEXT NOT NULL with no default.
    return ""


def main() -> int:
    db_path = settings.database_url.split("///")[-1]
    if not Path(db_path).is_file():
        print(f"dev DB not found at {db_path} — nothing to reconcile (create_all will build it fresh).")
        return 0

    con = sqlite3.connect(db_path)
    added = 0
    for table in Base.metadata.sorted_tables:
        existing = {r[1] for r in con.execute(f'PRAGMA table_info("{table.name}")').fetchall()}
        if not existing:
            # Table doesn't exist yet — create_all handles that on startup.
            continue
        for col in table.columns:
            if col.name in existing:
                continue
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {sqlite_type(col)}{default_clause(col)}'
            con.execute(ddl)
            print(f"+ {table.name}.{col.name}  ({sqlite_type(col)})")
            added += 1
    con.commit()
    con.close()
    print(f"\nDone — added {added} missing column(s) to {db_path}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
