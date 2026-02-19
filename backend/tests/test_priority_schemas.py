"""Tests for priority-related schema validation"""

import pytest
from pydantic import ValidationError

from app.schemas.static_group import (
    StaticSettingsSchema,
    StaticPrioritySettings,
    JobBasedConfig,
    PlayerBasedConfig,
    RoleBasedConfig,
)
from app.schemas.tier_snapshot import (
    SnapshotPlayerCreate,
    SnapshotPlayerUpdate,
    SnapshotPlayerResponse,
)


class TestStaticSettingsSchema:
    """Tests for StaticSettingsSchema validation"""

    def test_valid_job_priority_modifiers(self):
        """Test that valid job modifiers are accepted."""
        settings = StaticSettingsSchema(
            job_priority_modifiers={"PCT": 20, "WAR": -15, "DRG": 0}
        )
        assert settings.job_priority_modifiers == {"PCT": 20, "WAR": -15, "DRG": 0}

    def test_job_modifier_at_max_boundary(self):
        """Test that job modifier at max boundary (100) is accepted."""
        settings = StaticSettingsSchema(job_priority_modifiers={"PCT": 100})
        assert settings.job_priority_modifiers["PCT"] == 100

    def test_job_modifier_at_min_boundary(self):
        """Test that job modifier at min boundary (-100) is accepted."""
        settings = StaticSettingsSchema(job_priority_modifiers={"WAR": -100})
        assert settings.job_priority_modifiers["WAR"] == -100

    def test_job_modifier_exceeds_max(self):
        """Test that job modifier above 100 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StaticSettingsSchema(job_priority_modifiers={"PCT": 150})

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert "PCT" in str(errors[0]["msg"])
        assert "100" in str(errors[0]["msg"])

    def test_job_modifier_below_min(self):
        """Test that job modifier below -100 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StaticSettingsSchema(job_priority_modifiers={"WAR": -150})

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert "WAR" in str(errors[0]["msg"])

    def test_multiple_invalid_modifiers(self):
        """Test that multiple invalid modifiers in same request are caught."""
        with pytest.raises(ValidationError):
            StaticSettingsSchema(
                job_priority_modifiers={"PCT": 150, "WAR": -200}
            )

    def test_empty_job_modifiers(self):
        """Test that empty job modifiers dict is accepted."""
        settings = StaticSettingsSchema(job_priority_modifiers={})
        assert settings.job_priority_modifiers == {}

    def test_null_job_modifiers(self):
        """Test that null job modifiers is accepted."""
        settings = StaticSettingsSchema(job_priority_modifiers=None)
        assert settings.job_priority_modifiers is None

    def test_default_priority_mode(self):
        """Test that default priority mode is automatic."""
        settings = StaticSettingsSchema()
        assert settings.priority_mode == "automatic"

    def test_valid_priority_modes(self):
        """Test all valid priority modes are accepted."""
        for mode in ["automatic", "manual", "disabled"]:
            settings = StaticSettingsSchema(priority_mode=mode)
            assert settings.priority_mode == mode

    def test_invalid_priority_mode(self):
        """Test that invalid priority mode is rejected."""
        with pytest.raises(ValidationError):
            StaticSettingsSchema(priority_mode="invalid_mode")


