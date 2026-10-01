"""S2a-1a·1 Task A1 — character records: schema, partial indexes, migration backfills.

Plan: design/redesign/plans/2026-10-01-s2a-1-character-records.md, R-S1-2 (columns),
R-S1-3 (two partial unique indexes replace the snapshot's (profile, item) constraint),
R-S1-4 (the n7o8p9q0r1s2 migration's backfills and downgrade dedupe).

The uniqueness tests run on SQLite built by create_all from the model. Postgres is
covered without a server: the model's indexes compile with their WHERE clause for the
postgresql dialect, and an AST walk of the migration checks that both create_index
calls carry unique=True, postgresql_where= and sqlite_where= (vet I-4). The backfills
are module-level functions of the migration, loaded with importlib and run through
conn.run_sync on rows seeded in the pre-migration shape (character_id NULL).
"""

import ast
import importlib.util
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import String, Text, inspect, text
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateIndex

from app.database import Base
from app.models.player_character import PlayerCharacter
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.reward_participant_state import RewardParticipantState
from tests.factories import (
    create_catalog_item,
    create_collection_goal,
    create_player_profile,
    create_static_group,
    create_user,
)

# asyncio_mode = "auto" (pyproject) runs the async tests; no module-wide mark,
# which would also tag the sync ones.

_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "alembic"
    / "versions"
    / "n7o8p9q0r1s2_add_character_records.py"
)

_CHARACTER_INDEX = "uq_pcs_character_item"
_PROFILE_INDEX = "uq_pcs_profile_item_no_character"
_OLD_CONSTRAINT = "uq_player_collection_snapshot_profile_item"
_T0 = "2026-01-01T00:00:00+00:00"


