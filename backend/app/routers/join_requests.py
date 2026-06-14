"""API router for static group join requests (discovery applications)"""

import uuid
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user
from ..models import JoinRequest, Membership, MemberRole, StaticGroup, User
from .notifications import create_notification
from ..permissions import (
    NotFound,
    PermissionDenied,
    create_membership_for_assignment,
    get_static_group,
    get_static_group_by_share_code,
    get_user_membership,
    require_can_manage_members,
)
from ..schemas import (
    JoinRequestCreate,
    JoinRequestListResponse,
    JoinRequestResponse,
    JoinRequestStatusEnum,
    LinkRosterRequest,
    RequesterInfo,
)

router = APIRouter(prefix="/api", tags=["join-requests"])

DAY_LABELS = {
    "MO": "Mon",
    "TU": "Tue",
    "WE": "Wed",
    "TH": "Thu",
    "FR": "Fri",
    "SA": "Sat",
    "SU": "Sun",
}


def _is_discoverable(group: StaticGroup) -> bool:
    if not group.is_public:
        return False
    settings = group.settings
    if not settings or not isinstance(settings, dict):
        return False
    discovery = settings.get("discovery")
    if not discovery or not isinstance(discovery, dict):
        return False
    return discovery.get("enabled") is True


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _gear_complete_slots(gear: list | None) -> int:
    if not isinstance(gear, list):
        return 0
    complete = 0
    for slot in gear:
        if not isinstance(slot, dict):
            continue
        if (
            slot.get("equippedItemId")
            or slot.get("equippedItemName")
            or slot.get("itemId")
            or slot.get("itemName")
            or slot.get("hasItem") is True
        ):
            complete += 1
    return complete


def _gear_snapshot_summary(snapshot) -> dict:
    return {
        "job": snapshot.job,
        "avgItemLevel": snapshot.avg_item_level,
        "source": snapshot.source,
        "syncedAt": snapshot.synced_at,
        "completeSlotsCount": _gear_complete_slots(snapshot.gear),
    }


def _sanitize_availability_summary(value: dict | None) -> dict | None:
    if not isinstance(value, dict):
        return None
    configured_days = value.get("configuredDays")
    timezone_value = value.get("timezone")
    if not isinstance(configured_days, int) or configured_days <= 0:
        return None
    if not isinstance(timezone_value, str) or not timezone_value.strip():
        return None
    return {
        "configuredDays": configured_days,
        "timezone": timezone_value[:64],
        "detailLevel": "summary_only",
        "dayLabels": [
            str(label)[:12]
            for label in value.get("dayLabels", [])
            if isinstance(label, str) and label.strip()
        ],
        "source": "player_hub" if value.get("source") == "player_hub" else None,
    }


def _availability_slots(raw_slots: str | list | None) -> list[str]:
    if raw_slots is None:
        return []
    if isinstance(raw_slots, list):
        parsed = raw_slots
    elif isinstance(raw_slots, str) and raw_slots.strip():
        try:
            parsed = json.loads(raw_slots)
        except json.JSONDecodeError:
            return []
    else:
        return []

    if not isinstance(parsed, list):
        return []
    return [slot for slot in parsed if isinstance(slot, str) and slot.strip()]


def _availability_slots_present(raw_slots: str | list | None) -> bool:
    return len(_availability_slots(raw_slots)) > 0


def _player_availability_summary(rows: list, include_exact: bool) -> dict | None:
    configured: list[tuple[str, str, list[str]]] = []
    for row in rows:
        slots = _availability_slots(row.slots)
        if slots:
            configured.append((row.day_of_week, row.timezone, slots))

    if not configured:
        return None

    day_labels = [DAY_LABELS.get(day, day) for day, _, _ in configured]
    summary: dict = {
        "configuredDays": len(configured),
        "timezone": configured[0][1],
        "detailLevel": "exact" if include_exact else "summary_only",
        "dayLabels": day_labels,
        "source": "player_hub",
    }

    if include_exact:
        summary["exactWindows"] = [
            {
                "dayOfWeek": day,
                "dayLabel": DAY_LABELS.get(day, day),
                "slots": slots,
            }
            for day, _, slots in configured
        ]
    return summary
    if not isinstance(raw_slots, str) or not raw_slots.strip():
        return False
    try:
        parsed = json.loads(raw_slots)
    except json.JSONDecodeError:
        return False
    return isinstance(parsed, list) and len(parsed) > 0


