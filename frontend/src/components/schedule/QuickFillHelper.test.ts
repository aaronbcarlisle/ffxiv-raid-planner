import { describe, expect, it } from 'vitest';
import {
  buildPersonalSourceByDay,
  buildQuickFillPlan,
  buildStaticTemplateSourceByDay,
  dateToDayOfWeek,
  getExistingDates,
  getExistingTemplateDays,
} from './quickFillUtils';

describe('QuickFillHelper utilities', () => {
  it('maps dates to BYDAY keys', () => {
    expect(dateToDayOfWeek('2026-06-08')).toBe('MO');
    expect(dateToDayOfWeek('2026-06-14')).toBe('SU');
  });

  it('finds existing This Week dates for the active user only', () => {
    const existing = getExistingDates([
      {
        date: '2026-06-08',
        responses: [
          { userId: 'me', slots: ['18:00'] },
          { userId: 'other', slots: ['19:00'] },
        ],
      },
      {
        date: '2026-06-09',
        responses: [{ userId: 'other', slots: ['18:00'] }],
      },
      {
        date: '2026-06-10',
        responses: [{ userId: 'me', slots: [] }],
      },
    ], 'me');

    expect([...existing]).toEqual(['2026-06-08']);
  });

  it('fills empty dates from Player Hub availability and skips custom days', () => {
    const source = buildPersonalSourceByDay([
      { dayOfWeek: 'MO', slots: ['18:00', '18:30'], timezone: 'Asia/Tokyo' },
      { dayOfWeek: 'TU', slots: ['20:00'], timezone: 'Asia/Tokyo' },
    ]);

    const plan = buildQuickFillPlan(
      ['2026-06-08', '2026-06-09', '2026-06-10'],
      new Set(['2026-06-09']),
      source
    );

    expect(plan.filledDates).toEqual([
      { date: '2026-06-08', slots: ['18:00', '18:30'] },
    ]);
    expect(plan.skippedDates).toEqual(['2026-06-09']);
    expect(plan.missingSourceDates).toEqual(['2026-06-10']);
  });

  it('builds static Typical Week source data for the active user only', () => {
    const source = buildStaticTemplateSourceByDay([
      {
        dayOfWeek: 'MO',
        responses: [
          { userId: 'other', slots: ['17:00'] },
          { userId: 'me', slots: ['19:00'] },
        ],
      },
      {
        dayOfWeek: 'TU',
        responses: [{ userId: 'me', slots: [] }],
      },
    ], 'me');

    expect([...source.entries()]).toEqual([['MO', ['19:00']]]);
  });

  it('finds existing static Typical Week template days for the active user only', () => {
    const existing = getExistingTemplateDays([
      {
        dayOfWeek: 'MO',
        responses: [
          { userId: 'other', slots: ['17:00'] },
          { userId: 'me', slots: ['19:00'] },
        ],
      },
      {
        dayOfWeek: 'TU',
        responses: [{ userId: 'me', slots: [] }],
      },
      {
        dayOfWeek: 'WE',
        responses: [{ userId: 'other', slots: ['20:00'] }],
      },
    ], 'me');

    expect([...existing]).toEqual(['MO']);
  });
});
