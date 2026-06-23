"""API router for plugin collection sync"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.user import User
from ..schemas.plugin_collections import CollectionSyncResult, PluginCollectionSyncPayload
from ..services.plugin_collection_sync_service import sync_collection_states

router = APIRouter(prefix="/api", tags=["plugin-collections"])
logger = get_logger(__name__)


@router.post("/plugin/collections/sync", response_model=CollectionSyncResult)
async def plugin_sync_collections(
    payload: PluginCollectionSyncPayload,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CollectionSyncResult:
    """
    Sync collection participant states from the Dalamud plugin.

    Updates RewardParticipantState for any CollectionGoal in the user's active
    static groups that matches a reported mount (by source_duty_key / trial_id)
    or token currency (by token_name).

    Manual "Pass" states are never overwritten.
    """
    logger.info(
        f"[PluginCollections] Sync from user={user.id} "
        f"mounts={len(payload.mounts)} currencies={len(payload.currencies)}"
    )
    result = await sync_collection_states(session, user, payload)
    logger.info(
        f"[PluginCollections] Done: updated={result.states_updated} "
        f"unchanged={result.states_unchanged} tokens={result.token_counts_updated} "
        f"locked={result.skipped_locked}"
    )
    return result
