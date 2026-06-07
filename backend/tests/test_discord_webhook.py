"""Unit tests for Discord webhook payload builders.

These tests cover only the pure-function payload builders — no HTTP calls,
no database, no Discord API keys.  All assertions are against the produced
dict structure so they remain fast and side-effect-free.
"""

from datetime import datetime, timezone

import pytest

from app.services.discord_webhook import (
    PlayerDetail,
    SessionAnnouncementData,
    _format_duration,
    _format_rsvp_summary,
    _format_subs_needed_detail,
    build_session_announcement_payload,
    build_schedule_session_url,
    build_test_reminder_payload,
    compute_announcement_hash,
    compute_subs_needed,
    job_category,
)


# ── Helper ───────────────────────────────────────────────────────────────────


def _make_data(**overrides) -> SessionAnnouncementData:
    defaults = dict(
        session_title="Raid Night",
        start_iso="2025-06-15T20:00:00+00:00",
        end_iso="2025-06-15T23:00:00+00:00",
        static_group_name="Static Alpha",
        session_url="https://example.com/group/ABCD?tab=schedule",
        rsvp_counts={"available": 6, "tentative": 1, "unavailable": 1},
        total_member_count=8,
        unavailable_players=[],
        tentative_players=[],
    )
    defaults.update(overrides)
    return SessionAnnouncementData(**defaults)


# ── Duration formatter ────────────────────────────────────────────────────────


def test_format_duration_hours_and_minutes():
    start = datetime(2025, 6, 15, 20, 0, tzinfo=timezone.utc)
    end = datetime(2025, 6, 15, 22, 30, tzinfo=timezone.utc)
    assert _format_duration(start, end) == "2h 30m"


def test_format_duration_exact_hours():
    start = datetime(2025, 6, 15, 20, 0, tzinfo=timezone.utc)
    end = datetime(2025, 6, 15, 23, 0, tzinfo=timezone.utc)
    assert _format_duration(start, end) == "3h"


def test_format_duration_minutes_only():
    start = datetime(2025, 6, 15, 20, 0, tzinfo=timezone.utc)
    end = datetime(2025, 6, 15, 20, 45, tzinfo=timezone.utc)
    assert _format_duration(start, end) == "45m"


def test_format_duration_zero_when_end_before_start():
    start = datetime(2025, 6, 15, 23, 0, tzinfo=timezone.utc)
    end = datetime(2025, 6, 15, 20, 0, tzinfo=timezone.utc)
    assert _format_duration(start, end) == "0m"


# ── RSVP summary formatter ────────────────────────────────────────────────────


def test_format_rsvp_summary_includes_all_statuses():
    summary = _format_rsvp_summary(
        {"available": 5, "tentative": 2, "unavailable": 1}, total_member_count=8
    )
    assert "✅" in summary
    assert "🟡" in summary
    assert "❌" in summary
    assert "⬜" in summary


def test_format_rsvp_summary_no_response_derived_from_total():
    summary = _format_rsvp_summary(
        {"available": 6, "tentative": 1, "unavailable": 1}, total_member_count=8
    )
    # responded = 8, so no_response = 0
    assert "⬜ 0" in summary


def test_format_rsvp_summary_partial_responses():
    summary = _format_rsvp_summary(
        {"available": 4}, total_member_count=8
    )
    # 4 responded, 4 no_response
    assert "⬜ 4" in summary


# ── compute_subs_needed ───────────────────────────────────────────────────────


def test_compute_subs_needed_when_full():
    assert compute_subs_needed({"available": 8}, 8) == 0


def test_compute_subs_needed_when_short():
    assert compute_subs_needed({"available": 5, "tentative": 2}, 8) == 3


def test_compute_subs_needed_empty_rsvps():
    assert compute_subs_needed({}, 8) == 8


def test_compute_subs_needed_zero_member_count():
    assert compute_subs_needed({"available": 5}, 0) == 0


# ── build_session_announcement_payload ───────────────────────────────────────


def test_payload_structure_has_embeds_and_content():
    data = _make_data()
    payload = build_session_announcement_payload(data)
    assert "embeds" in payload
    assert len(payload["embeds"]) == 1
    assert "content" in payload


def test_payload_title_matches_session_title():
    data = _make_data(session_title="P12S Prog Night")
    payload = build_session_announcement_payload(data)
    assert payload["embeds"][0]["title"] == "P12S Prog Night"


