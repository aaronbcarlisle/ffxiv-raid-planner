/**
 * discordPlan — the Copy plan text (S2a-3a·G1 Task 2, R-S3-2). V1's own text is
 * pinned by `components/collections/CollectionsHub.copyPlan.test.tsx`; these
 * cover the builder over ordered entries and V2's entries (`planEntriesFor`).
 */
import { describe, expect, it } from 'vitest';
import { farmRowOf, goal, type ColumnSpec } from '../components/progress/__fixtures__/progressFixtures';
import type { CollectionGoal, CollectionPriorityMode } from '../stores/collectionGoalStore';
import type { MemberRole } from '../types';
import { buildDiscordPlan, planEntriesFor, type DiscordPlanEntry } from './discordPlan';

const lines = (...l: string[]) => l.join('\n');
const entry = (name: string, state: DiscordPlanEntry['state'], count: number | null): DiscordPlanEntry => ({ name, state, count });

const FULL = goal('g1', {
  title: 'Shiny Mount',
  priorityMode: 'priority_order',
  tokenName: 'Tomestone',
  tokenCost: 99,
  note: 'Bring food',
});

describe('buildDiscordPlan', () => {
  const ordered = [
    entry('Cara', 'need', 10),
    entry('Bob', 'need', 120),
    entry('Zed', 'want', 50),
    entry('Amy', 'want', 5),
    entry('Pat', 'pass', 99),
    entry('Hank', 'have', 0),
  ];

  it('reproduces every line, listing names in the order given', () => {
    expect(buildDiscordPlan(FULL, ordered)).toBe(
      lines(
        '**Shiny Mount** farm plan',
        'Mode: Priority order',
        'Exchange: 99× Tomestone',
        '',
        '🎯 **Need (2):** Cara, Bob',
        '⭐ **Want (2):** Zed, Amy',
        '💰 **Can buy now:** Bob, Pat',
        '✅ **Have (1):** Hank',
        '',
        '📝 Bring food',
      ),
    );
  });

  it('filters Can buy now from canBuyFrom, in its order, when given', () => {
    const canBuyFrom = [entry('Pat', 'pass', 99), entry('Bob', 'need', 120), entry('Zed', 'want', 50)];
    const text = buildDiscordPlan(FULL, ordered, canBuyFrom);
    expect(text).toContain('💰 **Can buy now:** Pat, Bob\n');
    expect(text).toContain('🎯 **Need (2):** Cara, Bob\n');
  });

  it('never lists an entry with a null count under Can buy now', () => {
    const text = buildDiscordPlan(FULL, [entry('Hidden', 'need', null), entry('Over', 'want', 100)]);
    expect(text).toContain('💰 **Can buy now:** Over');
    expect(text).not.toMatch(/Can buy now:.*Hidden/);
    expect(buildDiscordPlan(FULL, [entry('Hidden', 'need', null)])).not.toContain('Can buy now');
  });

  it('skips Mode, Exchange, Can buy now and the note when the goal has none', () => {
    const bare = goal('g2', { title: 'Plain', tokenCost: null, tokenName: null });
    expect(buildDiscordPlan(bare, [entry('Ann', 'need', 5)])).toBe(
      lines('**Plain** farm plan', '', '🎯 **Need (1):** Ann'),
    );
  });
});

// ── V2's entries ────────────────────────────────────────────────────────────

/** The V2 paste for a row, as TG4 builds it: the goal's mode drives the queue. */
function v2Plan(columns: ColumnSpec[], mode: CollectionPriorityMode | null, extra: Partial<CollectionGoal> = {}, role: MemberRole = 'lead'): string {
  const g = goal('g1', { title: 'Shiny Mount', priorityMode: mode, tokenName: 'Tomestone', tokenCost: 99, ...extra });
  const { ordered, canBuyFrom } = planEntriesFor(farmRowOf(columns, g, role), mode);
  return buildDiscordPlan(g, ordered, canBuyFrom);
}

