import { describe, it, expect } from 'vitest';
import { computeNextOccurrence } from './recurrence';

// Reference point: a fixed "now" well in the past so tests aren't time-sensitive.
// We pick a Thursday (2020-01-02) as the anchor.
const FIXED_AFTER = new Date('2020-01-01T00:00:00Z');

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

  describe('cancelled occurrences — single BYDAY', () => {
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

    it('skips a cancelled CDT occurrence and returns the next day in that timezone', () => {
      const start = '2024-07-05T00:00:00Z'; // Thu Jul 4 19:00 CDT
      const rrule = 'FREQ=WEEKLY;BYDAY=TH,SU';
      const after = new Date('2024-07-01T12:00:00Z');
      // Cancel the Thursday occurrence (stored as Fri Jul 5 UTC date key)
      const cancelled = new Set(['2024-07-05']);
      const result = computeNextOccurrence(start, rrule, after, cancelled, 'America/Chicago');
      expect(result).not.toBeNull();
      // Next is Sunday: Mon Jul 8 00:00 UTC = Sun Jul 7 19:00 CDT
      expect(result!.toISOString()).toBe('2024-07-08T00:00:00.000Z');
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
