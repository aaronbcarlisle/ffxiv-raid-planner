"""Authentication router for Discord OAuth"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import create_access_token, create_refresh_token, verify_token
from ..config import get_settings
from ..database import get_session
from ..dependencies import get_current_user
from ..models import User
from ..schemas import (
    DiscordAuthUrl,
    DiscordCallback,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

# Discord OAuth URLs
DISCORD_API_URL = "https://discord.com/api/v10"
DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"

# In-memory state storage (for production, use Redis or database)
_oauth_states: dict[str, datetime] = {}


def _cleanup_expired_states() -> None:
    """Remove expired OAuth states"""
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _oauth_states.items() if now - v > timedelta(minutes=10)]
    for k in expired:
        del _oauth_states[k]


@router.get("/discord", response_model=DiscordAuthUrl)
async def get_discord_auth_url() -> DiscordAuthUrl:
    """Get Discord OAuth authorization URL"""
    if not settings.discord_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth is not configured",
        )

    _cleanup_expired_states()

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = datetime.now(timezone.utc)

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify email",
        "state": state,
    }

    url = f"{DISCORD_OAUTH_URL}?{urlencode(params)}"
    return DiscordAuthUrl(url=url, state=state)


@router.post("/discord/callback", response_model=TokenResponse)
async def discord_callback(
    data: DiscordCallback,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Handle Discord OAuth callback"""
    if not settings.discord_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth is not configured",
        )

    # Verify state
    _cleanup_expired_states()
    if data.state not in _oauth_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    del _oauth_states[data.state]

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": data.code,
                "redirect_uri": settings.discord_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code",
            )

        tokens = token_response.json()
        discord_access_token = tokens.get("access_token")

        # Get user info from Discord
        user_response = await client.get(
            f"{DISCORD_API_URL}/users/@me",
            headers={"Authorization": f"Bearer {discord_access_token}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Discord",
            )

        discord_user = user_response.json()

    # Find or create user
    discord_id = discord_user["id"]
    result = await session.execute(select(User).where(User.discord_id == discord_id))
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()

    if user is None:
        # Create new user
        user = User(
            id=str(uuid.uuid4()),
            discord_id=discord_id,
            discord_username=discord_user.get("username", ""),
            discord_discriminator=discord_user.get("discriminator"),
            discord_avatar=discord_user.get("avatar"),
            email=discord_user.get("email"),
            display_name=discord_user.get("global_name"),
            created_at=now,
            updated_at=now,
            last_login_at=now,
        )
        session.add(user)
    else:
        # Update existing user
        user.discord_username = discord_user.get("username", user.discord_username)
        user.discord_discriminator = discord_user.get("discriminator")
        user.discord_avatar = discord_user.get("avatar")
        user.email = discord_user.get("email") or user.email
        user.display_name = discord_user.get("global_name") or user.display_name
        user.updated_at = now
        user.last_login_at = now

    await session.flush()

    # Create tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    data: RefreshTokenRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Refresh access token using refresh token"""
    user_id = verify_token(data.refresh_token, token_type="refresh")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Verify user still exists
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Create new tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout")
async def logout() -> dict:
    """Logout user (client should discard tokens)"""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current authenticated user info"""
    return UserResponse(
        id=user.id,
        discord_id=user.discord_id,
        discord_username=user.discord_username,
        discord_discriminator=user.discord_discriminator,
        discord_avatar=user.discord_avatar,
        avatar_url=user.avatar_url,
        display_name=user.display_name,
        email=user.email,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
    )
