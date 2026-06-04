"""API router for solo player profile, character linking, gear sync, and job profiles."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..constants import VALID_JOBS
from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.player_character import PlayerCharacter
from ..models.player_gear_snapshot import PlayerGearSnapshot, VALID_SYNC_SOURCES
from ..models.player_goal import PlayerGoal, VALID_GOAL_TYPES, VALID_GOAL_STATUSES
from ..models.player_job_profile import (
    PlayerJobProfile,
    VALID_JOB_PRIORITIES,
    VALID_READINESS_STATES,
)
from ..models.player_profile import PlayerProfile, VALID_VISIBILITIES
from ..models.user import User
from ..rate_limit import RATE_LIMITS, limiter
from ..schemas.player import (
    GearSnapshotResponse,
    GearSyncRequest,
    GearSyncResult,
    PlayerCharacterCreate,
    PlayerCharacterResponse,
    PlayerCharacterUpdate,
    PlayerGoalCreate,
    PlayerGoalResponse,
    PlayerGoalUpdate,
    PlayerJobProfileCreate,
    PlayerJobProfileResponse,
    PlayerJobProfileUpdate,
    PlayerProfileResponse,
    PlayerProfileUpdate,
    PublicPlayerProfileResponse,
    PluginPlayerGearSyncRequest,
    PluginPlayerGearSyncResult,
)
from ..services.share_code import generate_profile_share_code

router = APIRouter(prefix="/api/player", tags=["player"])
plugin_router = APIRouter(prefix="/api/plugin/player", tags=["plugin-player"])
logger = get_logger(__name__)

VALID_ROLES = frozenset({"tank", "healer", "melee", "ranged", "caster"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_or_create_profile(
    session: AsyncSession, user: User,
) -> PlayerProfile:
    """Get the user's player profile, creating one if it doesn't exist."""
    result = await session.execute(
        select(PlayerProfile)
        .options(
            selectinload(PlayerProfile.characters),
            selectinload(PlayerProfile.job_profiles),
        )
        .where(PlayerProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        now = datetime.now(timezone.utc).isoformat()
        profile = PlayerProfile(
            id=str(uuid.uuid4()),
            user_id=user.id,
            visibility="private",
            created_at=now,
            updated_at=now,
        )
        session.add(profile)
        await session.flush()
        # Re-fetch with relationships loaded
        result = await session.execute(
            select(PlayerProfile)
            .options(
                selectinload(PlayerProfile.characters),
                selectinload(PlayerProfile.job_profiles),
            )
            .where(PlayerProfile.id == profile.id)
        )
        profile = result.scalar_one()

    return profile


async def _get_own_character(
    session: AsyncSession, user: User, character_id: str,
) -> tuple[PlayerProfile, PlayerCharacter]:
    """Get a character that belongs to the current user. Raises 404 if not found."""
    result = await session.execute(
        select(PlayerCharacter)
        .join(PlayerProfile)
        .where(
            PlayerCharacter.id == character_id,
            PlayerProfile.user_id == user.id,
        )
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Load profile
    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.id == character.profile_id)
    )
    profile = profile_result.scalar_one()
    return profile, character


def _profile_to_response(profile: PlayerProfile) -> PlayerProfileResponse:
    """Convert a PlayerProfile ORM object to response schema."""
    characters = [
        PlayerCharacterResponse(
            id=c.id,
            lodestone_id=c.lodestone_id,
            name=c.name,
            server=c.server,
            data_center=c.data_center,
            avatar_url=c.avatar_url,
            is_main=c.is_main,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in (profile.characters or [])
    ]

    job_profiles = [
        PlayerJobProfileResponse(
            id=jp.id,
            job=jp.job,
            role=jp.role,
            priority=jp.priority,
            readiness=jp.readiness,
            notes=jp.notes,
            gear_snapshot_id=jp.gear_snapshot_id,
            created_at=jp.created_at,
            updated_at=jp.updated_at,
        )
        for jp in (profile.job_profiles or [])
    ]

    return PlayerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        visibility=profile.visibility,
        share_code=profile.share_code,
        share_enabled=profile.share_enabled,
        bio=profile.bio,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        characters=characters,
        job_profiles=job_profiles,
    )


def _calculate_avg_ilvl(gear: list[dict]) -> int:
    """Calculate average item level from gear slot list."""
    ilvl_slots = []
    for slot in gear:
        ilvl = slot.get("itemLevel") or slot.get("item_level") or slot.get("equippedItemLevel") or 0
        if isinstance(ilvl, (int, float)) and ilvl > 0:
            ilvl_slots.append(int(ilvl))
    if not ilvl_slots:
        return 0
    return round(sum(ilvl_slots) / len(ilvl_slots))


# ---------------------------------------------------------------------------
# Profile endpoints
# ---------------------------------------------------------------------------


@router.get("/profile", response_model=PlayerProfileResponse)
@limiter.limit(RATE_LIMITS["general"])
async def get_profile(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get or create the current user's player profile."""
    profile = await _get_or_create_profile(session, current_user)
    await session.commit()
    return _profile_to_response(profile)


