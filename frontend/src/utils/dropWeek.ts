/**
 * dropWeek — the label for when a drop was logged (S2a-3a·G1 Task 2; R-S3-9, vet
 * C-1). Mirrors the server's week clock (`services/loot_context.py`,
 * `calculate_week_number`): `weekStartDate` is the start of week 1, whole elapsed
 * days are floored (Python's `timedelta.days`), and week n = floor(days / 7) + 1.
 */

const DAY_MS = 86_400_000;

/** What the Progress page knows of the tier's clock; null when unresolved. */
export interface WeekClock {
  currentWeek: number | null;
  weekStartDate: string | null;
}

function shortDate(at: Date, now: Date): string {
  const sameYear = at.getFullYear() === now.getFullYear();
  return at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * "Week n" when the clock is known and the drop falls in weeks 1 through
 * `currentWeek`; otherwise an en-GB short date ("12 Mar", with the year when it
 * isn't this year). A drop before week 1, past the clock, or any unknown clock
 * reads as a date. `now` is injectable for tests.
 */
export function dropWeekLabel(droppedAt: string, clock: WeekClock, now: Date = new Date()): string {
  const dropped = new Date(droppedAt);
  if (Number.isNaN(dropped.getTime())) return droppedAt;

  const { currentWeek, weekStartDate } = clock;
  if (currentWeek !== null && weekStartDate !== null) {
    const start = new Date(weekStartDate).getTime();
    if (!Number.isNaN(start)) {
      const days = Math.floor((dropped.getTime() - start) / DAY_MS);
      const week = Math.floor(days / 7) + 1;
      if (week >= 1 && week <= currentWeek) return `Week ${week}`;
    }
  }
  return shortDate(dropped, now);
}
