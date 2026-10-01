"""Give collection records a character; writer, channel and change times on records and rows

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-10-01

S2a-1a (design/redesign/plans/2026-10-01-s2a-1-character-records.md, R-S1-2,
R-S1-3, R-S1-4). Every new column is nullable, with no server default:

  player_collection_snapshots  character_id (FK player_characters, CASCADE),
                               updated_by_user_id (FK users, SET NULL),
                               updated_via, state_changed_at, token_count_updated_at
  reward_participant_states    updated_by_user_id (FK users, SET NULL),
                               updated_via, state_changed_at, token_count_updated_at
  reward_drop_log              recipient_character_id (FK player_characters,
                               SET NULL, indexed), recipient_character_name,
                               recipient_character_source,
                               recipient_record_prior_state,
                               recipient_record_prior_at,
                               recipient_record_prior_changed_at

Uniqueness: the snapshot's (profile, item) constraint gives way to two partial
unique indexes, uq_pcs_character_item (WHERE character_id IS NOT NULL) and
uq_pcs_profile_item_no_character (WHERE character_id IS NULL), each declared
for both dialects. Without postgresql_where the profile-level index is plain
unique on (profile, item) on Postgres and every alt's row collides with the
main's. The constraint is dropped in batch mode, and only when the table still
has it: a create_all database built from the new model never did.

Guards, per m6n7o8p9q0r1: add-column and add-index are idempotent, because dev
SQLite picks the columns up from the models (_add_missing_columns). The
backfills are not guarded. They run on every upgrade, after the guards, and
touch only rows still unset, so a dev database whose columns already exist is
backfilled too and a second run changes nothing:

  - snapshot rows take their profile's main character (is_main desc,
    created_at asc, id asc); a profile with no character keeps profile-level
    rows, and so does an item the main already holds a row of;
  - snapshot state_changed_at = the latest of last_synced_at, updated_at,
    unless ownership_state is 'unknown'; token_count_updated_at = the same
    when token_count is set;
  - participant state_changed_at = the latest of updated_at, last_synced_at,
    last_manual_override_at; token_count_updated_at = the same when
    token_count is set.

"Latest" compares parsed values (offsets are mixed, Z and +00:00) and stores
the original string. A row with no parseable time stays NULL, never "now",
which would beat every real write in the merge. The backfills are module-level
functions of a sync Connection that import nothing from app, so tests can run
them on their own.

Downgrade (lossy): keeps one snapshot row per (profile, item), the main's,
else the newest updated_at, deletes the rest, restores the constraint in batch
mode, and drops each index before its column (SQLite refuses an indexed one).

Dev databases must run `alembic upgrade head` after this revision: the column
sync adds the columns but keeps the old constraint and makes no partial index.
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "n7o8p9q0r1s2"
down_revision = "m6n7o8p9q0r1"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

SNAPSHOTS = "player_collection_snapshots"
PARTICIPANTS = "reward_participant_states"
DROPS = "reward_drop_log"
TABLES = (SNAPSHOTS, PARTICIPANTS, DROPS)

OLD_CONSTRAINT = "uq_player_collection_snapshot_profile_item"
PARTIAL_INDEXES = ("uq_pcs_character_item", "uq_pcs_profile_item_no_character")
DROP_CHARACTER_INDEX = "ix_reward_drop_log_recipient_character_id"

_EARLIEST = datetime.min.replace(tzinfo=timezone.utc)


def _fk(table: str, column: str, target: str, ondelete: str) -> sa.ForeignKey:
    return sa.ForeignKey(target, ondelete=ondelete, name=f"fk_{table}_{column}")


def _columns(table: str) -> list[sa.Column]:
    """This revision's columns for `table`, in a fixed order."""
    if table == DROPS:
        return [
            sa.Column(
                "recipient_character_id",
                sa.String(36),
                _fk(table, "recipient_character_id", "player_characters.id", "SET NULL"),
                nullable=True,
            ),
            sa.Column("recipient_character_name", sa.String(100), nullable=True),
            sa.Column("recipient_character_source", sa.String(10), nullable=True),
            sa.Column("recipient_record_prior_state", sa.String(10), nullable=True),
            sa.Column("recipient_record_prior_at", sa.Text(), nullable=True),
            sa.Column("recipient_record_prior_changed_at", sa.Text(), nullable=True),
        ]
    cols: list[sa.Column] = []
    if table == SNAPSHOTS:
        cols.append(
            sa.Column(
                "character_id",
                sa.String(36),
                _fk(table, "character_id", "player_characters.id", "CASCADE"),
                nullable=True,
            )
        )
    cols += [
        sa.Column(
            "updated_by_user_id",
            sa.String(36),
            _fk(table, "updated_by_user_id", "users.id", "SET NULL"),
            nullable=True,
        ),
        sa.Column("updated_via", sa.String(10), nullable=True),
        sa.Column("state_changed_at", sa.Text(), nullable=True),
        sa.Column("token_count_updated_at", sa.Text(), nullable=True),
    ]
    return cols


