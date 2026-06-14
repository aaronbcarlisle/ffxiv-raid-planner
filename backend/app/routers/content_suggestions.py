"""API router for static-group content suggestions and member voting."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import Notification, User
from ..models.static_content_suggestion import (
    StaticContentSuggestion,
    StaticContentSuggestionVote,
    VALID_SUGGESTION_CATEGORIES,
    VALID_SUGGESTION_STATUSES,
    VALID_VOTE_VALUES,
)
from ..models.static_objective_goal import StaticObjectiveGoal, VALID_OBJECTIVE_PRIORITIES
from ..permissions import NotFound, PermissionDenied, get_static_group, require_can_manage_members, require_membership
from .notifications import create_notification
from ..schemas.content_suggestions import (
    PromoteToGoalRequest,
    SuggestionCreate,
    SuggestionResponse,
    SuggestionUpdate,
    SuggestionVoteUpsert,
    VoteSummary,
)

router = APIRouter(prefix="/api", tags=["content-suggestions"])
logger = get_logger(__name__)

_VOTE_LABELS = {
    "must_have": "Must Have",
    "want": "Want",
    "willing": "Willing",
    "not_interested": "Not Interested",
    "avoid": "Avoid",
}


def _build_vote_summary(votes: list[StaticContentSuggestionVote]) -> VoteSummary:
    counts: dict[str, int] = {
        "must_have": 0, "want": 0, "willing": 0, "not_interested": 0, "avoid": 0
    }
    for v in votes:
        if v.vote in counts:
            counts[v.vote] += 1
    conflict = counts["not_interested"] + counts["avoid"]
    return VoteSummary(
        must_have=counts["must_have"],
        want=counts["want"],
        willing=counts["willing"],
        not_interested=counts["not_interested"],
        avoid=counts["avoid"],
        total=len(votes),
        conflict_count=conflict,
    )


def _to_response(
    suggestion: StaticContentSuggestion,
    current_user_id: str,
) -> SuggestionResponse:
    user_vote = next(
        (v.vote for v in suggestion.votes if v.user_id == current_user_id), None
    )
    display_name: str | None = None
    if suggestion.suggested_by is not None:
        display_name = getattr(suggestion.suggested_by, "display_name", None)

    return SuggestionResponse(
        id=suggestion.id,
        static_group_id=suggestion.static_group_id,
        category=suggestion.category,
        title=suggestion.title,
        description=suggestion.description,
        status=suggestion.status,
        suggested_by_user_id=suggestion.suggested_by_user_id,
        suggested_by_display_name=display_name,
        promoted_goal_id=suggestion.promoted_goal_id,
        vote_summary=_build_vote_summary(suggestion.votes),
        current_user_vote=user_vote,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )


async def _get_suggestion(
    session: AsyncSession,
    group_id: str,
    suggestion_id: str,
) -> StaticContentSuggestion:
    from sqlalchemy.orm import selectinload

    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(
            StaticContentSuggestion.id == suggestion_id,
            StaticContentSuggestion.static_group_id == group_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise NotFound("Content suggestion not found")
    return suggestion


@router.get(
    "/static-groups/{group_id}/content-suggestions",
    response_model=list[SuggestionResponse],
)
async def list_content_suggestions(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[SuggestionResponse]:
    """List content suggestions for a static group. Requires membership."""
    from sqlalchemy.orm import selectinload

    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.static_group_id == group_id)
        .order_by(StaticContentSuggestion.created_at.desc())
    )
    suggestions = result.scalars().all()
    return [_to_response(s, current_user.id) for s in suggestions]


@router.post(
    "/static-groups/{group_id}/content-suggestions",
    response_model=SuggestionResponse,
    status_code=201,
)
async def create_content_suggestion(
    group_id: str,
    body: SuggestionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    """Create a content suggestion. Any member can suggest."""
    from sqlalchemy.orm import selectinload

    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    if body.category not in VALID_SUGGESTION_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_SUGGESTION_CATEGORIES))}",
        )

    now = datetime.now(timezone.utc).isoformat()
    suggestion = StaticContentSuggestion(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        suggested_by_user_id=current_user.id,
        category=body.category,
        title=body.title,
        description=body.description,
        status="open",
        created_at=now,
        updated_at=now,
    )
    session.add(suggestion)
    await session.commit()

    # Re-fetch with relationships
    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.id == suggestion.id)
    )
    suggestion = result.scalar_one()

    logger.info("content_suggestion_created", group_id=group_id, suggestion_id=suggestion.id)
    return _to_response(suggestion, current_user.id)


@router.patch(
    "/static-groups/{group_id}/content-suggestions/{suggestion_id}",
    response_model=SuggestionResponse,
)
async def update_content_suggestion(
    group_id: str,
    suggestion_id: str,
    body: SuggestionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    """Update a suggestion. Owner can edit own open suggestions; leads/owners can edit any."""
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    suggestion = await _get_suggestion(session, group_id, suggestion_id)

    # Permission: own open suggestion OR lead/owner
    is_own = suggestion.suggested_by_user_id == current_user.id
    try:
        await require_can_manage_members(session, current_user.id, group_id)
        can_manage = True
    except (HTTPException, PermissionDenied):
        can_manage = False

    if not can_manage:
        if not is_own:
            raise PermissionDenied("You can only edit your own suggestions")
        if suggestion.status != "open":
            raise HTTPException(status_code=409, detail="Cannot edit a closed or promoted suggestion")

    now = datetime.now(timezone.utc).isoformat()
    if body.title is not None:
        suggestion.title = body.title
    if body.description is not None:
        suggestion.description = body.description
    if body.status is not None:
        if body.status not in ("open", "closed", "rejected"):
            raise HTTPException(status_code=422, detail="Status must be open, closed, or rejected")
        suggestion.status = body.status
    suggestion.updated_at = now

    await session.commit()
    await session.refresh(suggestion)

    # Re-fetch with relationships
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.id == suggestion.id)
    )
    suggestion = result.scalar_one()

    logger.info("content_suggestion_updated", suggestion_id=suggestion_id)
    return _to_response(suggestion, current_user.id)


@router.delete(
    "/static-groups/{group_id}/content-suggestions/{suggestion_id}",
    status_code=204,
)
async def delete_content_suggestion(
    group_id: str,
    suggestion_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a suggestion. Own open suggestions or lead/owner can delete."""
    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    suggestion = await _get_suggestion(session, group_id, suggestion_id)

    is_own = suggestion.suggested_by_user_id == current_user.id
    try:
        await require_can_manage_members(session, current_user.id, group_id)
        can_manage = True
    except (HTTPException, PermissionDenied):
        can_manage = False

    if not can_manage:
        if not is_own:
            raise PermissionDenied("You can only delete your own suggestions")
        if suggestion.status != "open":
            raise HTTPException(status_code=409, detail="Cannot delete a closed or promoted suggestion")

    await session.delete(suggestion)
    await session.commit()
    logger.info("content_suggestion_deleted", suggestion_id=suggestion_id)


