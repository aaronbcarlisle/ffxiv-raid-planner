"""
API Key Router

Endpoints for creating, listing, and revoking API keys.
All endpoints require Discord-authenticated user (existing cookie/JWT auth).
"""

import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_jwt_only
from app.models import ApiKey, PluginAuthCode, User
from app.schemas.api_key import (
    ApiKeyCreate,
    ApiKeyCreateResponse,
    ApiKeyResponse,
    PluginAuthAuthorizeRequest,
    PluginAuthAuthorizeResponse,
    PluginAuthExchangeRequest,
    PluginAuthExchangeResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["api-keys"])

# Key format: xrp_ + 40 random hex chars (20 random bytes = 160 bits of entropy)
KEY_PREFIX = "xrp_"
KEY_RANDOM_BYTES = 20

# Maximum active keys per user (revoked keys don't count toward this limit,
# allowing users to rotate keys freely without hitting the cap)
MAX_KEYS_PER_USER = 10

# All available scopes — stored on keys for future per-scope enforcement.
# Currently all keys receive all scopes; enforcement is not yet implemented.
ALL_SCOPES = [
    "priority:read",
    "loot:write",
    "materials:write",
    "pages:write",
]


def _generate_api_key() -> str:
    """Generate a new API key with xrp_ prefix."""
    return KEY_PREFIX + secrets.token_hex(KEY_RANDOM_BYTES)


def _hash_key(raw_key: str) -> str:
    """SHA-256 hash of the raw API key."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


@router.post("/api-keys", response_model=ApiKeyCreateResponse, status_code=201)
async def create_api_key(
    data: ApiKeyCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user_jwt_only),
):
    """Generate a new API key. The raw key is returned ONCE in the response."""
    # Check key count limit (COUNT query to avoid loading all key objects)
    count_result = await db.execute(
        select(func.count()).select_from(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.is_active.is_(True),
        )
    )
    key_count = count_result.scalar() or 0
    if key_count >= MAX_KEYS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_KEYS_PER_USER} active API keys per user",
        )

    # Generate key
    raw_key = _generate_api_key()
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12]  # "xrp_" + first 8 hex chars

    key_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    api_key = ApiKey(
        id=key_id,
        user_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=data.name,
        scopes=ALL_SCOPES,
        is_active=True,
        created_at=now,
    )
    db.add(api_key)
    await db.commit()

    logger.info(
        "api_key_created",
        key_id=key_id,
        key_prefix=key_prefix,
        user_id=current_user.id,
    )

    return ApiKeyCreateResponse(
        id=key_id,
        name=data.name,
        key=raw_key,
        key_prefix=key_prefix,
        scopes=ALL_SCOPES,
        created_at=now,
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user_jwt_only),
):
    """List active API keys for the current user. Never returns raw keys."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id, ApiKey.is_active.is_(True))
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        ApiKeyResponse(
            id=key.id,
            name=key.name,
            key_prefix=key.key_prefix,
            scopes=key.scopes,
            last_used_at=key.last_used_at,
            expires_at=key.expires_at,
            is_active=key.is_active,
            created_at=key.created_at,
        )
        for key in keys
    ]


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user_jwt_only),
):
    """Revoke an API key (soft delete by setting is_active=False)."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.user_id == current_user.id,
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    await db.commit()

    logger.info(
        "api_key_revoked",
        key_id=key_id,
        user_id=current_user.id,
    )


# ============================================================================
# Plugin browser sign-in (loopback OAuth + PKCE)
# ============================================================================

# Authorization codes live for 5 minutes — long enough for a slow user, short
# enough that a leaked code window is bounded.
PLUGIN_AUTH_CODE_TTL = timedelta(minutes=5)

# Loopback hosts the redirect_uri is allowed to use. Plugin always picks an
# ephemeral 127.0.0.1 port; "localhost" is permitted in case a future client
# resolves differently.
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost"}


def _is_loopback_redirect_uri(redirect_uri: str) -> bool:
    """Return True iff redirect_uri targets http://127.0.0.1[:port]/... or localhost."""
    try:
        parsed = urlparse(redirect_uri)
    except ValueError:
        return False
    if parsed.scheme != "http":
        return False
    if parsed.hostname not in _LOOPBACK_HOSTS:
        return False
    return True


