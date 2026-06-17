"""Discord Interactions endpoint — receives slash commands directly from Discord.

Discord POSTs signed payloads to /api/discord/interactions for every slash command.
This replaces the need for a long-running bot process.

Setup (one-time, in Discord Developer Portal):
  1. Set Interactions Endpoint URL → https://<your-domain>/api/discord/interactions
  2. Run backend/register_slash_commands.py to register /xrp link

Signature verification uses DISCORD_PUBLIC_KEY from .env (Ed25519 / hex string).
If DISCORD_PUBLIC_KEY is not set the endpoint returns 501 — it must be configured
before Discord will accept the endpoint URL.
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_session
from ..logging_config import get_logger
from ..models.schedule import DiscordInstallClaim, StaticDiscordLink
from ..services.discord_guild_events import check_bot_permissions, sync_group_sessions_for_discord_link

logger = get_logger(__name__)

router = APIRouter(tags=["discord"])

# Discord interaction types
_PING = 1
_APPLICATION_COMMAND = 2

# Discord interaction response types
_PONG = 1
_CHANNEL_MESSAGE_WITH_SOURCE = 4


# ── Signature verification ────────────────────────────────────────────────────

def _verify_signature(public_key_hex: str, signature_hex: str, timestamp: str, body: bytes) -> bool:
    try:
        pub = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
        pub.verify(bytes.fromhex(signature_hex), timestamp.encode() + body)
        return True
    except (InvalidSignature, ValueError):
        return False


# ── Claim logic (shared with /discord/slash-claim) ───────────────────────────

async def _process_link_claim(
    claim_code: str,
    guild_id: str,
    guild_name: str | None,
    channel_id: str | None,
    discord_user_id: str,
    db: AsyncSession,
) -> tuple[str, int]:
    """Run the install-claim flow; return link status and initial sync count."""
    token_hash = hashlib.sha256(claim_code.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    result = await db.execute(
        select(DiscordInstallClaim).where(DiscordInstallClaim.claim_token_hash == token_hash)
    )
    claim = result.scalar_one_or_none()

    if not claim:
        raise HTTPException(status_code=404, detail="Claim code not found")

    if claim.status != "pending":
        raise HTTPException(status_code=409, detail=f"Claim already {claim.status}")

    try:
        expires_dt = datetime.fromisoformat(claim.expires_at)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if now > expires_dt:
            claim.status = "expired"
            claim.updated_at = now_iso
            await db.commit()
            raise HTTPException(status_code=410, detail="Claim code has expired")
    except ValueError:
        raise HTTPException(status_code=500, detail="Invalid claim expiry format")

    bot_token = get_settings().discord_bot_token
    perm_status = "connected"
    if bot_token:
        perm = await check_bot_permissions(guild_id, bot_token)
        if not perm.get("ok") or not perm.get("has_manage_events", True):
            perm_status = "permission_missing"

    link_result = await db.execute(
        select(StaticDiscordLink).where(StaticDiscordLink.static_group_id == claim.static_group_id)
    )
    link = link_result.scalar_one_or_none()

    if link is None:
        link = StaticDiscordLink(
            id=str(uuid.uuid4()),
            static_group_id=claim.static_group_id,
            discord_guild_id=guild_id,
            discord_guild_name=guild_name,
            schedule_channel_id=channel_id,
            linked_by_user_id=claim.created_by_id,
            status=perm_status,
            last_permission_check_at=now_iso,
            created_at=now_iso,
            updated_at=now_iso,
        )
        db.add(link)
    else:
        link.discord_guild_id = guild_id
        link.discord_guild_name = guild_name
        link.schedule_channel_id = channel_id
        link.status = perm_status
        link.last_permission_check_at = now_iso
        link.updated_at = now_iso

    claim.status = "claimed"
    claim.discord_guild_id = guild_id
    claim.discord_channel_id = channel_id
    claim.claimed_by_discord_user_id = discord_user_id
    claim.updated_at = now_iso

    await db.commit()

    initial_sync_actions = await sync_group_sessions_for_discord_link(
        db=db,
        group_id=claim.static_group_id,
        discord_link=link,
    )
    await db.commit()

    logger.info(
        "discord_slash_link_claimed",
        group_id=claim.static_group_id,
        guild_id=guild_id,
        discord_user=discord_user_id,
        perm_status=perm_status,
        initial_sync_actions=len(initial_sync_actions),
    )
    return perm_status, len(initial_sync_actions)


# ── Main interactions endpoint ────────────────────────────────────────────────

@router.post("/api/discord/interactions")
async def discord_interactions(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Discord Interactions Endpoint URL target.

    Discord verifies this endpoint with a PING before accepting it in the
    Developer Portal.  After that, every slash command fires here.
    """
    settings = get_settings()

    if not settings.discord_public_key:
        raise HTTPException(
            status_code=501,
            detail="DISCORD_PUBLIC_KEY is not configured — cannot verify interactions",
        )

    # Read the raw body (needed for signature verification)
    body = await request.body()
    signature = request.headers.get("X-Signature-Ed25519", "")
    timestamp = request.headers.get("X-Signature-Timestamp", "")

    if not signature or not timestamp:
        raise HTTPException(status_code=401, detail="Missing Discord signature headers")

    if not _verify_signature(settings.discord_public_key, signature, timestamp, body):
        raise HTTPException(status_code=401, detail="Invalid Discord signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    interaction_type = payload.get("type")

    # ── PING (Discord endpoint verification) ─────────────────────────────────
    if interaction_type == _PING:
        return JSONResponse({"type": _PONG})

    # ── Slash command ─────────────────────────────────────────────────────────
    if interaction_type == _APPLICATION_COMMAND:
        data = payload.get("data", {})
        command_name = data.get("name", "")

        if command_name != "xrp":
            return JSONResponse({
                "type": _CHANNEL_MESSAGE_WITH_SOURCE,
                "data": {"content": "Unknown command.", "flags": 64},
            })

        # Extract subcommand and options
        options = data.get("options", [])
        subcmd = next((o for o in options if o.get("name") == "link"), None)
        if subcmd is None:
            return JSONResponse({
                "type": _CHANNEL_MESSAGE_WITH_SOURCE,
                "data": {"content": "Usage: `/xrp link <claim-code>`", "flags": 64},
            })

        sub_options = subcmd.get("options", [])
        code_opt = next((o for o in sub_options if o.get("name") == "code"), None)
        claim_code = (code_opt or {}).get("value", "").strip().upper()

        if not claim_code:
            return JSONResponse({
                "type": _CHANNEL_MESSAGE_WITH_SOURCE,
                "data": {"content": "Please provide your claim code. Usage: `/xrp link XRP-XXXX-XXXX`", "flags": 64},
            })

        guild_id = payload.get("guild_id", "")
        channel_id = payload.get("channel_id")
        member = payload.get("member", {})
        user = member.get("user", payload.get("user", {}))
        discord_user_id = user.get("id", "")

        # Fetch guild name via Discord API if possible
        guild_name: str | None = None
        bot_token = settings.discord_bot_token
        if bot_token and guild_id:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(
                        f"https://discord.com/api/v10/guilds/{guild_id}",
                        headers={"Authorization": f"Bot {bot_token}"},
                    )
                    if r.status_code == 200:
                        guild_name = r.json().get("name")
            except Exception:
                pass

        try:
            perm_status, initial_sync_count = await _process_link_claim(
                claim_code=claim_code,
                guild_id=guild_id,
                guild_name=guild_name,
                channel_id=channel_id,
                discord_user_id=discord_user_id,
                db=db,
            )
        except HTTPException as exc:
            msg = {
                404: f"Claim code `{claim_code}` not found. Generate a new code from the XIVRaidPlanner website.",
                409: "This code has already been used.",
                410: "This code has expired. Generate a new one from the XIVRaidPlanner website.",
            }.get(exc.status_code, f"Error: {exc.detail}")
            return JSONResponse({
                "type": _CHANNEL_MESSAGE_WITH_SOURCE,
                "data": {"content": msg, "flags": 64},
            })

        if perm_status == "permission_missing":
            reply = (
                "Server linked, but the bot is missing **Manage Events** permission. "
                "Please grant it and click **Check now** or **Sync now** on the website."
            )
        else:
            reply = "Your Discord server has been connected to XIVRaidPlanner."

        if initial_sync_count:
            reply = f"{reply} Initial Discord Event sync actions: {initial_sync_count}."

        return JSONResponse({
            "type": _CHANNEL_MESSAGE_WITH_SOURCE,
            "data": {"content": reply, "flags": 64},
        })

    # Unknown interaction type
    return JSONResponse({"type": _CHANNEL_MESSAGE_WITH_SOURCE, "data": {"content": "Unhandled interaction."}})
