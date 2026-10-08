"""Attribute legacy mount-farm rows to collection records; the hide-counts flag

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-10-08

S2a-1b·2 (design/redesign/plans/2026-10-01-s2a-1-character-records.md, R-S1-18
history part, R-S1-19 column).

Column: player_profiles.hide_collection_counts Boolean NOT NULL, server default
false (sa.false(), the dialect script's convention). The add is guarded, as in
n7o8p9q0r1s2: dev SQLite may already carry the column from the model.

Backfill, unconditional and idempotent (vet I-5): every mount_farm_progress row
is attributed to the member's chain target in that static and its facts land on
that record. The chain is a frozen copy of services/collection_records.py
(resolve_record_targets, _resolve_registration, main_character) at this
revision, in SQL and Python, importing nothing from app (vet M-9):

  - target: the static's active tier (the newest when several), the user's
    claimed card in it (the newest), the card's registrations primary first,
    then oldest, then lowest id; the first that resolves to one of the user's
    own characters wins (a link counts only when it names one of them, a manual
    name and world only when they match exactly one, lower-cased and stripped);
    else the profile's main (is_main desc, created_at asc as text, id asc);
    else the profile-level row; no profile → skipped;
  - a trial maps to catalog items as player_reward_bridge_service does:
    source_duty_key, category 'mount', is_active; no item → skipped;
  - the record a target writes is found as the door finds it: a character's
    own row; a `main` target with none adopts the profile-level row (R-S1-6);
  - ownership is the OR of has_mount over the rows that reach one record: True
    raises it to 'have'; an existing 'have' is kept. False is no news, as the
    sync's unowned is: it never lowers and never creates a 'missing'. Every
    legacy row starts at False with a live updated_at, and a 'missing' stamped
    with it would demote a farm row's Have to Want in the merge;
  - a count is news only when totem_count > 0 (review I-1): the legacy writers
    leave 0 for "no count" (the plugin creates an owned row at 0/'unknown', a
    manual PUT defaults to 0) and last_plugin_sync_at moves on every no-op
    sync, so a dated 0 would beat a real farm-row count in the merge. The
    count is the most recent such row's; an existing count with a later or
    equal time is kept and a NULL time loses, as in the merge. A group with no
    has_mount row and no count writes nothing;
  - timestamps come from the rows, never the migration's clock (vet M-9):
    a row's time is the latest of last_plugin_sync_at, last_manual_override_at,
    last_imported_at and updated_at by parsed value, stored as written;
    state_changed_at is the latest such time over the rows that say has_mount,
    token_count_updated_at the chosen count row's; a row no time of which
    parses leaves them NULL, and a created record's updated_at is then the
    raw updated_at text;
  - the writer and channel are NULL (unknown origin), on a created record and
    on one this revision changes; source and confidence follow the row's own
    source column: 'plugin' → plugin/high (as apply_sync), else
    player_hub/medium (as the bridge). A kept 'have' keeps its own.

Downgrade: drops the column and leaves the backfilled records. They are
records like any other, the chain reads them and nothing marks them as
backfilled, so there is nothing to undo without guessing.
"""

import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "o8p9q0r1s2t3"
down_revision = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

PROFILES = "player_profiles"
FLAG = "hide_collection_counts"
RECORDS = "player_collection_snapshots"

_EARLIEST = datetime.min.replace(tzinfo=timezone.utc)


def _column_names(bind, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(bind).get_columns(table)}


# ── Frozen rules (copies, so this revision never changes with app code) ──────


def _parse_ts(value: str | None) -> datetime | None:
    """ISO-8601 text → aware datetime (UTC when naive); None when missing or unparseable."""
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


def _normalized(value: str | None) -> str:
    return (value or "").lower().strip()


@dataclass(frozen=True)
class _Target:
    """Where a (static, user) pair's rows go: step card | main | profile | none."""

    profile_id: str | None
    character_id: str | None
    step: str


def _resolve_registration(reg, characters) -> object | None:
    """The user's character a registration points at, or None (frozen _resolve_registration)."""
    if reg.player_character_id is not None:
        for character in characters:
            if character.id == reg.player_character_id:
                return character
        return None
    name = _normalized(reg.manual_character_name)
    world = _normalized(reg.manual_world)
    if not name or not world:
        return None
    matches = [
        c for c in characters if _normalized(c.name) == name and _normalized(c.server) == world
    ]
    return matches[0] if len(matches) == 1 else None


def _main(characters):
    """A profile's main: is_main desc, created_at asc (stored text), id asc (frozen)."""
    if not characters:
        return None
    return min(characters, key=lambda c: (not bool(c.is_main), c.created_at or "", c.id))


