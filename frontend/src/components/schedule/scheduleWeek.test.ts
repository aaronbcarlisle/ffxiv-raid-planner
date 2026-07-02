import { describe, it, expect } from 'vitest';
import {
  sessionOccurrencesInRange, deriveHourlyHeatCells, weekOfDate,
  findNextSessionWeek, deriveRecurringSummary, localSlotKeyOf, PRIME_HOURS,
} from './scheduleWeek';
import type { ScheduleSession } from '../../types';

const DAY_MS = 86_400_000;
function makeSession(over: Partial<ScheduleSession>): ScheduleSession {
  return {
    id: 's1', staticGroupId: 'g1', createdById: 'u1', title: 'Raid',
    description: null, startTime: '2026-07-07T00:00:00.000Z', endTime: '2026-07-07T02:30:00.000Z',
    timezone: 'UTC', isRecurring: false, recurrenceRule: null,
    category: 'raid', contentId: null, contentName: null, bannerUrl: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', rsvps: [],
    ...over,
  } as ScheduleSession;
}
const range = (startIso: string) => {
  const start = new Date(startIso);
  return { start, end: new Date(start.getTime() + 6 * DAY_MS) };
};

describe('sessionOccurrencesInRange', () => {
  it('includes a non-recurring session inside the window and excludes one outside', () => {
    const inside = makeSession({ id: 'in', startTime: '2026-07-08T19:00:00.000Z' });
    const before = makeSession({ id: 'before', startTime: '2026-07-05T19:00:00.000Z' });
    const daydemo = makeSession({ id: 'day7', startTime: '2026-07-13T00:00:00.000Z' }); // exactly start+7d → next week
    const occ = sessionOccurrencesInRange([inside, before, daydemo], range('2026-07-06T00:00:00.000Z'));
    expect(occ.map((o) => o.session.id)).toEqual(['in']);
    expect(occ[0].occursAt).toBe('2026-07-08T19:00:00.000Z');
  });

  it('expands a weekly recurring session into the window (occurrence ≠ base start)', () => {
    const rec = makeSession({
      id: 'rec', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      startTime: '2026-06-16T20:00:00.000Z', timezone: 'UTC', // Tue 8 PM UTC
    });
    const occ = sessionOccurrencesInRange([rec], range('2026-07-06T00:00:00.000Z')); // wk of Jul 6
    expect(occ).toHaveLength(1);
    expect(occ[0].occursAt).toBe('2026-07-07T20:00:00.000Z'); // Tue Jul 7
  });

  it('excludes a cancelled occurrence and does not pull the next week into this one', () => {
    const rec = makeSession({
      id: 'rec', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      startTime: '2026-06-16T20:00:00.000Z', timezone: 'UTC',
    });
    const cancelled = new Map([['rec', new Set(['2026-07-07'])]]); // local(UTC) date key
    const occ = sessionOccurrencesInRange([rec], range('2026-07-06T00:00:00.000Z'), cancelled);
    expect(occ).toEqual([]);
  });

  it('preserves wall-clock time across a DST boundary (America/New_York)', () => {
    // Weekly Thu 19:00 America/New_York. Base: Thu 2026-02-26 19:00 EST = 2026-02-27T00:00:00Z.
    // Wait — 2026-02-26T19:00 EST is 2026-02-27T00:00:00Z; BYDAY=TH matches the LOCAL Thursday.
    const rec = makeSession({
      id: 'dst', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
      startTime: '2026-02-27T00:00:00.000Z', timezone: 'America/New_York',
    });
    // Week containing Thu 2026-03-12 (after spring-forward on 2026-03-08):
    const occ = sessionOccurrencesInRange([rec], range('2026-03-09T00:00:00.000Z'));
    expect(occ).toHaveLength(1);
    // 19:00 EDT (UTC-4) → 23:00Z — wall clock preserved, UTC instant shifted.
    expect(occ[0].occursAt).toBe('2026-03-12T23:00:00.000Z');
  });

  it('sorts merged results ascending by occursAt', () => {
    const a = makeSession({ id: 'a', startTime: '2026-07-09T19:00:00.000Z' });
    const b = makeSession({ id: 'b', startTime: '2026-07-07T19:00:00.000Z' });
    const occ = sessionOccurrencesInRange([a, b], range('2026-07-06T00:00:00.000Z'));
    expect(occ.map((o) => o.session.id)).toEqual(['b', 'a']);
  });
});

