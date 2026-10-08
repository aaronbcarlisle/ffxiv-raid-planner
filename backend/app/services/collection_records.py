"""Collection records: which character a member's farm rows belong to (S2a-1, R-S1-5).

Four sections. The "chain" section resolves, for (static, user) pairs, which
character's record a member's farm rows read. The "door" section is where
record writes enter and records are read. The "rows" section is the farm row's
own door (`write_row`), and the "merge" section is what a static sees once a
row and its member's record are put together (R-S1-9). Nothing here edits
`provenance.py`: its R-PV-4 pick serves log rows and stays pinned by PROV-1's
tests.
"""

import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, TypeVar

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    PlayerCharacter,
    PlayerCollectionSnapshot,
    PlayerProfile,
    RewardParticipantState,
    SnapshotPlayer,
    StaticCharacterRegistration,
    TierSnapshot,
)
from app.models.player_collection_snapshot import (
    SNAPSHOT_CONFIDENCES,
    SNAPSHOT_OWNERSHIP_STATES,
    SNAPSHOT_SOURCES,
)
from app.models.reward_participant_state import PARTICIPANT_SOURCES, PARTICIPANT_STATES

# ---------------------------------------------------------------------------
# Timestamps (ISO text, mixed offsets possible; R-S1-4)
# ---------------------------------------------------------------------------


def parse_ts(value: str | None) -> datetime | None:
    """ISO-8601 text → aware datetime (UTC when naive); None when missing or unparseable."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_after(candidate: str | None, reference: str | None) -> bool:
    """True when both parse and `candidate` is strictly later than `reference`."""
    later, base = parse_ts(candidate), parse_ts(reference)
    return later is not None and base is not None and later > base

# ---------------------------------------------------------------------------
# Chain
# ---------------------------------------------------------------------------

RecordStep = Literal["card", "main", "profile", "none"]
_RECORD_STEPS = frozenset({"card", "main", "profile", "none"})


@dataclass(frozen=True)
class RecordTarget:
    """Where a member's collection rows live.

    `step` says how it was found: `card` (the member's character on this
    static's roster card), `main` (the profile's main), `profile` (the
    profile-level row, the profile has no character) or `none` (no profile).
    """

    user_id: str
    profile_id: str | None
    character_id: str | None
    character_name: str | None
    step: RecordStep

    def __post_init__(self) -> None:
        if self.step not in _RECORD_STEPS:
            raise ValueError(f"step must be one of {sorted(_RECORD_STEPS)}, got {self.step!r}")
        if (self.profile_id is None) != (self.step == "none"):
            raise ValueError("a record target has no profile if and only if its step is 'none'")
        if (self.character_id is None) != (self.step in ("profile", "none")):
            raise ValueError(
                "a record target has no character if and only if its step is 'profile' or 'none'"
            )


def main_character(characters: Sequence[PlayerCharacter]) -> PlayerCharacter | None:
    """A profile's main: `is_main` desc, `created_at` asc (stored text), `id` asc.

    Agrees with the frozen rule in the `n7o8p9q0r1s2` migration, which sorts on
    `(not is_main, created_at, id)` with `created_at` as the stored text.
    """
    if not characters:
        return None
    return min(characters, key=lambda c: (not c.is_main, c.created_at or "", c.id))


def _normalized(value: str | None) -> str:
    return (value or "").lower().strip()


def _fallback_target(
    user_id: str,
    profile_id: str | None,
    characters: Sequence[PlayerCharacter],
) -> RecordTarget:
    """Chain steps 2 and 3: the profile's main, else the profile-level row, else none."""
    if profile_id is None:
        return RecordTarget(user_id, None, None, None, "none")
    main = main_character(characters)
    if main is None:
        return RecordTarget(user_id, profile_id, None, None, "profile")
    return RecordTarget(user_id, profile_id, main.id, main.name, "main")


def _resolve_registration(
    reg: StaticCharacterRegistration, characters: Sequence[PlayerCharacter]
) -> PlayerCharacter | None:
    """The user's character a registration points at, or None when it does not resolve.

    `characters` is the user's own profile's characters, so a linked character
    counts only when it is one of them: the link survives a reclaim, so it can
    name a previous claimant's character. A manual registration counts only
    when its name and world match exactly one of them.
    """
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


