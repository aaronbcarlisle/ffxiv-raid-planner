/**
 * reasonCopy — R-SF-P copy tables (role, schedule, goals, comms, BiS) and
 * the "Your time:" line.
 *
 * `formatTimeLabel` does no zone conversion itself (it only formats an
 * already-local "HH:MM"), but the vitest config pins TZ=UTC, which would
 * hide a stray `new Date(...)`/`toLocaleTimeString` conversion creeping into
 * this file. Stubbing a non-UTC zone (the WeekNavigatorStrip.test.tsx:14-18
 * pattern) keeps that a live guard.
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import {
  roleReasonText, scheduleReasonText, goalsReasonText, commsReasonText,
  bisReasonText, reasonText, unknownScheduleTimeText,
} from './reasonCopy';
import type { FitNight, FitReason } from './types';

vi.hoisted(() => {
  vi.stubEnv('TZ', 'America/Los_Angeles');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

function reason(overrides: Partial<FitReason> = {}): FitReason {
  return { kind: 'role', status: 'match', params: {}, ...overrides };
}

function night(overrides: Partial<FitNight> = {}): FitNight {
  return { day: 'FR', localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: 'full', ...overrides };
}

describe('roleReasonText', () => {
  it('match, own job (main)', () => {
    const r = reason({ status: 'match', params: { matchedJob: 'DRG', matchedRole: 'melee', priority: 'needed', isMain: true, asRole: null } });
    expect(roleReasonText(r)).toBe('Needs a melee DPS — your DRG (main)');
  });

  it('match, asRole (no job)', () => {
    const r = reason({ status: 'match', params: { matchedJob: null, matchedRole: 'tank', priority: 'needed', isMain: false, asRole: 'tank' } });
    expect(roleReasonText(r)).toBe('Needs a tank');
  });

  it('partial, needed (alt)', () => {
    const r = reason({ status: 'partial', params: { matchedJob: 'WAR', matchedRole: 'tank', priority: 'needed', isMain: false, asRole: null } });
    expect(roleReasonText(r)).toBe('Needs a tank — your WAR (alt)');
  });

  it('partial, nice-to-have, no asRole', () => {
    const r = reason({ status: 'partial', params: { matchedJob: 'SGE', matchedRole: 'healer', priority: 'nice_to_have', isMain: true, asRole: null } });
    expect(roleReasonText(r)).toBe('Would like a healer — your SGE');
  });

  it('partial, nice-to-have, with asRole (no job)', () => {
    const r = reason({ status: 'partial', params: { matchedJob: null, matchedRole: 'healer', priority: 'nice_to_have', isMain: false, asRole: 'healer' } });
    expect(roleReasonText(r)).toBe('Would like a healer');
  });

  it('conflict, no asRole', () => {
    const r = reason({ status: 'conflict', params: { matchedJob: null, matchedRole: null, priority: null, isMain: false, asRole: null } });
    expect(roleReasonText(r)).toBe('Not recruiting your role');
  });

  it('conflict, with asRole', () => {
    const r = reason({ status: 'conflict', params: { matchedJob: null, matchedRole: 'caster', priority: null, isMain: false, asRole: 'caster' } });
    expect(roleReasonText(r)).toBe('Not recruiting a caster');
  });

  it('subject="they": conflict, no asRole', () => {
    const r = reason({ status: 'conflict', params: { matchedJob: null, matchedRole: null, priority: null, isMain: false, asRole: null } });
    expect(roleReasonText(r, 'they')).toBe('Not recruiting their role');
  });

  it('subject="they": match, own job (main)', () => {
    const r = reason({ status: 'match', params: { matchedJob: 'DRG', matchedRole: 'melee', priority: 'needed', isMain: true, asRole: null } });
    expect(roleReasonText(r, 'they')).toBe('Needs a melee DPS — their DRG (main)');
  });

  it('subject="they": partial, nice-to-have, no asRole', () => {
    const r = reason({ status: 'partial', params: { matchedJob: 'WHM', matchedRole: 'healer', priority: 'nice_to_have', isMain: true, asRole: null } });
    expect(roleReasonText(r, 'they')).toBe('Would like a healer — their WHM');
  });
});

describe('scheduleReasonText — time basis', () => {
  it('one full night, one partial night, joined by " · "', () => {
    const r = reason({ kind: 'schedule', status: 'partial', params: { basis: 'time' } });
    const nights = [
      night({ localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: 'full' }),
      night({ day: 'SA', localDay: 'SA', localStart: '20:00', localEnd: '23:00', coverage: 'part' }),
    ];
    expect(scheduleReasonText(r, nights)).toBe('Fri 8:00 PM–11:00 PM free · Sat 8:00 PM–11:00 PM partly free');
  });

  it('a "none" coverage night reads busy', () => {
    const r = reason({ kind: 'schedule', status: 'conflict', params: { basis: 'time' } });
    expect(scheduleReasonText(r, [night({ coverage: 'none' })])).toBe('Fri 8:00 PM–11:00 PM busy');
  });

  it('a night missing localStart/localEnd is skipped rather than shown as 12:00 AM (whole-branch review item 9)', () => {
    const r = reason({ kind: 'schedule', status: 'partial', params: { basis: 'time' } });
    const nights = [
      night({ day: 'FR', localDay: 'FR', localStart: null, localEnd: null, coverage: 'full' }),
      night({ day: 'SA', localDay: 'SA', localStart: '20:00', localEnd: '23:00', coverage: 'part' }),
    ];
    const text = scheduleReasonText(r, nights);
    expect(text).toBe('Sat 8:00 PM–11:00 PM partly free');
    expect(text).not.toMatch(/12:00 AM/);
  });
});

describe('scheduleReasonText — day basis', () => {
  it.each([
    ['match', ", you're free those days"],
    ['partial', ", you're free some of those days"],
    ['conflict', ', not on your free days'],
  ] as const)('%s status', (status, suffix) => {
    const r = reason({ kind: 'schedule', status, params: { basis: 'day' } });
    const nights = [night({ day: 'FR', localDay: null, localStart: null, localEnd: null, coverage: null }),
      night({ day: 'SA', localDay: null, localStart: null, localEnd: null, coverage: null })];
    expect(scheduleReasonText(r, nights)).toBe(`Raids Fri/Sat — no time listed${suffix}`);
  });

  it('subject="they": partial reads "they\'re free some of those days"', () => {
    const r = reason({ kind: 'schedule', status: 'partial', params: { basis: 'day' } });
    const nights = [night({ day: 'FR', localDay: null, localStart: null, localEnd: null, coverage: null })];
    expect(scheduleReasonText(r, nights, 'they')).toBe("Raids Fri — no time listed, they're free some of those days");
  });
});

describe('goalsReasonText', () => {
  it('match, 1 goal (singular)', () => {
    expect(goalsReasonText(reason({ kind: 'goals', status: 'match', params: { aligned: 1 } }))).toBe('1 goal in common');
  });
  it('match, 2 goals (plural)', () => {
    expect(goalsReasonText(reason({ kind: 'goals', status: 'match', params: { aligned: 2 } }))).toBe('2 goals in common');
  });
  it('partial', () => {
    expect(goalsReasonText(reason({ kind: 'goals', status: 'partial', params: {} }))).toBe('Goals partly overlap');
  });
  it('conflict', () => {
    expect(goalsReasonText(reason({ kind: 'goals', status: 'conflict', params: {} }))).toBe('Goals conflict with yours');
  });

  it('subject="they": conflict reads "Goals conflict with theirs"', () => {
    expect(goalsReasonText(reason({ kind: 'goals', status: 'conflict', params: {} }), 'they')).toBe('Goals conflict with theirs');
  });
});

describe('commsReasonText', () => {
  it('match', () => expect(commsReasonText(reason({ kind: 'comms', status: 'match' }))).toBe('Comms match'));
  it('partial', () => expect(commsReasonText(reason({ kind: 'comms', status: 'partial' }))).toBe('Comms partly match'));
  it('conflict', () => expect(commsReasonText(reason({ kind: 'comms', status: 'conflict' }))).toBe('Needs voice chat'));
});

describe('bisReasonText', () => {
  it('match', () => expect(bisReasonText(reason({ kind: 'bis', status: 'match' }))).toBe('Your BiS is ready to share'));
  it('partial', () => expect(bisReasonText(reason({ kind: 'bis', status: 'partial' }))).toBe('Your BiS is partly set'));

  it('subject="they": match reads "Their BiS is ready to share"', () => {
    expect(bisReasonText(reason({ kind: 'bis', status: 'match' }), 'they')).toBe('Their BiS is ready to share');
  });
});

describe('reasonText', () => {
  it('dispatches role/schedule/goals/comms/bis by kind', () => {
    expect(reasonText(reason({ kind: 'comms', status: 'match' }))).toBe('Comms match');
  });

  it('an unknown kind returns null, not a throw', () => {
    const r = { kind: 'unknown', status: 'match', params: {} } as unknown as FitReason;
    expect(() => reasonText(r)).not.toThrow();
    expect(reasonText(r)).toBeNull();
  });
});

describe('unknownScheduleTimeText', () => {
  it('joins qualifying nights with a "Your time:" prefix', () => {
    const nights = [
      night({ localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: null }),
      night({ day: 'SA', localDay: 'SA', localStart: '20:00', localEnd: '23:00', coverage: null }),
    ];
    expect(unknownScheduleTimeText(nights)).toBe('Your time: Fri 8:00 PM–11:00 PM · Sat 8:00 PM–11:00 PM');
  });

  it('returns null when no night carries a localStart', () => {
    expect(unknownScheduleTimeText([night({ localDay: null, localStart: null, localEnd: null, coverage: null })])).toBeNull();
  });

  it('subject="they" reads "Their time:"', () => {
    const nights = [night({ localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: null })];
    expect(unknownScheduleTimeText(nights, 'they')).toBe('Their time: Fri 8:00 PM–11:00 PM');
  });
});
