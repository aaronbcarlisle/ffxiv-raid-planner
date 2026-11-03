/**
 * S2a-4a TA1 — the Find model (R-F-1; design E-2, D-2, D-3, D-7 `trackable`, D-10).
 *
 * Inputs are the real store shapes:
 * - catalog: `CatalogItem[]` (collectionGoalStore `catalog`);
 * - suggestions: `StaticCollectionSuggestion[]` (collectionIntentStore `suggestions[groupId]`);
 * - goals: `CollectionGoal[]` (collectionGoalStore `goals`).
 */
import { describe, expect, it } from 'vitest';
import type { CatalogItem, CollectionGoal, CollectionGoalStatus } from '../stores/collectionGoalStore';
import type {
  IntentValue,
  MemberSuggestionEntry,
  StaticCollectionSuggestion,
} from '../stores/collectionIntentStore';
import { groupCatalogBySource } from './collectionSourceGrouping';
import {
  buildFindList,
  hasFilters,
  normalizeQuery,
  topWanted,
  type FindFilters,
  type FindItem,
} from './findModel';

// ── Fixtures ────────────────────────────────────────────────────────────────

const GROUP = 'group-1';
const NO_FILTERS: FindFilters = { category: null, source: null, expansion: null };

function cat(id: string, over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    externalSource: 'ffxivcollect',
    externalId: null,
    name: id,
    category: 'mount',
    expansion: 'dt',
    patch: '7.0',
    iconUrl: null,
    imageUrl: null,
    sourceText: null,
    sourceType: 'extreme',
    sourceDutyName: `${id} duty`,
    sourceDutyKey: `${id}-key`,
    tokenName: null,
    tokenCost: null,
    tokenItemId: null,
    gameMountId: null,
    tradeable: false,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: null,
    ...over,
  };
}

function member(
  userId: string,
  intent: IntentValue | null,
  ownershipState: MemberSuggestionEntry['ownershipState'] = 'missing',
): MemberSuggestionEntry {
  return {
    userId,
    displayName: `discord-${userId}`,
    ownershipState,
    intent,
    tokenCount: null,
    canBuy: false,
    confidence: 'high',
    reasons: [],
  };
}

function sug(
  catalogItemId: string,
  score: number,
  members: MemberSuggestionEntry[],
  over: Partial<StaticCollectionSuggestion> = {},
): StaticCollectionSuggestion {
  return {
    catalogItemId,
    catalogItemName: catalogItemId,
    catalogItemCategory: 'mount',
    expansion: 'dt',
    sourceDutyName: `${catalogItemId} duty`,
    sourceType: 'extreme',
    staticGoalId: null,
    suggestedFarmScore: score,
    reasonSummary: '',
    members,
    ...over,
  };
}

function goal(
  id: string,
  catalogItemId: string,
  status: CollectionGoalStatus = 'farming',
  staticGroupId: string = GROUP,
): CollectionGoal {
  return {
    id,
    staticGroupId,
    createdById: null,
    goalType: 'mount' as CollectionGoal['goalType'],
    contentType: null,
    contentKey: null,
    title: catalogItemId,
    status,
    priorityMode: null,
    summary: null,
    linkedDutyId: null,
    linkedRewardId: null,
    targetCount: null,
    currentCount: null,
    note: null,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    completedAt: null,
    catalogItemId,
    tokenName: null,
    tokenCost: null,
    participantSummary: null,
  };
}

// A small real-shaped catalog: two DT extreme rewards sharing a duty, one DT
// ultimate weapon, one EW extreme mount. Input order is deliberately not the
// grouped order.
const lynx = cat('cat-lynx', {
  name: 'Lynx of Righteous Fire',
  sourceDutyName: 'Worqor Lar Dor (Extreme)',
  sourceDutyKey: 'worqor',
  tokenName: 'Valigarmanda Totem',
  tokenCost: 99,
  gameMountId: 312,
});
const music = cat('cat-music', {
  name: 'Orchestrion Roll: Ice Moon',
  category: 'orchestrion',
  sourceDutyName: 'Worqor Lar Dor (Extreme)',
  sourceDutyKey: 'worqor',
});
const ult = cat('cat-ult', {
  name: 'Ultimate Blade',
  category: 'weapon',
  sourceType: 'ultimate',
  sourceDutyName: 'Futures Reborn (Ultimate)',
  sourceDutyKey: 'fru',
});
const ewMount = cat('cat-ew', {
  name: 'Abyssal Steed',
  expansion: 'ew',
  sourceDutyName: 'The Abyssal Fracture (Extreme)',
  sourceDutyKey: 'abyss',
});
const CATALOG = [ewMount, lynx, music, ult];