@router.put(
    "/static-groups/{group_id}/content-suggestions/{suggestion_id}/vote",
    response_model=SuggestionResponse,
)
async def upsert_vote(
    group_id: str,
    suggestion_id: str,
    body: SuggestionVoteUpsert,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    """Cast or update a vote on a suggestion. Any member can vote."""
    from sqlalchemy.orm import selectinload

    group = await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    suggestion = await _get_suggestion(session, group_id, suggestion_id)

    if suggestion.status != "open":
        raise HTTPException(status_code=409, detail="Cannot vote on a closed or promoted suggestion")

    if body.vote not in VALID_VOTE_VALUES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid vote. Must be one of: {', '.join(sorted(VALID_VOTE_VALUES))}",
        )

    now = datetime.now(timezone.utc).isoformat()

    # Find existing vote
    existing_result = await session.execute(
        select(StaticContentSuggestionVote).where(
            StaticContentSuggestionVote.suggestion_id == suggestion_id,
            StaticContentSuggestionVote.user_id == current_user.id,
        )
    )
    existing_vote = existing_result.scalar_one_or_none()

    is_new_vote = existing_vote is None
    if existing_vote:
        existing_vote.vote = body.vote
        existing_vote.note = body.note
        existing_vote.updated_at = now
    else:
        new_vote = StaticContentSuggestionVote(
            id=str(uuid.uuid4()),
            suggestion_id=suggestion_id,
            user_id=current_user.id,
            vote=body.vote,
            note=body.note,
            created_at=now,
            updated_at=now,
        )
        session.add(new_vote)

    # Notify the suggestion author on first vote — skip self-votes and duplicates.
    # A duplicate can arise when the voter previously deleted their vote and re-votes:
    # is_new_vote becomes True again but a notification was already sent in the earlier
    # vote session.  Guard by checking for an existing notification row for this
    # (recipient, suggestion_type, suggestion title) combination.
    if is_new_vote and suggestion.suggested_by_user_id != current_user.id:
        dup_result = await session.execute(
            select(Notification).where(
                Notification.user_id == suggestion.suggested_by_user_id,
                Notification.notification_type == "suggestion_vote",
                Notification.body.contains(suggestion.title),
            ).limit(1)
        )
        already_notified = dup_result.scalar_one_or_none() is not None
        if not already_notified:
            voter_name = current_user.display_name or current_user.discord_username or "A member"
            vote_label = _VOTE_LABELS.get(body.vote, body.vote)
            await create_notification(
                session,
                user_id=suggestion.suggested_by_user_id,
                notification_type="suggestion_vote",
                title=f"{voter_name} voted on your suggestion",
                body=f'Voted "{vote_label}" on "{suggestion.title}"',
                href=f"/group/{group.share_code}?tab=goals",
            )

    await session.commit()

    # Expire so the re-fetch reloads the votes collection from DB
    session.expire(suggestion)

    # Re-fetch with fresh votes
    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one()

    logger.info("suggestion_vote_upserted", suggestion_id=suggestion_id, vote=body.vote)
    return _to_response(suggestion, current_user.id)


