"""Tests for priority calculator service and priority endpoint"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.priority_calculator import (
    calculate_priority_score,
    get_priority_for_item,
    get_priority_for_ring,
    get_priority_for_upgrade_material,
    get_priority_for_universal_tomestone,
    calculate_floor_priority,
    calculate_all_floors_priority,
)
from tests.factories import create_snapshot_player, create_static_group, create_tier_snapshot


# ==================== Fixtures ====================


def _make_gear(slot: str, bis_source: str = "raid", has_item: bool = False, is_augmented: bool = False, item_name: str | None = None):
    """Helper to create a gear slot dict."""
    return {
        "slot": slot,
        "bisSource": bis_source,
        "hasItem": has_item,
        "isAugmented": is_augmented,
        "itemName": item_name,
    }


def _make_player(
    player_id: str,
    name: str,
    job: str,
    role: str,
    gear: list | None = None,
    loot_adjustment: int = 0,
    priority_modifier: int = 0,
    tome_weapon: dict | None = None,
):
    """Helper to create a player dict for the priority calculator."""
    return {
        "id": player_id,
        "name": name,
        "job": job,
        "role": role,
        "gear": gear or [],
        "lootAdjustment": loot_adjustment,
        "priorityModifier": priority_modifier,
        "tomeWeapon": tome_weapon or {"pursuing": False, "hasItem": False, "isAugmented": False},
    }


DEFAULT_SETTINGS = {
    "lootPriority": ["melee", "ranged", "caster", "tank", "healer"],
    "prioritySettings": {
        "mode": "role-based",
        "roleBasedConfig": {
            "roleOrder": ["melee", "ranged", "caster", "tank", "healer"],
        },
        "advancedOptions": {
            "useMultipliers": True,
            "rolePriorityMultiplier": 25,
            "gearNeededMultiplier": 10,
            "lootReceivedPenalty": 15,
            "useWeightedNeed": True,
            "useLootAdjustments": True,
            "showPriorityScores": True,
            "preset": "balanced",
        },
    },
}


# ==================== Unit Tests: Priority Calculator ====================


class TestCalculatePriorityScore:
    def test_role_based_scoring(self):
        """Melee should have highest priority in default role order."""
        melee = _make_player("1", "Rin", "DRG", "melee")
        healer = _make_player("2", "Kira", "WHM", "healer")

        melee_score = calculate_priority_score(melee, DEFAULT_SETTINGS)
        healer_score = calculate_priority_score(healer, DEFAULT_SETTINGS)

        # melee is index 0, healer is index 4
        # melee: (5 - 0) * 25 = 125
        # healer: (5 - 4) * 25 = 25
        assert melee_score > healer_score
        assert melee_score == 125
        assert healer_score == 25

    def test_gear_need_increases_score(self):
        """Players with more incomplete gear should score higher."""
        no_gear_need = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=True),
        ])
        has_gear_need = _make_player("2", "Yuki", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=False),  # needs head (weight 1.0)
            _make_gear("weapon", "raid", has_item=False),  # needs weapon (weight 3.0)
        ])

        score1 = calculate_priority_score(no_gear_need, DEFAULT_SETTINGS)
        score2 = calculate_priority_score(has_gear_need, DEFAULT_SETTINGS)

        # has_gear_need should be higher due to weighted need
        assert score2 > score1

    def test_disabled_mode_returns_zero(self):
        """Disabled mode should return 0 for all players."""
        settings = {"prioritySettings": {"mode": "disabled"}}
        player = _make_player("1", "Rin", "DRG", "melee")
        assert calculate_priority_score(player, settings) == 0

    def test_manual_planning_returns_zero(self):
        settings = {"prioritySettings": {"mode": "manual-planning"}}
        player = _make_player("1", "Rin", "DRG", "melee")
        assert calculate_priority_score(player, settings) == 0

    def test_loot_adjustment_modifies_score(self):
        """Positive loot adjustment should increase score (catch-up)."""
        normal = _make_player("1", "Rin", "DRG", "melee")
        boosted = _make_player("2", "Yuki", "DRG", "melee", loot_adjustment=2)

        score_normal = calculate_priority_score(normal, DEFAULT_SETTINGS)
        score_boosted = calculate_priority_score(boosted, DEFAULT_SETTINGS)

        # lootAdjustment=2, lootReceivedPenalty=15, so +30
        assert score_boosted == score_normal + 30

    def test_priority_modifier(self):
        """Player-level priority modifier should adjust score."""
        normal = _make_player("1", "Rin", "DRG", "melee")
        modified = _make_player("2", "Yuki", "DRG", "melee", priority_modifier=20)

        score_normal = calculate_priority_score(normal, DEFAULT_SETTINGS)
        score_modified = calculate_priority_score(modified, DEFAULT_SETTINGS)

        assert score_modified == score_normal + 20

    def test_job_modifier(self):
        """Job-level modifier from settings should adjust score."""
        settings = {
            **DEFAULT_SETTINGS,
            "jobPriorityModifiers": {"DRG": 10, "WHM": -5},
        }
        drg = _make_player("1", "Rin", "DRG", "melee")
        whm = _make_player("2", "Kira", "WHM", "healer")

        drg_score = calculate_priority_score(drg, settings)
        whm_score = calculate_priority_score(whm, settings)

        # DRG base 125 + 10 = 135
        # WHM base 25 - 5 = 20
        assert drg_score == 135
        assert whm_score == 20


class TestGetPriorityForItem:
    def test_filters_players_who_need_slot(self):
        """Only players with raid BiS and no item should appear."""
        needs_head = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=False),
        ])
        has_head = _make_player("2", "Kira", "WHM", "healer", gear=[
            _make_gear("head", "raid", has_item=True),
        ])
        tome_bis = _make_player("3", "Yuki", "BRD", "ranged", gear=[
            _make_gear("head", "tome", has_item=False),
        ])

        result = get_priority_for_item([needs_head, has_head, tome_bis], "head", DEFAULT_SETTINGS)
        assert len(result) == 1
        assert result[0]["playerId"] == "1"

    def test_sorted_by_score_descending(self):
        """Higher priority score should come first."""
        melee = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=False),
        ])
        healer = _make_player("2", "Kira", "WHM", "healer", gear=[
            _make_gear("head", "raid", has_item=False),
        ])

        result = get_priority_for_item([healer, melee], "head", DEFAULT_SETTINGS)
        assert len(result) == 2
        assert result[0]["playerId"] == "1"  # melee first
        assert result[1]["playerId"] == "2"  # healer second

    def test_alphabetical_tiebreaker(self):
        """Same-score players should be sorted alphabetically."""
        settings = {"prioritySettings": {"mode": "disabled"}}
        b_player = _make_player("1", "Beta", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=False),
        ])
        a_player = _make_player("2", "Alpha", "DRG", "melee", gear=[
            _make_gear("head", "raid", has_item=False),
        ])

        result = get_priority_for_item([b_player, a_player], "head", settings)
        assert result[0]["playerName"] == "Alpha"
        assert result[1]["playerName"] == "Beta"


class TestGetPriorityForRing:
    def test_either_ring_slot_qualifies(self):
        """Player needing either ring1 or ring2 should appear."""
        needs_ring1 = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("ring1", "raid", has_item=False),
            _make_gear("ring2", "raid", has_item=True),
        ])
        needs_ring2 = _make_player("2", "Kira", "WHM", "healer", gear=[
            _make_gear("ring1", "raid", has_item=True),
            _make_gear("ring2", "raid", has_item=False),
        ])
        has_both = _make_player("3", "Yuki", "BRD", "ranged", gear=[
            _make_gear("ring1", "raid", has_item=True),
            _make_gear("ring2", "raid", has_item=True),
        ])

        result = get_priority_for_ring([needs_ring1, needs_ring2, has_both], DEFAULT_SETTINGS)
        assert len(result) == 2
        player_ids = {r["playerId"] for r in result}
        assert player_ids == {"1", "2"}


class TestGetPriorityForUpgradeMaterial:
    def test_filters_by_material_type(self):
        """Only players with unaugmented tome gear for the material type should appear."""
        needs_glaze = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("earring", "tome", has_item=True, is_augmented=False, item_name="Aug. Earring"),
        ])
        no_need = _make_player("2", "Kira", "WHM", "healer", gear=[
            _make_gear("earring", "tome", has_item=True, is_augmented=True, item_name="Aug. Earring"),
        ])

        result = get_priority_for_upgrade_material(
            [needs_glaze, no_need], "glaze", DEFAULT_SETTINGS
        )
        assert len(result) == 1
        assert result[0]["playerId"] == "1"

    def test_solvent_includes_tome_weapon(self):
        """Solvent should include players needing tome weapon augmentation."""
        needs_solvent = _make_player(
            "1", "Rin", "DRG", "melee",
            gear=[],
            tome_weapon={"pursuing": True, "hasItem": True, "isAugmented": False},
        )

        result = get_priority_for_upgrade_material(
            [needs_solvent], "solvent", DEFAULT_SETTINGS
        )
        assert len(result) == 1

    def test_received_materials_reduce_need(self):
        """Already-received materials should reduce effective need."""
        player = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("earring", "tome", has_item=True, is_augmented=False, item_name="Aug. Earring"),
        ])
        material_log = [
            {"materialType": "glaze", "recipientPlayerId": "1", "slotAugmented": None},
        ]

        result = get_priority_for_upgrade_material(
            [player], "glaze", DEFAULT_SETTINGS, material_log
        )
        # Player received 1 glaze but needs 1, so net 0 -> filtered out
        assert len(result) == 0


class TestGetPriorityForUniversalTomestone:
    def test_pursuing_without_item(self):
        """Player pursuing tome weapon without having it should appear."""
        needs_tome = _make_player(
            "1", "Rin", "DRG", "melee",
            tome_weapon={"pursuing": True, "hasItem": False, "isAugmented": False},
        )
        has_tome = _make_player(
            "2", "Kira", "WHM", "healer",
            tome_weapon={"pursuing": True, "hasItem": True, "isAugmented": False},
        )
        not_pursuing = _make_player(
            "3", "Yuki", "BRD", "ranged",
            tome_weapon={"pursuing": False, "hasItem": False, "isAugmented": False},
        )

        result = get_priority_for_universal_tomestone(
            [needs_tome, has_tome, not_pursuing], DEFAULT_SETTINGS
        )
        assert len(result) == 1
        assert result[0]["playerId"] == "1"

    def test_already_received_filtered(self):
        """Player who received a universal tomestone should be filtered out."""
        player = _make_player(
            "1", "Rin", "DRG", "melee",
            tome_weapon={"pursuing": True, "hasItem": False, "isAugmented": False},
        )
        material_log = [
            {"materialType": "universal_tomestone", "recipientPlayerId": "1", "slotAugmented": None},
        ]

        result = get_priority_for_universal_tomestone(
            [player], DEFAULT_SETTINGS, material_log
        )
        assert len(result) == 0


class TestCalculateFloorPriority:
    def test_floor_1_returns_accessories(self):
        """Floor 1 should return earring, necklace, bracelet, and ring priorities."""
        player = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("earring", "raid", has_item=False),
            _make_gear("necklace", "raid", has_item=False),
            _make_gear("bracelet", "raid", has_item=False),
            _make_gear("ring1", "raid", has_item=False),
        ])

        result = calculate_floor_priority([player], 1, DEFAULT_SETTINGS)
        assert "earring" in result
        assert "necklace" in result
        assert "bracelet" in result
        assert "ring" in result

    def test_floor_4_returns_weapon(self):
        """Floor 4 should return weapon priority."""
        player = _make_player("1", "Rin", "DRG", "melee", gear=[
            _make_gear("weapon", "raid", has_item=False),
        ])

        result = calculate_floor_priority([player], 4, DEFAULT_SETTINGS)
        assert "weapon" in result
        assert len(result) == 1

    def test_all_floors_returns_all(self):
        result = calculate_all_floors_priority([], DEFAULT_SETTINGS)
        assert "floor1" in result
        assert "floor2" in result
        assert "floor3" in result
        assert "floor4" in result


# ==================== API Endpoint Tests ====================


class TestPriorityEndpoint:
    @pytest_asyncio.fixture
    async def setup_players(self, session: AsyncSession, test_tier):
        """Create test players with gear for priority testing."""
        melee = await create_snapshot_player(
            session, test_tier,
            name="Rin", job="DRG", role="melee", position="M1", sort_order=0,
            gear=[
                {"slot": "head", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "body", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "weapon", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "earring", "bisSource": "raid", "hasItem": False, "isAugmented": False},
            ],
        )
        healer = await create_snapshot_player(
            session, test_tier,
            name="Kira", job="WHM", role="healer", position="H1", sort_order=1,
            gear=[
                {"slot": "head", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "earring", "bisSource": "raid", "hasItem": False, "isAugmented": False},
            ],
        )
        await session.commit()
        return melee, healer

    @pytest.mark.asyncio
    async def test_get_priority_all_floors(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, setup_players
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "currentWeek" in data
        assert "tierFloors" in data
        assert data["tierFloors"] == ["M9S", "M10S", "M11S", "M12S"]
        assert len(data["players"]) == 2

        # Check all 4 floors present
        assert "floor1" in data["priority"]
        assert "floor2" in data["priority"]
        assert "floor3" in data["priority"]
        assert "floor4" in data["priority"]

    @pytest.mark.asyncio
    async def test_get_priority_single_floor(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, setup_players
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Only floor2 should be present
        assert "floor2" in data["priority"]
        assert "floor1" not in data["priority"]

        # Floor 2 has head, hands, feet
        floor2 = data["priority"]["floor2"]
        assert "head" in floor2

    @pytest.mark.asyncio
    async def test_get_priority_invalid_floor(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier
    ):
        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=5",
            headers=auth_headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_priority_melee_before_healer(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, setup_players
    ):
        """With default role order, melee should rank above healer for head."""
        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=2",
            headers=auth_headers,
        )
        data = response.json()
        head_priority = data["priority"]["floor2"]["head"]

        assert len(head_priority) == 2
        assert head_priority[0]["playerName"] == "Rin"  # melee
        assert head_priority[1]["playerName"] == "Kira"  # healer

    @pytest.mark.asyncio
    async def test_priority_excludes_substitutes(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, session: AsyncSession
    ):
        """Substitutes should not appear in priority lists."""
        from app.models import SnapshotPlayer
        import uuid

        sub = SnapshotPlayer(
            id=str(uuid.uuid4()),
            tier_snapshot_id=test_tier.id,
            name="SubPlayer",
            job="BRD",
            role="ranged",
            configured=True,
            is_substitute=True,
            gear=[{"slot": "head", "bisSource": "raid", "hasItem": False, "isAugmented": False}],
            tome_weapon={"pursuing": False, "hasItem": False, "isAugmented": False},
            sort_order=99,
        )
        session.add(sub)
        await session.commit()

        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority",
            headers=auth_headers,
        )
        data = response.json()

        # SubPlayer should not be in the player list
        player_names = {p["name"] for p in data["players"]}
        assert "SubPlayer" not in player_names

    @pytest.mark.asyncio
    async def test_priority_with_api_key(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, setup_players
    ):
        """Priority endpoint should work with API key authentication."""
        # Create an API key
        create_response = await client.post(
            "/api/auth/api-keys",
            json={"name": "Priority Test"},
            headers=auth_headers,
        )
        raw_key = create_response.json()["key"]

        # Use API key to fetch priority
        response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 200
        assert len(response.json()["players"]) == 2


# ==================== Loot Log mark_acquired Tests ====================


class TestMarkAcquired:
    """Tests for the mark_acquired flag on loot-log POST."""

    @pytest_asyncio.fixture
    async def player_with_gear(self, session: AsyncSession, test_tier):
        """Create a player with gear that needs raid BiS."""
        player = await create_snapshot_player(
            session, test_tier,
            name="Rin", job="DRG", role="melee", position="M1", sort_order=0,
            gear=[
                {"slot": "head", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "body", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "ring1", "bisSource": "raid", "hasItem": False, "isAugmented": False},
                {"slot": "ring2", "bisSource": "tome", "hasItem": True, "isAugmented": False},
            ],
        )
        await session.commit()
        return player

    @pytest.mark.asyncio
    async def test_mark_acquired_updates_gear(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_gear
    ):
        """Logging loot with markAcquired=true should set hasItem=true on the gear slot."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/loot-log",
            json={
                "weekNumber": 1,
                "floor": "M10S",
                "itemSlot": "head",
                "recipientPlayerId": player_with_gear.id,
                "method": "drop",
                "markAcquired": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        # Verify gear was updated via priority endpoint (which reads fresh gear data)
        priority_response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=2",
            headers=auth_headers,
        )
        data = priority_response.json()
        # Player should NOT appear in head priority anymore (they now have it)
        head_priority = data["priority"]["floor2"]["head"]
        player_ids = [e["playerId"] for e in head_priority]
        assert player_with_gear.id not in player_ids

    @pytest.mark.asyncio
    async def test_without_mark_acquired_does_not_update_gear(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_gear
    ):
        """Logging loot without markAcquired should NOT change gear state."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/loot-log",
            json={
                "weekNumber": 1,
                "floor": "M10S",
                "itemSlot": "head",
                "recipientPlayerId": player_with_gear.id,
                "method": "drop",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        # Player should still appear in head priority (gear unchanged)
        priority_response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=2",
            headers=auth_headers,
        )
        data = priority_response.json()
        head_priority = data["priority"]["floor2"]["head"]
        player_ids = [e["playerId"] for e in head_priority]
        assert player_with_gear.id in player_ids

    @pytest.mark.asyncio
    async def test_mark_acquired_smart_ring(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_gear
    ):
        """Ring logging should find the correct ring slot that needs raid BiS."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/loot-log",
            json={
                "weekNumber": 1,
                "floor": "M9S",
                "itemSlot": "ring1",
                "recipientPlayerId": player_with_gear.id,
                "method": "drop",
                "markAcquired": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        # ring1 has bisSource=raid, so it should be marked as acquired
        # ring2 has bisSource=tome, should remain unchanged
        priority_response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=1",
            headers=auth_headers,
        )
        data = priority_response.json()
        ring_priority = data["priority"]["floor1"]["ring"]
        player_ids = [e["playerId"] for e in ring_priority]
        # Player needed ring1 (raid) but not ring2 (tome), so after marking ring1 acquired
        # they should no longer appear in ring priority
        assert player_with_gear.id not in player_ids

    @pytest.mark.asyncio
    async def test_mark_acquired_skipped_for_extra_loot(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_gear
    ):
        """Extra/off-spec loot should not update gear even with markAcquired=true."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/loot-log",
            json={
                "weekNumber": 1,
                "floor": "M10S",
                "itemSlot": "head",
                "recipientPlayerId": player_with_gear.id,
                "method": "drop",
                "isExtra": True,
                "markAcquired": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        # Player should still appear in head priority (extra loot doesn't update gear)
        priority_response = await client.get(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/priority?floor=2",
            headers=auth_headers,
        )
        data = priority_response.json()
        head_priority = data["priority"]["floor2"]["head"]
        player_ids = [e["playerId"] for e in head_priority]
        assert player_with_gear.id in player_ids


class TestMarkAugmented:
    """Tests for the mark_augmented flag on material-log POST."""

    @pytest_asyncio.fixture
    async def player_with_tome_gear(self, session: AsyncSession, test_tier):
        """Create a player with unaugmented tome gear."""
        player = await create_snapshot_player(
            session, test_tier,
            name="Kira", job="WHM", role="healer", position="H1", sort_order=0,
            gear=[
                {"slot": "earring", "bisSource": "tome", "hasItem": True, "isAugmented": False, "itemName": "Aug. Earring"},
            ],
            tome_weapon={"pursuing": True, "hasItem": True, "isAugmented": False},
        )
        await session.commit()
        return player

    @pytest.mark.asyncio
    async def test_mark_augmented_updates_gear(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_tome_gear
    ):
        """Logging material with markAugmented=true should set isAugmented=true."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/material-log",
            json={
                "weekNumber": 1,
                "floor": "M10S",
                "materialType": "glaze",
                "recipientPlayerId": player_with_tome_gear.id,
                "slotAugmented": "earring",
                "markAugmented": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_mark_augmented_tome_weapon(
        self, client: AsyncClient, auth_headers: dict, test_group, test_tier, player_with_tome_gear
    ):
        """Logging solvent with slot=tome_weapon should augment the tome weapon."""
        response = await client.post(
            f"/api/static-groups/{test_group.id}/tiers/{test_tier.id}/material-log",
            json={
                "weekNumber": 1,
                "floor": "M11S",
                "materialType": "solvent",
                "recipientPlayerId": player_with_tome_gear.id,
                "slotAugmented": "tome_weapon",
                "markAugmented": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
