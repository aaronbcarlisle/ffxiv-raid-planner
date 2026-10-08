"""Undo tokens for farm-cell writes (S2a-2, R-S2-11).

A PATCH that writes a member's cell returns an `undo_token`: what the row (and
the record, when one was written) held before the write, sealed so that the
holder can neither read nor forge it. The token is a Fernet token, encrypted and
authenticated, keyed from `settings.jwt_secret_key` through an HMAC with a
purpose label, so it is not a session JWT and `auth_utils.verify_token` refuses
it. It is valid for ten minutes and bound to its static and its actor.
Encryption is the point, not a nicety: a lead holding a token for a flagged
member's cell must not learn that member's prior count (B1's gate, vet M-4).

The priors carry the prior writer and channel (vet I-2, Q4) so the undo route
can hand them back to the door as `actor_user_id=` and `via=`: values the
server wrote, carried in a token the client can neither read nor forge. Only
the undo route reads one; the PATCH routes and the bulk route mint them. The
restore itself goes through the door (`collection_records.py`).
"""

import base64
import hashlib
import hmac
import json
from collections.abc import Sequence
from dataclasses import asdict, dataclass, fields
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.models import PlayerCollectionSnapshot, RewardParticipantState

UNDO_TTL_SECONDS = 600
_KEY_PURPOSE = b"participant-undo"
# 2: the row's prior gained `priority_rank` and `notes` (B3); a format-1 token is refused.
_FORMAT = 2


class UndoTokenInvalid(Exception):
    """The token is forged, tampered, expired, malformed, or another static's or actor's."""


@dataclass(frozen=True)
class RowPrior:
    """A farm row as it was before a write (R-S2-11): the values a restore puts back,
    the queue rank and notes included (a lead's V1 PATCH can change them)."""

    state: str
    token_count: int | None
    source: str
    state_changed_at: str | None
    token_count_updated_at: str | None
    updated_by_user_id: str | None
    updated_via: str | None
    last_manual_override_at: str | None
    priority_rank: int | None
    notes: str | None

    @classmethod
    def of(cls, row: RewardParticipantState) -> "RowPrior":
        return cls(
            state=row.state,
            token_count=row.token_count,
            source=row.source,
            state_changed_at=row.state_changed_at,
            token_count_updated_at=row.token_count_updated_at,
            updated_by_user_id=row.updated_by_user_id,
            updated_via=row.updated_via,
            last_manual_override_at=row.last_manual_override_at,
            priority_rank=row.priority_rank,
            notes=row.notes,
        )


@dataclass(frozen=True)
class RecordPrior:
    """A collection record as it was before a write (R-S2-11)."""

    ownership_state: str
    token_count: int | None
    source: str
    confidence: str
    state_changed_at: str | None
    token_count_updated_at: str | None
    updated_by_user_id: str | None
    updated_via: str | None

    @classmethod
    def of(cls, record: PlayerCollectionSnapshot) -> "RecordPrior":
        return cls(
            ownership_state=record.ownership_state,
            token_count=record.token_count,
            source=record.source,
            confidence=record.confidence,
            state_changed_at=record.state_changed_at,
            token_count_updated_at=record.token_count_updated_at,
            updated_by_user_id=record.updated_by_user_id,
            updated_via=record.updated_via,
        )


@dataclass(frozen=True)
class UndoCell:
    """One cell a write touched: the row's prior (None when the write created it)
    and its `updated_at` after the write; the record's id, prior (None when the
    write created it) and `updated_at` after, when a record was written, else
    `record_id` is None. The route restores a part only while its current
    `updated_at` equals the "after" here."""

    goal_id: str
    user_id: str
    row_prior: RowPrior | None
    row_updated_at: str
    record_id: str | None = None
    record_prior: RecordPrior | None = None
    record_updated_at: str | None = None


@dataclass(frozen=True)
class UndoClaims:
    """What a token says: the static, the actor who wrote, and the cells."""

    group_id: str
    actor_user_id: str
    cells: tuple[UndoCell, ...]


@lru_cache(maxsize=4)
def _fernet_for(secret: str) -> Fernet:
    digest = hmac.new(secret.encode("utf-8"), _KEY_PURPOSE, hashlib.sha256).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _fernet() -> Fernet:
    return _fernet_for(get_settings().jwt_secret_key)


def mint_undo_token(
    *,
    group_id: str,
    actor_user_id: str,
    cells: Sequence[UndoCell],
    now: float | None = None,
) -> str:
    """Seal `cells` for `actor_user_id` in `group_id`; `now` injects the clock (tests)."""
    if not cells:
        raise ValueError("an undo token names at least one cell")
    claims = UndoClaims(group_id=group_id, actor_user_id=actor_user_id, cells=tuple(cells))
    payload = json.dumps({"v": _FORMAT, **asdict(claims)}, separators=(",", ":"))
    data = payload.encode("utf-8")
    fernet = _fernet()
    token = fernet.encrypt(data) if now is None else fernet.encrypt_at_time(data, int(now))
    return token.decode("ascii")


def read_undo_token(
    token: str, *, group_id: str, actor_user_id: str, now: float | None = None
) -> UndoClaims:
    """The claims of `token`, or UndoTokenInvalid unless it is authentic, within its
    ten minutes, and this static's and this actor's."""
    fernet = _fernet()
    try:
        raw = token.encode("utf-8")
        if now is None:
            data = fernet.decrypt(raw, ttl=UNDO_TTL_SECONDS)
        else:
            data = fernet.decrypt_at_time(raw, UNDO_TTL_SECONDS, int(now))
    except (InvalidToken, TypeError, ValueError, AttributeError) as exc:
        raise UndoTokenInvalid("the undo token is not valid or has expired") from exc
    try:
        claims = _claims(json.loads(data))
    except (KeyError, TypeError, ValueError) as exc:
        raise UndoTokenInvalid("the undo token is malformed") from exc
    if claims.group_id != group_id or claims.actor_user_id != actor_user_id:
        raise UndoTokenInvalid("the undo token is another static's or another member's")
    return claims


def _claims(data: object) -> UndoClaims:
    if not isinstance(data, dict) or data.get("v") != _FORMAT:
        raise UndoTokenInvalid("the undo token is of another format")
    cells = data["cells"]
    if not isinstance(cells, list) or not cells:
        raise UndoTokenInvalid("the undo token names no cell")
    return UndoClaims(
        group_id=_text(data["group_id"]),
        actor_user_id=_text(data["actor_user_id"]),
        cells=tuple(_cell(cell) for cell in cells),
    )


def _cell(data: object) -> UndoCell:
    if not isinstance(data, dict):
        raise UndoTokenInvalid("the undo token's cell is malformed")
    return UndoCell(
        goal_id=_text(data["goal_id"]),
        user_id=_text(data["user_id"]),
        row_prior=_prior(RowPrior, data["row_prior"]),
        row_updated_at=_text(data["row_updated_at"]),
        record_id=_optional_text(data["record_id"]),
        record_prior=_prior(RecordPrior, data["record_prior"]),
        record_updated_at=_optional_text(data["record_updated_at"]),
    )


def _prior(cls, data: object):
    if data is None:
        return None
    if not isinstance(data, dict) or set(data) != {f.name for f in fields(cls)}:
        raise UndoTokenInvalid("the undo token's prior is malformed")
    return cls(**data)


def _text(value: object) -> str:
    if not isinstance(value, str):
        raise UndoTokenInvalid("the undo token's field is not text")
    return value


def _optional_text(value: object) -> str | None:
    return None if value is None else _text(value)
