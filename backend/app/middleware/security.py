"""Security headers middleware for production hardening."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.

    Only applies in production to avoid development friction.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        settings = get_settings()

        # Only add strict headers in production
        if settings.environment == "production":
            # HSTS - Force HTTPS for 1 year, include subdomains
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

            # Prevent MIME type sniffing
            response.headers["X-Content-Type-Options"] = "nosniff"

            # Prevent clickjacking
            response.headers["X-Frame-Options"] = "DENY"

            # XSS protection (legacy, but still useful for older browsers)
            response.headers["X-XSS-Protection"] = "1; mode=block"

            # Control referrer information
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

            # Permissions Policy (formerly Feature-Policy)
            # Disable unnecessary browser features
            response.headers["Permissions-Policy"] = (
                "geolocation=(), microphone=(), camera=(), payment=()"
            )

            # Content Security Policy
            # Restricts sources for scripts, styles, images, and connections
            # Note: External API calls (xivgear, etro, garland) go through our backend,
            # so frontend only needs to connect to 'self'
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https://xivapi.com https://cdn.discordapp.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )

        return response
