"""Fit Score service — pure function, no DB access.

Computes a deterministic, explainable fit summary between a player and a
static listing for the Static Finder discovery page.

Only public player data (is_public=True goals and BiS targets) is used.
Private data is never read by this service.
"""

# ---------------------------------------------------------------------------
# Category compatibility table
# Same taxonomy as StaticObjectiveGoal / PlayerGoal.objective_category.
#
# "related" means the player category is a near-match (same content class)
# but not exact; used to produce "partial" in goal fit.
# "incompatible" means the player category is explicitly opposed; used to
# produce "conflict" in goal fit.
#
# The table is asymmetric: we look up the STATIC category and ask how the
# player's public goal category compares to it.
# ---------------------------------------------------------------------------

# Maps a StaticObjectiveGoal.category → set of PlayerGoal categories that
# are considered "related" (partial match).
_RELATED_CATEGORIES: dict[str, frozenset[str]] = {
    "ultimate_clear":    frozenset({"ultimate_farm", "savage_bis", "savage_achievement"}),
    "ultimate_farm":     frozenset({"ultimate_clear", "savage_bis"}),
    "savage_bis":        frozenset({"savage_mount", "savage_achievement", "savage_alt_jobs", "loot_farm"}),
    "savage_mount":      frozenset({"savage_bis", "savage_achievement", "loot_farm"}),
    "savage_achievement":frozenset({"savage_bis", "savage_mount", "savage_alt_jobs"}),
    "savage_alt_jobs":   frozenset({"savage_bis", "savage_achievement"}),
    "criterion_title":   frozenset({"savage_achievement", "savage_bis"}),
    "gil_farm":          frozenset({"loot_farm", "custom"}),
    "loot_farm":         frozenset({"savage_bis", "savage_mount", "gil_farm"}),
    "custom":            frozenset({"loot_farm", "gil_farm"}),
}

# Maps a StaticObjectiveGoal.category → set of PlayerGoal categories that
# are considered "incompatible" (conflict).
_INCOMPATIBLE_CATEGORIES: dict[str, frozenset[str]] = {
    "ultimate_clear":    frozenset({"gil_farm", "loot_farm"}),
    "ultimate_farm":     frozenset({"gil_farm"}),
    "savage_bis":        frozenset({"gil_farm"}),
    "savage_mount":      frozenset({"gil_farm", "criterion_title"}),
    "savage_achievement":frozenset({"gil_farm"}),
    "savage_alt_jobs":   frozenset({"gil_farm"}),
    "criterion_title":   frozenset({"gil_farm", "loot_farm", "savage_mount"}),
    "gil_farm":          frozenset({"ultimate_clear", "ultimate_farm", "savage_bis", "savage_achievement", "criterion_title"}),
    "loot_farm":         frozenset({"criterion_title", "ultimate_clear"}),
    "custom":            frozenset(),
}

# iCal-style day abbreviations produced by PersonalAvailabilityTemplate
_ICAL_TO_LONG: dict[str, str] = {
    "MO": "Monday",
    "TU": "Tuesday",
    "WE": "Wednesday",
    "TH": "Thursday",
    "FR": "Friday",
    "SA": "Saturday",
    "SU": "Sunday",
}


def _normalise_day(day: str) -> str:
    """Normalise a day string to lowercase long form (e.g. 'MO' -> 'monday')."""
    upper = day.strip().upper()
    long = _ICAL_TO_LONG.get(upper, day)
    return long.lower()


def _compute_goal_fit(
    player_goals: list,
    static_objectives: list,
) -> dict:
    """Compare player public goal categories to static objective categories.

    Args:
        player_goals: Player's public goals (is_public=True already filtered by caller).
            Each dict should have at least 'category' (str|None).
        static_objectives: Static group's objective goals.
            Each dict should have at least 'category' (str).

    Returns: {aligned: int, partial: int, conflicts: int, missing: int}
    """
    counts = {"aligned": 0, "partial": 0, "conflicts": 0, "missing": 0}

    if not static_objectives:
        return counts

    # Collect player categories (public goals only — caller must pre-filter)
    player_categories: set[str] = set()
    for g in player_goals:
        cat = g.get("category")
        if cat:
            player_categories.add(cat)

    if not player_goals:
        # Player has no goals at all — every static objective is "missing"
        counts["missing"] = len(static_objectives)
        return counts

    for sg in static_objectives:
        static_cat = sg.get("category", "")
        if not static_cat:
            continue

        if static_cat in player_categories:
            counts["aligned"] += 1
        elif player_categories & _INCOMPATIBLE_CATEGORIES.get(static_cat, frozenset()):
            counts["conflicts"] += 1
        elif player_categories & _RELATED_CATEGORIES.get(static_cat, frozenset()):
            counts["partial"] += 1
        # else: player has goals but none related to this static category — no count

    return counts


