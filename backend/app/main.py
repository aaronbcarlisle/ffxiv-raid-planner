"""FastAPI application for FFXIV Raid Planner"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import create_tables
from .routers import players_router, statics_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler"""
    # Startup: Create database tables
    await create_tables()
    yield
    # Shutdown: Nothing to clean up


app = FastAPI(
    title="FFXIV Raid Planner API",
    description="Backend API for FFXIV Raid Planner - Track gear progress and loot distribution",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(statics_router)
app.include_router(players_router)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint"""
    return {"status": "healthy", "version": "0.1.0"}
