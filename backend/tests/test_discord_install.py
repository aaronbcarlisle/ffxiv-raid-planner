"""
Acceptance tests for the Discord install-claim + StaticDiscordLink flow.

Acceptance criteria:
  1. Create install claim returns a claim code in XRP-XXXX-XXXX format
  2. Expired claim is rejected by slash-claim endpoint
  3. Valid slash command claim creates a StaticDiscordLink
  4. Wrong claim code is rejected
  5. Connected static uses StaticDiscordLink for mirror (not per-static token)
  6. Missing CREATE_EVENTS permission marks link as permission_missing
  7. Mirror endpoint doesn't require per-static bot token when official bot is set
  8. Webhook reminders still work independently of bot link
  9. Multiple statics can link to the same Discord guild
 10. Disconnect sets status=disconnected without deleting the link row
"""

import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token
from app.models import DiscordInstallClaim, StaticDiscordLink, User
from tests.factories import create_membership, create_static_group, create_user
from app.models.membership import MemberRole

pytestmark = pytest.mark.asyncio

_FAKE_BOT_TOKEN = "Bot.fake.test.token.for.unit.tests"
_GUILD_ID = "111222333444555666"
_GUILD_NAME = "Test Static Server"
_DISCORD_USER = "999000111222333444"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _owner_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _bot_headers() -> dict[str, str]:
    return {"Authorization": f"Bot {_FAKE_BOT_TOKEN}"}


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(session: AsyncSession) -> User:
    return await create_user(session, discord_id="100000000000000001", discord_username="owner")


@pytest_asyncio.fixture
async def group(session: AsyncSession, owner: User):
    return await create_static_group(session, owner, name="Raid Static Alpha")


@pytest_asyncio.fixture
async def group2(session: AsyncSession, owner: User):
    return await create_static_group(session, owner, name="Raid Static Beta")


# ── Test 1: Create install claim ──────────────────────────────────────────────

class TestCreateInstallClaim:
    async def test_returns_claim_code(self, client: AsyncClient, owner: User, group):
        with patch("app.routers.schedule.get_settings") as mock_cfg:
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                f"/api/static-groups/{group.id}/schedule-discord/install-claim",
                headers=_owner_headers(owner),
            )
        assert resp.status_code == 201
        data = resp.json()
        assert "claimCode" in data
        code = data["claimCode"]
        # Must match XRP-XXXX-XXXX (8 uppercase hex chars in two groups of 4)
        parts = code.split("-")
        assert len(parts) == 3
        assert parts[0] == "XRP"
        assert len(parts[1]) == 4
        assert len(parts[2]) == 4

    async def test_revokes_previous_pending_claim(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        with patch("app.routers.schedule.get_settings") as mock_cfg:
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            await client.post(
                f"/api/static-groups/{group.id}/schedule-discord/install-claim",
                headers=_owner_headers(owner),
            )
            resp = await client.post(
                f"/api/static-groups/{group.id}/schedule-discord/install-claim",
                headers=_owner_headers(owner),
            )
        assert resp.status_code == 201
        # Only one pending claim should exist
        result = await session.execute(
            select(DiscordInstallClaim)
            .where(DiscordInstallClaim.static_group_id == group.id)
            .where(DiscordInstallClaim.status == "pending")
        )
        claims = result.scalars().all()
        assert len(claims) == 1


# ── Test 2: Expired claim is rejected ────────────────────────────────────────

class TestExpiredClaim:
    async def test_expired_claim_returns_400(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        # Insert a pre-expired claim directly
        now = datetime.now(timezone.utc)
        expired_at = (now - timedelta(minutes=1)).isoformat()
        plain_code = "XRP-ABCD-EF01"
        claim = DiscordInstallClaim(
            id="test-claim-expired-1111",
            static_group_id=group.id,
            created_by_id=owner.id,
            claim_token_hash=_hash(plain_code),
            expires_at=expired_at,
            status="pending",
        )
        session.add(claim)
        await session.flush()

        with patch("app.routers.schedule.get_settings") as mock_cfg:
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                "/api/discord/slash-claim",
                json={
                    "claimCode": plain_code,
                    "discordGuildId": _GUILD_ID,
                    "discordGuildName": _GUILD_NAME,
                    "discordUserId": _DISCORD_USER,
                },
                headers=_bot_headers(),
            )
        assert resp.status_code in (400, 410)


# ── Test 3: Slash command creates StaticDiscordLink ──────────────────────────

class TestSlashClaim:
    async def test_valid_claim_creates_link(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        now = datetime.now(timezone.utc)
        expires = (now + timedelta(minutes=15)).isoformat()
        plain_code = "XRP-CAFE-BABE"
        claim = DiscordInstallClaim(
            id="test-claim-valid-2222",
            static_group_id=group.id,
            created_by_id=owner.id,
            claim_token_hash=_hash(plain_code),
            expires_at=expires,
            status="pending",
        )
        session.add(claim)
        await session.flush()

        fake_perms = {"ok": True, "has_manage_events": True, "error": ""}
        initial_sync = AsyncMock(return_value=["skipped: no sessions to sync"])
        with (
            patch("app.routers.schedule.get_settings") as mock_cfg,
            patch("app.routers.schedule.check_bot_permissions", new=AsyncMock(return_value=fake_perms)),
            patch("app.routers.schedule.sync_group_sessions_for_discord_link", new=initial_sync),
        ):
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                "/api/discord/slash-claim",
                json={
                    "claimCode": plain_code,
                    "discordGuildId": _GUILD_ID,
                    "discordGuildName": _GUILD_NAME,
                    "discordUserId": _DISCORD_USER,
                },
                headers=_bot_headers(),
            )

        assert resp.status_code == 200, resp.text
        initial_sync.assert_awaited_once()

        # Link must exist in DB with status=connected
        result = await session.execute(
            select(StaticDiscordLink).where(StaticDiscordLink.static_group_id == group.id)
        )
        link = result.scalar_one_or_none()
        assert link is not None
        assert link.discord_guild_id == _GUILD_ID
        assert link.status == "connected"

        # Original claim must be marked claimed
        await session.refresh(claim)
        assert claim.status == "claimed"


# ── Test 4: Wrong claim code is rejected ─────────────────────────────────────

class TestWrongClaim:
    async def test_wrong_code_returns_404(self, client: AsyncClient, owner: User, group):
        with patch("app.routers.schedule.get_settings") as mock_cfg:
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                "/api/discord/slash-claim",
                json={
                    "claimCode": "XRP-DEAD-BEEF",
                    "discordGuildId": _GUILD_ID,
                    "discordGuildName": _GUILD_NAME,
                    "discordUserId": _DISCORD_USER,
                },
                headers=_bot_headers(),
            )
        assert resp.status_code in (400, 404)


