"""PROV-1 PV-3: completeness guard for write provenance (vet M-5, vet I-4).

Parses `backend/app` and `backend/scripts` with `ast` and fails when a row of a
provenance table can be written without recording how it was logged:

  (a) the (module, function) sites that construct a provenance model equal
      EXPECTED_SITES, so a new creation path fails here until it is wired,
      listed and given a route test;
  (b) every construction passes `logged_via=` and `api_key_id=` as explicit
      keywords (and, on the three tier models, the recipient fields), never
      through `**`, and `logged_via` is never the constant None;
  (c) nothing writes these tables through `insert()` (under any import name),
      a `bulk_*` method, `merge`, `make_transient` or an `INSERT INTO` string
      (bare, quoted or schema-qualified);
  (d) every site (and the two update handlers that can move a row) has at
      least one route test decorated `@covers(...)` in
      tests/test_write_provenance.py, so a label can't stand in for a test.

S2a-1 extends PROVENANCE_MODELS and EXPECTED_SITES with its own tables.
"""

import ast
import re
from collections.abc import Iterator
from pathlib import Path

import pytest

from tests.test_write_provenance import COVERED

BACKEND = Path(__file__).resolve().parents[1]
SCAN_ROOTS = (BACKEND / "app", BACKEND / "scripts")

# model class -> table name
PROVENANCE_MODELS = {
    "LootLogEntry": "loot_log_entries",
    "MaterialLogEntry": "material_log_entries",
    "PageLedgerEntry": "page_ledger_entries",
    "RewardDropLog": "reward_drop_log",
}
TIER_MODELS = {"LootLogEntry", "MaterialLogEntry", "PageLedgerEntry"}

CHANNEL_KEYWORDS = {"logged_via", "api_key_id"}
TIER_KEYWORDS = {
    "recipient_user_id",
    "recipient_character_registration_id",
    "recipient_character_name",
    "recipient_character_source",
}

# (module relative to backend/, enclosing function) of every constructor call.
EXPECTED_SITES = {
    ("app/routers/loot_tracking.py", "create_loot_log_entry"),
    ("app/routers/loot_tracking.py", "create_page_ledger_entry"),
    ("app/routers/loot_tracking.py", "mark_floor_cleared"),
    ("app/routers/loot_tracking.py", "create_material_log_entry"),
    ("app/routers/collection_goals.py", "log_drop"),
}

# Handlers that build no row but can move one to another card (R-PV-7). PV-2 also
# registers them in COVERED, so (d) accepts them next to the constructor sites.
MOVE_HANDLERS = {"update_loot_log_entry", "update_material_log_entry"}

# Session writes that bypass the constructor, besides every `bulk_*` method.
OTHER_WRITE_CALLS = {"merge", "make_transient"}

# A schema or table name, bare or quoted ("x", `x`, [x]).
_SQL_IDENT = r"""(?:"\w+"|`\w+`|\[\w+\]|\w+)"""
RAW_INSERT = re.compile(
    r"\binsert\s+(?:or\s+\w+\s+)?into\s+"
    r"(?:" + _SQL_IDENT + r"\s*\.\s*)?"  # optional schema, e.g. public.
    r"""["`\[]?(?:""" + "|".join(PROVENANCE_MODELS.values()) + r")\b",
    re.IGNORECASE,
)


def _modules() -> Iterator[tuple[str, ast.Module]]:
    for root in SCAN_ROOTS:
        for path in sorted(root.rglob("*.py")):
            if "__pycache__" in path.parts:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            yield path.relative_to(BACKEND).as_posix(), tree


def _alias_map(tree: ast.Module) -> dict[str, str]:
    """Local name -> model name, from `from x import Model as Y` and `Y = Model`."""
    aliases = {name: name for name in PROVENANCE_MODELS}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in PROVENANCE_MODELS:
                    aliases[alias.asname or alias.name] = alias.name
    # One pass in source order is enough for `Y = Model` / `Z = Y` chains.
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target, value = node.targets[0], node.value
            model = _model_of(value, aliases)
            if isinstance(target, ast.Name) and model:
                aliases[target.id] = model
    return aliases