@router.delete(
    "/static-groups/{group_id}/content-suggestions/{suggestion_id}/vote",
    response_model=SuggestionResponse,
)
async def delete_vote(
    group_id: str,
    suggestion_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    """Remove current user's vote from a suggestion."""
    from sqlalchemy.orm import selectinload

    await get_static_group(session, group_id)
    await require_membership(session, current_user.id, group_id)

    suggestion = await _get_suggestion(session, group_id, suggestion_id)

    existing_result = await session.execute(
        select(StaticContentSuggestionVote).where(
            StaticContentSuggestionVote.suggestion_id == suggestion_id,
            StaticContentSuggestionVote.user_id == current_user.id,
        )
    )
    existing_vote = existing_result.scalar_one_or_none()
    if existing_vote:
        await session.delete(existing_vote)
        await session.commit()

    # Expire so the re-fetch reloads the votes collection from DB
    session.expire(suggestion)

    # Re-fetch with fresh votes
    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one()
    return _to_response(suggestion, current_user.id)


@router.post(
    "/static-groups/{group_id}/content-suggestions/{suggestion_id}/promote",
    response_model=SuggestionResponse,
    status_code=201,
)
async def promote_to_goal(
    group_id: str,
    suggestion_id: str,
    body: PromoteToGoalRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    """Promote a suggestion to an official StaticObjectiveGoal. Requires lead/owner."""
    from sqlalchemy.orm import selectinload

    await get_static_group(session, group_id)
    await require_can_manage_members(session, current_user.id, group_id)

    suggestion = await _get_suggestion(session, group_id, suggestion_id)

    if suggestion.status == "promoted":
        raise HTTPException(status_code=409, detail="Suggestion has already been promoted")
    if suggestion.status in ("closed", "rejected"):
        raise HTTPException(status_code=409, detail="Cannot promote a closed or rejected suggestion")

    if body.priority not in VALID_OBJECTIVE_PRIORITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid priority. Must be one of: {', '.join(sorted(VALID_OBJECTIVE_PRIORITIES))}",
        )

    now = datetime.now(timezone.utc).isoformat()
    goal_title = (body.title or suggestion.title).strip()
    goal_description = body.description if body.description is not None else suggestion.description

    new_goal = StaticObjectiveGoal(
        id=str(uuid.uuid4()),
        static_group_id=group_id,
        created_by_id=current_user.id,
        category=suggestion.category,
        title=goal_title,
        description=goal_description,
        priority=body.priority,
        created_at=now,
        updated_at=now,
    )
    session.add(new_goal)
    await session.flush()  # Assign new_goal.id before using it

    suggestion.promoted_goal_id = new_goal.id
    suggestion.status = "promoted"
    suggestion.updated_at = now

    await session.commit()

    # Re-fetch
    result = await session.execute(
        select(StaticContentSuggestion)
        .options(
            selectinload(StaticContentSuggestion.votes),
            selectinload(StaticContentSuggestion.suggested_by),
        )
        .where(StaticContentSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one()

    logger.info(
        "suggestion_promoted",
        suggestion_id=suggestion_id,
        goal_id=new_goal.id,
        category=new_goal.category,
    )
    return _to_response(suggestion, current_user.id)