SyncMatchReason = Literal["matched", "null", "unknown", "unmatched", "ambiguous"]


def match_sync_character(
    characters: Sequence[PlayerCharacter], name: str | None, world: str | None
) -> tuple[PlayerCharacter | None, SyncMatchReason]:
    """The character a plugin sync names, among the profile's `characters` (R-S1-17).

    Pure: the caller loads the characters. Names compare `.lower().strip()`; an
    empty name is `null` and `"unknown"` in any case is `unknown` (both: no
    name to match). The world narrows the name's matches only when it is sent
    and non-empty. One left is `matched`, none `unmatched`, several `ambiguous`.
    """
    wanted_name = _normalized(name)
    if not wanted_name:
        return None, "null"
    if wanted_name == "unknown":
        return None, "unknown"
    matches = [c for c in characters if _normalized(c.name) == wanted_name]
    wanted_world = _normalized(world)
    if wanted_world:
        matches = [c for c in matches if _normalized(c.server) == wanted_world]
    if not matches:
        return None, "unmatched"
    if len(matches) > 1:
        return None, "ambiguous"
    return matches[0], "matched"


async def _profiles_and_characters(
    db: AsyncSession, user_ids: set[str]
) -> tuple[dict[str, str], dict[str, list[PlayerCharacter]]]:
    """Profile id per user, and each profile's characters (two SELECTs)."""
    profile_by_user: dict[str, str] = {}
    characters_by_profile: dict[str, list[PlayerCharacter]] = {}
    if not user_ids:
        return profile_by_user, characters_by_profile
    result = await db.execute(
        select(PlayerProfile.user_id, PlayerProfile.id).where(PlayerProfile.user_id.in_(user_ids))
    )
    for user_id, profile_id in result.all():
        profile_by_user[user_id] = profile_id
    if profile_by_user:
        result = await db.execute(
            select(PlayerCharacter).where(
                PlayerCharacter.profile_id.in_(set(profile_by_user.values()))
            )
        )
        for character in result.scalars():
            characters_by_profile.setdefault(character.profile_id, []).append(character)
    return profile_by_user, characters_by_profile


async def resolve_record_targets(
    db: AsyncSession, pairs: Iterable[tuple[str, str]]
) -> dict[tuple[str, str], RecordTarget]:
    """Targets for (static_group_id, user_id) pairs, in at most five SELECTs.

    The SELECTs are the statics' active tiers, the users' claimed players in
    them, those players' registrations, the users' profiles and the profiles'
    characters, however many pairs. Per pair: the card's first registration
    that resolves to one of the user's characters (primary first, then oldest),
    else the profile's main, else the profile-level row, else nothing.
    """
    wanted = set(pairs)
    if not wanted:
        return {}
    static_ids = {static_id for static_id, _ in wanted}
    user_ids = {user_id for _, user_id in wanted}

    # 1. Active tiers. With several in a static, the newest wins (below).
    tier_result = await db.execute(
        select(TierSnapshot.id, TierSnapshot.static_group_id, TierSnapshot.created_at).where(
            TierSnapshot.static_group_id.in_(static_ids), TierSnapshot.is_active.is_(True)
        )
    )
    tier_static: dict[str, str] = {}
    tier_rank: dict[str, tuple[str, str]] = {}
    for tier_id, static_id, created_at in tier_result.all():
        tier_static[tier_id] = static_id
        tier_rank[tier_id] = (created_at or "", tier_id)

    # 2. The users' claimed players in those tiers: one card per (static, user).
    cards: dict[tuple[str, str], SnapshotPlayer] = {}
    if tier_static:
        player_result = await db.execute(
            select(SnapshotPlayer).where(
                SnapshotPlayer.tier_snapshot_id.in_(tier_static.keys()),
                SnapshotPlayer.user_id.in_(user_ids),
            )
        )

        def card_rank(player: SnapshotPlayer) -> tuple[tuple[str, str], str, str]:
            return (tier_rank[player.tier_snapshot_id], player.created_at or "", player.id)

        for player in player_result.scalars():
            pair = (tier_static[player.tier_snapshot_id], player.user_id)
            if pair not in wanted:
                continue
            best = cards.get(pair)
            if best is None or card_rank(player) > card_rank(best):
                cards[pair] = player

    # 3. Those cards' registrations, primary first, then oldest, then lowest id.
    regs_by_card: dict[tuple[str, str], list[StaticCharacterRegistration]] = {}
    if cards:
        card_pair = {player.id: pair for pair, player in cards.items()}
        reg_result = await db.execute(
            select(StaticCharacterRegistration)
            .where(
                StaticCharacterRegistration.static_group_id.in_(static_ids),
                StaticCharacterRegistration.snapshot_player_id.in_(card_pair.keys()),
            )
            .order_by(
                StaticCharacterRegistration.is_primary_for_static.desc(),
                StaticCharacterRegistration.created_at.asc(),
                StaticCharacterRegistration.id.asc(),
            )
        )
        for reg in reg_result.scalars():
            pair = card_pair[reg.snapshot_player_id]
            if reg.static_group_id == pair[0]:
                regs_by_card.setdefault(pair, []).append(reg)

    # 4 and 5. Profiles and characters.
    profile_by_user, characters_by_profile = await _profiles_and_characters(db, user_ids)

    targets: dict[tuple[str, str], RecordTarget] = {}
    for pair in wanted:
        _, user_id = pair
        profile_id = profile_by_user.get(user_id)
        characters = characters_by_profile.get(profile_id, []) if profile_id else []
        if profile_id is not None:
            for reg in regs_by_card.get(pair, []):
                character = _resolve_registration(reg, characters)
                if character is not None:
                    targets[pair] = RecordTarget(
                        user_id, profile_id, character.id, character.name, "card"
                    )
                    break
        if pair not in targets:
            targets[pair] = _fallback_target(user_id, profile_id, characters)
    return targets