function build(over: Partial<Parameters<typeof buildFindList>[0]> = {}) {
  return buildFindList({
    catalog: CATALOG,
    suggestions: [],
    goals: [],
    groupId: GROUP,
    query: '',
    filters: NO_FILTERS,
    ...over,
  });
}

const ids = (items: FindItem[]) => items.map(i => i.id);

// ── Wanted (D-2) ────────────────────────────────────────────────────────────

describe('buildFindList — wanted', () => {
  it('a hunting member and an interested member both make an item wanted', () => {
    const r = build({
      suggestions: [
        sug('cat-lynx', 5, [member('u1', 'hunting', 'missing')]),
        sug('cat-ew', 4, [member('u2', 'interested', 'unknown')]),
        sug('cat-ult', 3, [member('u1', 'hunting'), member('u2', 'interested'), member('u3', null)]),
      ],
    });
    expect(ids(r.wanted).sort()).toEqual(['cat-ew', 'cat-lynx', 'cat-ult']);
    expect(r.wanted.find(i => i.id === 'cat-lynx')!.wantedBy).toEqual(['u1']);
    expect(r.wanted.find(i => i.id === 'cat-ew')!.wantedBy).toEqual(['u2']);
    const u = r.wanted.find(i => i.id === 'cat-ult')!;
    expect([...u.wantedBy].sort()).toEqual(['u1', 'u2']);
    expect(u.members).toHaveLength(3);
  });

  it('a hunting member whose ownership_state is have does not make it wanted', () => {
    const r = build({ suggestions: [sug('cat-lynx', 5, [member('u1', 'hunting', 'have')])] });
    expect(r.wanted).toEqual([]);
    expect(r.anyWanted).toBe(false);
  });

  it('members who are all none, owned, pass or hidden do not make it wanted', () => {
    const members = [
      member('u1', null, 'missing'),
      member('u2', 'interested', 'have'),
      member('u3', 'pass', 'missing'),
      member('u4', 'hidden', 'missing'),
    ];
    const r = build({ suggestions: [sug('cat-lynx', 9, members)] });
    expect(r.wanted).toEqual([]);
    const inAll = r.all.find(i => i.id === 'cat-lynx')!;
    expect(inAll.wantedBy).toEqual([]);
    expect(inAll.members).toHaveLength(4);
  });

  it('wantedBy lists only the qualifying members of a mixed row', () => {
    const r = build({
      suggestions: [
        sug('cat-lynx', 5, [
          member('u1', 'hunting', 'have'),
          member('u2', 'interested', 'missing'),
          member('u3', 'pass'),
        ]),
      ],
    });
    expect(r.wanted.map(i => i.wantedBy)).toEqual([['u2']]);
  });
});

// ── Order (D-3) ─────────────────────────────────────────────────────────────

describe('buildFindList — wanted order', () => {
  it('lists untracked items first, then tracked, even when a tracked one scores higher', () => {
    const r = build({
      suggestions: [
        sug('cat-lynx', 100, [member('u1', 'hunting')]),
        sug('cat-ew', 1, [member('u1', 'hunting')]),
      ],
      goals: [goal('goal-lynx', 'cat-lynx')],
    });
    expect(ids(r.wanted)).toEqual(['cat-ew', 'cat-lynx']);
    expect(r.wanted[1].tracking).toBe('goal-lynx');
    expect(r.wanted[0].tracking).toBeNull();
  });

  it('orders each part by score descending, then name, then id', () => {
    const catalog = [
      cat('id-b', { name: 'Same' }),
      cat('id-a', { name: 'Same' }),
      cat('zeta', { name: 'Zeta' }),
      cat('alpha', { name: 'Alpha' }),
      cat('top', { name: 'Top' }),
      cat('t-low', { name: 'Tracked Low' }),
      cat('t-high', { name: 'Tracked High' }),
    ];
    const want = [member('u1', 'hunting')];
    const r = build({
      catalog,
      suggestions: [
        sug('id-b', 5, want),
        sug('zeta', 5, want),
        sug('t-low', 2, want),
        sug('id-a', 5, want),
        sug('alpha', 5, want),
        sug('t-high', 50, want),
        sug('top', 9, want),
      ],
      goals: [goal('g1', 't-low'), goal('g2', 't-high')],
    });
    expect(ids(r.wanted)).toEqual(['top', 'alpha', 'id-a', 'id-b', 'zeta', 't-high', 't-low']);
  });
});