def _column_names(bind, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(bind).get_columns(table)}


def _index_names(bind, table: str) -> set[str]:
    return {i["name"] for i in sa.inspect(bind).get_indexes(table)}


def _unique_constraint_names(bind, table: str) -> set[str]:
    return {u["name"] for u in sa.inspect(bind).get_unique_constraints(table)}


# ── Frozen rules (copies, so this revision never changes with app code) ──────


def _parse_ts(value: str | None) -> datetime | None:
    """ISO-8601 text → aware datetime (UTC when naive); None when missing or unparseable.

    Frozen copy of app/routers/collection_goals.py:_parse_ts at this revision.
    """
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _latest(*values: str | None) -> str | None:
    """The value with the latest parsed time, as stored; the first listed wins a tie."""
    best_value, best_at = None, None
    for value in values:
        at = _parse_ts(value)
        if at is not None and (best_at is None or at > best_at):
            best_value, best_at = value, at
    return best_value


def _main_character_ids(conn) -> dict[str, str]:
    """Each profile's main character: is_main desc, created_at asc, id asc (R-S1-5)."""
    best: dict[str, tuple] = {}
    rows = conn.execute(
        sa.text("SELECT id, profile_id, is_main, created_at FROM player_characters")
    )
    for character_id, profile_id, is_main, created_at in rows:
        key = (not is_main, created_at or "", character_id)
        if profile_id not in best or key < best[profile_id]:
            best[profile_id] = key
    return {profile_id: key[2] for profile_id, key in best.items()}


def _set_where_unset(conn, table: str, column: str, values: list[dict]) -> int:
    if values:
        conn.execute(
            sa.text(f"UPDATE {table} SET {column} = :at WHERE id = :id AND {column} IS NULL"),
            values,
        )
    return len(values)


# ── Backfills: unconditional and idempotent (vet I-5) ────────────────────────


def _backfill_snapshot_characters(conn) -> int:
    """Profile-level snapshot rows → the profile's main. Returns the rows given one.

    An item the main already holds a row of keeps its profile-level row rather
    than collide with uq_pcs_character_item.
    """
    given = 0
    for profile_id, character_id in _main_character_ids(conn).items():
        result = conn.execute(
            sa.text(
                "UPDATE player_collection_snapshots SET character_id = :character_id"
                " WHERE profile_id = :profile_id AND character_id IS NULL"
                " AND NOT EXISTS (SELECT 1 FROM player_collection_snapshots AS taken"
                " WHERE taken.character_id = :character_id"
                " AND taken.catalog_item_id = player_collection_snapshots.catalog_item_id)"
            ),
            {"profile_id": profile_id, "character_id": character_id},
        )
        given += result.rowcount
    return given


def _backfill_snapshot_timestamps(conn) -> tuple[int, int]:
    """Returns (state_changed_at set, token_count_updated_at set)."""
    rows = conn.execute(
        sa.text(
            "SELECT id, ownership_state, token_count, last_synced_at, updated_at,"
            " state_changed_at, token_count_updated_at FROM player_collection_snapshots"
            " WHERE (state_changed_at IS NULL AND ownership_state <> 'unknown')"
            " OR (token_count_updated_at IS NULL AND token_count IS NOT NULL)"
        )
    ).all()
    states: list[dict] = []
    counts: list[dict] = []
    for row in rows:
        latest = _latest(row.last_synced_at, row.updated_at)
        if latest is None:
            continue
        if row.state_changed_at is None and row.ownership_state != "unknown":
            states.append({"id": row.id, "at": latest})
        if row.token_count_updated_at is None and row.token_count is not None:
            counts.append({"id": row.id, "at": latest})
    return (
        _set_where_unset(conn, SNAPSHOTS, "state_changed_at", states),
        _set_where_unset(conn, SNAPSHOTS, "token_count_updated_at", counts),
    )


def _backfill_participant_timestamps(conn) -> tuple[int, int]:
    """Returns (state_changed_at set, token_count_updated_at set)."""
    rows = conn.execute(
        sa.text(
            "SELECT id, token_count, updated_at, last_synced_at, last_manual_override_at,"
            " state_changed_at, token_count_updated_at FROM reward_participant_states"
            " WHERE state_changed_at IS NULL"
            " OR (token_count_updated_at IS NULL AND token_count IS NOT NULL)"
        )
    ).all()
    states: list[dict] = []
    counts: list[dict] = []
    for row in rows:
        latest = _latest(row.updated_at, row.last_synced_at, row.last_manual_override_at)
        if latest is None:
            continue
        if row.state_changed_at is None:
            states.append({"id": row.id, "at": latest})
        if row.token_count_updated_at is None and row.token_count is not None:
            counts.append({"id": row.id, "at": latest})
    return (
        _set_where_unset(conn, PARTICIPANTS, "state_changed_at", states),
        _set_where_unset(conn, PARTICIPANTS, "token_count_updated_at", counts),
    )


