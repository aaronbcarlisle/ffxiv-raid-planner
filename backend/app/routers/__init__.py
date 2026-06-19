"""API Routers"""

from .discord_interactions import router as discord_interactions_router
from .analytics import router as analytics_router
from .content_suggestions import router as content_suggestions_router
from .api_keys import router as api_keys_router
from .auth import router as auth_router
from .bis import router as bis_router
from .bis_targets import router as bis_targets_router
from .collection_goals import router as collection_goals_router
from .discovery import router as discovery_router
from .invitations import router as invitations_router
from .join_requests import router as join_requests_router
from .lodestone import router as lodestone_router
from .loot_tracking import router as loot_tracking_router
from .mount_farms import router as mount_farms_router
from .notifications import router as notifications_router
from .objective_goals import router as objective_goals_router
from .player_bis_targets import router as player_bis_targets_router
from .player import plugin_router as plugin_player_router
from .player import router as player_router
from .schedule import router as schedule_router
from .split_clear import router as split_clear_router
from .static_characters import router as static_characters_router
from .static_groups import router as static_groups_router
from .tiers import router as tiers_router

__all__ = [
    "discord_interactions_router",
    "analytics_router",
    "content_suggestions_router",
    "api_keys_router",
    "auth_router",
    "bis_router",
    "bis_targets_router",
    "collection_goals_router",
    "discovery_router",
    "invitations_router",
    "join_requests_router",
    "lodestone_router",
    "loot_tracking_router",
    "mount_farms_router",
    "notifications_router",
    "objective_goals_router",
    "player_bis_targets_router",
    "player_router",
    "plugin_player_router",
    "schedule_router",
    "split_clear_router",
    "static_characters_router",
    "static_groups_router",
    "tiers_router",
]
