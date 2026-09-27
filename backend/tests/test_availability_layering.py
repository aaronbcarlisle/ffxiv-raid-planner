"""Availability pipe, backend half (Player Hub PH3 Task 1).

Unit tests for `services/availability_layering` (pure, no session) and route
tests for `GET /static-groups/{id}/availability?include_templates=true`.
"""

import json
import logging
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import Membership, MemberRole, User
from app.models.availability import UserAvailability
from app.services.availability_layering import (
    TemplateDay,
    expand_personal_templates,
    layer_availability,
    weekday_code,
)
from tests.factories import (
    create_membership,
    create_personal_availability_template,
    create_user,
    create_user_availability,
)

LOGGER_NAME = "app.services.availability_layering"
U = "user-a"
JUNE_1 = date(2026, 6, 1)  # a Monday
JUNE_7 = date(2026, 6, 7)  # the following Sunday


def _expand(*days: TemplateDay, start: date = JUNE_1, end: date = JUNE_7):
    return expand_personal_templates(days=list(days), start=start, end=end)


def _warnings(caplog) -> list[logging.LogRecord]:
    return [
        record
        for record in caplog.records
        if record.name == LOGGER_NAME and record.levelno == logging.WARNING
    ]


# ==================== weekday_code ====================


def test_weekday_code_maps_python_weekday_to_ical_byday():
    assert weekday_code(date(2026, 6, 1)) == "MO"
    assert weekday_code(date(2026, 6, 7)) == "SU"
    assert weekday_code(date(2026, 6, 30)) == "TU"
    assert weekday_code(date(2026, 7, 1)) == "WE"


# ==================== expand_personal_templates ====================


def test_expand_utc_template_lands_on_the_matching_date():
    result = _expand(TemplateDay(U, "MO", ("20:00", "20:30"), "UTC"))
    assert result == {(U, "2026-06-01"): ["20:00", "20:30"]}


def test_expand_new_york_evening_crosses_into_the_next_utc_date():
    result = _expand(TemplateDay(U, "MO", ("20:00", "23:30"), "America/New_York"))
    assert result == {(U, "2026-06-02"): ["00:00", "03:30"]}
    assert (U, "2026-06-01") not in result


def test_expand_tokyo_morning_lands_on_the_previous_utc_date():
    result = _expand(TemplateDay(U, "TU", ("08:00",), "Asia/Tokyo"))
    assert result == {(U, "2026-06-01"): ["23:00"]}


def test_expand_drops_slots_converted_outside_the_range_tokyo():
    # Local Monday 06-08 08:00 is Sunday 06-07 23:00 UTC (inside); local
    # Monday 06-01 08:00 is 05-31 23:00 UTC (dropped).
    result = _expand(TemplateDay(U, "MO", ("08:00",), "Asia/Tokyo"))
    assert result == {(U, "2026-06-07"): ["23:00"]}


def test_expand_drops_slots_converted_outside_the_range_new_york():
    # Local Sunday 05-31 feeds the first date; local Sunday 06-07 lands on
    # 06-08 (dropped).
    result = _expand(TemplateDay(U, "SU", ("23:30",), "America/New_York"))
    assert result == {(U, "2026-06-01"): ["03:30"]}


def test_expand_london_follows_bst_and_gmt():
    summer = _expand(TemplateDay(U, "MO", ("09:00",), "Europe/London"))
    assert summer == {(U, "2026-06-01"): ["08:00"]}

    winter = _expand(
        TemplateDay(U, "MO", ("09:00",), "Europe/London"),
        start=date(2026, 1, 5),
        end=date(2026, 1, 5),
    )
    assert winter == {(U, "2026-01-05"): ["09:00"]}


def test_expand_spring_forward_gap_dedups_to_one_utc_slot():
    # 2026-03-29 01:30 does not exist in London; zoneinfo (fold=0) and JS
    # both read it as 01:30 UTC, the same as 02:30 BST.
    result = _expand(
        TemplateDay(U, "SU", ("01:30", "02:30"), "Europe/London"),
        start=date(2026, 3, 29),
        end=date(2026, 3, 29),
    )
    assert result == {(U, "2026-03-29"): ["01:30"]}


def test_expand_fall_back_hour_takes_the_first_occurrence():
    result = _expand(
        TemplateDay(U, "SU", ("01:00", "01:30"), "Europe/London"),
        start=date(2026, 10, 25),
        end=date(2026, 10, 25),
    )
    assert result == {(U, "2026-10-25"): ["00:00", "00:30"]}


def test_expand_empty_template_day_yields_nothing():
    assert _expand(TemplateDay(U, "MO", (), "UTC")) == {}