def _compute_job_fit(
    player_jobs: list[str],
    listing_data: dict | None,
) -> dict:
    """Check whether the player's main/alt jobs are wanted by the static.

    Returns: {status: "match"|"partial"|"none"|"unknown", matchedJobs: list[str]}
    """
    if not listing_data:
        return {"status": "unknown", "matchedJobs": []}

    # recruitingJobs from the listing (camelCase from settings dict)
    recruiting_jobs: list[str] | None = listing_data.get("recruitingJobs")
    if not recruiting_jobs:
        recruiting_jobs = listing_data.get("neededJobs")
    if not recruiting_jobs:
        return {"status": "unknown", "matchedJobs": []}

    if not player_jobs:
        return {"status": "unknown", "matchedJobs": []}

    recruiting_upper = [j.upper() for j in recruiting_jobs]
    player_upper = [j.upper() for j in player_jobs]

    matched: list[str] = []
    for j in player_upper:
        if j in recruiting_upper:
            matched.append(j)

    if not matched:
        return {"status": "none", "matchedJobs": []}

    main_job = player_upper[0] if player_upper else None
    if main_job and main_job in recruiting_upper:
        return {"status": "match", "matchedJobs": matched}

    # At least one alt matched but not main job
    return {"status": "partial", "matchedJobs": matched}


def _compute_schedule_fit(
    player_availability: dict | None,
    listing_data: dict | None,
) -> dict:
    """Compute overlap between player availability days and static schedule days.

    Returns: {status: "match"|"partial"|"conflict"|"unknown"}
    """
    if not player_availability or not listing_data:
        return {"status": "unknown"}

    player_days_raw: list[str] = player_availability.get("days", [])
    static_days_raw: list[str] = (
        listing_data.get("scheduleDays")
        or listing_data.get("schedule_days")
        or []
    )

    if not player_days_raw or not static_days_raw:
        return {"status": "unknown"}

    player_days = {_normalise_day(d) for d in player_days_raw}
    static_days = {_normalise_day(d) for d in static_days_raw}

    overlap = len(player_days & static_days)

    if overlap >= 2:
        return {"status": "match"}
    if overlap == 1:
        return {"status": "partial"}
    return {"status": "conflict"}


def _compute_comms_fit(
    player_languages: list[str],
    player_comms: str | None,
    listing_data: dict | None,
) -> dict:
    """Check comms/language compatibility.

    Returns: {status: "match"|"partial"|"conflict"|"unknown"}
    """
    if not listing_data:
        return {"status": "unknown"}

    static_languages: list[str] = listing_data.get("languages") or []
    comm_style: dict | None = listing_data.get("communicationStyle")
    static_voice: str | None = None
    if comm_style and isinstance(comm_style, dict):
        static_voice = comm_style.get("voiceRequirement")

    # Hard conflict: static requires voice chat, player is text-only
    if static_voice == "required" and player_comms == "text_only":
        return {"status": "conflict"}

    # Language match check
    if player_languages and static_languages:
        player_langs_lower = {lang.lower() for lang in player_languages}
        static_langs_lower = {lang.lower() for lang in static_languages}
        if player_langs_lower & static_langs_lower:
            return {"status": "match"}
        # Languages present but no overlap — cultural mismatch, not a hard conflict
        return {"status": "partial"}

    # Comms compatible but no language data to compare
    if static_voice and player_comms:
        if static_voice in ("preferred", "listening_ok") and player_comms in (
            "voice_preferred", "text_only"
        ):
            return {"status": "partial"}
        return {"status": "match"}

    return {"status": "unknown"}


def _compute_bis_fit(
    player_jobs: list[str],
    player_bis_targets: list,
) -> dict:
    """Check whether the player has a public BiS target for their main job.

    Only targets with is_public=True should be passed by the caller.

    Returns: {status: "ready"|"partial"|"unknown"}
    """
    if not player_jobs:
        return {"status": "unknown"}

    main_job = player_jobs[0].upper()

    for target in player_bis_targets:
        target_job = (target.get("job") or "").upper()
        if target_job == main_job:
            # Caller already filtered to is_public=True; guard defensively
            if target.get("is_public", False):
                return {"status": "ready"}
            return {"status": "partial"}

    return {"status": "unknown"}


