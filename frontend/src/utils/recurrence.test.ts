import { describe, it, expect } from 'vitest';
import { computeNextOccurrence, getOccurrenceDateKey, addWeeksInTimezoneWallClock, getOccurrenceDateKeysForMatching } from './recurrence';

// Reference point: a fixed "now" well in the past so tests aren't time-sensitive.
// We pick a Thursday (2020-01-02) as the anchor.
const FIXED_AFTER = new Date('2020-01-01T00:00:00Z');

describe('getOccurrenceDateKeysForMatching', () => {
  it('returns single key when UTC and local date are the same', () => {
    // Asia/Tokyo noon = same date in UTC and JST
    const keys = getOccurrenceDateKeysForMatching('2026-06-25T03:00:00Z', 'Asia/Tokyo');
    expect(keys).toEqual(['2026-06-25']);
  });

  it('returns [localKey, utcKey] when dates differ across midnight', () => {
    // Thu Jun 25 2026 7 PM CDT = Fri Jun 26 UTC → local "2026-06-25", UTC "2026-06-26"
    const keys = getOccurrenceDateKeysForMatching('2026-06-26T00:00:00Z', 'America/Chicago');
    expect(keys).toEqual(['2026-06-25', '2026-06-26']);
  });
});

describe('getOccurrenceDateKey', () => {
  it('returns local Thu date for a Thu 7 PM CDT session stored as Fri midnight UTC', () => {
    // 2026-06-26T00:00:00Z = Thu Jun 25 2026 7 PM CDT
    expect(getOccurrenceDateKey('2026-06-26T00:00:00Z', 'America/Chicago')).toBe('2026-06-25');
  });

  it('returns UTC date when timezone is UTC', () => {
    expect(getOccurrenceDateKey('2026-06-26T00:00:00Z', 'UTC')).toBe('2026-06-26');
  });

  it('returns next calendar day for an afternoon UTC time in Asia/Tokyo (UTC+9)', () => {
    // 2026-06-25T22:00:00Z = 2026-06-26T07:00+09:00 — Saturday morning Tokyo
    expect(getOccurrenceDateKey('2026-06-25T22:00:00Z', 'Asia/Tokyo')).toBe('2026-06-26');
  });

  it('falls back to UTC slice for an invalid date string', () => {
    expect(getOccurrenceDateKey('not-a-date', 'America/Chicago')).toBe('not-a-date');
  });
});

