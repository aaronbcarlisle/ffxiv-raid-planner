"""Request ID middleware for request tracing and log correlation."""

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Add unique request ID to each request for tracing and log correlation.

    - Generates UUID for each request
    - Binds to structlog contextvars for automatic inclusion in all logs
    - Adds X-Request-ID header to responses
    - Accepts X-Request-ID from trusted upstream proxies
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Accept request ID from upstream proxy if provided, otherwise generate.
        # Inbound value is client-controlled: cap it so it can't bloat logs,
        # response headers, or fixed-width DB columns downstream.
        request_id = request.headers.get("X-Request-ID")
        if request_id:
            request_id = request_id[:64]
        else:
            request_id = str(uuid.uuid4())

        # Expose to route handlers and exception handlers (error-report context)
        request.state.request_id = request_id

        # Bind request ID to structlog context for all subsequent logs
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )

        # Process request
        response = await call_next(request)

        # Add request ID to response headers for client correlation
        response.headers["X-Request-ID"] = request_id

        return response