def _resolve_targets(conn, pairs: set[tuple[str, str]]) -> dict[tuple[str, str], _Target]:
    """Frozen resolve_record_targets over (static_group_id, user_id) pairs.

    Booleans are read with bool(): Postgres hands back bool, SQLite 0/1.
    The tables are read whole and filtered here; they are small.
    """
    if not pairs:
        return {}
    static_ids = {static_id for static_id, _ in pairs}
    user_ids = {user_id for _, user_id in pairs}

    # 1. Active tiers; with several in a static, the newest wins (via the card rank).
    tier_static: dict[str, str] = {}
    tier_rank: dict[str, tuple[str, str]] = {}
    for tier_id, static_id, is_active, created_at in conn.execute(
        sa.text("SELECT id, static_group_id, is_active, created_at FROM tier_snapshots")
    ):
        if static_id in static_ids and bool(is_active):
            tier_static[tier_id] = static_id
            tier_rank[tier_id] = (created_at or "", tier_id)

    # 2. The users' claimed players in those tiers: one card per (static, user).
    cards: dict[tuple[str, str], tuple[tuple, str]] = {}
    if tier_static:
        for player_id, tier_id, user_id, created_at in conn.execute(
            sa.text(
                "SELECT id, tier_snapshot_id, user_id, created_at FROM snapshot_players"
                " WHERE user_id IS NOT NULL"
            )
        ):
            if tier_id not in tier_static:
                continue
            pair = (tier_static[tier_id], user_id)
            if pair not in pairs:
                continue
            rank = (tier_rank[tier_id], created_at or "", player_id)
            if pair not in cards or rank > cards[pair][0]:
                cards[pair] = (rank, player_id)

    # 3. Those cards' registrations, primary first, then oldest, then lowest id.
    regs_by_card: dict[tuple[str, str], list] = defaultdict(list)
    if cards:
        card_pair = {player_id: pair for pair, (_, player_id) in cards.items()}
        for reg in conn.execute(
            sa.text(
                "SELECT id, static_group_id, snapshot_player_id, player_character_id,"
                " manual_character_name, manual_world, is_primary_for_static, created_at"
                " FROM static_character_registrations"
            )
        ):
            pair = card_pair.get(reg.snapshot_player_id)
            if pair is not None and reg.static_group_id == pair[0]:
                regs_by_card[pair].append(reg)
        for regs in regs_by_card.values():
            regs.sort(key=lambda r: (not bool(r.is_primary_for_static), r.created_at or "", r.id))

    # 4 and 5. Profiles and characters.
    profile_by_user: dict[str, str] = {}
    for profile_id, user_id in conn.execute(sa.text("SELECT id, user_id FROM player_profiles")):
        if user_id in user_ids:
            profile_by_user[user_id] = profile_id
    characters_by_profile: dict[str, list] = defaultdict(list)
    wanted_profiles = set(profile_by_user.values())
    for character in conn.execute(
        sa.text("SELECT id, profile_id, name, server, is_main, created_at FROM player_characters")
    ):
        if character.profile_id in wanted_profiles:
            characters_by_profile[character.profile_id].append(character)

    targets: dict[tuple[str, str], _Target] = {}
    for pair in pairs:
        _, user_id = pair
        profile_id = profile_by_user.get(user_id)
        if profile_id is None:
            targets[pair] = _Target(None, None, "none")
            continue
        characters = characters_by_profile.get(profile_id, [])
        for reg in regs_by_card.get(pair, []):
            character = _resolve_registration(reg, characters)
            if character is not None:
                targets[pair] = _Target(profile_id, character.id, "card")
                break
        if pair in targets:
            continue
        main = _main(characters)
        if main is None:
            targets[pair] = _Target(profile_id, None, "profile")
        else:
            targets[pair] = _Target(profile_id, main.id, "main")
    return targets


def _mount_items_by_trial(conn) -> dict[str, list[str]]:
    """source_duty_key → catalog item ids: category 'mount', active (frozen bridge map)."""
    items: dict[str, list[str]] = defaultdict(list)
    for item_id, duty_key, category, is_active in conn.execute(
        sa.text(
            "SELECT id, source_duty_key, category, is_active FROM collection_catalog_items"
            " WHERE source_duty_key IS NOT NULL"
        )
    ):
        if category == "mount" and bool(is_active):
            items[duty_key].append(item_id)
    for ids in items.values():
        ids.sort()
    return items


def _row_time(row) -> str | None:
    """A legacy row's time: the latest of its four stamps, as stored (vet M-9)."""
    return _latest(
        row.last_plugin_sync_at,
        row.last_manual_override_at,
        row.last_imported_at,
        row.updated_at,
    )


