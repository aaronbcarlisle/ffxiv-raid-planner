"""Recruitment status and the discoverable gate for a static's listing (Stage 4 RH1a, R-RH-A).

Pure: no session and no I/O. `routers/discovery.py` (the Static Finder list) and
`routers/join_requests.py` (create) share these so a listing that is hidden from
the Finder also stops taking join requests, with one reading of the status.
"""

from __future__ import annotations

from ..models import StaticGroup

STATUSES = frozenset({"open", "selective", "paused", "closed"})
ACCEPTING = frozenset({"open", "selective"})


def normalize_status(raw: object) -> str:
    """`"limited"` -> `"selective"`; the four statuses pass through; anything else -> `"open"`.

    Missing, `None`, `""`, a non-string or an unknown string all read as open:
    a listing whose status was never set has always been listed.
    """
    if raw == "limited":
        return "selective"
    if isinstance(raw, str) and raw in STATUSES:
        return raw
    return "open"


def get_discovery(settings: dict | None) -> dict | None:
    """`settings["discovery"]` when it is a dict, else None."""
    if not settings or not isinstance(settings, dict):
        return None
    discovery = settings.get("discovery")
    if not discovery or not isinstance(discovery, dict):
        return None
    return discovery


def is_listing_enabled(group: StaticGroup) -> bool:
    """Public with `discovery.enabled is True`, whatever the status (the create 403 gate)."""
    if not group.is_public:
        return False
    discovery = get_discovery(group.settings)
    if discovery is None:
        return False
    return discovery.get("enabled") is True


def is_discoverable(group: StaticGroup) -> bool:
    """Listed in the Static Finder: enabled and the normalised status is open or selective."""
    if not is_listing_enabled(group):
        return False
    discovery = get_discovery(group.settings)
    assert discovery is not None
    return normalize_status(discovery.get("recruitmentStatus")) in ACCEPTING
