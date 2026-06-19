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
