"""API Routers"""

from .auth import router as auth_router
from .players import router as players_router
from .static_groups import router as static_groups_router
from .statics import router as statics_router

__all__ = ["auth_router", "players_router", "static_groups_router", "statics_router"]
