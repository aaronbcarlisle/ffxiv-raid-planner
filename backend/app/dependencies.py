"""FastAPI dependencies for authentication and authorization"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
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
    2. Authorization header (backward compatibility)
    """
    # Try cookie first (preferred, secure method)
    token = request.cookies.get("access_token")
    if token:
        return token

    # Fall back to Authorization header (backward compatibility)
    if credentials:
        return credentials.credentials

    return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Get the current authenticated user from JWT token.

    Accepts token from either httpOnly cookie (preferred) or Authorization header.
    Raises HTTPException if not authenticated.
    """
    token = _extract_access_token(request, credentials)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = verify_token(token, token_type="access")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Get the current user if authenticated, otherwise return None.

    Accepts token from either httpOnly cookie (preferred) or Authorization header.
    Use this for endpoints that work both with and without authentication.
    """
    token = _extract_access_token(request, credentials)

    if not token:
        return None

    user_id = verify_token(token, token_type="access")
    if not user_id:
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
