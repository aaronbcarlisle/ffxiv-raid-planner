"""Centralized exception handling for consistent error responses."""

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
        # Don't expose internal error details in production
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "An unexpected error occurred",
                "details": {},
            },
        )
