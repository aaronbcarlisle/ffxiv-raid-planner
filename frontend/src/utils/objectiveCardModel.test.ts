/**
 * objectiveCardModel (S2a-5a·C2a Task C2-1; R-M-3, O-3, C-1): what Home's Objectives card lists.
 * The store is unkeyed, so the `groupId` filter is what keeps another static's list off the card.
 */
import { describe, expect, it } from 'vitest';
import type { StaticObjectiveGoal } from '../stores/objectiveGoalStore';
import { OBJECTIVE_CATEGORY_OPTIONS } from '../data/goalObjectiveCategories';
import { objectiveCardRows } from './objectiveCardModel';

function objective(id: string, overrides: Partial<StaticObjectiveGoal> = {}): StaticObjectiveGoal {
  return {
    id,
    staticGroupId: 'g1',
    createdById: null,
    category: 'savage_bis',
    title: `Title ${id}`,
    description: null,
    priority: 'required',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const ids = (objectives: StaticObjectiveGoal[], groupId = 'g1') => objectiveCardRows(objectives, groupId).map((r) => r.id);
const only = (o: StaticObjectiveGoal) => {
  const rows = objectiveCardRows([o], 'g1');
  expect(rows).toHaveLength(1);
  return rows[0];
};

describe('the row', () => {
  it('carries the id, title, description and "{category} · {priority}", and nothing else', () => {
    const rows = objectiveCardRows(
      [objective('a', { title: 'Clear FRU', description: 'Week one', category: 'ultimate_clear', priority: 'preferred' })],
      'g1',
    );
    expect(rows).toEqual([{ id: 'a', title: 'Clear FRU', description: 'Week one', meta: 'Ultimate — Clear · Preferred' }]);
  });

  it('is empty for an empty list', () => {
    expect(objectiveCardRows([], 'g1')).toEqual([]);
  });
});

describe('what it keeps', () => {
  it('drops Not Doing', () => {
    const list = [objective('a'), objective('b', { priority: 'not_doing' }), objective('c', { priority: 'optional' })];
    expect(ids(list)).toEqual(['a', 'c']);
  });

  it('is empty when every objective is Not Doing', () => {
    expect(ids([objective('a', { priority: 'not_doing' }), objective('b', { priority: 'not_doing' })])).toEqual([]);
  });

  it('filters to the group asked for', () => {
    const list = [objective('a'), objective('b', { staticGroupId: 'g2' }), objective('c')];
    expect(ids(list)).toEqual(['a', 'c']);
    expect(ids(list, 'g2')).toEqual(['b']);
  });

  it('is empty when every row belongs to another static', () => {
    expect(ids([objective('a', { staticGroupId: 'g2' })])).toEqual([]);
  });

  it('has no cap', () => {
    const list = Array.from({ length: 500 }, (_, i) => objective(`o${i}`));
    expect(ids(list)).toEqual(list.map((o) => o.id));
  });
});

describe('the order', () => {
  it('runs Required, Preferred, Optional, then an unknown priority', () => {
    const list = [
      objective('unknown', { priority: 'someday' }),
      objective('optional', { priority: 'optional' }),
      objective('preferred', { priority: 'preferred' }),
      objective('required', { priority: 'required' }),
    ];
    expect(ids(list)).toEqual(['required', 'preferred', 'optional', 'unknown']);
  });

  it('keeps API (created_at) order within a priority', () => {
    const list = [
      objective('o1', { priority: 'optional' }),
      objective('r1'),
      objective('o2', { priority: 'optional' }),
      objective('p1', { priority: 'preferred' }),
      objective('r2'),
      objective('o3', { priority: 'optional' }),
      objective('r3'),
    ];
    expect(ids(list)).toEqual(['r1', 'r2', 'r3', 'p1', 'o1', 'o2', 'o3']);
  });

  it('keeps API order among different unknown priorities, not alphabetical', () => {
    const list = [objective('z', { priority: 'zeta' }), objective('r'), objective('a', { priority: 'alpha' })];
    expect(ids(list)).toEqual(['r', 'z', 'a']);
  });

  it('does not reorder the array it was given: that is the store\'s list', () => {
    const list = Object.freeze([objective('o', { priority: 'optional' }), objective('r')]) as StaticObjectiveGoal[];
    expect(ids(list)).toEqual(['r', 'o']);
    expect(list.map((o) => o.id)).toEqual(['o', 'r']);
  });
});

describe('the labels', () => {
  it('labels mount_farm "Mount Farm", which the editor\'s own table lacks', () => {
    expect(only(objective('a', { category: 'mount_farm' })).meta).toBe('Mount Farm · Required');
  });

  it.each(OBJECTIVE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]))('labels %s "%s"', (value, label) => {
    expect(only(objective('a', { category: value })).meta).toBe(`${label} · Required`);
  });

  it.each([
    ['required', 'Required'],
    ['preferred', 'Preferred'],
    ['optional', 'Optional'],
  ])('labels the priority %s "%s"', (value, label) => {
    expect(only(objective('a', { category: 'custom', priority: value })).meta).toBe(`Custom · ${label}`);
  });

  it('falls back to the raw value for an unknown category', () => {
    expect(only(objective('a', { category: 'weird_new_thing' })).meta).toBe('weird_new_thing · Required');
  });

  it('falls back to the raw priority, with every "_" as a space', () => {
    expect(only(objective('a', { category: 'custom', priority: 'very_high_indeed' })).meta).toBe('Custom · very high indeed');
  });

  it('treats a category or priority named after an Object member as unknown', () => {
    expect(only(objective('a', { category: 'constructor' })).meta).toBe('constructor · Required');
    expect(only(objective('b', { category: 'custom', priority: 'toString' })).meta).toBe('Custom · toString');
    const list = [objective('odd', { priority: 'constructor' }), objective('o', { priority: 'optional' })];
    expect(ids(list)).toEqual(['o', 'odd']);
  });
});

describe('the description', () => {
  it.each<[string, string | null]>([
    ['null', null],
    ['empty', ''],
    ['spaces', '   '],
    ['tabs and newlines', '\t\n '],
    ['CRLF only', '\r\n\r\n'],
    ['non-breaking spaces', '\u00a0\u00a0'],
  ])('is null when it is %s', (_case, description) => {
    expect(only(objective('a', { description })).description).toBeNull();
  });

  it('keeps a real description as written, line breaks included', () => {
    const description = 'First line\r\nSecond line\nThird';
    expect(only(objective('a', { description })).description).toBe(description);
  });
});

describe('literal text', () => {
  it('keeps quotes, backslashes, $, % and ellipses as they are', () => {
    const title = `Ifrit's "Wings" \\u0041 $& $1 100%…`;
    const description = `C:\\raid "$&" 50%… 'ok'`;
    expect(only(objective('a', { title, description }))).toMatchObject({ title, description });
  });

  it('keeps unicode titles and a raw category with "$" in it', () => {
    const title = '絶アレキ — Ünïcödé 🐉';
    const row = only(objective('a', { title, category: '$&_cat' }));
    expect(row.title).toBe(title);
    expect(row.meta).toBe('$&_cat · Required');
  });
});
