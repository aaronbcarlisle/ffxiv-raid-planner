"""S2a-1b·2 Task F1 — legacy mount-farm rows become collection records; the hide-counts flag.

Plan: design/redesign/plans/2026-10-01-s2a-1-character-records.md, R-S1-18 (history
part: the o8p9q0r1s2t3 migration attributes each MountFarmProgress row to the member's
chain target in that static) and R-S1-19 (player_profiles.hide_collection_counts).

The backfill is a module-level function of the migration, loaded with importlib and
run through conn.run_sync on rows seeded through the models, as A1's tests do. It
carries a frozen copy of the chain (vet M-9), so the cases here walk the chain's
steps, not only the main rule: a card on the alt must reach the alt.
"""

import ast
import importlib.util
import uuid
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.models.mount_farm_progress import MountFarmProgress
from app.models.player_character import PlayerCharacter
from app.models.player_collection_snapshot import PlayerCollectionSnapshot
from app.models.player_profile import PlayerProfile
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_player_profile,
    create_snapshot_player,
    create_static_character_registration,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

# asyncio_mode = "auto" (pyproject) runs the async tests; no module-wide mark.

_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "alembic"
    / "versions"
    / "o8p9q0r1s2t3_add_collection_count_privacy_and_mfp_records.py"
)
_T0 = "2026-06-01T00:00:00+00:00"
_T1 = "2026-06-02T00:00:00+00:00"
_OLD = "2026-01-01T00:00:00+00:00"

_RECORD_COLUMNS = (
    "id, profile_id, character_id, catalog_item_id, ownership_state, token_count,"
    " source, confidence, last_synced_at, updated_at, updated_by_user_id, updated_via,"
    " state_changed_at, token_count_updated_at"
)


def _load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("s2a1b2_mfp_records_migration", _MIGRATION)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def migration() -> ModuleType:
    return _load_migration()


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _run(engine: AsyncEngine, fn):
    async with engine.begin() as conn:
        return await conn.run_sync(fn)


