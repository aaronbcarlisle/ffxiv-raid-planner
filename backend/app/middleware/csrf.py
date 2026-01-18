"""CSRF protection middleware using double-submit cookie pattern."""

import secrets
from typing import Set

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..config import get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)

# Paths exempt from CSRF validation
# These are either safe (GET-like) or handle their own security (OAuth callbacks)
CSRF_EXEMPT_PATHS: Set[str] = {
    "/health",
    "/api/auth/discord",
    "/api/auth/discord/callback",
    "/api/auth/refresh",
    # Note: /api/auth/logout is NOT exempt - it's a state-changing POST that needs CSRF protection
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Paths where we should always generate a fresh CSRF token
# These are auth-related endpoints where session state changes
CSRF_FORCE_REFRESH_PATHS: Set[str] = {
    "/api/auth/discord/callback",
    "/api/auth/refresh",
}

# HTTP methods that require CSRF validation (state-changing operations)
CSRF_REQUIRED_METHODS: Set[str] = {"POST", "PUT", "DELETE", "PATCH"}

# Cookie settings
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_TOKEN_LENGTH = 32  # 256 bits of entropy


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using double-submit cookie pattern.

    How it works:
    1. On each response, set a CSRF token in a readable cookie
    2. Client reads the cookie and sends the token in X-CSRF-Token header
    3. For state-changing requests, validate header matches cookie

    This works with httpOnly auth cookies because:
    - CSRF token cookie is NOT httpOnly (client can read it)
    - Auth cookie IS httpOnly (XSS can't steal it)
    - Attacker can't read CSRF cookie from another origin (same-origin policy)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()

        # Skip CSRF for exempt paths
        if self._is_exempt(request.url.path):
            response = await call_next(request)
            return self._ensure_csrf_cookie(request, response, settings)

        # Validate CSRF for state-changing methods
        if request.method in CSRF_REQUIRED_METHODS:
            if not self._validate_csrf(request):
                logger.warning(
                    "csrf_validation_failed",
                    path=request.url.path,
                    method=request.method,
                    client_ip=request.client.host if request.client else "unknown",
                )
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "csrf_validation_failed",
                        "message": "CSRF token missing or invalid",
                    },
                )

        response = await call_next(request)
        return self._ensure_csrf_cookie(request, response, settings)

    def _is_exempt(self, path: str) -> bool:
        """Check if path is exempt from CSRF validation."""
        # Exact match
        if path in CSRF_EXEMPT_PATHS:
            return True
        # Prefix match for API docs
        if path.startswith("/docs") or path.startswith("/redoc"):
            return True
        return False

    def _validate_csrf(self, request: Request) -> bool:
        """Validate CSRF token from header matches cookie."""
        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        header_token = request.headers.get(CSRF_HEADER_NAME)

        if not cookie_token or not header_token:
            return False

        # Constant-time comparison to prevent timing attacks
        return secrets.compare_digest(cookie_token, header_token)

    def _ensure_csrf_cookie(
        self, request: Request, response: Response, settings
    ) -> Response:
        """Ensure CSRF cookie is set on response."""
        # Force new token on auth endpoints to ensure frontend has a valid token
        force_new_token = request.url.path in CSRF_FORCE_REFRESH_PATHS

        if not force_new_token:
            # Check if cookie already exists and is valid
            existing_token = request.cookies.get(CSRF_COOKIE_NAME)
            if existing_token and len(existing_token) == CSRF_TOKEN_LENGTH * 2:
                # Token exists and looks valid, no need to regenerate
                return response

        # Generate new CSRF token
        token = secrets.token_hex(CSRF_TOKEN_LENGTH)

        # Set cookie attributes based on environment
        is_production = settings.environment == "production"

        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=token,
            httponly=False,  # Client must be able to read this
            secure=is_production,  # HTTPS only in production
            samesite="lax",  # Lax allows top-level navigation
            max_age=86400,  # 24 hours
            path="/",
        )

        return response
