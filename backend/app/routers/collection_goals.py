"""API router for static-group collection goals (mounts, music, rare drops, etc.)"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.collection_goal import CollectionGoal
from ..models.membership import Membership
from ..models.reward_drop_log import RewardDropLog
from ..models.reward_participant_state import RewardParticipantState
from ..permissions import NotFound, get_static_group, require_can_manage_members, require_membership
from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.membership import MemberRole
from ..models.player_collection_intent import PlayerCollectionIntent
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile
from ..schemas.collection_goals import (
    CollectionGoalCreate,
    CollectionGoalFromSuggestion,
    CollectionGoalResponse,
    CollectionGoalUpdate,
    ParticipantStateResponse,
    ParticipantStateUpsert,
    ParticipantSummary,
    RewardDropCreate,
    RewardDropResponse,
)

router = APIRouter(prefix="/api", tags=["collection-goals"])
logger = get_logger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_goal(session: AsyncSession, group_id: str, goal_id: str) -> CollectionGoal:
    result = await session.execute(
        select(CollectionGoal).where(
            CollectionGoal.id == goal_id,
            CollectionGoal.static_group_id == group_id,
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Collection goal not found")
    return goal


async def _participant_summary(session: AsyncSession, goal_id: str) -> ParticipantSummary:
    result = await session.execute(
        select(RewardParticipantState).where(RewardParticipantState.goal_id == goal_id)
    )
    rows = list(result.scalars().all())
    return ParticipantSummary(
        need=sum(1 for r in rows if r.state == "need"),
        want=sum(1 for r in rows if r.state == "want"),
        have=sum(1 for r in rows if r.state == "have"),
        passing=sum(1 for r in rows if r.state == "pass"),
        total=len(rows),
    )


def _goal_to_response(goal: CollectionGoal, summary: ParticipantSummary | None = None) -> CollectionGoalResponse:
    return CollectionGoalResponse(
        id=goal.id,
        static_group_id=goal.static_group_id,
        created_by_id=goal.created_by_id,
        goal_type=goal.goal_type,
        content_type=goal.content_type,
        content_key=goal.content_key,
        title=goal.title,
        status=goal.status,
        priority_mode=goal.priority_mode,
        summary=goal.summary,
        linked_duty_id=goal.linked_duty_id,
        linked_reward_id=goal.linked_reward_id,
        target_count=goal.target_count,
        current_count=goal.current_count,
        note=goal.note,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        completed_at=goal.completed_at,
        catalog_item_id=goal.catalog_item_id,
        token_name=goal.token_name,
        token_cost=goal.token_cost,
        participant_summary=summary,
    )


# ── Collection Goals CRUD ─────────────────────────────────────────────────────

@router.get(
    "/static-groups/{group_id}/collection-goals",
    response_model=list[CollectionGoalResponse],
)
async def list_collection_goals(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[CollectionGoalResponse]:
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    result = await session.execute(
        select(CollectionGoal)
        .where(CollectionGoal.static_group_id == group_id)
        .order_by(CollectionGoal.created_at)
    )
    goals = list(result.scalars().all())

    responses = []
    for goal in goals:
        summary = await _participant_summary(session, goal.id)
        responses.append(_goal_to_response(goal, summary))
    return responses


@router.post(
    "/static-groups/{group_id}/collection-goals",
    response_model=CollectionGoalResponse,
    status_code=201,
)
async def create_collection_goal(
    group_id: str,
    body: CollectionGoalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoalResponse:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    now = _now()
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        goal_type=body.goal_type,
        content_type=body.content_type,
        content_key=body.content_key,
        title=body.title,
        status=body.status,
        priority_mode=body.priority_mode,
        summary=body.summary,
        linked_duty_id=body.linked_duty_id,
        linked_reward_id=body.linked_reward_id,
        target_count=body.target_count,
        current_count=body.current_count,
        note=body.note,
        catalog_item_id=body.catalog_item_id,
        token_name=body.token_name,
        token_cost=body.token_cost,
        created_at=now,
        updated_at=now,
        completed_at=None,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    logger.info("collection_goal_created", group_id=group_id, goal_id=goal.id, goal_type=goal.goal_type)
    return _goal_to_response(goal, ParticipantSummary())


# ── Goal category → goal type mapping ────────────────────────────────────────
_CATALOG_CATEGORY_TO_GOAL_TYPE: dict[str, str] = {
    "mount": "mount",
    "orchestrion": "orchestrion",
    "minion": "minion",
    "weapon": "weapon",
    "glam": "glam",
}
_VALID_CONTENT_TYPES = {
    "extreme", "savage", "ultimate", "criterion",
    "chaotic_alliance", "field_operation", "custom",
}


@router.post(
    "/static-groups/{group_id}/collection-goals/from-suggestion",
    response_model=CollectionGoalResponse,
    status_code=201,
)
async def create_goal_from_suggestion(
    group_id: str,
    body: CollectionGoalFromSuggestion,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoalResponse:
    """Create a CollectionGoal from a suggestion and pre-seed participant states.

    Participant states are derived from (in priority order):
      PlayerCollectionSnapshot (plugin ownership) > PlayerCollectionIntent
      (static_only/dossier_public only — never private) > MountFarmProgress legacy data.

    Members with no signal default to state="want".
    Existing RewardParticipantState rows are not overwritten.
    """
    from ..models.mount_farm_progress import MountFarmProgress
    from ..services.legacy_mount_farm_bridge import get_legacy_farm_signals

    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    # ── Load catalog item ───────────────────────────────────────────────────
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(CollectionCatalogItem.id == body.catalog_item_id)
    )
    catalog_item = catalog_result.scalar_one_or_none()
    if not catalog_item:
        raise NotFound(f"Catalog item {body.catalog_item_id} not found")

    now = _now()

    # ── Create goal ─────────────────────────────────────────────────────────
    goal_type = _CATALOG_CATEGORY_TO_GOAL_TYPE.get(catalog_item.category or "", "custom_reward")
    content_type = (
        catalog_item.source_type
        if catalog_item.source_type in _VALID_CONTENT_TYPES
        else None
    )
    goal = CollectionGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        goal_type=goal_type,
        content_type=content_type,
        title=catalog_item.name,
        status=body.status,
        catalog_item_id=catalog_item.id,
        token_name=catalog_item.token_name,
        token_cost=catalog_item.token_cost,
        created_at=now,
        updated_at=now,
    )
    session.add(goal)
    await session.flush()  # get goal.id without committing

    # ── Collect member user IDs (non-viewers) ───────────────────────────────
    members_result = await session.execute(
        select(Membership.user_id).where(
            Membership.static_group_id == group_id,
            Membership.role != MemberRole.VIEWER,
        )
    )
    member_user_ids = [r[0] for r in members_result.all()]

    # ── Load profile IDs for members ────────────────────────────────────────
    profiles_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id.in_(member_user_ids))
    )
    profile_by_user: dict[str, str] = {p.user_id: p.id for p in profiles_result.scalars().all()}
    profile_ids = list(profile_by_user.values())

    # ── Snapshots ───────────────────────────────────────────────────────────
    snapshot_map: dict[str, PlayerCollectionSnapshot] = {}
    if profile_ids:
        snap_result = await session.execute(
            select(PlayerCollectionSnapshot).where(
                PlayerCollectionSnapshot.profile_id.in_(profile_ids),
                PlayerCollectionSnapshot.catalog_item_id == catalog_item.id,
            )
        )
        for s in snap_result.scalars().all():
            snapshot_map[s.profile_id] = s

    # ── Intents (static_only + dossier_public only — never private) ─────────
    intent_map: dict[str, PlayerCollectionIntent] = {}
    if profile_ids:
        intent_result = await session.execute(
            select(PlayerCollectionIntent).where(
                PlayerCollectionIntent.profile_id.in_(profile_ids),
                PlayerCollectionIntent.catalog_item_id == catalog_item.id,
                PlayerCollectionIntent.visibility.in_(["static_only", "dossier_public"]),
            )
        )
        for i in intent_result.scalars().all():
            intent_map[i.profile_id] = i

    # ── Legacy MountFarmProgress signals ────────────────────────────────────
    legacy_map, _ = await get_legacy_farm_signals(session, group_id, member_user_ids)
    # Filter to just this catalog item
    legacy_for_item = {
        user_id: sig
        for (user_id, cid), sig in legacy_map.items()
        if cid == catalog_item.id
    }

    # ── Pre-seed participant states ──────────────────────────────────────────
    summary = ParticipantSummary()
    for user_id in member_user_ids:
        profile_id = profile_by_user.get(user_id)
        snapshot = snapshot_map.get(profile_id) if profile_id else None
        intent = intent_map.get(profile_id) if profile_id else None
        legacy = legacy_for_item.get(user_id)

        # Priority: snapshot > intent > legacy > default
        if snapshot is not None and snapshot.ownership_state == "have":
            state = "have"
            token_count = snapshot.token_count
            source = "plugin"
        elif intent is not None and intent.intent == "pass":
            state = "pass"
            token_count = None
            source = "player_hub"
        elif intent is not None and intent.intent in ("hunting", "interested"):
            state = "want"
            token_count = snapshot.token_count if snapshot else None
            source = "player_hub"
        elif legacy is not None and legacy.has_mount:
            state = "have"
            token_count = None
            source = "manual"
        elif legacy is not None and legacy.wants_mount:
            state = "want"
            token_count = legacy.totem_count if legacy.totem_count > 0 else None
            source = "manual"
        elif snapshot is not None and snapshot.ownership_state == "missing":
            state = "want"
            token_count = snapshot.token_count
            source = "plugin"
        else:
            state = "want"  # optimistic default — all members start as wanting
            token_count = None
            source = "manual"

        participant = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal.id,
            user_id=user_id,
            static_group_id=group_id,
            state=state,
            token_count=token_count,
            source=source,
            updated_at=now,
        )
        session.add(participant)

        # Tally summary
        if state == "have":
            summary.have += 1
        elif state == "pass":
            summary.passing += 1
        else:
            summary.want += 1
        summary.total += 1

    await session.commit()
    await session.refresh(goal)
    logger.info(
        "collection_goal_created_from_suggestion",
        group_id=group_id,
        goal_id=goal.id,
        catalog_item_id=catalog_item.id,
    )
    return _goal_to_response(goal, summary)


@router.put(
    "/static-groups/{group_id}/collection-goals/{goal_id}",
    response_model=CollectionGoalResponse,
)
async def update_collection_goal(
    group_id: str,
    goal_id: str,
    body: CollectionGoalUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoalResponse:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    goal = await _get_goal(session, group_id, goal_id)

    now = _now()
    data = body.model_dump(exclude_unset=True)

    if data.get("status") == "complete" and goal.status != "complete":
        data.setdefault("completed_at", now)
    elif data.get("status") and data["status"] != "complete":
        data["completed_at"] = None

    for key, value in data.items():
        setattr(goal, key, value)
    goal.updated_at = now

    await session.commit()
    await session.refresh(goal)
    summary = await _participant_summary(session, goal.id)
    return _goal_to_response(goal, summary)


@router.delete(
    "/static-groups/{group_id}/collection-goals/{goal_id}",
    status_code=204,
)
async def delete_collection_goal(
    group_id: str,
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    goal = await _get_goal(session, group_id, goal_id)
    await session.delete(goal)
    await session.commit()
    logger.info("collection_goal_deleted", group_id=group_id, goal_id=goal_id)


# ── Participant States ────────────────────────────────────────────────────────

@router.get(
    "/static-groups/{group_id}/collection-goals/{goal_id}/participants",
    response_model=list[ParticipantStateResponse],
)
async def list_participants(
    group_id: str,
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ParticipantStateResponse]:
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    await _get_goal(session, group_id, goal_id)

    result = await session.execute(
        select(RewardParticipantState, User.display_name)
        .join(User, RewardParticipantState.user_id == User.id)
        .where(RewardParticipantState.goal_id == goal_id)
        .order_by(RewardParticipantState.priority_rank.nulls_last(), RewardParticipantState.updated_at)
    )
    rows = result.all()
    return [
        ParticipantStateResponse(
            id=p.id,
            goal_id=p.goal_id,
            user_id=p.user_id,
            static_group_id=p.static_group_id,
            state=p.state,
            token_count=p.token_count,
            priority_rank=p.priority_rank,
            source=p.source,
            last_synced_at=p.last_synced_at,
            notes=p.notes,
            updated_at=p.updated_at,
            display_name=display_name,
        )
        for p, display_name in rows
    ]


@router.patch(
    "/static-groups/{group_id}/collection-goals/{goal_id}/participants",
    response_model=ParticipantStateResponse,
)
async def upsert_participant_state(
    group_id: str,
    goal_id: str,
    body: ParticipantStateUpsert,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParticipantStateResponse:
    """Any member can update their own state. Leads/owners can pass ?user_id= for others."""
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    await _get_goal(session, group_id, goal_id)

    now = _now()
    result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal_id,
            RewardParticipantState.user_id == current_user.id,
        )
    )
    participant = result.scalar_one_or_none()

    if participant is None:
        participant = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal_id,
            user_id=current_user.id,
            static_group_id=group_id,
            state=body.state,
            token_count=body.token_count,
            priority_rank=body.priority_rank,
            source="manual",
            notes=body.notes,
            last_manual_override_at=now,
            updated_at=now,
        )
        session.add(participant)
    else:
        participant.state = body.state
        if body.token_count is not None:
            participant.token_count = body.token_count
        if body.priority_rank is not None:
            participant.priority_rank = body.priority_rank
        if body.notes is not None:
            participant.notes = body.notes
        participant.source = "manual"
        participant.last_manual_override_at = now
        participant.updated_at = now

    await session.commit()
    await session.refresh(participant)

    user_result = await session.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()

    return ParticipantStateResponse(
        id=participant.id,
        goal_id=participant.goal_id,
        user_id=participant.user_id,
        static_group_id=participant.static_group_id,
        state=participant.state,
        token_count=participant.token_count,
        priority_rank=participant.priority_rank,
        source=participant.source,
        last_synced_at=participant.last_synced_at,
        last_manual_override_at=participant.last_manual_override_at,
        notes=participant.notes,
        updated_at=participant.updated_at,
        display_name=user.display_name if user else None,
    )


@router.patch(
    "/static-groups/{group_id}/collection-goals/{goal_id}/participants/{target_user_id}",
    response_model=ParticipantStateResponse,
)
async def upsert_participant_state_for_user(
    group_id: str,
    goal_id: str,
    target_user_id: str,
    body: ParticipantStateUpsert,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParticipantStateResponse:
    """Lead/owner can set participant state for any member."""
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    await _get_goal(session, group_id, goal_id)

    # Confirm target user is a member
    membership_result = await session.execute(
        select(Membership).where(
            Membership.static_group_id == group_id,
            Membership.user_id == target_user_id,
        )
    )
    if not membership_result.scalar_one_or_none():
        raise NotFound("User is not a member of this static")

    now = _now()
    result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal_id,
            RewardParticipantState.user_id == target_user_id,
        )
    )
    participant = result.scalar_one_or_none()

    if participant is None:
        participant = RewardParticipantState(
            id=str(uuid.uuid4()),
            goal_id=goal_id,
            user_id=target_user_id,
            static_group_id=group_id,
            state=body.state,
            token_count=body.token_count,
            priority_rank=body.priority_rank,
            source="manual",
            notes=body.notes,
            last_manual_override_at=now,
            updated_at=now,
        )
        session.add(participant)
    else:
        participant.state = body.state
        if body.token_count is not None:
            participant.token_count = body.token_count
        if body.priority_rank is not None:
            participant.priority_rank = body.priority_rank
        if body.notes is not None:
            participant.notes = body.notes
        participant.source = "manual"
        participant.last_manual_override_at = now
        participant.updated_at = now

    await session.commit()
    await session.refresh(participant)

    user_result = await session.execute(select(User).where(User.id == target_user_id))
    user = user_result.scalar_one_or_none()

    return ParticipantStateResponse(
        id=participant.id,
        goal_id=participant.goal_id,
        user_id=participant.user_id,
        static_group_id=participant.static_group_id,
        state=participant.state,
        token_count=participant.token_count,
        priority_rank=participant.priority_rank,
        source=participant.source,
        last_synced_at=participant.last_synced_at,
        last_manual_override_at=participant.last_manual_override_at,
        notes=participant.notes,
        updated_at=participant.updated_at,
        display_name=user.display_name if user else None,
    )


# ── Drop Log ──────────────────────────────────────────────────────────────────

@router.post(
    "/static-groups/{group_id}/collection-goals/{goal_id}/drops",
    response_model=RewardDropResponse,
    status_code=201,
)
async def log_drop(
    group_id: str,
    goal_id: str,
    body: RewardDropCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RewardDropResponse:
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    await _get_goal(session, group_id, goal_id)

    now = _now()
    drop = RewardDropLog(
        id=str(uuid.uuid4()),
        goal_id=goal_id,
        static_group_id=group_id,
        recipient_user_id=body.recipient_user_id,
        created_by_id=current_user.id,
        quantity=body.quantity,
        dropped_at=body.dropped_at or now,
        notes=body.notes,
        created_at=now,
    )
    session.add(drop)

    # If recipient is identified, auto-advance their state to "have" if currently need/want
    if body.recipient_user_id:
        p_result = await session.execute(
            select(RewardParticipantState).where(
                RewardParticipantState.goal_id == goal_id,
                RewardParticipantState.user_id == body.recipient_user_id,
            )
        )
        participant = p_result.scalar_one_or_none()
        if participant and participant.state in ("need", "want"):
            participant.state = "have"
            participant.updated_at = now

    await session.commit()
    await session.refresh(drop)

    recipient_name: str | None = None
    if body.recipient_user_id:
        u_result = await session.execute(select(User).where(User.id == body.recipient_user_id))
        u = u_result.scalar_one_or_none()
        recipient_name = u.display_name if u else None

    logger.info("reward_drop_logged", group_id=group_id, goal_id=goal_id, recipient=body.recipient_user_id)
    return RewardDropResponse(
        id=drop.id,
        goal_id=drop.goal_id,
        static_group_id=drop.static_group_id,
        recipient_user_id=drop.recipient_user_id,
        created_by_id=drop.created_by_id,
        quantity=drop.quantity,
        dropped_at=drop.dropped_at,
        notes=drop.notes,
        created_at=drop.created_at,
        recipient_display_name=recipient_name,
    )


@router.get(
    "/static-groups/{group_id}/collection-goals/{goal_id}/drops",
    response_model=list[RewardDropResponse],
)
async def list_drops(
    group_id: str,
    goal_id: str,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[RewardDropResponse]:
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)
    await _get_goal(session, group_id, goal_id)

    result = await session.execute(
        select(RewardDropLog, User.display_name)
        .outerjoin(User, RewardDropLog.recipient_user_id == User.id)
        .where(RewardDropLog.goal_id == goal_id)
        .order_by(RewardDropLog.dropped_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        RewardDropResponse(
            id=drop.id,
            goal_id=drop.goal_id,
            static_group_id=drop.static_group_id,
            recipient_user_id=drop.recipient_user_id,
            created_by_id=drop.created_by_id,
            quantity=drop.quantity,
            dropped_at=drop.dropped_at,
            notes=drop.notes,
            created_at=drop.created_at,
            recipient_display_name=display_name,
        )
        for drop, display_name in rows
    ]
