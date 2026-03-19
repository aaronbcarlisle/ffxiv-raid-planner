"""Centralized exception handling for consistent error responses."""

import hashlib
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .logging_config import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    """Base exception for application-specific errors."""

    def __init__(
        self,
        error: str,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.error = error
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(AppException):
    """Resource not found (404)."""

    def __init__(self, resource: str, identifier: str | None = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} '{identifier}' not found"
        super().__init__(
            error="not_found",
            message=message,
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )


class PermissionDeniedError(AppException):
    """Permission denied (403)."""

    def __init__(self, action: str, resource: str | None = None):
        message = f"Permission denied: {action}"
        if resource:
            message = f"Permission denied: cannot {action} {resource}"
        super().__init__(
            error="permission_denied",
            message=message,
            status_code=403,
            details={"action": action, "resource": resource},
        )


class ValidationError(AppException):
    """Validation error (422)."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(
            error="validation_error",
            message=message,
            status_code=422,
            details={"field": field} if field else {},
        )


class ExternalServiceError(AppException):
    """External service error (502)."""

    def __init__(self, service: str, message: str | None = None):
        error_message = f"External service error: {service}"
        if message:
            error_message = f"{error_message} - {message}"
        super().__init__(
            error="external_service_error",
            message=error_message,
            status_code=502,
            details={"service": service},
        )


class ConflictError(AppException):
    """Resource conflict (409)."""

    def __init__(self, message: str, resource: str | None = None):
        super().__init__(
            error="conflict",
            message=message,
            status_code=409,
            details={"resource": resource} if resource else {},
        )


async def _capture_error_report(
    request: Request,
    exc: Exception,
    error_type: str,
    severity: str = "error",
) -> None:
    """Capture an error into the error_reports table for admin visibility.

    Best-effort: failures are logged but never propagate to the caller.
    """
    try:
        from .database import async_session_maker
        from .models.analytics import ErrorReport

        exc_name = type(exc).__name__
        message = str(exc)
        path = request.url.path

        fingerprint = hashlib.sha256(
            f"{exc_name}:{message}:{path}".encode()
        ).hexdigest()

        # Extract user_id from JWT cookie if available (best-effort)
        user_id = None
        try:
            from .auth_utils import verify_token

            token = request.cookies.get("access_token")
            if token:
                user_id = verify_token(token, token_type="access")
        except Exception:
            pass

        context = {
            "path": path,
            "method": request.method,
            "request_id": getattr(request.state, "request_id", None),
        }

        # Add ExternalServiceError-specific context
        if isinstance(exc, ExternalServiceError):
            context["service"] = exc.details.get("service")

        async with async_session_maker() as session:
            error_report = ErrorReport(
                fingerprint=fingerprint,
                user_id=user_id,
                error_type=error_type,
                message=message[:2000],  # Truncate very long messages
                stack_trace=None,  # Backend errors don't have JS stack traces
                context=context,
                severity=severity,
                source="backend",
            )
            session.add(error_report)
            await session.commit()
    except Exception as capture_exc:
        # Never let error capture break the error response
        logger.warning(
            "error_capture_failed",
            capture_error=str(capture_exc),
            original_error=str(exc)[:200],
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        """Handle all AppException subclasses."""
        logger.warning(
            "app_exception",
            error=exc.error,
            message=exc.message,
            status_code=exc.status_code,
            path=request.url.path,
            details=exc.details,
        )

        # Capture ExternalServiceError (502) for admin visibility
        if isinstance(exc, ExternalServiceError):
            await _capture_error_report(
                request, exc, error_type="external_service_error", severity="error"
            )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error,
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Handle unexpected exceptions with a generic error response."""
        logger.exception(
            "unhandled_exception",
            path=request.url.path,
            exception_type=type(exc).__name__,
            message=str(exc),
        )

        # Capture unhandled 500s for admin visibility
        await _capture_error_report(
            request, exc, error_type="backend_error", severity="critical"
        )

        # Don't expose internal error details in production
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "An unexpected error occurred",
                "details": {},
            },
        )
