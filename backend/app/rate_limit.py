"""Rate limiting configuration using slowapi."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import get_settings
from .logging_config import get_logger

settings = get_settings()
logger = get_logger(__name__)


def get_client_ip(request: Request) -> str:
    """
    Get client IP address, checking X-Forwarded-For header for proxied requests.

    In production behind a reverse proxy, the real client IP is in X-Forwarded-For.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
        # The first one is the original client
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Create limiter instance with Redis storage if available
# Falls back to in-memory storage if Redis is not configured
limiter = Limiter(
    key_func=get_client_ip,
    default_limits=["100/minute"],  # Default rate limit for all endpoints
    storage_uri=settings.redis_url if settings.redis_url else None,
    strategy="fixed-window",
)

# Rate limit presets as strings for decorator use
RATE_LIMITS = {
    "auth": "10/minute",           # Auth endpoints - stricter to prevent brute force
    "general": "100/minute",       # General API calls
    "external_api": "30/minute",   # Calls that proxy to external APIs (BiS import)
    "heavy": "20/minute",          # Heavy operations (create/delete)
}