def _load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("s2a1_character_records_migration", _MIGRATION)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def migration() -> ModuleType:
    return _load_migration()


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _character(
    session: AsyncSession,
    character_id: str,
    profile_id: str,
    *,
    is_main: bool,
    created_at: str = _T0,
) -> PlayerCharacter:
    character = PlayerCharacter(
        id=character_id,
        profile_id=profile_id,
        name=character_id,
        server="Tonberry",
        is_main=is_main,
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(character)
    await session.flush()
    return character


async def _snapshot(
    session: AsyncSession,
    snapshot_id: str,
    profile_id: str,
    item_id: str,
    *,
    character_id: str | None = None,
    ownership_state: str = "have",
    token_count: int | None = None,
    last_synced_at: str | None = None,
    updated_at: str = _T0,
    state_changed_at: str | None = None,
    token_count_updated_at: str | None = None,
) -> None:
    session.add(
        PlayerCollectionSnapshot(
            id=snapshot_id,
            profile_id=profile_id,
            catalog_item_id=item_id,
            character_id=character_id,
            ownership_state=ownership_state,
            token_count=token_count,
            source="manual",
            confidence="low",
            last_synced_at=last_synced_at,
            updated_at=updated_at,
            state_changed_at=state_changed_at,
            token_count_updated_at=token_count_updated_at,
        )
    )
    await session.flush()


async def _run(engine: AsyncEngine, fn):
    async with engine.begin() as conn:
        return await conn.run_sync(fn)


async def _rows(engine: AsyncEngine, sql: str) -> dict[str, tuple]:
    """`sql` selects id first; returns {id: the rest of the row}."""
    async with engine.connect() as conn:
        return {row[0]: tuple(row[1:]) for row in (await conn.execute(text(sql))).all()}


async def _profile(session: AsyncSession, name: str):
    user = await create_user(session, discord_username=name)
    return await create_player_profile(session, user)


# ── Mappers and columns (R-S1-2) ─────────────────────────────────────────────


def test_mappers_configure():
    # A second FK to users on the participant and drop tables must not make an
    # existing relationship ambiguous (PROV-1's I-1 lesson).
    configure_mappers()


# table, column, type, length, FK target, ondelete, indexed
_NEW_COLUMNS = [
    ("player_collection_snapshots", "character_id", String, 36,
     "player_characters.id", "CASCADE", False),
    ("player_collection_snapshots", "updated_by_user_id", String, 36,
     "users.id", "SET NULL", False),
    ("player_collection_snapshots", "updated_via", String, 10, None, None, False),
    ("player_collection_snapshots", "state_changed_at", Text, None, None, None, False),
    ("player_collection_snapshots", "token_count_updated_at", Text, None, None, None, False),
    ("reward_participant_states", "updated_by_user_id", String, 36,
     "users.id", "SET NULL", False),
    ("reward_participant_states", "updated_via", String, 10, None, None, False),
    ("reward_participant_states", "state_changed_at", Text, None, None, None, False),
    ("reward_participant_states", "token_count_updated_at", Text, None, None, None, False),
    ("reward_drop_log", "recipient_character_id", String, 36,
     "player_characters.id", "SET NULL", True),
    ("reward_drop_log", "recipient_character_name", String, 100, None, None, False),
    ("reward_drop_log", "recipient_character_source", String, 10, None, None, False),
    ("reward_drop_log", "recipient_record_prior_state", String, 10, None, None, False),
    ("reward_drop_log", "recipient_record_prior_at", Text, None, None, None, False),
    ("reward_drop_log", "recipient_record_prior_changed_at", Text, None, None, None, False),
]


@pytest.mark.parametrize(
    "table, column, type_, length, fk_target, ondelete, indexed", _NEW_COLUMNS
)
def test_new_column_matches_r_s1_2(table, column, type_, length, fk_target, ondelete, indexed):
    col = Base.metadata.tables[table].c[column]
    assert type(col.type) is type_
    if length is not None:
        assert col.type.length == length
    assert col.nullable is True
    assert col.server_default is None
    fks = list(col.foreign_keys)
    if fk_target is None:
        assert fks == []
    else:
        assert [(fk.target_fullname, fk.ondelete) for fk in fks] == [(fk_target, ondelete)]
    assert bool(col.index) is indexed


async def test_drop_log_has_record_prior_changed_at(engine):
    # vet M-10: the record's state_changed_at before the drop raised it.
    async with engine.connect() as conn:
        columns, indexes = await conn.run_sync(
            lambda sync: (
                {c["name"] for c in inspect(sync).get_columns("reward_drop_log")},
                {i["name"] for i in inspect(sync).get_indexes("reward_drop_log")},
            )
        )
    assert "recipient_record_prior_changed_at" in columns
    assert "ix_reward_drop_log_recipient_character_id" in indexes


def test_snapshot_old_profile_item_constraint_is_gone():
    table = PlayerCollectionSnapshot.__table__
    assert _OLD_CONSTRAINT not in {c.name for c in table.constraints}
    by_name = {i.name: i for i in table.indexes}
    character, profile = by_name[_CHARACTER_INDEX], by_name[_PROFILE_INDEX]
    assert [c.name for c in character.columns] == ["character_id", "catalog_item_id"]
    assert [c.name for c in profile.columns] == ["profile_id", "catalog_item_id"]
    assert character.unique and profile.unique


# ── Uniqueness on the model schema (R-S1-3, SQLite) ──────────────────────────


async def _profile_with_two_characters(session: AsyncSession):
    profile = await _profile(session, "uniq")
    first = await _character(session, "char-1", profile.id, is_main=True)
    second = await _character(session, "char-2", profile.id, is_main=False)
    item = await create_catalog_item(session)
    return profile, first, second, item


async def test_two_profile_level_rows_of_one_item_conflict(session):
    profile, _, _, item = await _profile_with_two_characters(session)
    await _snapshot(session, "s1", profile.id, item.id)
    with pytest.raises(IntegrityError, match=r"UNIQUE"):
        await _snapshot(session, "s2", profile.id, item.id)


async def test_two_rows_of_one_character_and_item_conflict(session):
    profile, first, _, item = await _profile_with_two_characters(session)
    await _snapshot(session, "s1", profile.id, item.id, character_id=first.id)
    with pytest.raises(IntegrityError, match=r"UNIQUE"):
        await _snapshot(session, "s2", profile.id, item.id, character_id=first.id)


async def test_profile_level_row_and_character_row_of_one_item_both_insert(session):
    profile, first, _, item = await _profile_with_two_characters(session)
    await _snapshot(session, "s1", profile.id, item.id)
    await _snapshot(session, "s2", profile.id, item.id, character_id=first.id)
    rows = await session.execute(
        text("SELECT count(*) FROM player_collection_snapshots WHERE profile_id = :p"),
        {"p": profile.id},
    )
    assert rows.scalar_one() == 2


async def test_two_characters_of_one_profile_same_item_both_insert(session):
    profile, first, second, item = await _profile_with_two_characters(session)
    await _snapshot(session, "s1", profile.id, item.id, character_id=first.id)
    await _snapshot(session, "s2", profile.id, item.id, character_id=second.id)
    rows = await session.execute(
        text("SELECT count(*) FROM player_collection_snapshots WHERE profile_id = :p"),
        {"p": profile.id},
    )
    assert rows.scalar_one() == 2


# ── Postgres without a server (vet I-4) ──────────────────────────────────────


@pytest.mark.parametrize("dialect", [postgresql.dialect(), sqlite.dialect()], ids=["pg", "sqlite"])
@pytest.mark.parametrize(
    "name, predicate",
    [
        (_CHARACTER_INDEX, "WHERE character_id IS NOT NULL"),
        (_PROFILE_INDEX, "WHERE character_id IS NULL"),
    ],
)
def test_partial_index_compiles_with_where(name, predicate, dialect):
    indexes = {i.name: i for i in PlayerCollectionSnapshot.__table__.indexes}
    assert name in indexes
    ddl = str(CreateIndex(indexes[name]).compile(dialect=dialect))
    assert ddl.startswith("CREATE UNIQUE INDEX")
    assert predicate in ddl


def _create_index_calls(tree: ast.AST) -> dict[str, ast.Call]:
    calls: dict[str, ast.Call] = {}
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "create_index"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "op"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ):
            calls[node.args[0].value] = node
    return calls


