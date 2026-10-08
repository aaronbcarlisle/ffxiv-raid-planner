"""PROV-1 PV-3: completeness guard for write provenance (vet M-5, vet I-4).

Parses `backend/app` and `backend/scripts` with `ast` and fails when a row of a
provenance table can be written without recording how it was logged:

  (a) the (module, function) sites that construct a provenance model equal
      EXPECTED_SITES, so a new creation path fails here until it is wired,
      listed and given a route test;
  (b) every construction passes `logged_via=` and `api_key_id=` as explicit
      keywords (and, on the three tier models, the recipient fields), never
      through `**`, and `logged_via` is never the constant None;
  (c) nothing writes these tables through `insert()` or `update()` (under any
      import name), `delete()` of the record's model, a `bulk_*` method, `merge`,
      `make_transient` or an `INSERT INTO` string (bare, quoted or schema-qualified);
  (d) every site (and the two update handlers that can move a row) has at
      least one route test decorated `@covers(...)` in
      tests/test_write_provenance.py, so a label can't stand in for a test.

S2a-1 (R-S1-15) extends it to the collection record, `PlayerCollectionSnapshot`:
the record's writers are the one door (`write_record`), the in-place writes
(e) and the stamps (f) stay inside the door, every caller of the door (g)
names its writer and channel and has a route test in
tests/test_record_provenance.py (`RECORD_COVERED`, vet I-2). PR 4 adds
`RewardParticipantState` (the farm row, written through `write_row`) and the
drop's keywords, widens the tracked attributes by the row's `state`,
`token_count` and `priority_rank`, and registers the callers of the record's
lifecycle functions (adopt, release, delete) under (d).
"""

import ast
import re
from collections.abc import Iterator
from pathlib import Path

import pytest

from tests.test_record_provenance import RECORD_COVERED
from tests.test_write_provenance import COVERED

BACKEND = Path(__file__).resolve().parents[1]
SCAN_ROOTS = (BACKEND / "app", BACKEND / "scripts")

# model class -> table name
PROVENANCE_MODELS = {
    "LootLogEntry": "loot_log_entries",
    "MaterialLogEntry": "material_log_entries",
    "PageLedgerEntry": "page_ledger_entries",
    "RewardDropLog": "reward_drop_log",
    "PlayerCollectionSnapshot": "player_collection_snapshots",
    "RewardParticipantState": "reward_participant_states",
}
TIER_MODELS = {"LootLogEntry", "MaterialLogEntry", "PageLedgerEntry"}
RECORD_MODELS = {"PlayerCollectionSnapshot"}
ROW_MODELS = {"RewardParticipantState"}
# Models whose channel column is `updated_via` (the others carry `logged_via`).
STAMPED_MODELS = RECORD_MODELS | ROW_MODELS

CHANNEL_KEYWORDS = {"logged_via", "api_key_id"}
TIER_KEYWORDS = {
    "recipient_user_id",
    "recipient_character_registration_id",
    "recipient_character_name",
    "recipient_character_source",
}
RECORD_KEYWORDS = {
    "updated_by_user_id",
    "updated_via",
    "state_changed_at",
    "token_count_updated_at",
    "character_id",
}
# The farm row carries the record's stamps, without a character.
ROW_KEYWORDS = RECORD_KEYWORDS - {"character_id"}
# The drop's character and the record it raised (B11, vet M-10).
DROP_KEYWORDS = {
    "recipient_character_id",
    "recipient_character_name",
    "recipient_character_source",
    "recipient_record_prior_state",
    "recipient_record_prior_at",
    "recipient_record_prior_changed_at",
}


def _required_keywords(model: str) -> set[str]:
    if model in RECORD_MODELS:
        return RECORD_KEYWORDS
    if model in ROW_MODELS:
        return ROW_KEYWORDS
    keywords = CHANNEL_KEYWORDS | (TIER_KEYWORDS if model in TIER_MODELS else set())
    return keywords | (DROP_KEYWORDS if model == "RewardDropLog" else set())


# model -> the keywords every constructor call passes explicitly (b).
REQUIRED_KEYWORDS = {model: _required_keywords(model) for model in PROVENANCE_MODELS}
# model -> the keyword that carries the channel, never the constant None.
VIA_KEYWORD = {
    model: "updated_via" if model in STAMPED_MODELS else "logged_via" for model in PROVENANCE_MODELS
}

DOOR_MODULE = "app/services/collection_records.py"

# (module relative to backend/, enclosing function) of every constructor call.
EXPECTED_SITES = {
    ("app/routers/loot_tracking.py", "create_loot_log_entry"),
    ("app/routers/loot_tracking.py", "create_page_ledger_entry"),
    ("app/routers/loot_tracking.py", "mark_floor_cleared"),
    ("app/routers/loot_tracking.py", "create_material_log_entry"),
    ("app/routers/collection_goals.py", "log_drop"),
    (DOOR_MODULE, "write_record"),
    (DOOR_MODULE, "write_row"),
}