def _has_count(row) -> bool:
    """Whether a legacy row carries a count: 0 is the writers' "no count" (review I-1)."""
    return row.totem_count is not None and row.totem_count > 0


def _source_for(legacy_source: str | None) -> tuple[str, str]:
    """(source, confidence) a record takes from a legacy row's own source column."""
    if _normalized(legacy_source) == "plugin":
        return "plugin", "high"
    return "player_hub", "medium"


def _count_wins(record, count_at: str | None) -> bool:
    """Whether the legacy count replaces the record's: a missing count always,
    else only a strictly later time; the record's NULL time loses to a dated one."""
    if record.token_count is None:
        return True
    record_at = _parse_ts(record.token_count_updated_at)
    new_at = _parse_ts(count_at)
    if record_at is None:
        return new_at is not None
    return new_at is not None and new_at > record_at


# ── Backfill: unconditional and idempotent (vet I-5) ─────────────────────────


@dataclass
class MfpBackfill:
    """What the backfill did. `no_news` counts attributed rows that say nothing
    (has_mount False, no count above 0). `turned_have` lists (static_group_id,
    user_id, catalog_item_id) for every legacy has_mount row whose record became
    'have' here: the members whose V1 panels turn Have (vet I-3); the upgrade
    logs its length only."""

    rows: int = 0
    card: int = 0
    main: int = 0
    profile: int = 0
    skipped_no_profile: int = 0
    skipped_no_item: int = 0
    no_news: int = 0
    created: int = 0
    updated: int = 0
    turned_have: list[tuple[str, str, str]] = field(default_factory=list)


_INSERT = sa.text(
    f"INSERT INTO {RECORDS} (id, profile_id, character_id, catalog_item_id, ownership_state,"
    " token_count, source, confidence, last_synced_at, updated_at, updated_by_user_id,"
    " updated_via, state_changed_at, token_count_updated_at)"
    " VALUES (:id, :profile_id, :character_id, :catalog_item_id, :ownership_state,"
    " :token_count, :source, :confidence, NULL, :updated_at, NULL, NULL, :state_changed_at,"
    " :token_count_updated_at)"
)

_UPDATE = sa.text(
    f"UPDATE {RECORDS} SET character_id = :character_id, ownership_state = :ownership_state,"
    " token_count = :token_count, source = :source, confidence = :confidence,"
    " updated_at = :updated_at, updated_by_user_id = NULL, updated_via = NULL,"
    " state_changed_at = :state_changed_at, token_count_updated_at = :token_count_updated_at"
    " WHERE id = :id"
)


def _existing_records(conn, item_ids: set[str]):
    """Records of the items: ({(character_id, item): row}, {(profile_id, item): profile-level})."""
    by_character: dict[tuple[str, str], object] = {}
    by_profile: dict[tuple[str, str], object] = {}
    if not item_ids:
        return by_character, by_profile
    stmt = sa.text(
        "SELECT id, profile_id, character_id, catalog_item_id, ownership_state, token_count,"
        f" source, confidence, updated_at, state_changed_at, token_count_updated_at FROM {RECORDS}"
        " WHERE catalog_item_id IN :item_ids"
    ).bindparams(sa.bindparam("item_ids", expanding=True))
    for record in conn.execute(stmt, {"item_ids": sorted(item_ids)}):
        if record.character_id is not None:
            by_character[(record.character_id, record.catalog_item_id)] = record
        else:
            by_profile[(record.profile_id, record.catalog_item_id)] = record
    return by_character, by_profile