async def resolve_main_targets(
    db: AsyncSession, user_ids: Iterable[str]
) -> dict[str, RecordTarget]:
    """Targets for users with no static in play (chain steps 2 and 3), in two SELECTs."""
    wanted = set(user_ids)
    profile_by_user, characters_by_profile = await _profiles_and_characters(db, wanted)
    targets: dict[str, RecordTarget] = {}
    for user_id in wanted:
        profile_id = profile_by_user.get(user_id)
        characters = characters_by_profile.get(profile_id, []) if profile_id else []
        targets[user_id] = _fallback_target(user_id, profile_id, characters)
    return targets


# ---------------------------------------------------------------------------
# Door
# ---------------------------------------------------------------------------

RECORD_WRITE_PERSON = "person"
RECORD_WRITE_SYNC = "sync"
_RECORD_WRITE_MODES = frozenset({RECORD_WRITE_PERSON, RECORD_WRITE_SYNC})


@dataclass(frozen=True)
class RecordWrite:
    """What `write_record` did: the record, the ownership it had (None when it
    was created), and whether the ownership or the count changed value."""

    record: PlayerCollectionSnapshot
    prior_ownership: str | None
    state_changed: bool
    count_changed: bool


class _Unset:
    """Type of `UNSET`, the "argument not passed" marker (None is a real value)."""


UNSET = _Unset()

_T = TypeVar("_T")


def unset_if_none(value: _T) -> _T | _Unset:
    """`value`, or UNSET for None: a PATCH body field of None means "unchanged"."""
    return UNSET if value is None else value


def _validated(value: str | None, allowed: frozenset[str], what: str) -> None:
    """Raise ValueError unless `value` is one of `allowed`; None is refused too."""
    if value not in allowed:
        raise ValueError(f"{what} must be one of {sorted(allowed)}, got {value!r}")


