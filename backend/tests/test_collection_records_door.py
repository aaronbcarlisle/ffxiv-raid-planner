"""S2a-1a·1 A3: the record door (R-S1-7, R-S1-6, vet I-5, vet M-10).

`write_record` is the one function that constructs or assigns a collection
record. `person` mode sets what it is given (so a person can lower a plugin
Have); `sync` mode only ever raises to `have`. `load_records` reads many
targets in one SELECT and serves a main's profile-level row when the main has
none of its own.
"""

import uuid

import pytest
from sqlalchemy import func, select

from app.models import PlayerCollectionSnapshot
from app.services.collection_records import (
    RECORD_WRITE_PERSON,
    RECORD_WRITE_SYNC,
    RecordTarget,
    adopt_profile_rows,
    delete_character_records,
    load_records,
    release_last_character_rows,
    write_record,
)
from tests.factories import (
    create_catalog_item,
    create_player_character,
    create_player_profile,
    create_user,
)

T0 = "2026-02-01T10:00:00+00:00"
T1 = "2026-02-02T10:00:00+00:00"
T2 = "2026-02-03T10:00:00+00:00"
RESTORED = "2026-01-15T08:30:00+00:00"


async def seed(
    session,
    profile,
    item,
    *,
    character=None,
    ownership="unknown",
    token_count=None,
    source="plugin",
    state_changed_at=T0,
    token_count_updated_at=None,
):
    row = PlayerCollectionSnapshot(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        catalog_item_id=item.id,
        character_id=character.id if character else None,
        ownership_state=ownership,
        token_count=token_count,
        source=source,
        confidence="high",
        last_synced_at=T0,
        updated_at=T0,
        state_changed_at=state_changed_at,
        token_count_updated_at=token_count_updated_at,
    )
    session.add(row)
    await session.flush()
    return row


def target_of(user, profile, character=None, step=None) -> RecordTarget:
    if character is None:
        return RecordTarget(user.id, profile.id, None, None, step or "profile")
    return RecordTarget(user.id, profile.id, character.id, character.name, step or "card")


async def person(session, target, item, *, now=T1, **kwargs):
    kwargs.setdefault("source", "manual")
    kwargs.setdefault("confidence", "medium")
    return await write_record(
        session,
        target,
        item.id,
        actor_user_id=target.user_id,
        via="web",
        mode=RECORD_WRITE_PERSON,
        now=now,
        **kwargs,
    )


async def sync(session, target, item, *, now=T1, **kwargs):
    return await write_record(
        session,
        target,
        item.id,
        actor_user_id=target.user_id,
        via="api_key",
        mode=RECORD_WRITE_SYNC,
        now=now,
        source="plugin",
        confidence="high",
        **kwargs,
    )


async def count_rows(session) -> int:
    result = await session.execute(select(func.count()).select_from(PlayerCollectionSnapshot))
    return result.scalar_one()


@pytest.fixture
async def world(session, test_user):
    profile = await create_player_profile(session, test_user)
    main = await create_player_character(session, profile, name="Main", is_main=True)
    alt = await create_player_character(session, profile, name="Alt", is_main=False)
    item = await create_catalog_item(session, name="Mount A")
    return profile, main, alt, item


