"""JWT token utilities for authentication"""

from datetime import datetime, timedelta, timezone

import structlog
from jose import ExpiredSignatureError, JWTError, jwt

from .config import get_settings

settings = get_settings()
logger = structlog.get_logger(__name__)


def create_access_token(user_id: str) -> str:
    """Create a JWT access token"""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token"""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str, token_type: str = "access") -> str | None:
    """Verify a JWT token and return the user ID, or None if invalid"""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )

        actual_type = payload.get("type")
        if actual_type != token_type:
            logger.debug(
                "token_type_mismatch",
                expected=token_type,
                got=actual_type,
            )
            return None

        user_id = payload.get("sub")
        return user_id

    except ExpiredSignatureError:
        logger.debug("token_expired", token_type=token_type)
        return None
    except JWTError as e:
        logger.debug(
            "token_verification_failed",
            token_type=token_type,
            error=str(e),
        )
        return None
