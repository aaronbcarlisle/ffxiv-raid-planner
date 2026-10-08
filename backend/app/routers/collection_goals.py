"""API router for static-group collection goals (mounts, music, rare drops, etc.)"""

import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import User
from ..models.collection_goal import CollectionGoal
from ..models.membership import Membership
from ..models.reward_drop_log import RewardDropLog
from ..models.reward_participant_state import RewardParticipantState
from ..permissions import (
    NotFound,
    PermissionDenied,
    get_static_group,
    require_can_manage_members,
    require_membership,
)
from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.membership import ROLE_HIERARCHY, MemberRole
from ..models.player_collection_intent import PlayerCollectionIntent
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile
from ..schemas.collection_goals import (
    CollectionGoalCreate,
    CollectionGoalFromSuggestion,
    CollectionGoalResponse,
    CollectionGoalUpdate,
    ParticipantRecordView,
    ParticipantStateResponse,
    ParticipantStateUpsert,
    ParticipantSummary,
    RewardDropCreate,
    RewardDropResponse,
)
from ..services.collection_records import (
    RECORD_WRITE_PERSON,
    UNSET,
    MergedParticipant,
    is_after,
    load_records,
    merge_participant,
    merged_participants,
    parse_ts,
    resolve_record_targets,
    write_record,
    write_row,
)
from ..services.provenance import CHARACTER_SOURCE_DEFAULT, logged_via, request_api_key_id

router = APIRouter(prefix="/api", tags=["collection-goals"])
logger = get_logger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_LEAD_LEVEL = ROLE_HIERARCHY[MemberRole.LEAD]


# The ISO-text comparisons moved to the record service with the merge (R-S1-9);
# the router keeps its names.
_parse_ts = parse_ts
_is_after = is_after


