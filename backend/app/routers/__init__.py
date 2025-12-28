"""API Routers"""

from .auth import router as auth_router
from .bis import router as bis_router
from .invitations import router as invitations_router
from .static_groups import router as static_groups_router
from .tiers import router as tiers_router

__all__ = ["auth_router", "bis_router", "invitations_router", "static_groups_router", "tiers_router"]