def test_expand_bad_timezone_directory_is_read_as_utc_with_one_warning(caplog):
    # ZoneInfo("America") raises PermissionError on Windows and
    # IsADirectoryError on Linux, not ZoneInfoNotFoundError.
    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        result = _expand(TemplateDay(U, "MO", ("20:00",), "America"))
    assert result == {(U, "2026-06-01"): ["20:00"]}
    warnings = _warnings(caplog)
    assert len(warnings) == 1
    assert "America" in warnings[0].getMessage()


def test_expand_bad_slots_are_skipped_with_one_warning(caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        result = _expand(
            TemplateDay(U, "MO", ("25:00", "abc", "20:00:00", "20:00"), "UTC")
        )
    assert result == {(U, "2026-06-01"): ["20:00"]}
    warnings = _warnings(caplog)
    assert len(warnings) == 1
    assert "25:00" in warnings[0].getMessage()


def test_expand_unknown_zone_is_read_as_utc_with_one_warning_per_name(caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        result = _expand(
            TemplateDay(U, "MO", ("20:00",), "Mars/Olympus"),
            TemplateDay(U, "TU", ("21:00",), "Mars/Olympus"),
        )
    assert result == {
        (U, "2026-06-01"): ["20:00"],
        (U, "2026-06-02"): ["21:00"],
    }
    warnings = _warnings(caplog)
    assert len(warnings) == 1
    assert "Mars/Olympus" in warnings[0].getMessage()


# ==================== layer_availability ====================


def _dated(
    user_id: str,
    date_str: str,
    slots: list[str],
    *,
    row_id: str = "row-1",
    username: str | None = "alice",
) -> UserAvailability:
    row = UserAvailability(
        id=row_id,
        static_group_id="static-1",
        user_id=user_id,
        date=date_str,
        slots=json.dumps(slots),
    )
    row.user = User(id=user_id, discord_username=username) if username else None
    return row


def _dump(rows):
    # CamelModel serializes by alias (userId); the unit tests speak field names.
    return [r.model_dump(by_alias=False) for r in rows]


def test_layer_dated_row_wins_over_the_template():
    result = layer_availability(
        dates=["2026-06-01"],
        members=[(U, "alice")],
        dated_rows=[_dated(U, "2026-06-01", ["20:00"], row_id="dated-1")],
        personal={(U, "2026-06-01"): ["19:00", "19:30"]},
    )
    assert _dump(result["2026-06-01"]) == [
        {
            "id": "dated-1",
            "user_id": U,
            "username": "alice",
            "date": "2026-06-01",
            "slots": ["20:00"],
            "source": "dated",
        }
    ]


def test_layer_empty_dated_row_is_emitted_and_blocks_the_template():
    result = layer_availability(
        dates=["2026-06-01"],
        members=[(U, "alice")],
        dated_rows=[_dated(U, "2026-06-01", [], row_id="dated-empty")],
        personal={(U, "2026-06-01"): ["19:00"]},
    )
    assert _dump(result["2026-06-01"]) == [
        {
            "id": "dated-empty",
            "user_id": U,
            "username": "alice",
            "date": "2026-06-01",
            "slots": [],
            "source": "dated",
        }
    ]


def test_layer_derives_a_row_from_the_template_when_no_dated_row_exists():
    result = layer_availability(
        dates=["2026-06-01"],
        members=[(U, "alice")],
        dated_rows=[],
        personal={(U, "2026-06-01"): ["19:00", "19:30"]},
    )
    assert _dump(result["2026-06-01"]) == [
        {
            "id": None,
            "user_id": U,
            "username": "alice",
            "date": "2026-06-01",
            "slots": ["19:00", "19:30"],
            "source": "personal_template",
        }
    ]


def test_layer_member_without_personal_slots_and_empty_dates_emit_nothing():
    result = layer_availability(
        dates=["2026-06-01", "2026-06-02"],
        members=[(U, "alice"), ("user-b", "bob")],
        dated_rows=[],
        personal={(U, "2026-06-01"): ["19:00"], ("user-b", "2026-06-02"): []},
    )
    assert set(result) == {"2026-06-01"}
    assert [r.user_id for r in result["2026-06-01"]] == [U]


def test_layer_dated_rows_of_a_non_member_are_kept_without_derived_rows():
    result = layer_availability(
        dates=["2026-06-01", "2026-06-02"],
        members=[],
        dated_rows=[_dated("left-user", "2026-06-01", ["20:00"], row_id="old")],
        personal={("left-user", "2026-06-02"): ["19:00"]},
    )
    assert set(result) == {"2026-06-01"}
    assert _dump(result["2026-06-01"]) == [
        {
            "id": "old",
            "user_id": "left-user",
            "username": "alice",
            "date": "2026-06-01",
            "slots": ["20:00"],
            "source": "dated",
        }
    ]


def test_layer_orders_dated_rows_first_then_members_in_members_order():
    result = layer_availability(
        dates=["2026-06-01"],
        members=[("user-b", "bob"), (U, "alice")],
        dated_rows=[
            _dated("user-c", "2026-06-01", ["20:00"], row_id="c", username="carol"),
            _dated("user-d", "2026-06-01", ["21:00"], row_id="d", username=None),
        ],
        personal={(U, "2026-06-01"): ["19:00"], ("user-b", "2026-06-01"): ["18:00"]},
    )
    rows = result["2026-06-01"]
    assert [(r.user_id, r.source, r.id) for r in rows] == [
        ("user-c", "dated", "c"),
        ("user-d", "dated", "d"),
        ("user-b", "personal_template", None),
        (U, "personal_template", None),
    ]
    assert rows[1].username is None
    assert rows[2].username == "bob"


# ==================== Route tests ====================


@pytest_asyncio.fixture
async def member_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="member_discord_id", discord_username="member")


@pytest_asyncio.fixture
async def viewer_user(session: AsyncSession) -> User:
    return await create_user(session, discord_id="viewer_discord_id", discord_username="viewer")


@pytest.fixture
def member_headers(member_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(member_user.id)}"}


@pytest.fixture
def viewer_headers(viewer_user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(viewer_user.id)}"}


def _url(group_id: str, start: str, end: str, *, include_templates: bool = False) -> str:
    url = f"/api/static-groups/{group_id}/availability?start_date={start}&end_date={end}"
    return f"{url}&include_templates=true" if include_templates else url


def _by_date(response) -> dict[str, list[dict]]:
    return {entry["date"]: entry["responses"] for entry in response.json()}


async def _set_joined_at(session: AsyncSession, group_id: str, user_id: str, value: str) -> None:
    result = await session.execute(
        select(Membership).where(
            Membership.static_group_id == group_id, Membership.user_id == user_id
        )
    )
    result.scalar_one().joined_at = value
    await session.flush()


class TestListAvailabilityFlagOff:
    async def test_returns_todays_dated_rows_with_source_dated(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        owner_row = await create_user_availability(
            session, test_group, test_user, date="2026-06-01", slots=["20:00"]
        )
        member_row = await create_user_availability(
            session, test_group, member_user, date="2026-06-01", slots=["21:00", "21:30"]
        )
        # A template that would derive a row on 06-02 if the flag were ignored.
        await create_personal_availability_template(
            session, test_user, day_of_week="TU", slots=["10:00"]
        )

        response = await client.get(
            _url(test_group.id, "2026-06-01", "2026-06-02"), headers=member_headers
        )

        assert response.status_code == 200
        by_date = _by_date(response)
        # Today's within-date order is unspecified (`order_by(date)` only).
        assert sorted(by_date["2026-06-01"], key=lambda r: r["userId"]) == sorted(
            [
                {
                    "id": owner_row.id,
                    "userId": test_user.id,
                    "username": "testuser",
                    "date": "2026-06-01",
                    "slots": ["20:00"],
                    "source": "dated",
                },
                {
                    "id": member_row.id,
                    "userId": member_user.id,
                    "username": "member",
                    "date": "2026-06-01",
                    "slots": ["21:00", "21:30"],
                    "source": "dated",
                },
            ],
            key=lambda r: r["userId"],
        )
        assert by_date["2026-06-02"] == []

    async def test_submit_availability_response_carries_source_dated(
        self, client: AsyncClient, session: AsyncSession, test_group, member_user, member_headers
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.put(
            f"/api/static-groups/{test_group.id}/availability",
            json={"date": "2026-06-01", "slots": ["03:00"]},
            headers=member_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["source"] == "dated"
        assert body["id"] is not None


class TestListAvailabilityFlagOn:
    async def test_layers_personal_templates_under_dated_rows(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, member_user, member_headers
    ):
        membership = await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)
        await _set_joined_at(session, test_group.id, test_user.id, "2026-01-01T00:00:00+00:00")
        membership.joined_at = "2026-01-02T00:00:00+00:00"
        await session.flush()

        # Owner: template only. Member: a dated Monday and a template Monday.
        # Both templates are New York local (EDT, UTC-4, in June).
        await create_personal_availability_template(
            session, test_user, day_of_week="MO", slots=["20:00", "23:30"], timezone="America/New_York"
        )
        dated = await create_user_availability(
            session, test_group, member_user, date="2026-06-01", slots=["20:00"]
        )
        await create_personal_availability_template(
            session, member_user, day_of_week="MO", slots=["19:00", "23:30"], timezone="America/New_York"
        )

        response = await client.get(
            _url(test_group.id, "2026-06-01", "2026-06-02", include_templates=True),
            headers=member_headers,
        )

        assert response.status_code == 200
        by_date = _by_date(response)
        # Member's local Monday 19:00 is 06-01 23:00 UTC, blocked by the dated row.
        assert by_date["2026-06-01"] == [
            {
                "id": dated.id,
                "userId": member_user.id,
                "username": "member",
                "date": "2026-06-01",
                "slots": ["20:00"],
                "source": "dated",
            }
        ]
        # Owner first (joined earlier), then member; both derived from local Monday evening.
        assert by_date["2026-06-02"] == [
            {
                "id": None,
                "userId": test_user.id,
                "username": "testuser",
                "date": "2026-06-02",
                "slots": ["00:00", "03:30"],
                "source": "personal_template",
            },
            {
                "id": None,
                "userId": member_user.id,
                "username": "member",
                "date": "2026-06-02",
                "slots": ["03:30"],
                "source": "personal_template",
            },
        ]

    async def test_viewer_templates_are_not_layered_but_viewer_can_read(
        self, client: AsyncClient, session: AsyncSession, test_group, test_user, viewer_user, viewer_headers
    ):
        await create_membership(session, viewer_user, test_group, role=MemberRole.VIEWER)
        await create_personal_availability_template(
            session, viewer_user, day_of_week="MO", slots=["20:00"]
        )
        await create_personal_availability_template(
            session, test_user, day_of_week="MO", slots=["21:00"]
        )

        response = await client.get(
            _url(test_group.id, "2026-06-01", "2026-06-01", include_templates=True),
            headers=viewer_headers,
        )

        assert response.status_code == 200
        assert _by_date(response)["2026-06-01"] == [
            {
                "id": None,
                "userId": test_user.id,
                "username": "testuser",
                "date": "2026-06-01",
                "slots": ["21:00"],
                "source": "personal_template",
            }
        ]

    async def test_non_member_is_forbidden(
        self, client: AsyncClient, test_group, auth_headers_user2
    ):
        response = await client.get(
            _url(test_group.id, "2026-06-01", "2026-06-02", include_templates=True),
            headers=auth_headers_user2,
        )
        assert response.status_code == 403

    @pytest.mark.parametrize(
        ("start", "end"),
        [
            ("not-a-date", "2026-06-02"),  # malformed
            ("2026-06-02", "2026-06-01"),  # inverted
            ("2026-01-01", "2026-12-31"),  # oversized
        ],
    )
    async def test_range_validation_still_applies(
        self, client: AsyncClient, session: AsyncSession, test_group, member_user, member_headers, start, end
    ):
        await create_membership(session, member_user, test_group, role=MemberRole.MEMBER)

        response = await client.get(
            _url(test_group.id, start, end, include_templates=True), headers=member_headers
        )
        assert response.status_code == 422


# ==================== Statement budget (R-PH3-D) ====================


async def _count_statements(engine, run) -> int:
    counts = {"n": 0}

    def _count(conn, cursor, statement, parameters, context, executemany):
        counts["n"] += 1

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        await run()
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    return counts["n"]


async def _statements_for_get(
    client: AsyncClient, session: AsyncSession, engine, group_id: str, headers, *, include_templates: bool
) -> int:
    # Start each measurement from an empty identity map so a relationship
    # load cannot be skipped because the previous request already loaded it.
    session.expunge_all()

    async def _get():
        response = await client.get(
            _url(group_id, "2026-06-01", "2026-06-07", include_templates=include_templates),
            headers=headers,
        )
        assert response.status_code == 200

    return await _count_statements(engine, _get)


@pytest.mark.parametrize(
    ("extra_members", "with_templates"),
    [(1, True), (4, True), (1, False), (4, False)],
)
async def test_flag_on_adds_exactly_two_statements(
    client: AsyncClient,
    session: AsyncSession,
    engine,
    test_group,
    test_user,
    auth_headers,
    extra_members: int,
    with_templates: bool,
):
    members = [test_user]
    for index in range(extra_members):
        user = await create_user(
            session, discord_id=f"member-{index}", discord_username=f"member{index}"
        )
        await create_membership(session, user, test_group, role=MemberRole.MEMBER)
        members.append(user)
    for user in members:
        await create_user_availability(
            session, test_group, user, date="2026-06-01", slots=["20:00"]
        )
        if with_templates:
            await create_personal_availability_template(
                session, user, day_of_week="TU", slots=["20:00"], timezone="Europe/London"
            )

    off = await _statements_for_get(
        client, session, engine, test_group.id, auth_headers, include_templates=False
    )
    on = await _statements_for_get(
        client, session, engine, test_group.id, auth_headers, include_templates=True
    )

    assert on - off == 2
