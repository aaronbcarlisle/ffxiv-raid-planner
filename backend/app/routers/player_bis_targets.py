"""CRUD router for player-owned BiS target sets (per job profile)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.player_bis_target_set import (
    PlayerBisTargetSet,
    VALID_BIS_IMPORT_STATUSES,
    VALID_BIS_PURPOSES,
    VALID_BIS_SOURCE_TYPES,
)
from ..models.player_job_profile import PlayerJobProfile
from ..models.player_profile import PlayerProfile
from ..models.user import User
from ..schemas.player import (
    PlayerBisTargetSetCreate,
    PlayerBisTargetSetResponse,
    PlayerBisTargetSetUpdate,
)

router = APIRouter(prefix="/api/player/jobs", tags=["player-bis"])
logger = get_logger(__name__)


async def _get_own_job_profile(
    session: AsyncSession, user: User, job_profile_id: str,
) -> tuple[PlayerProfile, PlayerJobProfile]:
    """Get a job profile belonging to the authenticated user. 404 if missing."""
    result = await session.execute(
        select(PlayerJobProfile)
        .join(PlayerProfile)
        .where(
            PlayerJobProfile.id == job_profile_id,
            PlayerProfile.user_id == user.id,
        )
    )
    jp = result.scalar_one_or_none()
    if not jp:
        raise HTTPException(status_code=404, detail="Job profile not found")
    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.id == jp.profile_id)
    )
    profile = profile_result.scalar_one()
    return profile, jp


def _to_response(b: PlayerBisTargetSet) -> PlayerBisTargetSetResponse:
    return PlayerBisTargetSetResponse(
        id=b.id,
        profile_id=b.profile_id,
        job_profile_id=b.job_profile_id,
        job=b.job,
        name=b.name,
        purpose=b.purpose,
        source_type=b.source_type,
        external_url=b.external_url,
        import_status=b.import_status,
        is_active=b.is_active,
        item_level=b.item_level,
        notes=b.notes,
        items_json=b.items_json,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.get("/{job_profile_id}/bis-targets", response_model=list[PlayerBisTargetSetResponse])
async def list_bis_targets(
    job_profile_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all BiS target sets for a job profile."""
    await _get_own_job_profile(session, user, job_profile_id)
    result = await session.execute(
        select(PlayerBisTargetSet)
        .where(PlayerBisTargetSet.job_profile_id == job_profile_id)
        .order_by(PlayerBisTargetSet.created_at)
    )
    return [_to_response(b) for b in result.scalars().all()]


@router.post(
    "/{job_profile_id}/bis-targets",
    response_model=PlayerBisTargetSetResponse,
    status_code=201,
)
async def create_bis_target(
    job_profile_id: str,
    body: PlayerBisTargetSetCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a new BiS target set for a job profile."""
    profile, jp = await _get_own_job_profile(session, user, job_profile_id)

    if body.purpose not in VALID_BIS_PURPOSES:
        raise HTTPException(status_code=422, detail=f"Invalid purpose: {body.purpose}")
    if body.source_type not in VALID_BIS_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid source_type: {body.source_type}")
    if body.import_status not in VALID_BIS_IMPORT_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid import_status: {body.import_status}")

    now = datetime.now(timezone.utc).isoformat()
    b = PlayerBisTargetSet(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        job_profile_id=job_profile_id,
        job=jp.job,
        name=body.name,
        purpose=body.purpose,
        source_type=body.source_type,
        external_url=body.external_url,
        import_status=body.import_status,
        is_active=False,
        notes=body.notes,
        created_at=now,
        updated_at=now,
    )
    session.add(b)
    await session.commit()
    await session.refresh(b)
    logger.info("bis_target_created", job_profile_id=job_profile_id, target_id=b.id)
    return _to_response(b)


@router.put(
    "/{job_profile_id}/bis-targets/{target_id}",
    response_model=PlayerBisTargetSetResponse,
)
async def update_bis_target(
    job_profile_id: str,
    target_id: str,
    body: PlayerBisTargetSetUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update a BiS target set."""
    await _get_own_job_profile(session, user, job_profile_id)
    result = await session.execute(
        select(PlayerBisTargetSet).where(
            PlayerBisTargetSet.id == target_id,
            PlayerBisTargetSet.job_profile_id == job_profile_id,
        )
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")

    if body.name is not None:
        b.name = body.name
    if body.purpose is not None:
        if body.purpose not in VALID_BIS_PURPOSES:
            raise HTTPException(status_code=422, detail=f"Invalid purpose: {body.purpose}")
        b.purpose = body.purpose
    if body.source_type is not None:
        if body.source_type not in VALID_BIS_SOURCE_TYPES:
            raise HTTPException(status_code=422, detail=f"Invalid source_type: {body.source_type}")
        b.source_type = body.source_type
    if body.external_url is not None:
        b.external_url = body.external_url
    if body.import_status is not None:
        if body.import_status not in VALID_BIS_IMPORT_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid import_status: {body.import_status}")
        b.import_status = body.import_status
    if body.notes is not None:
        b.notes = body.notes
    b.updated_at = datetime.now(timezone.utc).isoformat()

    await session.commit()
    await session.refresh(b)
    return _to_response(b)


@router.delete("/{job_profile_id}/bis-targets/{target_id}", status_code=204)
async def delete_bis_target(
    job_profile_id: str,
    target_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete a BiS target set."""
    await _get_own_job_profile(session, user, job_profile_id)
    result = await session.execute(
        select(PlayerBisTargetSet).where(
            PlayerBisTargetSet.id == target_id,
            PlayerBisTargetSet.job_profile_id == job_profile_id,
        )
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")
    await session.delete(b)
    await session.commit()


@router.post(
    "/{job_profile_id}/bis-targets/{target_id}/set-active",
    response_model=PlayerBisTargetSetResponse,
)
async def set_bis_target_active(
    job_profile_id: str,
    target_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark one BiS target as active, deactivating all others for the same job."""
    profile, jp = await _get_own_job_profile(session, user, job_profile_id)

    result = await session.execute(
        select(PlayerBisTargetSet).where(
            PlayerBisTargetSet.profile_id == profile.id,
            PlayerBisTargetSet.job == jp.job,
        )
    )
    all_for_job = result.scalars().all()

    now = datetime.now(timezone.utc).isoformat()
    active_target = None
    for b in all_for_job:
        b.is_active = b.id == target_id
        b.updated_at = now
        if b.id == target_id:
            active_target = b

    if active_target is None:
        raise HTTPException(status_code=404, detail="BiS target not found")

    await session.commit()
    await session.refresh(active_target)
    return _to_response(active_target)
