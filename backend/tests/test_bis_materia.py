"""Tests for BiS materia parsing functionality"""

from app.routers.bis import parse_materia_name, MATERIA_STAT_MAP, build_icon_url_from_id


class TestParseMateriaName:
    """Tests for the parse_materia_name function"""

    def test_savage_might_materia_xii(self):
        """Test parsing Savage Might Materia XII"""
        stat, tier = parse_materia_name("Savage Might Materia XII")
        assert stat == "Determination"
        assert tier == 12

    def test_savage_aim_materia_xii(self):
        """Test parsing Savage Aim Materia XII"""
        stat, tier = parse_materia_name("Savage Aim Materia XII")
        assert stat == "Critical Hit"
        assert tier == 12

    def test_heavens_eye_materia_x(self):
        """Test parsing Heavens' Eye Materia X"""
        stat, tier = parse_materia_name("Heavens' Eye Materia X")
        assert stat == "Direct Hit Rate"
        assert tier == 10

    def test_quickarm_materia_xi(self):
        """Test parsing Quickarm Materia XI"""
        stat, tier = parse_materia_name("Quickarm Materia XI")
        assert stat == "Skill Speed"
        assert tier == 11

    def test_quicktongue_materia_xi(self):
        """Test parsing Quicktongue Materia XI"""
        stat, tier = parse_materia_name("Quicktongue Materia XI")
        assert stat == "Spell Speed"
        assert tier == 11

    def test_battledance_materia_xii(self):
        """Test parsing Battledance Materia XII"""
        stat, tier = parse_materia_name("Battledance Materia XII")
        assert stat == "Tenacity"
        assert tier == 12

    def test_piety_materia_xii(self):
        """Test parsing Piety Materia XII"""
        stat, tier = parse_materia_name("Piety Materia XII")
        assert stat == "Piety"
        assert tier == 12

    def test_lower_tier_materia(self):
        """Test parsing lower tier materia (tier V)"""
        stat, tier = parse_materia_name("Savage Might Materia V")
        assert stat == "Determination"
        assert tier == 5

    def test_case_insensitive(self):
        """Test that parsing is case insensitive"""
        stat, tier = parse_materia_name("SAVAGE MIGHT MATERIA XII")
        assert stat == "Determination"
        assert tier == 12

    def test_empty_string(self):
        """Test parsing empty string returns None values"""
        stat, tier = parse_materia_name("")
        assert stat is None
        assert tier is None

    def test_invalid_materia_name(self):
        """Test parsing invalid materia name"""
        stat, tier = parse_materia_name("Some Random Item")
        assert stat is None
        assert tier is None

    def test_materia_without_tier(self):
        """Test materia name without tier suffix"""
        stat, tier = parse_materia_name("Savage Might Materia")
        assert stat == "Determination"
        assert tier is None


class TestMateriaStatMap:
    """Tests for the MATERIA_STAT_MAP constant"""

    def test_all_stats_mapped(self):
        """Test that all expected stats are in the map"""
        expected_stats = {
            "Critical Hit",
            "Determination",
            "Direct Hit Rate",
            "Skill Speed",
            "Spell Speed",
            "Tenacity",
            "Piety",
        }
        actual_stats = set(MATERIA_STAT_MAP.values())
        assert actual_stats == expected_stats

    def test_map_has_correct_patterns(self):
        """Test that the map has the correct patterns"""
        assert MATERIA_STAT_MAP["savage aim"] == "Critical Hit"
        assert MATERIA_STAT_MAP["savage might"] == "Determination"
        assert MATERIA_STAT_MAP["heavens' eye"] == "Direct Hit Rate"
        assert MATERIA_STAT_MAP["quickarm"] == "Skill Speed"
        assert MATERIA_STAT_MAP["quicktongue"] == "Spell Speed"
        assert MATERIA_STAT_MAP["battledance"] == "Tenacity"
        assert MATERIA_STAT_MAP["piety"] == "Piety"


class TestBuildIconUrl:
    """Tests for the build_icon_url_from_id function"""

    def test_standard_icon_url(self):
        """Test building standard resolution icon URL"""
        url = build_icon_url_from_id(31676)
        assert url == "https://xivapi.com/i/031000/031676.png"

    def test_high_res_icon_url(self):
        """Test building high-resolution icon URL"""
        url = build_icon_url_from_id(31676, high_res=True)
        assert url == "https://xivapi.com/i/031000/031676_hr1.png"

    def test_string_icon_id(self):
        """Test building URL from string icon ID"""
        url = build_icon_url_from_id("31676")
        assert url == "https://xivapi.com/i/031000/031676.png"

    def test_garland_style_icon_path(self):
        """Test building URL from Garland-style icon path (t/31676)"""
        url = build_icon_url_from_id("t/31676", high_res=True)
        assert url == "https://xivapi.com/i/031000/031676_hr1.png"

    def test_materia_icon(self):
        """Test materia icon (Savage Might Materia XII icon ID: 20292)"""
        url = build_icon_url_from_id(20292, high_res=True)
        assert url == "https://xivapi.com/i/020000/020292_hr1.png"

    def test_empty_icon_id(self):
        """Test that empty icon ID returns None"""
        assert build_icon_url_from_id("") is None
        assert build_icon_url_from_id(None) is None

    def test_invalid_icon_id(self):
        """Test that invalid icon ID returns None"""
        assert build_icon_url_from_id("invalid") is None
