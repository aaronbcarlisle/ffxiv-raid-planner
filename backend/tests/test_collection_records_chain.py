"""S2a-1a·1 A2: the record chain (R-S1-5).

`resolve_record_targets` picks, for (static, user) pairs, the character whose
collection record the member's farm rows read: the card's character (step 1),
else the profile's main (2), else the profile-level row (3), else nothing.
"""

from datetime import datetime, timedelta, timezone

from app.models import PlayerCharacter
from app.services.collection_records import (
    RecordTarget,
    main_character,
    resolve_main_targets,
    resolve_record_targets,
)
from tests.factories import (
    create_player_character,
    create_player_profile,
    create_snapshot_player,
    create_static_character_registration,
    create_static_group,
    create_tier_snapshot,
)

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def ts(minutes: int) -> str:
    """A fixed, strictly ordered created_at (the Windows clock ties otherwise)."""
    return (BASE + timedelta(minutes=minutes)).isoformat()


async def make_char(session, profile, name, *, server="Tonberry", is_main=False, minutes=0):
    char = await create_player_character(
        session, profile, name=name, server=server, is_main=is_main
    )
    char.created_at = ts(minutes)
    await session.flush()
    return char


async def claim(session, tier, user, name="Card"):
    player = await create_snapshot_player(session, tier, name=name)
    player.user_id = user.id
    await session.flush()
    return player


async def register(session, group, player, minutes, **kwargs):
    reg = await create_static_character_registration(session, group, player, **kwargs)
    reg.created_at = ts(minutes)
    await session.flush()
    return reg


async def target_for(session, group, user) -> RecordTarget:
    result = await resolve_record_targets(session, [(group.id, user.id)])
    return result[(group.id, user.id)]


class TestMainCharacter:
    def test_empty_is_none(self):
        assert main_character([]) is None

    def test_is_main_beats_age(self):
        old = PlayerCharacter(id="a", is_main=False, created_at=ts(0))
        flagged = PlayerCharacter(id="b", is_main=True, created_at=ts(9))
        assert main_character([old, flagged]) is flagged

    def test_no_is_main_takes_the_oldest(self):
        newer = PlayerCharacter(id="a", is_main=False, created_at=ts(5))
        older = PlayerCharacter(id="b", is_main=False, created_at=ts(1))
        assert main_character([newer, older]) is older

    def test_all_false_and_created_at_tie_lowest_id_wins(self):
        high = PlayerCharacter(id="zzz", is_main=False, created_at=ts(3))
        low = PlayerCharacter(id="aaa", is_main=False, created_at=ts(3))
        assert main_character([high, low]) is low
        assert main_character([low, high]) is low

    def test_created_at_compares_as_stored_text(self):
        # "...:05+00:00" sorts before "...:10+00:00" as text and as time; a text
        # compare of differently formatted values is what the migration does.
        a = PlayerCharacter(id="a", is_main=False, created_at="2026-02-01T00:00:00+00:00")
        b = PlayerCharacter(id="b", is_main=False, created_at="2026-01-31T23:59:59+00:00")
        assert main_character([a, b]) is b