describe('planEntriesFor + buildDiscordPlan', () => {
  it('everyone_gets_one: queue order, a hidden count out of Can buy now, Pass in it, a Not-on-the-roster Need queued', () => {
    const text = v2Plan(
      [
        { id: 'Ann', cell: { state: 'need', tokenCount: 50 } },
        { id: 'Bea', cell: { state: 'need', tokenCount: 200, countHidden: true } },
        { id: 'Cy', cell: { state: 'need', tokenCount: 120 } },
        { id: 'Dee', cell: { state: 'want', tokenCount: 10 } },
        { id: 'Eli', cell: { state: 'pass', tokenCount: 99 } },
        { id: 'Fay', cell: { state: 'have', tokenCount: 0 } },
        { id: 'Gus', kind: 'notOnRoster', cell: { state: 'need', tokenCount: 3 } },
        { id: 'Hal', kind: 'unclaimed' },
      ],
      'everyone_gets_one',
    );
    expect(text).toBe(
      lines(
        '**Shiny Mount** farm plan',
        'Mode: Everyone gets one',
        'Exchange: 99× Tomestone',
        '',
        '🎯 **Need (4):** Gus, Ann, Cy, Bea',
        '⭐ **Want (1):** Dee',
        '💰 **Can buy now:** Cy, Eli',
        '✅ **Have (1):** Fay',
      ),
    );
  });

  it('free_roll: no Need or Want line; Can buy now keeps a Need at the cost; Have is still listed', () => {
    const text = v2Plan(
      [
        { id: 'Ann', cell: { state: 'need', tokenCount: 99 } },
        { id: 'Bea', cell: { state: 'want', tokenCount: 5 } },
        { id: 'Cy', cell: { state: 'pass', tokenCount: 120 } },
        { id: 'Dee', cell: { state: 'have', tokenCount: 0 } },
      ],
      'free_roll',
    );
    expect(text).toBe(
      lines(
        '**Shiny Mount** farm plan',
        'Mode: Free roll',
        'Exchange: 99× Tomestone',
        '',
        '💰 **Can buy now:** Ann, Cy',
        '✅ **Have (1):** Dee',
      ),
    );
  });

  it('desired_only: a Need line, no Want line, and a Want who can buy is still in Can buy now', () => {
    const text = v2Plan(
      [
        { id: 'Ann', cell: { state: 'need', tokenCount: 10 } },
        { id: 'Bea', cell: { state: 'want', tokenCount: 120 } },
        { id: 'Cy', cell: { state: 'have', tokenCount: 0 } },
      ],
      'desired_only',
    );
    expect(text).toBe(
      lines(
        '**Shiny Mount** farm plan',
        'Mode: Desired only',
        'Exchange: 99× Tomestone',
        '',
        '🎯 **Need (1):** Ann',
        '💰 **Can buy now:** Bea',
        '✅ **Have (1):** Cy',
      ),
    );
  });

  it("a viewer's row: every count null, so no Can buy now line, and the note stays", () => {
    const text = v2Plan(
      [
        { id: 'Ann', cell: { state: 'need', tokenCount: 120 } },
        { id: 'Bea', cell: { state: 'want', tokenCount: 120 } },
        { id: 'Cy', cell: { state: 'pass', tokenCount: 120 } },
        { id: 'Dee', cell: { state: 'have', tokenCount: 0 } },
      ],
      'priority_order',
      { note: 'Bring food' },
      'viewer',
    );
    expect(text).toBe(
      lines(
        '**Shiny Mount** farm plan',
        'Mode: Priority order',
        'Exchange: 99× Tomestone',
        '',
        '🎯 **Need (1):** Ann',
        '⭐ **Want (1):** Bea',
        '✅ **Have (1):** Dee',
        '',
        '📝 Bring food',
      ),
    );
  });
});