# ── Test 5: Connected static uses StaticDiscordLink for mirror ───────────────

class TestMirrorUsesLink:
    async def test_sync_uses_official_bot_token(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        link = StaticDiscordLink(
            id="test-link-5555",
            static_group_id=group.id,
            discord_guild_id=_GUILD_ID,
            discord_guild_name=_GUILD_NAME,
            linked_by_user_id=owner.id,
            status="connected",
        )
        session.add(link)
        await session.flush()

        # Create a recurring session
        resp = await client.post(
            f"/api/static-groups/{group.id}/schedule",
            json={
                "title": "Weekly Prog",
                "startTime": "2026-07-01T20:00:00+00:00",
                "endTime": "2026-07-01T23:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": True,
                "recurrenceRule": "FREQ=WEEKLY;BYDAY=TU",
            },
            headers=_owner_headers(owner),
        )
        assert resp.status_code == 201
        session_id = resp.json()["id"]

        captured_token: list[str] = []

        async def fake_sync(*args, **kwargs):
            # Record what token was used (via discord_link vs settings)
            discord_link = kwargs.get("discord_link")
            if discord_link is not None:
                captured_token.append("used_link")
            return []

        with (
            patch("app.routers.schedule.get_settings") as mock_cfg,
            patch("app.routers.schedule.sync_session_mirror", new=AsyncMock(side_effect=fake_sync)),
        ):
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                f"/api/static-groups/{group.id}/schedule/{session_id}/sync-discord",
                headers=_owner_headers(owner),
            )

        assert resp.status_code == 200
        assert "used_link" in captured_token

    async def test_group_sync_uses_backend_session_list(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        link = StaticDiscordLink(
            id="test-link-group-sync",
            static_group_id=group.id,
            discord_guild_id=_GUILD_ID,
            discord_guild_name=_GUILD_NAME,
            linked_by_user_id=owner.id,
            status="connected",
        )
        session.add(link)
        await session.flush()

        resp = await client.post(
            f"/api/static-groups/{group.id}/schedule",
            json={
                "title": "Group Sync Prog",
                "startTime": "2026-07-01T20:00:00+00:00",
                "endTime": "2026-07-01T23:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": False,
            },
            headers=_owner_headers(owner),
        )
        assert resp.status_code == 201

        initial_sync = AsyncMock(return_value=["Group Sync Prog: created discord event for 2026-07-01: ok"])
        with (
            patch("app.routers.schedule.get_settings") as mock_cfg,
            patch("app.routers.schedule.sync_group_sessions_for_discord_link", new=initial_sync),
        ):
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                f"/api/static-groups/{group.id}/schedule/sync-discord",
                headers=_owner_headers(owner),
            )

        assert resp.status_code == 200
        initial_sync.assert_awaited_once()
        assert resp.json()["actions"] == ["Group Sync Prog: created discord event for 2026-07-01: ok"]


# ── Test 6: Missing permission marks link as permission_missing ───────────────

