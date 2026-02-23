"""
API Key Schemas

Pydantic schemas for API key management.
"""

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x[0].upper() + x[1:] if x else "" for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase conversion for API responses"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ApiKeyCreate(CamelModel):
    """Request schema for creating an API key"""

    name: str = Field(..., min_length=1, max_length=100)
    scopes: list[str] = Field(
        default_factory=lambda: ["priority:read", "loot:write", "materials:write", "pages:write"]
    )


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