class TestSnapshotPlayerPriorityModifier:
    """Tests for priority_modifier field validation in player schemas"""

    def test_player_create_valid_modifier(self):
        """Test that valid priority modifier is accepted in create schema."""
        player = SnapshotPlayerCreate(
            name="Test Player",
            job="DRG",
            role="melee",
            priority_modifier=50,
        )
        assert player.priority_modifier == 50

    def test_player_create_modifier_at_boundaries(self):
        """Test priority modifier at boundaries in create schema."""
        player_max = SnapshotPlayerCreate(
            name="Test", job="DRG", role="melee", priority_modifier=100
        )
        player_min = SnapshotPlayerCreate(
            name="Test", job="DRG", role="melee", priority_modifier=-100
        )
        assert player_max.priority_modifier == 100
        assert player_min.priority_modifier == -100

    def test_player_create_modifier_exceeds_max(self):
        """Test priority modifier above 100 is rejected in create schema."""
        with pytest.raises(ValidationError) as exc_info:
            SnapshotPlayerCreate(
                name="Test", job="DRG", role="melee", priority_modifier=101
            )

        errors = exc_info.value.errors()
        assert any("priority_modifier" in str(e.get("loc", [])) for e in errors)

    def test_player_create_modifier_below_min(self):
        """Test priority modifier below -100 is rejected in create schema."""
        with pytest.raises(ValidationError) as exc_info:
            SnapshotPlayerCreate(
                name="Test", job="DRG", role="melee", priority_modifier=-101
            )

        errors = exc_info.value.errors()
        assert any("priority_modifier" in str(e.get("loc", [])) for e in errors)

    def test_player_create_default_modifier(self):
        """Test that default priority modifier is 0 in create schema."""
        player = SnapshotPlayerCreate(name="Test", job="DRG", role="melee")
        assert player.priority_modifier == 0

    def test_player_update_valid_modifier(self):
        """Test that valid priority modifier is accepted in update schema."""
        update = SnapshotPlayerUpdate(priority_modifier=75)
        assert update.priority_modifier == 75

    def test_player_update_modifier_exceeds_max(self):
        """Test priority modifier above 100 is rejected in update schema."""
        with pytest.raises(ValidationError) as exc_info:
            SnapshotPlayerUpdate(priority_modifier=150)

        errors = exc_info.value.errors()
        assert any("priority_modifier" in str(e.get("loc", [])) for e in errors)

    def test_player_update_modifier_below_min(self):
        """Test priority modifier below -100 is rejected in update schema."""
        with pytest.raises(ValidationError) as exc_info:
            SnapshotPlayerUpdate(priority_modifier=-150)

        errors = exc_info.value.errors()
        assert any("priority_modifier" in str(e.get("loc", [])) for e in errors)

    def test_player_update_null_modifier(self):
        """Test that null priority modifier is accepted in update schema."""
        update = SnapshotPlayerUpdate(priority_modifier=None)
        assert update.priority_modifier is None

    def test_player_response_modifier_boundaries(self):
        """Test priority modifier boundaries in response schema."""
        # Valid at boundaries
        response_max = SnapshotPlayerResponse(
            id="test-id",
            tier_snapshot_id="tier-id",
            name="Test",
            job="DRG",
            role="melee",
            configured=True,
            sort_order=0,
            is_substitute=False,
            priority_modifier=100,
            created_at="2026-01-30T00:00:00Z",
            updated_at="2026-01-30T00:00:00Z",
        )
        assert response_max.priority_modifier == 100

        response_min = SnapshotPlayerResponse(
            id="test-id",
            tier_snapshot_id="tier-id",
            name="Test",
            job="DRG",
            role="melee",
            configured=True,
            sort_order=0,
            is_substitute=False,
            priority_modifier=-100,
            created_at="2026-01-30T00:00:00Z",
            updated_at="2026-01-30T00:00:00Z",
        )
        assert response_min.priority_modifier == -100

    def test_player_response_modifier_exceeds_boundaries(self):
        """Test priority modifier exceeding boundaries is rejected in response."""
        with pytest.raises(ValidationError):
            SnapshotPlayerResponse(
                id="test-id",
                tier_snapshot_id="tier-id",
                name="Test",
                job="DRG",
                role="melee",
                configured=True,
                sort_order=0,
                is_substitute=False,
                priority_modifier=150,
                created_at="2026-01-30T00:00:00Z",
                updated_at="2026-01-30T00:00:00Z",
            )


class TestStaticPrioritySettingsValidation:
    """Tests for cross-field validation on StaticPrioritySettings"""

    def test_role_based_auto_creates_default_config(self):
        """mode='role-based' with no role_based_config auto-creates default."""
        settings = StaticPrioritySettings(mode="role-based")
        assert settings.role_based_config is not None
        assert settings.role_based_config.role_order == ["melee", "ranged", "caster", "tank", "healer"]

    def test_role_based_preserves_provided_config(self):
        """mode='role-based' with explicit config preserves it."""
        config = RoleBasedConfig(role_order=["tank", "healer", "melee", "ranged", "caster"])
        settings = StaticPrioritySettings(mode="role-based", role_based_config=config)
        assert settings.role_based_config.role_order == ["tank", "healer", "melee", "ranged", "caster"]

    def test_job_based_requires_config(self):
        """mode='job-based' without job_based_config raises ValueError."""
        with pytest.raises(ValidationError) as exc_info:
            StaticPrioritySettings(mode="job-based")
        assert "job_based_config" in str(exc_info.value)

    def test_player_based_requires_config(self):
        """mode='player-based' without player_based_config raises ValueError."""
        with pytest.raises(ValidationError) as exc_info:
            StaticPrioritySettings(mode="player-based")
        assert "player_based_config" in str(exc_info.value)

    def test_manual_planning_no_config_required(self):
        """mode='manual-planning' needs no mode-specific config."""
        settings = StaticPrioritySettings(mode="manual-planning")
        assert settings.mode == "manual-planning"

    def test_disabled_no_config_required(self):
        """mode='disabled' needs no mode-specific config."""
        settings = StaticPrioritySettings(mode="disabled")
        assert settings.mode == "disabled"
