"""Pydantic schemas for User authentication"""

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class UserResponse(CamelModel):
    """User response schema"""

    id: str
    discord_id: str
    discord_username: str
    discord_discriminator: str | None = None
    discord_avatar: str | None = None
    avatar_url: str | None = None
    display_name: str | None = None
    email: str | None = None
    is_admin: bool = False
    created_at: str
    updated_at: str
    last_login_at: str | None = None


class UserUpdate(CamelModel):
    """Schema for updating user profile"""

    display_name: str | None = Field(default=None, max_length=100)


class TokenResponse(CamelModel):
    """JWT token response"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token expiry in seconds")


class RefreshTokenRequest(CamelModel):
    """Request to refresh access token"""

    refresh_token: str


class DiscordAuthUrl(CamelModel):
    """Discord OAuth authorization URL response"""

    url: str
    state: str


class DiscordCallback(CamelModel):
    """Discord OAuth callback parameters"""

    code: str
    state: str
