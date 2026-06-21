/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { groupCatalogBySource, filterGroups, countByCategory } from './collectionSourceGrouping';
import type { CatalogItem } from '../stores/collectionGoalStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CatalogItem> & { id: string; name: string; category: CatalogItem['category'] }): CatalogItem {
  return {
    externalSource: 'internal',
    externalId: null,
    expansion: 'dt',
    patch: '7.35',
    iconUrl: null,
    imageUrl: null,
    sourceText: null,
    sourceType: 'extreme',
    sourceDutyName: null,
    sourceDutyKey: null,
    tokenName: null,
    tokenCost: null,
    tradeable: null,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: null,
    ...overrides,
  };
}

// The Windward Wilds (Extreme) has both a mount and two minions
const WINDWARD_MOUNT = makeItem({
  id: 'ww-mount',
  name: 'Felyne Support Team Cart Horn',
  category: 'mount',
  sourceDutyKey: 'dt-windward-wilds-ex',
  sourceDutyName: 'The Windward Wilds (Extreme)',
  tokenName: 'Guardian Arkveld Certificate',
  tokenCost: 99,
});
const WINDWARD_MINION_1 = makeItem({
  id: 'ww-minion-1',
  name: 'Seikret Fledgling',
  category: 'minion',
  sourceDutyKey: 'dt-windward-wilds-ex',
  sourceDutyName: 'The Windward Wilds (Extreme)',
  tokenName: 'Guardian Scale',
  tokenCost: 3,
});
const WINDWARD_MINION_2 = makeItem({
  id: 'ww-minion-2',
  name: 'Vigorwasp',
  category: 'minion',
  sourceDutyKey: 'dt-windward-wilds-ex',
  sourceDutyName: 'The Windward Wilds (Extreme)',
  tokenName: 'Guardian Scale',
  tokenCost: 3,
});

// Worqor Lar Dor has a mount only
const VALIGARMANDA_MOUNT = makeItem({
  id: 'valig-mount',
  name: 'Wings of Ruin',
  category: 'mount',
  sourceDutyKey: 'dt-valigarmanda',
  sourceDutyName: 'Worqor Lar Dor (Extreme)',
  tokenName: 'Skyruin Totem',
  tokenCost: 99,
});

// Ultimate weapon — different source type
const FUTURES_WEAPON = makeItem({
  id: 'fru-weapon',
  name: 'Ultima Thule Weapons',
  category: 'weapon',
  expansion: 'ew',
  patch: '6.31',
  sourceDutyKey: 'ew-futures-rewritten',
  sourceDutyName: "Futures Rewritten (Ultimate)",
  sourceType: 'ultimate',
  tokenName: 'Crystalline Conflict Trophy Crystal',
  tokenCost: 7,
});

// Item without a sourceDutyKey
const ORPHAN_ITEM = makeItem({
  id: 'orphan',
  name: 'Mystery Reward',
  category: 'other',
  sourceDutyKey: null,
  sourceDutyName: null,
});

const ALL_ITEMS: CatalogItem[] = [
  WINDWARD_MOUNT, WINDWARD_MINION_1, WINDWARD_MINION_2,
  VALIGARMANDA_MOUNT,
  FUTURES_WEAPON,
  ORPHAN_ITEM,
];

// ── groupCatalogBySource ───────────────────────────────────────────────────────

