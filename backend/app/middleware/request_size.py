"""Request size limit middleware to prevent DoS attacks."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..logging_config import get_logger

logger = get_logger(__name__)

# Default maximum request size: 10MB
DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Limit request body size to prevent DoS attacks.

    Checks Content-Length header before processing and rejects
    requests that exceed the configured limit.

    IMPORTANT: This middleware only checks the Content-Length header.
    It can be bypassed by:
    - Chunked transfer encoding (no Content-Length header)
    - Malicious clients omitting the header

    For production deployments, configure your reverse proxy to enforce
    request size limits at the edge:
    - Nginx: client_max_body_size 10m;
    - Traefik: maxRequestBodyBytes: 10485760
    - Caddy: request_body { max_size 10MB }

    Despite these limitations, this middleware is still valuable:
    - Early rejection before body parsing saves server resources
    - Protects against accidental large uploads from well-behaved clients
    - Defense-in-depth when combined with reverse proxy limits
    """

    def __init__(self, app, max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES):
        super().__init__(app)
        self.max_size_bytes = max_size_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        # Check Content-Length header if present
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                size = int(content_length)
                if size > self.max_size_bytes:
                    logger.warning(
                        "request_too_large",
                        path=request.url.path,
                        content_length=size,
                        max_size=self.max_size_bytes,
                        client_ip=request.client.host if request.client else "unknown",
                    )
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": "request_too_large",
                            "message": f"Request body exceeds maximum size of {self.max_size_bytes // (1024 * 1024)}MB",
                        },
                    )
            except ValueError:
                # Invalid Content-Length header, let it through for normal handling
                pass

        return await call_next(request)