def _request_to_response(
    req: JoinRequest,
    *,
    include_requester: bool = False,
    group_name: str | None = None,
) -> JoinRequestResponse:
    requester_info = None
    if include_requester and req.requester:
        name = req.requester.display_name or req.requester.discord_username
        requester_info = RequesterInfo(
            id=req.requester.id,
            display_name=name,
            avatar_url=req.requester.avatar_url,
        )

    return JoinRequestResponse(
        id=req.id,
        static_group_id=req.static_group_id,
        static_group_name=group_name,
        requester_user_id=req.requester_user_id,
        requester=requester_info,
        status=JoinRequestStatusEnum(req.status),
        message=req.message,
        role_interest=req.role_interest,
        job_interest=req.job_interest,
        availability_note=req.availability_note,
        contact_discord=req.contact_discord,
        player_profile_id=req.player_profile_id,
        player_character_id=req.player_character_id,
        selected_job=req.selected_job,
        selected_role=req.selected_role,
        included_alt_jobs=req.included_alt_jobs,
        gear_snapshot_summary=req.gear_snapshot_summary,
        availability_summary=req.availability_summary,
        readiness_at_apply=req.readiness_at_apply,
        profile_share_code_at_apply=req.profile_share_code_at_apply,
        goal_alignment_snapshot=getattr(req, 'goal_alignment_snapshot', None),
        fit_snapshot=getattr(req, 'fit_snapshot', None),
        profile_visibility_at_apply=req.profile_visibility_at_apply,
        profile_share_enabled_at_apply=req.profile_share_enabled_at_apply,
        character_name_at_apply=req.character_name_at_apply,
        character_world_at_apply=req.character_world_at_apply,
        character_dc_at_apply=req.character_dc_at_apply,
        character_avatar_url_at_apply=req.character_avatar_url_at_apply,
        character_lodestone_id_at_apply=req.character_lodestone_id_at_apply,
        roster_player_id=req.roster_player_id,
        created_at=req.created_at,
        updated_at=req.updated_at,
        resolved_at=req.resolved_at,
        resolved_by_user_id=req.resolved_by_user_id,
    )


# --- Applicant endpoints ---


