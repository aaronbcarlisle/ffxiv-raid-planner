"""PROV-1 PV-1: provenance columns, mapper wiring and the provenance service.

Covers the three tier models' `created_by` relationships (vet I-1), the
`logged_via` / `request_api_key_id` helpers, the `_validate_api_key` key id
(B16), and `resolve_entry_provenance` / `resolve_batch_provenance` (R-PV-4,
R-PV-5). No router is wired in this task.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Request
from sqlalchemy.orm import configure_mappers

from app.dependencies import _validate_api_key
from app.models import (
    LootLogEntry,
    MaterialLogEntry,
    PageLedgerEntry,
    StaticCharacterRegistration,
)
from app.services.provenance import (
    CHARACTER_SOURCE_DEFAULT,
    CHARACTER_SOURCE_EXPLICIT,
    LOGGED_VIA_API_KEY,
    LOGGED_VIA_WEB,
    logged_via,
    request_api_key_id,
    resolve_batch_provenance,
    resolve_entry_provenance,
)
from tests.factories import (
    create_loot_log_entry,
    create_material_log_entry,
    create_page_ledger_entry,
    create_player_character,
    create_player_profile,
    create_snapshot_player,
    create_static_character_registration,
    create_static_group,
)

BAD_REGISTRATION_DETAIL = (
    "Character registration not found or does not belong to this player/static"
)


def make_request(state: dict | None = None) -> Request:
    """Fabricate a starlette Request carrying a `state`, as test_audit_helper does."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "state": dict(state or {}),
    }
    return Request(scope)


WEB = {"auth_credential": "cookie"}


# ---------------------------------------------------------------------------
# Mappers (vet I-1)
# ---------------------------------------------------------------------------


class TestMappers:
    def test_configure_mappers_succeeds(self):
        configure_mappers()

    @pytest.mark.parametrize("model", [LootLogEntry, MaterialLogEntry, PageLedgerEntry])
    def test_created_by_names_created_by_user_id(self, model):
        configure_mappers()
        assert model.created_by.property.local_columns == {model.__table__.c.created_by_user_id}

    async def test_log_routes_return_200_with_created_by_username(
        self, client, session, test_user, test_group, test_tier, auth_headers
    ):
        player = await create_snapshot_player(session, test_tier, name="Seeded")
        loot = await create_loot_log_entry(session, test_tier, player, test_user)
        material = await create_material_log_entry(session, test_tier, player, test_user)
        page = await create_page_ledger_entry(session, test_tier, player, test_user)
        for row in (loot, material, page):
            row.recipient_user_id = test_user.id
        await session.flush()

        base = f"/api/static-groups/{test_group.id}/tiers/{test_tier.tier_id}"
        for suffix in ("loot-log", "material-log", "page-ledger"):
            response = await client.get(f"{base}/{suffix}", headers=auth_headers)
            assert response.status_code == 200, (suffix, response.text)
            body = response.json()
            assert len(body) == 1
            assert body[0]["createdByUsername"] == test_user.discord_username


# ---------------------------------------------------------------------------
# logged_via / request_api_key_id (R-PV-2)
# ---------------------------------------------------------------------------


class TestRequestHelpers:
    def test_cookie_is_web_with_no_key(self):
        request = make_request({"auth_credential": "cookie"})
        assert logged_via(request) == LOGGED_VIA_WEB == "web"
        assert request_api_key_id(request) is None

    def test_api_key_with_id(self):
        request = make_request({"auth_credential": "api_key", "api_key_id": "key-1"})
        assert logged_via(request) == LOGGED_VIA_API_KEY == "api_key"
        assert request_api_key_id(request) == "key-1"

    def test_api_key_without_id_raises(self):
        request = make_request({"auth_credential": "api_key"})
        assert logged_via(request) == "api_key"
        with pytest.raises(RuntimeError):
            request_api_key_id(request)

    def test_unset_credential_raises(self):
        request = make_request()
        with pytest.raises(RuntimeError, match="write provenance: request has no auth credential"):
            logged_via(request)
        with pytest.raises(RuntimeError):
            request_api_key_id(request)

    def test_other_credential_raises(self):
        with pytest.raises(RuntimeError):
            logged_via(make_request({"auth_credential": "system"}))

    def test_cookie_ignores_a_stray_key_id(self):
        request = make_request({"auth_credential": "cookie", "api_key_id": "stale"})
        assert request_api_key_id(request) is None