# (e) The record's attributes and the farm row's fact columns. Every write of
# `state`, `token_count` and `priority_rank` is routed through `write_row` (C1-D2).
TRACKED = {
    "ownership_state",
    "character_id",
    "updated_by_user_id",
    "updated_via",
    "state_changed_at",
    "token_count_updated_at",
    "state",
    "token_count",
    "priority_rank",
}
# Every function of DOOR_MODULE that assigns a TRACKED attribute, and no other.
# `write_row` is the farm row's door (R-S1-7): its stamp columns share the
# record's names, so it is the one row writer the door module holds.
DOOR_FUNCTIONS = {
    "write_record",
    "_find_or_adopt_record",
    "adopt_profile_rows",
    "release_last_character_rows",
    "write_row",
}
# (f) Door writes of these also stamp the writer and the channel.
FACT_ATTRS = {"state", "token_count", "ownership_state", "priority_rank"}
# Non-constant `setattr` is refused everywhere but here (vet M-8). Each entry
# copies request fields onto a row of a table this guard does not track.
DYNAMIC_SETATTR_OK = {
    ("app/routers/collection_goals.py", "update_collection_goal"): "CollectionGoal fields",
    ("app/routers/schedule.py", "update_schedule_session"): "ScheduleSession fields",
    ("app/routers/schedule.py", "update_schedule_settings"): "ScheduleSettings fields",
    ("app/routers/split_clear.py", "upsert_split_clear_assignment"): "SplitClear fields",
}

# (g) Entry points of the door: each call names its writer and channel.
DOOR_ENTRY_POINTS = {"write_record"}
# The only callers that may pass `actor_user_id=None` (R-S1-8).
DERIVED_CALLERS = {("app/routers/collection_goals.py", "create_goal_from_suggestion")}
# The (module, function) pairs that call a door entry point.
EXPECTED_DOOR_CALLERS = {
    ("app/routers/player_collection.py", "upsert_snapshot"),
    ("app/services/player_reward_bridge_service.py", "_write_own_records"),
    ("app/services/plugin_collection_sync_service.py", "_write_sync_record"),
    ("app/routers/collection_goals.py", "_write_own_state"),
    ("app/routers/collection_goals.py", "log_drop"),
    ("app/routers/collection_goals.py", "delete_drop"),
}
# (d) Door caller -> the route handlers whose @covers_record tests exercise it. The
# record tests are labelled by route, because a route test is what reads the stored
# writer and channel; one caller can sit behind several routes.
DOOR_CALLER_ROUTES = {
    ("app/routers/player_collection.py", "upsert_snapshot"): {"upsert_snapshot"},
    ("app/services/player_reward_bridge_service.py", "_write_own_records"): {
        "update_mount_farm_progress",
        "bulk_update_mount_farm_progress",
    },
    ("app/services/plugin_collection_sync_service.py", "_write_sync_record"): {
        "plugin_sync_collections"
    },
    ("app/routers/collection_goals.py", "_write_own_state"): {
        "upsert_participant_state",
        "upsert_participant_state_for_user",
    },
    ("app/routers/collection_goals.py", "log_drop"): {"log_drop"},
    ("app/routers/collection_goals.py", "delete_drop"): {"delete_drop"},
}

