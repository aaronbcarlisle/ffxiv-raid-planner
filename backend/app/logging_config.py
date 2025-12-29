"""Structured logging configuration using structlog"""

import logging
import sys
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from .config import Settings


def configure_logging(settings: "Settings") -> None:
    """
    Configure structlog with environment-appropriate processors.

    - Development: Pretty console output with colors
    - Production: JSON format for log aggregation
    """
    # Shared processors for all environments
    # Note: We don't use add_logger_name because PrintLoggerFactory doesn't support it
    # The logger name is passed via get_logger() and bound to the context instead
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.environment == "development":
        # Development: pretty console output
        processors = shared_processors + [
            structlog.processors.ExceptionPrettyPrinter(),
            structlog.dev.ConsoleRenderer(colors=True),
        ]
    else:
        # Production: JSON output for log aggregation
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            _get_log_level(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Also configure standard library logging for uvicorn and other libraries
    _configure_stdlib_logging(settings)


def _get_log_level(level_name: str) -> int:
    """Convert log level name to logging constant."""
    levels = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return levels.get(level_name.upper(), logging.INFO)


def _configure_stdlib_logging(settings: "Settings") -> None:
    """Configure standard library logging to work with structlog."""
    log_level = _get_log_level(settings.log_level)

    # Configure root logger
    logging.basicConfig(
        format="%(message)s",
        level=log_level,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Reduce noise from verbose libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.debug else logging.WARNING
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a logger instance with the given name.

    Usage:
        from app.logging_config import get_logger
        logger = get_logger(__name__)

        logger.info("something_happened", user_id="123", action="login")
    """
    return structlog.get_logger().bind(logger=name)