class TestValidateApiKeySetsKeyId:
    async def test_state_carries_the_minted_keys_id(self, client, session, test_user, auth_headers):
        created = await client.post(
            "/api/auth/api-keys", json={"name": "PV-1 key"}, headers=auth_headers
        )
        assert created.status_code == 201
        raw_key, key_id = created.json()["key"], created.json()["id"]

        request = make_request()
        user = await _validate_api_key(raw_key, session, request)

        assert user.id == test_user.id
        assert request.state.auth_credential == "api_key"
        assert request.state.api_key_id == key_id


# ---------------------------------------------------------------------------
# resolve_entry_provenance (R-PV-4)
# ---------------------------------------------------------------------------


@pytest.fixture
async def claimed_card(session, test_user, test_group, test_tier):
    """A roster card claimed by `test_user`, in `test_group`."""
    player = await create_snapshot_player(session, test_tier, name="Claimed")
    player.user_id = test_user.id
    await session.flush()
    return player


async def _resolve(session, player, group, request=None, **kwargs):
    return await resolve_entry_provenance(
        session,
        request or make_request(WEB),
        static_group_id=group.id,
        player=player,
        **kwargs,
    )


class TestResolveEntryProvenanceDefault:
    async def test_claimed_card_defaults_to_primary_manual_registration(
        self, session, test_user, test_group, claimed_card
    ):
        main = await create_static_character_registration(
            session,
            test_group,
            claimed_card,
            manual_character_name="Main Name",
            is_primary_for_static=True,
        )
        await create_static_character_registration(
            session, test_group, claimed_card, manual_character_name="Alt Name"
        )

        prov = await _resolve(session, claimed_card, test_group)

        assert prov.logged_via == "web"
        assert prov.api_key_id is None
        assert prov.recipient_user_id == test_user.id
        assert prov.recipient_character_registration_id == main.id
        assert prov.recipient_character_name == "Main Name"
        assert prov.recipient_character_source == CHARACTER_SOURCE_DEFAULT == "default"

    async def test_api_key_request_carries_the_key_id(self, session, test_group, claimed_card):
        request = make_request({"auth_credential": "api_key", "api_key_id": "key-9"})
        prov = await _resolve(session, claimed_card, test_group, request=request)
        assert prov.logged_via == "api_key"
        assert prov.api_key_id == "key-9"

    async def test_primary_linked_to_player_hub_character_uses_its_name(
        self, session, test_user, test_group, claimed_card
    ):
        profile = await create_player_profile(session, test_user)
        hub = await create_player_character(session, profile, name="Hub Hero")
        reg = await create_static_character_registration(
            session, test_group, claimed_card, player_character=hub, is_primary_for_static=True
        )

        prov = await _resolve(session, claimed_card, test_group)

        assert prov.recipient_character_registration_id == reg.id
        assert prov.recipient_character_name == "Hub Hero"
        assert prov.recipient_character_source == "default"

    async def test_only_an_alt_resolves_to_nothing(self, session, test_group, claimed_card):
        await create_static_character_registration(
            session, test_group, claimed_card, manual_character_name="Alt Only"
        )
        prov = await _resolve(session, claimed_card, test_group)
        assert prov.recipient_character_registration_id is None
        assert prov.recipient_character_name is None
        assert prov.recipient_character_source is None

    async def test_no_registration_resolves_to_nothing(
        self, session, test_user, test_group, claimed_card
    ):
        prov = await _resolve(session, claimed_card, test_group)
        assert prov.recipient_user_id == test_user.id
        assert prov.recipient_character_registration_id is None
        assert prov.recipient_character_name is None
        assert prov.recipient_character_source is None

    async def test_unclaimed_card_has_no_recipient_user(self, session, test_group, test_tier):
        card = await create_snapshot_player(session, test_tier, name="Unclaimed")
        await create_static_character_registration(
            session,
            test_group,
            card,
            manual_character_name="Floating Main",
            is_primary_for_static=True,
        )
        prov = await _resolve(session, card, test_group)
        assert prov.recipient_user_id is None
        assert prov.recipient_character_name == "Floating Main"
        assert prov.recipient_character_source == "default"

    async def test_two_primaries_earliest_created_at_wins(self, session, test_group, claimed_card):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        for reg_id, name, offset in (("reg-a", "Later", 5), ("reg-b", "Earlier", 1)):
            session.add(
                StaticCharacterRegistration(
                    id=reg_id,
                    static_group_id=test_group.id,
                    snapshot_player_id=claimed_card.id,
                    manual_character_name=name,
                    is_primary_for_static=True,
                    created_at=(base + timedelta(days=offset)).isoformat(),
                    updated_at=base.isoformat(),
                )
            )
        await session.flush()

        prov = await _resolve(session, claimed_card, test_group)

        # "reg-a" sorts first by id but is the later row: created_at decides.
        assert prov.recipient_character_registration_id == "reg-b"
        assert prov.recipient_character_name == "Earlier"

    async def test_equal_created_at_lowest_id_wins(self, session, test_group, claimed_card):
        stamp = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat()
        for reg_id, name in (("reg-z", "Zed"), ("reg-c", "Cee"), ("reg-m", "Em")):
            session.add(
                StaticCharacterRegistration(
                    id=reg_id,
                    static_group_id=test_group.id,
                    snapshot_player_id=claimed_card.id,
                    manual_character_name=name,
                    is_primary_for_static=True,
                    created_at=stamp,
                    updated_at=stamp,
                )
            )
        await session.flush()

        prov = await _resolve(session, claimed_card, test_group)

        assert prov.recipient_character_registration_id == "reg-c"
        assert prov.recipient_character_name == "Cee"

    async def test_primary_from_another_static_is_ignored(
        self, session, test_user, test_group, claimed_card
    ):
        other_group = await create_static_group(
            session, test_user, name="Other Static", share_code="OTHER1"
        )
        await create_static_character_registration(
            session,
            other_group,
            claimed_card,
            manual_character_name="Elsewhere",
            is_primary_for_static=True,
        )

        prov = await _resolve(session, claimed_card, test_group)

        assert prov.recipient_character_registration_id is None
        assert prov.recipient_character_name is None
        assert prov.recipient_character_source is None


