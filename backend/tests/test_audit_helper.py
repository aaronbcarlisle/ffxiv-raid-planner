"""AD1a audit substrate tests.

Covers the same-session audit() helper (spec §3.2): atomic commit/rollback
with the mutation, changed-fields diffing, the secret deny-list, credential
threading via request.state.auth_credential, and the error-report
request_id regression (exceptions.py context was always None before AD1a).
"""

import asyncio
import hashlib
import time
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.dependencies import get_current_user
from app.exceptions import ExternalServiceError, register_exception_handlers
from app.middleware.request_id import RequestIDMiddleware
from app.models import ApiKey, AuditLog, StaticGroup, User
from app.models.analytics import ErrorReport
from app.services.audit import audit, compute_changed_fields, _strip_secrets


def make_request(
    headers: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
    state: dict | None = None,
) -> Request:
    """Fabricate a starlette Request for direct dependency/helper calls."""
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    if cookies:
        cookie_value = "; ".join(f"{k}={v}" for k, v in cookies.items())
        raw_headers.append((b"cookie", cookie_value.encode()))
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": raw_headers,
        "query_string": b"",
        "state": dict(state or {}),
    }
    return Request(scope)


class TestComputeChangedFields:
    def test_keeps_only_changed_keys(self):
        old, new = compute_changed_fields(
            {"name": "Alpha", "size": 8, "note": "same"},
            {"name": "Beta", "size": 8, "note": "same"},
        )
        assert old == {"name": "Alpha"}
        assert new == {"name": "Beta"}

    def test_added_and_removed_keys_count_as_changed(self):
        old, new = compute_changed_fields({"gone": 1}, {"added": 2})
        assert old == {"gone": 1}
        assert new == {"added": 2}

    def test_identical_dicts_produce_empty_diffs(self):
        old, new = compute_changed_fields({"a": 1}, {"a": 1})
        assert old == {} and new == {}


class TestSecretDenyList:
    def test_exact_and_suffix_keys_stripped(self):
        values = {
            "token": "x",
            "secret": "x",
            "webhook_url": "x",
            "code_challenge": "x",
            "discord_bot_token": "x",
            "calendar_token": "x",
            "key_hash": "x",
            "code_hash": "x",
            "client_secret": "x",
            "name": "kept",
        }
        assert _strip_secrets(values) == {"name": "kept"}

    def test_collection_token_fields_survive(self):
        """token_name/token_cost/token_item_id/token_count are catalog diff
        fields, not secrets — a bare 'token' substring rule would gut them."""
        values = {"token_name": "a", "token_cost": 1, "token_item_id": 2, "token_count": 3}
        assert _strip_secrets(values) == values

    def test_none_passes_through(self):
        assert _strip_secrets(None) is None


