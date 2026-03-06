"""
API Key Schemas

Pydantic schemas for API key management.
"""

from pydantic import Field

from .loot_tracking import CamelModel


class ApiKeyCreate(CamelModel):
    """Request schema for creating an API key.

    All keys receive full access. Scope enforcement is planned for a future release.
    """

    name: str = Field(..., min_length=1, max_length=100)


class ApiKeyCreateResponse(CamelModel):
    """Response schema after creating an API key (includes raw key shown once)"""

    id: str
    name: str
    key: str  # Raw key - shown ONLY at creation time
    key_prefix: str
    scopes: list[str]
    created_at: str


class ApiKeyResponse(CamelModel):
    """Response schema for listing API keys (never includes raw key)"""

    id: str
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: str | None
    expires_at: str | None
    is_active: bool
    created_at: str