async def _records(engine: AsyncEngine) -> dict[tuple[str | None, str], dict]:
    """Every record, keyed (character_id, catalog_item_id); None for a profile-level row."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text(f"SELECT {_RECORD_COLUMNS} FROM player_collection_snapshots")
        )
        rows = [dict(row._mapping) for row in result.all()]
    keyed = {(row["character_id"], row["catalog_item_id"]): row for row in rows}
    assert len(keyed) == len(rows), "two records of one (character, item)"
    return keyed


async def _all_rows(engine: AsyncEngine) -> list[tuple]:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(f"SELECT {_RECORD_COLUMNS} FROM player_collection_snapshots ORDER BY id")
        )
        return [tuple(row) for row in result.all()]


async def _character(
    session: AsyncSession,
    character_id: str,
    profile_id: str,
    *,
    name: str,
    server: str = "Tonberry",
    is_main: bool,
    created_at: str = _T0,
) -> PlayerCharacter:
    character = PlayerCharacter(
        id=character_id,
        profile_id=profile_id,
        name=name,
        server=server,
        is_main=is_main,
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(character)
    await session.flush()
    return character


async def _member(session: AsyncSession, name: str, *, alt: bool = True):
    """A user with a profile, a main (older) and, by default, an alt (newer)."""
    user = await create_user(session, discord_username=name)
    profile = await create_player_profile(session, user)
    main = await _character(
        session, f"{name}-main", profile.id, name=f"{name} Main", is_main=True, created_at=_T0
    )
    other = None
    if alt:
        other = await _character(
            session, f"{name}-alt", profile.id, name=f"{name} Alt", is_main=False, created_at=_T1
        )
    return user, profile, main, other


async def _static(session: AsyncSession, name: str = "Static"):
    owner = await create_user(session, discord_username=f"owner-{name}-{uuid.uuid4().hex[:6]}")
    return await create_static_group(session, owner, name=name)


async def _card(session: AsyncSession, group, user, *, is_active: bool = True):
    """A claimed card for `user` in a tier of `group`, with no registration."""
    tier = await create_tier_snapshot(session, group, is_active=is_active)
    card = await create_snapshot_player(session, tier, name=user.discord_username)
    card.user_id = user.id
    await session.flush()
    return card


async def _mount(session: AsyncSession, trial: str):
    item = await create_catalog_item(session, name=f"Mount of {trial}")
    item.source_duty_key = trial
    await session.flush()
    return item


async def _mfp(
    session: AsyncSession,
    *,
    group,
    user,
    trial: str,
    has_mount: bool = False,
    totem_count: int = 0,
    updated_at: str = _T1,
    last_imported_at: str | None = None,
    last_plugin_sync_at: str | None = None,
    last_manual_override_at: str | None = None,
    ownership_source: str = "manual",
    totem_source: str = "manual",
) -> MountFarmProgress:
    row = MountFarmProgress(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        user_id=user.id,
        trial_id=trial,
        has_mount=has_mount,
        wants_mount=True,
        totem_count=totem_count,
        ownership_source=ownership_source,
        totem_source=totem_source,
        last_imported_at=last_imported_at,
        last_plugin_sync_at=last_plugin_sync_at,
        last_manual_override_at=last_manual_override_at,
        updated_at=updated_at,
        updated_by_id=user.id,
    )
    session.add(row)
    await session.flush()
    return row


async def _record(
    session: AsyncSession,
    profile_id: str,
    item_id: str,
    *,
    character_id: str | None,
    ownership_state: str = "have",
    token_count: int | None = None,
    state_changed_at: str | None = _OLD,
    token_count_updated_at: str | None = None,
    updated_at: str = _OLD,
    updated_by_user_id: str | None = None,
    updated_via: str | None = None,
) -> None:
    session.add(
        PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            catalog_item_id=item_id,
            character_id=character_id,
            ownership_state=ownership_state,
            token_count=token_count,
            source="manual",
            confidence="low",
            updated_at=updated_at,
            updated_by_user_id=updated_by_user_id,
            updated_via=updated_via,
            state_changed_at=state_changed_at,
            token_count_updated_at=token_count_updated_at,
        )
    )
    await session.flush()


# ── Revision ─────────────────────────────────────────────────────────────────


def test_revision_follows_a1(migration):
    assert migration.revision == "o8p9q0r1s2t3"
    assert migration.down_revision == "n7o8p9q0r1s2"


# ── The chain, frozen (vet M-9) ──────────────────────────────────────────────


async def test_card_on_the_alt_attributes_to_the_alt_not_the_main(session, engine, migration):
    user, profile, main, alt = await _member(session, "a")
    group = await _static(session)
    await create_claimed_card(session, group, user, alt)
    item = await _mount(session, "ex-alt")
    await _mfp(session, group=group, user=user, trial="ex-alt", has_mount=True, totem_count=2)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    assert set(records) == {(alt.id, item.id)}
    record = records[(alt.id, item.id)]
    assert record["profile_id"] == profile.id
    assert record["ownership_state"] == "have"
    assert record["token_count"] == 2
    # A person's edit of the legacy tracker: the bridge's label.
    assert (record["source"], record["confidence"]) == ("player_hub", "medium")
    assert (result.card, result.main, result.profile) == (1, 0, 0)
    assert (result.created, result.updated) == (1, 0)
    assert result.turned_have == [(group.id, user.id, item.id)]


async def test_manual_registration_matches_name_and_world_loosely(session, engine, migration):
    user, profile, main, alt = await _member(session, "m")
    group = await _static(session)
    card = await _card(session, group, user)
    await create_static_character_registration(
        session, group, card, manual_character_name="  m ALT ", manual_world="tonberry"
    )
    item = await _mount(session, "ex-manual")
    await _mfp(session, group=group, user=user, trial="ex-manual", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    assert set(await _records(engine)) == {(alt.id, item.id)}
    assert result.card == 1


async def test_primary_registration_beats_an_older_one(session, engine, migration):
    user, profile, main, alt = await _member(session, "p")
    group = await _static(session)
    card = await _card(session, group, user)
    older = await create_static_character_registration(session, group, card, player_character=main)
    older.created_at = _T0
    newer = await create_static_character_registration(
        session, group, card, player_character=alt, is_primary_for_static=True
    )
    newer.created_at = _T1
    item = await _mount(session, "ex-primary")
    await _mfp(session, group=group, user=user, trial="ex-primary", has_mount=True)
    await session.commit()

    await _run(engine, migration._backfill_mfp_records)

    assert set(await _records(engine)) == {(alt.id, item.id)}


async def test_a_link_to_another_users_character_falls_back_to_the_main(
    session, engine, migration
):
    user, profile, main, alt = await _member(session, "u")
    _other_user, _other_profile, other_main, _ = await _member(session, "o", alt=False)
    group = await _static(session)
    card = await _card(session, group, user)
    # The link survived a reclaim and names the previous claimant's character.
    await create_static_character_registration(
        session, group, card, player_character=other_main, is_primary_for_static=True
    )
    item = await _mount(session, "ex-link")
    await _mfp(session, group=group, user=user, trial="ex-link", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    assert set(await _records(engine)) == {(main.id, item.id)}
    assert (result.card, result.main) == (0, 1)


async def test_a_card_in_an_inactive_tier_is_not_a_card(session, engine, migration):
    user, profile, main, alt = await _member(session, "i")
    group = await _static(session)
    card = await _card(session, group, user, is_active=False)
    await create_static_character_registration(
        session, group, card, player_character=alt, is_primary_for_static=True
    )
    item = await _mount(session, "ex-inactive")
    await _mfp(session, group=group, user=user, trial="ex-inactive", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    assert set(await _records(engine)) == {(main.id, item.id)}
    assert (result.card, result.main) == (0, 1)


async def test_no_card_falls_back_to_the_main(session, engine, migration):
    user, profile, main, alt = await _member(session, "n")
    group = await _static(session)
    item = await _mount(session, "ex-main")
    await _mfp(session, group=group, user=user, trial="ex-main", has_mount=True, totem_count=3)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    assert set(records) == {(main.id, item.id)}
    assert records[(main.id, item.id)]["ownership_state"] == "have"
    assert (result.card, result.main, result.profile) == (0, 1, 0)


async def test_no_character_writes_the_profile_level_row(session, engine, migration):
    user = await create_user(session, discord_username="bare")
    profile = await create_player_profile(session, user)
    group = await _static(session)
    item = await _mount(session, "ex-profile")
    await _mfp(session, group=group, user=user, trial="ex-profile", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    assert set(records) == {(None, item.id)}
    assert records[(None, item.id)]["profile_id"] == profile.id
    assert (result.card, result.main, result.profile) == (0, 0, 1)


async def test_no_profile_is_skipped(session, engine, migration):
    user = await create_user(session, discord_username="noprofile")
    group = await _static(session)
    await _mount(session, "ex-skip")
    await _mfp(session, group=group, user=user, trial="ex-skip", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    assert await _records(engine) == {}
    assert result.skipped_no_profile == 1
    assert (result.created, result.updated) == (0, 0)


async def test_a_trial_with_no_catalog_mount_is_skipped(session, engine, migration):
    user, profile, main, alt = await _member(session, "t")
    group = await _static(session)
    inactive = await _mount(session, "ex-retired")
    inactive.is_active = False
    minion = await create_catalog_item(session, name="Minion", category="minion")
    minion.source_duty_key = "ex-minion"
    await session.flush()
    await _mfp(session, group=group, user=user, trial="ex-retired", has_mount=True)
    await _mfp(session, group=group, user=user, trial="ex-minion", has_mount=True)
    await _mfp(session, group=group, user=user, trial="ex-unknown", has_mount=True)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    assert await _records(engine) == {}
    assert result.skipped_no_item == 3
    assert result.rows == 3


async def test_main_target_adopts_the_profile_level_row(session, engine, migration):
    user, profile, main, _ = await _member(session, "adopt", alt=False)
    group = await _static(session)
    item = await _mount(session, "ex-adopt")
    await _record(
        session, profile.id, item.id, character_id=None, ownership_state="missing",
        state_changed_at=_OLD,
    )
    await _mfp(session, group=group, user=user, trial="ex-adopt", has_mount=True, totem_count=1)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    assert set(records) == {(main.id, item.id)}
    assert records[(main.id, item.id)]["profile_id"] == profile.id
    assert records[(main.id, item.id)]["ownership_state"] == "have"
    assert (result.created, result.updated) == (0, 1)


# ── Several statics, one record ──────────────────────────────────────────────


async def test_two_statics_on_one_character_take_the_most_recent_count(
    session, engine, migration
):
    user, profile, main, alt = await _member(session, "c")
    first = await _static(session, "first")
    second = await _static(session, "second")
    await create_claimed_card(session, first, user, alt)
    await create_claimed_card(session, second, user, alt)
    item = await _mount(session, "ex-count")
    # Lexically "10:00" > "09:00", but +02:00 makes it 08:00Z: parsed, the second is newer.
    await _mfp(session, group=first, user=user, trial="ex-count", totem_count=3,
               has_mount=True, updated_at="2026-06-01T10:00:00+02:00")
    await _mfp(session, group=second, user=user, trial="ex-count", totem_count=7,
               has_mount=True, updated_at="2026-06-01T09:00:00Z")
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    assert set(records) == {(alt.id, item.id)}
    record = records[(alt.id, item.id)]
    assert record["token_count"] == 7
    assert record["token_count_updated_at"] == "2026-06-01T09:00:00Z"
    assert (result.rows, result.card, result.created) == (2, 2, 1)


async def test_has_mount_is_the_or_across_statics(session, engine, migration):
    user, profile, main, alt = await _member(session, "or")
    first = await _static(session, "first")
    second = await _static(session, "second")
    await create_claimed_card(session, first, user, alt)
    await create_claimed_card(session, second, user, alt)
    item = await _mount(session, "ex-or")
    await _mfp(session, group=first, user=user, trial="ex-or", has_mount=True, totem_count=1,
               updated_at="2026-06-01T08:00:00Z")
    await _mfp(session, group=second, user=user, trial="ex-or", has_mount=False, totem_count=5,
               updated_at="2026-06-01T09:00:00Z")
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    record = (await _records(engine))[(alt.id, item.id)]
    assert record["ownership_state"] == "have"
    # The state's time is the time the mount was said to be held, not the later no-news row.
    assert record["state_changed_at"] == "2026-06-01T08:00:00Z"
    assert record["token_count"] == 5
    assert record["token_count_updated_at"] == "2026-06-01T09:00:00Z"
    assert result.turned_have == [(first.id, user.id, item.id)]


async def test_has_mount_false_is_no_news_about_ownership(session, engine, migration):
    user, profile, main, alt = await _member(session, "f")
    group = await _static(session)
    item = await _mount(session, "ex-false")
    await _mfp(session, group=group, user=user, trial="ex-false", has_mount=False, totem_count=4)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    record = (await _records(engine))[(main.id, item.id)]
    # Never 'missing': a default False with a fresh updated_at would demote a
    # farm row's Have in the merge. With no state time the record never wins a state.
    assert record["ownership_state"] == "unknown"
    assert record["state_changed_at"] is None
    assert record["token_count"] == 4
    assert record["token_count_updated_at"] == _T1
    assert result.turned_have == []


# ── Existing records ─────────────────────────────────────────────────────────


async def test_an_existing_have_is_kept(session, engine, migration):
    user, profile, main, alt = await _member(session, "k")
    group = await _static(session)
    await create_claimed_card(session, group, user, alt)
    lowered = await _mount(session, "ex-lowered")
    repeated = await _mount(session, "ex-repeated")
    await _record(session, profile.id, lowered.id, character_id=alt.id, state_changed_at=_OLD)
    await _record(session, profile.id, repeated.id, character_id=alt.id, state_changed_at=_OLD,
                  token_count=0, token_count_updated_at=_T1)
    await _mfp(session, group=group, user=user, trial="ex-lowered", has_mount=False, totem_count=4)
    await _mfp(session, group=group, user=user, trial="ex-repeated", has_mount=True, totem_count=0)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    kept = records[(alt.id, lowered.id)]
    assert kept["ownership_state"] == "have"
    assert kept["state_changed_at"] == _OLD
    assert (kept["source"], kept["confidence"]) == ("manual", "low")
    assert kept["token_count"] == 4
    assert kept["token_count_updated_at"] == _T1
    same = records[(alt.id, repeated.id)]
    assert same["state_changed_at"] == _OLD
    assert same["updated_at"] == _OLD
    assert (result.created, result.updated) == (0, 1)
    assert result.turned_have == []


async def test_an_existing_missing_is_raised_with_the_rows_source(session, engine, migration):
    user, profile, main, alt = await _member(session, "r")
    group = await _static(session)
    await create_claimed_card(session, group, user, alt)
    item = await _mount(session, "ex-raise")
    await _record(session, profile.id, item.id, character_id=alt.id, ownership_state="missing",
                  state_changed_at=_OLD, updated_by_user_id=user.id, updated_via="web")
    await _mfp(session, group=group, user=user, trial="ex-raise", has_mount=True,
               ownership_source="plugin", last_plugin_sync_at=_T1, updated_at=_T0)
    await session.commit()

    result = await _run(engine, migration._backfill_mfp_records)

    record = (await _records(engine))[(alt.id, item.id)]
    assert record["ownership_state"] == "have"
    assert record["state_changed_at"] == _T1
    assert (record["source"], record["confidence"]) == ("plugin", "high")
    # The migration is the last writer, of unknown origin.
    assert record["updated_by_user_id"] is None
    assert record["updated_via"] is None
    assert record["updated_at"] == _T1
    assert result.turned_have == [(group.id, user.id, item.id)]
    assert (result.created, result.updated) == (0, 1)


async def test_a_newer_existing_count_is_not_overwritten(session, engine, migration):
    user, profile, main, alt = await _member(session, "w")
    group = await _static(session)
    await create_claimed_card(session, group, user, alt)
    newer = await _mount(session, "ex-newer")
    older = await _mount(session, "ex-older")
    undated = await _mount(session, "ex-undated")
    await _record(session, profile.id, newer.id, character_id=alt.id, token_count=9,
                  token_count_updated_at="2026-07-01T00:00:00+00:00")
    await _record(session, profile.id, older.id, character_id=alt.id, token_count=9,
                  token_count_updated_at="2026-05-01T00:00:00+00:00")
    await _record(session, profile.id, undated.id, character_id=alt.id, token_count=9,
                  token_count_updated_at=None)
    for trial in ("ex-newer", "ex-older", "ex-undated"):
        await _mfp(session, group=group, user=user, trial=trial, has_mount=True, totem_count=2,
                   updated_at=_T1)
    await session.commit()

    await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)

    def count_of(item) -> tuple:
        record = records[(alt.id, item.id)]
        return record["token_count"], record["token_count_updated_at"]

    assert count_of(newer) == (9, "2026-07-01T00:00:00+00:00")
    assert count_of(older) == (2, _T1)
    # A NULL time loses, as in the merge.
    assert count_of(undated) == (2, _T1)


# ── Provenance and timestamps (vet M-9) ──────────────────────────────────────


async def test_writer_and_channel_are_null(session, engine, migration):
    user, profile, main, alt = await _member(session, "null")
    group = await _static(session)
    item = await _mount(session, "ex-null")
    await _mfp(session, group=group, user=user, trial="ex-null", has_mount=True)
    await session.commit()

    await _run(engine, migration._backfill_mfp_records)

    record = (await _records(engine))[(main.id, item.id)]
    assert record["updated_by_user_id"] is None
    assert record["updated_via"] is None
    assert record["last_synced_at"] is None


async def test_timestamps_come_from_the_row_never_the_clock(session, engine, migration):
    user, profile, main, alt = await _member(session, "ts")
    group = await _static(session)
    dated = await _mount(session, "ex-dated")
    garbled = await _mount(session, "ex-garbled")
    # The manual override is the latest by parsed value; lexically last_plugin_sync_at
    # ("13:00+05:00" = 08:00Z) would win. That exact Z string is stored.
    await _mfp(session, group=group, user=user, trial="ex-dated", has_mount=True, totem_count=6,
               last_plugin_sync_at="2026-06-01T13:00:00+05:00",
               last_manual_override_at="2026-06-01T12:00:00Z",
               last_imported_at="2026-06-01T11:30:00+00:00",
               updated_at="2026-06-01T11:00:00+00:00")
    # Nothing parses: the stamps stay NULL rather than take the migration's clock.
    await _mfp(session, group=group, user=user, trial="ex-garbled", has_mount=True, totem_count=1,
               last_plugin_sync_at="not a time", updated_at="never")
    await session.commit()

    await _run(engine, migration._backfill_mfp_records)

    records = await _records(engine)
    record = records[(main.id, dated.id)]
    assert record["state_changed_at"] == "2026-06-01T12:00:00Z"
    assert record["token_count_updated_at"] == "2026-06-01T12:00:00Z"
    assert record["updated_at"] == "2026-06-01T12:00:00Z"
    undated = records[(main.id, garbled.id)]
    assert undated["ownership_state"] == "have"
    assert undated["state_changed_at"] is None
    assert undated["token_count_updated_at"] is None
    assert undated["updated_at"] == "never"


# ── Idempotent (vet I-5) ─────────────────────────────────────────────────────


async def test_backfill_is_idempotent(session, engine, migration):
    user, profile, main, alt = await _member(session, "idem")
    bare_user = await create_user(session, discord_username="idem-bare")
    bare_profile = await create_player_profile(session, bare_user)
    first = await _static(session, "first")
    second = await _static(session, "second")
    await create_claimed_card(session, first, user, alt)
    items = [await _mount(session, f"ex-idem-{i}") for i in range(4)]
    await _record(session, profile.id, items[2].id, character_id=alt.id, ownership_state="missing")
    await _record(session, profile.id, items[3].id, character_id=alt.id, token_count=9,
                  token_count_updated_at="2026-07-01T00:00:00+00:00")
    await _mfp(session, group=first, user=user, trial="ex-idem-0", has_mount=True, totem_count=2)
    await _mfp(session, group=second, user=user, trial="ex-idem-0", has_mount=False, totem_count=5,
               updated_at="2026-06-03T00:00:00Z")
    await _mfp(session, group=first, user=user, trial="ex-idem-1", has_mount=False)
    await _mfp(session, group=first, user=user, trial="ex-idem-2", has_mount=True)
    await _mfp(session, group=first, user=user, trial="ex-idem-3", has_mount=True, totem_count=1)
    await _mfp(session, group=first, user=bare_user, trial="ex-idem-0", has_mount=True)
    await _mfp(session, group=first, user=user, trial="ex-nope", has_mount=True)
    await session.commit()

    first_run = await _run(engine, migration._backfill_mfp_records)
    # Created: the alt's item 0 (card in `first`), the main's item 0 (no card in
    # `second`), the alt's item 1, the bare profile's item 0. Updated: item 2 raised;
    # item 3 keeps its newer count and its Have.
    assert (first_run.created, first_run.updated) == (4, 1)
    assert first_run.skipped_no_item == 1
    rows = await _all_rows(engine)
    assert len(rows) == 6
    assert bare_profile.id in {row[1] for row in rows}

    second_run = await _run(engine, migration._backfill_mfp_records)

    assert (second_run.created, second_run.updated) == (0, 0)
    assert second_run.turned_have == []
    assert await _all_rows(engine) == rows


# ── The flag (R-S1-19) ───────────────────────────────────────────────────────


def test_flag_column_defaults_false():
    column = PlayerProfile.__table__.c.hide_collection_counts
    assert column.nullable is False
    assert column.default is not None and column.default.arg is False
    assert column.server_default is not None
    assert str(column.server_default.arg) == "false"


async def test_flag_reads_false_on_a_new_profile(session):
    user = await create_user(session, discord_username="flag")
    profile = await create_player_profile(session, user)
    await session.commit()
    await session.refresh(profile)
    assert profile.hide_collection_counts is False
    stored = await session.execute(
        text("SELECT hide_collection_counts FROM player_profiles WHERE id = :id"),
        {"id": profile.id},
    )
    assert bool(stored.scalar_one()) is False


def _column_calls(tree: ast.AST) -> dict[str, ast.Call]:
    calls: dict[str, ast.Call] = {}
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "Column"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ):
            calls[node.args[0].value] = node
    return calls


def test_migration_adds_the_flag_not_null_with_sa_false_default():
    calls = _column_calls(ast.parse(_MIGRATION.read_text(encoding="utf-8")))
    assert "hide_collection_counts" in calls, "no sa.Column('hide_collection_counts', ...)"
    call = calls["hide_collection_counts"]
    kwargs = {kw.arg: kw.value for kw in call.keywords}
    assert isinstance(kwargs.get("nullable"), ast.Constant) and kwargs["nullable"].value is False
    default = kwargs.get("server_default")
    # sa.false(): the dialect script's convention (Postgres refuses DEFAULT 0 on a boolean).
    assert isinstance(default, ast.Call)
    assert isinstance(default.func, ast.Attribute) and default.func.attr == "false"
    assert isinstance(default.func.value, ast.Name) and default.func.value.id == "sa"
    assert not default.args and not default.keywords