def test_payload_embed_url_matches_session_url():
    data = _make_data(session_url="https://example.com/group/XYZ?tab=schedule")
    payload = build_session_announcement_payload(data)
    assert payload["embeds"][0]["url"] == "https://example.com/group/XYZ?tab=schedule"


def test_payload_footer_is_group_name():
    data = _make_data(static_group_name="The Night Owls")
    payload = build_session_announcement_payload(data)
    assert payload["embeds"][0]["footer"]["text"] == "The Night Owls"


def test_payload_includes_discord_timestamps():
    data = _make_data(start_iso="2025-06-15T20:00:00+00:00")
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    when_field = next(f for f in fields if f["name"] == "When")
    # Expect both absolute and relative Discord timestamp formats
    assert "<t:" in when_field["value"]
    assert ":F>" in when_field["value"]
    assert ":R>" in when_field["value"]


def test_payload_includes_duration_field():
    data = _make_data(
        start_iso="2025-06-15T20:00:00+00:00",
        end_iso="2025-06-15T23:00:00+00:00",
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    duration_field = next((f for f in fields if f["name"] == "Duration"), None)
    assert duration_field is not None
    assert duration_field["value"] == "3h"


def test_payload_includes_rsvp_field():
    data = _make_data()
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    rsvp_field = next((f for f in fields if f["name"] == "RSVP"), None)
    assert rsvp_field is not None
    assert "✅" in rsvp_field["value"]


def test_payload_shows_subs_needed_when_party_short():
    data = _make_data(
        rsvp_counts={"available": 5, "tentative": 1, "unavailable": 1},
        total_member_count=8,
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    sub_field = next((f for f in fields if "Subs needed" in f["name"]), None)
    assert sub_field is not None
    assert "3" in sub_field["value"]


def test_payload_no_subs_needed_field_when_full():
    data = _make_data(
        rsvp_counts={"available": 8},
        total_member_count=8,
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    sub_field = next((f for f in fields if "Subs needed" in f["name"]), None)
    assert sub_field is None


def test_payload_subs_needed_singular_slot_word():
    data = _make_data(
        rsvp_counts={"available": 7},
        total_member_count=8,
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    sub_field = next(f for f in fields if "Subs needed" in f["name"])
    assert "slot" in sub_field["value"]
    assert "slots" not in sub_field["value"]


def test_payload_planner_link_in_content():
    url = "https://example.com/group/ABCD?tab=schedule"
    data = _make_data(session_url=url)
    payload = build_session_announcement_payload(data)
    assert url in payload["content"]


def test_payload_defaults_to_no_allowed_mentions():
    data = _make_data(
        session_title="@everyone Raid Night",
        session_description="<@&123456789012345678> should not ping",
    )
    payload = build_session_announcement_payload(data)
    assert payload["allowed_mentions"] == {"parse": []}


def test_payload_here_ping_allows_only_everyone_parse():
    data = _make_data(mention_target="here")
    payload = build_session_announcement_payload(data)
    assert payload["content"].startswith("@here\n")
    assert payload["allowed_mentions"] == {"parse": ["everyone"]}


def test_payload_role_ping_allows_only_configured_role():
    data = _make_data(mention_target="role", mention_role_id="123456789012345678")
    payload = build_session_announcement_payload(data)
    assert payload["content"].startswith("<@&123456789012345678>\n")
    assert payload["allowed_mentions"] == {
        "parse": [],
        "roles": ["123456789012345678"],
    }


def test_schedule_session_url_uses_public_base_and_session_id():
    url = build_schedule_session_url(
        "https://www.xivraidplanner.app/",
        "E1FPZK",
        "session-123",
    )
    assert url == "https://www.xivraidplanner.app/group/E1FPZK?tab=schedule&sessionId=session-123"
    assert "localhost" not in url


def test_payload_description_included_and_truncated():
    long_desc = "A" * 2000
    data = _make_data(session_description=long_desc)
    payload = build_session_announcement_payload(data)
    assert "description" in payload["embeds"][0]
    assert len(payload["embeds"][0]["description"]) <= 1024


def test_payload_no_description_field_when_none():
    data = _make_data(session_description=None)
    payload = build_session_announcement_payload(data)
    assert "description" not in payload["embeds"][0]


def test_payload_no_duration_field_when_end_before_start():
    data = _make_data(
        start_iso="2025-06-15T23:00:00+00:00",
        end_iso="2025-06-15T20:00:00+00:00",
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    assert not any(f["name"] == "Duration" for f in fields)


def test_payload_no_when_field_on_invalid_iso():
    data = _make_data(start_iso="not-a-date", end_iso="also-bad")
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    assert not any(f["name"] == "When" for f in fields)


# ── build_test_reminder_payload ───────────────────────────────────────────────


def test_test_reminder_payload_uses_rich_embed_format():
    payload = build_test_reminder_payload(
        static_group_name="Static Alpha",
        planner_url="https://example.com",
        share_code="ABCD",
    )
    assert "embeds" in payload
    assert len(payload["embeds"]) == 1
    embed = payload["embeds"][0]
    assert "Static Alpha" in embed["title"]
    assert "Test" in embed["title"]
    assert "fields" in embed


def test_test_reminder_payload_session_url_contains_share_code():
    payload = build_test_reminder_payload(
        static_group_name="Test Static",
        planner_url="https://planner.example.com",
        share_code="XYZ99",
    )
    assert "XYZ99" in payload["content"]


def test_test_reminder_payload_can_ping_role_safely():
    payload = build_test_reminder_payload(
        static_group_name="Test Static",
        planner_url="https://planner.example.com",
        share_code="XYZ99",
        mention_target="role",
        mention_role_id="123456789012345678",
    )
    assert payload["content"].startswith("<@&123456789012345678>\n")
    assert payload["allowed_mentions"] == {
        "parse": [],
        "roles": ["123456789012345678"],
    }


def test_test_reminder_payload_does_not_contain_webhook_secrets():
    """Payload must not embed any token-like strings.

    build_test_reminder_payload receives no token parameters, so this is a
    canary test to confirm no credential is accidentally threaded through.
    """
    payload = build_test_reminder_payload(
        static_group_name="Secure Static",
        planner_url="https://planner.example.com",
        share_code="SECRET_FREE",
    )
    payload_str = str(payload)
    # A Discord webhook token looks like a long alphanumeric string after the
    # numeric channel ID in the URL.  None of the bearer-style tokens we use
    # should appear here.
    assert "Bearer" not in payload_str
    assert "discord.com/api/webhooks" not in payload_str


# ── job_category ─────────────────────────────────────────────────────────────


def test_job_category_tank():
    assert job_category("PLD") == "Tank"
    assert job_category("WAR") == "Tank"
    assert job_category("DRK") == "Tank"
    assert job_category("GNB") == "Tank"


def test_job_category_healers():
    assert job_category("WHM") == "Pure Healer"
    assert job_category("AST") == "Pure Healer"
    assert job_category("SCH") == "Shield Healer"
    assert job_category("SGE") == "Shield Healer"


def test_job_category_dps():
    assert job_category("MNK") == "Melee"
    assert job_category("DRG") == "Melee"
    assert job_category("NIN") == "Melee"
    assert job_category("SAM") == "Melee"
    assert job_category("RPR") == "Melee"
    assert job_category("VPR") == "Melee"
    assert job_category("BRD") == "Physical Ranged"
    assert job_category("MCH") == "Physical Ranged"
    assert job_category("DNC") == "Physical Ranged"
    assert job_category("BLM") == "Caster"
    assert job_category("SMN") == "Caster"
    assert job_category("RDM") == "Caster"
    assert job_category("PCT") == "Caster"


def test_job_category_unknown():
    assert job_category("BLU") is None
    assert job_category("") is None
    assert job_category(None) is None


def test_job_category_case_insensitive():
    assert job_category("brd") == "Physical Ranged"
    assert job_category("Whm") == "Pure Healer"


# ── PlayerDetail.format_line ──────────────────────────────────────────────────


def test_player_detail_full():
    p = PlayerDetail(name="Color", position="R2", job="BRD")
    assert p.format_line() == "• Color — R2 / BRD (Physical Ranged)"


def test_player_detail_position_only():
    p = PlayerDetail(name="Color", position="R2", job=None)
    assert p.format_line() == "• Color — R2"


def test_player_detail_job_only():
    p = PlayerDetail(name="Color", position=None, job="BRD")
    assert p.format_line() == "• Color — BRD (Physical Ranged)"


def test_player_detail_name_only():
    p = PlayerDetail(name="Color", position=None, job=None)
    assert p.format_line() == "• Color"


def test_player_detail_unknown_job():
    p = PlayerDetail(name="Color", position="R2", job="BLU")
    assert p.format_line() == "• Color — R2 / BLU"


# ── _format_subs_needed_detail ────────────────────────────────────────────────


def test_subs_detail_with_known_roles():
    players = [
        PlayerDetail(name="Color", position="R2", job="BRD"),
        PlayerDetail(name="Aki", position="H1", job="WHM"),
    ]
    result = _format_subs_needed_detail(players, 2)
    assert "R2 / Physical Ranged" in result
    assert "H1 / Pure Healer" in result


def test_subs_detail_position_only():
    players = [PlayerDetail(name="X", position="M1", job=None)]
    result = _format_subs_needed_detail(players, 1)
    assert "M1" in result


def test_subs_detail_no_players_falls_back_to_count():
    result = _format_subs_needed_detail([], 3)
    assert "3 slots short" == result


def test_subs_detail_no_position_or_job_falls_back():
    players = [PlayerDetail(name="X", position=None, job=None)]
    result = _format_subs_needed_detail(players, 1)
    assert "1 slot short" == result


# ── Payload with player lists ────────────────────────────────────────────────


def test_payload_includes_cannot_make_it_list():
    data = _make_data(
        rsvp_counts={"available": 6, "unavailable": 2},
        total_member_count=8,
        unavailable_players=[
            PlayerDetail(name="Color", position="R2", job="BRD"),
            PlayerDetail(name="Riri", position="H1", job="WHM"),
        ],
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    field = next((f for f in fields if "Cannot make it" in f["name"]), None)
    assert field is not None
    assert "Color" in field["value"]
    assert "R2" in field["value"]
    assert "BRD" in field["value"]
    assert "Physical Ranged" in field["value"]
    assert "Riri" in field["value"]


def test_payload_includes_tentative_list():
    data = _make_data(
        rsvp_counts={"available": 6, "tentative": 1, "unavailable": 1},
        total_member_count=8,
        tentative_players=[
            PlayerDetail(name="Aki", position="M1", job="MNK"),
        ],
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    field = next((f for f in fields if "Tentative" in f["name"]), None)
    assert field is not None
    assert "Aki" in field["value"]
    assert "M1" in field["value"]
    assert "MNK" in field["value"]


def test_payload_no_cannot_make_it_when_empty():
    data = _make_data(
        rsvp_counts={"available": 8},
        total_member_count=8,
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    assert not any("Cannot make it" in f["name"] for f in fields)


def test_payload_subs_needed_shows_role_detail():
    data = _make_data(
        rsvp_counts={"available": 6, "unavailable": 2},
        total_member_count=8,
        unavailable_players=[
            PlayerDetail(name="Color", position="R2", job="BRD"),
            PlayerDetail(name="Riri", position="H1", job="WHM"),
        ],
    )
    payload = build_session_announcement_payload(data)
    fields = payload["embeds"][0]["fields"]
    sub_field = next(f for f in fields if "Subs needed" in f["name"])
    assert "R2 / Physical Ranged" in sub_field["value"]
    assert "H1 / Pure Healer" in sub_field["value"]


# ── compute_announcement_hash ────────────────────────────────────────────────


def test_announcement_hash_deterministic():
    data = _make_data()
    assert compute_announcement_hash(data) == compute_announcement_hash(data)


def test_announcement_hash_changes_on_rsvp_change():
    data_a = _make_data(rsvp_counts={"available": 6})
    data_b = _make_data(rsvp_counts={"available": 7})
    assert compute_announcement_hash(data_a) != compute_announcement_hash(data_b)


def test_announcement_hash_changes_on_title_change():
    data_a = _make_data(session_title="Reclear")
    data_b = _make_data(session_title="Prog Night")
    assert compute_announcement_hash(data_a) != compute_announcement_hash(data_b)


def test_announcement_hash_changes_on_player_list_change():
    data_a = _make_data(unavailable_players=[PlayerDetail(name="A", position="R2", job="BRD")])
    data_b = _make_data(unavailable_players=[PlayerDetail(name="B", position="H1", job="WHM")])
    assert compute_announcement_hash(data_a) != compute_announcement_hash(data_b)