async def _member_role(session: AsyncSession, group_id: str, user_id: str) -> str | None:
    """The user's stored role in this static; None when they are no longer a member (R-P0-4)."""
    result = await session.execute(
        select(Membership.role).where(
            Membership.static_group_id == group_id,
            Membership.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _record_view(record: PlayerCollectionSnapshot | None) -> ParticipantRecordView | None:
    if record is None:
        return None
    return ParticipantRecordView(
        character_id=record.character_id,
        ownership_state=record.ownership_state,
        token_count=record.token_count,
        source=record.source,
        updated_by_user_id=record.updated_by_user_id,
        updated_via=record.updated_via,
        state_changed_at=record.state_changed_at,
        token_count_updated_at=record.token_count_updated_at,
        last_synced_at=record.last_synced_at,
    )


def _participant_to_response(
    p: RewardParticipantState,
    *,
    display_name: str | None,
    member_role: str | None,
    merged: MergedParticipant,
) -> ParticipantStateResponse:
    """The row as the static sees it: `state`, `token_count` and `source` are merged (R-S1-9)."""
    return ParticipantStateResponse(
        id=p.id,
        goal_id=p.goal_id,
        user_id=p.user_id,
        static_group_id=p.static_group_id,
        state=merged.state,
        token_count=merged.token_count,
        priority_rank=p.priority_rank,
        source=merged.source,
        last_synced_at=p.last_synced_at,
        last_manual_override_at=p.last_manual_override_at,
        notes=p.notes,
        updated_at=p.updated_at,
        display_name=display_name,
        member_role=member_role,
        updated_by_user_id=p.updated_by_user_id,
        updated_via=p.updated_via,
        state_changed_at=p.state_changed_at,
        token_count_updated_at=p.token_count_updated_at,
        state_from_record=merged.state_from_record,
        count_from_record=merged.count_from_record,
        record=_record_view(merged.record),
    )


def _drop_to_response(
    drop: RewardDropLog, recipient_display_name: str | None
) -> RewardDropResponse:
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
        recipient_display_name=recipient_display_name,
        recipient_prior_state=drop.recipient_prior_state,
    )


async def _get_goal(
    session: AsyncSession, group_id: str, goal_id: str, *, for_update: bool = False
) -> CollectionGoal:
    stmt = select(CollectionGoal).where(
        CollectionGoal.id == goal_id,
        CollectionGoal.static_group_id == group_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFound("Collection goal not found")
    return goal


def _tally(summary: ParticipantSummary, state: str) -> None:
    if state == "need":
        summary.need += 1
    elif state == "want":
        summary.want += 1
    elif state == "have":
        summary.have += 1
    elif state == "pass":
        summary.passing += 1
    summary.total += 1


async def _participant_summaries(
    session: AsyncSession, group_id: str, goals: Sequence[CollectionGoal]
) -> dict[str, ParticipantSummary]:
    """Each goal's counts of merged states (R-S1-9): one row SELECT for all the goals."""
    summaries = {goal.id: ParticipantSummary() for goal in goals}
    if not goals:
        return summaries
    result = await session.execute(
        select(RewardParticipantState).where(RewardParticipantState.goal_id.in_(list(summaries)))
    )
    rows = list(result.scalars().all())
    merged = await merged_participants(
        session,
        static_group_id=group_id,
        rows=rows,
        catalog_item_by_goal={goal.id: goal.catalog_item_id for goal in goals},
    )
    for row in rows:
        _tally(summaries[row.goal_id], merged[row.id].state)
    return summaries


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
    summaries = await _participant_summaries(session, group_id, goals)
    return [_goal_to_response(goal, summaries[goal.id]) for goal in goals]


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
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CollectionGoalResponse:
    """Create a CollectionGoal from a suggestion and pre-seed participant states.

    Participant states are derived from (in priority order):
      the member's collection record in this static (plugin ownership) >
      PlayerCollectionIntent (static_only/dossier_public only — never private) >
      MountFarmProgress legacy data.

    Members with no signal get no row (R-S1-12, B5). Seeded rows are derived
    (R-S1-8): no writer, the request's channel.
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
    via = logged_via(request)

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

    # ── Records (each member's record in this static, by the chain, batched) ─
    record_targets = await resolve_record_targets(
        session, [(group_id, user_id) for user_id in member_user_ids]
    )
    records = await load_records(session, record_targets.values(), [catalog_item.id])
    snapshot_by_user: dict[str, PlayerCollectionSnapshot | None] = {
        user_id: records[record_targets[(group_id, user_id)]].get(catalog_item.id)
        for user_id in member_user_ids
    }

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
        snapshot = snapshot_by_user[user_id]
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
            continue  # no signal, no row: the member starts blank (R-S1-12, B5)

        # A derived row (R-S1-8): it copies the member's own signals, so it has no
        # writer, only the channel; the lead who tracked the goal is `created_by_id`.
        written = await write_row(
            session,
            row=None,
            goal_id=goal.id,
            static_group_id=group_id,
            user_id=user_id,
            actor_user_id=None,
            via=via,
            now=now,
            state=state,
            token_count=token_count,
            source=source,
        )
        # The response's summary counts what the static will see (R-S1-9).
        _tally(summary, merge_participant(written.row, snapshot).state)

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
    summary = (await _participant_summaries(session, group_id, [goal]))[goal.id]
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
    goal = await _get_goal(session, group_id, goal_id)

    result = await session.execute(
        select(RewardParticipantState, User.display_name, Membership.role)
        .join(User, RewardParticipantState.user_id == User.id)
        .outerjoin(
            Membership,
            and_(
                Membership.user_id == RewardParticipantState.user_id,
                Membership.static_group_id == RewardParticipantState.static_group_id,
            ),
        )
        .where(RewardParticipantState.goal_id == goal_id)
        .order_by(RewardParticipantState.priority_rank.nulls_last(), RewardParticipantState.updated_at)
    )
    rows = result.all()
    merged = await merged_participants(
        session,
        static_group_id=group_id,
        rows=[p for p, _, _ in rows],
        catalog_item_by_goal={goal.id: goal.catalog_item_id},
    )
    return [
        _participant_to_response(
            p, display_name=display_name, member_role=member_role, merged=merged[p.id]
        )
        for p, display_name, member_role in rows
    ]


async def _write_own_state(
    session: AsyncSession,
    *,
    group_id: str,
    goal: CollectionGoal,
    row: RewardParticipantState | None,
    user_id: str,
    body: ParticipantStateUpsert,
    can_rank: bool,
    via: str,
    now: str,
) -> RewardParticipantState:
    """A member's own cell: the row, and the record of their character in this static (R-S1-10).

    The record is the character the chain names, and only for a goal with a
    catalog item. `have` raises it; `need`/`want` over a record `have` lowers it
    to `missing` (Q6); `pass` leaves its ownership alone; a record that already
    says `have` is not written for a `have` (its source and writer stay). A
    count from anyone goes to the record, else (no profile, or no catalog item)
    to the row; `None` means unchanged. `priority_rank` is a lead's. One `now`
    stamps the row and the record. The caller commits.
    """
    target = None
    record = None
    catalog_item_id = goal.catalog_item_id
    if catalog_item_id is not None:
        resolved = (await resolve_record_targets(session, [(group_id, user_id)]))[
            (group_id, user_id)
        ]
        if resolved.profile_id is not None:
            target = resolved
            record = (await load_records(session, [target], [catalog_item_id]))[target].get(
                catalog_item_id
            )

    ownership = None
    if body.state == "have":
        if record is None or record.ownership_state != "have":
            ownership = "have"
    elif body.state in ("need", "want") and record is not None and record.ownership_state == "have":
        ownership = "missing"

    if target is not None and catalog_item_id is not None and (
        ownership is not None or body.token_count is not None
    ):
        await write_record(
            session,
            target,
            catalog_item_id,
            actor_user_id=user_id,
            via=via,
            mode=RECORD_WRITE_PERSON,
            now=now,
            ownership=ownership,
            token_count=body.token_count,
            source="manual",
            confidence="medium",
        )

    write = await write_row(
        session,
        row=row,
        goal_id=goal.id,
        static_group_id=group_id,
        user_id=user_id,
        actor_user_id=user_id,
        via=via,
        now=now,
        state=body.state,
        token_count=body.token_count if target is None and body.token_count is not None else UNSET,
        priority_rank=body.priority_rank if can_rank and body.priority_rank is not None else UNSET,
        notes=body.notes if body.notes is not None else UNSET,
        source="manual",
        last_manual_override_at=now,
    )
    return write.row


@router.patch(
    "/static-groups/{group_id}/collection-goals/{goal_id}/participants",
    response_model=ParticipantStateResponse,
)
async def upsert_participant_state(
    group_id: str,
    goal_id: str,
    body: ParticipantStateUpsert,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParticipantStateResponse:
    """Members and above update their own state; viewers are refused (R-P0-3).

    Anyone's `token_count` is stored (S2a-1 delta (h)), on their character's
    record where there is one; `priority_rank` stays a lead's, and a member's
    is ignored, not refused.
    """
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)
    goal = await _get_goal(session, group_id, goal_id)
    catalog_item_id = goal.catalog_item_id

    if membership.role == MemberRole.VIEWER:
        raise PermissionDenied("Viewers cannot track farms")
    can_rank = membership.role_level >= _LEAD_LEVEL

    now = _now()
    result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal_id,
            RewardParticipantState.user_id == current_user.id,
        )
    )
    participant = await _write_own_state(
        session,
        group_id=group_id,
        goal=goal,
        row=result.scalar_one_or_none(),
        user_id=current_user.id,
        body=body,
        can_rank=can_rank,
        via=logged_via(request),
        now=now,
    )

    await session.commit()
    await session.refresh(participant)

    user_result = await session.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()
    member_role = await _member_role(session, group_id, current_user.id)
    merged = await merged_participants(
        session,
        static_group_id=group_id,
        rows=[participant],
        catalog_item_by_goal={goal_id: catalog_item_id},
    )

    return _participant_to_response(
        participant,
        display_name=user.display_name if user else None,
        member_role=member_role,
        merged=merged[participant.id],
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
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParticipantStateResponse:
    """Lead/owner can set participant state for any member.

    For another member this is a correction: the row only, with the lead as
    its writer, and the member's record is untouched. Aimed at themselves, the
    lead follows the self rules and writes their own record (R-S1-10).
    """
    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)
    goal = await _get_goal(session, group_id, goal_id)
    catalog_item_id = goal.catalog_item_id

    # Confirm target user is a member, and not a viewer (R-P0-3: a viewer can't be
    # made a drop recipient through the back door).
    membership_result = await session.execute(
        select(Membership).where(
            Membership.static_group_id == group_id,
            Membership.user_id == target_user_id,
        )
    )
    target_membership = membership_result.scalar_one_or_none()
    if target_membership is None:
        raise NotFound("User is not a member of this static")
    if target_membership.role == MemberRole.VIEWER:
        raise HTTPException(status_code=400, detail="Viewers can't be tracked")

    now = _now()
    via = logged_via(request)
    result = await session.execute(
        select(RewardParticipantState).where(
            RewardParticipantState.goal_id == goal_id,
            RewardParticipantState.user_id == target_user_id,
        )
    )
    row = result.scalar_one_or_none()

    if target_user_id == current_user.id:
        participant = await _write_own_state(
            session,
            group_id=group_id,
            goal=goal,
            row=row,
            user_id=target_user_id,
            body=body,
            can_rank=True,
            via=via,
            now=now,
        )
    else:
        write = await write_row(
            session,
            row=row,
            goal_id=goal_id,
            static_group_id=group_id,
            user_id=target_user_id,
            actor_user_id=current_user.id,
            via=via,
            now=now,
            state=body.state,
            token_count=body.token_count if body.token_count is not None else UNSET,
            priority_rank=body.priority_rank if body.priority_rank is not None else UNSET,
            notes=body.notes if body.notes is not None else UNSET,
            source="manual",
            last_manual_override_at=now,
        )
        participant = write.row

    await session.commit()
    await session.refresh(participant)

    user_result = await session.execute(select(User).where(User.id == target_user_id))
    user = user_result.scalar_one_or_none()
    merged = await merged_participants(
        session,
        static_group_id=group_id,
        rows=[participant],
        catalog_item_by_goal={goal_id: catalog_item_id},
    )

    return _participant_to_response(
        participant,
        display_name=user.display_name if user else None,
        member_role=target_membership.role,
        merged=merged[participant.id],
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
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RewardDropResponse:
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)
    goal = await _get_goal(session, group_id, goal_id, for_update=True)

    # R-P0-1: checked in this order, before any write. The recipient's membership is
    # checked last so a member can't probe who belongs to the static.
    recipient_id = body.recipient_user_id
    if membership.role == MemberRole.VIEWER:
        raise PermissionDenied("Viewers cannot log drops")
    if recipient_id and recipient_id != current_user.id and membership.role_level < _LEAD_LEVEL:
        raise PermissionDenied("Only leads and owners can log a drop for another member")
    if recipient_id:
        recipient_role = await _member_role(session, group_id, recipient_id)
        if recipient_role is None or recipient_role == MemberRole.VIEWER.value:
            raise HTTPException(status_code=400, detail="Recipient must be a member of this static")

    now = _now()
    via = logged_via(request)

    # If the recipient is identified, auto-advance their state to "have" if currently
    # need/want, and remember the state it replaced, and when, so a delete can restore
    # it (R-P0-2).
    recipient_prior_state: str | None = None
    recipient_prior_state_at: str | None = None
    # The recipient's character in this static, and what the record was before an
    # own drop raised it (R-S1-13), for Undo to read.
    character_id: str | None = None
    character_name: str | None = None
    character_source: str | None = None
    record_prior_state: str | None = None
    record_prior_at: str | None = None
    record_prior_changed_at: str | None = None
    if recipient_id:
        target = (await resolve_record_targets(session, [(group_id, recipient_id)]))[
            (group_id, recipient_id)
        ]
        if target.character_id is not None:
            character_id = target.character_id
            character_name = target.character_name
            character_source = CHARACTER_SOURCE_DEFAULT

        catalog_item_id = goal.catalog_item_id
        if recipient_id == current_user.id and target.profile_id is not None and catalog_item_id:
            record = (await load_records(session, [target], [catalog_item_id]))[target].get(
                catalog_item_id
            )
            if record is None or record.ownership_state != "have":
                record_prior_state = "unknown" if record is None else record.ownership_state
                record_prior_changed_at = None if record is None else record.state_changed_at
                record_prior_at = now
                await write_record(
                    session,
                    target,
                    catalog_item_id,
                    actor_user_id=current_user.id,
                    via=via,
                    mode=RECORD_WRITE_PERSON,
                    now=now,
                    ownership="have",
                    source="manual",
                    confidence="medium",
                )

        p_result = await session.execute(
            select(RewardParticipantState).where(
                RewardParticipantState.goal_id == goal_id,
                RewardParticipantState.user_id == recipient_id,
            )
        )
        participant = p_result.scalar_one_or_none()
        if participant and participant.state in ("need", "want"):
            recipient_prior_state = participant.state
            recipient_prior_state_at = now
            await write_row(
                session,
                row=participant,
                goal_id=goal_id,
                static_group_id=group_id,
                user_id=recipient_id,
                actor_user_id=current_user.id,
                via=via,
                now=now,
                state="have",
            )

    drop = RewardDropLog(
        id=str(uuid.uuid4()),
        goal_id=goal_id,
        static_group_id=group_id,
        recipient_user_id=recipient_id,
        created_by_id=current_user.id,
        quantity=body.quantity,
        dropped_at=body.dropped_at or now,
        notes=body.notes,
        recipient_prior_state=recipient_prior_state,
        recipient_prior_state_at=recipient_prior_state_at,
        recipient_character_id=character_id,
        recipient_character_name=character_name,
        recipient_character_source=character_source,
        recipient_record_prior_state=record_prior_state,
        recipient_record_prior_at=record_prior_at,
        recipient_record_prior_changed_at=record_prior_changed_at,
        logged_via=via,
        api_key_id=request_api_key_id(request),
        created_at=now,
    )
    session.add(drop)

    await session.commit()
    await session.refresh(drop)

    recipient_name: str | None = None
    if recipient_id:
        u_result = await session.execute(select(User).where(User.id == recipient_id))
        u = u_result.scalar_one_or_none()
        recipient_name = u.display_name if u else None

    logger.info("reward_drop_logged", group_id=group_id, goal_id=goal_id, recipient=recipient_id)
    return _drop_to_response(drop, recipient_name)


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
    return [_drop_to_response(drop, display_name) for drop, display_name in rows]


@router.delete(
    "/static-groups/{group_id}/collection-goals/{goal_id}/drops/{drop_id}",
    status_code=204,
)
async def delete_drop(
    group_id: str,
    goal_id: str,
    drop_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Leads, owners, or the member who logged it delete a drop (R-P0-2).

    Restoring the recipient's state doesn't depend on delete order: the prior
    state, with the timestamp of the flip that recorded it, hands off to the
    earliest remaining drop unless that drop already holds a later flip's prior
    (then this one is discarded), so the latest flip's prior always survives.
    Only the last drop to go restores it, unless the plugin or a manual edit set
    the state after that flip.

    The goal row is locked before the drop is read, so concurrent deletes (and a
    log) on one goal serialize: the second sees the first's hand-off committed.
    """
    await get_static_group(session, group_id)
    membership = await require_membership(session, current_user.id, group_id)
    if membership.role == MemberRole.VIEWER:
        raise PermissionDenied("Viewers cannot delete drops")

    await _get_goal(session, group_id, goal_id, for_update=True)
    result = await session.execute(
        select(RewardDropLog).where(
            RewardDropLog.id == drop_id,
            RewardDropLog.goal_id == goal_id,
            RewardDropLog.static_group_id == group_id,
        )
    )
    drop = result.scalar_one_or_none()
    if drop is None:
        raise NotFound("Drop not found")
    if membership.role_level < _LEAD_LEVEL and drop.created_by_id != current_user.id:
        raise PermissionDenied("Only leads, owners or the member who logged it can delete a drop")

    recipient_id = drop.recipient_user_id
    prior_state = drop.recipient_prior_state
    # The flip's own timestamp, carried through hand-offs; a row logged before the
    # column existed falls back to its created_at.
    prior_at = drop.recipient_prior_state_at or drop.created_at
    await session.delete(drop)
    await session.flush()

    outcome = "no_change"
    if recipient_id is not None:
        remaining_result = await session.execute(
            select(RewardDropLog)
            .where(
                RewardDropLog.goal_id == goal_id,
                RewardDropLog.recipient_user_id == recipient_id,
            )
            .order_by(RewardDropLog.created_at, RewardDropLog.id)
        )
        remaining = list(remaining_result.scalars().all())
        if remaining:
            # 1. Other drops remain: the recipient still received one, so they stay
            #    "have". The prior (with its flip time) moves to the earliest
            #    remaining drop when that drop has none or an earlier one; when it
            #    already holds a later flip's prior, that one wins and this one is
            #    discarded. The latest flip's prior survives in any delete order.
            if prior_state is not None:
                earliest = remaining[0]
                earliest_at = earliest.recipient_prior_state_at or earliest.created_at
                if earliest.recipient_prior_state is None or _is_after(prior_at, earliest_at):
                    earliest.recipient_prior_state = prior_state
                    earliest.recipient_prior_state_at = prior_at
                    outcome = "handed_off"
                else:
                    outcome = "discarded"
        elif prior_state is not None:
            # 2. This was their last drop: restore the state the flip replaced, unless
            #    the plugin or a manual edit set the state after that flip.
            p_result = await session.execute(
                select(RewardParticipantState).where(
                    RewardParticipantState.goal_id == goal_id,
                    RewardParticipantState.user_id == recipient_id,
                )
            )
            participant = p_result.scalar_one_or_none()
            if participant and participant.state == "have":
                if _is_after(participant.last_synced_at, prior_at) or _is_after(
                    participant.last_manual_override_at, prior_at
                ):
                    outcome = "skipped"
                else:
                    await write_row(
                        session,
                        row=participant,
                        goal_id=goal_id,
                        static_group_id=group_id,
                        user_id=recipient_id,
                        actor_user_id=current_user.id,
                        via=logged_via(request),
                        now=_now(),
                        state=prior_state,
                    )
                    outcome = "restored"

    await session.commit()
    logger.info(
        "reward_drop_deleted",
        group_id=group_id,
        goal_id=goal_id,
        drop_id=drop_id,
        recipient=recipient_id,
        prior_state=prior_state,
        outcome=outcome,
    )
