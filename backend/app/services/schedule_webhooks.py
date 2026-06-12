"""Shared helpers for schedule Discord webhook delivery."""

from dataclasses import dataclass
from typing import Any

import httpx

from ..logging_config import get_logger
from ..models.schedule import ScheduleSettings

logger = get_logger(__name__)


@dataclass(frozen=True)
class ScheduleWebhookDestination:
    webhook_url: str
    mention_target: str = "none"
    mention_role_id: str | None = None


def mask_webhook_url(webhook_url: str | None) -> str | None:
    if not webhook_url:
        return None
    return f"{webhook_url[:32]}...{webhook_url[-8:]}" if len(webhook_url) > 48 else "Configured"


def resolve_schedule_webhook(row: ScheduleSettings | None) -> ScheduleWebhookDestination | None:
    """Return the active schedule webhook destination, or None when disabled."""
    if not row or not row.webhook_url:
        return None
    mention_target = row.mention_target or "none"
    mention_role_id = row.mention_role_id if mention_target == "role" else None
    return ScheduleWebhookDestination(
        webhook_url=row.webhook_url,
        mention_target=mention_target,
        mention_role_id=mention_role_id,
    )


async def post_schedule_webhook(
    destination: ScheduleWebhookDestination,
    payload: dict[str, Any],
    *,
    timeout: float = 10.0,
) -> bool:
    """Post a schedule webhook and return True only when Discord accepts it."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(destination.webhook_url, json=payload)
    except httpx.RequestError as exc:
        logger.warning(
            "schedule_webhook_delivery_error",
            error=str(exc),
            webhook=mask_webhook_url(destination.webhook_url),
        )
        return False

    if response.status_code >= 400:
        logger.warning(
            "schedule_webhook_delivery_rejected",
            status=response.status_code,
            webhook=mask_webhook_url(destination.webhook_url),
        )
        return False

    return True