// ── Tracking ────────────────────────────────────────────────────────────────

describe('buildFindList — tracking', () => {
  it('an open goal in this static sets tracking to its id (wanted and farming both count)', () => {
    const r = build({
      goals: [goal('goal-lynx', 'cat-lynx', 'farming'), goal('goal-ew', 'cat-ew', 'wanted')],
    });
    const byId = Object.fromEntries(r.all.map(i => [i.id, i]));
    expect(byId['cat-lynx'].tracking).toBe('goal-lynx');
    expect(byId['cat-ew'].tracking).toBe('goal-ew');
    expect(byId['cat-music'].tracking).toBeNull();
  });

  it('a complete goal does not count', () => {
    const r = build({
      suggestions: [sug('cat-lynx', 5, [member('u1', 'hunting')], { staticGoalId: 'goal-done' })],
      goals: [goal('goal-done', 'cat-lynx', 'complete')],
    });
    expect(r.wanted[0].tracking).toBeNull();
    expect(r.all.find(i => i.id === 'cat-lynx')!.tracking).toBeNull();
    expect(topWanted(r.wanted)?.id).toBe('cat-lynx');
  });

  it("another static's goal does not count", () => {
    const r = build({
      suggestions: [sug('cat-lynx', 5, [member('u1', 'hunting')])],
      goals: [goal('goal-other', 'cat-lynx', 'farming', 'group-other')],
    });
    expect(r.wanted[0].tracking).toBeNull();
  });
});

// ── all ─────────────────────────────────────────────────────────────────────

describe('buildFindList — all', () => {
  it('lists every catalog item, wanted ones included, in groupCatalogBySource order', () => {
    const r = build({ suggestions: [sug('cat-music', 5, [member('u1', 'hunting')])] });
    // DT before EW; within DT, ultimate before extreme; a group's rewards stay together.
    expect(ids(r.all)).toEqual(['cat-ult', 'cat-lynx', 'cat-music', 'cat-ew']);
    expect(ids(r.all)).toEqual(groupCatalogBySource(CATALOG).flatMap(g => g.rewards.map(x => x.id)));
    expect(r.all.find(i => i.id === 'cat-music')!.wantedBy).toEqual(['u1']);
    expect(r.all.find(i => i.id === 'cat-ew')!.members).toEqual([]);
  });

  it('maps the item identity, duty, expansion, token and pluginReady from the catalog', () => {
    const r = build();
    const l = r.all.find(i => i.id === 'cat-lynx')!;
    expect(l).toMatchObject({
      id: 'cat-lynx',
      name: 'Lynx of Righteous Fire',
      category: 'mount',
      sourceType: 'extreme',
      duty: 'Worqor Lar Dor (Extreme)',
      expansion: 'dt',
      token: { name: 'Valigarmanda Totem', cost: 99 },
      pluginReady: true,
      trackable: true,
      tracking: null,
      wantedBy: [],
    });
    const m = r.all.find(i => i.id === 'cat-ew')!;
    expect(m.token).toBeNull();
    expect(m.pluginReady).toBe(false);
  });

  it('empty catalog and suggestions give empty lists and no wants', () => {
    const r = build({ catalog: [] });
    expect(r.wanted).toEqual([]);
    expect(r.all).toEqual([]);
    expect(r.anyWanted).toBe(false);
    expect(r.counts.all).toBe(0);
    expect(r.counts.wanted).toBe(0);
  });
});

// ── The query ───────────────────────────────────────────────────────────────