class TestResolveEntryProvenanceExplicit:
    async def test_explicit_alt_beats_the_primary_and_takes_its_name(
        self, session, test_group, claimed_card
    ):
        await create_static_character_registration(
            session,
            test_group,
            claimed_card,
            manual_character_name="Main Name",
            is_primary_for_static=True,
        )
        alt = await create_static_character_registration(
            session, test_group, claimed_card, manual_character_name="Alt Name"
        )

        prov = await _resolve(session, claimed_card, test_group, registration_id=alt.id)

        assert prov.recipient_character_registration_id == alt.id
        assert prov.recipient_character_name == "Alt Name"
        assert prov.recipient_character_source == CHARACTER_SOURCE_EXPLICIT == "explicit"

    async def test_explicit_alt_linked_to_hub_takes_the_hub_name(
        self, session, test_user, test_group, claimed_card
    ):
        profile = await create_player_profile(session, test_user)
        hub = await create_player_character(session, profile, name="Hub Alt", is_main=False)
        alt = await create_static_character_registration(
            session, test_group, claimed_card, player_character=hub
        )

        prov = await _resolve(session, claimed_card, test_group, registration_id=alt.id)

        assert prov.recipient_character_name == "Hub Alt"
        assert prov.recipient_character_source == "explicit"

    async def test_explicit_registration_with_a_name_keeps_that_name(
        self, session, test_group, claimed_card
    ):
        reg = await create_static_character_registration(
            session,
            test_group,
            claimed_card,
            manual_character_name="Registered",
            is_primary_for_static=True,
        )

        prov = await _resolve(
            session, claimed_card, test_group, registration_id=reg.id, character_name="Sent Name"
        )

        assert prov.recipient_character_registration_id == reg.id
        assert prov.recipient_character_name == "Sent Name"
        assert prov.recipient_character_source == "explicit"

    async def test_explicit_name_only_keeps_registration_null(
        self, session, test_group, claimed_card
    ):
        await create_static_character_registration(
            session,
            test_group,
            claimed_card,
            manual_character_name="Main Name",
            is_primary_for_static=True,
        )

        prov = await _resolve(session, claimed_card, test_group, character_name="Typed Name")

        assert prov.recipient_character_registration_id is None
        assert prov.recipient_character_name == "Typed Name"
        assert prov.recipient_character_source == "explicit"

    async def test_another_cards_registration_is_a_400(
        self, session, test_group, test_tier, claimed_card
    ):
        other_card = await create_snapshot_player(session, test_tier, name="Someone Else")
        foreign = await create_static_character_registration(
            session,
            test_group,
            other_card,
            manual_character_name="Not Yours",
            is_primary_for_static=True,
        )

        with pytest.raises(HTTPException) as exc:
            await _resolve(session, claimed_card, test_group, registration_id=foreign.id)

        assert exc.value.status_code == 400
        assert exc.value.detail == BAD_REGISTRATION_DETAIL

    async def test_unknown_registration_is_a_400(self, session, test_group, claimed_card):
        with pytest.raises(HTTPException) as exc:
            await _resolve(session, claimed_card, test_group, registration_id=str(uuid.uuid4()))
        assert exc.value.status_code == 400
        assert exc.value.detail == BAD_REGISTRATION_DETAIL


