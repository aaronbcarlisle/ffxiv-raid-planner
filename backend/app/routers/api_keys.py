"""
API Key Router

Endpoints for creating, listing, and revoking API keys.
All endpoints require Discord-authenticated user (existing cookie/JWT auth).
"""

import hashlib
import secrets
import uuid

import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_jwt_only
from app.models import ApiKey, User
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse

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
    # Check key count limit
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.is_active == True,
        )
    )
    existing_keys = result.scalars().all()
    if len(existing_keys) >= MAX_KEYS_PER_USER:
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
        .where(ApiKey.user_id == current_user.id, ApiKey.is_active == True)
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
