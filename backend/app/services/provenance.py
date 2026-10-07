"""Write provenance for log rows (PROV-1, R-PV-1 .. R-PV-5).

Every new loot, material, book (page-ledger) and farm-drop row records how it
was logged (`logged_via`) and which API key wrote it (`api_key_id`). Loot,
material and book rows also record whose card the row was for
(`recipient_user_id`) and which character, with whether the client sent that
character or the server filled in the card's main
(`recipient_character_source`).

Everything here is server-derived. Nothing reads the request body or a client
header, so no request or response shape changes and the plugin's requests stay
valid byte for byte.

Mapping to `AuditLog.credential` (models/audit_log.py, set from the same
`request.state.auth_credential`):

    AuditLog.credential   logged_via
    -------------------   ----------
    cookie                web
    api_key               api_key
    system                (none: no system path writes these rows, and
                          `logged_via` raises rather than guess)

Column vocabulary (binding on later provenance columns): a writer column is
`<verb>_by_user_id` (FK users.id); a channel column is `<verb>_via`
`String(10)`, nullable, no CHECK or enum, filled only from the `LOGGED_VIA_*`
constants through `logged_via(request)`.

NULL on a provenance column means the row predates PROV-1 ("unknown origin").
"""

from collections.abc import Iterable
from dataclasses import dataclass

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlayerCharacter, SnapshotPlayer, StaticCharacterRegistration

LOGGED_VIA_WEB = "web"
LOGGED_VIA_API_KEY = "api_key"
LOGGED_VIA_VALUES = (LOGGED_VIA_WEB, LOGGED_VIA_API_KEY)

# "explicit": the client named the character. "default": the server filled in
# the card's main for this static (B15).
CHARACTER_SOURCE_EXPLICIT = "explicit"
CHARACTER_SOURCE_DEFAULT = "default"
CHARACTER_SOURCE_VALUES = (CHARACTER_SOURCE_EXPLICIT, CHARACTER_SOURCE_DEFAULT)

_AUTH_CREDENTIAL_COOKIE = "cookie"
_AUTH_CREDENTIAL_API_KEY = "api_key"

BAD_REGISTRATION_DETAIL = (
    "Character registration not found or does not belong to this player/static"
)


@dataclass(frozen=True)
class EntryProvenance:
    """The provenance values one new log row stores (R-PV-5)."""

    logged_via: str
    api_key_id: str | None
    recipient_user_id: str | None
    recipient_character_registration_id: str | None
    recipient_character_name: str | None
    recipient_character_source: str | None


def _credential(request: Request) -> str | None:
    return getattr(request.state, "auth_credential", None)


def logged_via(request: Request) -> str:
    """`web` or `api_key`, from the credential that authenticated the request.

    Raises on anything else, including unset: every creation route depends on
    `get_current_user`, which always sets the state, so an unset value is a
    wiring bug and a silent NULL would look like a legacy row.
    """
    credential = _credential(request)
    if credential == _AUTH_CREDENTIAL_COOKIE:
        return LOGGED_VIA_WEB
    if credential == _AUTH_CREDENTIAL_API_KEY:
        return LOGGED_VIA_API_KEY
    raise RuntimeError("write provenance: request has no auth credential")


def request_api_key_id(request: Request) -> str | None:
    """The authenticating key's id for an `api_key` request, None for a web one."""
    credential = _credential(request)
    if credential == _AUTH_CREDENTIAL_COOKIE:
        return None
    if credential == _AUTH_CREDENTIAL_API_KEY:
        key_id = getattr(request.state, "api_key_id", None)
        if not key_id:
            raise RuntimeError("write provenance: api_key request has no api_key_id")
        return key_id
    raise RuntimeError("write provenance: request has no auth credential")


async def _hub_character_names(
    db: AsyncSession, registrations: Iterable[StaticCharacterRegistration]
) -> dict[str, str]:
    """PlayerCharacter names for the registrations that need one, in one SELECT.

    Only registrations with no manual name and a linked Player Hub character
    need the lookup. Issues no query when none does.
    """
    ids = {
        reg.player_character_id
        for reg in registrations
        if not reg.manual_character_name and reg.player_character_id
    }
    if not ids:
        return {}
    result = await db.execute(
        select(PlayerCharacter.id, PlayerCharacter.name).where(PlayerCharacter.id.in_(list(ids)))
    )
    return {pc_id: name for pc_id, name in result.all()}