describe('groupCatalogBySource', () => {
  it('creates one group per unique sourceDutyKey', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    // 3 unique keys: dt-windward-wilds-ex, dt-valigarmanda, ew-futures-rewritten,
    // plus one solo group for the orphan item
    expect(groups.length).toBe(4);
  });

  it('places mount and minions from the same duty in one group', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const windward = groups.find(g => g.sourceDutyKey === 'dt-windward-wilds-ex');
    expect(windward).toBeDefined();
    expect(windward!.rewards.length).toBe(3); // mount + 2 minions
    expect(windward!.categories).toContain('mount');
    expect(windward!.categories).toContain('minion');
  });

  it('sets sourceDutyName from the first item in the group', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const windward = groups.find(g => g.sourceDutyKey === 'dt-windward-wilds-ex')!;
    expect(windward.sourceDutyName).toBe('The Windward Wilds (Extreme)');
  });

  it('picks tokenName from the first reward that has one', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const windward = groups.find(g => g.sourceDutyKey === 'dt-windward-wilds-ex')!;
    // WINDWARD_MOUNT is first and has tokenName
    expect(windward.tokenName).toBe('Guardian Arkveld Certificate');
    expect(windward.tokenCost).toBe(99);
  });

  it('creates a solo group for items without a sourceDutyKey', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const solo = groups.find(g => g.sourceDutyKey.startsWith('_solo_'));
    expect(solo).toBeDefined();
    expect(solo!.rewards[0].id).toBe('orphan');
  });

  it('sorts DT groups before EW', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const dtIdx = groups.findIndex(g => g.expansion === 'dt');
    const ewIdx = groups.findIndex(g => g.expansion === 'ew');
    expect(dtIdx).toBeLessThan(ewIdx);
  });

  it('sorts Ultimate before Extreme within same expansion', () => {
    const ultItem = makeItem({
      id: 'ew-ult',
      name: 'EW Ultimate Weapon',
      category: 'weapon',
      expansion: 'ew',
      sourceDutyKey: 'ew-ult-source',
      sourceDutyName: 'EW Ultimate',
      sourceType: 'ultimate',
    });
    const exItem = makeItem({
      id: 'ew-ex',
      name: 'EW Extreme Mount',
      category: 'mount',
      expansion: 'ew',
      sourceDutyKey: 'ew-ex-source',
      sourceDutyName: 'EW Extreme',
      sourceType: 'extreme',
    });
    const groups = groupCatalogBySource([exItem, ultItem]);
    const ultIdx = groups.findIndex(g => g.sourceType === 'ultimate');
    const exIdx = groups.findIndex(g => g.sourceType === 'extreme');
    expect(ultIdx).toBeLessThan(exIdx);
  });
});

// ── filterGroups ──────────────────────────────────────────────────────────────

describe('filterGroups', () => {
  const groups = groupCatalogBySource(ALL_ITEMS);

  it('returns all groups when all filters are "all"', () => {
    const result = filterGroups(groups, 'all', 'all', 'all', '');
    expect(result.length).toBe(groups.length);
  });

  it('filters to only groups containing the selected category', () => {
    const result = filterGroups(groups, 'minion', 'all', 'all', '');
    expect(result.length).toBe(1);
    expect(result[0].sourceDutyKey).toBe('dt-windward-wilds-ex');
  });

  it('hides groups from the wrong expansion', () => {
    const result = filterGroups(groups, 'all', 'ew', 'all', '');
    const keys = result.map(g => g.sourceDutyKey);
    expect(keys).toContain('ew-futures-rewritten');
    expect(keys).not.toContain('dt-windward-wilds-ex');
  });

  it('filters by source type', () => {
    const result = filterGroups(groups, 'all', 'all', 'ultimate', '');
    expect(result.every(g => g.sourceType === 'ultimate')).toBe(true);
  });

  it('filters by search query matching duty name', () => {
    const result = filterGroups(groups, 'all', 'all', 'all', 'Windward');
    expect(result.length).toBe(1);
    expect(result[0].sourceDutyKey).toBe('dt-windward-wilds-ex');
  });

  it('filters by search query matching reward name', () => {
    const result = filterGroups(groups, 'all', 'all', 'all', 'Vigorwasp');
    expect(result.length).toBe(1);
  });

  it('returns empty array when no groups match', () => {
    const result = filterGroups(groups, 'all', 'all', 'all', 'zzz-nomatch');
    expect(result.length).toBe(0);
  });

  it('when filtering by category, only shows that category\'s rewards in each group', () => {
    const result = filterGroups(groups, 'minion', 'all', 'all', '');
    const windward = result.find(g => g.sourceDutyKey === 'dt-windward-wilds-ex')!;
    // Mount should be hidden from reward list when filtering by minion
    expect(windward.rewards.every(r => r.category === 'minion')).toBe(true);
  });
});

// ── countByCategory ───────────────────────────────────────────────────────────

describe('countByCategory', () => {
  it('counts groups with at least one reward in each category', () => {
    const groups = groupCatalogBySource(ALL_ITEMS);
    const counts = countByCategory(groups);
    // mount: windward + valigarmanda = 2
    expect(counts['mount']).toBe(2);
    // minion: windward = 1
    expect(counts['minion']).toBe(1);
    // weapon: futures = 1
    expect(counts['weapon']).toBe(1);
    // other: orphan = 1
    expect(counts['other']).toBe(1);
  });

  it('returns 0 (or undefined) for categories with no groups', () => {
    const groups = groupCatalogBySource([VALIGARMANDA_MOUNT]);
    const counts = countByCategory(groups);
    expect(counts['orchestrion']).toBeUndefined();
  });
});
