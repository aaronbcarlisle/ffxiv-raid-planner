"""Goal matching service — pure function, no DB access.

Computes alignment between a player's public personal goals and a static
group's objective goals.
"""

# Maps a StaticObjectiveGoal category to the set of PlayerGoal goal_type values
# that are considered a match for that category.
_CATEGORY_TO_GOAL_TYPES: dict[str, frozenset[str]] = {
    "ultimate_clear":    frozenset({"weekly_clear", "raid", "personal"}),
    "ultimate_farm":     frozenset({"raid", "weekly_clear"}),
    "savage_bis":        frozenset({"gear", "raid"}),
    "savage_mount":      frozenset({"collection", "mount_farm"}),
    "savage_achievement": frozenset({"raid", "personal"}),
    "savage_alt_jobs":   frozenset({"gear", "raid"}),
    "criterion_title":   frozenset({"raid", "personal"}),
    "gil_farm":          frozenset({"personal", "custom"}),
    "loot_farm":         frozenset({"raid", "custom"}),
    "custom":            frozenset({"custom", "personal"}),
}


def _classify(player_intent: str | None, static_priority: str) -> str:
    """Return a classification string for one (player_intent, static_priority) pair.

    Rules (evaluated in order):
    - No player goal: required → missing; others → unknown
    - player must_have/want + static required/preferred → aligned
    - player willing + static required/preferred/optional → partial
    - player avoid/not_interested + static required → conflict
    - player must_have + static not_doing → conflict
    - player want/willing + static not_doing → partial (static won't do it but not a hard conflict)
    - anything else → unknown
    """
    if player_intent is None:
        return "missing" if static_priority == "required" else "unknown"

    if player_intent in ("must_have", "want"):
        if static_priority in ("required", "preferred"):
            return "aligned"
        if static_priority == "not_doing":
            return "conflict" if player_intent == "must_have" else "partial"
        return "unknown"

    if player_intent == "willing":
        if static_priority in ("required", "preferred", "optional"):
            return "partial"
        return "unknown"

    if player_intent in ("avoid", "not_interested"):
        if static_priority == "required":
            return "conflict"
        return "unknown"

    return "unknown"


def _find_best_player_goal(
    player_goals: list[dict],
    static_category: str,
) -> dict | None:
    """Find the best matching player goal for a static objective category.

    Returns the first player goal whose goal_type falls in the mapped set
    for the given static category. Prioritises exact category matches.
    """
    mapped_types = _CATEGORY_TO_GOAL_TYPES.get(static_category, frozenset())

    # Priority 1: exact category match on the player goal's `category` field
    for g in player_goals:
        if g.get("category") == static_category:
            return g

    # Priority 2: goal_type match via the mapping table.
    # Skip goals that already have an explicit category — if a goal was declared
    # with a specific objective category, it should only match via Priority 1 so
    # it doesn't accidentally align with unrelated static goals.
    for g in player_goals:
        if g.get("category") is None and g.get("goal_type") in mapped_types:
            return g

    return None


def compute_alignment(
    player_goals: list[dict],
    static_goals: list[dict],
) -> dict:
    """Compute alignment between public player goals and static objective goals.

    Args:
        player_goals: Player's public goals (is_public=True). Each dict should
            have at least: goal_type (str), intent_level (str|None),
            category (str|None).
        static_goals: Static group's objective goals. Each dict should have at
            least: category (str), priority (str), title (str), id (str).

    Returns:
        {
            "summary": {"aligned": int, "partial": int, "conflicts": int,
                        "missing": int, "unknown": int},
            "items": [
                {"category": str, "staticTitle": str, "playerIntent": str|None,
                 "staticPriority": str, "status": str}
            ]
        }
    """
    summary: dict[str, int] = {
        "aligned": 0,
        "partial": 0,
        "conflicts": 0,
        "missing": 0,
        "unknown": 0,
    }
    items: list[dict] = []

    for sg in static_goals:
        category = sg.get("category", "")
        static_priority = sg.get("priority", "optional")
        static_title = sg.get("title", category)

        matched_player_goal = _find_best_player_goal(player_goals, category)
        player_intent: str | None = None
        if matched_player_goal is not None:
            player_intent = matched_player_goal.get("intent_level")

        status = _classify(player_intent, static_priority)

        # Tally
        if status == "aligned":
            summary["aligned"] += 1
        elif status == "partial":
            summary["partial"] += 1
        elif status == "conflict":
            summary["conflicts"] += 1
        elif status == "missing":
            summary["missing"] += 1
        else:
            summary["unknown"] += 1

        items.append({
            "category": category,
            "staticTitle": static_title,
            "playerIntent": player_intent,
            "staticPriority": static_priority,
            "status": status,
        })

    return {"summary": summary, "items": items}