async def _find_or_adopt_record(
    db: AsyncSession, target: RecordTarget, catalog_item_id: str
) -> PlayerCollectionSnapshot | None:
    """The record a write to `target` lands on, adopting the profile's row for a main.

    A character target uses that character's row. A `main` target with no row of
    its own adopts the profile-level row for the item (R-S1-6's defensive
    adoption: it covers a race with the profile's first character), so the
    write finds one record, not two. Any other character target (a card's
    character) creates its own.
    """
    snapshot = PlayerCollectionSnapshot
    if target.character_id is not None:
        result = await db.execute(
            select(snapshot).where(
                snapshot.character_id == target.character_id,
                snapshot.catalog_item_id == catalog_item_id,
            )
        )
        record = result.scalar_one_or_none()
        if record is not None or target.step != "main":
            return record
    result = await db.execute(
        select(snapshot).where(
            snapshot.profile_id == target.profile_id,
            snapshot.catalog_item_id == catalog_item_id,
            snapshot.character_id.is_(None),
        )
    )
    record = result.scalar_one_or_none()
    if record is not None and target.character_id is not None:
        record.character_id = target.character_id
    return record


async def write_record(
    db: AsyncSession,
    target: RecordTarget,
    catalog_item_id: str,
    *,
    actor_user_id: str | None,
    via: str,
    mode: str,
    now: str,
    ownership: str | None = None,
    token_count: int | None = None,
    source: str,
    confidence: str,
    restore_state_changed_at: str | None | _Unset = UNSET,
) -> RecordWrite:
    """Create or update the record `target` names: the only code that does (R-S1-7).

    `person` mode (Hub, a member's own cell, own drop): the ownership is set as
    given, so a person can lower a plugin Have, and `source`/`confidence` move
    with it. `sync` mode (plugin): the ownership only rises to `have`, never
    lowers (a create from anything else is `unknown`), `source` is stored as
    given (callers pass `plugin`) and `last_synced_at` is `now`. In both modes a
    given `token_count` is set.

    `now` is the caller's server clock, an ISO string in the table's format; the
    door never reads a clock and never takes a plugin's `synced_at`.
    `state_changed_at` is `now` when the stored ownership changes or a create
    names one; `token_count_updated_at` is `now` whenever a count is given;
    `updated_at`, `updated_by_user_id` and `updated_via` move on every write.
    `actor_user_id` is None for a derived write (R-S1-8); `via` is computed by
    the route (`logged_via`), never here.

    `restore_state_changed_at` is for Undo's revert alone (R-S1-14): when
    passed, with an ownership, the stored `state_changed_at` is that value
    (None included) instead of `now`. The caller commits.
    """
    if mode not in _RECORD_WRITE_MODES:
        raise ValueError(f"mode must be one of {sorted(_RECORD_WRITE_MODES)}, got {mode!r}")
    if ownership is not None:  # optional: a count-only write names none
        _validated(ownership, SNAPSHOT_OWNERSHIP_STATES, "ownership")
    _validated(source, SNAPSHOT_SOURCES, "source")
    _validated(confidence, SNAPSHOT_CONFIDENCES, "confidence")
    if target.profile_id is None:
        raise ValueError("a record target needs a profile")
    sync_mode = mode == RECORD_WRITE_SYNC

    record = await _find_or_adopt_record(db, target, catalog_item_id)
    prior_ownership = None if record is None else record.ownership_state
    prior_count = None if record is None else record.token_count

    # The ownership this write stores, or None when it leaves it alone.
    if sync_mode:
        # The plugin only ever asserts Have; anything else is "no news".
        new_ownership = "have" if ownership == "have" else None
    else:
        new_ownership = ownership

    if record is None:
        record = PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=target.profile_id,
            character_id=target.character_id,
            catalog_item_id=catalog_item_id,
            ownership_state=new_ownership or "unknown",
            token_count=token_count,
            source=source,
            confidence=confidence,
            updated_at=now,
            updated_by_user_id=actor_user_id,
            updated_via=via,
            state_changed_at=now if new_ownership is not None else None,
            token_count_updated_at=now if token_count is not None else None,
        )
        db.add(record)
        state_changed = new_ownership is not None
    else:
        state_changed = new_ownership is not None and new_ownership != record.ownership_state
        if state_changed:
            record.ownership_state = new_ownership
        if token_count is not None:
            record.token_count = token_count
        if sync_mode:
            record.source = source
            if state_changed:
                record.confidence = confidence
        elif new_ownership is not None:
            record.source = source
            record.confidence = confidence

    if state_changed:
        record.state_changed_at = now
    if new_ownership is not None and not isinstance(restore_state_changed_at, _Unset):
        record.state_changed_at = restore_state_changed_at
    if token_count is not None:
        record.token_count_updated_at = now
    if sync_mode:
        record.last_synced_at = now
    record.updated_at = now
    record.updated_by_user_id = actor_user_id
    record.updated_via = via

    await db.flush()
    return RecordWrite(
        record=record,
        prior_ownership=prior_ownership,
        state_changed=state_changed,
        count_changed=token_count is not None and token_count != prior_count,
    )


