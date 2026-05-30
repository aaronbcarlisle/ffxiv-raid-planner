"""Unit tests for Discord webhook payload builders.

These tests cover only the pure-function payload builders — no HTTP calls,
no database, no Discord API keys.  All assertions are against the produced
dict structure so they remain fast and side-effect-free.
"""

from datetime import datetime, timezone

import pytest

from app.services.discord_webhook import (
    SessionAnnouncementData,
    _format_duration,
    _format_rsvp_summary,
    build_session_announcement_payload,
    build_test_reminder_payload,
    compute_subs_needed,
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
