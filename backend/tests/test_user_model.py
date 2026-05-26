"""Tests for user model convenience properties."""

from app.models import User


class TestUserAvatarUrl:
    def test_returns_uploaded_discord_avatar_url(self):
        user = User(
            id="user-1",
            discord_id="123456789012345678",
            discord_username="testuser",
            discord_avatar="avatarhash",
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )

        assert (
            user.avatar_url
            == "https://cdn.discordapp.com/avatars/123456789012345678/avatarhash.png"
        )

    def test_returns_default_avatar_for_numeric_discord_ids(self):
        user = User(
            id="user-1",
            discord_id="100000000000000001",
            discord_username="testuser",
            discord_avatar=None,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )

        assert user.avatar_url == "https://cdn.discordapp.com/embed/avatars/1.png"

    def test_returns_deterministic_default_avatar_for_nonnumeric_ids(self):
        user = User(
            id="user-1",
            discord_id="dev_owner_001",
            discord_username="testuser",
            discord_avatar=None,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )

        assert user.avatar_url == "https://cdn.discordapp.com/embed/avatars/5.png"
