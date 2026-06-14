"""API router for mount farm tracker operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..logging_config import get_logger
from ..models import Membership, MemberRole, StaticActivityLog, User
from ..models.mount_farm_progress import MountFarmProgress
from ..models.player_goal import PlayerGoal
from ..models.player_profile import PlayerProfile
from ..permissions import (
    require_membership,
    get_static_group,
)
from ..schemas.mount_farms import (
    FarmScoreResponse,
    MemberProgressResponse,
    MountFarmCatalogEntry,
    MountFarmCatalogResponse,
    MountFarmProgressBulkUpdate,
    MountFarmProgressUpdate,
    MountFarmResponse,
    PluginMountFarmSync,
    PluginSyncResult,
    TrialSummaryResponse,
)

router = APIRouter(prefix="/api", tags=["mount-farms"])
logger = get_logger(__name__)

TOTEM_CLOSE_THRESHOLD = 0.75

# Curated mount farm catalog with optional FFXIV game IDs for plugin mapping.
# This is the SINGLE SOURCE OF TRUTH for backend mount farm content.
# The plugin fetches this catalog at runtime via GET /api/plugin/mount-farms/catalog.
# The frontend has a curated display copy and should stay in sync with this list.
#
# mount_id = game mount ID from Mount.exd (used by PlayerState.IsMountUnlocked)
# totem_item_id = game item/currency ID from Item.exd (used by InventoryManager item lookup)
#
# Do not populate this from broad XIVAPI text/duty searches. Add new entries only
# from reviewed mount farm data. Leave game IDs null until verified against
# Mount.exd and Item.exd via Lumina/SaintCoinach.
_FARM_CATALOG_SEEDS: list[dict] = [
    # Dawntrail
    {"trial_id": "dt-valigarmanda", "expansion": "DT", "duty_name": "Worqor Lar Dor (Extreme)", "source_content": "Worqor Lar Dor (Extreme)", "mount_name": "Wings of Ruin", "mount_id": None, "totem_name": "Skyruin Totem", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 1, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine"},
    {"trial_id": "dt-zoraal-ja", "expansion": "DT", "duty_name": "Everkeep (Extreme)", "source_content": "Everkeep (Extreme)", "mount_name": "Wings of Resolve", "mount_id": None, "totem_name": "Resilient Totem", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 1, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine"},
    {"trial_id": "dt-sphene", "expansion": "DT", "duty_name": "The Minstrel's Ballad: Sphene's Burden", "source_content": "The Minstrel's Ballad: Sphene's Burden", "mount_name": "Wings of Eternity", "mount_id": None, "totem_name": "Totem Eternal", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 2, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine"},
    {"trial_id": "dt-recollection", "expansion": "DT", "duty_name": "Recollection (Extreme)", "source_content": "Recollection (Extreme)", "mount_name": "Wings of the Knighthood", "mount_id": None, "totem_name": "Knight Totem", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 1, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine"},
    {"trial_id": "dt-necron-embrace", "expansion": "DT", "duty_name": "The Minstrel's Ballad: Necron's Embrace", "source_content": "The Minstrel's Ballad: Necron's Embrace", "mount_name": "Wings of Death", "mount_id": None, "totem_name": "Grave Totem", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 2, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine"},
    {"trial_id": "dt-windward-wilds", "expansion": "DT", "duty_name": "The Windward Wilds (Extreme)", "source_content": "The Windward Wilds (Extreme)", "mount_name": "Felyne Support Team Cart Horn", "mount_id": None, "totem_name": "Guardian Arkveld Certificate", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 2, "exchange_cost": 99, "exchange_npc": "Smithy", "exchange_location": "Tuliyollal", "content_type": "collaboration", "category": "collaboration"},
    {"trial_id": "dt-hell-on-rails", "expansion": "DT", "duty_name": "Hell on Rails (Extreme)", "source_content": "Hell on Rails (Extreme)", "mount_name": "Wings of Mist", "mount_id": None, "totem_name": "Runaway Totem", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 2, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine", "exchange_status": "not_yet_available"},
    {"trial_id": "dt-unmaking", "expansion": "DT", "duty_name": "The Unmaking (Extreme)", "source_content": "The Unmaking (Extreme)", "mount_name": "Wings of Nihility", "mount_id": None, "totem_name": "Totem of Naught", "totem_item_id": None, "totem_target": 99, "currency_per_clear": 2, "exchange_cost": 99, "exchange_npc": "Uah'shepya", "exchange_location": "Solution Nine", "exchange_status": "not_yet_available"},
    # Endwalker
    {"trial_id": "ew-zodiark", "expansion": "EW", "duty_name": "The Dark Inside (Extreme)", "mount_name": "Lynx of Fallen Shadow", "mount_id": 282, "totem_name": "Zodiark Totem", "totem_item_id": 36810, "totem_target": 99},
    {"trial_id": "ew-hydaelyn", "expansion": "EW", "duty_name": "The Mothercrystal (Extreme)", "mount_name": "Lynx of Divine Light", "mount_id": 283, "totem_name": "Hydaelyn Totem", "totem_item_id": 36811, "totem_target": 99},
    {"trial_id": "ew-endsinger", "expansion": "EW", "duty_name": "The Final Day (Extreme)", "mount_name": "Lynx of Eternal Darkness", "mount_id": 295, "totem_name": "Endsinger Totem", "totem_item_id": 38263, "totem_target": 99},
    {"trial_id": "ew-barbariccia", "expansion": "EW", "duty_name": "Storm's Crown (Extreme)", "mount_name": "Lynx of Fallen Shadow", "mount_id": 301, "totem_name": "Barbariccia Totem", "totem_item_id": 38949, "totem_target": 99},
    {"trial_id": "ew-rubicante", "expansion": "EW", "duty_name": "Mount Ordeals (Extreme)", "mount_name": "Lynx of Abyssal Grief", "mount_id": 308, "totem_name": "Rubicante Totem", "totem_item_id": 39575, "totem_target": 99},
    {"trial_id": "ew-golbez", "expansion": "EW", "duty_name": "The Voidcast Dais (Extreme)", "mount_name": "Lynx of Righteous Fire", "mount_id": 314, "totem_name": "Golbez Totem", "totem_item_id": 40201, "totem_target": 99},
    {"trial_id": "ew-zeromus", "expansion": "EW", "duty_name": "The Abyssal Fracture (Extreme)", "mount_name": "Lynx of Imperious Wind", "mount_id": 320, "totem_name": "Zeromus Totem", "totem_item_id": 40827, "totem_target": 99},
    # Shadowbringers
    {"trial_id": "shb-titania", "expansion": "ShB", "duty_name": "The Dancing Plague (Extreme)", "mount_name": "Titania", "mount_id": 232, "totem_name": "Fae Totem", "totem_item_id": 28636, "totem_target": 99},
    {"trial_id": "shb-innocence", "expansion": "ShB", "duty_name": "The Crown of the Immaculate (Extreme)", "mount_name": "Innocence", "mount_id": 233, "totem_name": "Immaculate Totem", "totem_item_id": 28637, "totem_target": 99},
    {"trial_id": "shb-hades", "expansion": "ShB", "duty_name": "The Minstrel's Ballad: Hades's Elegy", "mount_name": "Hades", "mount_id": 241, "totem_name": "Hades Totem", "totem_item_id": 30109, "totem_target": 99},
    {"trial_id": "shb-warrior-of-light", "expansion": "ShB", "duty_name": "The Seat of Sacrifice (Extreme)", "mount_name": "Warrior of Light", "mount_id": 253, "totem_name": "Warrior of Light Totem", "totem_item_id": 31357, "totem_target": 99},
    {"trial_id": "shb-emerald", "expansion": "ShB", "duty_name": "Castrum Marinum (Extreme)", "mount_name": "Emerald Gwiber", "mount_id": 261, "totem_name": "Emerald Totem", "totem_item_id": 32799, "totem_target": 99},
    {"trial_id": "shb-diamond", "expansion": "ShB", "duty_name": "The Cloud Deck (Extreme)", "mount_name": "Diamond Gwiber", "mount_id": 270, "totem_name": "Diamond Totem", "totem_item_id": 33691, "totem_target": 99},
    # Stormblood
    {"trial_id": "sb-susano", "expansion": "SB", "duty_name": "The Pool of Tribute (Extreme)", "mount_name": "Reveling Kamuy", "mount_id": 169, "totem_name": "Susano Totem", "totem_item_id": 21197, "totem_target": 99},
    {"trial_id": "sb-lakshmi", "expansion": "SB", "duty_name": "Emanation (Extreme)", "mount_name": "Blissful Kamuy", "mount_id": 170, "totem_name": "Lakshmi Totem", "totem_item_id": 21198, "totem_target": 99},
    {"trial_id": "sb-shinryu", "expansion": "SB", "duty_name": "The Minstrel's Ballad: Shinryu's Domain", "mount_name": "Shinryu", "mount_id": 179, "totem_name": "Shinryu Totem", "totem_item_id": 22027, "totem_target": 99},
    {"trial_id": "sb-byakko", "expansion": "SB", "duty_name": "The Jade Stoa (Extreme)", "mount_name": "Auspicious Kamuy", "mount_id": 183, "totem_name": "Byakko Totem", "totem_item_id": 22637, "totem_target": 99},
    {"trial_id": "sb-tsukuyomi", "expansion": "SB", "duty_name": "The Minstrel's Ballad: Tsukuyomi's Pain", "mount_name": "Lunar Kamuy", "mount_id": 191, "totem_name": "Tsukuyomi Totem", "totem_item_id": 23270, "totem_target": 99},
    {"trial_id": "sb-suzaku", "expansion": "SB", "duty_name": "Hells' Kier (Extreme)", "mount_name": "Euphonious Kamuy", "mount_id": 196, "totem_name": "Suzaku Totem", "totem_item_id": 24244, "totem_target": 99},
    {"trial_id": "sb-seiryu", "expansion": "SB", "duty_name": "The Wreath of Snakes (Extreme)", "mount_name": "Legendary Kamuy", "mount_id": 200, "totem_name": "Seiryu Totem", "totem_item_id": 24631, "totem_target": 99},
    # Heavensward
    {"trial_id": "hw-bismarck", "expansion": "HW", "duty_name": "The Limitless Blue (Extreme)", "mount_name": "White Lanner", "mount_id": 70, "totem_name": "Bismarck Totem", "totem_item_id": 13619, "totem_target": 99},
    {"trial_id": "hw-ravana", "expansion": "HW", "duty_name": "Thok ast Thok (Extreme)", "mount_name": "Rose Lanner", "mount_id": 71, "totem_name": "Ravana Totem", "totem_item_id": 13620, "totem_target": 99},
    {"trial_id": "hw-thordan", "expansion": "HW", "duty_name": "The Minstrel's Ballad: Thordan's Reign", "mount_name": "Round Lanner", "mount_id": 80, "totem_name": "Thordan Totem", "totem_item_id": 14298, "totem_target": 99},
    {"trial_id": "hw-sephirot", "expansion": "HW", "duty_name": "Containment Bay S1T7 (Extreme)", "mount_name": "Warring Lanner", "mount_id": 90, "totem_name": "Sephirot Totem", "totem_item_id": 15431, "totem_target": 99},
    {"trial_id": "hw-nidhogg", "expansion": "HW", "duty_name": "The Minstrel's Ballad: Nidhogg's Rage", "mount_name": "Dark Lanner", "mount_id": 98, "totem_name": "Nidhogg Totem", "totem_item_id": 16133, "totem_target": 99},
    {"trial_id": "hw-sophia", "expansion": "HW", "duty_name": "Containment Bay P1T6 (Extreme)", "mount_name": "Sophia Lanner", "mount_id": 105, "totem_name": "Sophia Totem", "totem_item_id": 16825, "totem_target": 99},
    {"trial_id": "hw-zurvan", "expansion": "HW", "duty_name": "Containment Bay Z1T9 (Extreme)", "mount_name": "Demonic Lanner", "mount_id": 112, "totem_name": "Zurvan Totem", "totem_item_id": 17461, "totem_target": 99},
    # ARR
    {"trial_id": "arr-garuda", "expansion": "ARR", "duty_name": "The Howling Eye (Extreme)", "mount_name": "Xanthos", "mount_id": 18, "totem_name": "Garuda Totem", "totem_item_id": 7812, "totem_target": 99},
    {"trial_id": "arr-titan", "expansion": "ARR", "duty_name": "The Navel (Extreme)", "mount_name": "Gullfaxi", "mount_id": 19, "totem_name": "Titan Totem", "totem_item_id": 7813, "totem_target": 99},
    {"trial_id": "arr-ifrit", "expansion": "ARR", "duty_name": "The Bowl of Embers (Extreme)", "mount_name": "Aithon", "mount_id": 17, "totem_name": "Ifrit Totem", "totem_item_id": 7811, "totem_target": 99},
    {"trial_id": "arr-leviathan", "expansion": "ARR", "duty_name": "The Whorleater (Extreme)", "mount_name": "Enbarr", "mount_id": 33, "totem_name": "Leviathan Totem", "totem_item_id": 8543, "totem_target": 99},
    {"trial_id": "arr-ramuh", "expansion": "ARR", "duty_name": "The Striking Tree (Extreme)", "mount_name": "Markab", "mount_id": 38, "totem_name": "Ramuh Totem", "totem_item_id": 9383, "totem_target": 99},
    {"trial_id": "arr-shiva", "expansion": "ARR", "duty_name": "Akh Afah Amphitheatre (Extreme)", "mount_name": "Boreas", "mount_id": 46, "totem_name": "Shiva Totem", "totem_item_id": 10125, "totem_target": 99},
    # Ultimate weapon/token farms. Token item names are intentionally not guessed;
    # add currency metadata only after Item.exd-backed review.
    {"trial_id": "ult-ucob", "expansion": "SB", "duty_name": "The Unending Coil of Bahamut (Ultimate)", "source_content": "The Unending Coil of Bahamut (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
    {"trial_id": "ult-uwu", "expansion": "SB", "duty_name": "The Weapon's Refrain (Ultimate)", "source_content": "The Weapon's Refrain (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
    {"trial_id": "ult-tea", "expansion": "ShB", "duty_name": "The Epic of Alexander (Ultimate)", "source_content": "The Epic of Alexander (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
    {"trial_id": "ult-dsr", "expansion": "EW", "duty_name": "Dragonsong's Reprise (Ultimate)", "source_content": "Dragonsong's Reprise (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
    {"trial_id": "ult-top", "expansion": "EW", "duty_name": "The Omega Protocol (Ultimate)", "source_content": "The Omega Protocol (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
    {"trial_id": "ult-fru", "expansion": "DT", "duty_name": "Futures Rewritten (Ultimate)", "source_content": "Futures Rewritten (Ultimate)", "mount_name": "Ultimate weapon coffer / weapon exchange", "totem_name": None, "totem_target": 0, "reward_type": "weapon", "content_type": "ultimate", "category": "ultimate", "exchange_status": "unknown", "notes": "Token item metadata pending curated Item.exd verification."},
]


def _normalize_farm_catalog_entry(entry: dict) -> dict:
    normalized = dict(entry)
    normalized.setdefault("source_content", normalized["duty_name"])
    normalized.setdefault("reward_type", "mount")
    normalized.setdefault("content_type", "extreme_trial")
    normalized.setdefault("category", "normal")
    normalized.setdefault("reward_name", normalized["mount_name"])
    normalized.setdefault("reward_item_name", normalized["mount_name"])
    normalized.setdefault("currency_item_name", normalized.get("totem_name"))
    normalized.setdefault("currency_per_clear", 1 if normalized.get("totem_name") else None)
    normalized.setdefault(
        "exchange_cost",
        normalized["totem_target"] if normalized.get("totem_target", 0) > 0 else None,
    )
    normalized.setdefault(
        "exchange_status",
        "available" if normalized.get("exchange_cost") else "unknown",
    )
    return normalized


MOUNT_FARM_CATALOG: list[dict] = [
    _normalize_farm_catalog_entry(entry) for entry in _FARM_CATALOG_SEEDS
]

# Lookup maps for plugin sync
_CATALOG_BY_TRIAL_ID = {e["trial_id"]: e for e in MOUNT_FARM_CATALOG}
_CATALOG_BY_MOUNT_ID = {e["mount_id"]: e for e in MOUNT_FARM_CATALOG if e.get("mount_id")}
_CATALOG_BY_TOTEM_ITEM_ID = {e["totem_item_id"]: e for e in MOUNT_FARM_CATALOG if e.get("totem_item_id")}


def _is_plugin_catalog_entry(entry: dict) -> bool:
    return (
        entry.get("reward_type") == "mount"
        and entry.get("content_type") == "extreme_trial"
        and isinstance(entry.get("mount_id"), int)
        and isinstance(entry.get("totem_item_id"), int)
    )


async def _write_activity_log(
    db: AsyncSession,
    *,
    group_id: str,
    actor_user: User,
    subject_display_name: str | None = None,
    event_type: str,
    trial_id: str | None,
    now: str,
) -> None:
    name = subject_display_name or actor_user.display_name or actor_user.discord_username
    label_map = {
        "mount_obtained": f"{name} obtained the mount",
        "totem_updated": f"{name} updated collection progress",
        "tracking_started": f"{name} started tracking",
        "plugin_sync": "Shared mount data updated",
    }
    label = label_map.get(event_type, f"{name} updated progress")
    actor_display = "system" if event_type == "plugin_sync" else "named"
    actor_user_id = None if event_type == "plugin_sync" else actor_user.id
    actor_display_name = None if event_type == "plugin_sync" else (actor_user.display_name or actor_user.discord_username)
    db.add(
        StaticActivityLog(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            actor_user_id=actor_user_id,
            actor_display_name=actor_display_name,
            actor_display=actor_display,
            event_type=event_type,
            trial_id=trial_id,
            label=label,
            created_at=now,
        )
    )


async def _get_group_members(
    db: AsyncSession, group_id: str
) -> list[tuple[Membership, User]]:
    result = await db.execute(
        select(Membership, User)
        .join(User, Membership.user_id == User.id)
        .where(
            Membership.static_group_id == group_id,
            Membership.role != MemberRole.VIEWER.value,
        )
    )
    return list(result.all())


def _build_member_progress(
    user: User,
    progress: MountFarmProgress | None,
    trial_id: str,
) -> MemberProgressResponse:
    if progress:
        return MemberProgressResponse(
            user_id=user.id,
            display_name=user.display_name or user.discord_username or "Unknown",
            discord_username=user.discord_username,
            discord_avatar=user.discord_avatar if hasattr(user, "discord_avatar") else None,
            trial_id=trial_id,
            has_mount=progress.has_mount,
            wants_mount=progress.wants_mount,
            totem_count=progress.totem_count,
            notes=progress.notes,
            updated_at=progress.updated_at,
            ownership_source=progress.ownership_source,
            totem_source=progress.totem_source,
            last_imported_at=progress.last_imported_at,
            last_plugin_sync_at=progress.last_plugin_sync_at,
            last_manual_override_at=progress.last_manual_override_at,
        )
    return MemberProgressResponse(
        user_id=user.id,
        display_name=user.display_name or user.discord_username or "Unknown",
        discord_username=user.discord_username,
        discord_avatar=user.discord_avatar if hasattr(user, "discord_avatar") else None,
        trial_id=trial_id,
    )


# ==================== Group-facing endpoints ====================


@router.get(
    "/static-groups/{group_id}/mount-farms",
    response_model=MountFarmResponse,
)
async def get_mount_farm_progress(
    group_id: str,
    trial_ids: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MountFarmResponse:
    await get_static_group(db, group_id)
    await require_membership(db, user.id, group_id)

    members = await _get_group_members(db, group_id)

    progress_query = select(MountFarmProgress).where(
        MountFarmProgress.static_group_id == group_id
    )
    if trial_ids:
        ids = [t.strip() for t in trial_ids.split(",") if t.strip()]
        if ids:
            progress_query = progress_query.where(MountFarmProgress.trial_id.in_(ids))

    result = await db.execute(progress_query)
    all_progress = list(result.scalars().all())

    progress_map: dict[tuple[str, str], MountFarmProgress] = {}
    for p in all_progress:
        progress_map[(p.user_id, p.trial_id)] = p

    seen_trials: set[str] = set()
    for p in all_progress:
        seen_trials.add(p.trial_id)
    if trial_ids:
        for t in trial_ids.split(","):
            t = t.strip()
            if t:
                seen_trials.add(t)

    trials: list[TrialSummaryResponse] = []
    for trial_id in sorted(seen_trials):
        catalog_entry = _CATALOG_BY_TRIAL_ID.get(trial_id, {})
        exchange_cost = catalog_entry.get("exchange_cost") or catalog_entry.get("totem_target", 0)
        member_progress_list: list[MemberProgressResponse] = []
        members_complete = 0
        members_missing = 0
        members_wanting = 0
        members_can_buy = 0

        for membership, member_user in members:
            progress = progress_map.get((member_user.id, trial_id))
            mp = _build_member_progress(member_user, progress, trial_id)
            member_progress_list.append(mp)

            if mp.has_mount:
                members_complete += 1
            else:
                members_missing += 1
                if mp.wants_mount:
                    members_wanting += 1
                if exchange_cost > 0 and mp.totem_count >= exchange_cost:
                    members_can_buy += 1

        trials.append(
            TrialSummaryResponse(
                trial_id=trial_id,
                total_members=len(members),
                members_complete=members_complete,
                members_missing=members_missing,
                members_wanting=members_wanting,
                members_can_buy=members_can_buy,
                member_progress=member_progress_list,
            )
        )

    return MountFarmResponse(trials=trials, current_user_id=user.id)


@router.patch(
    "/static-groups/{group_id}/mount-farms/progress",
    response_model=MemberProgressResponse,
)
async def update_mount_farm_progress(
    group_id: str,
    data: MountFarmProgressUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MemberProgressResponse:
    await get_static_group(db, group_id)
    membership = await require_membership(db, user.id, group_id)

    target_user_id = data.user_id or user.id
    if target_user_id != user.id:
        from ..models import ROLE_HIERARCHY
        if membership.role_level < ROLE_HIERARCHY[MemberRole.LEAD]:
            from ..permissions import PermissionDenied
            raise PermissionDenied("Only leads and owners can update other members' progress")

    result = await db.execute(
        select(MountFarmProgress).where(
            and_(
                MountFarmProgress.static_group_id == group_id,
                MountFarmProgress.user_id == target_user_id,
                MountFarmProgress.trial_id == data.trial_id,
            )
        )
    )
    progress = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).isoformat()

    if progress is None:
        progress = MountFarmProgress(
            id=str(uuid.uuid4()),
            static_group_id=group_id,
            user_id=target_user_id,
            trial_id=data.trial_id,
            has_mount=data.has_mount if data.has_mount is not None else False,
            wants_mount=data.wants_mount if data.wants_mount is not None else True,
            totem_count=data.totem_count if data.totem_count is not None else 0,
            notes=data.notes,
            ownership_source="manual",
            totem_source="manual",
            last_manual_override_at=now,
            updated_at=now,
            updated_by_id=user.id,
        )
        db.add(progress)
    else:
        if data.has_mount is not None:
            progress.has_mount = data.has_mount
            progress.ownership_source = "manual"
        if data.wants_mount is not None:
            progress.wants_mount = data.wants_mount
        if data.totem_count is not None:
            progress.totem_count = data.totem_count
            progress.totem_source = "manual"
        if data.notes is not None:
            progress.notes = data.notes
        progress.last_manual_override_at = now
        progress.updated_at = now
        progress.updated_by_id = user.id

    await db.commit()
    await db.refresh(progress)

    target_user_result = await db.execute(select(User).where(User.id == target_user_id))
    target_user = target_user_result.scalar_one()

    # Determine which event to log (only log meaningful state transitions)
    if data.has_mount:
        await _write_activity_log(
            db, group_id=group_id, actor_user=user,
            subject_display_name=target_user.display_name or target_user.discord_username if target_user_id != user.id else None,
            event_type="mount_obtained", trial_id=data.trial_id, now=now,
        )
        await db.commit()
    elif data.totem_count is not None:
        await _write_activity_log(
            db, group_id=group_id, actor_user=user,
            subject_display_name=target_user.display_name or target_user.discord_username if target_user_id != user.id else None,
            event_type="totem_updated", trial_id=data.trial_id, now=now,
        )
        await db.commit()
    elif data.wants_mount:
        await _write_activity_log(
            db, group_id=group_id, actor_user=user,
            subject_display_name=target_user.display_name or target_user.discord_username if target_user_id != user.id else None,
            event_type="tracking_started", trial_id=data.trial_id, now=now,
        )
        await db.commit()

    return _build_member_progress(target_user, progress, data.trial_id)


@router.put(
    "/static-groups/{group_id}/mount-farms/progress/bulk",
    response_model=list[MemberProgressResponse],
)
async def bulk_update_mount_farm_progress(
    group_id: str,
    data: MountFarmProgressBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[MemberProgressResponse]:
    await get_static_group(db, group_id)
    await require_membership(db, user.id, group_id, MemberRole.LEAD)

    now = datetime.now(timezone.utc).isoformat()
    responses: list[MemberProgressResponse] = []

    for update in data.updates:
        target_user_id = update.user_id or user.id

        result = await db.execute(
            select(MountFarmProgress).where(
                and_(
                    MountFarmProgress.static_group_id == group_id,
                    MountFarmProgress.user_id == target_user_id,
                    MountFarmProgress.trial_id == update.trial_id,
                )
            )
        )
        progress = result.scalar_one_or_none()

        if progress is None:
            progress = MountFarmProgress(
                id=str(uuid.uuid4()),
                static_group_id=group_id,
                user_id=target_user_id,
                trial_id=update.trial_id,
                has_mount=update.has_mount if update.has_mount is not None else False,
                wants_mount=update.wants_mount if update.wants_mount is not None else True,
                totem_count=update.totem_count if update.totem_count is not None else 0,
                notes=update.notes,
                ownership_source="manual",
                totem_source="manual",
                last_manual_override_at=now,
                updated_at=now,
                updated_by_id=user.id,
            )
            db.add(progress)
        else:
            if update.has_mount is not None:
                progress.has_mount = update.has_mount
                progress.ownership_source = "manual"
            if update.wants_mount is not None:
                progress.wants_mount = update.wants_mount
            if update.totem_count is not None:
                progress.totem_count = update.totem_count
                progress.totem_source = "manual"
            if update.notes is not None:
                progress.notes = update.notes
            progress.last_manual_override_at = now
            progress.updated_at = now
            progress.updated_by_id = user.id

    await db.commit()

    for update in data.updates:
        target_user_id = update.user_id or user.id
        result = await db.execute(
            select(MountFarmProgress).where(
                and_(
                    MountFarmProgress.static_group_id == group_id,
                    MountFarmProgress.user_id == target_user_id,
                    MountFarmProgress.trial_id == update.trial_id,
                )
            )
        )
        progress = result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == target_user_id))
        target_user = user_result.scalar_one()
        responses.append(_build_member_progress(target_user, progress, update.trial_id))

    return responses


from pydantic import BaseModel  # noqa: E402  (after top-level imports for clarity)


class ActivityLogItemResponse(BaseModel):
    id: str
    actor_user_id: str | None
    actor_display_name: str | None
    actor_display: str
    event_type: str
    trial_id: str | None
    label: str
    created_at: str

    model_config = {"from_attributes": True}


@router.get(
    "/static-groups/{group_id}/activity-log",
    response_model=list[ActivityLogItemResponse],
)
async def get_static_activity_log(
    group_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[ActivityLogItemResponse]:
    """Return the most recent activity log entries for a static group."""
    await get_static_group(db, group_id)
    await require_membership(db, user.id, group_id)

    from sqlalchemy import desc
    result = await db.execute(
        select(StaticActivityLog)
        .where(StaticActivityLog.static_group_id == group_id)
        .order_by(desc(StaticActivityLog.created_at))
        .limit(max(1, min(limit, 50)))
    )
    rows = list(result.scalars().all())
    return [ActivityLogItemResponse.model_validate(r) for r in rows]


@router.get(
    "/static-groups/{group_id}/mount-farms/recommendations",
    response_model=list[FarmScoreResponse],
)
async def get_farm_recommendations(
    group_id: str,
    expansion: str | None = None,
    limit: int = 5,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[FarmScoreResponse]:
    await get_static_group(db, group_id)
    await require_membership(db, user.id, group_id)

    members = await _get_group_members(db, group_id)
    total_members = len(members)
    if total_members == 0:
        return []

    progress_query = select(MountFarmProgress).where(
        MountFarmProgress.static_group_id == group_id
    )
    result = await db.execute(progress_query)
    all_progress = list(result.scalars().all())

    progress_by_trial: dict[str, list[MountFarmProgress]] = {}
    for p in all_progress:
        progress_by_trial.setdefault(p.trial_id, []).append(p)

    scores: list[FarmScoreResponse] = []
    for trial_id, progress_list in progress_by_trial.items():
        if expansion:
            if not trial_id.startswith(expansion.lower() + "-"):
                continue
        catalog_entry = _CATALOG_BY_TRIAL_ID.get(trial_id, {})
        exchange_cost = catalog_entry.get("exchange_cost") or catalog_entry.get("totem_target", 0)

        user_progress_map = {p.user_id: p for p in progress_list}
        members_missing = 0
        members_wanting = 0
        members_close = 0
        members_can_buy = 0

        for _, member_user in members:
            p = user_progress_map.get(member_user.id)
            if p and p.has_mount:
                continue
            members_missing += 1
            if p:
                if p.wants_mount:
                    members_wanting += 1
                if exchange_cost > 0 and p.totem_count >= exchange_cost:
                    members_can_buy += 1
                elif exchange_cost > 0 and p.totem_count >= exchange_cost * TOTEM_CLOSE_THRESHOLD:
                    members_close += 1
            else:
                members_wanting += 1

        score = (
            members_wanting * 3.0
            + members_missing * 1.0
            + members_close * 2.0
            + members_can_buy * 1.5
        )

        if score > 0:
            scores.append(
                FarmScoreResponse(
                    trial_id=trial_id,
                    score=round(score, 2),
                    members_missing=members_missing,
                    members_wanting=members_wanting,
                    members_close_to_target=members_close,
                    members_can_buy=members_can_buy,
                )
            )

    scores.sort(key=lambda s: s.score, reverse=True)
    return scores[:limit]


# ==================== Plugin-facing endpoints ====================


@router.get(
    "/plugin/mount-farms/catalog",
    response_model=MountFarmCatalogResponse,
)
async def get_mount_farm_catalog(
    user: User = Depends(get_current_user),
) -> MountFarmCatalogResponse:
    """Return plugin-scannable mount farms with verified game IDs."""
    entries = [
        MountFarmCatalogEntry(
            trial_id=e["trial_id"],
            expansion=e["expansion"],
            duty_name=e["duty_name"],
            source_content=e.get("source_content", e["duty_name"]),
            reward_type=e.get("reward_type", "mount"),
            content_type=e.get("content_type", "extreme_trial"),
            mount_name=e["mount_name"],
            mount_id=e.get("mount_id"),
            totem_name=e.get("totem_name"),
            totem_item_id=e.get("totem_item_id"),
            totem_target=e.get("totem_target", 99),
            reward_name=e.get("reward_name", e["mount_name"]),
            reward_item_name=e.get("reward_item_name"),
            currency_item_name=e.get("currency_item_name", e.get("totem_name")),
            currency_per_clear=e.get("currency_per_clear"),
            exchange_cost=e.get("exchange_cost"),
            exchange_npc=e.get("exchange_npc"),
            exchange_location=e.get("exchange_location"),
            exchange_status=e.get("exchange_status", "available"),
            category=e.get("category", "normal"),
            notes=e.get("notes"),
        )
        for e in MOUNT_FARM_CATALOG
        if _is_plugin_catalog_entry(e)
    ]
    return MountFarmCatalogResponse(entries=entries)


async def _bridge_mount_farm_goals(
    db: AsyncSession, user: User, data: "PluginMountFarmSync", now: str,
) -> None:
    """Bridge: upsert PlayerGoal entries for mount/totem data from plugin sync.

    For each mount/totem the plugin reports, create or update a
    corresponding PlayerGoal with goal_type="mount_farm" or "totem_farm".
    Fails silently — group sync always succeeds regardless.
    """
    profile_result = await db.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return

    for mount_item in data.mounts:
        catalog_entry = None
        if mount_item.trial_id:
            catalog_entry = _CATALOG_BY_TRIAL_ID.get(mount_item.trial_id)
        if not catalog_entry:
            catalog_entry = _CATALOG_BY_MOUNT_ID.get(mount_item.mount_id)
        if not catalog_entry:
            continue

        trial_id = catalog_entry["trial_id"]
        goal_result = await db.execute(
            select(PlayerGoal).where(
                PlayerGoal.profile_id == profile.id,
                PlayerGoal.goal_type == "mount_farm",
                PlayerGoal.source_content == trial_id,
            )
        )
        goal = goal_result.scalar_one_or_none()

        if goal:
            if mount_item.owned and goal.status != "completed":
                goal.status = "completed"
                goal.updated_at = now
        else:
            if mount_item.owned:
                db.add(PlayerGoal(
                    id=str(uuid.uuid4()),
                    profile_id=profile.id,
                    title=f"{catalog_entry['mount_name']} Mount",
                    goal_type="mount_farm",
                    status="completed",
                    source_content=trial_id,
                    source_item=catalog_entry["mount_name"],
                    target_count=catalog_entry.get("totem_target", 99),
                    current_count=catalog_entry.get("totem_target", 99),
                    created_at=now,
                    updated_at=now,
                ))

    for totem_item in data.totems:
        catalog_entry = None
        if totem_item.trial_id:
            catalog_entry = _CATALOG_BY_TRIAL_ID.get(totem_item.trial_id)
        if not catalog_entry:
            catalog_entry = _CATALOG_BY_TOTEM_ITEM_ID.get(totem_item.item_id)
        if not catalog_entry:
            continue

        trial_id = catalog_entry["trial_id"]
        goal_result = await db.execute(
            select(PlayerGoal).where(
                PlayerGoal.profile_id == profile.id,
                PlayerGoal.goal_type == "mount_farm",
                PlayerGoal.source_content == trial_id,
            )
        )
        goal = goal_result.scalar_one_or_none()

        if goal:
            if totem_item.count > goal.current_count:
                goal.current_count = totem_item.count
                goal.updated_at = now
                if goal.target_count and totem_item.count >= goal.target_count:
                    goal.status = "completed"
        elif totem_item.count > 0:
            db.add(PlayerGoal(
                id=str(uuid.uuid4()),
                profile_id=profile.id,
                title=f"{catalog_entry['mount_name']} Mount",
                goal_type="mount_farm",
                status="active",
                source_content=trial_id,
                source_item=catalog_entry["totem_name"],
                target_count=catalog_entry.get("totem_target", 99),
                current_count=totem_item.count,
                created_at=now,
                updated_at=now,
            ))

    await db.flush()


@router.post(
    "/plugin/mount-farms/sync",
    response_model=PluginSyncResult,
)
async def plugin_sync_mount_farms(
    data: PluginMountFarmSync,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PluginSyncResult:
    """Process mount/totem data from the Dalamud plugin.

    Updates mount_farm_progress for all static groups the user belongs to.
    Only the authenticated user's own progress is updated (never other members).
    Automation-first: plugin data overwrites unless a manual override is more recent.
    """
    now = data.synced_at or datetime.now(timezone.utc).isoformat()
    source = data.source or "plugin"

    # Find all groups the user belongs to (non-viewer)
    memberships_result = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.role != MemberRole.VIEWER.value,
        )
    )
    memberships = list(memberships_result.scalars().all())
    group_ids = [m.static_group_id for m in memberships]

    if not group_ids:
        return PluginSyncResult(synced_at=now)

    mounts_updated = 0
    mounts_unchanged = 0
    totems_updated = 0
    totems_unchanged = 0
    unknown_trials: list[str] = []

    # Process mount ownership
    for mount_item in data.mounts:
        catalog_entry = None
        if mount_item.trial_id:
            catalog_entry = _CATALOG_BY_TRIAL_ID.get(mount_item.trial_id)
        if not catalog_entry:
            catalog_entry = _CATALOG_BY_MOUNT_ID.get(mount_item.mount_id)
        if not catalog_entry:
            unknown_trials.append(f"mount:{mount_item.mount_id}")
            continue

        trial_id = catalog_entry["trial_id"]

        for group_id in group_ids:
            result = await db.execute(
                select(MountFarmProgress).where(
                    and_(
                        MountFarmProgress.static_group_id == group_id,
                        MountFarmProgress.user_id == user.id,
                        MountFarmProgress.trial_id == trial_id,
                    )
                )
            )
            progress = result.scalar_one_or_none()

            if progress is None:
                if mount_item.owned:
                    progress = MountFarmProgress(
                        id=str(uuid.uuid4()),
                        static_group_id=group_id,
                        user_id=user.id,
                        trial_id=trial_id,
                        has_mount=True,
                        wants_mount=False,
                        totem_count=0,
                        ownership_source=source,
                        totem_source="unknown",
                        last_imported_at=now,
                        last_plugin_sync_at=now,
                        updated_at=now,
                        updated_by_id=user.id,
                    )
                    db.add(progress)
                    mounts_updated += 1
                else:
                    mounts_unchanged += 1
            else:
                # Only update has_mount if plugin says owned AND either:
                # - no manual override exists, OR
                # - plugin data is newer than the last manual override
                should_update = mount_item.owned and not progress.has_mount
                if should_update:
                    # Don't overwrite a manual "has_mount=False" if the manual override
                    # is more recent (user explicitly unmarked it)
                    if (
                        progress.ownership_source == "manual"
                        and progress.last_manual_override_at
                        and not progress.has_mount
                    ):
                        mounts_unchanged += 1
                        continue

                    progress.has_mount = True
                    progress.ownership_source = source
                    progress.last_imported_at = now
                    progress.last_plugin_sync_at = now
                    progress.updated_at = now
                    progress.updated_by_id = user.id
                    mounts_updated += 1
                else:
                    progress.last_plugin_sync_at = now
                    mounts_unchanged += 1

    # Process totem counts
    for totem_item in data.totems:
        catalog_entry = None
        if totem_item.trial_id:
            catalog_entry = _CATALOG_BY_TRIAL_ID.get(totem_item.trial_id)
        if not catalog_entry:
            catalog_entry = _CATALOG_BY_TOTEM_ITEM_ID.get(totem_item.item_id)
        if not catalog_entry:
            unknown_trials.append(f"totem:{totem_item.item_id}")
            continue

        trial_id = catalog_entry["trial_id"]

        for group_id in group_ids:
            result = await db.execute(
                select(MountFarmProgress).where(
                    and_(
                        MountFarmProgress.static_group_id == group_id,
                        MountFarmProgress.user_id == user.id,
                        MountFarmProgress.trial_id == trial_id,
                    )
                )
            )
            progress = result.scalar_one_or_none()

            if progress is None:
                if totem_item.count > 0:
                    progress = MountFarmProgress(
                        id=str(uuid.uuid4()),
                        static_group_id=group_id,
                        user_id=user.id,
                        trial_id=trial_id,
                        has_mount=False,
                        wants_mount=True,
                        totem_count=totem_item.count,
                        ownership_source="unknown",
                        totem_source=source,
                        last_imported_at=now,
                        last_plugin_sync_at=now,
                        updated_at=now,
                        updated_by_id=user.id,
                    )
                    db.add(progress)
                    totems_updated += 1
                else:
                    totems_unchanged += 1
            else:
                # Update totem count unless a manual override is more recent
                if (
                    progress.totem_source == "manual"
                    and progress.last_manual_override_at
                    and progress.last_manual_override_at > now
                ):
                    totems_unchanged += 1
                    continue

                if progress.totem_count != totem_item.count:
                    progress.totem_count = totem_item.count
                    progress.totem_source = source
                    progress.last_imported_at = now
                    progress.last_plugin_sync_at = now
                    progress.updated_at = now
                    progress.updated_by_id = user.id
                    totems_updated += 1
                else:
                    progress.last_plugin_sync_at = now
                    totems_unchanged += 1

    # --- Bridge: also upsert PlayerGoal entries for solo profile ---
    try:
        await _bridge_mount_farm_goals(db, user, data, now)
    except Exception:
        logger.warning("mount_farm_goal_bridge_failed", user_id=user.id)

    await db.commit()

    logger.info(
        "mount_farm_plugin_sync_complete",
        user_id=user.id,
        source=source,
        mounts_updated=mounts_updated,
        totems_updated=totems_updated,
        groups_synced=len(group_ids),
        unknown_trials=len(unknown_trials),
    )

    return PluginSyncResult(
        mounts_updated=mounts_updated,
        totems_updated=totems_updated,
        mounts_unchanged=mounts_unchanged,
        totems_unchanged=totems_unchanged,
        unknown_trials=unknown_trials[:20],
        synced_at=now,
    )