def _text_arg(node: ast.expr) -> str | None:
    """The literal inside sa.text("...") / text("..."), else None."""
    if (
        isinstance(node, ast.Call)
        and (
            (isinstance(node.func, ast.Attribute) and node.func.attr == "text")
            or (isinstance(node.func, ast.Name) and node.func.id == "text")
        )
        and node.args
        and isinstance(node.args[0], ast.Constant)
    ):
        return node.args[0].value
    return None


@pytest.mark.parametrize(
    "name, predicate",
    [
        (_CHARACTER_INDEX, "character_id IS NOT NULL"),
        (_PROFILE_INDEX, "character_id IS NULL"),
    ],
)
def test_migration_creates_partial_index_for_both_dialects(name, predicate):
    calls = _create_index_calls(ast.parse(_MIGRATION.read_text(encoding="utf-8")))
    assert name in calls, f"no op.create_index({name!r}, ...) in the migration"
    kwargs = {kw.arg: kw.value for kw in calls[name].keywords}
    assert isinstance(kwargs.get("unique"), ast.Constant) and kwargs["unique"].value is True
    assert _text_arg(kwargs.get("postgresql_where")) == predicate
    assert _text_arg(kwargs.get("sqlite_where")) == predicate


# ── Backfills (R-S1-4), run on rows in the pre-migration shape ───────────────


async def _seed_characters(session: AsyncSession) -> dict[str, str]:
    """Profiles A–E and their snapshot rows, all profile-level unless noted."""
    a = await _profile(session, "a")
    b = await _profile(session, "b")
    c = await _profile(session, "c")
    d = await _profile(session, "d")
    e = await _profile(session, "e")
    x = await create_catalog_item(session, name="X")
    y = await create_catalog_item(session, name="Y")
    z = await create_catalog_item(session, name="Z")

    # A: the main is newer than the alt, so is_main must beat created_at.
    await _character(session, "a-alt", a.id, is_main=False, created_at="2026-01-01T00:00:00+00:00")
    await _character(session, "a-main", a.id, is_main=True, created_at="2026-03-01T00:00:00+00:00")
    # B: no is_main → the oldest. The oldest has the higher id and is inserted last,
    # so neither the id tiebreak nor insertion order can pick it by accident.
    await _character(session, "b-a-newer", b.id, is_main=False,
                     created_at="2026-03-01T00:00:00+00:00")
    await _character(session, "b-z-oldest", b.id, is_main=False,
                     created_at="2026-01-01T00:00:00+00:00")
    # C: equal created_at → the lower id, inserted second.
    await _character(session, "c-b", c.id, is_main=False, created_at=_T0)
    await _character(session, "c-a", c.id, is_main=False, created_at=_T0)
    # D: no character at all.
    # E: the main already holds a row of X; the profile-level X must stay put rather
    # than collide with uq_pcs_character_item.
    await _character(session, "e-main", e.id, is_main=True)

    await _snapshot(session, "a-x", a.id, x.id)
    await _snapshot(session, "a-y", a.id, y.id)
    await _snapshot(session, "a-z-alt", a.id, z.id, character_id="a-alt")
    await _snapshot(session, "b-x", b.id, x.id)
    await _snapshot(session, "c-x", c.id, x.id)
    await _snapshot(session, "d-x", d.id, x.id)
    await _snapshot(session, "e-x-main", e.id, x.id, character_id="e-main")
    await _snapshot(session, "e-x", e.id, x.id)
    await session.commit()
    return {"x": x.id, "y": y.id, "z": z.id}