def _registration_name(reg: StaticCharacterRegistration, hub_names: dict[str, str]) -> str | None:
    """The name a registration snapshots: the manual name, else the linked character's."""
    if reg.manual_character_name:
        return reg.manual_character_name
    if reg.player_character_id:
        return hub_names.get(reg.player_character_id)
    return None


async def resolve_batch_provenance(
    db: AsyncSession,
    request: Request,
    *,
    static_group_id: str,
    players: Iterable[SnapshotPlayer],
) -> dict[str, EntryProvenance]:
    """Provenance for many cards at once (R-PV-4 steps 3 and 4), keyed by player id.

    Costs at most two SELECTs however many players: one for the cards'
    registrations and one for PlayerCharacter names. A card's main is its
    `is_primary_for_static` registration in this static; with several, the
    earliest `created_at`, then the lowest `id`.
    """
    players = list(players)
    if not players:
        return {}

    via = logged_via(request)
    key_id = request_api_key_id(request)

    result = await db.execute(
        select(StaticCharacterRegistration)
        .where(
            StaticCharacterRegistration.static_group_id == static_group_id,
            StaticCharacterRegistration.snapshot_player_id.in_([p.id for p in players]),
            StaticCharacterRegistration.is_primary_for_static.is_(True),
        )
        .order_by(
            StaticCharacterRegistration.created_at.asc(), StaticCharacterRegistration.id.asc()
        )
    )
    mains: dict[str, StaticCharacterRegistration] = {}
    for reg in result.scalars():
        mains.setdefault(reg.snapshot_player_id, reg)

    hub_names = await _hub_character_names(db, mains.values())

    resolved: dict[str, EntryProvenance] = {}
    for player in players:
        main = mains.get(player.id)
        if main is None:
            resolved[player.id] = EntryProvenance(
                logged_via=via,
                api_key_id=key_id,
                recipient_user_id=player.user_id,
                recipient_character_registration_id=None,
                recipient_character_name=None,
                recipient_character_source=None,
            )
            continue
        resolved[player.id] = EntryProvenance(
            logged_via=via,
            api_key_id=key_id,
            recipient_user_id=player.user_id,
            recipient_character_registration_id=main.id,
            recipient_character_name=_registration_name(main, hub_names),
            recipient_character_source=CHARACTER_SOURCE_DEFAULT,
        )
    return resolved


async def resolve_entry_provenance(
    db: AsyncSession,
    request: Request,
    *,
    static_group_id: str,
    player: SnapshotPlayer,
    registration_id: str | None = None,
    character_name: str | None = None,
) -> EntryProvenance:
    """Provenance for one new row (R-PV-4 steps 1 to 4).

    1. An explicit registration: validated against this static and this card
       (400 with the loot route's detail text otherwise). The name is the
       explicit name if sent, else the registration's. Source `explicit`.
    2. An explicit name with no registration: stored as sent, registration
       NULL. Source `explicit`.
    3. Otherwise the card's main for this static, via the batch resolver.
       Source `default`.
    4. Otherwise NULL, NULL, NULL.
    """
    if not registration_id and not character_name:
        return (
            await resolve_batch_provenance(
                db, request, static_group_id=static_group_id, players=[player]
            )
        )[player.id]

    via = logged_via(request)
    key_id = request_api_key_id(request)

    if not registration_id:
        return EntryProvenance(
            logged_via=via,
            api_key_id=key_id,
            recipient_user_id=player.user_id,
            recipient_character_registration_id=None,
            recipient_character_name=character_name,
            recipient_character_source=CHARACTER_SOURCE_EXPLICIT,
        )

    result = await db.execute(
        select(StaticCharacterRegistration).where(
            StaticCharacterRegistration.id == registration_id,
            StaticCharacterRegistration.static_group_id == static_group_id,
            StaticCharacterRegistration.snapshot_player_id == player.id,
        )
    )
    registration = result.scalar_one_or_none()
    if registration is None:
        raise HTTPException(status_code=400, detail=BAD_REGISTRATION_DETAIL)

    name = character_name
    if not name:
        name = _registration_name(registration, await _hub_character_names(db, [registration]))

    return EntryProvenance(
        logged_via=via,
        api_key_id=key_id,
        recipient_user_id=player.user_id,
        recipient_character_registration_id=registration.id,
        recipient_character_name=name,
        recipient_character_source=CHARACTER_SOURCE_EXPLICIT,
    )
