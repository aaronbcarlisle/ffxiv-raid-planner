#!/usr/bin/env python3
"""Flag Postgres-hostile column defaults in Alembic migrations - no DB needed.

The CI `migration-exec` job catches dialect bugs by actually running the chain
against PostgreSQL, but that needs a live Postgres. This is the cheap, offline
counterpart so the same class can be caught at pre-push time (and on any machine
without Docker/Postgres).

Catches the form that crashed a Railway deploy: a ``Boolean`` column (or
``alter_column``) given an integer ``server_default`` via ``sa.text("0")`` /
``sa.text("1")``. ``text()`` emits raw SQL, so the column gets ``DEFAULT 0`` (an
integer), which Postgres rejects with ``DatatypeMismatchError: column ... is of
type boolean but default expression is of type integer``. SQLite accepts it, so
it slips through dev/tests. Use ``sa.false()`` / ``sa.true()`` (or
``sa.text("false")``) instead, which render correctly per dialect.

These forms are all fine and must NOT flag:
  * ``server_default="0"``       -> ``DEFAULT '0'`` (quoted string; Postgres
    casts ``'0'::boolean`` happily)
  * ``server_default=sa.false()`` / ``sa.text("false")`` -> ``DEFAULT false``
  * ``server_default=0`` (bare int) is impossible - SQLAlchemy rejects it at
    construction, so it can never reach Postgres.

Pure stdlib AST parsing. Covers ``sa.Column(...)`` (type positional or
``type_=``) and ``op.alter_column(...)`` (``type_=`` only - an ``alter_column``
that sets just a default carries no type info, so it is left alone to avoid
false positives on integer columns). Exits non-zero and prints each offender.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"

# Calls that give a column a type together with a server_default.
_COLUMN_CALLS = {"Column", "alter_column"}


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


def _renders_bare_integer(node: ast.AST) -> bool:
    """True only if the server_default renders as a *bare* integer literal.

    The single broken form is ``sa.text("0")`` / ``sa.text("1")``: ``text()``
    emits raw SQL, so the column gets ``DEFAULT 0`` (an integer) which Postgres
    refuses on a boolean column. ``server_default="0"`` (a quoted string) and
    ``sa.false()`` / ``sa.text("false")`` are all valid and must not match.
    """
    if isinstance(node, ast.Call) and _name_of(node.func) == "text" and node.args:
        first = node.args[0]
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            return first.value.strip().lstrip("-").isdigit()
    return False


def _boolean_type_present(call: ast.Call, *, include_positional: bool) -> bool:
    """Whether the call gives the column a Boolean type (positional or `type_=`)."""
    candidates: list[ast.AST] = []
    if include_positional:
        candidates.extend(call.args[1:])  # positional args after the column name
    candidates.extend(kw.value for kw in call.keywords if kw.arg == "type_")
    return any(_is_boolean_type(c) for c in candidates)


def _server_default(call: ast.Call) -> ast.AST | None:
    for kw in call.keywords:
        if kw.arg == "server_default":
            return kw.value
    return None


def _column_name(call: ast.Call, name_index: int) -> str:
    if len(call.args) > name_index and isinstance(call.args[name_index], ast.Constant):
        return str(call.args[name_index].value)
    return "<unknown>"


def _check_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (SyntaxError, ValueError, OSError) as exc:
        return [f"{path.name}: could not parse ({exc})"]

    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _name_of(node.func) in _COLUMN_CALLS):
            continue
        # Column(name, type, ...): the column name is arg 0 and the type may be
        # positional. alter_column(table, column, ..., type_=, server_default=):
        # the column name is arg 1 and there is no positional type.
        is_column = _name_of(node.func) == "Column"
        if not _boolean_type_present(node, include_positional=is_column):
            continue
        default = _server_default(node)
        if default is not None and _renders_bare_integer(default):
            name_index = 0 if is_column else 1
            errors.append(
                f"{path.name}:{node.lineno}: Boolean column "
                f"'{_column_name(node, name_index)}' has an integer server_default "
                f"- use sa.false()/sa.true() (Postgres rejects integer defaults on "
                f"boolean columns)"
            )
    return errors


def main() -> int:
    if not VERSIONS_DIR.is_dir():
        print(f"ERROR: migrations directory not found: {VERSIONS_DIR}")
        return 1
    files = sorted(p for p in VERSIONS_DIR.glob("*.py") if p.name != "__init__.py")
    if not files:
        print(f"ERROR: no migration files found in {VERSIONS_DIR}")
        return 1

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