@pytest.mark.asyncio
class TestAuditAtomicity:
    async def _make_actor(self, session: AsyncSession, *, is_admin: bool = True) -> User:
        from tests.factories import create_user

        actor = await create_user(session, discord_username="audit_actor")
        actor.is_admin = is_admin
        await session.commit()
        return actor

    async def test_row_commits_atomically_with_mutation(self, session: AsyncSession):
        actor = await self._make_actor(session)

        group = StaticGroup(
            id=str(uuid.uuid4()),
            name="Audit Target",
            owner_id=actor.id,
            share_code="AUDIT1",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        session.add(group)
        await audit(
            session,
            actor=actor,
            action="static.created",
            target_type="static",
            target_id=group.id,
            target_label=group.name,
            static_group_id=group.id,
            new={"name": "Audit Target"},
            request=make_request(
                headers={"X-View-As": "impersonated-user"},
                state={"auth_credential": "cookie", "request_id": "req-123"},
            ),
        )
        await session.commit()

        row = (await session.execute(select(AuditLog))).scalar_one()
        assert row.action == "static.created"
        assert row.actor_user_id == actor.id
        assert row.actor_label == "audit_actor"
        assert row.credential == "cookie"
        assert row.request_id == "req-123"
        assert row.impersonating_user_id == "impersonated-user"
        assert row.admin_override is False
        assert row.new_values == {"name": "Audit Target"}
        assert row.old_values is None

    async def test_row_absent_after_forced_rollback(self, session: AsyncSession):
        actor = await self._make_actor(session)

        await audit(
            session,
            actor=actor,
            action="static.deleted",
            target_type="static",
            target_id="doomed",
            target_label="Doomed",
        )
        await session.rollback()
        await session.commit()

        rows = (await session.execute(select(AuditLog))).scalars().all()
        assert rows == []

    async def test_update_shape_stores_changed_fields_only(self, session: AsyncSession):
        actor = await self._make_actor(session)

        await audit(
            session,
            actor=actor,
            action="static.updated",
            target_type="static",
            target_id="s1",
            target_label="Static One",
            old={"name": "Old Name", "is_public": True, "webhook_url": "https://hook"},
            new={"name": "New Name", "is_public": True, "webhook_url": "https://hook2"},
        )
        await session.commit()

        row = (await session.execute(select(AuditLog))).scalar_one()
        assert row.old_values == {"name": "Old Name"}
        assert row.new_values == {"name": "New Name"}

    async def test_no_request_falls_back_to_system(self, session: AsyncSession):
        actor = await self._make_actor(session)

        await audit(
            session,
            actor=actor,
            action="catalog.synced",
            target_type="catalog",
            target_id="catalog",
            target_label="Collection catalog",
        )
        await session.commit()

        row = (await session.execute(select(AuditLog))).scalar_one()
        assert row.credential == "system"
        assert row.request_id is None

    async def test_client_controlled_ids_capped_to_column_width(self, session: AsyncSession):
        actor = await self._make_actor(session)

        await audit(
            session,
            actor=actor,
            action="user.updated",
            target_type="user",
            target_id="u1",
            target_label="T" * 500,
            request=make_request(
                headers={"X-View-As": "v" * 100},
                state={"auth_credential": "cookie", "request_id": "r" * 100},
            ),
        )
        await session.commit()

        row = (await session.execute(select(AuditLog))).scalar_one()
        assert len(row.target_label) == 200
        assert len(row.request_id) == 64
        assert len(row.impersonating_user_id) == 36

    async def test_non_admin_actor_view_as_header_not_recorded(self, session: AsyncSession):
        """X-View-As is client-asserted; a non-admin can't legitimately
        impersonate, so their header must never reach the forensic log."""
        actor = await self._make_actor(session, is_admin=False)

        await audit(
            session,
            actor=actor,
            action="loot.logged",
            target_type="loot",
            target_id="l1",
            target_label="Loot Entry",
            request=make_request(
                headers={"X-View-As": "forged-target"},
                state={"auth_credential": "cookie", "request_id": "req-x"},
            ),
        )
        await session.commit()

        row = (await session.execute(select(AuditLog))).scalar_one()
        assert row.impersonating_user_id is None
        assert row.request_id == "req-x"

    async def test_ordering_newest_first(self, session: AsyncSession):
        actor = await self._make_actor(session)

        for index in range(2):
            await audit(
                session,
                actor=actor,
                action="static.updated",
                target_type="static",
                target_id=f"s{index}",
                target_label=f"Static {index}",
            )
            await session.commit()
            # Windows clock ticks at 15.6 ms — without this, both ISO
            # timestamps can be identical and the ordering assert flakes.
            time.sleep(0.02)

        rows = (
            (
                await session.execute(
                    select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
                )
            )
            .scalars()
            .all()
        )
        assert [r.target_id for r in rows] == ["s1", "s0"]
        assert rows[0].created_at > rows[1].created_at


@pytest.mark.asyncio
class TestCredentialThreading:
    """_validate_jwt/_validate_api_key must stamp request.state.auth_credential."""

    async def test_jwt_cookie_stamps_cookie(self, session: AsyncSession, test_user: User):
        from app.auth_utils import create_access_token

        request = make_request(cookies={"access_token": create_access_token(test_user.id)})
        user = await get_current_user(request, credentials=None, session=session)
        assert user.id == test_user.id
        assert request.state.auth_credential == "cookie"

    async def test_api_key_stamps_api_key(self, session: AsyncSession, test_user: User):
        raw_key = "xrp_" + "ab" * 20
        session.add(
            ApiKey(
                id=str(uuid.uuid4()),
                user_id=test_user.id,
                key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
                key_prefix=raw_key[:12],
                name="threading test",
                scopes=[],
                is_active=True,
                created_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        await session.commit()

        request = make_request()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=raw_key)
        user = await get_current_user(request, credentials=credentials, session=session)
        assert user.id == test_user.id
        assert request.state.auth_credential == "api_key"


@pytest.mark.asyncio
class TestErrorReportRequestIdRegression:
    """Before AD1a, ErrorReport.context['request_id'] was always None because
    RequestIDMiddleware never set request.state. Exercise the REAL middleware +
    the REAL exception handlers + the REAL capture path end to end."""

    async def test_captured_error_report_carries_request_id(self, engine):
        app = FastAPI()
        register_exception_handlers(app)
        app.add_middleware(RequestIDMiddleware)

        @app.get("/boom")
        async def boom():
            raise ExternalServiceError("lodestone", "kaboom")

        test_session_maker = async_sessionmaker(engine, expire_on_commit=False)

        with patch("app.database.async_session_maker", test_session_maker):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as probe_client:
                response = await probe_client.get(
                    "/boom", headers={"X-Request-ID": "trace-me-42"}
                )
                assert response.status_code == 502

                # _capture_error_report is fire-and-forget; let the task run.
                report = None
                for _ in range(50):
                    await asyncio.sleep(0.02)
                    async with test_session_maker() as check_session:
                        report = (
                            await check_session.execute(select(ErrorReport))
                        ).scalar_one_or_none()
                    if report is not None:
                        break

        assert report is not None, "error report was never captured"
        assert report.context["request_id"] == "trace-me-42"
