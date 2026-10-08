"""Token-count privacy (S2a-1, R-S1-19): the flag on PUT /api/player/profile and
the `count_visibility` gate the count-carrying reads apply.

The rule: a viewer sees no counts but their own; a member, lead, owner or admin
sees every count except those of members whose flag is set; a caller always
sees their own. Hidden counts are hidden from leads, owners and admins alike.
"""

import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.auth_utils import create_access_token
from app.models import (
    MemberRole,
    MountFarmProgress,
    PlayerCollectionSnapshot,
    PlayerProfile,
    User,
)
from app.models.player_collection_intent import PlayerCollectionIntent
from app.services.collection_records import count_visibility
from app.services.collection_suggestion_service import compute_suggestions, dossier_farm_match
from tests.factories import (
    create_catalog_item,
    create_claimed_card,
    create_collection_goal,
    create_membership,
    create_participant_state,
    create_player_character,
    create_player_profile,
    create_static_group,
    create_tier_snapshot,
    create_user,
)

pytestmark = pytest.mark.asyncio

ROLES = [r.value for r in MemberRole]


async def _flagged(session, user: User, *, hidden: bool) -> None:
    profile = await create_player_profile(session, user)
    profile.hide_collection_counts = hidden
    await session.flush()


class TestProfileFlag:
    async def test_put_sets_only_the_callers_flag(
        self, client, session, auth_headers, test_user, test_user_2
    ):
        other = await create_player_profile(session, test_user_2)
        await session.commit()

        response = await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": True}
        )
        assert response.status_code == 200
        assert response.json()["hideCollectionCounts"] is True

        rows = (await session.execute(select(PlayerProfile))).scalars().all()
        flags = {p.user_id: p.hide_collection_counts for p in rows}
        assert flags[test_user.id] is True
        assert flags[test_user_2.id] is False
        assert other.hide_collection_counts is False

    async def test_omitting_the_field_leaves_it_unchanged(self, client, auth_headers):
        await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": True}
        )
        response = await client.put("/api/player/profile", headers=auth_headers, json={"bio": "hi"})
        assert response.status_code == 200
        assert response.json()["hideCollectionCounts"] is True

        response = await client.put(
            "/api/player/profile", headers=auth_headers, json={"hideCollectionCounts": False}
        )
        assert response.json()["hideCollectionCounts"] is False

    async def test_get_carries_the_flag_default_false(self, client, auth_headers):
        response = await client.get("/api/player/profile", headers=auth_headers)
        assert response.json()["hideCollectionCounts"] is False