describe('deriveHourlyHeatCells', () => {
  const dates = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12'];
  it('exposes the prime window rows 18..23,0,1', () => {
    expect(PRIME_HOURS).toEqual([18, 19, 20, 21, 22, 23, 0, 1]);
  });
  it('counts a member only when BOTH half-slots are free (conservative rule)', () => {
    const heat = new Map([
      ['2026-07-07|19:00', { count: 2, names: ['Alice', 'Bob'] }],
      ['2026-07-07|19:30', { count: 1, names: ['Alice'] }],
      ['2026-07-07|20:00', { count: 1, names: ['Bob'] }], // 20:30 missing → hour 20 = 0
    ]);
    const rows = deriveHourlyHeatCells(heat, dates);
    const hour19 = rows[1][1]; // row index 1 = hour 19, col 1 = Jul 7
    expect(hour19).toEqual({ date: '2026-07-07', hour: 19, count: 1, names: ['Alice'] });
    const hour20 = rows[2][1];
    expect(hour20.count).toBe(0);
    expect(hour20.names).toEqual([]);
  });
  it('rolls after-midnight prime hours to the NEXT calendar date of the column', () => {
    const heat = new Map([
      ['2026-07-08|00:00', { count: 1, names: ['Cara'] }],
      ['2026-07-08|00:30', { count: 1, names: ['Cara'] }],
    ]);
    const rows = deriveHourlyHeatCells(heat, dates);
    const midnight = rows[6][1]; // row 6 = hour 0, column 1 = Jul 7 → actual date Jul 8
    expect(midnight).toEqual({ date: '2026-07-08', hour: 0, count: 1, names: ['Cara'] });
  });
});

describe('weekOfDate / findNextSessionWeek / deriveRecurringSummary / localSlotKeyOf', () => {
  it('weekOfDate maps instants into 7-day buckets, clamps pre-anchor to 1, null without anchor', () => {
    expect(weekOfDate('2026-06-23', '2026-06-23T00:00:00Z')).toBe(1);
    expect(weekOfDate('2026-06-23', '2026-07-07T12:00:00Z')).toBe(3);
    expect(weekOfDate('2026-06-23', '2026-06-01T00:00:00Z')).toBe(1);
    expect(weekOfDate(null, '2026-07-07T12:00:00Z')).toBeNull();
  });
  it('findNextSessionWeek returns the first later week with an occurrence', () => {
    const s = makeSession({ id: 'f', startTime: '2026-07-09T19:00:00.000Z' }); // week 3 of 2026-06-23 anchor
    const anchor = new Date('2026-06-23T00:00:00.000Z');
    const rangeOfWeek = (w: number) => ({
      start: new Date(anchor.getTime() + (w - 1) * 7 * DAY_MS),
      end: new Date(anchor.getTime() + ((w - 1) * 7 + 6) * DAY_MS),
    });
    expect(findNextSessionWeek([s], rangeOfWeek, 1, 14)).toEqual({ week: 3, occursAt: '2026-07-09T19:00:00.000Z' });
    expect(findNextSessionWeek([s], rangeOfWeek, 3, 14)).toBeNull();
  });
  it('deriveRecurringSummary formats BYDAY + session-tz time; null when none', () => {
    const rec = makeSession({
      isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,FR',
      startTime: '2026-07-07T20:00:00.000Z', timezone: 'UTC',
    });
    expect(deriveRecurringSummary([rec])).toBe('Recurring: Tue/Fri 8:00 PM');
    expect(deriveRecurringSummary([makeSession({})])).toBeNull();
  });
  it('localSlotKeyOf emits a viewer-local date|HH:MM key', () => {
    const d = new Date(2026, 6, 7, 20, 0, 0); // constructed IN local time → TZ-independent assertion
    expect(localSlotKeyOf(d.toISOString())).toBe('2026-07-07|20:00');
  });
});
