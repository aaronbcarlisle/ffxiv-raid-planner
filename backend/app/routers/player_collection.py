"""
Player collection intent + snapshot + static suggestions + dossier matching.

Endpoints:
  GET    /api/me/collection-intent            — my full intent list
  PUT    /api/me/collection-intent/{item_id}  — upsert one intent
  DELETE /api/me/collection-intent/{item_id}  — remove one intent
  GET    /api/me/collection-snapshots         — my factual ownership snapshots

  GET    /api/static-groups/{group_id}/collection-suggestions
  GET    /api/profiles/{share_code}/collection-intent   (public dossier list)
  GET    /api/static-groups/{group_id}/collection-match/{share_code}
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models.collection_catalog_item import CollectionCatalogItem
from ..models.membership import Membership, MemberRole
from ..models.player_collection_intent import (
    INTENT_PRIORITIES,
    INTENT_VALUES,
    INTENT_VISIBILITIES,
    PlayerCollectionIntent,
)
from ..models.player_collection_snapshot import PlayerCollectionSnapshot
from ..models.player_profile import PlayerProfile
from ..models.user import User
from ..permissions import require_membership
from ..schemas.player_collection import (
    CatalogPlayerEntry,
    CollectionIntentResponse,
    CollectionIntentUpsert,
    CollectionSnapshotResponse,
    CollectionSnapshotUpsert,
    DossierHuntingEntry,
    StaticCollectionSuggestion,
)
from ..services.collection_suggestion_service import (
    compute_suggestions,
    dossier_farm_match,
)

router = APIRouter(prefix="/api", tags=["player-collection"])
logger = get_logger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Personal intent ────────────────────────────────────────────────────────────

@router.get("/me/collection-intent", response_model=list[CollectionIntentResponse])
async def list_my_intents(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[CollectionIntentResponse]:
    profile = await _get_profile_or_none(session, user)
    if profile is None:
        return []
    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id
        )
    )
    return [CollectionIntentResponse.model_validate(r) for r in result.scalars().all()]


@router.put("/me/collection-intent/{catalog_item_id}", response_model=CollectionIntentResponse)
async def upsert_intent(
    catalog_item_id: str,
    body: CollectionIntentUpsert,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CollectionIntentResponse:
    if body.intent not in INTENT_VALUES:
        raise HTTPException(400, f"intent must be one of {sorted(INTENT_VALUES)}")
    if body.priority not in INTENT_PRIORITIES:
        raise HTTPException(400, f"priority must be one of {sorted(INTENT_PRIORITIES)}")
    if body.visibility not in INTENT_VISIBILITIES:
        raise HTTPException(400, f"visibility must be one of {sorted(INTENT_VISIBILITIES)}")

    # Verify catalog item exists
    cat_result = await session.execute(
        select(CollectionCatalogItem).where(CollectionCatalogItem.id == catalog_item_id)
    )
    if cat_result.scalar_one_or_none() is None:
        raise HTTPException(404, "Catalog item not found")

    profile = await _require_profile(session, user)
    now = _now()

    existing_result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog_item_id,
        )
    )
    intent = existing_result.scalar_one_or_none()

    if intent is None:
        intent = PlayerCollectionIntent(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            catalog_item_id=catalog_item_id,
            intent=body.intent,
            priority=body.priority,
            visibility=body.visibility,
            notes=body.notes,
            updated_at=now,
        )
        session.add(intent)
    else:
        intent.intent = body.intent
        intent.priority = body.priority
        intent.visibility = body.visibility
        intent.notes = body.notes
        intent.updated_at = now

    await session.commit()
    return CollectionIntentResponse.model_validate(intent)


@router.delete("/me/collection-intent/{catalog_item_id}", status_code=204)
async def delete_intent(
    catalog_item_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    profile = await _get_profile_or_none(session, user)
    if profile is None:
        return
    result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.catalog_item_id == catalog_item_id,
        )
    )
    intent = result.scalar_one_or_none()
    if intent:
        await session.delete(intent)
        await session.commit()


# ── Personal snapshots ─────────────────────────────────────────────────────────

@router.get("/me/collection-snapshots", response_model=list[CollectionSnapshotResponse])
async def list_my_snapshots(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[CollectionSnapshotResponse]:
    profile = await _get_profile_or_none(session, user)
    if profile is None:
        return []
    result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == profile.id
        )
    )
    return [CollectionSnapshotResponse.model_validate(r) for r in result.scalars().all()]


# ── Static suggestions ─────────────────────────────────────────────────────────

@router.get(
    "/static-groups/{group_id}/collection-suggestions",
    response_model=list[StaticCollectionSuggestion],
)
async def get_collection_suggestions(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[StaticCollectionSuggestion]:
    """Return smart farm suggestions for all active collection goals in this static.

    Only aggregated data is returned. Intent visibility is enforced: only
    static_only and dossier_public intents from group members are included.
    Private intents are never exposed here.
    """
    await require_membership(session, user.id, group_id, min_role=MemberRole.VIEWER)
    return await compute_suggestions(session, group_id, user)


# ── Dossier public hunting list ────────────────────────────────────────────────

@router.get(
    "/profiles/{share_code}/collection-intent",
    response_model=list[DossierHuntingEntry],
)
async def get_dossier_collection_intent(
    share_code: str,
    session: AsyncSession = Depends(get_session),
) -> list[DossierHuntingEntry]:
    """Public endpoint — returns only dossier_public hunting/interested intents.

    Token counts and private preferences are never included.
    """
    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.share_code == share_code)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None or not profile.share_enabled:
        raise HTTPException(404, "Profile not found or not public")

    intents_result = await session.execute(
        select(PlayerCollectionIntent).where(
            PlayerCollectionIntent.profile_id == profile.id,
            PlayerCollectionIntent.visibility == "dossier_public",
            PlayerCollectionIntent.intent.in_(["hunting", "interested"]),
        )
    )
    intents = intents_result.scalars().all()

    if not intents:
        return []

    item_ids = [i.catalog_item_id for i in intents]
    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(CollectionCatalogItem.id.in_(item_ids))
    )
    catalog_map = {c.id: c for c in catalog_result.scalars().all()}

    entries: list[DossierHuntingEntry] = []
    for intent in intents:
        item = catalog_map.get(intent.catalog_item_id)
        if not item:
            continue
        entries.append(DossierHuntingEntry(
            catalog_item_id=item.id,
            catalog_item_name=item.name,
            catalog_item_category=item.category,
            source_duty_name=item.source_duty_name,
            source_type=item.source_type,
            intent=intent.intent,
            priority=intent.priority,
        ))

    entries.sort(key=lambda e: (e.intent != "hunting", e.priority != "high"))
    return entries


# ── Personal catalog (all items + merged player state) ────────────────────────

@router.get("/me/collection-catalog", response_model=list[CatalogPlayerEntry])
async def list_my_collection_catalog(
    category: str | None = None,
    expansion: str | None = None,
    source_type: str | None = None,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[CatalogPlayerEntry]:
    """Return all active catalog items merged with this player's intent and snapshot.

    Filters are optional and applied server-side.
    Items with no player record return null for intent/snapshot fields.
    """
    filters = [CollectionCatalogItem.is_active.is_(True)]
    if category:
        filters.append(CollectionCatalogItem.category == category)
    if expansion:
        filters.append(CollectionCatalogItem.expansion == expansion)
    if source_type:
        filters.append(CollectionCatalogItem.source_type == source_type)

    catalog_result = await session.execute(
        select(CollectionCatalogItem).where(*filters).order_by(
            CollectionCatalogItem.expansion,
            CollectionCatalogItem.source_duty_name,
            CollectionCatalogItem.name,
        )
    )
    catalog_items = list(catalog_result.scalars().all())
    if not catalog_items:
        return []

    profile = await _get_profile_or_none(session, user)
    intent_map: dict[str, PlayerCollectionIntent] = {}
    snapshot_map: dict[str, PlayerCollectionSnapshot] = {}

    if profile is not None:
        item_ids = [c.id for c in catalog_items]
        intent_result = await session.execute(
            select(PlayerCollectionIntent).where(
                PlayerCollectionIntent.profile_id == profile.id,
                PlayerCollectionIntent.catalog_item_id.in_(item_ids),
            )
        )
        intent_map = {i.catalog_item_id: i for i in intent_result.scalars().all()}

        snapshot_result = await session.execute(
            select(PlayerCollectionSnapshot).where(
                PlayerCollectionSnapshot.profile_id == profile.id,
                PlayerCollectionSnapshot.catalog_item_id.in_(item_ids),
            )
        )
        snapshot_map = {s.catalog_item_id: s for s in snapshot_result.scalars().all()}

    entries: list[CatalogPlayerEntry] = []
    for item in catalog_items:
        intent = intent_map.get(item.id)
        snapshot = snapshot_map.get(item.id)
        entries.append(CatalogPlayerEntry(
            catalog_item_id=item.id,
            catalog_item_name=item.name,
            catalog_item_category=item.category,
            expansion=item.expansion,
            source_duty_name=item.source_duty_name,
            source_type=item.source_type,
            ownership_state=snapshot.ownership_state if snapshot else None,
            intent=intent.intent if intent else None,
            priority=intent.priority if intent else None,
            visibility=intent.visibility if intent else None,
            token_count=snapshot.token_count if snapshot else None,
            snapshot_source=snapshot.source if snapshot else None,
            last_synced_at=snapshot.last_synced_at if snapshot else None,
        ))

    return entries


@router.put("/me/collection-snapshot/{catalog_item_id}", response_model=CollectionSnapshotResponse)
async def upsert_snapshot(
    catalog_item_id: str,
    body: CollectionSnapshotUpsert,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CollectionSnapshotResponse:
    """Upsert ownership state and/or token count for one catalog item.

    Rules:
    - ownership_state=have: always accepted (player confirms ownership)
    - ownership_state=missing: not applied if plugin-confirmed 'have' exists
    - token_count: not overwritten if snapshot source is 'plugin'
    """
    if body.ownership_state not in ("have", "missing", "unknown"):
        raise HTTPException(400, "ownership_state must be have, missing, or unknown")

    cat_result = await session.execute(
        select(CollectionCatalogItem).where(CollectionCatalogItem.id == catalog_item_id)
    )
    if cat_result.scalar_one_or_none() is None:
        raise HTTPException(404, "Catalog item not found")

    profile = await _ensure_profile(session, user)
    now = _now()

    existing_result = await session.execute(
        select(PlayerCollectionSnapshot).where(
            PlayerCollectionSnapshot.profile_id == profile.id,
            PlayerCollectionSnapshot.catalog_item_id == catalog_item_id,
        )
    )
    snapshot = existing_result.scalar_one_or_none()

    if snapshot is None:
        snapshot = PlayerCollectionSnapshot(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            catalog_item_id=catalog_item_id,
            ownership_state=body.ownership_state,
            token_count=body.token_count,
            source="manual",
            confidence="medium",
            updated_at=now,
        )
        session.add(snapshot)
    else:
        is_plugin = snapshot.source == "plugin"
        if body.ownership_state == "have":
            snapshot.ownership_state = "have"
            snapshot.source = "manual"
            snapshot.confidence = "medium"
        elif body.ownership_state == "missing":
            if not (is_plugin and snapshot.ownership_state == "have"):
                snapshot.ownership_state = "missing"
                if not is_plugin:
                    snapshot.source = "manual"
        elif body.ownership_state == "unknown":
            if not is_plugin:
                snapshot.ownership_state = "unknown"
                snapshot.source = "manual"

        if body.token_count is not None and not is_plugin:
            snapshot.token_count = body.token_count

        snapshot.updated_at = now

    await session.commit()
    return CollectionSnapshotResponse.model_validate(snapshot)


# ── Farm match for applicant ───────────────────────────────────────────────────

@router.get("/static-groups/{group_id}/collection-match/{share_code}")
async def get_collection_match(
    group_id: str,
    share_code: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    """Match an applicant's public hunting list against this static's active farms.

    Requires the requesting user to be a member of the static.
    Only the applicant's dossier_public intents are used.
    """
    await require_membership(session, user.id, group_id, min_role=MemberRole.VIEWER)

    profile_result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.share_code == share_code)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None or not profile.share_enabled:
        raise HTTPException(404, "Profile not found or not public")

    return await dossier_farm_match(session, group_id, profile.id)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_profile_or_none(session: AsyncSession, user: User) -> PlayerProfile | None:
    """Return the player's profile, or None if it doesn't exist."""
    result = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _ensure_profile(session: AsyncSession, user: User) -> PlayerProfile:
    """Return the player's profile, auto-creating a minimal private one if absent."""
    profile = await _get_profile_or_none(session, user)
    if profile is None:
        now = datetime.now(timezone.utc).isoformat()
        profile = PlayerProfile(
            id=str(uuid.uuid4()),
            user_id=user.id,
            visibility="private",
            share_enabled=False,
            created_at=now,
            updated_at=now,
        )
        session.add(profile)
        await session.flush()
    return profile


async def _require_profile(session: AsyncSession, user: User) -> PlayerProfile:
    return await _ensure_profile(session, user)
