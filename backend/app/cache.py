"""Redis cache with in-memory fallback for development without Redis"""

import json
import time
from dataclasses import dataclass
from typing import Any

from .config import get_settings
from .logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class _LocalEntry:
    """Local cache entry with expiration timestamp."""

    value: Any
    expires_at: float

# Global Redis client (set during init)
_redis: Any = None


async def init_cache() -> None:
    """Initialize Redis connection if configured."""
    global _redis
    settings = get_settings()

    if not settings.redis_url:
        logger.info("cache_init", backend="memory", reason="redis_url_not_configured")
        return

    try:
        import redis.asyncio as redis

        _redis = redis.from_url(settings.redis_url, decode_responses=True)
        # Test connection
        await _redis.ping()
        logger.info("cache_init", backend="redis", url=settings.redis_url.split("@")[-1])
    except Exception as e:
        logger.warning("cache_init_failed", backend="memory", error=str(e))
        _redis = None


async def close_cache() -> None:
    """Close Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
        logger.info("cache_closed")


def get_cache():
    """Get the Redis client (may be None if not configured)."""
    return _redis


class CacheService:
    """
    High-level caching service with automatic in-memory fallback.

    Usage:
        cache = CacheService("oauth_state", ttl=600)
        await cache.set("key", {"data": "value"})
        data = await cache.get("key")
    """

    def __init__(self, prefix: str, ttl: int = 3600):
        """
        Initialize cache service.

        Args:
            prefix: Key prefix for namespacing (e.g., "oauth_state", "xivapi_item")
            ttl: Default time-to-live in seconds
        """
        self.prefix = prefix
        self.ttl = ttl
        self._local_cache: dict[str, _LocalEntry] = {}

    def _purge_expired(self) -> None:
        """Remove expired entries from local cache."""
        now = time.time()
        expired_keys = [
            key for key, entry in self._local_cache.items() if entry.expires_at <= now
        ]
        for key in expired_keys:
            del self._local_cache[key]

    def _make_key(self, key: str) -> str:
        """Create a namespaced cache key."""
        return f"{self.prefix}:{key}"

    async def get(self, key: str) -> Any | None:
        """
        Get a value from cache.

        Returns:
            Cached value or None if not found/expired.
        """
        full_key = self._make_key(key)

        if _redis:
            try:
                data = await _redis.get(full_key)
                if data:
                    return json.loads(data)
            except Exception as e:
                logger.warning("cache_get_error", key=full_key, error=str(e))

        # Fallback to local cache with TTL enforcement
        self._purge_expired()
        entry = self._local_cache.get(full_key)
        if entry is not None:
            # Double-check expiration (in case of race)
            if entry.expires_at > time.time():
                return entry.value
            # Entry expired, remove it
            del self._local_cache[full_key]
        return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """
        Set a value in cache.

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Optional TTL override in seconds
        """
        full_key = self._make_key(key)
        ttl = ttl or self.ttl

        if _redis:
            try:
                await _redis.setex(full_key, ttl, json.dumps(value))
                return
            except Exception as e:
                logger.warning("cache_set_error", key=full_key, error=str(e))

        # Fallback to local cache with TTL enforcement
        self._purge_expired()
        self._local_cache[full_key] = _LocalEntry(
            value=value, expires_at=time.time() + ttl
        )

    async def delete(self, key: str) -> None:
        """Delete a value from cache."""
        full_key = self._make_key(key)

        if _redis:
            try:
                await _redis.delete(full_key)
            except Exception as e:
                logger.warning("cache_delete_error", key=full_key, error=str(e))

        # Also remove from local cache
        self._local_cache.pop(full_key, None)

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache (and is not expired)."""
        full_key = self._make_key(key)

        if _redis:
            try:
                return await _redis.exists(full_key) > 0
            except Exception as e:
                logger.warning("cache_exists_error", key=full_key, error=str(e))

        # Check local cache with TTL enforcement
        self._purge_expired()
        entry = self._local_cache.get(full_key)
        if entry is not None and entry.expires_at > time.time():
            return True
        return False


# Pre-configured cache instances
oauth_state_cache = CacheService("oauth_state", ttl=600)  # 10 minutes
xivapi_item_cache = CacheService("xivapi_item", ttl=86400)  # 24 hours
bis_preset_cache = CacheService("bis_preset", ttl=3600)  # 1 hour
