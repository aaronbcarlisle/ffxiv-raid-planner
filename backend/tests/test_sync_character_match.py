"""The sync's character match rule (S2a-1b·1 Task E1, R-S1-17): pure, no DB."""

import pytest

from app.models import PlayerCharacter
from app.services.collection_records import match_sync_character


def _char(char_id: str, name: str, server: str) -> PlayerCharacter:
    return PlayerCharacter(id=char_id, profile_id="p1", name=name, server=server)


ALPHA_BALMUNG = _char("c-1", "Alpha Tester", "Balmung")
ALPHA_GOBLIN = _char("c-2", "Alpha Tester", "Goblin")
BETA = _char("c-3", "Beta Tester", "Balmung")


def test_one_match_by_name() -> None:
    assert match_sync_character([ALPHA_BALMUNG, BETA], "Alpha Tester", None) == (
        ALPHA_BALMUNG,
        "matched",
    )


def test_no_match_is_unmatched() -> None:
    assert match_sync_character([ALPHA_BALMUNG, BETA], "Gamma Tester", None) == (None, "unmatched")


def test_no_characters_is_unmatched() -> None:
    assert match_sync_character([], "Alpha Tester", "Balmung") == (None, "unmatched")


def test_same_name_without_world_is_ambiguous() -> None:
    assert match_sync_character([ALPHA_BALMUNG, ALPHA_GOBLIN], "Alpha Tester", None) == (
        None,
        "ambiguous",
    )


@pytest.mark.parametrize("world", ["", "   "])
def test_empty_world_does_not_narrow(world: str) -> None:
    assert match_sync_character([ALPHA_BALMUNG, ALPHA_GOBLIN], "Alpha Tester", world) == (
        None,
        "ambiguous",
    )
    assert match_sync_character([ALPHA_BALMUNG, BETA], "Alpha Tester", world) == (
        ALPHA_BALMUNG,
        "matched",
    )


def test_world_disambiguates_same_name() -> None:
    pair = [ALPHA_BALMUNG, ALPHA_GOBLIN]
    assert match_sync_character(pair, "Alpha Tester", "Goblin") == (ALPHA_GOBLIN, "matched")
    assert match_sync_character(pair, "Alpha Tester", "Balmung") == (ALPHA_BALMUNG, "matched")


def test_world_that_narrows_to_none_is_unmatched() -> None:
    assert match_sync_character(
        [ALPHA_BALMUNG, ALPHA_GOBLIN], "Alpha Tester", "Cactuar"
    ) == (None, "unmatched")
    # A single name match is narrowed by a sent world too.
    assert match_sync_character([ALPHA_BALMUNG, BETA], "Alpha Tester", "Cactuar") == (
        None,
        "unmatched",
    )


def test_world_narrowing_to_several_stays_ambiguous() -> None:
    twin = _char("c-4", "Alpha Tester", "Balmung")
    assert match_sync_character([ALPHA_BALMUNG, twin, ALPHA_GOBLIN], "Alpha Tester", "Balmung") == (
        None,
        "ambiguous",
    )


@pytest.mark.parametrize("name", ["Unknown", "unknown", "UNKNOWN", "  Unknown  "])
def test_unknown_name_is_no_name(name: str) -> None:
    unknown_named = _char("c-5", "Unknown", "Balmung")
    assert match_sync_character([unknown_named, BETA], name, "Balmung") == (None, "unknown")


@pytest.mark.parametrize("name", [None, "", "   ", "\t"])
def test_null_name(name: str | None) -> None:
    assert match_sync_character([ALPHA_BALMUNG], name, "Balmung") == (None, "null")


def test_whitespace_and_case_differences_still_match() -> None:
    assert match_sync_character([ALPHA_BALMUNG, BETA], "  aLPHA tester ", None) == (
        ALPHA_BALMUNG,
        "matched",
    )
    assert match_sync_character([ALPHA_BALMUNG, ALPHA_GOBLIN], " ALPHA TESTER ", "  goblin ") == (
        ALPHA_GOBLIN,
        "matched",
    )
    padded = _char("c-6", "  Padded Name ", " Cactuar ")
    assert match_sync_character([padded], "padded name", "CACTUAR") == (padded, "matched")