describe('normalizeQuery', () => {
  it('trims and lower-cases', () => {
    expect(normalizeQuery('  LyNx  ')).toBe('lynx');
  });

  it('cuts a 300-character query to 200', () => {
    expect(normalizeQuery('a'.repeat(300))).toBe('a'.repeat(200));
  });

  it('a query of only spaces, tabs or CR/LF is empty', () => {
    expect(normalizeQuery('     ')).toBe('');
    expect(normalizeQuery(' \t\r\n ')).toBe('');
    expect(normalizeQuery('')).toBe('');
  });
});

describe('buildFindList — the query', () => {
  const matchIds = (query: string) => ids(build({ query }).all);

  it('matches name, case-insensitively', () => {
    expect(matchIds('LYNX of righteous')).toEqual(['cat-lynx']);
  });

  it('matches the source duty', () => {
    expect(matchIds('worqor lar')).toEqual(['cat-lynx', 'cat-music']);
  });

  it('matches the expansion', () => {
    expect(matchIds('EW')).toEqual(['cat-ew']);
  });

  it('matches the token name', () => {
    expect(matchIds('valigarmanda TOTEM')).toEqual(['cat-lynx']);
  });

  it('filters wanted as well as all', () => {
    const r = build({
      query: 'abyssal',
      suggestions: [
        sug('cat-lynx', 5, [member('u1', 'hunting')]),
        sug('cat-ew', 4, [member('u1', 'hunting')]),
      ],
    });
    expect(ids(r.wanted)).toEqual(['cat-ew']);
  });

  it('a blank query lists everything', () => {
    expect(matchIds('   ')).toHaveLength(4);
  });

  it('treats regex characters literally', () => {
    expect(matchIds('(extreme)')).toEqual(['cat-lynx', 'cat-music', 'cat-ew']);
    expect(matchIds('.*')).toEqual([]);
    expect(matchIds('$')).toEqual([]);
  });

  it('matches unicode names case-insensitively', () => {
    const r = build({ catalog: [cat('uni', { name: 'Éclair Chocobo' })], query: 'ÉCLAIR' });
    expect(ids(r.all)).toEqual(['uni']);
  });

  it('caps a long query at 200 characters before matching', () => {
    const long = cat('long', { name: `${'a'.repeat(200)}b` });
    const r = build({ catalog: [long], query: `${'a'.repeat(200)}${'c'.repeat(100)}` });
    expect(ids(r.all)).toEqual(['long']);
  });
});

// ── Filters and counts ──────────────────────────────────────────────────────

describe('hasFilters', () => {
  it('is false when all three are null, true when any is set', () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, category: 'mount' })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, source: 'extreme' })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, expansion: 'dt' })).toBe(true);
  });
});