class TestPermissionMissing:
    async def test_permission_missing_sets_status(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        now = datetime.now(timezone.utc)
        expires = (now + timedelta(minutes=15)).isoformat()
        plain_code = "XRP-PERM-MISS"
        claim = DiscordInstallClaim(
            id="test-claim-perm-6666",
            static_group_id=group.id,
            created_by_id=owner.id,
            claim_token_hash=_hash(plain_code),
            expires_at=expires,
            status="pending",
        )
        session.add(claim)
        await session.flush()

        fake_perms = {"ok": False, "has_manage_events": False, "error": "Missing MANAGE_EVENTS"}
        with (
            patch("app.routers.schedule.get_settings") as mock_cfg,
            patch("app.routers.schedule.check_bot_permissions", new=AsyncMock(return_value=fake_perms)),
        ):
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            resp = await client.post(
                "/api/discord/slash-claim",
                json={
                    "claimCode": plain_code,
                    "discordGuildId": _GUILD_ID,
                    "discordGuildName": _GUILD_NAME,
                    "discordUserId": _DISCORD_USER,
                },
                headers=_bot_headers(),
            )

        assert resp.status_code == 200
        result = await session.execute(
            select(StaticDiscordLink).where(StaticDiscordLink.static_group_id == group.id)
        )
        link = result.scalar_one_or_none()
        assert link is not None
        assert link.status == "permission_missing"


# ── Test 7: Mirror doesn't require per-static token ──────────────────────────

class TestNoPerStaticToken:
    async def test_sync_works_without_per_static_token(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        """StaticDiscordLink present + app bot token → sync succeeds without per-static token in settings."""
        link = StaticDiscordLink(
            id="test-link-7777",
            static_group_id=group.id,
            discord_guild_id=_GUILD_ID,
            linked_by_user_id=owner.id,
            status="connected",
        )
        session.add(link)
        await session.flush()

        resp = await client.post(
            f"/api/static-groups/{group.id}/schedule",
            json={
                "title": "Prog Night",
                "startTime": "2026-08-01T20:00:00+00:00",
                "endTime": "2026-08-01T23:00:00+00:00",
                "timezone": "UTC",
                "isRecurring": True,
                "recurrenceRule": "FREQ=WEEKLY;BYDAY=FR",
            },
            headers=_owner_headers(owner),
        )
        assert resp.status_code == 201
        session_id = resp.json()["id"]

        with (
            patch("app.routers.schedule.get_settings") as mock_cfg,
            patch("app.routers.schedule.sync_session_mirror", new=AsyncMock(return_value=[])),
        ):
            mock_cfg.return_value.discord_bot_token = _FAKE_BOT_TOKEN
            # Settings have NO per-static discord_bot_token
            resp = await client.post(
                f"/api/static-groups/{group.id}/schedule/{session_id}/sync-discord",
                headers=_owner_headers(owner),
            )

        assert resp.status_code == 200


# ── Test 8: Webhook reminders work independently ──────────────────────────────

class TestWebhookIndependence:
    async def test_webhook_reminder_not_blocked_by_link_status(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        """Saving webhook settings works regardless of Discord link state."""
        resp = await client.put(
            f"/api/static-groups/{group.id}/scheduler/settings",
            json={
                "webhookUrl": "https://discord.com/api/webhooks/fake/url",
                "enableAtStartReminder": True,
            },
            headers=_owner_headers(owner),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["webhookConfigured"] is True


# ── Test 9: Multiple statics can link to the same guild ──────────────────────

class TestMultipleStaticsSameGuild:
    async def test_two_statics_link_same_guild(
        self, client: AsyncClient, owner: User, group, group2, session: AsyncSession
    ):
        link1 = StaticDiscordLink(
            id="test-link-g1-9999",
            static_group_id=group.id,
            discord_guild_id=_GUILD_ID,
            linked_by_user_id=owner.id,
            status="connected",
        )
        link2 = StaticDiscordLink(
            id="test-link-g2-9999",
            static_group_id=group2.id,
            discord_guild_id=_GUILD_ID,  # same guild
            linked_by_user_id=owner.id,
            status="connected",
        )
        session.add(link1)
        session.add(link2)
        await session.flush()

        # Both links exist with distinct IDs
        result = await session.execute(
            select(StaticDiscordLink).where(StaticDiscordLink.discord_guild_id == _GUILD_ID)
        )
        links = result.scalars().all()
        assert len(links) == 2
        group_ids = {l.static_group_id for l in links}
        assert group.id in group_ids
        assert group2.id in group_ids


# ── Test 10: Disconnect sets status=disconnected ──────────────────────────────

class TestDisconnect:
    async def test_disconnect_sets_status_without_deleting(
        self, client: AsyncClient, owner: User, group, session: AsyncSession
    ):
        link = StaticDiscordLink(
            id="test-link-disc-1010",
            static_group_id=group.id,
            discord_guild_id=_GUILD_ID,
            linked_by_user_id=owner.id,
            status="connected",
        )
        session.add(link)
        await session.flush()

        resp = await client.delete(
            f"/api/static-groups/{group.id}/schedule-discord/link",
            headers=_owner_headers(owner),
        )
        assert resp.status_code in (200, 204)

        await session.refresh(link)
        assert link.status == "disconnected"
        # Row still exists — not hard-deleted
        result = await session.execute(
            select(StaticDiscordLink).where(StaticDiscordLink.id == link.id)
        )
        assert result.scalar_one_or_none() is not None