# (d) The callers of the record's lifecycle functions (adopt, release, delete), each
# with the test in tests/test_collections_center.py that drives it through its route.
# A caller that releases a character's rows also deletes its records explicitly.
LIFECYCLE_FUNCTIONS = {
    "adopt_profile_rows",
    "release_last_character_rows",
    "delete_character_records",
}
LIFECYCLE_CALLERS = {
    ("app/routers/player.py", "link_character"): (
        {"adopt_profile_rows"},
        "test_link_character_adopts_the_profile_level_rows",
    ),
    ("app/routers/player.py", "_get_or_provision_plugin_character"): (
        {"adopt_profile_rows"},
        "test_plugin_provisioning_adopts_the_profile_level_rows",
    ),
    ("app/routers/player.py", "unlink_character"): (
        {"release_last_character_rows", "delete_character_records"},
        "test_unlinking_an_alt_deletes_its_rows_and_keeps_the_mains",
    ),
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
RAW_UPDATE = re.compile(
    r"\bupdate\s+(?:or\s+\w+\s+)?"
    r"(?:" + _SQL_IDENT + r"\s*\.\s*)?"
    r"""["`\[]?(?:""" + "|".join(PROVENANCE_MODELS.values()) + r")\b",
    re.IGNORECASE,
)
# Deleting is refused for the record's table only: the row's and the logs' own delete
# routes remove rows by `db.delete(row)` or by a cascade.
RAW_DELETE = re.compile(
    r"\bdelete\s+from\s+"
    r"(?:" + _SQL_IDENT + r"\s*\.\s*)?"
    r"""["`\[]?(?:""" + "|".join(PROVENANCE_MODELS[m] for m in sorted(RECORD_MODELS)) + r")\b",
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


def _verb_names(tree: ast.Module, verb: str) -> set[str]:
    """`verb` plus every name it's imported as (`from ... import insert as pg_insert`)."""
    names = {verb}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            names.update(a.asname for a in node.names if a.name == verb and a.asname)
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


def _keyword_problems(module: str, model: str, fn: str, call: ast.Call) -> list[str]:
    """What is wrong with one constructor call's provenance keywords (b)."""
    where = f"{module}:{call.lineno} {fn} ({model})"
    passed, has_double_star = _names(call)
    problems = [f"{where}: uses ** expansion"] if has_double_star else []
    problems += [f"{where}: missing {kw}=" for kw in sorted(REQUIRED_KEYWORDS[model] - passed)]
    for kw in call.keywords:
        if kw.arg == VIA_KEYWORD[model] and isinstance(kw.value, ast.Constant):
            if kw.value.value is None:
                problems.append(f"{where}: {kw.arg} is the constant None")
    return problems


def test_b_every_constructor_passes_provenance_keywords_explicitly():
    problems = [
        problem
        for module, model, fn, call in _constructor_sites()
        for problem in _keyword_problems(module, model, fn, call)
    ]
    assert not problems, "\n".join(problems)


def _write_problems(module: str, tree: ast.Module) -> list[str]:
    """Every write in `tree` that bypasses the provenance-model constructor."""
    problems = []
    aliases = _alias_map(tree)
    verb_names = {
        name: verb for verb in ("insert", "update", "delete") for name in _verb_names(tree, verb)
    }
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
            if name in verb_names:
                # `insert(<model>)`, `insert(<model>.__table__)`, `<model>.__table__.insert()`,
                # and the same three with `update`, and with `delete` for the record's model
                # (the tier logs have delete routes of their own; the record's rows go through
                # the door's `db.delete(row)`, which names a row and not a model)
                args = list(node.args)
                if isinstance(node.func, ast.Attribute):
                    args.append(node.func.value)
                for arg in args:
                    model = _model_of(arg, aliases) or _table_model(arg, aliases)
                    if model and (verb_names[name] != "delete" or model in RECORD_MODELS):
                        problems.append(f"{where}: {name}() on a provenance model")
            if (name.startswith("bulk_") or name in OTHER_WRITE_CALLS) and touches_model:
                problems.append(f"{where}: {name}() in a module that uses a provenance model")
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            # f-string literal parts are Constant nodes inside JoinedStr, so they land here too.
            if RAW_INSERT.search(node.value):
                problems.append(f"{where}: raw INSERT INTO a provenance table")
            if RAW_UPDATE.search(node.value):
                problems.append(f"{where}: raw UPDATE of a provenance table")
            if RAW_DELETE.search(node.value):
                problems.append(f"{where}: raw DELETE FROM the collection record's table")
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
    "update(model)": "update(PlayerCollectionSnapshot).values(token_count=1)",
    "aliased update": (
        "from sqlalchemy import update as sa_update\nsa_update(PlayerCollectionSnapshot)"
    ),
    "attribute update": "sa.update(PlayerCollectionSnapshot)",
    "model.__table__.update()": "PlayerCollectionSnapshot.__table__.update()",
    "quoted raw UPDATE": (
        "text('UPDATE \"player_collection_snapshots\" SET ownership_state = \\'have\\'')"
    ),
    "lowercase raw UPDATE": 'text("update player_collection_snapshots set token_count = 1")',
    "schema-qualified raw UPDATE": (
        'text(\'UPDATE "public"."player_collection_snapshots" SET token_count = 1\')'
    ),
    "update of a log table": "update(LootLogEntry)",
    "delete(record model)": "delete(PlayerCollectionSnapshot).where(x)",
    "aliased delete": (
        "from sqlalchemy import delete as sa_delete\nsa_delete(PlayerCollectionSnapshot)"
    ),
    "attribute delete": "sa.delete(PlayerCollectionSnapshot)",
    "delete(record model.__table__)": "delete(PlayerCollectionSnapshot.__table__)",
    "model.__table__.delete()": "PlayerCollectionSnapshot.__table__.delete()",
    "update(row model)": "update(RewardParticipantState).values(state='have')",
    "row model.__table__.update()": "RewardParticipantState.__table__.update()",
    "raw UPDATE of the row table": 'text("UPDATE reward_participant_states SET state = \'have\'")',
    "raw INSERT into the row table": (
        'text("INSERT INTO reward_participant_states (id) VALUES (1)")'
    ),
    "raw DELETE FROM the record table": 'text("DELETE FROM player_collection_snapshots")',
    "lowercase schema-qualified raw DELETE": (
        'text("delete from public.player_collection_snapshots where x = 1")'
    ),
    "quoted raw DELETE": 'text(\'DELETE FROM "player_collection_snapshots" WHERE x = 1\')',
}

# Writes to other tables, which (c) must let through.
OTHER_TABLE_WRITES = {
    "insert(other model)": "insert(OtherModel)",
    "bulk_* with no provenance model": "db.bulk_update_mappings(OtherModel, rows)",
    "a table name that only starts like one": (
        'text("INSERT INTO loot_log_entries_archive (id) VALUES (1)")'
    ),
    "schema-qualified other table": 'text("INSERT INTO public.other_table (id) VALUES (1)")',
    "update(other model)": "update(OtherModel)",
    "delete(other model)": "delete(OtherModel)",
    "delete of a log table": "delete(LootLogEntry).where(x)",
    "delete of a log table's __table__": "PageLedgerEntry.__table__.delete()",
    "session delete of a row": "await db.delete(row)",
    "dict.update": "cache.update({'a': 1})",
    "raw UPDATE of another table": 'text("UPDATE other_table SET x = 1")',
    "an UPDATE of a table that only starts like one": (
        'text("UPDATE player_collection_snapshots_archive SET x = 1")'
    ),
    "prose that says update": 'text("update the player_collection_snapshots later")',
    "raw DELETE FROM another table": 'text("DELETE FROM other_table")',
    "raw DELETE FROM a table that only starts like the record's": (
        'text("DELETE FROM player_collection_snapshots_archive")'
    ),
    "raw DELETE FROM a farm-row table": 'text("DELETE FROM reward_participant_states WHERE x = 1")',
    "delete(row model)": "delete(RewardParticipantState).where(x)",
}


@pytest.mark.parametrize("source", list(WRITE_FORMS.values()), ids=list(WRITE_FORMS))
def test_c_refuses_every_write_form(source):
    assert _write_problems("snippet.py", ast.parse(source))


@pytest.mark.parametrize("source", list(OTHER_TABLE_WRITES.values()), ids=list(OTHER_TABLE_WRITES))
def test_c_lets_other_tables_through(source):
    assert not _write_problems("snippet.py", ast.parse(source))


# ---------------------------------------------------------------------------
# (b) the record's keywords
# ---------------------------------------------------------------------------

_RECORD_KEYWORDS_PASSED = (
    "updated_by_user_id=a, updated_via=v, state_changed_at=s, token_count_updated_at=t, "
    "character_id=c"
)


def _record_call(keywords: str) -> list[str]:
    call = ast.parse(f"PlayerCollectionSnapshot(id=1, {keywords})").body[0].value
    return _keyword_problems("snippet.py", "PlayerCollectionSnapshot", "fn", call)


def test_b_refuses_a_record_constructor_without_its_stamps():
    assert any("missing updated_via=" in p for p in _record_call("character_id=c"))
    assert any("missing character_id=" in p for p in _record_call("updated_via=v"))


def test_b_refuses_a_record_updated_via_of_none():
    problems = _record_call(_RECORD_KEYWORDS_PASSED.replace("updated_via=v", "updated_via=None"))
    assert any("updated_via is the constant None" in p for p in problems)


def test_b_lets_a_complete_record_constructor_through():
    assert not _record_call(_RECORD_KEYWORDS_PASSED)


def _model_call(model: str, keywords: str) -> list[str]:
    call = ast.parse(f"{model}(id=1, {keywords})").body[0].value
    return _keyword_problems("snippet.py", model, "fn", call)


_ROW_KEYWORDS_PASSED = (
    "updated_by_user_id=a, updated_via=v, state_changed_at=s, token_count_updated_at=t"
)
_DROP_KEYWORDS_PASSED = (
    "logged_via=v, api_key_id=k, recipient_character_id=c, recipient_character_name=n, "
    "recipient_character_source=s, recipient_record_prior_state=p, "
    "recipient_record_prior_at=pa, recipient_record_prior_changed_at=pc"
)


def test_b_asks_the_row_for_the_stamps_but_not_a_character():
    assert not _model_call("RewardParticipantState", _ROW_KEYWORDS_PASSED)
    problems = _model_call("RewardParticipantState", "state='want'")
    assert any("missing updated_by_user_id=" in p for p in problems)
    assert any("missing updated_via=" in p for p in problems)
    assert not any("character_id" in p for p in problems)


def test_b_refuses_a_row_updated_via_of_none():
    problems = _model_call(
        "RewardParticipantState", _ROW_KEYWORDS_PASSED.replace("updated_via=v", "updated_via=None")
    )
    assert any("updated_via is the constant None" in p for p in problems)


def test_b_lets_a_complete_drop_constructor_through():
    assert not _model_call("RewardDropLog", _DROP_KEYWORDS_PASSED)


@pytest.mark.parametrize("keyword", sorted(DROP_KEYWORDS))
def test_b_refuses_a_drop_constructor_without_a_drop_keyword(keyword):
    passed = _DROP_KEYWORDS_PASSED.split(", ")
    kept = ", ".join(p for p in passed if not p.startswith(f"{keyword}="))
    assert any(f"missing {keyword}=" in p for p in _model_call("RewardDropLog", kept))


def test_b_does_not_ask_the_tier_logs_for_the_drops_keywords():
    passed = (
        "logged_via=v, api_key_id=k, recipient_user_id=u, recipient_character_registration_id=r, "
        "recipient_character_name=n, recipient_character_source=s"
    )
    assert not _model_call("LootLogEntry", passed)


# ---------------------------------------------------------------------------
# (e) one door for in-place writes
# ---------------------------------------------------------------------------


def _nodes_with_function(tree: ast.AST) -> Iterator[tuple[str, ast.AST]]:
    """(innermost enclosing function, node) for every node under `tree`."""

    def walk(node: ast.AST, fn: str) -> Iterator[tuple[str, ast.AST]]:
        yield fn, node
        for child in ast.iter_child_nodes(node):
            inner = child.name if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) else fn
            yield from walk(child, inner)

    yield from walk(tree, "<module>")