def _backfill_mfp_records(conn) -> MfpBackfill:
    """Attribute every legacy mount-farm row to its chain target's record. See the docstring."""
    result = MfpBackfill()
    items_by_trial = _mount_items_by_trial(conn)
    legacy = conn.execute(
        sa.text(
            "SELECT id, static_group_id, user_id, trial_id, has_mount, totem_count,"
            " ownership_source, totem_source, last_imported_at, last_plugin_sync_at,"
            " last_manual_override_at, updated_at FROM mount_farm_progress ORDER BY id"
        )
    ).all()
    result.rows = len(legacy)
    targets = _resolve_targets(conn, {(row.static_group_id, row.user_id) for row in legacy})

    # One record per (character or profile-level row, item), fed by every legacy row
    # that reaches it, whatever the static. `steps` says how each row got there.
    groups: dict[tuple[str | None, str, str], list] = defaultdict(list)
    steps: dict[tuple[str | None, str, str], set[str]] = defaultdict(set)
    for row in legacy:
        target = targets[(row.static_group_id, row.user_id)]
        if target.step == "none":
            result.skipped_no_profile += 1
            continue
        item_ids = items_by_trial.get(row.trial_id, [])
        if not item_ids:
            result.skipped_no_item += 1
            continue
        setattr(result, target.step, getattr(result, target.step) + 1)
        if not bool(row.has_mount) and not _has_count(row):
            result.no_news += 1
        for item_id in item_ids:
            key = (target.character_id, target.profile_id, item_id)
            groups[key].append(row)
            steps[key].add(target.step)

    by_character, by_profile = _existing_records(conn, {key[2] for key in groups})
    inserts: list[dict] = []
    updates: list[dict] = []
    for (character_id, profile_id, item_id), rows in groups.items():
        have_rows = [row for row in rows if bool(row.has_mount)]
        count_rows = [row for row in rows if _has_count(row)]
        said = have_rows + count_rows
        if not said:
            continue  # the rows say nothing: no record (review I-1)
        state_at = _latest(*(_row_time(row) for row in have_rows))
        state_row = next((r for r in have_rows if _row_time(r) == state_at), None)
        count_row = None
        if count_rows:
            count_row = max(count_rows, key=lambda r: (_parse_ts(_row_time(r)) or _EARLIEST))
        count = count_row.totem_count if count_row is not None else None
        count_at = _row_time(count_row) if count_row is not None else None
        group_at = _latest(*(_row_time(row) for row in said))

        record = None
        adopted = False
        if character_id is not None:
            record = by_character.get((character_id, item_id))
            if record is None and "main" in steps[(character_id, profile_id, item_id)]:
                record = by_profile.get((profile_id, item_id))
                adopted = record is not None
        else:
            record = by_profile.get((profile_id, item_id))

        if record is None:
            source, confidence = _source_for(
                state_row.ownership_source if state_row is not None else count_row.totem_source
            )
            inserts.append(
                {
                    "id": str(uuid.uuid4()),
                    "profile_id": profile_id,
                    "character_id": character_id,
                    "catalog_item_id": item_id,
                    "ownership_state": "have" if have_rows else "unknown",
                    "token_count": count,
                    "source": source,
                    "confidence": confidence,
                    "updated_at": group_at or said[0].updated_at,
                    "state_changed_at": state_at if have_rows else None,
                    "token_count_updated_at": count_at,
                }
            )
            if have_rows:
                result.turned_have += [(r.static_group_id, r.user_id, item_id) for r in have_rows]
            continue

        values = {
            "id": record.id,
            "character_id": record.character_id,
            "ownership_state": record.ownership_state,
            "token_count": record.token_count,
            "source": record.source,
            "confidence": record.confidence,
            "updated_at": record.updated_at,
            "state_changed_at": record.state_changed_at,
            "token_count_updated_at": record.token_count_updated_at,
        }
        changed = False
        if adopted:
            values["character_id"] = character_id
            changed = True
        if have_rows and record.ownership_state != "have":
            values["ownership_state"] = "have"
            values["state_changed_at"] = state_at
            values["source"], values["confidence"] = _source_for(state_row.ownership_source)
            result.turned_have += [(r.static_group_id, r.user_id, item_id) for r in have_rows]
            changed = True
        if count is not None and _count_wins(record, count_at):
            if record.token_count != count or record.token_count_updated_at != count_at:
                values["token_count"] = count
                values["token_count_updated_at"] = count_at
                changed = True
        if changed:
            values["updated_at"] = _latest(record.updated_at, group_at) or record.updated_at
            updates.append(values)

    if inserts:
        conn.execute(_INSERT, inserts)
    if updates:
        conn.execute(_UPDATE, updates)
    result.created = len(inserts)
    result.updated = len(updates)
    result.turned_have.sort()
    return result


# ── Upgrade / downgrade ──────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()
    if FLAG not in _column_names(bind, PROFILES):
        # batch_alter_table so SQLite takes the NOT NULL default in one ALTER;
        # on Postgres it is a straight ALTER TABLE.
        with op.batch_alter_table(PROFILES) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "hide_collection_counts",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )

    # Unconditional (vet I-5): after the guard, never inside it.
    result = _backfill_mfp_records(bind)
    log.info(
        "%s: mount_farm_progress rows %d: to a card character %d, to a main %d,"
        " to a profile-level row %d, skipped (no profile) %d, skipped (no catalog mount) %d,"
        " saying nothing %d; records created %d, updated %d; V1 panels turn Have for %d"
        " (static, user, item)",
        revision, result.rows, result.card, result.main, result.profile,
        result.skipped_no_profile, result.skipped_no_item, result.no_news,
        result.created, result.updated, len(result.turned_have),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if FLAG in _column_names(bind, PROFILES):
        with op.batch_alter_table(PROFILES) as batch_op:
            batch_op.drop_column(FLAG)
    log.info("%s: downgrade dropped %s.%s; the backfilled records stay", revision, PROFILES, FLAG)
