"""
Async client for the FFXIV Collect public REST API.
https://ffxivcollect.com/api/

Fetches mounts, minions, and orchestrion catalog data.
Results are returned as raw dicts — the import service maps them to catalog items.

API response shape:
  { "query": {...}, "count": <page_count>, "results": [...] }
  NOTE: "count" is items returned in THIS page, not the global total.
        Pagination terminates when len(batch) < limit.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://ffxivcollect.com/api"
DEFAULT_LIMIT = 500
TIMEOUT_SECONDS = 20  # Per-request timeout; callers impose overall timeout via asyncio.wait_for


class FfxivCollectError(Exception):
    pass


async def _fetch_collection(endpoint: str, limit: int = DEFAULT_LIMIT) -> list[dict[str, Any]]:
    """Paginate through a FFXIV Collect endpoint and return all results."""
    results: list[dict[str, Any]] = []
    page = 1
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        while True:
            try:
                resp = await client.get(
                    f"{BASE_URL}/{endpoint}",
                    params={"limit": limit, "page": page},
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as exc:
                raise FfxivCollectError(f"FFXIV Collect API error for {endpoint}: {exc}") from exc
            except Exception as exc:
                raise FfxivCollectError(f"Unexpected error fetching {endpoint}: {exc}") from exc

            batch = data.get("results", [])
            results.extend(batch)

            # API returns "count" = items in this page, no global total field.
            # Stop when page is not full (last page) or empty.
            if not batch or len(batch) < limit:
                break
            page += 1

    logger.info("ffxiv_collect_fetched", endpoint=endpoint, count=len(results))
    return results


async def fetch_mounts() -> list[dict[str, Any]]:
    return await _fetch_collection("mounts")


async def fetch_minions() -> list[dict[str, Any]]:
    return await _fetch_collection("minions")


async def fetch_orchestrion() -> list[dict[str, Any]]:
    return await _fetch_collection("orchestrions")
