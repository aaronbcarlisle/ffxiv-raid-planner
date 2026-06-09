"""Tests for the offline migration dialect guard (scripts/check_migration_dialect.py).

The script catches Boolean columns given an integer server_default via
``sa.text("0")`` - the form that renders a bare ``DEFAULT 0`` and crashes
``alembic upgrade head`` on PostgreSQL while passing silently on SQLite.
These tests pin both what it must flag and what it must leave alone.
"""

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "check_migration_dialect.py"
_spec = importlib.util.spec_from_file_location("check_migration_dialect", _SCRIPT)
dialect_check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dialect_check)


def _write(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "m.py"
    path.write_text("import sqlalchemy as sa\nfrom alembic import op\n\n" + body + "\n", encoding="utf-8")
    return path


# Forms that render a bare integer default on a boolean column -> must flag.
BAD = [
    'c = sa.Column("flag", sa.Boolean(), nullable=False, server_default=sa.text("0"))',
    'c = sa.Column("flag", sa.Boolean, server_default=sa.text("1"))',
    'c = sa.Column("flag", type_=sa.Boolean(), server_default=sa.text("0"))',
    'op.alter_column("t", "flag", type_=sa.Boolean(), server_default=sa.text("0"))',
    'c = sa.Column("flag", sa.Boolean(), server_default=sa.text("-1"))',
]

# Forms that are valid on Postgres -> must NOT flag.
GOOD = [
    'c = sa.Column("flag", sa.Boolean(), server_default="0")',          # quoted string -> DEFAULT '0'
    'c = sa.Column("flag", sa.Boolean(), server_default=sa.false())',
    'c = sa.Column("flag", sa.Boolean(), server_default=sa.text("false"))',
    'c = sa.Column("count", sa.Integer(), server_default=sa.text("0"))',  # integer column, valid
    'op.alter_column("t", "flag", server_default=sa.text("0"))',         # no type info -> can't assume boolean
    'c = sa.Column("flag", sa.Boolean())',                              # no default at all
]


@pytest.mark.parametrize("body", BAD)
def test_flags_integer_boolean_defaults(tmp_path, body):
    findings = dialect_check._check_file(_write(tmp_path, body))
    assert findings, f"expected a finding for: {body}"


@pytest.mark.parametrize("body", GOOD)
def test_ignores_valid_defaults(tmp_path, body):
    findings = dialect_check._check_file(_write(tmp_path, body))
    assert findings == [], f"unexpected finding for: {body}"


def test_missing_versions_dir_fails_loud(monkeypatch, tmp_path):
    """A guard that finds no files must fail, not silently report OK."""
    monkeypatch.setattr(dialect_check, "VERSIONS_DIR", tmp_path / "does_not_exist")
    assert dialect_check.main() == 1


def test_empty_versions_dir_fails_loud(monkeypatch, tmp_path):
    monkeypatch.setattr(dialect_check, "VERSIONS_DIR", tmp_path)
    assert dialect_check.main() == 1