async def adopt_profile_rows(db: AsyncSession, *, profile_id: str, character_id: str) -> int:
    """Give a profile's first character its profile-level rows (R-S1-6). Returns the rows moved.

    Both creation paths call this when the profile had no character. An item
    the character already holds a row for is skipped, so the move can never hit
    `uq_pcs_character_item`. The caller flushes the new character first and commits.
    """
    snapshot = PlayerCollectionSnapshot
    held = select(snapshot.catalog_item_id).where(snapshot.character_id == character_id)
    result = await db.execute(
        select(snapshot).where(
            snapshot.profile_id == profile_id,
            snapshot.character_id.is_(None),
            snapshot.catalog_item_id.not_in(held),
        )
    )
    rows = list(result.scalars())
    for row in rows:
        row.character_id = character_id
    await db.flush()
    return len(rows)


async def release_last_character_rows(
    db: AsyncSession, *, profile_id: str, character_id: str
) -> int:
    """Turn a profile's last character's rows profile-level, so a relink keeps them (R-S1-6).

    A stray profile-level row for the same item is deleted first (the character's
    row wins) and that delete is flushed before the release, because a flush
    runs UPDATEs ahead of DELETEs and the release would otherwise hit
    `uq_pcs_profile_item_no_character`. Returns the rows released.
    """
    snapshot = PlayerCollectionSnapshot
    own = list(
        (await db.execute(select(snapshot).where(snapshot.character_id == character_id))).scalars()
    )
    if not own:
        return 0
    strays = await db.execute(
        select(snapshot).where(
            snapshot.profile_id == profile_id,
            snapshot.character_id.is_(None),
            snapshot.catalog_item_id.in_([row.catalog_item_id for row in own]),
        )
    )
    for stray in strays.scalars():
        await db.delete(stray)
    await db.flush()
    for row in own:
        row.character_id = None
    await db.flush()
    return len(own)


async def delete_character_records(db: AsyncSession, *, character_id: str) -> int:
    """Delete one character's rows explicitly (R-S1-6, vet I-1). Returns the rows deleted.

    The FK's CASCADE only acts on Postgres: SQLite runs without foreign keys
    here, so the unlink path calls this before it deletes the character.
    """
    result = await db.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.character_id == character_id
        )
    )
    rows = list(result.scalars())
    for row in rows:
        await db.delete(row)
    await db.flush()
    return len(rows)


async def load_records(
    db: AsyncSession,
    targets: Iterable[RecordTarget],
    catalog_item_ids: Iterable[str],
) -> dict[RecordTarget, dict[str, PlayerCollectionSnapshot]]:
    """Each target's records for the items, by item id, in one SELECT.

    The SELECT takes `character_id IN (...)` OR (`profile_id IN (...)` AND
    `character_id IS NULL`) over the items. A `main` target with no row of its
    own for an item gets the profile-level row for it, as `write_record` adopts
    it (vet I-5); a card's character does not. A target with no profile gets
    `{}`, and no items or no targets issues no SELECT.
    """
    wanted = set(targets)
    item_ids = set(catalog_item_ids)
    loaded: dict[RecordTarget, dict[str, PlayerCollectionSnapshot]] = {t: {} for t in wanted}
    character_ids = {t.character_id for t in wanted if t.character_id is not None}
    profile_ids = {
        t.profile_id
        for t in wanted
        if t.profile_id is not None and t.step in ("main", "profile")
    }
    if not item_ids or not (character_ids or profile_ids):
        return loaded

    snapshot = PlayerCollectionSnapshot
    result = await db.execute(
        select(snapshot).where(
            snapshot.catalog_item_id.in_(item_ids),
            or_(
                snapshot.character_id.in_(character_ids),
                and_(snapshot.profile_id.in_(profile_ids), snapshot.character_id.is_(None)),
            ),
        )
    )
    by_character: dict[tuple[str, str], PlayerCollectionSnapshot] = {}
    by_profile: dict[tuple[str, str], PlayerCollectionSnapshot] = {}
    for record in result.scalars():
        if record.character_id is not None:
            by_character[(record.character_id, record.catalog_item_id)] = record
        else:
            by_profile[(record.profile_id, record.catalog_item_id)] = record

    for target in wanted:
        if target.profile_id is None:
            continue
        for item_id in item_ids:
            record = None
            if target.character_id is not None:
                record = by_character.get((target.character_id, item_id))
            if record is None and target.step in ("main", "profile"):
                record = by_profile.get((target.profile_id, item_id))
            if record is not None:
                loaded[target][item_id] = record
    return loaded


