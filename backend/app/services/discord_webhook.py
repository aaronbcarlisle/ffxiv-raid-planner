"""Discord webhook service for error alerts."""

import asyncio
from datetime import datetime, timezone

import httpx

from ..config import get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()


class DiscordWebhookService:
    """Sends error alerts to a Discord webhook channel."""

    def __init__(self) -> None:
        self._rate_limit: dict[str, float] = {}  # fingerprint -> last_sent_timestamp
        self._rate_limit_seconds = 3600  # 1 hour per fingerprint

    @property
    def webhook_url(self) -> str | None:
        return getattr(settings, "discord_webhook_url", None)

    async def send_error_alert(
        self,
        fingerprint: str,
        message: str,
        count: int,
        affected_users: int,
        severity: str = "error",
    ) -> None:
        """Send an error alert to Discord. Rate-limited per fingerprint."""
        if not self.webhook_url:
            return

        # Rate limit: max 1 per fingerprint per hour
        now = datetime.now(timezone.utc).timestamp()
        last_sent = self._rate_limit.get(fingerprint, 0)
        if now - last_sent < self._rate_limit_seconds:
            return
        self._rate_limit[fingerprint] = now

        # Clean old entries (prevent memory leak)
        cutoff = now - self._rate_limit_seconds
        self._rate_limit = {
            fp: ts for fp, ts in self._rate_limit.items() if ts > cutoff
        }

        color = 0xFF0000 if severity == "critical" else 0xFFA500  # Red or orange

        embed = {
            "title": f"{'Red circle' if severity == 'critical' else 'Orange circle'} Error Alert",
            "description": message[:200],
            "color": color,
            "fields": [
                {"name": "Occurrences", "value": str(count), "inline": True},
                {"name": "Affected Users", "value": str(affected_users), "inline": True},
                {"name": "Severity", "value": severity.upper(), "inline": True},
                {
                    "name": "Fingerprint",
                    "value": f"`{fingerprint[:16]}...`",
                    "inline": False,
                },
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.webhook_url,
                    json={"embeds": [embed]},
                    timeout=10.0,
                )
                if response.status_code not in (200, 204):
                    logger.warning(
                        "discord_webhook_failed",
                        status=response.status_code,
                        fingerprint=fingerprint,
                    )
        except Exception as e:
            logger.warning(
                "discord_webhook_error", error=str(e), fingerprint=fingerprint
            )


# Singleton instance
discord_webhook = DiscordWebhookService()