# ---------------------------------------------------------------------------
# resolve_batch_provenance (R-PV-5, vet I-2)
# ---------------------------------------------------------------------------


class TestResolveBatchProvenance:
    async def test_three_cards_primary_none_unclaimed(
        self, session, test_user, test_group, test_tier
    ):
        with_main = await create_snapshot_player(session, test_tier, name="With Main")
        with_main.user_id = test_user.id
        bare = await create_snapshot_player(session, test_tier, name="Bare")
        bare.user_id = test_user.id
        unclaimed = await create_snapshot_player(session, test_tier, name="Unclaimed")
        await session.flush()
        main = await create_static_character_registration(
            session,
            test_group,
            with_main,
            manual_character_name="Batch Main",
            is_primary_for_static=True,
        )

        result = await resolve_batch_provenance(
            session,
            make_request(WEB),
            static_group_id=test_group.id,
            players=[with_main, bare, unclaimed],
        )

        assert set(result) == {with_main.id, bare.id, unclaimed.id}
        assert result[with_main.id].recipient_user_id == test_user.id
        assert result[with_main.id].recipient_character_registration_id == main.id
        assert result[with_main.id].recipient_character_name == "Batch Main"
        assert result[with_main.id].recipient_character_source == "default"
        assert result[bare.id].recipient_user_id == test_user.id
        assert result[bare.id].recipient_character_registration_id is None
        assert result[bare.id].recipient_character_source is None
        assert result[unclaimed.id].recipient_user_id is None
        assert result[unclaimed.id].recipient_character_name is None
        assert result[unclaimed.id].recipient_character_source is None
        assert {p.logged_via for p in result.values()} == {"web"}

    async def test_statement_count_is_fixed_whatever_the_player_count(
        self, session, engine, test_user, test_group, test_tier, count_statements
    ):
        profile = await create_player_profile(session, test_user)
        hub = await create_player_character(session, profile, name="Hub Main")
        first = await create_snapshot_player(session, test_tier, name="First")
        second = await create_snapshot_player(session, test_tier, name="Second")
        third = await create_snapshot_player(session, test_tier, name="Third")
        await create_static_character_registration(
            session, test_group, first, player_character=hub, is_primary_for_static=True
        )
        await create_static_character_registration(
            session, test_group, second, manual_character_name="Manual", is_primary_for_static=True
        )
        await session.flush()
        request = make_request(WEB)

        with count_statements(engine) as one:
            await resolve_batch_provenance(
                session, request, static_group_id=test_group.id, players=[first]
            )
        with count_statements(engine) as three:
            await resolve_batch_provenance(
                session, request, static_group_id=test_group.id, players=[first, second, third]
            )

        assert one.n >= 1
        assert one.n <= 2  # one registrations SELECT + one PlayerCharacter SELECT
        assert three.n == one.n