class TestPersonMode:
    async def test_have_over_a_plugin_have_stays_have(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have")

        result = await person(session, target_of(test_user, profile, main), item, ownership="have")

        assert result.record.ownership_state == "have"
        assert result.prior_ownership == "have"
        assert result.state_changed is False

    async def test_have_over_a_plugin_have_relabels_it_manual_medium(
        self, session, test_user, world
    ):
        """M5 (controller ruling): the person's unchanged Have takes the row.

        Today's Hub does this on every `have` write, plugin rows included
        (routers/player_collection.py), so V1 Profile > Collections is unchanged.
        """
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", source="plugin")

        result = await person(session, target_of(test_user, profile, main), item, ownership="have")

        assert result.state_changed is False
        assert result.record.source == "manual"
        assert result.record.confidence == "medium"

    async def test_missing_over_a_plugin_have_lowers_it(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", state_changed_at=T0)

        result = await person(
            session, target_of(test_user, profile, main), item, ownership="missing"
        )

        assert result.record.ownership_state == "missing"
        assert result.record.state_changed_at == T1
        assert result.record.source == "manual"
        assert result.prior_ownership == "have"
        assert result.state_changed is True

    async def test_a_count_over_a_plugin_count_is_set(self, session, test_user, world):
        profile, main, _, item = world
        await seed(
            session, profile, item, character=main, token_count=3,
            token_count_updated_at=T0,
        )

        result = await person(session, target_of(test_user, profile, main), item, token_count=7)

        assert result.record.token_count == 7
        assert result.record.token_count_updated_at == T1
        assert result.count_changed is True

    async def test_a_count_only_write_leaves_ownership_and_its_stamp(
        self, session, test_user, world
    ):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", state_changed_at=T0)

        result = await person(session, target_of(test_user, profile, main), item, token_count=2)

        assert result.record.ownership_state == "have"
        assert result.record.state_changed_at == T0
        assert result.record.source == "plugin"
        assert result.state_changed is False

    async def test_the_same_ownership_twice_keeps_state_changed_at(
        self, session, test_user, world
    ):
        profile, main, _, item = world
        target = target_of(test_user, profile, main)

        first = await person(session, target, item, ownership="missing", now=T1)
        second = await person(session, target, item, ownership="missing", now=T2)

        assert first.state_changed is True
        assert second.state_changed is False
        assert second.record.state_changed_at == T1
        assert second.record.updated_at == T2

    async def test_a_same_count_still_moves_its_stamp(self, session, test_user, world):
        profile, main, _, item = world
        target = target_of(test_user, profile, main)

        await person(session, target, item, token_count=4, now=T1)
        again = await person(session, target, item, token_count=4, now=T2)

        assert again.count_changed is False
        assert again.record.token_count_updated_at == T2

    async def test_a_create_with_an_ownership_stamps_the_state(self, session, test_user, world):
        profile, main, _, item = world

        result = await person(
            session, target_of(test_user, profile, main), item, ownership="have"
        )

        assert result.prior_ownership is None
        assert result.state_changed is True
        assert result.record.state_changed_at == T1
        assert result.record.source == "manual"
        assert result.record.confidence == "medium"
        assert result.record.last_synced_at is None


class TestSyncMode:
    async def test_missing_is_never_written(self, session, test_user, world):
        profile, main, _, item = world
        existing = await seed(
            session, profile, item, character=main, ownership="have", state_changed_at=T0
        )

        result = await sync(
            session, target_of(test_user, profile, main), item, ownership="missing"
        )

        assert result.record is existing
        assert result.record.ownership_state == "have"
        assert result.record.state_changed_at == T0
        assert result.state_changed is False

    async def test_missing_on_create_does_not_write_missing(self, session, test_user, world):
        profile, main, _, item = world

        result = await sync(
            session, target_of(test_user, profile, main), item, ownership="missing"
        )

        assert result.record.ownership_state == "unknown"
        assert result.record.state_changed_at is None

    async def test_have_over_missing_raises_it(self, session, test_user, world):
        profile, main, _, item = world
        await seed(
            session, profile, item, character=main, ownership="missing",
            source="manual", state_changed_at=T0,
        )

        result = await sync(session, target_of(test_user, profile, main), item, ownership="have")

        assert result.record.ownership_state == "have"
        assert result.record.state_changed_at == T1
        assert result.record.source == "plugin"
        assert result.record.confidence == "high"
        assert result.prior_ownership == "missing"
        assert result.state_changed is True

    async def test_a_token_only_create_is_unknown_with_no_state_stamp(
        self, session, test_user, world
    ):
        profile, main, _, item = world

        result = await sync(session, target_of(test_user, profile, main), item, token_count=5)

        assert result.record.ownership_state == "unknown"
        assert result.record.state_changed_at is None
        assert result.record.token_count == 5
        assert result.record.token_count_updated_at == T1
        assert result.prior_ownership is None
        assert result.state_changed is False
        assert result.count_changed is True

    async def test_a_count_is_set_and_last_synced_at_is_now(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, token_count=1)

        result = await sync(session, target_of(test_user, profile, main), item, token_count=9)

        assert result.record.token_count == 9
        assert result.record.last_synced_at == T1
        assert result.record.source == "plugin"


class TestEveryWrite:
    @pytest.mark.parametrize("mode", [RECORD_WRITE_PERSON, RECORD_WRITE_SYNC])
    async def test_writer_channel_and_time_are_recorded(self, session, test_user, world, mode):
        profile, main, _, item = world
        await seed(session, profile, item, character=main)

        result = await write_record(
            session,
            target_of(test_user, profile, main),
            item.id,
            actor_user_id=test_user.id,
            via="api_key",
            mode=mode,
            now=T2,
            ownership="have",
            source="plugin" if mode == RECORD_WRITE_SYNC else "manual",
            confidence="high",
        )

        assert result.record.updated_by_user_id == test_user.id
        assert result.record.updated_via == "api_key"
        assert result.record.updated_at == T2

    async def test_a_create_records_them_too(self, session, test_user, world):
        profile, main, _, item = world

        result = await person(session, target_of(test_user, profile, main), item, token_count=1)

        assert result.record.updated_by_user_id == test_user.id
        assert result.record.updated_via == "web"
        assert result.record.updated_at == T1

    async def test_a_derived_write_may_record_no_writer(self, session, test_user, world):
        profile, main, _, item = world

        result = await write_record(
            session,
            target_of(test_user, profile, main),
            item.id,
            actor_user_id=None,
            via="web",
            mode=RECORD_WRITE_PERSON,
            now=T1,
            ownership="have",
            source="manual",
            confidence="medium",
        )

        assert result.record.updated_by_user_id is None
        assert result.record.updated_via == "web"

    async def test_a_bad_mode_or_value_is_refused(self, session, test_user, world):
        profile, main, _, item = world
        target = target_of(test_user, profile, main)

        with pytest.raises(ValueError):
            await write_record(
                session, target, item.id, actor_user_id=test_user.id, via="web",
                mode="lead", now=T1, ownership="have", source="manual", confidence="medium",
            )
        with pytest.raises(ValueError):
            await person(session, target, item, ownership="owned")
        assert await count_rows(session) == 0

    @pytest.mark.parametrize("field", ["source", "confidence"])
    async def test_a_missing_source_or_confidence_is_refused_before_any_write(
        self, session, test_user, world, field
    ):
        """M7: None is a ValueError here, not an IntegrityError at flush."""
        profile, main, _, item = world
        kwargs = {"source": "manual", "confidence": "medium", field: None}

        with pytest.raises(ValueError):
            await write_record(
                session, target_of(test_user, profile, main), item.id,
                actor_user_id=test_user.id, via="web", mode=RECORD_WRITE_PERSON,
                now=T1, ownership="have", **kwargs,
            )
        assert await count_rows(session) == 0

    async def test_a_target_with_no_profile_is_refused(self, session, test_user, world):
        _, _, _, item = world
        nobody = RecordTarget(test_user.id, None, None, None, "none")

        with pytest.raises(ValueError):
            await person(session, nobody, item, ownership="have")


class TestTargets:
    async def test_a_profile_level_target_writes_the_profile_level_row(
        self, session, test_user
    ):
        profile = await create_player_profile(session, test_user)
        item = await create_catalog_item(session, name="Mount P")

        result = await person(session, target_of(test_user, profile), item, ownership="have")

        assert result.record.character_id is None
        assert result.record.profile_id == profile.id
        assert await count_rows(session) == 1

    async def test_a_profile_level_target_updates_the_existing_profile_row(
        self, session, test_user
    ):
        profile = await create_player_profile(session, test_user)
        item = await create_catalog_item(session, name="Mount P")
        existing = await seed(session, profile, item, ownership="missing")

        result = await person(session, target_of(test_user, profile), item, ownership="have")

        assert result.record is existing
        assert await count_rows(session) == 1

    async def test_a_main_target_with_only_a_profile_level_row_adopts_it(
        self, session, test_user, world
    ):
        profile, main, _, item = world
        old = await seed(session, profile, item, ownership="have", token_count=2)

        result = await person(
            session, target_of(test_user, profile, main, step="main"), item, token_count=6
        )

        assert result.record is old
        assert old.character_id == main.id
        assert old.ownership_state == "have"
        assert result.prior_ownership == "have"
        assert await count_rows(session) == 1

    async def test_a_main_with_its_own_row_leaves_the_profile_level_row(
        self, session, test_user, world
    ):
        profile, main, _, item = world
        stray = await seed(session, profile, item, ownership="have")
        own = await seed(session, profile, item, character=main, ownership="missing")

        result = await person(
            session, target_of(test_user, profile, main, step="main"), item, ownership="have"
        )

        assert result.record is own
        assert stray.character_id is None
        assert await count_rows(session) == 2

    async def test_an_alt_target_with_only_a_profile_level_row_creates_its_own(
        self, session, test_user, world
    ):
        profile, _, alt, item = world
        old = await seed(session, profile, item, ownership="have")

        result = await person(
            session, target_of(test_user, profile, alt, step="card"), item, ownership="missing"
        )

        assert result.record is not old
        assert result.record.character_id == alt.id
        assert result.prior_ownership is None
        assert old.character_id is None
        assert old.ownership_state == "have"
        assert await count_rows(session) == 2

    async def test_two_characters_hold_separate_records(self, session, test_user, world):
        profile, main, alt, item = world

        await person(session, target_of(test_user, profile, main), item, ownership="have")
        await person(session, target_of(test_user, profile, alt), item, ownership="missing")

        rows = (await session.execute(select(PlayerCollectionSnapshot))).scalars().all()
        assert {(r.character_id, r.ownership_state) for r in rows} == {
            (main.id, "have"),
            (alt.id, "missing"),
        }


class TestRestoreStateChangedAt:
    async def test_the_stored_stamp_is_the_passed_value_not_now(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", state_changed_at=T2)

        result = await person(
            session,
            target_of(test_user, profile, main),
            item,
            ownership="missing",
            restore_state_changed_at=RESTORED,
        )

        assert result.record.ownership_state == "missing"
        assert result.record.state_changed_at == RESTORED
        assert result.record.state_changed_at != T1
        assert result.record.updated_at == T1

    async def test_a_restored_null_stays_null(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", state_changed_at=T2)

        result = await person(
            session,
            target_of(test_user, profile, main),
            item,
            ownership="unknown",
            restore_state_changed_at=None,
        )

        assert result.record.state_changed_at is None

    async def test_without_it_the_stamp_is_now(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, character=main, ownership="have", state_changed_at=T0)

        result = await person(
            session, target_of(test_user, profile, main), item, ownership="missing"
        )

        assert result.record.state_changed_at == T1


class TestLoadRecords:
    async def test_mixed_targets_are_one_select(
        self, session, engine, test_user, test_user_2, world, count_statements
    ):
        profile, main, alt, item = world
        item2 = await create_catalog_item(session, name="Mount B")
        profile2 = await create_player_profile(session, test_user_2)
        char2 = await create_player_character(session, profile2, name="Other", is_main=True)
        third = await create_user(session, discord_username="third")
        bare = await create_player_profile(session, third)
        await seed(session, profile, item, character=main, ownership="have")
        await seed(session, profile, item2, character=alt, ownership="missing")
        await seed(session, profile2, item, character=char2, ownership="have")
        await seed(session, bare, item, ownership="have")
        targets = [
            target_of(test_user, profile, main, step="card"),
            target_of(test_user, profile, alt, step="card"),
            target_of(test_user_2, profile2, char2, step="main"),
            target_of(third, bare),
            RecordTarget("ghost", None, None, None, "none"),
        ]

        def is_select(sql: str) -> bool:
            return sql.lstrip().upper().startswith("SELECT")

        with count_statements(engine, match=is_select) as counts:
            loaded = await load_records(session, targets, [item.id, item2.id])

        assert counts.n == 1
        assert set(loaded[targets[0]]) == {item.id}
        assert loaded[targets[1]][item2.id].ownership_state == "missing"
        assert loaded[targets[2]][item.id].character_id == char2.id
        assert loaded[targets[3]][item.id].character_id is None
        assert loaded[targets[4]] == {}

    async def test_a_main_with_only_a_profile_level_row_gets_that_row(
        self, session, test_user, world
    ):
        profile, main, _, item = world
        profile_row = await seed(session, profile, item, ownership="have")

        loaded = await load_records(
            session, [target_of(test_user, profile, main, step="main")], [item.id]
        )

        assert loaded[target_of(test_user, profile, main, step="main")][item.id] is profile_row

    async def test_an_alt_with_only_a_profile_level_row_gets_nothing(
        self, session, test_user, world
    ):
        profile, _, alt, item = world
        await seed(session, profile, item, ownership="have")

        loaded = await load_records(
            session, [target_of(test_user, profile, alt, step="card")], [item.id]
        )

        assert loaded[target_of(test_user, profile, alt, step="card")] == {}

    async def test_a_mains_own_row_beats_the_profile_level_row(self, session, test_user, world):
        profile, main, _, item = world
        await seed(session, profile, item, ownership="have")
        own = await seed(session, profile, item, character=main, ownership="missing")
        target = target_of(test_user, profile, main, step="main")

        loaded = await load_records(session, [target], [item.id])

        assert loaded[target][item.id] is own

    async def test_nothing_asked_is_no_select(
        self, session, engine, test_user, world, count_statements
    ):
        profile, main, _, item = world

        with count_statements(engine) as counts:
            assert await load_records(session, [], [item.id]) == {}
            empty = await load_records(session, [target_of(test_user, profile, main)], [])

        assert counts.n == 0
        assert list(empty.values()) == [{}]


async def rows_by_item(session, profile) -> dict[str, list[PlayerCollectionSnapshot]]:
    result = await session.execute(
        select(PlayerCollectionSnapshot)
        .where(PlayerCollectionSnapshot.profile_id == profile.id)
        .execution_options(populate_existing=True)
    )
    by_item: dict[str, list[PlayerCollectionSnapshot]] = {}
    for row in result.scalars():
        by_item.setdefault(row.catalog_item_id, []).append(row)
    return by_item


def test_the_read_modify_helper_carries_its_mutating_name():
    """M6: the helper adopts a row as well as finding one, and B3's guard names it."""
    from app.services import collection_records

    assert callable(collection_records._find_or_adopt_record)
    assert not hasattr(collection_records, "_find_record")


class TestAdoptProfileRows:
    async def test_every_profile_level_row_takes_the_character(self, session, test_user):
        profile = await create_player_profile(session, test_user)
        first = await create_player_character(session, profile, name="First", is_main=True)
        a = await create_catalog_item(session, name="A")
        b = await create_catalog_item(session, name="B")
        await seed(session, profile, a, ownership="have")
        await seed(session, profile, b, ownership="missing")

        adopted = await adopt_profile_rows(session, profile_id=profile.id, character_id=first.id)

        assert adopted == 2
        by_item = await rows_by_item(session, profile)
        assert [r.character_id for r in by_item[a.id]] == [first.id]
        assert [r.character_id for r in by_item[b.id]] == [first.id]

    async def test_another_profiles_rows_are_left_alone(self, session, test_user, test_user_2):
        mine = await create_player_profile(session, test_user)
        theirs = await create_player_profile(session, test_user_2)
        first = await create_player_character(session, mine, name="First", is_main=True)
        item = await create_catalog_item(session, name="A")
        other = await seed(session, theirs, item, ownership="have")

        assert await adopt_profile_rows(session, profile_id=mine.id, character_id=first.id) == 0
        assert other.character_id is None

    async def test_an_item_the_character_already_holds_is_skipped_not_collided(
        self, session, test_user
    ):
        profile = await create_player_profile(session, test_user)
        first = await create_player_character(session, profile, name="First", is_main=True)
        item = await create_catalog_item(session, name="A")
        own = await seed(session, profile, item, character=first, ownership="have")
        stray = await seed(session, profile, item, ownership="missing")

        adopted = await adopt_profile_rows(session, profile_id=profile.id, character_id=first.id)

        assert adopted == 0
        assert own.character_id == first.id
        assert stray.character_id is None


class TestReleaseLastCharacterRows:
    async def test_the_characters_rows_become_profile_level(self, session, test_user):
        profile = await create_player_profile(session, test_user)
        last = await create_player_character(session, profile, name="Last", is_main=True)
        a = await create_catalog_item(session, name="A")
        b = await create_catalog_item(session, name="B")
        await seed(session, profile, a, character=last, ownership="have")
        await seed(session, profile, b, character=last, ownership="missing")

        released = await release_last_character_rows(
            session, profile_id=profile.id, character_id=last.id
        )

        assert released == 2
        by_item = await rows_by_item(session, profile)
        assert [r.character_id for r in by_item[a.id]] == [None]
        assert [r.character_id for r in by_item[b.id]] == [None]

    async def test_a_stray_profile_level_row_is_deleted_and_the_characters_wins(
        self, session, test_user
    ):
        profile = await create_player_profile(session, test_user)
        last = await create_player_character(session, profile, name="Last", is_main=True)
        item = await create_catalog_item(session, name="A")
        await seed(session, profile, item, character=last, ownership="have")
        await seed(session, profile, item, ownership="missing")

        await release_last_character_rows(session, profile_id=profile.id, character_id=last.id)
        await session.commit()  # the partial index would refuse a second profile-level row

        rows = (await rows_by_item(session, profile))[item.id]
        assert len(rows) == 1
        assert rows[0].character_id is None
        assert rows[0].ownership_state == "have"


class TestDeleteCharacterRecords:
    async def test_only_that_characters_rows_go(self, session, test_user, world):
        profile, main, alt, item = world
        other = await create_catalog_item(session, name="Mount B")
        await seed(session, profile, item, character=alt, ownership="have")
        await seed(session, profile, other, character=alt, ownership="have")
        kept_main = await seed(session, profile, item, character=main, ownership="missing")
        kept_profile = await seed(session, profile, other, ownership="have")

        deleted = await delete_character_records(session, character_id=alt.id)

        assert deleted == 2
        by_item = await rows_by_item(session, profile)
        survivors = {row.id for rows in by_item.values() for row in rows}
        assert survivors == {kept_main.id, kept_profile.id}

    async def test_a_character_with_no_rows_deletes_nothing(self, session, test_user, world):
        _, _, alt, _ = world

        assert await delete_character_records(session, character_id=alt.id) == 0
