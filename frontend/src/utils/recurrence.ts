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

const DAY_MS = 86_400_000;

/**
 * Compute the next occurrence Date for a recurring session.
 *
 * For WEEKLY sessions (the common case), advances by whole days in UTC so the
 * displayed local time is preserved regardless of DST.
 *
 * Returns null for non-recurring sessions or on parse failure.
 *
 * @param startTimeIso  Stored session start_time (ISO string, typically UTC)
 * @param rruleStr      RRULE string, e.g. "RRULE:FREQ=WEEKLY;BYDAY=SU"
 * @param after         Return only occurrences strictly after this Date (default: now)
 */
export function computeNextOccurrence(
  startTimeIso: string,
  rruleStr: string | null | undefined,
  after: Date = new Date(),
): Date | null {
  if (!rruleStr) return null;

  const rule = parseRRule(rruleStr);
  if (!rule) return null;

  const dtstart = new Date(startTimeIso);
  if (isNaN(dtstart.getTime())) return null;

  const afterMs = after.getTime();

  if (rule.freq === 'WEEKLY') {
    if (rule.byday.length === 1) {
      // Fast path: advance by 7-day intervals from dtstart.
      // This preserves the exact UTC wall-clock time across DST boundaries.
      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(candidate.getTime() + rule.interval * 7 * DAY_MS);
      }
      return candidate;
    }

    if (rule.byday.length === 0) {
      // No BYDAY specified — treat dtstart's weekday as the only day
      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(candidate.getTime() + rule.interval * 7 * DAY_MS);
      }
      return candidate;
    }

    // Multiple BYDAY: day-by-day scan using UTC weekday (up to 730 days)
    const candidate = new Date(dtstart.getTime());
    for (let i = 0; i < 730; i++) {
      if (candidate.getTime() > afterMs && rule.byday.includes(candidate.getUTCDay())) {
        return new Date(candidate.getTime());
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