# ---------------------------------------------------------------------------
# Rows: the farm row's door (R-S1-7)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RowWrite:
    """What `write_row` did: the row, the state it had (None when it was
    created), and whether the state or the count changed value."""

    row: RewardParticipantState
    prior_state: str | None
    state_changed: bool
    count_changed: bool


async def write_row(
    db: AsyncSession,
    *,
    row: RewardParticipantState | None,
    goal_id: str,
    static_group_id: str,
    user_id: str,
    actor_user_id: str | None,
    via: str,
    now: str,
    state: str | _Unset = UNSET,
    token_count: int | None | _Unset = UNSET,
    priority_rank: int | None | _Unset = UNSET,
    notes: str | None | _Unset = UNSET,
    source: str | _Unset = UNSET,
    last_synced_at: str | None | _Unset = UNSET,
    last_manual_override_at: str | None | _Unset = UNSET,
) -> RowWrite:
    """Create or update a member's farm row: the row's door (R-S1-7). It decides nothing.

    `row` is the member's row for the goal, or None to create one for (goal,
    static, user). Every value given is set as given, None included; an UNSET
    one is left alone, and on create takes the column's default (`want`,
    `manual`). `state_changed_at` is `now` when the state value changes or on
    create; `token_count_updated_at` is `now` whenever a non-None count is
    given, changed or not; `updated_at`, `updated_by_user_id` and `updated_via`
    move on every write. `now` is the caller's server clock, `actor_user_id` is
    None for a derived write (R-S1-8) and `via` is computed by the route.
    Each caller keeps its own collision rule. The caller commits.
    """
    if not isinstance(state, _Unset):
        _validated(state, PARTICIPANT_STATES, "state")
    if not isinstance(source, _Unset):
        _validated(source, PARTICIPANT_SOURCES, "source")
    if row is not None and (row.goal_id, row.static_group_id, row.user_id) != (
        goal_id,
        static_group_id,
        user_id,
    ):
        raise ValueError("the row given is not the (goal, static, user) row named")

    prior_state = None if row is None else row.state
    prior_count = None if row is None else row.token_count
    count_given = not isinstance(token_count, _Unset)

    if row is None:
        row = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal_id,
            user_id=user_id,
            static_group_id=static_group_id,
            state="want",
            source="manual",
            updated_at=now,
            updated_by_user_id=actor_user_id,
            updated_via=via,
            state_changed_at=now,
            token_count_updated_at=None,  # set below once a count is given
        )
        db.add(row)
        state_changed = True
    else:
        state_changed = not isinstance(state, _Unset) and state != row.state

    if not isinstance(state, _Unset):
        row.state = state
    if count_given:
        row.token_count = token_count
    if not isinstance(priority_rank, _Unset):
        row.priority_rank = priority_rank
    if not isinstance(notes, _Unset):
        row.notes = notes
    if not isinstance(source, _Unset):
        row.source = source
    if not isinstance(last_synced_at, _Unset):
        row.last_synced_at = last_synced_at
    if not isinstance(last_manual_override_at, _Unset):
        row.last_manual_override_at = last_manual_override_at

    if state_changed:
        row.state_changed_at = now
    if count_given and token_count is not None:
        row.token_count_updated_at = now
    row.updated_at = now
    row.updated_by_user_id = actor_user_id
    row.updated_via = via

    await db.flush()
    return RowWrite(
        row=row,
        prior_state=prior_state,
        state_changed=state_changed,
        count_changed=count_given and token_count != prior_count,
    )