def _model_of(node: ast.AST, aliases: dict[str, str]) -> str | None:
    """The model a callee or reference names: a resolved Name, or any `x.Model` attribute."""
    if isinstance(node, ast.Name):
        return aliases.get(node.id)
    if isinstance(node, ast.Attribute) and node.attr in PROVENANCE_MODELS:
        return node.attr
    return None


def _table_model(node: ast.AST, aliases: dict[str, str]) -> str | None:
    """`<model>.__table__` -> the model."""
    if isinstance(node, ast.Attribute) and node.attr == "__table__":
        return _model_of(node.value, aliases)
    return None


def _insert_names(tree: ast.Module) -> set[str]:
    """`insert` plus every name it's imported as (`from ... import insert as pg_insert`)."""
    names = {"insert"}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            names.update(a.asname for a in node.names if a.name == "insert" and a.asname)
    return names


def _callee_name(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return None


class _SiteCollector(ast.NodeVisitor):
    """Collects every provenance-model call with its innermost enclosing function."""

    def __init__(self, aliases: dict[str, str]):
        self.aliases = aliases
        self.functions: list[str] = []
        self.sites: list[tuple[str, str, ast.Call]] = []  # (model, function, call)

    def _enter(self, node):
        self.functions.append(node.name)
        self.generic_visit(node)
        self.functions.pop()

    visit_FunctionDef = _enter
    visit_AsyncFunctionDef = _enter

    def visit_Call(self, node: ast.Call):
        model = _model_of(node.func, self.aliases)
        if model:
            self.sites.append((model, self.functions[-1] if self.functions else "<module>", node))
        self.generic_visit(node)


def _constructor_sites() -> list[tuple[str, str, str, ast.Call]]:
    """(module, model, function, call) for every provenance-model constructor call."""
    found = []
    for module, tree in _modules():
        collector = _SiteCollector(_alias_map(tree))
        collector.visit(tree)
        found.extend((module, model, fn, call) for model, fn, call in collector.sites)
    return found


def _names(call: ast.Call) -> tuple[set[str], bool]:
    return {kw.arg for kw in call.keywords if kw.arg}, any(kw.arg is None for kw in call.keywords)


def test_a_constructor_sites_equal_the_expected_set():
    sites = {(module, fn) for module, _model, fn, _call in _constructor_sites()}
    assert sites == EXPECTED_SITES, (
        f"new creation sites: {sorted(sites - EXPECTED_SITES)}; "
        f"vanished sites: {sorted(EXPECTED_SITES - sites)}"
    )


def test_b_every_constructor_passes_provenance_keywords_explicitly():
    problems = []
    for module, model, fn, call in _constructor_sites():
        where = f"{module}:{call.lineno} {fn} ({model})"
        passed, has_double_star = _names(call)
        if has_double_star:
            problems.append(f"{where}: uses ** expansion")
        required = CHANNEL_KEYWORDS | (TIER_KEYWORDS if model in TIER_MODELS else set())
        for missing in sorted(required - passed):
            problems.append(f"{where}: missing {missing}=")
        for kw in call.keywords:
            if (
                kw.arg == "logged_via"
                and isinstance(kw.value, ast.Constant)
                and kw.value.value is None
            ):
                problems.append(f"{where}: logged_via is the constant None")
    assert not problems, "\n".join(problems)


def _write_problems(module: str, tree: ast.Module) -> list[str]:
    """Every write in `tree` that bypasses the provenance-model constructor."""
    problems = []
    aliases = _alias_map(tree)
    insert_names = _insert_names(tree)
    touches_model = any(
        _model_of(node, aliases) is not None
        for node in ast.walk(tree)
        if isinstance(node, (ast.Name, ast.Attribute))
    ) or any(
        alias.name in PROVENANCE_MODELS
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    )
    for node in ast.walk(tree):
        where = f"{module}:{getattr(node, 'lineno', '?')}"
        if isinstance(node, ast.Call):
            name = _callee_name(node) or ""
            if name in insert_names:
                # `insert(<model>)`, `insert(<model>.__table__)` or `<model>.__table__.insert()`
                args = list(node.args)
                if isinstance(node.func, ast.Attribute):
                    args.append(node.func.value)
                for arg in args:
                    if _model_of(arg, aliases) or _table_model(arg, aliases):
                        problems.append(f"{where}: {name}() on a provenance model")
            if (name.startswith("bulk_") or name in OTHER_WRITE_CALLS) and touches_model:
                problems.append(f"{where}: {name}() in a module that uses a provenance model")
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            # f-string literal parts are Constant nodes inside JoinedStr, so they land here too.
            if RAW_INSERT.search(node.value):
                problems.append(f"{where}: raw INSERT INTO a provenance table")
    return problems


def test_c_no_bulk_or_raw_write_touches_a_provenance_table():
    problems = [p for module, tree in _modules() for p in _write_problems(module, tree)]
    assert not problems, "\n".join(problems)


# One snippet per write form (c) must refuse, so a weakened check fails here.
WRITE_FORMS = {
    "insert(model)": "insert(LootLogEntry).values(id=1)",
    "insert(model.__table__)": "insert(MaterialLogEntry.__table__)",
    "model.__table__.insert()": "PageLedgerEntry.__table__.insert()",
    "aliased insert": (
        "from sqlalchemy.dialects.postgresql import insert as pg_insert\npg_insert(RewardDropLog)"
    ),
    "bulk_insert_mappings": "db.bulk_insert_mappings(LootLogEntry, rows)",
    "bulk_update_mappings": "db.bulk_update_mappings(LootLogEntry, rows)",
    "merge": "from app.models import LootLogEntry\ndb.merge(entry)",
    "raw INSERT": 'text("INSERT INTO loot_log_entries (id) VALUES (1)")',
    "quoted raw INSERT": "text('INSERT INTO \"page_ledger_entries\" (id) VALUES (1)')",
    "schema-qualified raw INSERT": 'text("insert into public.material_log_entries values (1)")',
    "quoted schema-qualified raw INSERT": (
        'text(\'INSERT INTO "public"."reward_drop_log" (id) VALUES (1)\')'
    ),
}

# Writes to other tables, which (c) must let through.
OTHER_TABLE_WRITES = {
    "insert(other model)": "insert(OtherModel)",
    "bulk_* with no provenance model": "db.bulk_update_mappings(OtherModel, rows)",
    "a table name that only starts like one": (
        'text("INSERT INTO loot_log_entries_archive (id) VALUES (1)")'
    ),
    "schema-qualified other table": 'text("INSERT INTO public.other_table (id) VALUES (1)")',
}


@pytest.mark.parametrize("source", list(WRITE_FORMS.values()), ids=list(WRITE_FORMS))
def test_c_refuses_every_write_form(source):
    assert _write_problems("snippet.py", ast.parse(source))


@pytest.mark.parametrize("source", list(OTHER_TABLE_WRITES.values()), ids=list(OTHER_TABLE_WRITES))
def test_c_lets_other_tables_through(source):
    assert not _write_problems("snippet.py", ast.parse(source))


def test_d_every_site_has_a_covering_route_test():
    handlers = {fn for _module, fn in EXPECTED_SITES} | MOVE_HANDLERS
    assert set(COVERED) == handlers, (
        f"no @covers test for {sorted(handlers - set(COVERED))}; "
        f"@covers for an unknown handler {sorted(set(COVERED) - handlers)}"
    )
    empty = [handler for handler, tests in COVERED.items() if not tests]
    assert not empty, f"handlers with an empty test list: {empty}"