def _target_attributes(target: ast.AST) -> Iterator[tuple[str, str]]:
    """(base expression, attribute) for each attribute a target assigns, tuples included."""
    if isinstance(target, ast.Attribute):
        yield ast.unparse(target.value), target.attr
    elif isinstance(target, (ast.Tuple, ast.List)):
        for element in target.elts:
            yield from _target_attributes(element)
    elif isinstance(target, ast.Starred):
        yield from _target_attributes(target.value)


def _attribute_writes(tree: ast.AST) -> list[tuple[str, int, str, str]]:
    """(function, line, base, attribute) of every attribute assignment and constant `setattr`.

    Assignment targets are an `=`, an augmented or annotated assignment, a `for` (or
    `async for`, or comprehension) target, a `with ... as` target, and a `del` (which
    removes a column's value as surely as an assignment changes it), as is a constant
    `delattr`.
    """
    writes = []
    for fn, node in _nodes_with_function(tree):
        targets: list[ast.AST] = []
        if isinstance(node, ast.Assign):
            targets = list(node.targets)
        elif isinstance(node, ast.Delete):
            targets = list(node.targets)
        elif isinstance(node, (ast.AugAssign, ast.For, ast.AsyncFor, ast.comprehension)):
            targets = [node.target]
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            targets = [node.target]
        elif isinstance(node, (ast.With, ast.AsyncWith)):
            targets = [item.optional_vars for item in node.items if item.optional_vars]
        for target in targets:
            for base, attr in _target_attributes(target):
                writes.append((fn, getattr(node, "lineno", target.lineno), base, attr))
        if (
            isinstance(node, ast.Call)
            and _callee_name(node) in ("setattr", "delattr")
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and isinstance(node.args[1].value, str)
        ):
            writes.append((fn, node.lineno, ast.unparse(node.args[0]), node.args[1].value))
    return writes


