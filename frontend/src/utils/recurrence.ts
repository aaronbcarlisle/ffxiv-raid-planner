/**
 * Minimal RRULE occurrence utility for the schedule frontend.
 *
 * Supports FREQ=WEEKLY (the only type used in practice), plus DAILY and MONTHLY
 * as best-effort. BYDAY weekdays follow JS Date.getUTCDay() convention:
 * SU=0, MO=1, TU=2, WE=3, TH=4, FR=5, SA=6.
 */

const BYDAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

// en-US Intl weekday short names, Sunday-first — matches BYDAY_MAP values
const INTL_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

interface ParsedRRule {
  freq: 'WEEKLY' | 'DAILY' | 'MONTHLY';
  interval: number;
  byday: number[];
}

function parseRRule(rruleStr: string): ParsedRRule | null {
  let text = rruleStr.trim();
  if (text.toUpperCase().startsWith('RRULE:')) text = text.slice(6);

  const parts: Record<string, string> = {};
  for (const tok of text.split(';')) {
    const eq = tok.indexOf('=');
    if (eq !== -1) parts[tok.slice(0, eq).toUpperCase()] = tok.slice(eq + 1);
  }

  const freq = (parts.FREQ ?? 'WEEKLY').toUpperCase();
  if (freq !== 'WEEKLY' && freq !== 'DAILY' && freq !== 'MONTHLY') return null;

  const interval = Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1);

  const byday: number[] = [];
  if (parts.BYDAY) {
    for (const tok of parts.BYDAY.split(',')) {
      const abbr = tok.trim().replace(/[+-]?\d*/g, '').toUpperCase();
      if (abbr in BYDAY_MAP) byday.push(BYDAY_MAP[abbr]);
    }
  }

  return { freq: freq as ParsedRRule['freq'], interval, byday };
}

/**
 * Returns the 0=Sun…6=Sat weekday of a UTC instant as seen in an IANA timezone.
 * A 7 PM CDT session stored at midnight UTC is Thursday locally, not Friday UTC.
 */
function localWeekday(date: Date, timezone: string): number {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).format(date);
  return INTL_WEEKDAY[dayStr] ?? date.getUTCDay();
}

const DAY_MS = 86_400_000;

/**
 * Compute the next occurrence Date for a recurring session.
 *
 * For WEEKLY sessions (the common case), advances by whole days in UTC so the
 * displayed local time is preserved regardless of DST.
 *
 * Returns null for non-recurring sessions or on parse failure.
 *
 * @param startTimeIso   Stored session start_time (ISO string, typically UTC)
 * @param rruleStr       RRULE string, e.g. "RRULE:FREQ=WEEKLY;BYDAY=SU"
 * @param after          Return only occurrences strictly after this Date (default: now)
 * @param cancelledDates Set of YYYY-MM-DD UTC date keys for cancelled occurrences
 * @param timezone       IANA timezone for multi-BYDAY weekday matching (e.g. "America/Chicago")
 */
export function computeNextOccurrence(
  startTimeIso: string,
  rruleStr: string | null | undefined,
  after: Date = new Date(),
  cancelledDates?: ReadonlySet<string>,
  timezone?: string,
): Date | null {
  if (!rruleStr) return null;

  const rule = parseRRule(rruleStr);
  if (!rule) return null;

  const dtstart = new Date(startTimeIso);
  if (isNaN(dtstart.getTime())) return null;

  const afterMs = after.getTime();

  if (rule.freq === 'WEEKLY') {
    if (rule.byday.length <= 1) {
      // Fast path: single (or missing) BYDAY — advance by 7-day intervals from
      // dtstart, preserving the exact UTC wall-clock time across DST boundaries.
      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(candidate.getTime() + rule.interval * 7 * DAY_MS);
      }
      // Skip cancelled occurrences (guard: max 104 weeks ≈ 2 years)
      for (let skip = 0; skip < 104; skip++) {
        if (!cancelledDates?.has(candidate.toISOString().slice(0, 10))) return candidate;
        candidate.setTime(candidate.getTime() + rule.interval * 7 * DAY_MS);
      }
      return null;
    }

    // Multiple BYDAY: day-by-day scan (up to 730 days).
    // Use timezone-aware weekday so a session at 7 PM CDT (midnight UTC next day)
    // matches the correct local day rather than the UTC day.
    const candidate = new Date(dtstart.getTime());
    for (let i = 0; i < 730; i++) {
      if (candidate.getTime() > afterMs) {
        const weekday = timezone
          ? localWeekday(candidate, timezone)
          : candidate.getUTCDay();
        if (rule.byday.includes(weekday)) {
          const dateKey = candidate.toISOString().slice(0, 10);
          if (!cancelledDates?.has(dateKey)) {
            return new Date(candidate.getTime());
          }
          // Cancelled — keep scanning
        }
      }
      candidate.setTime(candidate.getTime() + DAY_MS);
    }
    return null;
  }

  if (rule.freq === 'DAILY') {
    const candidate = new Date(dtstart.getTime());
    while (candidate.getTime() <= afterMs) {
      candidate.setTime(candidate.getTime() + rule.interval * DAY_MS);
    }
    return candidate;
  }

  // MONTHLY: best-effort same UTC day-of-month
  const candidate = new Date(dtstart.getTime());
  while (candidate.getTime() <= afterMs) {
    const newMonth = candidate.getUTCMonth() + rule.interval;
    candidate.setUTCFullYear(
      candidate.getUTCFullYear() + Math.floor(newMonth / 12),
      newMonth % 12,
      candidate.getUTCDate(),
    );
  }
  return candidate;
}
