"""API Routers"""

from .statics import router as statics_router
from .players import router as players_router

__all__ = ["statics_router", "players_router"]