@router.post(
    "/static-groups/{share_code}/join-requests",
    response_model=JoinRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_join_request(
    share_code: str,
    data: JoinRequestCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    group = await get_static_group_by_share_code(session, share_code)

    if not _is_discoverable(group):
        raise PermissionDenied(
            "This static is not accepting join requests. "
            "It must be public with discovery enabled."
        )

    existing_membership = await get_user_membership(session, current_user.id, group.id)
    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this static",
        )

    existing_request = await session.execute(
        select(JoinRequest).where(
            JoinRequest.static_group_id == group.id,
            JoinRequest.requester_user_id == current_user.id,
            JoinRequest.status == "pending",
        )
    )
    if existing_request.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request for this static",
        )

    profile = None

    # Validate profile ownership if profile fields provided
    if data.player_profile_id:
        from ..models.player_profile import PlayerProfile

        profile_result = await session.execute(
            select(PlayerProfile).where(
                PlayerProfile.id == data.player_profile_id,
                PlayerProfile.user_id == current_user.id,
            )
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player profile not found or does not belong to you",
            )

    # Validate character and capture identity snapshot
    char_name = data.character_name_at_apply
    char_world = data.character_world_at_apply
    char_dc = data.character_dc_at_apply
    char_avatar = data.character_avatar_url_at_apply
    char_lodestone_id: str | None = None

    if data.player_character_id and data.player_profile_id:
        from ..models.player_character import PlayerCharacter

        char_result = await session.execute(
            select(PlayerCharacter).where(
                PlayerCharacter.id == data.player_character_id,
                PlayerCharacter.profile_id == data.player_profile_id,
            )
        )
        character = char_result.scalar_one_or_none()
        if not character:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Character not found or does not belong to your profile",
            )
        # Auto-populate from character if not explicitly provided
        if not char_name:
            char_name = character.name
        if not char_world:
            char_world = character.server
        if not char_dc:
            char_dc = character.data_center
        if not char_avatar:
            char_avatar = character.avatar_url
        char_lodestone_id = character.lodestone_id

    role_interest = data.role_interest
    job_interest = data.job_interest
    selected_job = data.selected_job
    selected_role = data.selected_role
    included_alt_jobs = data.included_alt_jobs
    gear_snapshot_summary = data.gear_snapshot_summary
    readiness_at_apply = data.readiness_at_apply
    profile_share_code_at_apply = data.profile_share_code_at_apply
    profile_visibility_at_apply: str | None = None
    profile_share_enabled_at_apply: bool | None = None
    availability_summary = _sanitize_availability_summary(data.availability_summary)

    if profile:
        from ..models.player_gear_snapshot import PlayerGearSnapshot
        from ..models.player_job_profile import PlayerJobProfile

        profile_visibility_at_apply = profile.visibility
        profile_share_enabled_at_apply = profile.share_enabled
        profile_share_code_at_apply = (
            profile.share_code
            if profile.share_enabled and profile.visibility != "private" and profile.share_code
            else None
        )

        job_profile_result = await session.execute(
            select(PlayerJobProfile)
            .where(PlayerJobProfile.profile_id == profile.id)
            .options(selectinload(PlayerJobProfile.gear_snapshot))
        )
        job_profiles = job_profile_result.scalars().all()
        requested_job = data.selected_job.lower() if data.selected_job else None
        selected_job_profile = next(
            (job for job in job_profiles if requested_job and job.job.lower() == requested_job),
            None,
        )
        if requested_job and not selected_job_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected job was not found in your Player Hub jobs",
            )
        if not selected_job_profile:
            selected_job_profile = next((job for job in job_profiles if job.priority == "main"), None)
        if not selected_job_profile and job_profiles:
            selected_job_profile = job_profiles[0]

        if selected_job_profile:
            selected_job = selected_job_profile.job.lower()
            selected_role = selected_job_profile.role
            readiness_at_apply = selected_job_profile.readiness

            requested_alt_jobs: set[str] = set()
            for entry in data.included_alt_jobs or []:
                if isinstance(entry, dict) and isinstance(entry.get("job"), str):
                    requested_alt_jobs.add(entry["job"].lower())
            for job in data.job_interest or []:
                if job.lower() != selected_job:
                    requested_alt_jobs.add(job.lower())

            alt_profiles = [
                job for job in job_profiles
                if job.id != selected_job_profile.id and job.job.lower() in requested_alt_jobs
            ]
            included_alt_jobs = [
                {
                    "job": job.job,
                    "role": job.role,
                    "priority": job.priority,
                    "readiness": job.readiness,
                }
                for job in alt_profiles
            ] or None
            job_interest = _unique([selected_job] + [job.job.lower() for job in alt_profiles])
            role_interest = _unique([selected_role] + [job.role for job in alt_profiles])

            gear_snapshot = selected_job_profile.gear_snapshot
            if not gear_snapshot and data.player_character_id:
                gear_result = await session.execute(
                    select(PlayerGearSnapshot).where(
                        PlayerGearSnapshot.character_id == data.player_character_id,
                        PlayerGearSnapshot.job == selected_job_profile.job.upper(),
                    )
                )
                gear_snapshot = gear_result.scalar_one_or_none()
            if gear_snapshot:
                gear_snapshot_summary = _gear_snapshot_summary(gear_snapshot)

    if data.player_profile_id:
        from ..models.personal_availability import PersonalAvailabilityTemplate

        personal_availability_result = await session.execute(
            select(PersonalAvailabilityTemplate).where(
                PersonalAvailabilityTemplate.user_id == current_user.id
            )
        )
        personal_availability = personal_availability_result.scalars().all()
        availability_summary = _player_availability_summary(
            personal_availability,
            include_exact=data.include_exact_availability,
        )

    # Snapshot goal alignment counts at apply time (no private goal details stored)
    goal_alignment_snapshot: dict | None = None
    # Fit snapshot — public-only data frozen at submission time
    fit_snapshot: dict | None = None
    if data.player_profile_id:
        try:
            from ..models.player_goal import PlayerGoal
            from ..models.static_objective_goal import StaticObjectiveGoal
            from ..services.goal_matching import compute_alignment

            sg_result = await session.execute(
                select(StaticObjectiveGoal)
                .where(StaticObjectiveGoal.static_group_id == group.id)
            )
            static_goals_for_snapshot = [
                {"id": g.id, "category": g.category, "priority": g.priority, "title": g.title}
                for g in sg_result.scalars().all()
            ]
            if static_goals_for_snapshot:
                pg_result = await session.execute(
                    select(PlayerGoal).where(
                        PlayerGoal.profile_id == data.player_profile_id,
                        PlayerGoal.is_public == True,  # noqa: E712
                    )
                )
                player_goals_for_snapshot = [
                    {
                        "id": g.id,
                        "goal_type": g.goal_type,
                        "category": g.objective_category or g.category,
                        "intent_level": g.intent_level,
                    }
                    for g in pg_result.scalars().all()
                ]
                alignment_result = compute_alignment(player_goals_for_snapshot, static_goals_for_snapshot)
                goal_alignment_snapshot = alignment_result["summary"]
        except Exception:
            pass  # Snapshot failure must never block the application

    # Build fit_snapshot from public profile data only
    try:
        _snap_job = selected_job.upper() if selected_job else None
        _snap_alt_jobs = [
            entry["job"].upper()
            for entry in (included_alt_jobs or [])
            if isinstance(entry, dict) and isinstance(entry.get("job"), str)
        ]

        # Gear summary: "iLxxxx avg" from the gear snapshot summary
        _snap_gear_summary: str | None = None
        if isinstance(gear_snapshot_summary, dict):
            avg_ilv = gear_snapshot_summary.get("avgItemLevel")
            if avg_ilv is not None:
                _snap_gear_summary = f"iL{avg_ilv} avg"

        # Public BiS target name (only if profile is shareable/public, using active target set)
        # Uses raw SQL to avoid ORM mapper initialization of PlayerBisTargetSet
        # (which has a known reverse_property mismatch that could fail mapper configure).
        _snap_bis_name: str | None = None
        if profile and profile.visibility != "private" and _snap_job:
            try:
                from sqlalchemy import text as sql_text
                bis_row = await session.execute(
                    sql_text(
                        "SELECT name FROM player_bis_target_sets"
                        " WHERE profile_id = :profile_id AND job = :job AND is_active = 1"
                        " LIMIT 1"
                    ),
                    {"profile_id": profile.id, "job": _snap_job},
                )
                bis_record = bis_row.fetchone()
                if bis_record and bis_record[0]:
                    _snap_bis_name = bis_record[0]
            except Exception:
                pass  # BiS lookup failure must never block the application

        # Goal alignment counts from public goals only (already computed above)
        _snap_goal_alignment: dict | None = goal_alignment_snapshot

        # Schedule overlap: day labels that player is available
        _snap_schedule_overlap: list[str] | None = None
        if isinstance(availability_summary, dict):
            day_labels = availability_summary.get("dayLabels")
            if isinstance(day_labels, list) and day_labels:
                _snap_schedule_overlap = [str(d) for d in day_labels if isinstance(d, str)]

        # Languages and comms preference from profile (public data)
        _snap_languages: list[str] = []
        _snap_comms: str | None = None
        if profile:
            if hasattr(profile, "languages") and isinstance(profile.languages, list):
                _snap_languages = [str(lang) for lang in profile.languages if lang]
            if hasattr(profile, "comms_preference") and profile.comms_preference:
                _snap_comms = str(profile.comms_preference)

        fit_snapshot = {
            "job": _snap_job,
            "altJobs": _snap_alt_jobs,
            "gearSummary": _snap_gear_summary,
            "selectedBisTargetName": _snap_bis_name,
            "goalAlignment": _snap_goal_alignment,
            "scheduleOverlap": _snap_schedule_overlap,
            "languages": _snap_languages,
            "commsPreference": _snap_comms,
            "snapshotAt": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        pass  # fit_snapshot failure must never block the application

    now = datetime.now(timezone.utc).isoformat()
    join_request = JoinRequest(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        requester_user_id=current_user.id,
        status="pending",
        message=data.message,
        role_interest=role_interest,
        job_interest=job_interest,
        availability_note=data.availability_note,
        contact_discord=data.contact_discord.strip() if data.contact_discord and data.contact_discord.strip() else None,
        player_profile_id=data.player_profile_id,
        player_character_id=data.player_character_id,
        selected_job=selected_job,
        selected_role=selected_role,
        included_alt_jobs=included_alt_jobs,
        gear_snapshot_summary=gear_snapshot_summary,
        availability_summary=availability_summary,
        readiness_at_apply=readiness_at_apply,
        profile_share_code_at_apply=profile_share_code_at_apply,
        profile_visibility_at_apply=profile_visibility_at_apply,
        profile_share_enabled_at_apply=profile_share_enabled_at_apply,
        goal_alignment_snapshot=goal_alignment_snapshot,
        fit_snapshot=fit_snapshot,
        character_name_at_apply=char_name,
        character_world_at_apply=char_world,
        character_dc_at_apply=char_dc,
        character_avatar_url_at_apply=char_avatar,
        character_lodestone_id_at_apply=char_lodestone_id,
        created_at=now,
        updated_at=now,
    )
    session.add(join_request)
    await session.flush()
    await session.commit()

    # Notify leads and owners of the new application
    leads_result = await session.execute(
        select(Membership).where(
            Membership.static_group_id == group.id,
            Membership.role.in_(["owner", "lead"]),
        )
    )
    applicant_name = char_name or current_user.display_name or current_user.discord_username
    for member in leads_result.scalars().all():
        if member.user_id != current_user.id:
            await create_notification(
                session,
                user_id=member.user_id,
                notification_type="new_application",
                title="New application received",
                body=f"{applicant_name} applied to join {group.name}.",
                href=f"/group/{group.share_code}",
            )
    await session.commit()

    return _request_to_response(join_request, group_name=group.name)


@router.get("/me/join-requests", response_model=list[JoinRequestResponse])
async def list_my_join_requests(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[JoinRequestResponse]:
    result = await session.execute(
        select(JoinRequest)
        .where(JoinRequest.requester_user_id == current_user.id)
        .options(selectinload(JoinRequest.static_group))
        .order_by(JoinRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        _request_to_response(req, group_name=req.static_group.name if req.static_group else None)
        for req in requests
    ]


@router.post("/join-requests/{request_id}/cancel", response_model=JoinRequestResponse)
async def cancel_join_request(
    request_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    result = await session.execute(
        select(JoinRequest).where(JoinRequest.id == request_id)
    )
    join_request = result.scalar_one_or_none()

    if not join_request:
        raise NotFound("Join request not found")

    if join_request.requester_user_id != current_user.id:
        raise PermissionDenied("You can only cancel your own requests")

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a request that is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "cancelled"
    join_request.message = None
    join_request.availability_note = None
    join_request.contact_discord = None
    join_request.resolved_at = now
    join_request.updated_at = now

    await session.flush()
    await session.commit()

    return _request_to_response(join_request)


# --- Owner/Lead endpoints ---


@router.get(
    "/static-groups/{group_id}/join-requests",
    response_model=JoinRequestListResponse,
)
async def list_group_join_requests(
    group_id: str,
    include_resolved: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestListResponse:
    group = await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    query = (
        select(JoinRequest)
        .where(JoinRequest.static_group_id == group_id)
        .options(selectinload(JoinRequest.requester))
    )

    if not include_resolved:
        query = query.where(JoinRequest.status.in_(["pending", "under_review"]))

    query = query.order_by(JoinRequest.created_at.desc())
    result = await session.execute(query)
    requests = result.scalars().all()

    pending_count_result = await session.execute(
        select(func.count()).select_from(JoinRequest).where(
            JoinRequest.static_group_id == group_id,
            JoinRequest.status.in_(["pending", "under_review"]),
        )
    )
    pending_count = pending_count_result.scalar() or 0

    return JoinRequestListResponse(
        items=[_request_to_response(req, include_requester=True, group_name=group.name) for req in requests],
        pending_count=pending_count,
    )


@router.post("/join-requests/{request_id}/accept", response_model=JoinRequestResponse)
async def accept_join_request(
    request_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    result = await session.execute(
        select(JoinRequest)
        .where(JoinRequest.id == request_id)
        .options(selectinload(JoinRequest.requester))
    )
    join_request = result.scalar_one_or_none()

    if not join_request:
        raise NotFound("Join request not found")

    await require_can_manage_members(session, current_user.id, join_request.static_group_id)

    if join_request.status not in ("pending", "under_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept a request that is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "accepted"
    join_request.message = None
    join_request.availability_note = None
    join_request.contact_discord = None
    join_request.resolved_at = now
    join_request.resolved_by_user_id = current_user.id
    join_request.updated_at = now

    await create_membership_for_assignment(
        session,
        join_request.requester_user_id,
        join_request.static_group_id,
        MemberRole.MEMBER,
    )

    await session.flush()
    await session.commit()

    if join_request.requester_user_id:
        group_result = await session.execute(
            select(StaticGroup).where(StaticGroup.id == join_request.static_group_id)
        )
        group = group_result.scalar_one_or_none()
        group_name = group.name if group else "the static"
        await create_notification(
            session,
            user_id=join_request.requester_user_id,
            notification_type="application_accepted",
            title="Application accepted",
            body=f"Your application to {group_name} has been accepted. Welcome!",
            href="/dashboard",
        )
        await session.commit()

    return _request_to_response(join_request, include_requester=True)


@router.post("/join-requests/{request_id}/under-review", response_model=JoinRequestResponse)
async def mark_under_review(
    request_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    """Mark a join request as under review (maybe later).

    Does NOT clear PII — the leader may still need to contact the applicant.
    """
    result = await session.execute(
        select(JoinRequest)
        .where(JoinRequest.id == request_id)
        .options(selectinload(JoinRequest.requester))
    )
    join_request = result.scalar_one_or_none()

    if not join_request:
        raise NotFound("Join request not found")

    await require_can_manage_members(session, current_user.id, join_request.static_group_id)

    if join_request.status not in ("pending", "under_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark a request as under review when it is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "under_review"
    join_request.updated_at = now

    await session.flush()
    await session.commit()

    return _request_to_response(join_request, include_requester=True)


@router.post("/join-requests/{request_id}/decline", response_model=JoinRequestResponse)
async def decline_join_request(
    request_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    result = await session.execute(
        select(JoinRequest)
        .where(JoinRequest.id == request_id)
        .options(selectinload(JoinRequest.requester))
    )
    join_request = result.scalar_one_or_none()

    if not join_request:
        raise NotFound("Join request not found")

    await require_can_manage_members(session, current_user.id, join_request.static_group_id)

    if join_request.status not in ("pending", "under_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot decline a request that is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "declined"
    join_request.message = None
    join_request.availability_note = None
    join_request.contact_discord = None
    join_request.resolved_at = now
    join_request.resolved_by_user_id = current_user.id
    join_request.updated_at = now

    await session.flush()
    await session.commit()

    if join_request.requester_user_id:
        group_result = await session.execute(
            select(StaticGroup).where(StaticGroup.id == join_request.static_group_id)
        )
        group = group_result.scalar_one_or_none()
        group_name = group.name if group else "the static"
        await create_notification(
            session,
            user_id=join_request.requester_user_id,
            notification_type="application_declined",
            title="Application not accepted",
            body=f"Your application to {group_name} was not accepted at this time.",
        )
        await session.commit()

    return _request_to_response(join_request, include_requester=True)


# --- Roster onboarding ---


@router.post("/join-requests/{request_id}/link-roster", response_model=JoinRequestResponse)
async def link_roster_player(
    request_id: str,
    data: LinkRosterRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JoinRequestResponse:
    """Link an accepted join request to a roster player (SnapshotPlayer).

    Called after the leader creates a roster slot from the application.
    Idempotent for the same roster_player_id. Returns 409 if already
    linked to a *different* player.
    """
    from ..models import SnapshotPlayer, TierSnapshot

    result = await session.execute(
        select(JoinRequest)
        .where(JoinRequest.id == request_id)
        .options(selectinload(JoinRequest.requester))
    )
    join_request = result.scalar_one_or_none()

    if not join_request:
        raise NotFound("Join request not found")

    await require_can_manage_members(session, current_user.id, join_request.static_group_id)

    if join_request.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only link roster to an accepted request",
        )

    # Idempotent: already linked to this exact player
    if join_request.roster_player_id == data.roster_player_id:
        return _request_to_response(join_request, include_requester=True)

    # Conflict: already linked to a different player
    if join_request.roster_player_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This request is already linked to a different roster entry",
        )

    # Validate the roster player exists and belongs to this static
    player_result = await session.execute(
        select(SnapshotPlayer)
        .join(TierSnapshot)
        .where(
            SnapshotPlayer.id == data.roster_player_id,
            TierSnapshot.static_group_id == join_request.static_group_id,
        )
    )
    if not player_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Roster player not found or does not belong to this static",
        )

    join_request.roster_player_id = data.roster_player_id
    join_request.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()
    await session.commit()

    return _request_to_response(join_request, include_requester=True)