def _base64url_no_pad(data: bytes) -> str:
    """Base64URL encode without trailing '=' padding (per RFC 7636)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _verify_pkce(code_verifier: str, code_challenge: str) -> bool:
    """Constant-time check that SHA256(code_verifier) base64url == code_challenge."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    expected = _base64url_no_pad(digest)
    return secrets.compare_digest(expected, code_challenge)


@router.post(
    "/api-keys/plugin-auth/authorize",
    response_model=PluginAuthAuthorizeResponse,
    status_code=201,
)
async def plugin_auth_authorize(
    data: PluginAuthAuthorizeRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user_jwt_only),
):
    """Mint a one-time code the frontend can hand back to the plugin's loopback URI."""
    if data.code_challenge_method != "S256":
        raise HTTPException(status_code=400, detail="code_challenge_method must be S256")

    if not _is_loopback_redirect_uri(data.redirect_uri):
        raise HTTPException(
            status_code=400,
            detail="redirect_uri must be an http://127.0.0.1 or http://localhost URL",
        )

    raw_code = secrets.token_urlsafe(32)
    code_hash = hashlib.sha256(raw_code.encode("ascii")).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = (now + PLUGIN_AUTH_CODE_TTL).isoformat()

    record = PluginAuthCode(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        code_hash=code_hash,
        code_challenge=data.code_challenge,
        redirect_uri=data.redirect_uri,
        expires_at=expires_at,
        used=False,
        created_at=now.isoformat(),
    )
    db.add(record)
    await db.commit()

    logger.info(
        "plugin_auth_code_issued",
        user_id=current_user.id,
        code_id=record.id,
        redirect_host=urlparse(data.redirect_uri).hostname,
    )

    return PluginAuthAuthorizeResponse(code=raw_code)


@router.post(
    "/api-keys/plugin-auth/exchange",
    response_model=PluginAuthExchangeResponse,
)
async def plugin_auth_exchange(
    data: PluginAuthExchangeRequest,
    db: AsyncSession = Depends(get_session),
):
    """Trade a valid code + PKCE verifier for a newly minted xrp_ API key.

    Unauthenticated by design — possession of the PKCE secret is the proof.
    """
    code_hash = hashlib.sha256(data.code.encode("ascii")).hexdigest()

    result = await db.execute(
        select(PluginAuthCode).where(PluginAuthCode.code_hash == code_hash)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=400, detail="Invalid code")

    now = datetime.now(timezone.utc)
    if record.used:
        raise HTTPException(status_code=400, detail="Code already used")

    expires_at = datetime.fromisoformat(record.expires_at)
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Code expired")

    if not _verify_pkce(data.code_verifier, record.code_challenge):
        raise HTTPException(status_code=400, detail="PKCE verifier mismatch")

    # Atomic conditional update: only flips used=False → used=True.
    # Concurrent calls will see rowcount=0 and lose the race gracefully.
    mark_used = await db.execute(
        update(PluginAuthCode)
        .where(PluginAuthCode.id == record.id, PluginAuthCode.used.is_(False))
        .values(used=True)
    )
    if mark_used.rowcount == 0:
        # Lost the race — another request already marked this code used.
        raise HTTPException(status_code=400, detail="Code already used")

    # Enforce per-user key limit (same as create_api_key).
    count_result = await db.execute(
        select(func.count()).select_from(ApiKey).where(
            ApiKey.user_id == record.user_id,
            ApiKey.is_active.is_(True),
        )
    )
    if (count_result.scalar() or 0) >= MAX_KEYS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_KEYS_PER_USER} active API keys per user",
        )

    raw_key = _generate_api_key()
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12]

    key_id = str(uuid.uuid4())
    now_iso = now.isoformat()
    api_key = ApiKey(
        id=key_id,
        user_id=record.user_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name="Plugin browser sign-in",
        scopes=ALL_SCOPES,
        is_active=True,
        created_at=now_iso,
    )
    db.add(api_key)
    await db.commit()

    logger.info(
        "plugin_auth_code_exchanged",
        user_id=record.user_id,
        code_id=record.id,
        api_key_id=key_id,
    )

    return PluginAuthExchangeResponse(api_key=raw_key)