@router.put("/profile", response_model=PlayerProfileResponse)
@limiter.limit(RATE_LIMITS["general"])
async def update_profile(
    request: Request,
    body: PlayerProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's player profile."""
    profile = await _get_or_create_profile(session, current_user)

    if body.visibility is not None:
        if body.visibility not in VALID_VISIBILITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid visibility. Must be one of: {', '.join(sorted(VALID_VISIBILITIES))}",
            )
        profile.visibility = body.visibility

    if body.bio is not None:
        profile.bio = body.bio

    if body.share_enabled is not None:
        profile.share_enabled = body.share_enabled
        if body.share_enabled and not profile.share_code:
            profile.share_code = await generate_profile_share_code(session)

    profile.updated_at = datetime.now(timezone.utc).isoformat()
    await session.flush()
    await session.commit()

    # Re-fetch with relationships
    result = await session.execute(
        select(PlayerProfile)
        .options(
            selectinload(PlayerProfile.characters),
            selectinload(PlayerProfile.job_profiles),
        )
        .where(PlayerProfile.id == profile.id)
    )
    profile = result.scalar_one()
    return _profile_to_response(profile)


@router.post("/profile/rotate-share-code", response_model=PlayerProfileResponse)
@limiter.limit(RATE_LIMITS["heavy"])
async def rotate_share_code(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Generate a new share code, invalidating the old one."""
    profile = await _get_or_create_profile(session, current_user)
    profile.share_code = await generate_profile_share_code(session)
    profile.share_enabled = True
    profile.updated_at = datetime.now(timezone.utc).isoformat()
    await session.flush()
    await session.commit()

    result = await session.execute(
        select(PlayerProfile)
        .options(
            selectinload(PlayerProfile.characters),
            selectinload(PlayerProfile.job_profiles),
        )
        .where(PlayerProfile.id == profile.id)
    )
    profile = result.scalar_one()
    return _profile_to_response(profile)


# ---------------------------------------------------------------------------
# Public / shared profile endpoint (no auth required)
# ---------------------------------------------------------------------------


@router.get("/profile/share/{share_code}", response_model=PublicPlayerProfileResponse)
@limiter.limit(RATE_LIMITS["general"])
async def get_public_profile(
    request: Request,
    share_code: str,
    session: AsyncSession = Depends(get_session),
):
    """View a shared player profile by share code. No auth required.

    Only returns data from profiles with share_enabled=True and
    visibility in (shareable, discoverable). Private profiles return 404.
    Goals, notes, and private fields are excluded.
    """
    result = await session.execute(
        select(PlayerProfile)
        .options(
            selectinload(PlayerProfile.characters),
            selectinload(PlayerProfile.job_profiles),
        )
        .where(
            PlayerProfile.share_code == share_code,
            PlayerProfile.share_enabled == True,  # noqa: E712
        )
    )
    profile = result.scalar_one_or_none()

    if not profile or profile.visibility == "private":
        raise HTTPException(status_code=404, detail="Profile not found")

    characters = [
        PlayerCharacterResponse(
            id=c.id,
            lodestone_id=c.lodestone_id,
            name=c.name,
            server=c.server,
            data_center=c.data_center,
            avatar_url=c.avatar_url,
            is_main=c.is_main,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in (profile.characters or [])
    ]

    job_profiles = [
        PlayerJobProfileResponse(
            id=jp.id,
            job=jp.job,
            role=jp.role,
            priority=jp.priority,
            readiness=jp.readiness,
            notes=None,
            gear_snapshot_id=jp.gear_snapshot_id,
            created_at=jp.created_at,
            updated_at=jp.updated_at,
        )
        for jp in (profile.job_profiles or [])
    ]

    return PublicPlayerProfileResponse(
        id=profile.id,
        bio=profile.bio,
        characters=characters,
        job_profiles=job_profiles,
    )


# ---------------------------------------------------------------------------
# Mount farm catalog (reuses existing catalog from mount_farms router)
# ---------------------------------------------------------------------------


@router.get("/mount-farm-catalog")
@limiter.limit(RATE_LIMITS["general"])
async def get_player_mount_farm_catalog(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Return the mount farm catalog for solo collection goal quick-add."""
    from .mount_farms import MOUNT_FARM_CATALOG

    return {
        "entries": [
            {
                "trialId": e["trial_id"],
                "expansion": e["expansion"],
                "dutyName": e["duty_name"],
                "mountName": e["mount_name"],
                "totemName": e.get("totem_name"),
                "totemTarget": e.get("totem_target", 99),
            }
            for e in MOUNT_FARM_CATALOG
        ]
    }


# ---------------------------------------------------------------------------
# Character endpoints
# ---------------------------------------------------------------------------


@router.get("/characters", response_model=list[PlayerCharacterResponse])
@limiter.limit(RATE_LIMITS["general"])
async def list_characters(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List the current user's linked characters."""
    profile = await _get_or_create_profile(session, current_user)
    await session.commit()
    return [
        PlayerCharacterResponse(
            id=c.id,
            lodestone_id=c.lodestone_id,
            name=c.name,
            server=c.server,
            data_center=c.data_center,
            avatar_url=c.avatar_url,
            is_main=c.is_main,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in profile.characters
    ]


@router.post("/characters", response_model=PlayerCharacterResponse, status_code=201)
@limiter.limit(RATE_LIMITS["heavy"])
async def link_character(
    request: Request,
    body: PlayerCharacterCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Link a new FFXIV character to the current user's profile."""
    profile = await _get_or_create_profile(session, current_user)

    # Check if character already linked by this user
    for existing in profile.characters:
        if existing.lodestone_id == body.lodestone_id:
            raise HTTPException(
                status_code=409,
                detail="Character already linked to your profile",
            )

    # If this is marked as main, unset other mains
    if body.is_main:
        for c in profile.characters:
            if c.is_main:
                c.is_main = False
                c.updated_at = datetime.now(timezone.utc).isoformat()

    now = datetime.now(timezone.utc).isoformat()
    character = PlayerCharacter(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        lodestone_id=body.lodestone_id,
        name=body.name,
        server=body.server,
        data_center=body.data_center,
        avatar_url=body.avatar_url,
        is_main=body.is_main,
        created_at=now,
        updated_at=now,
    )
    session.add(character)
    await session.flush()
    await session.commit()

    logger.info(
        "player_character_linked",
        user_id=current_user.id,
        character_id=character.id,
        lodestone_id=body.lodestone_id,
    )

    return PlayerCharacterResponse(
        id=character.id,
        lodestone_id=character.lodestone_id,
        name=character.name,
        server=character.server,
        data_center=character.data_center,
        avatar_url=character.avatar_url,
        is_main=character.is_main,
        created_at=character.created_at,
        updated_at=character.updated_at,
    )


@router.put("/characters/{character_id}", response_model=PlayerCharacterResponse)
@limiter.limit(RATE_LIMITS["general"])
async def update_character(
    request: Request,
    character_id: str,
    body: PlayerCharacterUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a linked character."""
    profile, character = await _get_own_character(session, current_user, character_id)

    now = datetime.now(timezone.utc).isoformat()

    if body.is_main is not None and body.is_main:
        # Unset other mains
        chars_result = await session.execute(
            select(PlayerCharacter).where(
                PlayerCharacter.profile_id == profile.id,
                PlayerCharacter.id != character_id,
                PlayerCharacter.is_main == True,  # noqa: E712
            )
        )
        for other in chars_result.scalars():
            other.is_main = False
            other.updated_at = now
        character.is_main = True

    if body.is_main is not None and not body.is_main:
        character.is_main = False

    if body.name is not None:
        character.name = body.name
    if body.server is not None:
        character.server = body.server
    if body.data_center is not None:
        character.data_center = body.data_center
    if body.avatar_url is not None:
        character.avatar_url = body.avatar_url

    character.updated_at = now
    await session.flush()
    await session.commit()

    return PlayerCharacterResponse(
        id=character.id,
        lodestone_id=character.lodestone_id,
        name=character.name,
        server=character.server,
        data_center=character.data_center,
        avatar_url=character.avatar_url,
        is_main=character.is_main,
        created_at=character.created_at,
        updated_at=character.updated_at,
    )


@router.delete("/characters/{character_id}", status_code=204)
@limiter.limit(RATE_LIMITS["heavy"])
async def unlink_character(
    request: Request,
    character_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Unlink a character from the current user's profile."""
    _, character = await _get_own_character(session, current_user, character_id)
    await session.delete(character)
    await session.flush()
    await session.commit()

    logger.info(
        "player_character_unlinked",
        user_id=current_user.id,
        character_id=character_id,
    )


# ---------------------------------------------------------------------------
# Gear snapshot endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/characters/{character_id}/gear",
    response_model=list[GearSnapshotResponse],
)
@limiter.limit(RATE_LIMITS["general"])
async def list_gear_snapshots(
    request: Request,
    character_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List gear snapshots for a character (one per job)."""
    await _get_own_character(session, current_user, character_id)

    result = await session.execute(
        select(PlayerGearSnapshot)
        .where(PlayerGearSnapshot.character_id == character_id)
        .order_by(PlayerGearSnapshot.avg_item_level.desc())
    )
    snapshots = result.scalars().all()

    return [
        GearSnapshotResponse(
            id=s.id,
            character_id=s.character_id,
            job=s.job,
            gear=s.gear,
            avg_item_level=s.avg_item_level,
            source=s.source,
            synced_at=s.synced_at,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in snapshots
    ]


@router.post(
    "/characters/{character_id}/sync-gear",
    response_model=GearSyncResult,
)
@limiter.limit(RATE_LIMITS["external_api"])
async def sync_character_gear(
    request: Request,
    character_id: str,
    body: GearSyncRequest | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Sync gear from Lodestone/Tomestone for a linked character.

    Fetches the character's currently equipped gear and stores it as a
    gear snapshot for the detected job. Reuses the same Lodestone/Tomestone
    fetch pipeline as the static gear sync.
    """
    _, character = await _get_own_character(session, current_user, character_id)

    # Import here to avoid circular imports — lodestone router has the fetch logic
    from .lodestone import (
        _build_equipped_slots,
        _fetch_character_payload,
        _sanitize_avatar_url,
        classify_current_source,
    )

    lodestone_id = int(character.lodestone_id)
    force_refresh = body.force_refresh if body else False

    data = await _fetch_character_payload(
        lodestone_id,
        require_usable_gear=True,
        dev_error_codes=True,
        no_cache=force_refresh,
    )
    char_data = data["Character"]
    sync_source = str(data.get("__source") or "xivapi")
    gear_set = char_data.get("GearSet", {}) if isinstance(char_data.get("GearSet"), dict) else {}
    gear_items = gear_set.get("Gear", {}) if isinstance(gear_set.get("Gear"), dict) else {}

    active_class = gear_set.get("Class", {}) if isinstance(gear_set, dict) else {}
    synced_job = active_class.get("Abbreviation") if isinstance(active_class, dict) else None

    if not synced_job:
        raise HTTPException(status_code=502, detail="Could not determine character's active job")

    synced_job_upper = synced_job.upper()

    _, equipped_by_slot = await _build_equipped_slots(gear_items)

    # Build gear array in the standard format
    from ..constants import DEFAULT_GEAR_SLOTS

    gear: list[dict] = []
    for slot_name in DEFAULT_GEAR_SLOTS:
        equipped = equipped_by_slot.get(slot_name)
        if equipped and equipped.get("has_equipped_item"):
            gear.append({
                "slot": slot_name,
                "currentSource": equipped.get("current_source", "unknown"),
                "hasItem": False,  # No BiS target in solo context
                "isAugmented": False,
                "equippedItemId": equipped.get("item_id"),
                "equippedItemName": equipped.get("item_name"),
                "equippedItemLevel": equipped.get("item_level", 0),
                "equippedItemIcon": equipped.get("item_icon"),
                "itemLevel": equipped.get("item_level", 0),
            })
        else:
            gear.append({
                "slot": slot_name,
                "currentSource": "unknown",
                "hasItem": False,
                "isAugmented": False,
            })

    avg_ilvl = _calculate_avg_ilvl(gear)
    now = datetime.now(timezone.utc).isoformat()

    # Update character identity if changed
    new_name = str(char_data.get("Name") or "").strip()
    new_server = str(char_data.get("Server") or "").strip()
    new_avatar = _sanitize_avatar_url(char_data.get("Avatar"))
    if new_name and new_name != character.name:
        character.name = new_name
    if new_server and new_server != character.server:
        character.server = new_server
    if new_avatar:
        character.avatar_url = new_avatar
    character.updated_at = now

    # Upsert gear snapshot (one per character+job)
    result = await session.execute(
        select(PlayerGearSnapshot).where(
            PlayerGearSnapshot.character_id == character_id,
            PlayerGearSnapshot.job == synced_job_upper,
        )
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        snapshot.gear = gear
        snapshot.avg_item_level = avg_ilvl
        snapshot.source = sync_source
        snapshot.synced_at = now
        snapshot.updated_at = now
    else:
        snapshot = PlayerGearSnapshot(
            id=str(uuid.uuid4()),
            character_id=character_id,
            job=synced_job_upper,
            gear=gear,
            avg_item_level=avg_ilvl,
            source=sync_source,
            synced_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(snapshot)

    await session.flush()

    # Auto-link snapshot to matching job profile if one exists
    job_result = await session.execute(
        select(PlayerJobProfile)
        .join(PlayerProfile)
        .where(
            PlayerProfile.user_id == current_user.id,
            PlayerJobProfile.job == synced_job_upper,
        )
    )
    job_profile = job_result.scalar_one_or_none()
    if job_profile:
        job_profile.gear_snapshot_id = snapshot.id
        job_profile.updated_at = now

    await session.commit()

    logger.info(
        "player_gear_sync_complete",
        user_id=current_user.id,
        character_id=character_id,
        job=synced_job_upper,
        avg_ilvl=avg_ilvl,
        source=sync_source,
    )

    return GearSyncResult(
        snapshot_id=snapshot.id,
        job=synced_job_upper,
        avg_item_level=avg_ilvl,
        source=sync_source,
        synced_at=now,
        slot_count=len([g for g in gear if g.get("equippedItemId")]),
        gear=gear,
    )


# ---------------------------------------------------------------------------
# Job profile endpoints
# ---------------------------------------------------------------------------


@router.get("/jobs", response_model=list[PlayerJobProfileResponse])
@limiter.limit(RATE_LIMITS["general"])
async def list_job_profiles(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List the current user's job profiles."""
    profile = await _get_or_create_profile(session, current_user)
    await session.commit()

    # Fetch with gear snapshots eagerly loaded
    result = await session.execute(
        select(PlayerJobProfile)
        .options(selectinload(PlayerJobProfile.gear_snapshot))
        .where(PlayerJobProfile.profile_id == profile.id)
    )
    jobs = result.scalars().all()

    return [
        PlayerJobProfileResponse(
            id=jp.id,
            job=jp.job,
            role=jp.role,
            priority=jp.priority,
            readiness=jp.readiness,
            notes=jp.notes,
            gear_snapshot_id=jp.gear_snapshot_id,
            gear_snapshot=(
                GearSnapshotResponse(
                    id=jp.gear_snapshot.id,
                    character_id=jp.gear_snapshot.character_id,
                    job=jp.gear_snapshot.job,
                    gear=jp.gear_snapshot.gear,
                    avg_item_level=jp.gear_snapshot.avg_item_level,
                    source=jp.gear_snapshot.source,
                    synced_at=jp.gear_snapshot.synced_at,
                    created_at=jp.gear_snapshot.created_at,
                    updated_at=jp.gear_snapshot.updated_at,
                )
                if jp.gear_snapshot
                else None
            ),
            created_at=jp.created_at,
            updated_at=jp.updated_at,
        )
        for jp in jobs
    ]


@router.post("/jobs", response_model=PlayerJobProfileResponse, status_code=201)
@limiter.limit(RATE_LIMITS["heavy"])
async def create_job_profile(
    request: Request,
    body: PlayerJobProfileCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new job profile (main/alt/flex tracking)."""
    job_upper = body.job.upper()
    if job_upper.lower() not in VALID_JOBS:
        raise HTTPException(status_code=400, detail=f"Invalid job: {body.job}")

    role_lower = body.role.lower()
    if role_lower not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    if body.priority not in VALID_JOB_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Must be one of: {', '.join(sorted(VALID_JOB_PRIORITIES))}",
        )

    if body.readiness not in VALID_READINESS_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid readiness. Must be one of: {', '.join(sorted(VALID_READINESS_STATES))}",
        )

    profile = await _get_or_create_profile(session, current_user)

    # Check for duplicate job
    for existing in profile.job_profiles:
        if existing.job == job_upper:
            raise HTTPException(
                status_code=409,
                detail=f"Job profile for {job_upper} already exists",
            )

    # Enforce single main
    if body.priority == "main":
        for existing in profile.job_profiles:
            if existing.priority == "main":
                existing.priority = "preferred_alt"
                existing.updated_at = datetime.now(timezone.utc).isoformat()

    now = datetime.now(timezone.utc).isoformat()

    # Auto-link gear snapshot if one exists for this job
    snapshot_id = None
    for char in profile.characters:
        snap_result = await session.execute(
            select(PlayerGearSnapshot).where(
                PlayerGearSnapshot.character_id == char.id,
                PlayerGearSnapshot.job == job_upper,
            )
        )
        snap = snap_result.scalar_one_or_none()
        if snap:
            snapshot_id = snap.id
            break

    job_profile = PlayerJobProfile(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        job=job_upper,
        role=role_lower,
        priority=body.priority,
        readiness=body.readiness,
        notes=body.notes,
        gear_snapshot_id=snapshot_id,
        created_at=now,
        updated_at=now,
    )
    session.add(job_profile)
    await session.flush()
    await session.commit()

    logger.info(
        "player_job_profile_created",
        user_id=current_user.id,
        job=job_upper,
        priority=body.priority,
    )

    return PlayerJobProfileResponse(
        id=job_profile.id,
        job=job_profile.job,
        role=job_profile.role,
        priority=job_profile.priority,
        readiness=job_profile.readiness,
        notes=job_profile.notes,
        gear_snapshot_id=job_profile.gear_snapshot_id,
        created_at=job_profile.created_at,
        updated_at=job_profile.updated_at,
    )


@router.put("/jobs/{job_profile_id}", response_model=PlayerJobProfileResponse)
@limiter.limit(RATE_LIMITS["general"])
async def update_job_profile(
    request: Request,
    job_profile_id: str,
    body: PlayerJobProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a job profile."""
    result = await session.execute(
        select(PlayerJobProfile)
        .join(PlayerProfile)
        .where(
            PlayerJobProfile.id == job_profile_id,
            PlayerProfile.user_id == current_user.id,
        )
    )
    job_profile = result.scalar_one_or_none()
    if not job_profile:
        raise HTTPException(status_code=404, detail="Job profile not found")

    now = datetime.now(timezone.utc).isoformat()

    if body.priority is not None:
        if body.priority not in VALID_JOB_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority. Must be one of: {', '.join(sorted(VALID_JOB_PRIORITIES))}",
            )
        # Enforce single main
        if body.priority == "main":
            others = await session.execute(
                select(PlayerJobProfile).where(
                    PlayerJobProfile.profile_id == job_profile.profile_id,
                    PlayerJobProfile.id != job_profile_id,
                    PlayerJobProfile.priority == "main",
                )
            )
            for other in others.scalars():
                other.priority = "preferred_alt"
                other.updated_at = now
        job_profile.priority = body.priority

    if body.readiness is not None:
        if body.readiness not in VALID_READINESS_STATES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid readiness. Must be one of: {', '.join(sorted(VALID_READINESS_STATES))}",
            )
        job_profile.readiness = body.readiness

    if body.notes is not None:
        job_profile.notes = body.notes

    job_profile.updated_at = now
    await session.flush()
    await session.commit()

    return PlayerJobProfileResponse(
        id=job_profile.id,
        job=job_profile.job,
        role=job_profile.role,
        priority=job_profile.priority,
        readiness=job_profile.readiness,
        notes=job_profile.notes,
        gear_snapshot_id=job_profile.gear_snapshot_id,
        created_at=job_profile.created_at,
        updated_at=job_profile.updated_at,
    )


@router.delete("/jobs/{job_profile_id}", status_code=204)
@limiter.limit(RATE_LIMITS["heavy"])
async def delete_job_profile(
    request: Request,
    job_profile_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Remove a job profile."""
    result = await session.execute(
        select(PlayerJobProfile)
        .join(PlayerProfile)
        .where(
            PlayerJobProfile.id == job_profile_id,
            PlayerProfile.user_id == current_user.id,
        )
    )
    job_profile = result.scalar_one_or_none()
    if not job_profile:
        raise HTTPException(status_code=404, detail="Job profile not found")

    await session.delete(job_profile)
    await session.flush()
    await session.commit()

    logger.info(
        "player_job_profile_deleted",
        user_id=current_user.id,
        job_profile_id=job_profile_id,
    )


# ---------------------------------------------------------------------------
# Goal endpoints (collection hunting + personal goals)
# ---------------------------------------------------------------------------


def _goal_to_response(goal: PlayerGoal) -> PlayerGoalResponse:
    return PlayerGoalResponse(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        goal_type=goal.goal_type,
        category=goal.category,
        status=goal.status,
        current_count=goal.current_count,
        target_count=goal.target_count,
        source_content=goal.source_content,
        source_item=goal.source_item,
        linked_character_id=goal.linked_character_id,
        linked_job=goal.linked_job,
        due_date=goal.due_date,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


@router.get("/goals", response_model=list[PlayerGoalResponse])
@limiter.limit(RATE_LIMITS["general"])
async def list_goals(
    request: Request,
    goal_type: str | None = None,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List the current user's goals, optionally filtered by type or status."""
    profile = await _get_or_create_profile(session, current_user)
    await session.commit()

    query = select(PlayerGoal).where(PlayerGoal.profile_id == profile.id)
    if goal_type:
        query = query.where(PlayerGoal.goal_type == goal_type)
    if status:
        query = query.where(PlayerGoal.status == status)
    query = query.order_by(PlayerGoal.created_at.desc())

    result = await session.execute(query)
    goals = result.scalars().all()
    return [_goal_to_response(g) for g in goals]


@router.post("/goals", response_model=PlayerGoalResponse, status_code=201)
@limiter.limit(RATE_LIMITS["heavy"])
async def create_goal(
    request: Request,
    body: PlayerGoalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new goal (collection/hunt or personal)."""
    if body.goal_type not in VALID_GOAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid goal_type. Must be one of: {', '.join(sorted(VALID_GOAL_TYPES))}",
        )

    if body.status not in VALID_GOAL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_GOAL_STATUSES))}",
        )

    if body.linked_job and body.linked_job.lower() not in VALID_JOBS:
        raise HTTPException(status_code=400, detail=f"Invalid job: {body.linked_job}")

    profile = await _get_or_create_profile(session, current_user)

    # Validate linked_character_id belongs to this profile
    if body.linked_character_id:
        char_exists = any(
            c.id == body.linked_character_id for c in profile.characters
        )
        if not char_exists:
            raise HTTPException(status_code=400, detail="Linked character not found on your profile")

    now = datetime.now(timezone.utc).isoformat()
    goal = PlayerGoal(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        title=body.title,
        description=body.description,
        goal_type=body.goal_type,
        category=body.category,
        status=body.status,
        current_count=body.current_count,
        target_count=body.target_count,
        source_content=body.source_content,
        source_item=body.source_item,
        linked_character_id=body.linked_character_id,
        linked_job=body.linked_job.upper() if body.linked_job else None,
        due_date=body.due_date,
        created_at=now,
        updated_at=now,
    )
    session.add(goal)
    await session.flush()
    await session.commit()

    logger.info(
        "player_goal_created",
        user_id=current_user.id,
        goal_id=goal.id,
        goal_type=body.goal_type,
    )

    return _goal_to_response(goal)


@router.put("/goals/{goal_id}", response_model=PlayerGoalResponse)
@limiter.limit(RATE_LIMITS["general"])
async def update_goal(
    request: Request,
    goal_id: str,
    body: PlayerGoalUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a goal."""
    result = await session.execute(
        select(PlayerGoal)
        .join(PlayerProfile)
        .where(
            PlayerGoal.id == goal_id,
            PlayerProfile.user_id == current_user.id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    now = datetime.now(timezone.utc).isoformat()

    if body.title is not None:
        goal.title = body.title
    if body.description is not None:
        goal.description = body.description
    if body.category is not None:
        goal.category = body.category
    if body.status is not None:
        if body.status not in VALID_GOAL_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_GOAL_STATUSES))}",
            )
        goal.status = body.status
    if body.current_count is not None:
        goal.current_count = body.current_count
    if body.target_count is not None:
        goal.target_count = body.target_count
    if body.source_content is not None:
        goal.source_content = body.source_content
    if body.source_item is not None:
        goal.source_item = body.source_item
    if body.linked_character_id is not None:
        if body.linked_character_id:
            # Validate it belongs to user
            profile = await _get_or_create_profile(session, current_user)
            char_exists = any(
                c.id == body.linked_character_id for c in profile.characters
            )
            if not char_exists:
                raise HTTPException(status_code=400, detail="Linked character not found on your profile")
        goal.linked_character_id = body.linked_character_id or None
    if body.linked_job is not None:
        if body.linked_job and body.linked_job.lower() not in VALID_JOBS:
            raise HTTPException(status_code=400, detail=f"Invalid job: {body.linked_job}")
        goal.linked_job = body.linked_job.upper() if body.linked_job else None
    if body.due_date is not None:
        goal.due_date = body.due_date

    goal.updated_at = now
    await session.flush()
    await session.commit()

    return _goal_to_response(goal)


@router.delete("/goals/{goal_id}", status_code=204)
@limiter.limit(RATE_LIMITS["heavy"])
async def delete_goal(
    request: Request,
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a goal."""
    result = await session.execute(
        select(PlayerGoal)
        .join(PlayerProfile)
        .where(
            PlayerGoal.id == goal_id,
            PlayerProfile.user_id == current_user.id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    await session.delete(goal)
    await session.flush()
    await session.commit()

    logger.info(
        "player_goal_deleted",
        user_id=current_user.id,
        goal_id=goal_id,
    )


# ---------------------------------------------------------------------------
# Plugin gear sync endpoint
# ---------------------------------------------------------------------------


@plugin_router.post("/gear-sync", response_model=PluginPlayerGearSyncResult)
@limiter.limit(RATE_LIMITS["general"])
async def plugin_player_gear_sync(
    request: Request,
    body: PluginPlayerGearSyncRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Plugin-accessible endpoint to sync gear to user's linked character.

    The plugin sends the currently equipped gear data and this endpoint
    routes it to the user's matching PlayerCharacter + PlayerGearSnapshot.
    If no character is linked, returns 404 with a helpful message.
    """
    job_upper = body.job.upper()
    if job_upper.lower() not in VALID_JOBS:
        raise HTTPException(status_code=400, detail=f"Invalid job: {body.job}")

    # Find or create profile
    profile = await _get_or_create_profile(session, current_user)

    # Find matching character by name + world
    character = None
    for c in profile.characters:
        if (
            c.name.lower().strip() == body.character_name.lower().strip()
            and c.server.lower().strip() == body.character_world.lower().strip()
        ):
            character = c
            break

    if not character:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No linked character found matching '{body.character_name}' on "
                f"'{body.character_world}'. Link your character on the profile page first."
            ),
        )

    # Build gear array from plugin data
    gear: list[dict] = []
    for slot_data in body.gear:
        gear.append({
            "slot": slot_data.slot,
            "currentSource": slot_data.current_source,
            "hasItem": False,
            "isAugmented": slot_data.is_augmented,
            "equippedItemId": slot_data.item_id,
            "equippedItemName": slot_data.item_name,
            "equippedItemLevel": slot_data.item_level,
            "equippedItemIcon": slot_data.item_icon,
            "itemLevel": slot_data.item_level,
        })

    avg_ilvl = _calculate_avg_ilvl(gear)
    now = datetime.now(timezone.utc).isoformat()
    source = body.source if body.source in VALID_SYNC_SOURCES else "plugin"

    # Upsert gear snapshot
    result = await session.execute(
        select(PlayerGearSnapshot).where(
            PlayerGearSnapshot.character_id == character.id,
            PlayerGearSnapshot.job == job_upper,
        )
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        snapshot.gear = gear
        snapshot.avg_item_level = avg_ilvl
        snapshot.source = source
        snapshot.synced_at = now
        snapshot.updated_at = now
    else:
        snapshot = PlayerGearSnapshot(
            id=str(uuid.uuid4()),
            character_id=character.id,
            job=job_upper,
            gear=gear,
            avg_item_level=avg_ilvl,
            source=source,
            synced_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(snapshot)

    await session.flush()

    # Auto-link to job profile if exists
    job_result = await session.execute(
        select(PlayerJobProfile).where(
            PlayerJobProfile.profile_id == profile.id,
            PlayerJobProfile.job == job_upper,
        )
    )
    job_profile = job_result.scalar_one_or_none()
    if job_profile:
        job_profile.gear_snapshot_id = snapshot.id
        job_profile.updated_at = now

    await session.commit()

    logger.info(
        "plugin_player_gear_sync_complete",
        user_id=current_user.id,
        character_id=character.id,
        job=job_upper,
        avg_ilvl=avg_ilvl,
        source=source,
    )

    return PluginPlayerGearSyncResult(
        character_id=character.id,
        snapshot_id=snapshot.id,
        job=job_upper,
        avg_item_level=avg_ilvl,
        slot_count=len([g for g in gear if g.get("equippedItemId")]),
        source=source,
        synced_at=now,
    )