# ---------------------------------------------------------------------------
# Merge: what a static sees for a row once its record is applied (R-S1-9)
# ---------------------------------------------------------------------------

_UN_HAVE = frozenset({"missing", "unknown"})


@dataclass(frozen=True)
class MergedParticipant:
    """A farm row as the static reads it: `state`, `token_count` and `source`
    are the merged values; the flags say which came from the record; `record`
    is the record that was applied (None when there was none)."""

    state: str
    token_count: int | None
    source: str
    state_from_record: bool
    count_from_record: bool
    record: PlayerCollectionSnapshot | None = None


def merge_participant(
    row: RewardParticipantState, record: PlayerCollectionSnapshot | None
) -> MergedParticipant:
    """The pure merge (R-S1-9). With no record, the row as stored.

    A row value is a correction when its writer is set and is not the member
    (R-S1-8). `newer` means the record's `state_changed_at` is set and later
    than the row's, or the row's is NULL. State: (1) a Pass that is not a
    correction stays; (2) a newer record `have` wins; (3) a row Have that is not
    a correction yields to a newer record `missing`/`unknown` as Want (Q3);
    (4) otherwise the row's. Count: the record's when the row's is NULL, the
    row's when the record's is NULL, else the later `token_count_updated_at`
    (a NULL time loses; a tie goes to the record). `source` follows the state; the
    record's source is used only when it is in `PARTICIPANT_SOURCES`, and the
    check exists for off-vocabulary legacy data alone (the record's writers
    validate its source).
    """
    if record is None:
        return MergedParticipant(row.state, row.token_count, row.source, False, False, None)

    correction = row.updated_by_user_id is not None and row.updated_by_user_id != row.user_id
    record_at = parse_ts(record.state_changed_at)
    row_at = parse_ts(row.state_changed_at)
    newer = record_at is not None and (row_at is None or record_at > row_at)

    if row.state == "pass" and not correction:
        state, state_from_record = row.state, False
    elif record.ownership_state == "have" and newer:
        state, state_from_record = "have", True
    elif row.state == "have" and not correction and record.ownership_state in _UN_HAVE and newer:
        state, state_from_record = "want", True
    else:
        state, state_from_record = row.state, False

    if row.token_count is None:
        token_count, count_from_record = record.token_count, record.token_count is not None
    elif record.token_count is None:
        token_count, count_from_record = row.token_count, False
    else:
        row_count_at = parse_ts(row.token_count_updated_at)
        record_count_at = parse_ts(record.token_count_updated_at)
        record_wins = row_count_at is None or (
            record_count_at is not None and record_count_at >= row_count_at
        )
        token_count = record.token_count if record_wins else row.token_count
        count_from_record = record_wins

    source = row.source
    if state_from_record and record.source in PARTICIPANT_SOURCES:
        source = record.source
    return MergedParticipant(
        state, token_count, source, state_from_record, count_from_record, record
    )


async def merged_participants(
    db: AsyncSession,
    *,
    static_group_id: str,
    rows: Iterable[RewardParticipantState],
    catalog_item_by_goal: Mapping[str, str | None],
) -> dict[str, MergedParticipant]:
    """Every row merged with its member's record in this static, by row id.

    One chain resolution for the rows' members and one record SELECT for all
    their goals' items, however many rows, members or goals. A row whose goal
    has no catalog item is the row as stored; when no row has one, nothing is
    issued.
    """
    rows = list(rows)
    item_by_row = {row.id: catalog_item_by_goal.get(row.goal_id) for row in rows}
    item_ids = {item_id for item_id in item_by_row.values() if item_id is not None}
    records: dict[str, PlayerCollectionSnapshot | None] = {}
    if item_ids:
        pairs = {
            (static_group_id, row.user_id) for row in rows if item_by_row[row.id] is not None
        }
        targets = await resolve_record_targets(db, pairs)
        loaded = await load_records(db, targets.values(), item_ids)
        for row in rows:
            item_id = item_by_row[row.id]
            if item_id is not None:
                records[row.id] = loaded[targets[(static_group_id, row.user_id)]].get(item_id)
    return {row.id: merge_participant(row, records.get(row.id)) for row in rows}