def _in_place_sites(tree: ast.Module) -> set[str]:
    """The functions that write a TRACKED attribute in `tree`."""
    return {fn for fn, _line, _base, attr in _attribute_writes(tree) if attr in TRACKED}


def _in_place_problems(module: str, tree: ast.Module) -> list[str]:
    """Every in-place write (e) refuses in `tree`, which is `module`."""
    problems = []
    for fn, line, _base, attr in _attribute_writes(tree):
        if attr in TRACKED and not (module == DOOR_MODULE and fn in DOOR_FUNCTIONS):
            problems.append(f"{module}:{line} {fn}: writes .{attr} outside the record door")
    for fn, node in _nodes_with_function(tree):
        if not isinstance(node, ast.Call):
            continue
        where = f"{module}:{node.lineno} {fn}"
        name = _callee_name(node)
        if name == "set_attribute":
            problems.append(f"{where}: set_attribute() writes an attribute out of sight")
        elif name in ("setattr", "delattr") and len(node.args) >= 2:
            key = node.args[1]
            if not (isinstance(key, ast.Constant) and isinstance(key.value, str)):
                if (module, fn) not in DYNAMIC_SETATTR_OK:
                    problems.append(f"{where}: setattr() with a name that is not a constant")
    return problems


def _stamp_problems(module: str, tree: ast.Module, door_functions: set[str]) -> list[str]:
    """(f): a door function that writes a fact attribute also stamps the writer and channel."""
    facts: dict[str, dict[str, int]] = {}
    stamps: dict[str, set[tuple[str, str]]] = {}
    for fn, line, base, attr in _attribute_writes(tree):
        if fn not in door_functions:
            continue
        if attr in FACT_ATTRS:
            facts.setdefault(fn, {}).setdefault(base, line)
        if attr in ("updated_by_user_id", "updated_via"):
            stamps.setdefault(fn, set()).add((base, attr))
    problems = []
    for fn, bases in facts.items():
        for base, line in bases.items():
            for stamp in ("updated_by_user_id", "updated_via"):
                if (base, stamp) not in stamps.get(fn, set()):
                    problems.append(
                        f"{module}:{line} {fn}: writes a fact on {base} without {base}.{stamp}"
                    )
    return problems


def _door_calls(tree: ast.Module) -> list[tuple[str, ast.Call]]:
    """(enclosing function, call) of every call of a door entry point."""
    return [
        (fn, node)
        for fn, node in _nodes_with_function(tree)
        if isinstance(node, ast.Call) and _callee_name(node) in DOOR_ENTRY_POINTS
    ]


def _caller_problems(module: str, tree: ast.Module) -> list[str]:
    """(g): every door call names its writer and channel, never through `**`."""
    problems = []
    for fn, call in _door_calls(tree):
        where = f"{module}:{call.lineno} {fn} ({_callee_name(call)})"
        passed, has_double_star = _names(call)
        if has_double_star:
            problems.append(f"{where}: uses ** expansion")
        for missing in sorted({"actor_user_id", "via"} - passed):
            problems.append(f"{where}: missing {missing}=")
        for kw in call.keywords:
            if (
                kw.arg == "actor_user_id"
                and isinstance(kw.value, ast.Constant)
                and kw.value.value is None
                and (module, fn) not in DERIVED_CALLERS
            ):
                problems.append(f"{where}: actor_user_id is None outside the derived callers")
    # A constant `via=` is refused on any call, not only at the door: a helper between a
    # route and the door can pin the channel just as well (the door never sees it).
    for fn, node in _nodes_with_function(tree):
        if not isinstance(node, ast.Call):
            continue
        for kw in node.keywords:
            if kw.arg == "via" and isinstance(kw.value, ast.Constant):
                where = f"{module}:{node.lineno} {fn} ({_callee_name(node)})"
                problems.append(f"{where}: via is the constant {kw.value.value!r}")
    return problems


