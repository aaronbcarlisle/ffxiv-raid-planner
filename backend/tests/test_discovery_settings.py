"""`services.discovery_settings`: status normalisation and the discoverable gate (RH1a, R-RH-A).

Pure: no session. `is_discoverable` runs over a `StaticGroup` built in memory.
"""

import pytest

from app.models import StaticGroup
from app.services.discovery_settings import is_discoverable, normalize_status


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("limited", "selective"),
        ("open", "open"),
        ("selective", "selective"),
        ("paused", "paused"),
        ("closed", "closed"),
        (None, "open"),
        ("", "open"),
        (7, "open"),
        ("whatever", "open"),
    ],
)
def test_normalize_status(raw, expected):
    assert normalize_status(raw) == expected


def _group(*, is_public: bool = True, settings: dict | None) -> StaticGroup:
    return StaticGroup(id="g", name="G", owner_id="u", share_code="ABC123", is_public=is_public, settings=settings)


@pytest.mark.parametrize(
    ("is_public", "settings", "expected"),
    [
        pytest.param(False, {"discovery": {"enabled": True, "recruitmentStatus": "open"}}, False, id="private"),
        pytest.param(True, None, False, id="settings_none"),
        pytest.param(True, {"discovery": {"enabled": "yes"}}, False, id="enabled_not_bool"),
        pytest.param(True, {"discovery": {"enabled": True}}, True, id="missing_status"),
        pytest.param(True, {"discovery": {"enabled": True, "recruitmentStatus": 7}}, True, id="non_string_status"),
        pytest.param(True, {"discovery": {"enabled": True, "recruitmentStatus": "selective"}}, True, id="selective"),
        pytest.param(True, {"discovery": {"enabled": True, "recruitmentStatus": "paused"}}, False, id="paused"),
        pytest.param(True, {"discovery": {"enabled": True, "recruitmentStatus": "closed"}}, False, id="closed"),
        pytest.param(True, {"discovery": {"enabled": True, "recruitmentStatus": "limited"}}, True, id="limited"),
    ],
)
def test_is_discoverable(is_public, settings, expected):
    assert is_discoverable(_group(is_public=is_public, settings=settings)) is expected
