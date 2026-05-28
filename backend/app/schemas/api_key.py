"""
API Key Schemas

Pydantic schemas for API key management.
"""

from pydantic import Field, field_validator

from .loot_tracking import CamelModel


class ApiKeyCreate(CamelModel):
    """Request schema for creating an API key.

    All keys receive full access. Scope enforcement is planned for a future release.
    """

    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


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


class PluginAuthAuthorizeRequest(CamelModel):
    """Authenticated request to mint an authorization code for the plugin's loopback flow."""

    redirect_uri: str = Field(..., min_length=1, max_length=2048)
    state: str = Field(..., min_length=1, max_length=256)
    code_challenge: str = Field(..., min_length=43, max_length=128)
    code_challenge_method: str = Field(default="S256", min_length=1, max_length=8)


class PluginAuthAuthorizeResponse(CamelModel):
    """Returns the one-time code the frontend should append to the loopback redirect."""

    code: str


class PluginAuthExchangeRequest(CamelModel):
    """Unauthenticated request from the plugin's loopback listener.

    Possession of a valid `code` plus the matching PKCE verifier mints an API key.
    """

    code: str = Field(..., min_length=1, max_length=128)
    code_verifier: str = Field(..., min_length=43, max_length=128)


class PluginAuthExchangeResponse(CamelModel):
    """Returns the minted xrp_ API key. Shown ONLY here — never again."""

    api_key: str
