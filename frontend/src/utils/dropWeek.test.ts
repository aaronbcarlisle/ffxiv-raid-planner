import { describe, expect, it } from 'vitest';
import { dropWeekLabel } from './dropWeek';

// weekStartDate is the start of WEEK 1 (vet C-1); currentWeek is 5.
const START = '2026-03-05T12:00:00Z';
const NOW = new Date('2026-04-20T12:00:00Z');
const CLOCK = { currentWeek: 5, weekStartDate: START };

/** `START` plus an offset, as the ISO string a drop carries. */
function after(ms: number): string {
  return new Date(Date.parse(START) + ms).toISOString();
}
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Intl may use U+202F or a non-breaking space in places; compare on plain spaces. */
function norm(s: string): string {
  return s.replaceAll(String.fromCharCode(0x202f), ' ').replaceAll(String.fromCharCode(0xa0), ' ');
}

describe('dropWeekLabel', () => {
  it('reads Week 1 at the start of week 1', () => {
    expect(dropWeekLabel(START, CLOCK, NOW)).toBe('Week 1');
  });

  it('is still Week 1 after 6 days 23 hours', () => {
    expect(dropWeekLabel(after(6 * DAY + 23 * HOUR), CLOCK, NOW)).toBe('Week 1');
  });

  it('turns to Week 2 at exactly 7 days', () => {
    expect(dropWeekLabel(after(7 * DAY), CLOCK, NOW)).toBe('Week 2');
  });

  it('reads Week 5 at 30 days', () => {
    expect(dropWeekLabel(after(30 * DAY), CLOCK, NOW)).toBe('Week 5');
  });

  it('falls back to a date past the clock (36 days is week 6, after currentWeek 5)', () => {
    // 2026-03-05 + 36 days = 2026-04-10
    expect(norm(dropWeekLabel(after(36 * DAY), CLOCK, NOW))).toBe('10 Apr');
  });

  it('falls back to a date one minute before week 1 starts', () => {
    // 2026-03-05T11:59Z is 5 March in UTC and in the zones within +-11 hours.
    expect(norm(dropWeekLabel(after(-60_000), CLOCK, NOW))).toMatch(/^[45] Mar$/);
  });

  it('adds the year when the drop is not from this year', () => {
    const label = norm(dropWeekLabel('2025-03-12T12:00:00Z', CLOCK, NOW));
    expect(label).toBe('12 Mar 2025');
  });

  it('reads a date when the start of week 1 is unknown', () => {
    expect(norm(dropWeekLabel('2026-03-12T12:00:00Z', { currentWeek: 5, weekStartDate: null }, NOW))).toBe('12 Mar');
  });

  it('reads a date when the current week is unknown', () => {
    expect(norm(dropWeekLabel('2026-03-12T12:00:00Z', { currentWeek: null, weekStartDate: START }, NOW))).toBe('12 Mar');
  });

  it('reads a date when the start of week 1 does not parse', () => {
    expect(norm(dropWeekLabel('2026-03-12T12:00:00Z', { currentWeek: 5, weekStartDate: 'not a date' }, NOW))).toBe('12 Mar');
  });
});