def test_e_tracked_writes_stay_in_the_door():
    problems = [p for module, tree in _modules() for p in _in_place_problems(module, tree)]
    assert not problems, "\n".join(problems)


def test_e_the_door_functions_are_exactly_the_in_place_writers():
    door_tree = dict(_modules())[DOOR_MODULE]
    assert _in_place_sites(door_tree) == DOOR_FUNCTIONS


def _fn(body: str) -> str:
    return "def some_function(row, a, b, name, v, now):\n    " + body + "\n"


# One snippet per in-place form (e) must refuse (vet M-8).
IN_PLACE_FORMS = {
    "attribute assign": _fn('row.ownership_state = "have"'),
    "tuple target": _fn('a.ownership_state, b = "have", 1'),
    "nested tuple target": _fn('(a.character_id, (b, row.updated_via)) = (1, (2, "web"))'),
    "list target": _fn("[row.character_id, b] = [1, 2]"),
    "starred target": _fn("b, *row.updated_by_user_id = 1, 2"),
    "AnnAssign": _fn("row.state_changed_at: str = now"),
    "AugAssign": _fn('row.updated_via += "x"'),
    "chained assign": _fn('a.token_count_updated_at = row.token_count_updated_at = now'),
    "for target": _fn("for row.ownership_state in v:\n        pass"),
    "for tuple target": _fn("for a.character_id, b in v:\n        pass"),
    "async for target": _fn("async for row.updated_via in v:\n        pass"),
    "comprehension target": _fn("return [1 for row.character_id in v]"),
    "with target": _fn("with v as row.updated_by_user_id:\n        pass"),
    "with tuple target": _fn("with v as (row.state_changed_at, b):\n        pass"),
    "async with target": _fn("async with v as row.token_count_updated_at:\n        pass"),
    "module level": 'row.ownership_state = "have"\n',
    "constant setattr": _fn('setattr(row, "ownership_state", v)'),
    "dynamic setattr in an unlisted function": _fn("setattr(row, name, v)"),
    "set_attribute": _fn('set_attribute(row, "state", v)'),
    "qualified set_attribute": _fn('attributes.set_attribute(row, "state", v)'),
    # The farm row's fact columns are tracked too (vet I-2).
    "row state assign": _fn('row.state = "have"'),
    "row state tuple target": _fn('row.state, b = "have", 1'),
    "row state nested tuple target": _fn('(a, (row.state, b)) = (1, ("have", 2))'),
    "row state constant setattr": _fn('setattr(row, "state", v)'),
    "row state AugAssign": _fn('row.state += "x"'),
    "row token_count assign": _fn("snapshot.token_count = 1"),
    "row token_count AnnAssign": _fn("snapshot.token_count: int = 1"),
    "row priority_rank assign": _fn("row.priority_rank = None"),
    "row priority_rank tuple target": _fn("a.priority_rank, row.token_count = 1, 2"),
    "del of a tracked attribute": _fn("del row.ownership_state"),
    "del of a farm-row attribute": _fn("del row.token_count"),
    "del in a tuple": _fn("del row.state, b.priority_rank"),
    "constant delattr": _fn('delattr(row, "state_changed_at")'),
    "dynamic delattr in an unlisted function": _fn("delattr(row, name)"),
}
# What (e) must let through.
IN_PLACE_OK = {
    "request.state": _fn('request.state.auth_credential = "x"'),
    "an untracked attribute": _fn('row.title = "x"'),
    "an untracked constant setattr": _fn('setattr(row, "title", v)'),
    "a local named like an attribute": _fn("ownership_state = 1"),
    "a read": _fn("return row.ownership_state"),
    "a for target of an untracked attribute": _fn("for row.title in v:\n        pass"),
    "a with target that is a plain name": _fn("with v as ownership_state:\n        pass"),
    "a constructor keyword": _fn("return Row(ownership_state=v)"),
    "a constructor keyword of a farm-row name": _fn("return Row(state=v, token_count=1)"),
    "a read of a farm-row name": _fn("return row.state, row.token_count, row.priority_rank"),
    "a del of an untracked attribute": _fn("del row.title"),
    "a del of a plain name": _fn("del state"),
    "a del of a subscript": _fn("del row[0]"),
    "an untracked constant delattr": _fn('delattr(row, "title")'),
}


@pytest.mark.parametrize("source", list(IN_PLACE_FORMS.values()), ids=list(IN_PLACE_FORMS))
def test_e_refuses_every_in_place_form(source):
    assert _in_place_problems("app/routers/elsewhere.py", ast.parse(source))


@pytest.mark.parametrize("source", list(IN_PLACE_OK.values()), ids=list(IN_PLACE_OK))
def test_e_lets_unrelated_assignments_through(source):
    assert not _in_place_problems("app/routers/elsewhere.py", ast.parse(source))