describe('computeNextOccurrence', () => {
  describe('non-recurring / no rrule', () => {
    it('returns null when no rrule is provided (non-recurring sessions use startTime directly)', () => {
      expect(computeNextOccurrence('2019-01-01T12:00:00Z', undefined)).toBeNull();
    });

    it('returns null for a future startTime with no rrule', () => {
      // Non-recurring sessions don't go through this utility — caller uses startTime directly.
      expect(computeNextOccurrence('2099-01-01T12:00:00Z', undefined)).toBeNull();
    });
  });

  describe('WEEKLY rrule — single BYDAY', () => {
    it('advances a Thursday session by 7 days when now is the same day', () => {
      // startTime is a Thursday in the past; next Thursday should be 7 days later
      const start = '2020-01-02T20:00:00Z'; // Thu 2020-01-02
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2020-01-02T20:01:00Z'); // one minute later → still Thu
      const result = computeNextOccurrence(start, rrule, after);
      // Must be strictly AFTER the `after` time
      expect(result).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThan(after.getTime());
    });

    it('finds the next weekly Thursday from a Monday', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu 2020-01-02
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2020-01-06T00:00:00Z'); // Monday
      const result = computeNextOccurrence(start, rrule, after);
      expect(result).not.toBeNull();
      // Next Thursday from Monday 2020-01-06 is 2020-01-09
      expect(result!.toISOString().startsWith('2020-01-09')).toBe(true);
    });

    it('respects INTERVAL=2 (bi-weekly)', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TH';
      const after = new Date('2020-01-09T21:00:00Z'); // one week later
      const result = computeNextOccurrence(start, rrule, after);
      expect(result).not.toBeNull();
      // With bi-weekly from Jan 2, next after Jan 9 is Jan 16
      expect(result!.toISOString().startsWith('2020-01-16')).toBe(true);
    });
  });

  describe('cancelled occurrences — single BYDAY (UTC, no timezone)', () => {
    it('skips a cancelled occurrence and returns the following week', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu Jan 2
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      // after is just past Jan 2 so the next candidate is Jan 9
      const after = new Date('2020-01-02T21:00:00Z');
      const cancelled = new Set(['2020-01-09']); // Jan 9 is cancelled
      const result = computeNextOccurrence(start, rrule, after, cancelled);
      expect(result).not.toBeNull();
      expect(result!.toISOString().startsWith('2020-01-16')).toBe(true);
    });

    it('returns the first non-cancelled occurrence when multiple are cancelled', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu Jan 2
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2020-01-02T21:00:00Z');
      const cancelled = new Set(['2020-01-09', '2020-01-16']); // Jan 9 and Jan 16 cancelled
      const result = computeNextOccurrence(start, rrule, after, cancelled);
      expect(result).not.toBeNull();
      expect(result!.toISOString().startsWith('2020-01-23')).toBe(true);
    });
  });

  describe('legacy UTC-key backward compatibility', () => {
    it('legacy UTC key "2026-06-26" still skips Thu Jun 25 7 PM CDT occurrence', () => {
      // Before the timezone-aware fix, America/Chicago Thu 7 PM was stored as "2026-06-26" (UTC Fri).
      // The cancelled set may still hold that old key; the occurrence must still be skipped.
      const start = '2026-06-26T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'America/Chicago';
      const legacyCancelled = new Set(['2026-06-26']); // UTC key (old format)
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, legacyCancelled, tz);
      expect(result).not.toBeNull();
      // Jun 25 local skipped via UTC fallback; next is Jul 2 local = Jul 3 00:00 UTC
      expect(result!.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    });

    it('new local key "2026-06-25" skips the same occurrence (positive control)', () => {
      const start = '2026-06-26T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'America/Chicago';
      const newCancelled = new Set(['2026-06-25']); // local key (new format)
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, newCancelled, tz);
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    });

    it('both keys present skip exactly one occurrence, not two', () => {
      const start = '2026-06-26T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'America/Chicago';
      // Both old and new key for the same real occurrence
      const bothKeys = new Set(['2026-06-25', '2026-06-26']);
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, bothKeys, tz);
      expect(result).not.toBeNull();
      // Only Jun 25 local was skipped (once), next is Jul 2 local
      expect(result!.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    });
  });

  describe('cancelled occurrences — timezone-local date keys', () => {
    it('America/Chicago: Thu 7 PM CDT cancellation uses local date (2026-06-25), not UTC Fri (2026-06-26)', () => {
      // Thu Jun 25 2026 7 PM CDT = 2026-06-26T00:00:00Z (Fri midnight UTC)
      const start = '2026-06-26T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'America/Chicago';
      const cancelled = new Set(['2026-06-25']); // local Thu date
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, cancelled, tz);
      expect(result).not.toBeNull();
      // Skips Thu Jun 25 local (= Fri Jun 26 UTC). Next Thu: Jul 3 00:00Z = Thu Jul 2 7 PM CDT.
      expect(result!.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    });

    it('Asia/Tokyo: Thu 9 PM JST cancellation uses local date', () => {
      // Thu Jun 25 2026 9 PM JST (UTC+9) = 2026-06-25T12:00:00Z — same UTC date
      const start = '2026-06-25T12:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'Asia/Tokyo';
      const cancelled = new Set(['2026-06-25']); // local Thu = UTC Thu (noon UTC)
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, cancelled, tz);
      expect(result).not.toBeNull();
      // Next Thu: 2026-07-02T12:00:00Z = Thu Jul 2 9 PM JST
      expect(result!.toISOString()).toMatch(/^2026-07-02/);
    });

    it('Europe/Berlin: Thu 8 PM CEST cancellation uses local date', () => {
      // Thu Jun 25 2026 8 PM CEST (UTC+2) = 2026-06-25T18:00:00Z — same UTC date
      const start = '2026-06-25T18:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const tz = 'Europe/Berlin';
      const cancelled = new Set(['2026-06-25']); // local Thu = UTC Thu (afternoon UTC)
      const after = new Date('2026-06-24T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, cancelled, tz);
      expect(result).not.toBeNull();
      // Next Thu: 2026-07-02T18:00:00Z = Thu Jul 2 8 PM CEST
      expect(result!.toISOString()).toMatch(/^2026-07-02/);
    });
  });

  describe('WEEKLY rrule — multi-BYDAY', () => {
    it('returns the closer day when session runs Monday and Thursday', () => {
      const start = '2020-01-06T20:00:00Z'; // Monday 2020-01-06
      const rrule = 'FREQ=WEEKLY;BYDAY=MO,TH';
      const after = new Date('2020-01-06T20:01:00Z'); // just past Monday
      const result = computeNextOccurrence(start, rrule, after);
      expect(result).not.toBeNull();
      // Next occurrence is Thursday Jan 9
      expect(result!.toISOString().startsWith('2020-01-09')).toBe(true);
    });

    it('skips a cancelled multi-BYDAY occurrence and returns the next one', () => {
      const start = '2020-01-06T20:00:00Z'; // Monday 2020-01-06
      const rrule = 'FREQ=WEEKLY;BYDAY=MO,TH';
      const after = new Date('2020-01-06T20:01:00Z');
      // Thursday Jan 9 is next — cancel it
      const cancelled = new Set(['2020-01-09']);
      const result = computeNextOccurrence(start, rrule, after, cancelled);
      expect(result).not.toBeNull();
      // Should skip Jan 9 Thu, next is Jan 13 Mon
      expect(result!.toISOString().startsWith('2020-01-13')).toBe(true);
    });

    it('returns the correct local-day match for a CDT (UTC-5) Thu+Sun session', () => {
      // Session created for Thu Jul 4 2024 19:00 CDT = Fri Jul 5 2024 00:00 UTC
      const start = '2024-07-05T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH,SU';
      const after = new Date('2024-07-01T12:00:00Z'); // Monday UTC

      const result = computeNextOccurrence(start, rrule, after, undefined, 'America/Chicago');
      expect(result).not.toBeNull();
      // With timezone: first match is Fri Jul 5 00:00 UTC = Thu Jul 4 19:00 CDT (correct)
      expect(result!.toISOString()).toBe('2024-07-05T00:00:00.000Z');
    });

    it('skips a cancelled CDT occurrence using local date key and returns the next occurrence', () => {
      const start = '2024-07-05T00:00:00Z'; // Thu Jul 4 19:00 CDT
      const rrule = 'FREQ=WEEKLY;BYDAY=TH,SU';
      const after = new Date('2024-07-01T12:00:00Z');
      // Cancel using the local Thu date (2024-07-04), not the UTC Fri date (2024-07-05)
      const cancelled = new Set(['2024-07-04']);
      const result = computeNextOccurrence(start, rrule, after, cancelled, 'America/Chicago');
      expect(result).not.toBeNull();
      // Next is Sunday: Mon Jul 8 00:00 UTC = Sun Jul 7 19:00 CDT
      expect(result!.toISOString()).toBe('2024-07-08T00:00:00.000Z');
    });
  });

  describe('addWeeksInTimezoneWallClock', () => {
    it('preserves 7 PM across spring-forward (CST→CDT)', () => {
      // Thu Mar 6 2025 7 PM CST = 2025-03-07T01:00:00Z. After +1 local week:
      // Thu Mar 13 2025 7 PM CDT = 2025-03-14T00:00:00Z (not T01 which would be 8 PM).
      expect(addWeeksInTimezoneWallClock('2025-03-07T01:00:00Z', 1, 'America/Chicago'))
        .toBe('2025-03-14T00:00:00.000Z');
    });

    it('preserves 7 PM across fall-back (CDT→CST)', () => {
      // Thu Oct 23 2025 7 PM CDT = 2025-10-24T00:00:00Z. After +2 local weeks
      // (crossing Nov 2 fall-back): Thu Nov 6 7 PM CST = 2025-11-07T01:00:00Z.
      expect(addWeeksInTimezoneWallClock('2025-10-24T00:00:00Z', 2, 'America/Chicago'))
        .toBe('2025-11-07T01:00:00.000Z');
    });

    it('Tokyo (no DST) is unaffected', () => {
      // Thu Jun 25 2026 9 PM JST = 2026-06-25T12:00:00Z. +1 week: 2026-07-02T12:00:00Z.
      expect(addWeeksInTimezoneWallClock('2026-06-25T12:00:00Z', 1, 'Asia/Tokyo'))
        .toBe('2026-07-02T12:00:00.000Z');
    });
  });

  describe('DST wall-clock — computeNextOccurrence with timezone', () => {
    it('America/Chicago: 7 PM stays 7 PM after spring-forward (CST→CDT)', () => {
      // Thu Mar 6 2025 7 PM CST = 2025-03-07T01:00:00Z
      // US spring-forward: Sun Mar 9 2025 (clocks +1 h)
      // Next Thu Mar 13 must be 7 PM CDT = 2025-03-14T00:00:00Z (not T01 = 8 PM CDT)
      const start = '2025-03-07T01:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2025-03-12T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, undefined, 'America/Chicago');
      expect(result?.toISOString()).toBe('2025-03-14T00:00:00.000Z');
    });

    it('America/Chicago: 7 PM stays 7 PM after fall-back (CDT→CST)', () => {
      // Thu Oct 23 2025 7 PM CDT = 2025-10-24T00:00:00Z
      // US fall-back: Sun Nov 2 2025 (clocks -1 h)
      // Next Thu Nov 6 must be 7 PM CST = 2025-11-07T01:00:00Z (not T00 = 6 PM CST)
      const start = '2025-10-24T00:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2025-11-04T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, undefined, 'America/Chicago');
      expect(result?.toISOString()).toBe('2025-11-07T01:00:00.000Z');
    });

    it('Europe/Berlin: 8 PM stays 8 PM across summer-time transition', () => {
      // EU spring-forward 2025: last Sunday of March = March 30 (CET→CEST, +1 h)
      // Thu Mar 27 2025 8 PM CET = 2025-03-27T19:00:00Z
      // Next Thu Apr 3 2025 8 PM CEST = 2025-04-03T18:00:00Z (not T19 = 9 PM)
      const start = '2025-03-27T19:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2025-04-01T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, undefined, 'Europe/Berlin');
      expect(result?.toISOString()).toBe('2025-04-03T18:00:00.000Z');
    });

    it('Asia/Tokyo: no DST, weekly advance is stable', () => {
      // Thu Jun 25 2026 9 PM JST = 2026-06-25T12:00:00Z. Next week same UTC offset.
      const start = '2026-06-25T12:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2026-06-26T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, undefined, 'Asia/Tokyo');
      expect(result?.toISOString()).toBe('2026-07-02T12:00:00.000Z');
    });

    it('America/Chicago: skipping a cancelled occurrence across DST still returns correct wall-clock time', () => {
      // Thu Mar 6 2025 7 PM CST = 2025-03-07T01:00:00Z — cancel this one.
      // After spring-forward, next Thu Mar 13 7 PM CDT = 2025-03-14T00:00:00Z.
      const start = '2025-03-07T01:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2025-03-05T00:00:00Z');
      // Cancel the first occurrence using its local date key (2025-03-06)
      const cancelled = new Set(['2025-03-06']);
      const result = computeNextOccurrence(start, rrule, after, cancelled, 'America/Chicago');
      expect(result?.toISOString()).toBe('2025-03-14T00:00:00.000Z');
    });

    it('multi-BYDAY: America/Chicago Thu+Sun preserves wall-clock time across spring-forward', () => {
      // Session Thu+Sun at 7 PM CDT. Start: Thu Jun 25 2026 = 2026-06-26T00:00:00Z.
      // After the first occurrence (Jun 25 local), next is Sun Jun 28 local =
      // Mon Jun 29 00:00 UTC = 2026-06-29T00:00:00Z.
      const start = '2026-06-26T00:00:00Z'; // Thu Jun 25 7 PM CDT
      const rrule = 'FREQ=WEEKLY;BYDAY=TH,SU';
      const after = new Date('2026-06-26T01:00:00Z'); // just past first hit
      const result = computeNextOccurrence(start, rrule, after, undefined, 'America/Chicago');
      expect(result).not.toBeNull();
      // Next is Sun Jun 28 7 PM CDT = 2026-06-29T00:00:00Z
      expect(result!.toISOString()).toBe('2026-06-29T00:00:00.000Z');
    });
  });

  describe('DAILY rrule', () => {
    it('returns the next day for a daily session', () => {
      const start = '2020-01-01T10:00:00Z';
      const rrule = 'FREQ=DAILY';
      const after = new Date('2020-01-01T10:01:00Z');
      const result = computeNextOccurrence(start, rrule, after);
      expect(result).not.toBeNull();
      expect(result!.toISOString().startsWith('2020-01-02')).toBe(true);
    });
  });

  describe('RRULE: prefix handling', () => {
    it('strips RRULE: prefix before parsing', () => {
      const start = '2020-01-02T20:00:00Z'; // Thursday
      const rrule = 'RRULE:FREQ=WEEKLY;BYDAY=TH';
      const after = FIXED_AFTER;
      const result = computeNextOccurrence(start, rrule, after);
      expect(result).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null when startTime is not a valid date', () => {
      const result = computeNextOccurrence('not-a-date', 'FREQ=WEEKLY;BYDAY=TH');
      expect(result).toBeNull();
    });

    it('returns null for unrecognised FREQ', () => {
      const result = computeNextOccurrence('2020-01-01T10:00:00Z', 'FREQ=YEARLY;BYDAY=MO');
      expect(result).toBeNull();
    });
  });
});
