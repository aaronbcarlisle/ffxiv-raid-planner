"""Shared CRUD router for BiS target sets (/api/bis-targets).

Supports both player hub (owner_type='player_job_profile') and roster
(owner_type='roster_member_job') contexts using the same table and API shape.

Permission model:
  player_job_profile  — authenticated user must own the PlayerJobProfile
  roster_member_job   — authenticated user must be an owner or lead of the
                        static group that owns the snapshot player
"""

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.bis_target_set import (
    BiSTargetSet,
    VALID_BIS_IMPORT_STATUSES,
    VALID_BIS_PURPOSES,
    VALID_BIS_SOURCE_TYPES,
    VALID_OWNER_TYPES,
)
from ..models.player_job_profile import PlayerJobProfile
from ..models.player_profile import PlayerProfile
from ..models.snapshot_player import SnapshotPlayer
from ..models.tier_snapshot import TierSnapshot
from ..models.user import User
from ..permissions import require_can_edit_roster, require_membership
from ..models.membership import MemberRole
from ..schemas.bis_targets import BiSTargetSetCreate, BiSTargetSetResponse, BiSTargetSetUpdate
from .bis import (
    ETRO_SLOT_MAP,
    build_xivgear_set_options,
    build_xivgear_slots,
    determine_source,
    extract_bis_path,
    extract_etro_uuid,
    extract_xivgear_set_index,
    fetch_bis_from_etro,
    fetch_bis_from_github,
    fetch_bis_from_xivgear_url,
    fetch_item_from_garland,
    fetch_materia_from_garland,
)

router = APIRouter(prefix="/api/bis-targets", tags=["bis-targets"])
logger = get_logger(__name__)