def test_e_refuses_a_tracked_write_in_another_module_with_a_door_function_name():
    source = _fn('row.ownership_state = "have"').replace("some_function", "write_record")
    assert _in_place_problems("app/routers/elsewhere.py", ast.parse(source))


def test_e_lets_a_door_function_write_in_the_door_module():
    source = _fn('row.ownership_state = "have"').replace("some_function", "write_record")
    assert not _in_place_problems(DOOR_MODULE, ast.parse(source))


def test_e_lets_a_listed_dynamic_setattr_through_only_in_its_function():
    source = _fn("setattr(row, name, v)").replace("some_function", "update_collection_goal")
    assert not _in_place_problems("app/routers/collection_goals.py", ast.parse(source))
    assert _in_place_problems("app/routers/schedule.py", ast.parse(source))


# ---------------------------------------------------------------------------
# (f) the door stamps
# ---------------------------------------------------------------------------

_STAMPS = "    row.updated_by_user_id = actor\n    row.updated_via = via\n"


def _door_fn(body: str) -> ast.Module:
    return ast.parse("def write_it(row, other, actor, via):\n" + body)


def test_f_refuses_a_fact_write_with_no_stamp():
    tree = _door_fn('    row.ownership_state = "have"\n')
    assert _stamp_problems(DOOR_MODULE, tree, {"write_it"})


@pytest.mark.parametrize(
    "stamps",
    [
        "    row.updated_by_user_id = actor\n",
        "    row.updated_via = via\n",
        "    other.updated_by_user_id = actor\n    other.updated_via = via\n",
    ],
    ids=["writer only", "channel only", "stamps on another name"],
)
def test_f_refuses_a_fact_write_with_a_partial_stamp(stamps):
    tree = _door_fn('    row.ownership_state = "have"\n' + stamps)
    assert _stamp_problems(DOOR_MODULE, tree, {"write_it"})


@pytest.mark.parametrize("fact", sorted(FACT_ATTRS))
def test_f_lets_a_stamped_fact_write_through(fact):
    tree = _door_fn(f"    row.{fact} = 1\n" + _STAMPS)
    assert not _stamp_problems(DOOR_MODULE, tree, {"write_it"})


def test_f_does_not_ask_adoption_for_a_stamp():
    tree = _door_fn("    row.character_id = 1\n")
    assert not _stamp_problems(DOOR_MODULE, tree, {"write_it"})


def test_f_every_door_function_that_writes_a_fact_stamps_it():
    tree = dict(_modules())[DOOR_MODULE]
    problems = _stamp_problems(DOOR_MODULE, tree, DOOR_FUNCTIONS)
    assert not problems, "\n".join(problems)


# ---------------------------------------------------------------------------
# (g) door callers
# ---------------------------------------------------------------------------


def _call(args: str, *, fn: str = "some_caller") -> ast.Module:
    header = f"def {fn}(db, t, user, request, via):\n"
    return ast.parse(header + f"    write_record(db, t, 'i', {args})\n")


_GOOD_ARGS = "actor_user_id=user.id, via=logged_via(request), mode='person'"

# One snippet per call (g) must refuse (vet M-8).
CALLER_FORMS = {
    "via=None": "actor_user_id=user.id, via=None",
    'via="web"': 'actor_user_id=user.id, via="web"',
    "via of any constant": "actor_user_id=user.id, via=1",
    "actor_user_id=None outside the derived callers": "actor_user_id=None, via=via",
    "** expansion": "**kwargs",
    "** beside the keywords": "actor_user_id=user.id, via=via, **kwargs",
    "missing via=": "actor_user_id=user.id",
    "missing actor_user_id=": "via=via",
    "neither": "mode='person'",
    "positional only": "user.id, via",
}
CALLER_OK = {
    "the channel from logged_via": _GOOD_ARGS,
    "a channel passed down as a parameter": "actor_user_id=user.id, via=via",
    "the actor from an expression": "actor_user_id=request.user_id, via=via",
}


@pytest.mark.parametrize("args", list(CALLER_FORMS.values()), ids=list(CALLER_FORMS))
def test_g_refuses_every_bad_caller(args):
    assert _caller_problems("app/routers/elsewhere.py", _call(args))


@pytest.mark.parametrize("args", list(CALLER_OK.values()), ids=list(CALLER_OK))
def test_g_lets_a_wired_caller_through(args):
    assert not _caller_problems("app/routers/elsewhere.py", _call(args))


@pytest.mark.parametrize(
    "call",
    [
        'write_through(db, user_id=u, via="web")',
        "helper(db, via=None)",
        "self.record(via=1)",
        "outer(inner(via='api_key'))",
    ],
    ids=["str", "None", "method", "nested"],
)
def test_g_refuses_a_constant_via_on_any_call(call):
    tree = ast.parse(f"def some_helper(db, u, self):\n    {call}\n")
    assert any("via is the constant" in p for p in _caller_problems("app/services/x.py", tree))


def test_g_lets_a_via_passed_down_through_any_call():
    tree = ast.parse("def some_helper(db, u, via):\n    helper(db, via=via, other='web')\n")
    assert not _caller_problems("app/services/x.py", tree)


