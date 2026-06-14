"""FastAPI application for FFXIV Raid Planner"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .cache import close_cache, init_cache
from .config import get_settings
from .database import create_tables
from .exceptions import register_exception_handlers
from .logging_config import configure_logging, get_logger
from .middleware import (
    CSRFMiddleware,
    RequestIDMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .rate_limit import limiter
from .tasks.analytics_retention import retention_loop
from .tasks.auto_sync import auto_sync_loop
from .tasks.schedule_reminders import schedule_reminder_loop
from .routers import (
    analytics_router,
    api_keys_router,
    auth_router,
    bis_router,
    bis_targets_router,
    collection_goals_router,
    discovery_router,
    invitations_router,
    join_requests_router,
    lodestone_router,
    loot_tracking_router,
    mount_farms_router,
    notifications_router,
    player_router,
    plugin_player_router,
    schedule_router,
    static_groups_router,
    tiers_router,
)

settings = get_settings()
configure_logging(settings)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler"""
    logger.info(
        "app_starting",
        environment=settings.environment,
        debug=settings.debug,
    )
    # Initialize cache (Redis or in-memory fallback)
    await init_cache()
    # Startup: Create database tables (only in development - use migrations in production)
    if settings.environment == "development":
        await create_tables()
        logger.info("database_tables_created", mode="auto")
    else:
        logger.info("database_setup", mode="migrations")

    # Start background tasks
    retention_task = asyncio.create_task(retention_loop())
    sync_task = asyncio.create_task(auto_sync_loop())
    schedule_reminder_task = asyncio.create_task(schedule_reminder_loop())

    yield

    # Shutdown
    schedule_reminder_task.cancel()
    sync_task.cancel()
    retention_task.cancel()
    for task in (schedule_reminder_task, sync_task, retention_task):
        try:
            await task
        except asyncio.CancelledError:
            pass
    await close_cache()
    logger.info("app_shutdown")


app = FastAPI(
    title="FFXIV Raid Planner API",
    description="Backend API for FFXIV Raid Planner - Track gear progress and loot distribution",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exceeded errors."""
    logger.warning(
        "rate_limit_exceeded",
        path=request.url.path,
        client_ip=request.client.host if request.client else "unknown",
        limit=str(exc.detail),
    )
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": f"Too many requests. {exc.detail}",
        },
    )


# Middleware stack (applied in reverse order - last added runs first)
#
# IMPORTANT: CORSMiddleware MUST be added LAST (outermost) so that ALL responses
# go through it, including early-return 403s from CSRFMiddleware. Without this,
# CSRF validation failures return 403 without CORS headers, causing browsers to
# report CORS errors instead of showing the actual 403 to JavaScript.
#
# Execution flow:
#   Request:  CORS → RequestID → SizeLimit → CSRF → Security → Route
#   Response: Route → Security → CSRF → SizeLimit → RequestID → CORS

# 1. Security headers (innermost - just adds response headers)
app.add_middleware(SecurityHeadersMiddleware)

# 2. CSRF protection (validates state-changing requests)
app.add_middleware(CSRFMiddleware)

# 3. Request size limit (reject oversized requests early)
app.add_middleware(RequestSizeLimitMiddleware)

# 4. Request ID (sets ID for all subsequent logging)
app.add_middleware(RequestIDMiddleware)

# 5. CORS (outermost - ensures ALL responses including 403s have CORS headers)
# Supports both static origins list and regex pattern for Vercel previews
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_vercel_preview_pattern or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Expose CSRF token header for cross-domain scenarios where
    # the frontend can't read cookies set by the API domain
    expose_headers=["X-CSRF-Token"],
)

# Register centralized exception handlers
register_exception_handlers(app)

# Include routers
app.include_router(analytics_router)
app.include_router(api_keys_router)
app.include_router(auth_router)
app.include_router(bis_router)
app.include_router(bis_targets_router)
app.include_router(collection_goals_router)
app.include_router(discovery_router)
app.include_router(invitations_router)
app.include_router(join_requests_router)
app.include_router(lodestone_router)
app.include_router(loot_tracking_router)
app.include_router(mount_farms_router)
app.include_router(notifications_router)
app.include_router(player_router)
app.include_router(plugin_player_router)
app.include_router(schedule_router)
app.include_router(static_groups_router)

# Dev auth - only in development with explicit opt-in
if settings.environment == "development" and settings.dev_auth_mode:
    from .routers.dev_auth import router as dev_auth_router
    app.include_router(dev_auth_router)
app.include_router(tiers_router)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint"""
    return {"status": "healthy", "version": "0.1.0"}