class TestCountVisibility:
    async def _setup(self, session, *, hidden: bool):
        owner = await create_user(session, discord_id="1001", discord_username="o")
        group = await create_static_group(session, owner)
        target = await create_user(session, discord_id="1002", discord_username="t")
        await create_membership(session, target, group)
        await _flagged(session, target, hidden=hidden)
        return group, target

    async def _visible(self, session, group, viewer_id, role, user_ids):
        return await count_visibility(
            session,
            static_group_id=group.id,
            viewer_user_id=viewer_id,
            viewer_role=role,
            user_ids=user_ids,
        )

    @pytest.mark.parametrize("role", ["member", "lead", "owner"])
    async def test_non_viewers_see_unflagged_counts(self, session, role):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, role, [target.id]) == {target.id}

    @pytest.mark.parametrize("role", ["member", "lead", "owner"])
    async def test_flag_hides_from_every_non_viewer_including_leads_and_owners(
        self, session, role
    ):
        group, target = await self._setup(session, hidden=True)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, role, [target.id]) == set()

    async def test_admin_acting_as_owner_is_hidden_from_too(self, session):
        group, target = await self._setup(session, hidden=True)
        admin = await create_user(session, discord_id="1004", discord_username="a")
        admin.is_admin = True
        await session.flush()
        # An admin acts with the owner role `require_membership(...).role` gives.
        assert await self._visible(session, group, admin.id, "owner", [target.id]) == set()

    @pytest.mark.parametrize("hidden", [False, True])
    async def test_viewer_sees_no_counts_but_their_own(self, session, hidden):
        group, target = await self._setup(session, hidden=hidden)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        await create_membership(session, viewer, group, role=MemberRole.VIEWER)
        await _flagged(session, viewer, hidden=hidden)
        assert await self._visible(session, group, viewer.id, "viewer", [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, "viewer", [target.id, viewer.id]
        ) == {viewer.id}

    async def test_no_role_sees_only_their_own(self, session):
        # A share-code or non-member reader has no role (get_user_role_for_response -> None).
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, None, [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, None, [target.id, viewer.id]
        ) == {viewer.id}

    async def test_unknown_role_sees_only_their_own(self, session):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "bogus", [target.id]) == set()
        assert await self._visible(
            session, group, viewer.id, "bogus", [target.id, viewer.id]
        ) == {viewer.id}

    @pytest.mark.parametrize("role", ROLES)
    async def test_a_caller_always_sees_their_own_even_when_flagged(self, session, role):
        group, target = await self._setup(session, hidden=True)
        assert await self._visible(session, group, target.id, role, [target.id]) == {target.id}

    async def test_user_without_a_profile_has_no_flag(self, session):
        group, _ = await self._setup(session, hidden=True)
        bare = await create_user(session, discord_id="1005", discord_username="b")
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "member", [bare.id]) == {bare.id}
        assert await self._visible(session, group, viewer.id, "viewer", [bare.id]) == set()

    async def test_mixed_users_and_enum_role(self, session):
        group, hidden_user = await self._setup(session, hidden=True)
        shown = await create_user(session, discord_id="1006", discord_username="s")
        await _flagged(session, shown, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        visible = await self._visible(
            session, group, viewer.id, MemberRole.LEAD, [hidden_user.id, shown.id]
        )
        assert visible == {shown.id}

    async def test_empty_input_and_one_query(self, session, engine, count_statements):
        group, target = await self._setup(session, hidden=False)
        viewer = await create_user(session, discord_id="1003", discord_username="v")
        assert await self._visible(session, group, viewer.id, "member", []) == set()
        others = [
            (await create_user(session, discord_id=f"20{i}", discord_username=f"u{i}")).id
            for i in range(5)
        ]
        with count_statements(engine) as counts:
            await self._visible(session, group, viewer.id, "member", [target.id, *others])
        assert counts.n == 1


# ── The gated reads (F3, criterion 12) ────────────────────────────────────────
#
# One static: an owner, a lead, a member whose flag is set ("hidden"), a member
# whose flag is not ("shown"), and a viewer. Every count-carrying read is asked
# by each of them; a viewer sees only states, everyone else sees every count but
# a flagged member's, and a caller always sees their own.

TRIAL = "dt-valigarmanda"  # exchange cost 99 in the mount-farm catalog
COST = 10
READERS = ["owner", "lead", "hidden", "shown", "viewer"]
RANKS = {"owner": 1, "hidden": 2, "shown": 3}
# What each member's count is, on the participant rows / records.
GOAL_COUNTS = {"owner": 3, "hidden": 12, "shown": 11}
# Totems on the legacy mount-farm rows (hidden and shown can buy; lead is close).
TOTEMS = {"owner": 10, "lead": 80, "hidden": 99, "shown": 99}


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _sees(reader: str, target: str) -> bool:
    """Whether `reader` may see `target`'s count in this world."""
    if reader == target:
        return True
    return reader != "viewer" and target != "hidden"


async def _world(session) -> SimpleNamespace:
    users = {
        "owner": await create_user(session, discord_id="3001", discord_username="owner"),
        "lead": await create_user(session, discord_id="3002", discord_username="lead"),
        "hidden": await create_user(session, discord_id="3003", discord_username="hidden"),
        "shown": await create_user(session, discord_id="3004", discord_username="shown"),
        "viewer": await create_user(session, discord_id="3005", discord_username="viewer"),
    }
    group = await create_static_group(session, users["owner"])
    for name, role in (
        ("lead", MemberRole.LEAD),
        ("hidden", MemberRole.MEMBER),
        ("shown", MemberRole.MEMBER),
        ("viewer", MemberRole.VIEWER),
    ):
        await create_membership(session, users[name], group, role=role)

    catalog = await create_catalog_item(session, name="Gated Mount")
    catalog.token_cost = COST
    goal = await create_collection_goal(session, group, users["owner"], title="Gated Farm")
    goal.catalog_item_id = catalog.id
    goal.token_cost = COST

    tier = await create_tier_snapshot(session, group)
    profiles = {}
    for name in ("hidden", "shown"):
        profile = await create_player_profile(session, users[name])
        profile.hide_collection_counts = name == "hidden"
        main = await create_player_character(session, profile, name=f"Main {name}")
        await create_claimed_card(session, group, users[name], main, tier=tier)
        session.add(
            PlayerCollectionSnapshot(
                id=str(uuid.uuid4()),
                profile_id=profile.id,
                character_id=main.id,
                catalog_item_id=catalog.id,
                ownership_state="missing",
                token_count=GOAL_COUNTS[name],
                source="plugin",
                confidence="high",
                updated_at="2026-01-01T00:00:00+00:00",
                state_changed_at="2026-01-01T00:00:00+00:00",
                token_count_updated_at="2026-01-01T00:00:00+00:00",
            )
        )
        profiles[name] = (profile, main)

    for name in ("owner", "hidden", "shown"):
        row = await create_participant_state(session, goal, users[name], state="want")
        row.priority_rank = RANKS[name]
        if name == "owner":
            row.token_count = GOAL_COUNTS[name]

    for name, totems in TOTEMS.items():
        session.add(
            MountFarmProgress(
                id=str(uuid.uuid4()),
                static_group_id=group.id,
                user_id=users[name].id,
                trial_id=TRIAL,
                has_mount=False,
                wants_mount=True,
                totem_count=totems,
                updated_by_id=users["owner"].id,
            )
        )
    await session.commit()
    return SimpleNamespace(
        users=users, group=group, catalog=catalog, goal=goal, profiles=profiles
    )


class TestParticipantResponses:
    async def _list(self, client, w, reader: User) -> dict[str, dict]:
        response = await client.get(
            f"/api/static-groups/{w.group.id}/collection-goals/{w.goal.id}/participants",
            headers=_headers(reader),
        )
        assert response.status_code == 200, response.text
        by_id = {p["user_id"]: p for p in response.json()}
        return {name: by_id[w.users[name].id] for name in ("owner", "hidden", "shown")}

    @pytest.mark.parametrize("reader", READERS)
    async def test_list_participants_hides_flagged_counts_and_viewer_counts(
        self, async_client, session, reader
    ):
        w = await _world(session)
        rows = await self._list(async_client, w, w.users[reader])

        for target, row in rows.items():
            expected = GOAL_COUNTS[target] if _sees(reader, target) else None
            assert row["token_count"] == expected, (reader, target)
            if row["record"] is not None:
                assert row["record"]["token_count"] == expected, (reader, target)
            # A viewer gets no queue order; everyone else does.
            assert row["priority_rank"] == (None if reader == "viewer" else RANKS[target])
        # The world must exercise both outcomes.
        assert rows["hidden"]["record"] is not None and rows["shown"]["record"] is not None

    async def test_an_admin_who_is_a_viewer_member_reads_as_the_owner(self, async_client, session):
        w = await _world(session)
        viewer = w.users["viewer"]
        viewer.is_admin = True
        await session.commit()

        rows = await self._list(async_client, w, viewer)
        assert rows["shown"]["token_count"] == GOAL_COUNTS["shown"]
        assert rows["hidden"]["token_count"] is None  # hidden from admins too
        assert rows["hidden"]["priority_rank"] == RANKS["hidden"]

    @pytest.mark.parametrize("actor", ["owner", "lead"])
    async def test_a_leads_correction_response_hides_a_flagged_members_count(
        self, async_client, session, actor
    ):
        w = await _world(session)
        base = f"/api/static-groups/{w.group.id}/collection-goals/{w.goal.id}/participants"

        hidden = await async_client.patch(
            f"{base}/{w.users['hidden'].id}",
            json={"state": "want", "token_count": 4},
            headers=_headers(w.users[actor]),
        )
        assert hidden.status_code == 200, hidden.text
        assert hidden.json()["token_count"] is None
        assert (hidden.json()["record"] or {}).get("token_count") is None

        shown = await async_client.patch(
            f"{base}/{w.users['shown'].id}",
            json={"state": "want", "token_count": 4},
            headers=_headers(w.users[actor]),
        )
        assert shown.status_code == 200, shown.text
        assert shown.json()["token_count"] == 4

    @pytest.mark.parametrize("who", ["hidden", "shown"])
    async def test_a_members_own_patch_response_carries_their_count(
        self, async_client, session, who
    ):
        w = await _world(session)
        response = await async_client.patch(
            f"/api/static-groups/{w.group.id}/collection-goals/{w.goal.id}/participants",
            json={"state": "want", "token_count": 6},
            headers=_headers(w.users[who]),
        )
        assert response.status_code == 200, response.text
        assert response.json()["token_count"] == 6
        assert response.json()["record"]["token_count"] == 6

    async def test_an_owners_own_patch_response_keeps_their_count_and_rank(
        self, async_client, session
    ):
        w = await _world(session)
        response = await async_client.patch(
            f"/api/static-groups/{w.group.id}/collection-goals/{w.goal.id}/participants",
            json={"state": "want", "token_count": 5, "priority_rank": 9},
            headers=_headers(w.users["owner"]),
        )
        assert response.json()["token_count"] == 5
        assert response.json()["priority_rank"] == 9


class TestMountFarmReads:
    async def _get(self, client, w, reader: User) -> dict:
        response = await client.get(
            f"/api/static-groups/{w.group.id}/mount-farms?trial_ids={TRIAL}",
            headers=_headers(reader),
        )
        assert response.status_code == 200, response.text
        (trial,) = response.json()["trials"]
        return trial

    @pytest.mark.parametrize("reader", READERS)
    async def test_get_nulls_the_hidden_totem_counts(self, async_client, session, reader):
        w = await _world(session)
        trial = await self._get(async_client, w, w.users[reader])
        by_id = {m["userId"]: m for m in trial["memberProgress"]}

        for target, totems in TOTEMS.items():
            expected = totems if _sees(reader, target) else None
            assert by_id[w.users[target].id]["totemCount"] == expected, (reader, target)

    @pytest.mark.parametrize("reader", READERS)
    async def test_members_can_buy_counts_hidden_members_as_unknown_for_everyone(
        self, async_client, session, reader
    ):
        w = await _world(session)
        trial = await self._get(async_client, w, w.users[reader])
        # Shown can buy; hidden is unknown, not counted. A flagged caller's own
        # count is their own to see, so it counts in their own view.
        assert trial["membersCanBuy"] == (2 if reader == "hidden" else 1), reader

    async def test_a_member_without_progress_shows_no_count_when_hidden(
        self, async_client, session
    ):
        w = await _world(session)
        fresh = await create_user(session, discord_id="3010", discord_username="fresh")
        await create_membership(session, fresh, w.group, role=MemberRole.MEMBER)
        profile = await create_player_profile(session, fresh)
        profile.hide_collection_counts = True
        await session.commit()

        trial = await self._get(async_client, w, w.users["owner"])
        row = next(m for m in trial["memberProgress"] if m["userId"] == fresh.id)
        assert row["totemCount"] is None

    async def test_an_admin_who_is_a_viewer_member_reads_as_the_owner(self, async_client, session):
        w = await _world(session)
        viewer = w.users["viewer"]
        viewer.is_admin = True
        await session.commit()

        trial = await self._get(async_client, w, viewer)
        by_id = {m["userId"]: m["totemCount"] for m in trial["memberProgress"]}
        assert by_id[w.users["shown"].id] == TOTEMS["shown"]
        assert by_id[w.users["hidden"].id] is None

    @pytest.mark.parametrize("actor", ["owner", "lead"])
    async def test_progress_patch_response_hides_a_flagged_targets_count(
        self, async_client, session, actor
    ):
        w = await _world(session)
        url = f"/api/static-groups/{w.group.id}/mount-farms/progress"

        hidden = await async_client.patch(
            url,
            json={"trialId": TRIAL, "userId": w.users["hidden"].id, "totemCount": 7},
            headers=_headers(w.users[actor]),
        )
        assert hidden.status_code == 200, hidden.text
        assert hidden.json()["totemCount"] is None

        shown = await async_client.patch(
            url,
            json={"trialId": TRIAL, "userId": w.users["shown"].id, "totemCount": 7},
            headers=_headers(w.users[actor]),
        )
        assert shown.json()["totemCount"] == 7

    async def test_progress_patch_response_shows_the_callers_own_count(
        self, async_client, session
    ):
        w = await _world(session)
        response = await async_client.patch(
            f"/api/static-groups/{w.group.id}/mount-farms/progress",
            json={"trialId": TRIAL, "totemCount": 7},
            headers=_headers(w.users["hidden"]),
        )
        assert response.json()["totemCount"] == 7

    async def test_bulk_response_hides_a_flagged_targets_count(self, async_client, session):
        w = await _world(session)
        response = await async_client.put(
            f"/api/static-groups/{w.group.id}/mount-farms/progress/bulk",
            json={
                "updates": [
                    {"trialId": TRIAL, "userId": w.users["hidden"].id, "totemCount": 7},
                    {"trialId": TRIAL, "userId": w.users["shown"].id, "totemCount": 7},
                ]
            },
            headers=_headers(w.users["lead"]),
        )
        assert response.status_code == 200, response.text
        assert [r["totemCount"] for r in response.json()] == [None, 7]

    @pytest.mark.parametrize("reader", READERS)
    async def test_recommendations_keep_the_aggregates_with_hidden_as_unknown(
        self, async_client, session, reader
    ):
        w = await _world(session)
        response = await async_client.get(
            f"/api/static-groups/{w.group.id}/mount-farms/recommendations",
            headers=_headers(w.users[reader]),
        )
        assert response.status_code == 200, response.text
        (farm,) = response.json()
        # owner, lead, hidden, shown are missing and wanting. Shown can buy, the
        # lead is close (80 of 99); hidden is unknown unless the caller is hidden.
        own_hidden = reader == "hidden"
        assert farm["membersMissing"] == 4
        assert farm["membersWanting"] == 4
        assert farm["membersCanBuy"] == (2 if own_hidden else 1)
        assert farm["membersCloseToTarget"] == 1
        assert farm["score"] == 4 * 3.0 + 4 * 1.0 + 1 * 2.0 + farm["membersCanBuy"] * 1.5


class TestSuggestions:
    async def _get(self, client, w, reader: User) -> dict:
        response = await client.get(
            f"/api/static-groups/{w.group.id}/collection-suggestions",
            headers=_headers(reader),
        )
        assert response.status_code == 200, response.text
        (suggestion,) = response.json()
        return suggestion

    @pytest.mark.parametrize("reader", READERS)
    async def test_member_counts_can_buy_and_score_follow_the_gate(
        self, async_client, session, reader
    ):
        w = await _world(session)
        suggestion = await self._get(async_client, w, w.users[reader])
        by_id = {m["user_id"]: m for m in suggestion["members"]}

        for target in ("owner", "hidden", "shown"):
            entry = by_id[w.users[target].id]
            visible = _sees(reader, target)
            assert entry["token_count"] == (GOAL_COUNTS[target] if visible else None), (
                reader, target,
            )
            can_buy = visible and GOAL_COUNTS[target] >= COST
            assert entry["can_buy"] is can_buy, (reader, target)
            assert ("Can buy" in entry["reasons"]) is can_buy, (reader, target)

        # A hidden count scores as unknown: each count the reader may not see
        # drops that member's can-buy bonus (25) from the item's score.
        # The viewer sees no counts at all, so their score is the base.
        base = (await self._get(async_client, w, w.users["viewer"]))["suggested_farm_score"]
        visible_buys = sum(1 for t in ("hidden", "shown") if _sees(reader, t))
        assert suggestion["suggested_farm_score"] == base + 25.0 * visible_buys

    async def test_the_summary_line_names_no_one_who_cannot_be_seen_buying(
        self, async_client, session
    ):
        w = await _world(session)
        viewer_view = await self._get(async_client, w, w.users["viewer"])
        owner_view = await self._get(async_client, w, w.users["owner"])
        assert "Can buy" not in viewer_view["reason_summary"]
        assert "Can buy: shown" in owner_view["reason_summary"]
        assert "hidden" not in owner_view["reason_summary"].split("Can buy:")[1]

    async def test_participant_and_legacy_branches_are_gated_too(self, session):
        w = await _world(session)
        hidden = w.users["hidden"]
        # A second item: the hidden member has no record for it, only a manual row
        # (count at cost) and a legacy mount-farm row (totems at cost).
        manual = await create_catalog_item(session, name="Manual Mount")
        manual.token_cost = COST
        manual_goal = await create_collection_goal(session, w.group, w.users["owner"], title="M")
        manual_goal.catalog_item_id = manual.id
        manual_goal.token_cost = COST
        row = await create_participant_state(session, manual_goal, hidden, state="want")
        row.token_count = COST

        legacy = await create_catalog_item(session, name="Legacy Mount")
        legacy.token_cost = 99
        legacy.source_duty_key = TRIAL
        await session.commit()

        async def entries(role: str, reader: User):
            suggestions = await compute_suggestions(
                session, w.group.id, reader, viewer_role=role
            )
            return {
                s.catalog_item_name: {m.user_id: m for m in s.members} for s in suggestions
            }

        for role, reader in (("owner", w.users["owner"]), ("viewer", w.users["viewer"])):
            seen = await entries(role, reader)
            for item, extra_reasons in (
                ("Manual Mount", "Can buy"),
                ("Legacy Mount", "Can buy (legacy)"),
            ):
                entry = seen[item][hidden.id]
                assert entry.token_count is None, (role, item)
                assert entry.can_buy is False, (role, item)
                assert extra_reasons not in entry.reasons, (role, item)

        # The hidden member reading their own sees both.
        own = await entries("member", hidden)
        assert own["Manual Mount"][hidden.id].token_count == COST
        assert own["Manual Mount"][hidden.id].can_buy is True
        assert own["Legacy Mount"][hidden.id].token_count == TOTEMS["hidden"]
        assert "Can buy (legacy)" in own["Legacy Mount"][hidden.id].reasons

        # A reader the flag does not hide it from sees the shown member's legacy count.
        shown_view = await entries("owner", w.users["owner"])
        assert shown_view["Legacy Mount"][w.users["shown"].id].token_count == TOTEMS["shown"]


class TestExceptions:
    async def test_the_activity_log_carries_no_count(self, async_client, session):
        w = await _world(session)
        patched = await async_client.patch(
            f"/api/static-groups/{w.group.id}/mount-farms/progress",
            json={"trialId": TRIAL, "totemCount": 77},
            headers=_headers(w.users["hidden"]),
        )
        assert patched.status_code == 200, patched.text

        response = await async_client.get(
            f"/api/static-groups/{w.group.id}/activity-log", headers=_headers(w.users["viewer"])
        )
        assert response.status_code == 200, response.text
        items = response.json()
        assert any(i["event_type"] == "totem_updated" for i in items)
        for item in items:
            assert not [k for k in item if "count" in k.lower() or "totem" in k.lower()], item
            assert "77" not in item["label"]

    async def test_the_hub_catalog_returns_only_the_callers_own_counts(
        self, async_client, session
    ):
        w = await _world(session)
        for who in ("hidden", "shown"):
            response = await async_client.get(
                "/api/me/collection-catalog", headers=_headers(w.users[who])
            )
            assert response.status_code == 200, response.text
            entry = next(e for e in response.json() if e["catalog_item_id"] == w.catalog.id)
            # Their own count, flag or not, and never the other member's.
            other = "shown" if who == "hidden" else "hidden"
            assert entry["token_count"] == GOAL_COUNTS[who]
            assert entry["token_count"] != GOAL_COUNTS[other]

    async def test_the_hub_farm_suggestions_return_only_the_callers_own_progress(
        self, async_client, session
    ):
        w = await _world(session)
        for who in ("hidden", "shown", "viewer"):
            response = await async_client.get(
                "/api/player/collection-suggestions", headers=_headers(w.users[who])
            )
            assert response.status_code == 200, response.text
            counts = [s["currentCount"] for s in response.json()["suggestions"]]
            # The viewer has no progress row; the others see their own 99 only.
            assert counts == ([] if who == "viewer" else [TOTEMS[who]]), who

    async def test_the_dossier_match_reads_wants_only(self, session):
        w = await _world(session)
        profile, _ = w.profiles["hidden"]
        session.add(
            PlayerCollectionIntent(
                id=str(uuid.uuid4()),
                profile_id=profile.id,
                catalog_item_id=w.catalog.id,
                intent="hunting",
                priority="medium",
                visibility="dossier_public",
                updated_at="2026-01-01T00:00:00+00:00",
            )
        )
        await session.commit()

        match = await dossier_farm_match(session, w.group.id, profile.id)
        assert match["shared_goals"], "the world must produce a match"

        def keys(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    yield k
                    yield from keys(v)
            elif isinstance(value, list):
                for v in value:
                    yield from keys(v)

        assert not [k for k in keys(match) if "count" in k.lower() or "totem" in k.lower()]