def test_g_refuses_a_method_style_call():
    tree = ast.parse("def some_caller(door):\n    door.write_record(1, 2, 3)\n")
    assert _caller_problems("app/routers/elsewhere.py", tree)


def test_g_lets_a_derived_caller_pass_no_actor():
    module, fn = sorted(DERIVED_CALLERS)[0]
    tree = _call("actor_user_id=None, via=via", fn=fn)
    assert not _caller_problems(module, tree)
    assert _caller_problems(module, _call("actor_user_id=None, via=None", fn=fn))
    assert _caller_problems("app/routers/elsewhere.py", tree)


def test_g_the_callers_of_the_door_are_the_expected_set():
    callers = {
        (module, fn) for module, tree in _modules() for fn, _call_node in _door_calls(tree)
    }
    assert callers == EXPECTED_DOOR_CALLERS, (
        f"new door callers: {sorted(callers - EXPECTED_DOOR_CALLERS)}; "
        f"vanished: {sorted(EXPECTED_DOOR_CALLERS - callers)}"
    )


def test_g_every_door_call_names_its_writer_and_channel():
    problems = [p for module, tree in _modules() for p in _caller_problems(module, tree)]
    assert not problems, "\n".join(problems)


# ---------------------------------------------------------------------------
# (d) every handler has a route test
# ---------------------------------------------------------------------------


def test_d_every_site_has_a_covering_route_test():
    handlers = (
        {fn for module, fn in EXPECTED_SITES if module != DOOR_MODULE}
        | MOVE_HANDLERS
        | {route for routes in DOOR_CALLER_ROUTES.values() for route in routes}
    )
    covered = set(COVERED) | set(RECORD_COVERED)
    assert covered == handlers, (
        f"no @covers test for {sorted(handlers - covered)}; "
        f"@covers for an unknown handler {sorted(covered - handlers)}"
    )
    empty = [h for h, tests in (COVERED | RECORD_COVERED).items() if not tests]
    assert not empty, f"handlers with an empty test list: {empty}"


def test_d_the_route_map_names_exactly_the_door_callers():
    assert set(DOOR_CALLER_ROUTES) == EXPECTED_DOOR_CALLERS
    assert all(DOOR_CALLER_ROUTES.values()), "a door caller with no route"


# ---------------------------------------------------------------------------
# (d) the record's lifecycle callers
# ---------------------------------------------------------------------------


def _lifecycle_calls(tree: ast.Module) -> dict[str, set[str]]:
    """function -> the lifecycle functions it calls, by plain or method-style name."""
    found: dict[str, set[str]] = {}
    for fn, node in _nodes_with_function(tree):
        name = _callee_name(node) if isinstance(node, ast.Call) else None
        if name in LIFECYCLE_FUNCTIONS:
            found.setdefault(fn, set()).add(name)
    return found


def _lifecycle_problems(callers: dict[tuple[str, str], set[str]]) -> list[str]:
    """A function that releases a character's rows also deletes its records explicitly."""
    return [
        f"{module} {fn}: releases rows without delete_character_records"
        for (module, fn), called in sorted(callers.items())
        if "release_last_character_rows" in called and "delete_character_records" not in called
    ]


def _keyed(module: str, source: str) -> dict[tuple[str, str], set[str]]:
    return {(module, fn): called for fn, called in _lifecycle_calls(ast.parse(source)).items()}


def test_d_the_lifecycle_callers_are_the_expected_set():
    found = {
        (module, fn): called
        for module, tree in _modules()
        if module != DOOR_MODULE
        for fn, called in _lifecycle_calls(tree).items()
    }
    expected = {key: called for key, (called, _test) in LIFECYCLE_CALLERS.items()}
    assert found == expected, (
        f"new lifecycle callers: {sorted(set(found) - set(expected))}; "
        f"vanished: {sorted(set(expected) - set(found))}; "
        f"changed calls: {sorted(k for k in set(found) & set(expected) if found[k] != expected[k])}"
    )
    assert not _lifecycle_problems(found)


def test_d_each_lifecycle_caller_has_its_route_test():
    path = BACKEND / "tests" / "test_collections_center.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    defined = {n.name for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef)}
    missing = sorted(t for _called, t in LIFECYCLE_CALLERS.values() if t not in defined)
    assert not missing, f"no route test in tests/test_collections_center.py: {missing}"


def test_d_refuses_a_release_without_the_explicit_delete():
    source = "async def new_unlink(db):\n    await release_last_character_rows(db)\n"
    assert _lifecycle_problems(_keyed("app/routers/x.py", source))


def test_d_lets_a_release_with_its_delete_through():
    source = (
        "async def unlink(db):\n"
        "    await release_last_character_rows(db)\n"
        "    await delete_character_records(db)\n"
    )
    assert not _lifecycle_problems(_keyed("app/routers/x.py", source))


def test_d_sees_a_lifecycle_call_as_a_method():
    source = "def new_path(svc):\n    svc.adopt_profile_rows(1)\n"
    assert _keyed("app/routers/x.py", source) == {
        ("app/routers/x.py", "new_path"): {"adopt_profile_rows"}
    }
