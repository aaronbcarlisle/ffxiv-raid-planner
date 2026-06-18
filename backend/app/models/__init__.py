"""SQLAlchemy models"""

from .activity_log import StaticActivityLog
from .analytics import AnalyticsDailyAggregate, AnalyticsEvent, ErrorReport
from .notification import Notification
from .api_key import ApiKey
from .bis_target_set import BiSTargetSet, VALID_BIS_IMPORT_STATUSES, VALID_BIS_PURPOSES, VALID_BIS_SOURCE_TYPES, VALID_OWNER_TYPES
from .collection_goal import CollectionGoal
from .invitation import Invitation
from .join_request import JoinRequest  # noqa: F811
from .loot_log_entry import LootLogEntry
from .material_log_entry import MaterialLogEntry
from .mount_farm_progress import MountFarmProgress
from .player_goal import PlayerGoal
from .static_content_suggestion import StaticContentSuggestion, StaticContentSuggestionVote
from .static_objective_goal import StaticObjectiveGoal
from .membership import Membership, MemberRole, ROLE_HIERARCHY
from .page_ledger_entry import PageLedgerEntry
from .player_character import PlayerCharacter
from .player_gear_snapshot import PlayerGearSnapshot
from .player_job_profile import PlayerJobProfile
from .player_profile import PlayerProfile
from .plugin_auth_code import PluginAuthCode
from .availability import AvailabilityTemplate, UserAvailability
from .personal_availability import PersonalAvailabilityTemplate
from .schedule import DiscordInstallClaim, DiscordMessageMapping, ScheduleDiscordMirror, ScheduleException, ScheduleReminderDelivery, ScheduleRsvp, ScheduleSession, ScheduleSettings, StaticDiscordLink
from .snapshot_player import SnapshotPlayer
from .static_group import StaticGroup
from .tier_snapshot import TierSnapshot
from .user import User
from .weekly_assignment import WeeklyAssignment

__all__ = [
    "StaticActivityLog",
    "Notification",
    "AnalyticsDailyAggregate",
    "AnalyticsEvent",
    "ApiKey",
    "BiSTargetSet",
    "VALID_BIS_IMPORT_STATUSES",
    "VALID_BIS_PURPOSES",
    "VALID_BIS_SOURCE_TYPES",
    "VALID_OWNER_TYPES",
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
    "StaticContentSuggestion",
    "StaticContentSuggestionVote",
    "StaticObjectiveGoal",
    "PlayerCharacter",
    "PlayerGearSnapshot",
    "PlayerJobProfile",
    "PlayerProfile",
    "PluginAuthCode",
    "ROLE_HIERARCHY",
    "DiscordInstallClaim",
    "DiscordMessageMapping",
    "ScheduleDiscordMirror",
    "ScheduleException",
    "StaticDiscordLink",
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
