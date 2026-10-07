"""Pydantic schemas for User authentication"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases for JSON serialization"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,  # Ensure JSON output uses camelCase
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
    is_admin: bool = False
    activity_display_mode: str = "named"
    tab_persistence: str = "remember"
    ui_shell: str = "legacy"
    created_at: str
    updated_at: str
    last_login_at: str | None = None

    @classmethod
    def from_user(cls, user: Any) -> "UserResponse":
        """Build the response from a User row (shared by /me, /me/preferences, /session)."""
        return cls(
            id=user.id,
            discord_id=user.discord_id,
            discord_username=user.discord_username,
            discord_discriminator=user.discord_discriminator,
            discord_avatar=user.discord_avatar,
            avatar_url=user.avatar_url,
            display_name=user.display_name,
            is_admin=user.is_admin,
            activity_display_mode=user.activity_display_mode,
            tab_persistence=user.tab_persistence,
            ui_shell=user.ui_shell,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
        )


class SessionResponse(CamelModel):
    """Bootstrap probe answer: the cookie session's user (or null) and whether a
    refresh cookie is present (presence only, never validated)."""

    user: UserResponse | None = None
    can_refresh: bool = False


class UserUpdate(CamelModel):
    """Schema for updating user profile"""

    display_name: str | None = Field(default=None, max_length=100)


class UserPreferencesUpdate(CamelModel):
    """Schema for updating user preferences"""

    activity_display_mode: str | None = Field(
        default=None, pattern=r"^(named|anonymous)$"
    )
    tab_persistence: str | None = Field(default=None, pattern=r"^(remember|reset)$")
    ui_shell: str | None = Field(default=None, pattern=r"^(legacy|v2)$")


class TokenResponse(CamelModel):
    """JWT token response.

    Tokens are only included when explicitly requested via X-Legacy-Token-Response
    header or legacyTokens query parameter. By default, tokens are only set in
    httpOnly cookies for security.
    """

    access_token: str | None = None
    refresh_token: str | None = None
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
