"""API Routers"""

from .auth import router as auth_router
from .static_groups import router as static_groups_router
from .tiers import router as tiers_router

__all__ = ["auth_router", "static_groups_router", "tiers_router"]
