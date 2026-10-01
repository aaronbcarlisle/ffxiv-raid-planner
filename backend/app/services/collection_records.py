"""Collection records: which character a member's farm rows belong to (S2a-1, R-S1-5).

Two sections. The "chain" section resolves, for (static, user) pairs, which
character's record a member's farm rows read. The "door" section is where writes
enter and records are read. Nothing here edits `provenance.py`: its
R-PV-4 pick serves log rows and stays pinned by PROV-1's tests.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    PlayerCharacter,
    PlayerCollectionSnapshot,
    PlayerProfile,
    SnapshotPlayer,
    StaticCharacterRegistration,
    TierSnapshot,
)
from app.models.player_collection_snapshot import (
    SNAPSHOT_CONFIDENCES,
    SNAPSHOT_OWNERSHIP_STATES,
    SNAPSHOT_SOURCES,
)

# ---------------------------------------------------------------------------
# Chain
# ---------------------------------------------------------------------------

RecordStep = Literal["card", "main", "profile", "none"]


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


def _validated(value: str | None, allowed: frozenset[str], what: str) -> None:
    if value is not None and value not in allowed:
        raise ValueError(f"{what} must be one of {sorted(allowed)}, got {value!r}")


async def _find_record(
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
    _validated(ownership, SNAPSHOT_OWNERSHIP_STATES, "ownership")
    _validated(source, SNAPSHOT_SOURCES, "source")
    _validated(confidence, SNAPSHOT_CONFIDENCES, "confidence")
    if target.profile_id is None:
        raise ValueError("a record target needs a profile")
    sync_mode = mode == RECORD_WRITE_SYNC

    record = await _find_record(db, target, catalog_item_id)
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
