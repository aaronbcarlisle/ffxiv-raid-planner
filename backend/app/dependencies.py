"""FastAPI dependencies for authentication and authorization"""

import hashlib
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .auth_utils import verify_token
from .database import get_session
from .models import User

# HTTP Bearer token security scheme (for backward compatibility with Authorization header)
security = HTTPBearer(auto_error=False)


def _extract_access_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Extract access token from cookie (preferred) or Authorization header (legacy).

    Priority:
    1. httpOnly cookie (secure, XSS-resistant)
    2. Authorization header (backward compatibility + API keys)
    """
    # Try cookie first (preferred, secure method)
    token = request.cookies.get("access_token")
    if token:
        return token

    # Fall back to Authorization header (backward compatibility + API keys)
    if credentials:
        return credentials.credentials

    return None


async def _validate_api_key(token: str, session: AsyncSession) -> User:
    """Validate an API key (xrp_ prefixed token) and return the associated user.

    Looks up the key by SHA-256 hash, verifies it's active and not expired,
    and updates last_used_at.
    """
    from .models import ApiKey

    key_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await session.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiration
    if api_key.expires_at:
        # Normalize ISO format: handle 'Z' suffix and ensure timezone awareness
        expires_str = api_key.expires_at.replace("Z", "+00:00")
        expires = datetime.fromisoformat(expires_str)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Save user_id before committing (ORM objects expire after commit)
    user_id = api_key.user_id

    # Update last_used_at and commit immediately so it persists even on GET endpoints
    await session.execute(
        update(ApiKey).where(ApiKey.id == api_key.id).values(
            last_used_at=datetime.now(timezone.utc).isoformat()
        )
    )
    await session.commit()

    # Load user in fresh transaction
    user_result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key owner not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Get the current authenticated user from JWT token or API key.

    Accepts token from either httpOnly cookie (preferred), Authorization header,
    or API key (xrp_ prefix). Raises HTTPException if not authenticated.
    """
    token = _extract_access_token(request, credentials)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # API key path: xrp_ prefix distinguishes API keys from JWTs
    if token.startswith("xrp_"):
        return await _validate_api_key(token, session)

    # Existing JWT path
    user_id = verify_token(token, token_type="access")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Use same generic message to prevent user enumeration via timing attacks
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_jwt_only(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Get current user from JWT/cookie only. Rejects API key authentication.

    Use this for sensitive endpoints (like API key management) that should not
    be accessible via API key to prevent privilege escalation.
    """
    token = _extract_access_token(request, credentials)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token.startswith("xrp_"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API keys cannot access this endpoint. Use browser authentication.",
        )

    user_id = verify_token(token, token_type="access")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Get the current user if authenticated, otherwise return None.

    Accepts token from either httpOnly cookie (preferred), Authorization header,
    or API key (xrp_ prefix).
    Use this for endpoints that work both with and without authentication.
    """
    token = _extract_access_token(request, credentials)

    if not token:
        return None

    # API key path
    if token.startswith("xrp_"):
        try:
            return await _validate_api_key(token, session)
        except HTTPException:
            return None

    # JWT path
    user_id = verify_token(token, token_type="access")
    if not user_id:
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