class TestStepOneCard:
    async def test_primary_linked_registration_gives_that_character(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        alt = await make_char(session, profile, "Alt", minutes=1)
        card = await claim(session, test_tier, test_user)
        await register(session, test_group, card, 1, player_character=main)
        await register(
            session, test_group, card, 2, player_character=alt, is_primary_for_static=True
        )

        target = await target_for(session, test_group, test_user)

        assert target == RecordTarget(test_user.id, profile.id, alt.id, "Alt", "card")

    async def test_no_primary_takes_the_oldest_that_resolves(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Main", is_main=True, minutes=0)
        newer = await make_char(session, profile, "Newer", minutes=1)
        older = await make_char(session, profile, "Older", minutes=2)
        card = await claim(session, test_tier, test_user)
        await register(session, test_group, card, 5, player_character=newer)
        await register(session, test_group, card, 3, player_character=older)

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (older.id, "card")

    async def test_foreign_linked_character_is_skipped(
        self, session, test_user, test_user_2, test_group, test_tier
    ):
        # After a reclaim the registration still points at the previous
        # claimant's character: it must not win, even as the primary.
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Mine", is_main=True, minutes=0)
        other_profile = await create_player_profile(session, test_user_2)
        foreign = await make_char(session, other_profile, "Foreign", is_main=True, minutes=0)
        card = await claim(session, test_tier, test_user)
        await register(
            session, test_group, card, 1, player_character=foreign, is_primary_for_static=True
        )
        later = await make_char(session, profile, "Later", minutes=4)
        await register(session, test_group, card, 2, player_character=later)

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (later.id, "card")
        assert target.character_id != foreign.id

    async def test_only_a_foreign_character_falls_to_the_main(
        self, session, test_user, test_user_2, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        mine = await make_char(session, profile, "Mine", is_main=True, minutes=0)
        other_profile = await create_player_profile(session, test_user_2)
        foreign = await make_char(session, other_profile, "Foreign", is_main=True, minutes=0)
        card = await claim(session, test_tier, test_user)
        await register(
            session, test_group, card, 1, player_character=foreign, is_primary_for_static=True
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (mine.id, "main")

    async def test_manual_registration_matches_by_name_and_world_ignoring_case(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Main", is_main=True, minutes=0)
        wanted = await make_char(session, profile, "Alt Name", server="Moogle", minutes=1)
        await make_char(session, profile, "Alt Name", server="Tonberry", minutes=2)
        card = await claim(session, test_tier, test_user)
        await register(
            session,
            test_group,
            card,
            1,
            manual_character_name="  aLT nAME ",
            manual_world="MOOGLE ",
            is_primary_for_static=True,
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.character_name, target.step) == (
            wanted.id,
            "Alt Name",
            "card",
        )

    async def test_manual_registration_matching_two_characters_is_skipped(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        await make_char(session, profile, "Twin", minutes=1)
        await make_char(session, profile, "twin", minutes=2)
        card = await claim(session, test_tier, test_user)
        await register(
            session,
            test_group,
            card,
            1,
            manual_character_name="Twin",
            manual_world="Tonberry",
            is_primary_for_static=True,
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (main.id, "main")

    async def test_manual_registration_matching_none_is_skipped(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        card = await claim(session, test_tier, test_user)
        await register(
            session, test_group, card, 1, manual_character_name="Nobody", manual_world="Tonberry"
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (main.id, "main")

    async def test_registration_in_another_static_is_ignored(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        elsewhere = await make_char(session, profile, "Elsewhere", minutes=1)
        card = await claim(session, test_tier, test_user)
        other_group = await create_static_group(session, owner=test_user, name="Other")
        await register(
            session, other_group, card, 1, player_character=elsewhere, is_primary_for_static=True
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (main.id, "main")

    async def test_card_in_a_non_active_tier_falls_to_the_main(
        self, session, test_user, test_group
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        other = await make_char(session, profile, "Other", minutes=1)
        old_tier = await create_tier_snapshot(session, test_group, is_active=False)
        card = await claim(session, old_tier, test_user)
        await register(
            session, test_group, card, 1, player_character=other, is_primary_for_static=True
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (main.id, "main")

    async def test_several_active_tiers_use_the_newest(
        self, session, test_user, test_group
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Main", is_main=True, minutes=0)
        old_char = await make_char(session, profile, "OldCard", minutes=1)
        new_char = await make_char(session, profile, "NewCard", minutes=2)
        old_tier = await create_tier_snapshot(session, test_group, tier_id="old", is_active=True)
        old_tier.created_at = ts(10)
        new_tier = await create_tier_snapshot(session, test_group, tier_id="new", is_active=True)
        new_tier.created_at = ts(20)
        await session.flush()
        old_card = await claim(session, old_tier, test_user, name="Old")
        new_card = await claim(session, new_tier, test_user, name="New")
        await register(session, test_group, old_card, 1, player_character=old_char)
        await register(session, test_group, new_card, 2, player_character=new_char)

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (new_char.id, "card")

    async def test_unclaimed_card_is_not_the_users(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        other = await make_char(session, profile, "Other", minutes=1)
        card = await create_snapshot_player(session, test_tier, name="Unclaimed")
        await register(
            session, test_group, card, 1, player_character=other, is_primary_for_static=True
        )

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (main.id, "main")


class TestStepTwoMain:
    async def test_not_on_the_roster_takes_the_main(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Older", minutes=0)
        main = await make_char(session, profile, "Main", is_main=True, minutes=5)

        target = await target_for(session, test_group, test_user)

        assert target == RecordTarget(test_user.id, profile.id, main.id, "Main", "main")

    async def test_no_is_main_takes_the_oldest(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Newer", minutes=5)
        oldest = await make_char(session, profile, "Oldest", minutes=1)
        await make_char(session, profile, "Middle", minutes=3)

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (oldest.id, "main")

    async def test_cleared_main_takes_the_oldest(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        was_main = await make_char(session, profile, "WasMain", is_main=True, minutes=4)
        oldest = await make_char(session, profile, "Oldest", minutes=1)
        was_main.is_main = False
        await session.flush()

        target = await target_for(session, test_group, test_user)

        assert (target.character_id, target.step) == (oldest.id, "main")


class TestStepsThreeAndNone:
    async def test_profile_without_a_character_is_profile_level(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)

        target = await target_for(session, test_group, test_user)

        assert target == RecordTarget(test_user.id, profile.id, None, None, "profile")

    async def test_no_profile_is_none(self, session, test_user, test_group, test_tier):
        target = await target_for(session, test_group, test_user)

        assert target == RecordTarget(test_user.id, None, None, None, "none")

    async def test_empty_pairs(self, session):
        assert await resolve_record_targets(session, []) == {}


class TestResolveMainTargets:
    async def test_main_profile_and_none_in_one_call(
        self, session, test_user, test_user_2, test_user_3
    ):
        profile = await create_player_profile(session, test_user)
        await make_char(session, profile, "Second", minutes=3)
        main = await make_char(session, profile, "Main", is_main=True, minutes=9)
        bare = await create_player_profile(session, test_user_2)

        result = await resolve_main_targets(
            session, [test_user.id, test_user_2.id, test_user_3.id]
        )

        assert result == {
            test_user.id: RecordTarget(test_user.id, profile.id, main.id, "Main", "main"),
            test_user_2.id: RecordTarget(test_user_2.id, bare.id, None, None, "profile"),
            test_user_3.id: RecordTarget(test_user_3.id, None, None, None, "none"),
        }

    async def test_ignores_a_card_even_when_one_exists(
        self, session, test_user, test_group, test_tier
    ):
        profile = await create_player_profile(session, test_user)
        main = await make_char(session, profile, "Main", is_main=True, minutes=0)
        other = await make_char(session, profile, "Other", minutes=1)
        card = await claim(session, test_tier, test_user)
        await register(
            session, test_group, card, 1, player_character=other, is_primary_for_static=True
        )

        result = await resolve_main_targets(session, [test_user.id])

        assert result[test_user.id].character_id == main.id

    async def test_empty(self, session):
        assert await resolve_main_targets(session, []) == {}


class TestBudget:
    async def test_select_count_is_fixed_whatever_the_pair_count(
        self, session, engine, test_user, test_user_2, test_user_3, test_group, test_tier,
        count_statements,
    ):
        def is_select(sql: str) -> bool:
            return sql.lstrip().upper().startswith("SELECT")

        second_group = await create_static_group(session, owner=test_user, name="Second")
        second_tier = await create_tier_snapshot(session, second_group)
        pairs = []
        for index, user in enumerate([test_user, test_user_2, test_user_3]):
            profile = await create_player_profile(session, user)
            await make_char(session, profile, f"Main{index}", is_main=True, minutes=0)
            alt = await make_char(session, profile, f"Alt{index}", minutes=1)
            for group, tier in ((test_group, test_tier), (second_group, second_tier)):
                card = await claim(session, tier, user, name=f"Card{index}")
                await register(
                    session, group, card, 1, player_character=alt, is_primary_for_static=True
                )
                pairs.append((group.id, user.id))
        await session.flush()
        assert len(pairs) == 6

        with count_statements(engine, match=is_select) as one:
            await resolve_record_targets(session, pairs[:1])
        with count_statements(engine, match=is_select) as six:
            result = await resolve_record_targets(session, pairs)

        assert len(result) == 6
        assert {t.step for t in result.values()} == {"card"}
        assert 1 <= one.n <= 5
        assert six.n == one.n
