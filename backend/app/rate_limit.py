"""Rate limiting configuration using slowapi."""

from fastapi import Request
from slowapi import Limiter

from .config import get_settings
from .logging_config import get_logger

settings = get_settings()
logger = get_logger(__name__)


def get_client_ip(request: Request) -> str:
    """
    Get client IP address for rate limiting.

    Security: Only trusts X-Forwarded-For and X-Real-IP headers when the
    request comes from a configured trusted proxy IP. This prevents rate
    limit bypass via header spoofing.

    In production behind a reverse proxy, configure TRUSTED_PROXY_IPS to
    include your proxy's IP address.
    """
    peer = request.client.host if request.client else ""

    # Only trust forwarded headers if request comes from trusted proxy
    trusted_proxies = settings.trusted_proxy_ips_list
    if peer in trusted_proxies:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
        # The first one is the original client
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()

        x_real_ip = request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip.strip()

    return peer or "unknown"


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
