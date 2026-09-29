"""Batched loading of the Static Finder fit inputs (Stage 4 RH1a, R-RH-B).

The session I/O for `finder_fit.py` (which stays pure): a user's profile, public
goals, jobs, public BiS, availability days and typical-week template, loaded
for a list of user ids with at most one statement per table. The discovery
router calls it for the one viewer and issues exactly the statements it did
before (`tests/golden/discovery_v1.json` and the `on - off == 0` /
`one == five` tests guard that); the join-request list calls it for every
waiting applicant and issues that same fixed set (R-RH-C).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.bis_target_set import BiSTargetSet
from ..models.personal_availability import PersonalAvailabilityTemplate
from ..models.player_goal import PlayerGoal
from ..models.player_job_profile import PlayerJobProfile
from ..models.player_profile import PlayerProfile
from .availability_layering import TemplateDay
from .finder_fit import ViewerJob, has_typical_week, role_for_job, viewer_display_zone

# main > preferred_alt > flex > emergency > casual; unknown priorities sort last.
PRIORITY_ORDER = {"main": 0, "preferred_alt": 1, "flex": 2, "emergency": 3, "casual": 4}


@dataclass
class FitInputs:
    """One user's fit inputs; an entry exists for every requested id (empty when
    the user has nothing, with `missing == ["template", "jobs"]`)."""

    profile: PlayerProfile | None = None
    # {"id", "goal_type", "category", "intent_level"}
    public_goals: list[dict] = field(default_factory=list)
    player_jobs: list[str] = field(default_factory=list)  # main first
    viewer_jobs: list[ViewerJob] = field(default_factory=list)
    public_bis: list[dict] = field(default_factory=list)  # {"job","is_public"}
    availability: dict | None = None  # {"days": [...]} or None
    template_days: list[TemplateDay] = field(default_factory=list)
    display_zone: str | None = None
    missing: list[str] = field(default_factory=list)  # "template" / "jobs"


def template_days(rows: list[PersonalAvailabilityTemplate]) -> list[TemplateDay]:
    """Template rows as the PH3 pipe's TemplateDay; slots that aren't a JSON list read as empty."""
    days: list[TemplateDay] = []
    for row in rows:
        slots: object = row.slots
        if isinstance(slots, str):
            try:
                slots = json.loads(slots)
            except ValueError:
                slots = []
        days.append(
            TemplateDay(
                user_id=row.user_id,
                day_of_week=row.day_of_week,
                slots=tuple(slots) if isinstance(slots, list) else (),
                timezone=row.timezone,
            )
        )
    return days


async def load_fit_inputs(
    session: AsyncSession,
    user_ids: list[str],
    *,
    discoverable_only: bool,
    availability_always: bool,
    viewer_tz: str | None = None,
) -> dict[str, FitInputs]:
    """Load every user's fit inputs in one statement per table.

    `discoverable_only` keeps V1's gate (a profile counts only when its
    visibility is discoverable); `availability_always` loads template rows for
    every user rather than only those with a profile (the fitV2 path, R-SF-E).
    Jobs are ordered main first (`PRIORITY_ORDER`, then id); availability rows
    `updated_at desc, id` so `viewer_display_zone`'s tie-break is deterministic.
    """
    ids = list(dict.fromkeys(user_ids))
    inputs = {user_id: FitInputs() for user_id in ids}
    if not ids:
        return inputs

    profile_stmt = select(PlayerProfile).where(PlayerProfile.user_id.in_(ids))
    if discoverable_only:
        profile_stmt = profile_stmt.where(PlayerProfile.visibility == "discoverable")
    profile_result = await session.execute(profile_stmt)
    for profile in profile_result.scalars().all():
        entry = inputs.get(profile.user_id)
        if entry is not None and entry.profile is None:
            entry.profile = profile
    by_profile_id = {
        entry.profile.id: entry for entry in inputs.values() if entry.profile is not None
    }

    jobs_by_profile: dict[str, list[PlayerJobProfile]] = {}
    if by_profile_id:
        profile_ids = list(by_profile_id)
        # Public goals only; a goal takes part only with an explicit matching
        # category or goal_type (objective_category first, same taxonomy as
        # StaticObjectiveGoal).
        pg_result = await session.execute(
            select(PlayerGoal).where(
                PlayerGoal.profile_id.in_(profile_ids),
                PlayerGoal.is_public == True,  # noqa: E712
            )
        )
        for goal in pg_result.scalars().all():
            if goal.objective_category is None and goal.goal_type is None:
                continue
            by_profile_id[goal.profile_id].public_goals.append({
                "id": goal.id,
                "goal_type": goal.goal_type,
                "category": goal.objective_category or goal.category,
                "intent_level": goal.intent_level,
            })

        jp_result = await session.execute(
            select(PlayerJobProfile)
            .where(PlayerJobProfile.profile_id.in_(profile_ids))
            .order_by(PlayerJobProfile.priority, PlayerJobProfile.id)
        )
        for job_profile in jp_result.scalars().all():
            jobs_by_profile.setdefault(job_profile.profile_id, []).append(job_profile)
        for profile_id, all_jobs in jobs_by_profile.items():
            sorted_jobs = sorted(all_jobs, key=lambda j: PRIORITY_ORDER.get(j.priority, 99))
            jobs_by_profile[profile_id] = sorted_jobs
            entry = by_profile_id[profile_id]
            entry.player_jobs = [j.job for j in sorted_jobs]
            entry.viewer_jobs = [
                ViewerJob(job=j.job, role=j.role or role_for_job(j.job), is_main=index == 0)
                for index, j in enumerate(sorted_jobs)
            ]

        # Public BiS targets linked to the job profiles just loaded.
        profile_by_jp_id = {
            j.id: profile_id for profile_id, jobs in jobs_by_profile.items() for j in jobs
        }
        if profile_by_jp_id:
            bis_result = await session.execute(
                select(BiSTargetSet).where(
                    BiSTargetSet.job_profile_id.in_(list(profile_by_jp_id)),
                    BiSTargetSet.is_public == True,  # noqa: E712
                )
            )
            for bis in bis_result.scalars().all():
                by_profile_id[profile_by_jp_id[bis.job_profile_id]].public_bis.append(
                    {"job": bis.job, "is_public": bis.is_public}
                )

    # Personal availability: by user id, for users with a profile or for all
    # when `availability_always` (the fitV2 path loads it with no profile, R-SF-E).
    avail_ids = ids if availability_always else [
        user_id for user_id, entry in inputs.items() if entry.profile is not None
    ]
    rows_by_user: dict[str, list[PersonalAvailabilityTemplate]] = {}
    if avail_ids:
        avail_result = await session.execute(
            select(PersonalAvailabilityTemplate)
            .where(PersonalAvailabilityTemplate.user_id.in_(avail_ids))
            .order_by(
                PersonalAvailabilityTemplate.updated_at.desc(),
                PersonalAvailabilityTemplate.id,
            )
        )
        for row in avail_result.scalars().all():
            rows_by_user.setdefault(row.user_id, []).append(row)

    for user_id, entry in inputs.items():
        rows = rows_by_user.get(user_id, [])
        if rows:
            entry.availability = {"days": [row.day_of_week for row in rows]}
        entry.template_days = template_days(rows)
        entry.display_zone = viewer_display_zone(
            [(row.timezone, row.updated_at) for row in rows], viewer_tz
        )
        if not has_typical_week(entry.template_days):
            entry.missing.append("template")
        if not entry.viewer_jobs:
            entry.missing.append("jobs")
    return inputs