describe('buildFindList — filters and counts', () => {
  const allWanted = [
    sug('cat-lynx', 5, [member('u1', 'hunting')]),
    sug('cat-music', 4, [member('u1', 'hunting')]),
    sug('cat-ult', 3, [member('u1', 'hunting')]),
    sug('cat-ew', 2, [member('u1', 'hunting')]),
  ];

  it('each filter narrows on its own dimension', () => {
    expect(ids(build({ filters: { ...NO_FILTERS, category: 'orchestrion' } }).all)).toEqual(['cat-music']);
    expect(ids(build({ filters: { ...NO_FILTERS, source: 'ultimate' } }).all)).toEqual(['cat-ult']);
    expect(ids(build({ filters: { ...NO_FILTERS, expansion: 'ew' } }).all)).toEqual(['cat-ew']);
  });

  it('the three filters combine, on both lists', () => {
    const r = build({
      suggestions: allWanted,
      filters: { category: 'mount', source: 'extreme', expansion: 'dt' },
    });
    expect(ids(r.all)).toEqual(['cat-lynx']);
    expect(ids(r.wanted)).toEqual(['cat-lynx']);
  });

  it('counts are per item row, not per source group', () => {
    const r = build({ suggestions: allWanted.slice(0, 2) });
    expect(r.counts.all).toBe(4);
    expect(r.counts.wanted).toBe(2);
    // Worqor's two rewards count twice; per-group counting would give extreme: 2.
    expect(r.counts.bySource).toMatchObject({ extreme: 3, ultimate: 1 });
    expect(r.counts.byCategory).toMatchObject({ mount: 2, orchestrion: 1, weapon: 1 });
    expect(r.counts.byExpansion).toMatchObject({ dt: 3, ew: 1 });
  });

  it('counts follow the query and the filters', () => {
    const byExp = build({ suggestions: allWanted, filters: { ...NO_FILTERS, expansion: 'dt' } });
    expect(byExp.counts.all).toBe(3);
    expect(byExp.counts.wanted).toBe(3);
    expect(byExp.counts.byCategory.mount).toBe(1);
    expect(byExp.counts.bySource).toMatchObject({ extreme: 2, ultimate: 1 });

    const byQuery = build({ suggestions: allWanted, query: 'worqor' });
    expect(byQuery.counts.all).toBe(2);
    expect(byQuery.counts.wanted).toBe(2);
    expect(byQuery.counts.byExpansion.dt).toBe(2);
    expect(byQuery.counts.byExpansion.ew ?? 0).toBe(0);

    const byCat = build({ suggestions: allWanted, filters: { ...NO_FILTERS, category: 'mount' } });
    expect(byCat.counts.byExpansion).toMatchObject({ dt: 1, ew: 1 });
    expect(byCat.counts.bySource.ultimate ?? 0).toBe(0);
  });

  it('anyWanted ignores both the query and the filters', () => {
    const want = [sug('cat-lynx', 5, [member('u1', 'hunting')])];
    const q = build({ suggestions: want, query: 'no such thing' });
    expect(q.wanted).toEqual([]);
    expect(q.anyWanted).toBe(true);
    const f = build({ suggestions: want, filters: { ...NO_FILTERS, expansion: 'ew' } });
    expect(f.wanted).toEqual([]);
    expect(f.anyWanted).toBe(true);
  });
});

// ── Fallback and a failed catalog (D-7, P-67) ───────────────────────────────

describe('buildFindList — fallback and a failed catalog', () => {
  it('a fallback- item is not trackable; a live item is', () => {
    const fb = cat('fallback-lynx', { name: 'Fallback Lynx' });
    const r = build({ catalog: [fb, lynx] });
    expect(r.all.find(i => i.id === 'fallback-lynx')!.trackable).toBe(false);
    expect(r.all.find(i => i.id === 'cat-lynx')!.trackable).toBe(true);
  });

  it('a wanted item missing from a failed catalog is still listed, built from its suggestion row', () => {
    const row = sug('cat-gone', 7, [member('u1', 'hunting'), member('u2', 'pass')], {
      catalogItemName: 'Gone Mount',
      catalogItemCategory: 'mount',
      expansion: 'dt',
      sourceDutyName: 'Gone Duty (Extreme)',
      sourceType: 'extreme',
    });
    const r = build({ catalog: [], suggestions: [row] });
    expect(r.anyWanted).toBe(true);
    expect(r.wanted).toHaveLength(1);
    expect(r.wanted[0]).toMatchObject({
      id: 'cat-gone',
      name: 'Gone Mount',
      category: 'mount',
      sourceType: 'extreme',
      duty: 'Gone Duty (Extreme)',
      expansion: 'dt',
      wantedBy: ['u1'],
      tracking: null,
      trackable: true,
    });
    expect(r.wanted[0].members).toHaveLength(2);
  });
});

// ── topWanted ───────────────────────────────────────────────────────────────

describe('topWanted', () => {
  it('returns the first untracked wanted item, skipping tracked ones', () => {
    const r = build({
      suggestions: [
        sug('cat-lynx', 100, [member('u1', 'hunting')]),
        sug('cat-ew', 1, [member('u1', 'hunting')]),
      ],
      goals: [goal('goal-lynx', 'cat-lynx')],
    });
    expect(topWanted(r.wanted)?.id).toBe('cat-ew');
  });

  it('returns null when every wanted item is tracked', () => {
    const r = build({
      suggestions: [sug('cat-lynx', 5, [member('u1', 'hunting')])],
      goals: [goal('goal-lynx', 'cat-lynx')],
    });
    expect(topWanted(r.wanted)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(topWanted([])).toBeNull();
  });
});
