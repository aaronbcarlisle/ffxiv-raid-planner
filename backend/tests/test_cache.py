"""Tests for cache service, particularly local cache TTL enforcement."""

import asyncio
import time
from unittest.mock import patch

import pytest

from app.cache import CacheService, _LocalEntry


class TestLocalCacheTTL:
    """Test TTL enforcement in local cache fallback."""

    @pytest.fixture
    def cache(self):
        """Create a cache service with short TTL for testing."""
        return CacheService("test", ttl=1)  # 1 second TTL

    @pytest.mark.asyncio
    async def test_set_stores_with_expiration(self, cache):
        """Setting a value should store it with expiration timestamp."""
        await cache.set("key1", {"data": "value"})

        full_key = cache._make_key("key1")
        entry = cache._local_cache.get(full_key)

        assert entry is not None
        assert isinstance(entry, _LocalEntry)
        assert entry.value == {"data": "value"}
        # Should expire in approximately 1 second
        assert entry.expires_at > time.time()
        assert entry.expires_at <= time.time() + 2

    @pytest.mark.asyncio
    async def test_get_returns_value_before_expiration(self, cache):
        """Get should return value before TTL expires."""
        await cache.set("key1", {"data": "value"})

        result = await cache.get("key1")
        assert result == {"data": "value"}

    @pytest.mark.asyncio
    async def test_get_returns_none_after_expiration(self, cache):
        """Get should return None after TTL expires."""
        await cache.set("key1", {"data": "value"})

        # Wait for expiration
        await asyncio.sleep(1.1)

        result = await cache.get("key1")
        assert result is None

    @pytest.mark.asyncio
    async def test_exists_returns_true_before_expiration(self, cache):
        """Exists should return True before TTL expires."""
        await cache.set("key1", {"data": "value"})

        result = await cache.exists("key1")
        assert result is True

    @pytest.mark.asyncio
    async def test_exists_returns_false_after_expiration(self, cache):
        """Exists should return False after TTL expires."""
        await cache.set("key1", {"data": "value"})

        # Wait for expiration
        await asyncio.sleep(1.1)

        result = await cache.exists("key1")
        assert result is False

    @pytest.mark.asyncio
    async def test_purge_expired_removes_old_entries(self, cache):
        """Purge should remove expired entries."""
        # Set multiple entries
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")

        # Wait for expiration
        await asyncio.sleep(1.1)

        # Trigger purge via get
        await cache.get("nonexistent")

        # Both entries should be purged
        assert len(cache._local_cache) == 0

    @pytest.mark.asyncio
    async def test_custom_ttl_per_key(self, cache):
        """Custom TTL should override default."""
        # Set with longer TTL
        await cache.set("key1", "value1", ttl=5)

        # Wait past default TTL
        await asyncio.sleep(1.1)

        # Should still exist (has 5 second TTL)
        result = await cache.get("key1")
        assert result == "value1"

    @pytest.mark.asyncio
    async def test_oauth_state_expires(self):
        """OAuth state cache should expire entries (security critical)."""
        from app.cache import oauth_state_cache

        # Store a state (normally has 600s TTL, we'll mock time)
        await oauth_state_cache.set("test_state", {"created": "now"})

        # Verify it exists
        assert await oauth_state_cache.exists("test_state") is True

        # Manually expire the entry by setting expires_at to past
        full_key = oauth_state_cache._make_key("test_state")
        entry = oauth_state_cache._local_cache.get(full_key)
        if entry:
            oauth_state_cache._local_cache[full_key] = _LocalEntry(
                value=entry.value, expires_at=time.time() - 1
            )

        # Should now be expired
        assert await oauth_state_cache.exists("test_state") is False
        assert await oauth_state_cache.get("test_state") is None

        # Clean up
        await oauth_state_cache.delete("test_state")
