"""Authentication router for Discord OAuth"""

import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import create_access_token, create_refresh_token, verify_token
from ..cache import oauth_state_cache
from ..config import get_settings
from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..rate_limit import RATE_LIMITS, limiter
from ..schemas import (
    DiscordAuthUrl,
    DiscordCallback,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
logger = get_logger(__name__)

# Discord OAuth URLs
DISCORD_API_URL = "https://discord.com/api/v10"
DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


def wants_legacy_tokens(request: Request) -> bool:
    """Check if client explicitly requests tokens in response body (legacy mode).

    By default, tokens are only set in httpOnly cookies for security.
    Legacy mode can be enabled via:
    - X-Legacy-Token-Response: 1 header
    - ?legacyTokens=true query parameter
    """
    hdr = request.headers.get("X-Legacy-Token-Response", "")
    qry = request.query_params.get("legacyTokens", "")
    return hdr == "1" or qry.lower() == "true"


def _get_client_fingerprint(request: Request) -> str:
    """Generate a fingerprint from client IP and user agent for CSRF protection.

    This binds OAuth state to the requesting client to prevent session fixation attacks.
    """
    import hashlib

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    # Hash to avoid storing raw user agent (which could be long/sensitive)
    fingerprint_data = f"{client_ip}:{user_agent}"
    return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]


@router.get("/discord", response_model=DiscordAuthUrl)
@limiter.limit(RATE_LIMITS["auth"])
async def get_discord_auth_url(request: Request) -> DiscordAuthUrl:
    """Get Discord OAuth authorization URL"""
    if not settings.discord_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth is not configured",
        )

    state = secrets.token_urlsafe(32)

    # Store state with client fingerprint to prevent session fixation/CSRF
    client_fingerprint = _get_client_fingerprint(request)
    await oauth_state_cache.set(
        state,
        {
            "created": datetime.now(timezone.utc).isoformat(),
            "fingerprint": client_fingerprint,
        },
    )

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify email",
        "state": state,
    }

    url = f"{DISCORD_OAUTH_URL}?{urlencode(params)}"
    logger.debug("oauth_url_generated", state=state[:8] + "...")
    return DiscordAuthUrl(url=url, state=state)


@router.post("/discord/callback", response_model=TokenResponse)
@limiter.limit(RATE_LIMITS["auth"])
async def discord_callback(
    request: Request,
    response: Response,
    data: DiscordCallback,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Handle Discord OAuth callback"""
    if not settings.discord_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth is not configured",
        )

    # Verify state exists and matches client fingerprint
    state_data = await oauth_state_cache.get(data.state)
    if not state_data:
        logger.warning("oauth_invalid_state", state=data.state[:8] + "...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    # Verify client fingerprint to prevent session fixation/CSRF attacks
    expected_fingerprint = state_data.get("fingerprint")
    actual_fingerprint = _get_client_fingerprint(request)
    if expected_fingerprint and expected_fingerprint != actual_fingerprint:
        logger.warning(
            "oauth_fingerprint_mismatch",
            state=data.state[:8] + "...",
            expected=expected_fingerprint[:8] + "...",
            actual=actual_fingerprint[:8] + "...",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    await oauth_state_cache.delete(data.state)

    # Exchange code for tokens
    # Use follow_redirects=False to prevent SSRF attacks
    async with httpx.AsyncClient(follow_redirects=False) as client:
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

        # Reject redirects to prevent SSRF
        if 300 <= token_response.status_code < 400:
            logger.error("discord_token_redirect", status=token_response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OAuth provider returned unexpected redirect",
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

        # Reject redirects to prevent SSRF
        if 300 <= user_response.status_code < 400:
            logger.error("discord_userinfo_redirect", status=user_response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OAuth provider returned unexpected redirect",
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

    # Check if user should be admin (based on ADMIN_DISCORD_IDS env var)
    should_be_admin = discord_id in settings.admin_discord_ids_list

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
            is_admin=should_be_admin,
            created_at=now,
            updated_at=now,
            last_login_at=now,
        )
        session.add(user)
        if should_be_admin:
            logger.info("admin_user_created", discord_id=discord_id)
    else:
        # Update existing user
        user.discord_username = discord_user.get("username", user.discord_username)
        user.discord_discriminator = discord_user.get("discriminator")
        user.discord_avatar = discord_user.get("avatar")
        user.email = discord_user.get("email") or user.email
        user.display_name = discord_user.get("global_name") or user.display_name
        user.updated_at = now
        user.last_login_at = now
        # Update admin status if in whitelist (only grants, never revokes via env var)
        # To revoke admin, must be done via direct DB access
        if should_be_admin and not user.is_admin:
            user.is_admin = True
            logger.info("admin_status_granted", discord_id=discord_id)

    await session.flush()
    await session.commit()

    # Create tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Set httpOnly cookies (secure, SameSite=Lax for CSRF protection)
    # In production, secure=True requires HTTPS
    is_secure = settings.environment == "production"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        path="/",
    )

    # Only return tokens in body if explicitly requested (legacy mode)
    # By default, tokens are only set in httpOnly cookies for security
    if wants_legacy_tokens(request):
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.jwt_access_token_expire_minutes * 60,
        )

    return TokenResponse(
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(RATE_LIMITS["auth"])
async def refresh_access_token(
    request: Request,
    response: Response,
    data: RefreshTokenRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Refresh access token using refresh token.

    Accepts refresh token from either:
    1. Request body (legacy: { refreshToken: "..." })
    2. httpOnly cookie (preferred)
    """
    # Try to get refresh token from cookie first, then body
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value and data:
        refresh_token_value = data.refresh_token

    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    user_id = verify_token(refresh_token_value, token_type="refresh")
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
    new_refresh_token = create_refresh_token(user.id)

    # Set httpOnly cookies
    is_secure = settings.environment == "production"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        path="/",
    )

    # Only return tokens in body if explicitly requested (legacy mode)
    if wants_legacy_tokens(request):
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.jwt_access_token_expire_minutes * 60,
        )

    return TokenResponse(
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout")
async def logout(
    response: Response,
    _user: User = Depends(get_current_user),  # Require auth to prevent CSRF
) -> dict:
    """Logout user by clearing httpOnly cookies.

    Requires authentication to prevent CSRF attacks where an attacker
    could force a user to logout by making a cross-origin POST request.
    """
    # Clear cookies with matching attributes for proper deletion across all browsers
    # Must match secure flag used when setting cookies for proper browser deletion
    is_secure = settings.environment == "production"
    response.delete_cookie(key="access_token", path="/", samesite="lax", secure=is_secure)
    response.delete_cookie(key="refresh_token", path="/", samesite="lax", secure=is_secure)

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
        is_admin=user.is_admin,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
    )
