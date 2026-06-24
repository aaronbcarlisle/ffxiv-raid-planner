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
 * Extract local wall-clock components from a UTC instant in an IANA timezone.
 * Used by addWeeksInTimezoneWallClock to preserve local time across DST.
 */
function getZonedParts(
  isoString: string,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const date = new Date(isoString);
  const p = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: timezone,
  }).formatToParts(date);
  const get = (t: string) => parseInt(p.find(x => x.type === t)?.value ?? '0', 10);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour') % 24, minute: get('minute'), second: get('second'),
  };
}

/**
 * Convert a local wall-clock date/time in an IANA timezone to a UTC timestamp (ms).
 *
 * Two-pass algorithm: the first pass approximates the UTC offset at the guessed
 * UTC time; the second pass refines it to handle DST boundary cases where the
 * offset changes between the initial guess and the true UTC instant.
 */
function localToUtcMs(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string,
): number {
  const getOffsetMs = (utcMs: number): number => {
    const d = new Date(utcMs);
    const p = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: timezone,
    }).formatToParts(d);
    const get = (t: string) => parseInt(p.find(x => x.type === t)?.value ?? '0', 10);
    const localMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return localMs - utcMs;
  };
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const est1 = guess - getOffsetMs(guess);
  return guess - getOffsetMs(est1);
}

/**
 * Advance a UTC ISO instant by `weeks` calendar weeks in the event's IANA timezone,
 * preserving the local wall-clock time (hour/minute/second) across DST transitions.
 *
 * A naive +7×86400s advance keeps the UTC offset the same, causing the local
 * display time to shift by 1 h across spring-forward/fall-back. This function
 * advances the local calendar date instead, then converts back to UTC.
 */
export function addWeeksInTimezoneWallClock(isoString: string, weeks: number, timezone: string): string {
  try {
    const { year, month, day, hour, minute, second } = getZonedParts(isoString, timezone);
    const advanced = new Date(Date.UTC(year, month - 1, day + weeks * 7));
    const utcMs = localToUtcMs(
      advanced.getUTCFullYear(), advanced.getUTCMonth() + 1, advanced.getUTCDate(),
      hour, minute, second, timezone,
    );
    return new Date(utcMs).toISOString();
  } catch {
    return new Date(new Date(isoString).getTime() + weeks * 7 * DAY_MS).toISOString();
  }
}

/**
 * Returns the YYYY-MM-DD calendar date of an occurrence as seen in the event's IANA timezone.
 *
 * A Thu 7 PM CDT instant stored as Fri midnight UTC returns "Thursday's" date ("2026-06-25"),
 * not the UTC Friday date ("2026-06-26"). This is the key used when creating or matching
 * cancelled exceptions so the stored date reflects the day the user actually sees on their
 * calendar, not the UTC representation.
 *
 * Falls back to the UTC date (ISO slice) if the timezone is invalid or the date cannot be parsed.
 */
export function getOccurrenceDateKey(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString.slice(0, 10);
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value ?? '';
    const m = parts.find(p => p.type === 'month')?.value ?? '';
    const d = parts.find(p => p.type === 'day')?.value ?? '';
    return `${y}-${m}-${d}`;
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Returns the set of date keys to check when matching a cancelled exception.
 *
 * Always returns the local-timezone key as the primary key. Also returns the raw
 * UTC date slice as a fallback when it differs from the local key — this handles
 * exceptions that were stored before timezone-aware keying was deployed (legacy
 * data where America/Chicago Thu 7 PM may be stored as "2026-06-26" UTC instead
 * of "2026-06-25" local).
 *
 * When creating new exceptions, only write the primary local-timezone key.
 */
export function getOccurrenceDateKeysForMatching(isoString: string, timezone: string): string[] {
  const local = getOccurrenceDateKey(isoString, timezone);
  const utc = isoString.slice(0, 10);
  return local === utc ? [local] : [local, utc];
}

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
 * @param cancelledDates Set of YYYY-MM-DD date keys (local timezone) for cancelled occurrences
 * @param timezone       IANA timezone for weekday matching and exception date keying
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
    // Dual-key cancellation check: matches both new local-date keys and legacy UTC-date
    // keys so existing exceptions stored before timezone-aware keying still work.
    const isCancelled = (d: Date): boolean => {
      if (!cancelledDates) return false;
      if (!timezone) return cancelledDates.has(d.toISOString().slice(0, 10));
      return getOccurrenceDateKeysForMatching(d.toISOString(), timezone).some(k => cancelledDates.has(k));
    };

    if (rule.byday.length <= 1) {
      // Fast path: single (or missing) BYDAY.
      // When timezone is provided, advance by local calendar weeks to preserve
      // the wall-clock time across DST (e.g. "every Thu 7 PM" stays 7 PM after
      // spring-forward). Without timezone, fall back to naïve 7×DAY_MS advance.
      const advanceWeeks = (d: Date): Date => {
        if (timezone) {
          return new Date(addWeeksInTimezoneWallClock(d.toISOString(), rule.interval, timezone));
        }
        return new Date(d.getTime() + rule.interval * 7 * DAY_MS);
      };

      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      // Skip cancelled occurrences (guard: max 104 weeks ≈ 2 years)
      for (let skip = 0; skip < 104; skip++) {
        if (!isCancelled(candidate)) return candidate;
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      return null;
    }

    // Multiple BYDAY: scan days to find the next matching weekday.
    // When timezone is provided, scan local calendar dates at the session's
    // wall-clock time so 7 PM CDT (midnight UTC) stays Thursday, not Friday,
    // and the local time is preserved across DST transitions.
    if (timezone) {
      const { year: sy, month: sm, day: sd, hour, minute, second } = getZonedParts(
        dtstart.toISOString(), timezone,
      );
      let y = sy, mo = sm, d = sd;
      for (let i = 0; i < 730; i++) {
        const utcMs = localToUtcMs(y, mo, d, hour, minute, second, timezone);
        if (utcMs > afterMs) {
          const candidate = new Date(utcMs);
          if (rule.byday.includes(localWeekday(candidate, timezone))) {
            if (!isCancelled(candidate)) return candidate;
          }
        }
        // Advance local date by one calendar day (Date.UTC handles month/year overflow)
        const next = new Date(Date.UTC(y, mo - 1, d + 1));
        y = next.getUTCFullYear(); mo = next.getUTCMonth() + 1; d = next.getUTCDate();
      }
      return null;
    }

    // No timezone: UTC-naïve day-by-day scan
    const candidate = new Date(dtstart.getTime());
    for (let i = 0; i < 730; i++) {
      if (candidate.getTime() > afterMs) {
        if (rule.byday.includes(candidate.getUTCDay())) {
          if (!isCancelled(candidate)) return new Date(candidate.getTime());
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
