"""API router for static group join requests (discovery applications)"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..dependencies import get_current_user
from ..models import JoinRequest, Membership, MemberRole, StaticGroup, User
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
    RequesterInfo,
)

router = APIRouter(prefix="/api", tags=["join-requests"])


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


def _request_to_response(
    req: JoinRequest,
    *,
    include_requester: bool = False,
    group_name: str | None = None,
) -> JoinRequestResponse:
    requester_info = None
    if include_requester and req.requester:
        requester_info = RequesterInfo(
            id=req.requester.id,
            discord_username=req.requester.discord_username,
            discord_avatar=req.requester.discord_avatar,
            avatar_url=req.requester.avatar_url,
            display_name=req.requester.display_name,
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

    now = datetime.now(timezone.utc).isoformat()
    join_request = JoinRequest(
        id=str(uuid.uuid4()),
        static_group_id=group.id,
        requester_user_id=current_user.id,
        status="pending",
        message=data.message,
        role_interest=data.role_interest,
        job_interest=data.job_interest,
        availability_note=data.availability_note,
        created_at=now,
        updated_at=now,
    )
    session.add(join_request)
    await session.flush()
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
        query = query.where(JoinRequest.status == "pending")

    query = query.order_by(JoinRequest.created_at.desc())
    result = await session.execute(query)
    requests = result.scalars().all()

    pending_count_result = await session.execute(
        select(func.count()).select_from(JoinRequest).where(
            JoinRequest.static_group_id == group_id,
            JoinRequest.status == "pending",
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

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept a request that is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "accepted"
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

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot decline a request that is already {join_request.status}",
        )

    now = datetime.now(timezone.utc).isoformat()
    join_request.status = "declined"
    join_request.resolved_at = now
    join_request.resolved_by_user_id = current_user.id
    join_request.updated_at = now

    await session.flush()
    await session.commit()

    return _request_to_response(join_request, include_requester=True)
