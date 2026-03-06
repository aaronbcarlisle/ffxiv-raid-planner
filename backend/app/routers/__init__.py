"""API Routers"""

from .api_keys import router as api_keys_router
from .auth import router as auth_router
from .bis import router as bis_router
from .invitations import router as invitations_router
from .loot_tracking import router as loot_tracking_router
from .static_groups import router as static_groups_router
from .tiers import router as tiers_router

__all__ = [
    "api_keys_router",
    "auth_router",
    "bis_router",
    "invitations_router",
    "loot_tracking_router",
    "static_groups_router",
    "tiers_router",
]
