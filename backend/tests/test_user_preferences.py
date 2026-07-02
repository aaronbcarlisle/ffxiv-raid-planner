"""Tests for PATCH /api/auth/me/preferences — user navigation preferences."""

import pytest


@pytest.mark.asyncio
class TestUserPreferences:
    """The tab_persistence navigation pref plus the partial-update contract
    shared with activity_display_mode."""

    async def test_default_on_new_user(self, client, auth_headers):
        """A fresh user gets the documented default: tabs are remembered."""
        r = await client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["tabPersistence"] == "remember"

    async def test_patch_tab_persistence(self, client, auth_headers):
        """PATCH updates tab_persistence and echoes it back (camelCase)."""
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"tabPersistence": "reset"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["tabPersistence"] == "reset"

    async def test_patch_persists(self, client, auth_headers):
        """A PATCHed value is committed — a follow-up GET reflects it."""
        await client.patch(
            "/api/auth/me/preferences",
            json={"tabPersistence": "reset"},
            headers=auth_headers,
        )
        r = await client.get("/api/auth/me", headers=auth_headers)
        assert r.json()["tabPersistence"] == "reset"

    async def test_rejects_invalid_value(self, client, auth_headers):
        """Only 'remember' | 'reset' are accepted."""
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"tabPersistence": "bogus"},
            headers=auth_headers,
        )
        assert r.status_code == 422

    async def test_partial_update_leaves_other_prefs_untouched(self, client, auth_headers):
        """Changing one preference must not clobber the others (the
        `if field is not None` partial-update guard)."""
        # Set tab_persistence away from its default.
        await client.patch(
            "/api/auth/me/preferences",
            json={"tabPersistence": "reset"},
            headers=auth_headers,
        )
        # Change only an unrelated preference.
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"activityDisplayMode": "anonymous"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["activityDisplayMode"] == "anonymous"
        assert data["tabPersistence"] == "reset"  # unchanged

    async def test_requires_auth(self, client):
        """Unauthenticated PATCH is rejected."""
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"tabPersistence": "reset"},
        )
        assert r.status_code in (401, 403)
