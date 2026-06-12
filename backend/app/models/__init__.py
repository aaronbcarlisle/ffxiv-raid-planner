"""SQLAlchemy models"""

from .analytics import AnalyticsDailyAggregate, AnalyticsEvent, ErrorReport
from .api_key import ApiKey
from .collection_goal import CollectionGoal
from .invitation import Invitation
from .join_request import JoinRequest  # noqa: F811
from .loot_log_entry import LootLogEntry
from .material_log_entry import MaterialLogEntry
from .mount_farm_progress import MountFarmProgress
from .player_goal import PlayerGoal
from .membership import Membership, MemberRole, ROLE_HIERARCHY
from .page_ledger_entry import PageLedgerEntry
from .player_character import PlayerCharacter
from .player_gear_snapshot import PlayerGearSnapshot
from .player_bis_target_set import PlayerBisTargetSet
from .player_job_profile import PlayerJobProfile
from .player_profile import PlayerProfile
from .plugin_auth_code import PluginAuthCode
from .availability import AvailabilityTemplate, UserAvailability
from .personal_availability import PersonalAvailabilityTemplate
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
    "CollectionGoal",
    "Invitation",
    "JoinRequest",
    "LootLogEntry",
    "MaterialLogEntry",
    "MountFarmProgress",
    "ErrorReport",
    "Membership",
    "MemberRole",
    "PageLedgerEntry",
    "PlayerGoal",
    "PlayerBisTargetSet",
    "PlayerCharacter",
    "PlayerGearSnapshot",
    "PlayerJobProfile",
    "PlayerProfile",
    "PluginAuthCode",
    "ROLE_HIERARCHY",
    "DiscordMessageMapping",
    "ScheduleRsvp",
    "ScheduleReminderDelivery",
    "ScheduleSession",
    "ScheduleSettings",
    "AvailabilityTemplate",
    "PersonalAvailabilityTemplate",
    "UserAvailability",
    "SnapshotPlayer",
    "StaticGroup",
    "TierSnapshot",
    "User",
    "WeeklyAssignment",
]
