"""Collection records: which character a member's farm rows belong to (S2a-1, R-S1-5).

Two sections. The "chain" section resolves, for (static, user) pairs, which
character's record a member's farm rows read. The "door" section (added by a
later task) is where writes enter. Nothing here edits `provenance.py`: its
R-PV-4 pick serves log rows and stays pinned by PROV-1's tests.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    PlayerCharacter,
    PlayerProfile,
    SnapshotPlayer,
    StaticCharacterRegistration,
    TierSnapshot,
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