async def test_backfill_snapshot_characters_gives_each_profile_its_main(
    session, engine, migration
):
    await _seed_characters(session)

    changed = await _run(engine, migration._backfill_snapshot_characters)

    rows = await _rows(engine, "SELECT id, character_id FROM player_collection_snapshots")
    assert rows == {
        "a-x": ("a-main",),
        "a-y": ("a-main",),
        "a-z-alt": ("a-alt",),  # already set: kept
        "b-x": ("b-z-oldest",),
        "c-x": ("c-a",),
        "d-x": (None,),  # no character: stays profile-level
        "e-x-main": ("e-main",),
        "e-x": (None,),  # the main already has X
    }
    assert changed == 4


async def _seed_snapshot_timestamps(session: AsyncSession) -> None:
    p = await _profile(session, "ts")
    items = [(await create_catalog_item(session, name=f"I{i}")).id for i in range(7)]
    # Synced last: both columns take last_synced_at's string, Z form kept.
    await _snapshot(session, "synced", p.id, items[0], ownership_state="have", token_count=3,
                    last_synced_at="2026-05-01T10:00:00Z",
                    updated_at="2026-05-01T09:00:00+00:00")
    # Lexically "10:00" > "09:00", but +02:00 makes it 08:00Z: parsed, updated_at wins.
    await _snapshot(session, "offset", p.id, items[1], ownership_state="missing", token_count=1,
                    last_synced_at="2026-05-01T10:00:00+02:00",
                    updated_at="2026-05-01T09:00:00Z")
    # No count, never synced: state from updated_at, count time stays NULL.
    await _snapshot(session, "manual", p.id, items[2], ownership_state="missing",
                    updated_at="2026-04-01T00:00:00+00:00")
    # unknown: state_changed_at stays NULL, the count still gets its time.
    await _snapshot(session, "unknown", p.id, items[3], ownership_state="unknown", token_count=5,
                    last_synced_at="2026-03-01T00:00:00+00:00",
                    updated_at="2026-03-02T00:00:00Z")
    # Already set: state_changed_at kept; the unset count time is filled.
    await _snapshot(session, "preset", p.id, items[4], ownership_state="have", token_count=2,
                    updated_at="2026-06-01T00:00:00+00:00",
                    state_changed_at="2020-01-01T00:00:00+00:00")
    # Neither time parses: both columns stay NULL. The migration never falls back
    # to now, so a row it can't date is left for the first real write.
    await _snapshot(session, "garbled", p.id, items[5], ownership_state="have", token_count=4,
                    last_synced_at="not a time", updated_at="never")
    # Only one time parses: that one is used, and the unparseable one is ignored.
    await _snapshot(session, "half", p.id, items[6], ownership_state="have",
                    last_synced_at="not a time", updated_at="2026-02-01T00:00:00Z")
    await session.commit()


async def test_backfill_snapshot_timestamps(session, engine, migration):
    await _seed_snapshot_timestamps(session)

    counts = await _run(engine, migration._backfill_snapshot_timestamps)

    rows = await _rows(
        engine,
        "SELECT id, state_changed_at, token_count_updated_at FROM player_collection_snapshots",
    )
    assert rows == {
        "synced": ("2026-05-01T10:00:00Z", "2026-05-01T10:00:00Z"),
        "offset": ("2026-05-01T09:00:00Z", "2026-05-01T09:00:00Z"),
        "manual": ("2026-04-01T00:00:00+00:00", None),
        "unknown": (None, "2026-03-02T00:00:00Z"),
        "preset": ("2020-01-01T00:00:00+00:00", "2026-06-01T00:00:00+00:00"),
        "garbled": (None, None),
        "half": ("2026-02-01T00:00:00Z", None),
    }
    assert counts == (4, 4)


