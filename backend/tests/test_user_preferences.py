"""Tests for PATCH /api/auth/me/preferences — user navigation preferences."""

import pytest


@pytest.mark.asyncio
class TestUserPreferences:
    """The two navigation prefs (remember_sub_tabs / remember_static_tab) plus
    the partial-update contract shared with activity_display_mode."""

    async def test_defaults_on_new_user(self, client, auth_headers):
        """A fresh user gets the documented defaults: sub-tabs remembered,
        static-tab not remembered."""
        r = await client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["rememberSubTabs"] is True
        assert data["rememberStaticTab"] is False

    async def test_patch_remember_sub_tabs(self, client, auth_headers):
        """PATCH updates remember_sub_tabs and echoes it back (camelCase)."""
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"rememberSubTabs": False},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["rememberSubTabs"] is False

    async def test_patch_persists(self, client, auth_headers):
        """A PATCHed value is committed — a follow-up GET reflects it."""
        await client.patch(
            "/api/auth/me/preferences",
            json={"rememberStaticTab": True},
            headers=auth_headers,
        )
        r = await client.get("/api/auth/me", headers=auth_headers)
        assert r.json()["rememberStaticTab"] is True

    async def test_partial_update_leaves_other_prefs_untouched(self, client, auth_headers):
        """Changing one preference must not clobber the others (the
        `if field is not None` partial-update guard). Regression guard: a
        non-None default on the schema would silently reset nav prefs whenever
        an unrelated preference changes."""
        # Set both nav prefs away from their defaults.
        await client.patch(
            "/api/auth/me/preferences",
            json={"rememberSubTabs": False, "rememberStaticTab": True},
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
        assert data["rememberSubTabs"] is False  # unchanged
        assert data["rememberStaticTab"] is True  # unchanged

    async def test_requires_auth(self, client):
        """Unauthenticated PATCH is rejected."""
        r = await client.patch(
            "/api/auth/me/preferences",
            json={"rememberSubTabs": False},
        )
        assert r.status_code in (401, 403)
