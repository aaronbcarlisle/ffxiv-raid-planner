/**
 * S2a-5a·C1 Task C1-1 — the patch on a Find item (R-M-1, O-1).
 *
 * `FindItem.patch` is `string | null`, read from the catalog. A suggestion row has no patch, so a
 * row built from one alone has `null`. The patch is shown, not searched: the query case first
 * proves the item really carries the patch, so it can't pass on a model with no patch at all.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../stores/collectionGoalStore';
import type { MemberSuggestionEntry, StaticCollectionSuggestion } from '../stores/collectionIntentStore';
import { buildFindList, type FindItem } from './findModel';

// ── Fixtures ────────────────────────────────────────────────────────────────

const GROUP = 'group-1';

function cat(id: string, over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    externalSource: 'ffxivcollect',
    externalId: null,
    name: id,
    category: 'mount',
    expansion: 'dt',
    patch: '7.2',
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

const HUNTER: MemberSuggestionEntry = {
  userId: 'u1',
  displayName: 'discord-u1',
  ownershipState: 'missing',
  intent: 'hunting',
  tokenCount: null,
  canBuy: false,
  confidence: 'high',
  reasons: [],
};

function sug(catalogItemId: string): StaticCollectionSuggestion {
  return {
    catalogItemId,
    catalogItemName: catalogItemId,
    catalogItemCategory: 'mount',
    expansion: 'dt',
    sourceDutyName: `${catalogItemId} duty`,
    sourceType: 'extreme',
    staticGoalId: null,
    suggestedFarmScore: 5,
    reasonSummary: '',
    members: [HUNTER],
  };
}

function build(over: Partial<Parameters<typeof buildFindList>[0]> = {}) {
  return buildFindList({
    catalog: [],
    suggestions: [],
    goals: [],
    groupId: GROUP,
    query: '',
    filters: { category: null, source: null, expansion: null },
    ...over,
  });
}

const ids = (items: FindItem[]) => items.map((i) => i.id);

// ── The patch ───────────────────────────────────────────────────────────────

describe('FindItem.patch', () => {
  it("carries a catalog item's patch", () => {
    const r = build({ catalog: [cat('cat-lynx', { patch: '7.2' })] });
    expect(r.all[0].patch).toBe('7.2');
  });

  it('keeps the patch string as the catalog wrote it: 7.10 is not 7.1', () => {
    const r = build({ catalog: [cat('cat-lynx', { patch: '7.10' })] });
    expect(r.all[0].patch).toBe('7.10');
  });

  it('carries the catalog patch on a wanted row, which also has a suggestion', () => {
    const r = build({ catalog: [cat('cat-lynx', { patch: '7.2' })], suggestions: [sug('cat-lynx')] });
    expect(ids(r.wanted)).toEqual(['cat-lynx']);
    expect(r.wanted[0].patch).toBe('7.2');
  });

  it('is null, not undefined, for a catalog item with no patch', () => {
    const r = build({ catalog: [cat('cat-lynx', { patch: null })] });
    expect(r.all[0].patch).toBeNull();
  });

  it('is null on a suggestion-only row, with a failed catalog', () => {
    const r = build({ catalog: [], suggestions: [sug('cat-gone')] });
    expect(ids(r.wanted)).toEqual(['cat-gone']);
    expect(r.wanted[0].patch).toBeNull();
  });

  it('is null on a suggestion-only row beside a live catalog that lacks it', () => {
    const r = build({ catalog: [cat('cat-lynx')], suggestions: [sug('cat-gone')] });
    expect(ids(r.wanted)).toEqual(['cat-gone']);
    expect(r.wanted[0].patch).toBeNull();
  });
});

// ── Not searchable ──────────────────────────────────────────────────────────

describe('the query', () => {
  it.each(['7.2', 'Patch 7.2'])('%s matches nothing through the patch', (query) => {
    const catalog = [cat('cat-lynx', { patch: '7.2' })];
    const suggestions = [sug('cat-lynx')];

    // The item carries it, and is listed with no query.
    const open = build({ catalog, suggestions });
    expect(open.all[0].patch).toBe('7.2');
    expect(ids(open.wanted)).toEqual(['cat-lynx']);

    const r = build({ catalog, suggestions, query });
    expect(r.all).toEqual([]);
    expect(r.wanted).toEqual([]);
    expect(r.counts.all).toBe(0);
  });

  it('still finds an item whose own name holds the same text', () => {
    const catalog = [cat('cat-lynx', { patch: '7.2' }), cat('cat-named', { name: 'Mark 7.2 Lynx', patch: null })];
    expect(build({ catalog }).all.find((i) => i.id === 'cat-lynx')?.patch).toBe('7.2');
    expect(ids(build({ catalog, query: '7.2' }).all)).toEqual(['cat-named']);
  });
});
