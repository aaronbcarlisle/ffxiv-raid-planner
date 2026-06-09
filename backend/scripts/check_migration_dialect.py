#!/usr/bin/env python3
"""Flag Postgres-hostile column defaults in Alembic migrations - no DB needed.

The CI `migration-exec` job catches dialect bugs by actually running the chain
against PostgreSQL, but that needs a live Postgres. This is the cheap, offline
counterpart so the same class can be caught at pre-push time (and on any machine
without Docker/Postgres).

Currently catches the bug that crashed two Railway deploys: a ``Boolean`` column
given an *integer* ``server_default`` (``server_default=sa.text("0")``, ``0``,
``"1"``, ...). SQLite accepts it; PostgreSQL rejects it with
``DatatypeMismatchError: column ... is of type boolean but default expression is
of type integer``. Use ``sa.false()`` / ``sa.true()`` (or ``sa.text("false")``)
instead, which render correctly per dialect.

Pure stdlib AST parsing. Exits non-zero and prints each offending column.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"


def _name_of(node: ast.AST) -> str:
    """Return the trailing identifier of a Name (`Boolean`) or Attribute (`sa.Boolean`)."""
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Name):
        return node.id
    return ""


def _is_boolean_type(node: ast.AST) -> bool:
    """True for `sa.Boolean`, `Boolean`, or `sa.Boolean()` (called form)."""
    if isinstance(node, ast.Call):
        node = node.func
    return _name_of(node) == "Boolean"


def _is_integer_default(node: ast.AST) -> bool:
    """True only if the server_default renders as a *bare* integer literal.

    The single broken form is ``sa.text("0")`` / ``sa.text("1")``: ``text()``
    emits raw SQL, so the column gets ``DEFAULT 0`` (an integer) which Postgres
    refuses on a boolean column. These forms are all *fine* and must NOT flag:
      * ``server_default="0"``      -> renders ``DEFAULT '0'`` (a quoted string;
        Postgres casts ``'0'::boolean`` happily)
      * ``server_default=sa.false()`` / ``sa.text("false")`` -> ``DEFAULT false``
      * ``server_default=0`` (bare int) is impossible - SQLAlchemy rejects it at
        construction, so it can never reach Postgres.
    """
    if isinstance(node, ast.Call) and _name_of(node.func) == "text" and node.args:
        first = node.args[0]
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            return first.value.strip().lstrip("-").isdigit()
    return False


def _column_name(call: ast.Call) -> str:
    if call.args and isinstance(call.args[0], ast.Constant):
        return str(call.args[0].value)
    return "<unknown>"


def _check_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except SyntaxError as exc:  # pragma: no cover - a broken migration file
        return [f"{path.name}: could not parse ({exc})"]

    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _name_of(node.func) == "Column"):
            continue
        type_args = node.args[1:]  # first positional arg is the column name
        if not any(_is_boolean_type(a) for a in type_args):
            continue
        for kw in node.keywords:
            if kw.arg == "server_default" and _is_integer_default(kw.value):
                errors.append(
                    f"{path.name}:{node.lineno}: Boolean column "
                    f"'{_column_name(node)}' has an integer server_default - "
                    f"use sa.false()/sa.true() (Postgres rejects integer "
                    f"defaults on boolean columns)"
                )
    return errors


def main() -> int:
    files = sorted(p for p in VERSIONS_DIR.glob("*.py") if p.name != "__init__.py")
    errors: list[str] = []
    for path in files:
        errors.extend(_check_file(path))

    if errors:
        print("Migration dialect check FAILED:\n")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"OK: {len(files)} migrations have no Postgres-hostile boolean defaults.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
