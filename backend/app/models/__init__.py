"""SQLAlchemy models"""

from .analytics import AnalyticsDailyAggregate, AnalyticsEvent, ErrorReport
from .api_key import ApiKey
from .invitation import Invitation
from .join_request import JoinRequest  # noqa: F811
from .loot_log_entry import LootLogEntry
from .material_log_entry import MaterialLogEntry
from .membership import Membership, MemberRole, ROLE_HIERARCHY
from .page_ledger_entry import PageLedgerEntry
from .plugin_auth_code import PluginAuthCode
from .availability import AvailabilityTemplate, UserAvailability
from .schedule import DiscordMessageMapping, ScheduleReminderDelivery, ScheduleRsvp, ScheduleSession, ScheduleSettings
from .snapshot_player import SnapshotPlayer
from .static_group import StaticGroup
from .tier_snapshot import TierSnapshot
from .user import User
from .weekly_assignment import WeeklyAssignment

__all__ = [
    "AnalyticsDailyAggregate",
    "AnalyticsEvent",
    "ApiKey",
    "Invitation",
    "JoinRequest",
    "LootLogEntry",
    "MaterialLogEntry",
    "ErrorReport",
    "Membership",
    "MemberRole",
    "PageLedgerEntry",
    "PluginAuthCode",
    "ROLE_HIERARCHY",
    "DiscordMessageMapping",
    "ScheduleRsvp",
    "ScheduleReminderDelivery",
    "ScheduleSession",
    "ScheduleSettings",
    "AvailabilityTemplate",
    "UserAvailability",
    "SnapshotPlayer",
    "StaticGroup",
    "TierSnapshot",
    "User",
    "WeeklyAssignment",
]