async def _seed_participants(session: AsyncSession) -> None:
    owner = await create_user(session, discord_username="owner")
    group = await create_static_group(session, owner)
    goal = await create_collection_goal(session, group, owner)

    async def participant(row_id: str, **fields) -> None:
        user = await create_user(session, discord_username=row_id)
        session.add(
            RewardParticipantState(
                id=row_id,
                goal_id=goal.id,
                user_id=user.id,
                static_group_id=group.id,
                state="need",
                source="manual",
                **fields,
            )
        )
        await session.flush()

    # The manual override is the latest by parsed value; lexically last_synced_at
    # ("13:00+05:00" = 08:00Z) would win. That exact Z string is stored.
    await participant("override", token_count=4,
                      updated_at="2026-06-01T11:00:00+00:00",
                      last_synced_at="2026-06-01T13:00:00+05:00",
                      last_manual_override_at="2026-06-01T12:00:00Z")
    await participant("plain", updated_at="2026-06-02T00:00:00+00:00")
    await participant("preset", token_count=1,
                      updated_at="2026-06-03T00:00:00+00:00",
                      state_changed_at="2020-01-01T00:00:00+00:00")
    await session.commit()


async def test_backfill_participant_timestamps(session, engine, migration):
    await _seed_participants(session)

    counts = await _run(engine, migration._backfill_participant_timestamps)

    rows = await _rows(
        engine,
        "SELECT id, state_changed_at, token_count_updated_at FROM reward_participant_states",
    )
    assert rows == {
        "override": ("2026-06-01T12:00:00Z", "2026-06-01T12:00:00Z"),
        "plain": ("2026-06-02T00:00:00+00:00", None),
        "preset": ("2020-01-01T00:00:00+00:00", "2026-06-03T00:00:00+00:00"),
    }
    assert counts == (2, 2)


async def test_backfills_are_idempotent(session, engine, migration):
    # vet I-5: they run on every upgrade, outside the column guards.
    await _seed_characters(session)
    await _seed_snapshot_timestamps(session)
    await _seed_participants(session)
    await _run(engine, migration._backfill_snapshot_characters)
    await _run(engine, migration._backfill_snapshot_timestamps)
    await _run(engine, migration._backfill_participant_timestamps)
    snapshots_sql = "SELECT * FROM player_collection_snapshots"
    participants_sql = "SELECT * FROM reward_participant_states"
    snapshots = await _rows(engine, snapshots_sql)
    participants = await _rows(engine, participants_sql)

    assert await _run(engine, migration._backfill_snapshot_characters) == 0
    assert await _run(engine, migration._backfill_snapshot_timestamps) == (0, 0)
    assert await _run(engine, migration._backfill_participant_timestamps) == (0, 0)
    assert await _rows(engine, snapshots_sql) == snapshots
    assert await _rows(engine, participants_sql) == participants


# ── Downgrade dedupe (R-S1-4, lossy) ─────────────────────────────────────────


async def test_downgrade_dedupe_keeps_the_mains_row_else_the_newest(session, engine, migration):
    a = await _profile(session, "a")
    b = await _profile(session, "b")
    x = await create_catalog_item(session, name="X")
    y = await create_catalog_item(session, name="Y")
    await _character(session, "a-alt", a.id, is_main=False)
    await _character(session, "a-main", a.id, is_main=True)
    await _character(session, "b-main", b.id, is_main=True)
    await _character(session, "b-alt", b.id, is_main=False)
    # A/X: the main's row is the oldest and still wins.
    await _snapshot(session, "a-x-alt", a.id, x.id, character_id="a-alt",
                    updated_at="2026-05-03T00:00:00+00:00")
    await _snapshot(session, "a-x-main", a.id, x.id, character_id="a-main",
                    updated_at="2026-05-01T00:00:00+00:00")
    await _snapshot(session, "a-x", a.id, x.id, updated_at="2026-05-02T00:00:00+00:00")
    # B/X: no main row; the newest by parsed value (09:00Z beats 10:00+02:00).
    await _snapshot(session, "b-x-alt", b.id, x.id, character_id="b-alt",
                    updated_at="2026-05-01T10:00:00+02:00")
    await _snapshot(session, "b-x", b.id, x.id, updated_at="2026-05-01T09:00:00Z")
    # B/Y: alone, untouched.
    await _snapshot(session, "b-y-alt", b.id, y.id, character_id="b-alt")
    await session.commit()

    deleted = await _run(engine, migration._dedupe_snapshots_for_downgrade)

    rows = await _rows(engine, "SELECT id, profile_id FROM player_collection_snapshots")
    assert set(rows) == {"a-x-main", "b-x", "b-y-alt"}
    assert deleted == 3