def _to_response(b: BiSTargetSet) -> BiSTargetSetResponse:
    return BiSTargetSetResponse(
        id=b.id,
        owner_type=b.owner_type,
        owner_id=b.owner_id,
        job_profile_id=b.job_profile_id,
        snapshot_player_id=b.snapshot_player_id,
        group_id=b.group_id,
        profile_id=b.profile_id,
        job=b.job,
        name=b.name,
        purpose=b.purpose,
        source_type=b.source_type,
        external_url=b.external_url,
        import_status=b.import_status,
        is_active=b.is_active,
        is_public=b.is_public,
        patch=b.patch,
        item_level=b.item_level,
        notes=b.notes,
        items_json=b.items_json,
        created_by=b.created_by,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


async def _check_read_permission(
    session: AsyncSession,
    user: User,
    b: BiSTargetSet,
) -> None:
    """Raise 403/404 if user cannot read this target."""
    if b.owner_type == "player_job_profile":
        await _require_owns_job_profile(session, user, b.owner_id)
    elif b.owner_type == "roster_member_job":
        if b.group_id:
            await require_membership(session, user.id, b.group_id, MemberRole.VIEWER)
    # other types — allow authenticated access for now


async def _check_write_permission(
    session: AsyncSession,
    user: User,
    b: BiSTargetSet,
) -> None:
    """Raise 403/404 if user cannot write this target."""
    if b.owner_type == "player_job_profile":
        await _require_owns_job_profile(session, user, b.owner_id)
    elif b.owner_type == "roster_member_job":
        if b.group_id:
            await require_can_edit_roster(session, user.id, b.group_id)
    else:
        raise HTTPException(status_code=403, detail="Cannot write to this target type")


async def _require_owns_job_profile(
    session: AsyncSession, user: User, job_profile_id: str,
) -> tuple[PlayerProfile, PlayerJobProfile]:
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


async def _resolve_create_context(
    session: AsyncSession,
    user: User,
    body: BiSTargetSetCreate,
) -> dict:
    """Validate ownership and return extra fields to set on the new record."""
    extra: dict = {}

    if body.owner_type == "player_job_profile":
        profile, jp = await _require_owns_job_profile(session, user, body.owner_id)
        extra["job_profile_id"] = body.owner_id
        extra["profile_id"] = profile.id
        extra["job"] = jp.job
    elif body.owner_type == "roster_member_job":
        result = await session.execute(
            select(SnapshotPlayer, TierSnapshot)
            .join(TierSnapshot, TierSnapshot.id == SnapshotPlayer.tier_snapshot_id)
            .where(SnapshotPlayer.id == body.owner_id)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Roster player not found")
        sp, ts = row
        group_id = body.group_id or ts.static_group_id
        await require_can_edit_roster(session, user.id, group_id)
        extra["snapshot_player_id"] = body.owner_id
        extra["group_id"] = group_id
        extra["job"] = sp.job
    else:
        raise HTTPException(
            status_code=422,
            detail=f"owner_type must be one of: {', '.join(sorted(VALID_OWNER_TYPES))}",
        )

    return extra


@router.get("", response_model=list[BiSTargetSetResponse])
async def list_bis_targets(
    owner_type: str = Query(..., alias="ownerType"),
    owner_id: str = Query(..., alias="ownerId"),
    job: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List BiS targets for a given owner."""
    stmt = (
        select(BiSTargetSet)
        .where(
            BiSTargetSet.owner_type == owner_type,
            BiSTargetSet.owner_id == owner_id,
        )
        .order_by(BiSTargetSet.created_at)
    )
    if job:
        stmt = stmt.where(BiSTargetSet.job == job.upper())

    result = await session.execute(stmt)
    targets = result.scalars().all()

    # Permission: check against the first row if any; otherwise validate via owner.
    # For roster context, filter to is_public targets unless the viewer is an owner/lead.
    if owner_type == "player_job_profile":
        await _require_owns_job_profile(session, user, owner_id)
    elif owner_type == "roster_member_job":
        if targets and targets[0].group_id:
            await require_membership(session, user.id, targets[0].group_id, MemberRole.VIEWER)
        # Only static owners/leads see private targets; plain members/viewers see public only
        can_see_private = False
        if targets and targets[0].group_id:
            from ..models.membership import Membership as MembershipModel
            mem_result = await session.execute(
                select(MembershipModel).where(
                    MembershipModel.static_group_id == targets[0].group_id,
                    MembershipModel.user_id == user.id,
                )
            )
            mem = mem_result.scalar_one_or_none()
            if mem and mem.role in ("owner", "lead"):
                can_see_private = True
        if not can_see_private:
            targets = [b for b in targets if b.is_public]

    return [_to_response(b) for b in targets]


@router.post("", response_model=BiSTargetSetResponse, status_code=201)
async def create_bis_target(
    body: BiSTargetSetCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a new BiS target set."""
    if body.purpose not in VALID_BIS_PURPOSES:
        raise HTTPException(status_code=422, detail=f"Invalid purpose: {body.purpose}")
    if body.source_type not in VALID_BIS_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid source_type: {body.source_type}")
    if body.import_status not in VALID_BIS_IMPORT_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid import_status: {body.import_status}")

    extra = await _resolve_create_context(session, user, body)

    now = datetime.now(timezone.utc).isoformat()
    b = BiSTargetSet(
        id=str(uuid.uuid4()),
        owner_type=body.owner_type,
        owner_id=body.owner_id,
        name=body.name,
        purpose=body.purpose,
        source_type=body.source_type,
        external_url=body.external_url,
        import_status=body.import_status,
        is_active=False,
        is_public=body.is_public,
        patch=body.patch,
        item_level=body.item_level,
        notes=body.notes,
        created_by=user.id,
        created_at=now,
        updated_at=now,
        **extra,
    )
    session.add(b)
    await session.commit()
    await session.refresh(b)
    logger.info("bis_target_created", owner_type=b.owner_type, owner_id=b.owner_id, target_id=b.id)
    return _to_response(b)


@router.patch("/{target_id}", response_model=BiSTargetSetResponse)
async def update_bis_target(
    target_id: str,
    body: BiSTargetSetUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update a BiS target set."""
    result = await session.execute(
        select(BiSTargetSet).where(BiSTargetSet.id == target_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")

    await _check_write_permission(session, user, b)

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
    if body.patch is not None:
        b.patch = body.patch
    if body.item_level is not None:
        b.item_level = body.item_level
    if body.notes is not None:
        b.notes = body.notes
    if body.is_public is not None:
        b.is_public = body.is_public
    b.updated_at = datetime.now(timezone.utc).isoformat()

    await session.commit()
    await session.refresh(b)
    return _to_response(b)


@router.delete("/{target_id}", status_code=204)
async def delete_bis_target(
    target_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete a BiS target set."""
    result = await session.execute(
        select(BiSTargetSet).where(BiSTargetSet.id == target_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")

    await _check_write_permission(session, user, b)

    await session.delete(b)
    await session.commit()


async def _fetch_slots_xivgear(url: str) -> list[dict]:
    """Fetch gear slots from a XIVGear URL and return serialisable slot dicts."""
    try:
        identifier, path_type = extract_bis_path(url)
        requested_set_index = extract_xivgear_set_index(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if path_type == "bis":
        job_abbrev, tier = identifier.split("/")
        data = await fetch_bis_from_github(job_abbrev, tier)
    else:
        data = await fetch_bis_from_xivgear_url(url)

    items_data: dict = {}
    if "sets" in data and data["sets"]:
        sets = data["sets"]
        set_options = build_xivgear_set_options(data)
        selectable_indices = {option.index for option in set_options}

        if requested_set_index is None and len(set_options) > 1:
            raise HTTPException(
                status_code=400,
                detail="XIVGear sheet has multiple sets. Select a set before importing.",
            )

        selected_set_index: int | None
        if requested_set_index is None:
            selected_set_index = set_options[0].index if set_options else None
        elif requested_set_index in selectable_indices:
            selected_set_index = requested_set_index
        elif requested_set_index == 0 and set_options:
            # Legacy preset links sometimes stored setIndex=0 even when the first
            # XIVGear row is a separator. Preserve those links by selecting the
            # first real set.
            selected_set_index = set_options[0].index
        else:
            raise HTTPException(status_code=400, detail="Selected XIVGear set was not found")

        if selected_set_index is not None:
            items_data = sets[selected_set_index].get("items", {})
    elif "items" in data:
        items_data = data["items"]

    if not items_data:
        raise HTTPException(status_code=400, detail="No gear items found in XIVGear set")

    return [slot.model_dump() for slot in await build_xivgear_slots(items_data)]


async def _fetch_slots_etro(url: str) -> list[dict]:
    """Fetch gear slots from an Etro URL and return serialisable slot dicts."""
    try:
        etro_uuid = extract_etro_uuid(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = await fetch_bis_from_etro(etro_uuid)
    etro_materia = data.get("materia", {})
    slots: list[dict] = []

    for etro_slot, our_slot in ETRO_SLOT_MAP.items():
        item_id = data.get(etro_slot)
        if item_id:
            item_info = await fetch_item_from_garland(item_id)
            source = determine_source(item_info["name"], item_info["level"], our_slot)
            item_id_str = str(item_id)
            if our_slot == "ring1":
                materia_key = f"{item_id_str}L"
            elif our_slot == "ring2":
                materia_key = f"{item_id_str}R"
            else:
                materia_key = item_id_str
            item_materia = etro_materia.get(materia_key, {}) or etro_materia.get(item_id_str, {})
            materia_list: list[dict] = []
            if item_materia:
                materia_ids = [
                    item_materia.get(str(i)) for i in range(1, 6)
                    if item_materia.get(str(i)) and isinstance(item_materia.get(str(i)), int)
                ]
                if materia_ids:
                    results = await asyncio.gather(
                        *[fetch_materia_from_garland(mid) for mid in materia_ids],
                        return_exceptions=True,
                    )
                    for r in results:
                        if r is not None and not isinstance(r, Exception):
                            materia_list.append(r.model_dump())
            slots.append({
                "slot": our_slot, "source": source,
                "itemId": item_id, "itemName": item_info["name"],
                "itemLevel": item_info["level"], "itemIcon": item_info.get("icon"),
                "itemStats": item_info.get("stats") or None, "materia": materia_list,
            })
        else:
            slots.append({"slot": our_slot, "source": "raid"})
    return slots


@router.post("/{target_id}/import", response_model=BiSTargetSetResponse)
async def import_bis_target(
    target_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Fetch gear data from external_url and populate items_json + item_level."""
    result = await session.execute(
        select(BiSTargetSet).where(BiSTargetSet.id == target_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")

    await _check_write_permission(session, user, b)

    if not b.external_url:
        raise HTTPException(status_code=400, detail="No external URL configured for this target")
    if b.source_type not in ("xivgear", "etro", "preset"):
        raise HTTPException(
            status_code=400,
            detail=f"Import not supported for source_type '{b.source_type}'",
        )

    try:
        if b.source_type in ("xivgear", "preset"):
            slots = await _fetch_slots_xivgear(b.external_url)
        else:
            slots = await _fetch_slots_etro(b.external_url)

        item_levels = [s["itemLevel"] for s in slots if s.get("itemLevel")]
        max_ilvl = max(item_levels) if item_levels else None
        b.items_json = {"slots": slots}
        if max_ilvl:
            b.item_level = max_ilvl
        b.import_status = "imported"
    except HTTPException:
        b.import_status = "import_failed"
        b.updated_at = datetime.now(timezone.utc).isoformat()
        await session.commit()
        await session.refresh(b)
        raise
    except Exception as e:
        logger.warning("bis_import_failed", target_id=target_id, error=str(e))
        b.import_status = "import_failed"

    b.updated_at = datetime.now(timezone.utc).isoformat()
    await session.commit()
    await session.refresh(b)
    logger.info("bis_import_complete", target_id=target_id, status=b.import_status)
    return _to_response(b)


@router.post("/{target_id}/set-active", response_model=BiSTargetSetResponse)
async def set_bis_target_active(
    target_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark one BiS target active; deactivate all others for the same owner + job."""
    result = await session.execute(
        select(BiSTargetSet).where(BiSTargetSet.id == target_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="BiS target not found")

    await _check_write_permission(session, user, b)

    # Deactivate all siblings (same owner + job)
    all_result = await session.execute(
        select(BiSTargetSet).where(
            BiSTargetSet.owner_type == b.owner_type,
            BiSTargetSet.owner_id == b.owner_id,
            BiSTargetSet.job == b.job,
        )
    )
    now = datetime.now(timezone.utc).isoformat()
    for sibling in all_result.scalars().all():
        sibling.is_active = sibling.id == target_id
        sibling.updated_at = now

    await session.commit()
    await session.refresh(b)
    return _to_response(b)