def _dedupe_snapshots_for_downgrade(conn) -> int:
    """Keep one snapshot row per (profile, item): the main's, else the newest
    updated_at (parsed; id breaks a tie). Deletes the rest; returns how many."""
    mains = _main_character_ids(conn)
    groups: dict[tuple[str, str], list] = defaultdict(list)
    rows = conn.execute(
        sa.text(
            "SELECT id, profile_id, catalog_item_id, character_id, updated_at"
            " FROM player_collection_snapshots"
        )
    )
    for row in rows:
        groups[(row.profile_id, row.catalog_item_id)].append(row)

    doomed: list[dict] = []
    for (profile_id, _item_id), group in groups.items():
        if len(group) < 2:
            continue
        main_id = mains.get(profile_id)
        keeper = next((r for r in group if main_id and r.character_id == main_id), None)
        if keeper is None:
            keeper = max(group, key=lambda r: (_parse_ts(r.updated_at) or _EARLIEST, r.id))
        doomed += [{"id": r.id} for r in group if r.id != keeper.id]
    if doomed:
        conn.execute(sa.text("DELETE FROM player_collection_snapshots WHERE id = :id"), doomed)
    return len(doomed)


# ── Upgrade / downgrade ──────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()
    for table in TABLES:
        existing = _column_names(bind, table)
        drop_old = table == SNAPSHOTS and OLD_CONSTRAINT in _unique_constraint_names(bind, table)
        # batch_alter_table so SQLite can add FK columns and drop the constraint
        # (a table rebuild there); on Postgres it is a straight ALTER TABLE.
        with op.batch_alter_table(table) as batch_op:
            for column in _columns(table):
                if column.name not in existing:
                    batch_op.add_column(column)
            if drop_old:
                batch_op.drop_constraint(OLD_CONSTRAINT, type_="unique")

    snapshot_indexes = _index_names(bind, SNAPSHOTS)
    if "uq_pcs_character_item" not in snapshot_indexes:
        op.create_index(
            "uq_pcs_character_item",
            SNAPSHOTS,
            ["character_id", "catalog_item_id"],
            unique=True,
            postgresql_where=sa.text("character_id IS NOT NULL"),
            sqlite_where=sa.text("character_id IS NOT NULL"),
        )
    if "uq_pcs_profile_item_no_character" not in snapshot_indexes:
        op.create_index(
            "uq_pcs_profile_item_no_character",
            SNAPSHOTS,
            ["profile_id", "catalog_item_id"],
            unique=True,
            postgresql_where=sa.text("character_id IS NULL"),
            sqlite_where=sa.text("character_id IS NULL"),
        )
    if DROP_CHARACTER_INDEX not in _index_names(bind, DROPS):
        op.create_index(DROP_CHARACTER_INDEX, DROPS, ["recipient_character_id"])

    # Unconditional (vet I-5): after the guards, never inside them.
    given = _backfill_snapshot_characters(bind)
    profile_level = bind.execute(
        sa.text(f"SELECT count(*) FROM {SNAPSHOTS} WHERE character_id IS NULL")
    ).scalar_one()
    snapshot_states, snapshot_counts = _backfill_snapshot_timestamps(bind)
    participant_states, participant_counts = _backfill_participant_timestamps(bind)
    log.info(
        "%s: snapshots given a character %d, left profile-level %d;"
        " state_changed_at/token_count_updated_at set on snapshots %d/%d,"
        " on participant rows %d/%d",
        revision, given, profile_level, snapshot_states, snapshot_counts,
        participant_states, participant_counts,
    )


def downgrade() -> None:
    bind = op.get_bind()
    snapshot_indexes = _index_names(bind, SNAPSHOTS)
    for name in PARTIAL_INDEXES:
        if name in snapshot_indexes:
            op.drop_index(name, table_name=SNAPSHOTS)
    if DROP_CHARACTER_INDEX in _index_names(bind, DROPS):
        op.drop_index(DROP_CHARACTER_INDEX, table_name=DROPS)

    deleted = 0
    if "character_id" in _column_names(bind, SNAPSHOTS):
        deleted = _dedupe_snapshots_for_downgrade(bind)
    log.info("%s: downgrade dedupe deleted %d snapshot rows", revision, deleted)

    for table in reversed(TABLES):
        existing = _column_names(bind, table)
        restore = table == SNAPSHOTS and OLD_CONSTRAINT not in _unique_constraint_names(
            bind, table
        )
        with op.batch_alter_table(table) as batch_op:
            for column in reversed(_columns(table)):
                if column.name in existing:
                    batch_op.drop_column(column.name)
            if restore:
                batch_op.create_unique_constraint(
                    OLD_CONSTRAINT, ["profile_id", "catalog_item_id"]
                )