def _compute_overall(
    goal_counts: dict,
    job_fit: dict,
    schedule_fit: dict,
    comms_fit: dict,
    bis_fit: dict,
) -> str:
    """Derive the overall fit label from component scores.

    Rules (evaluated in order):
    - weak:    any conflict (goals.conflicts>0 OR job=none OR schedule=conflict OR comms=conflict)
    - strong:  no conflicts AND >=1 definitive match (goals.aligned>=1 OR job=match)
    - good:    no conflicts, at least some data resolved
    - partial: mixed results (some unknowns, some matches)
    - unknown: everything is unknown / no data
    """
    has_goal_conflict = goal_counts.get("conflicts", 0) > 0
    has_job_conflict = job_fit.get("status") == "none"
    has_schedule_conflict = schedule_fit.get("status") == "conflict"
    has_comms_conflict = comms_fit.get("status") == "conflict"

    if has_goal_conflict or has_job_conflict or has_schedule_conflict or has_comms_conflict:
        return "weak"

    has_goal_aligned = goal_counts.get("aligned", 0) > 0
    has_job_match = job_fit.get("status") == "match"

    component_statuses = {
        job_fit.get("status"),
        schedule_fit.get("status"),
        comms_fit.get("status"),
        bis_fit.get("status"),
    }
    resolved_statuses = component_statuses - {None, "unknown"}

    if not resolved_statuses and not has_goal_aligned and goal_counts.get("partial", 0) == 0:
        return "unknown"

    if has_goal_aligned or has_job_match:
        return "strong"

    has_any_positive = (
        "match" in resolved_statuses
        or "ready" in resolved_statuses
        or goal_counts.get("partial", 0) > 0
        or job_fit.get("status") == "partial"
        or schedule_fit.get("status") == "partial"
    )

    if has_any_positive:
        return "good"

    return "partial"


def compute_fit_summary(
    static_group,
    static_objectives: list,
    player_goals: list,
    player_jobs: list[str],
    player_availability: dict | None,
    player_languages: list[str],
    player_comms: str | None,
    player_bis_targets: list,
    listing_data: dict | None,
) -> dict:
    """Compute a deterministic fit summary for a player vs. a static listing.

    Args:
        static_group: StaticGroup ORM object (reserved for future extensions).
        static_objectives: List of StaticObjectiveGoal-like dicts (category, priority, title).
        player_goals: Player's public PlayerGoal dicts (is_public=True only).
            Each dict must have at least 'category' (str|None).
        player_jobs: Player's jobs, main job first (e.g. ['BRD', 'MCH']).
        player_availability: Dict with 'days' key (list of day strings, either
            long form 'Saturday' or iCal 'SA') or None if unknown.
        player_languages: Player's preferred language codes (e.g. ['en', 'ja']).
        player_comms: One of "voice_required"|"voice_preferred"|"text_only"|None.
        player_bis_targets: Player's public BiSTargetSet-like dicts (is_public=True only).
            Each dict must have at least 'job' (str) and 'is_public' (bool).
        listing_data: Static discovery settings dict (from StaticGroup.settings['discovery']).

    Returns:
        FitSummary-compatible dict:
        {
            "overall": str,   # "strong"|"good"|"partial"|"weak"|"unknown"
            "goals":    {aligned, partial, conflicts, missing},
            "jobs":     {status, matchedJobs},
            "schedule": {status},
            "comms":    {status},
            "bis":      {status},
        }
    """
    goal_counts = _compute_goal_fit(player_goals, static_objectives)
    job_fit = _compute_job_fit(player_jobs, listing_data)
    schedule_fit = _compute_schedule_fit(player_availability, listing_data)
    comms_fit = _compute_comms_fit(player_languages, player_comms, listing_data)
    bis_fit = _compute_bis_fit(player_jobs, player_bis_targets)

    overall = _compute_overall(goal_counts, job_fit, schedule_fit, comms_fit, bis_fit)

    return {
        "overall": overall,
        "goals": goal_counts,
        "jobs": job_fit,
        "schedule": schedule_fit,
        "comms": comms_fit,
        "bis": bis_fit,
    }
