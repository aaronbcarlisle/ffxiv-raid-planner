"""Pydantic schemas for the Player Hub "Needs you" overview endpoint (PH2)."""

from typing import Literal

from .user import CamelModel


class OverviewNextSession(CamelModel):
    """The earliest upcoming occurrence for one of a static's sessions."""

    session_id: str
    title: str
    starts_at: str


class OverviewStatic(CamelModel):
    """One membership static's summary row for the Hub."""

    id: str
    share_code: str
    name: str
    role: str
    tier_id: str | None = None
    member_count: int
    next_session: OverviewNextSession | None = None
    floors_cleared: int | None = None
    avg_bis_pct: int | None = None


class OverviewActionItem(CamelModel):
    """One "needs you" item: a pending RSVP, a loot drop you're first for, or an
    out-of-date Hub BiS set."""

    type: Literal["rsvp_pending", "loot_priority", "bis_stale"]
    static_id: str
    static_name: str
    title: str
    detail: str
    href: str
    starts_at: str | None = None


class PlayerOverviewResponse(CamelModel):
    """Response body for GET /api/player/overview."""

    statics: list[OverviewStatic]
    action_items: list[OverviewActionItem]
