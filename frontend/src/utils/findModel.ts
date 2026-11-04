/**
 * The Find model (S2a-4a, R-F-1): turns the catalog, the static's suggestion
 * rows and its goals into the two lists V2's Find renders, "Wanted by your
 * static" and "All farms", with facet counts.
 *
 * Pure: no store reads. Grouping order comes from `groupCatalogBySource`.
 */

import type { CatalogItem, CollectionGoal } from '../stores/collectionGoalStore';
import type { MemberSuggestionEntry, StaticCollectionSuggestion } from '../stores/collectionIntentStore';
import { groupCatalogBySource } from './collectionSourceGrouping';

const MAX_QUERY_LENGTH = 200;

export interface FindFilters {
  category: string | null;
  source: string | null;
  expansion: string | null;
}

export interface FindItem {
  id: string;
  name: string;
  category: string | null;
  sourceType: string | null;
  duty: string | null;
  expansion: string | null;
  /** The catalog's patch string; null on a suggestion-only row. Display only: not searchable, not a filter. */
  patch: string | null;
  /** The exchange (P-75). */
  token: { name: string; cost: number } | null;
  /** The catalog field V1's plugin-ready tag reads (collections/SourceFarmCard.tsx). */
  pluginReady: boolean;
  /** Without the join's Discord username: names come from the roster (S-2), so it can't compile into a render. */
  members: Omit<MemberSuggestionEntry, 'displayName'>[];
  /** Members hunting or interested whose ownership_state isn't `have`. */
  wantedBy: string[];
  /** Id of an open goal in this static for the item. */
  tracking: string | null;
  /** Fallback (offline) catalog items can't be tracked. */
  trackable: boolean;
}

interface FindCounts {
  wanted: number;
  all: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byExpansion: Record<string, number>;
}

export interface FindList {
  wanted: FindItem[];
  all: FindItem[];
  counts: FindCounts;
  /** Ignores the query and the filters: true when anything at all is wanted. */
  anyWanted: boolean;
}

export function hasFilters(f: FindFilters): boolean {
  return f.category !== null || f.source !== null || f.expansion !== null;
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
}

function isWanting(m: MemberSuggestionEntry): boolean {
  return (m.intent === 'hunting' || m.intent === 'interested') && m.ownershipState !== 'have';
}

function matchesQuery(item: FindItem, q: string): boolean {
  if (!q) return true;
  return [item.name, item.duty, item.expansion, item.token?.name]
    .some(field => field != null && field.toLowerCase().includes(q));
}

function matchesFilters(item: FindItem, f: FindFilters, skip?: keyof FindFilters): boolean {
  if (skip !== 'category' && f.category !== null && item.category !== f.category) return false;
  if (skip !== 'source' && f.source !== null && item.sourceType !== f.source) return false;
  if (skip !== 'expansion' && f.expansion !== null && item.expansion !== f.expansion) return false;
  return true;
}

function tally(items: FindItem[], key: (i: FindItem) => string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    if (k !== null) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

interface Row {
  item: FindItem;
  score: number;
}

export function buildFindList({
  catalog,
  suggestions,
  goals,
  groupId,
  query,
  filters,
}: {
  catalog: CatalogItem[];
  suggestions: StaticCollectionSuggestion[];
  goals: CollectionGoal[];
  groupId: string;
  query: string;
  filters: FindFilters;
}): FindList {
  const q = normalizeQuery(query);

  const trackingByItem = new Map<string, string>();
  for (const g of goals) {
    if (g.staticGroupId !== groupId || g.status === 'complete' || !g.catalogItemId) continue;
    if (!trackingByItem.has(g.catalogItemId)) trackingByItem.set(g.catalogItemId, g.id);
  }
  const suggestionById = new Map(suggestions.map(s => [s.catalogItemId, s]));

  const make = (
    c: CatalogItem | null,
    s: StaticCollectionSuggestion | undefined,
    id: string,
  ): FindItem => {
    const members = s?.members ?? [];
    return {
      id,
      name: c?.name ?? s?.catalogItemName ?? id,
      category: c?.category ?? s?.catalogItemCategory ?? null,
      sourceType: c ? c.sourceType : s?.sourceType ?? null,
      duty: c ? c.sourceDutyName : s?.sourceDutyName ?? null,
      expansion: c ? c.expansion : s?.expansion ?? null,
      patch: c?.patch ?? null,
      token: c?.tokenName ? { name: c.tokenName, cost: c.tokenCost ?? 0 } : null,
      pluginReady: c?.gameMountId != null,
      members,
      wantedBy: members.filter(isWanting).map(m => m.userId),
      tracking: trackingByItem.get(id) ?? null,
      trackable: !id.startsWith('fallback-'),
    };
  };

  const allUnfiltered = groupCatalogBySource(catalog)
    .flatMap(g => g.rewards)
    .map(c => make(c, suggestionById.get(c.id), c.id));

  // Wanted rows: every wanting suggestion, from the catalog when it has the
  // item, else (a failed catalog) built from the suggestion row alone.
  const itemById = new Map(allUnfiltered.map(i => [i.id, i]));
  const wantedRows: Row[] = [];
  for (const s of suggestions) {
    const item = itemById.get(s.catalogItemId) ?? make(null, s, s.catalogItemId);
    if (item.wantedBy.length > 0) wantedRows.push({ item, score: s.suggestedFarmScore });
  }
  wantedRows.sort((a, b) => {
    const tracked = Number(a.item.tracking !== null) - Number(b.item.tracking !== null);
    if (tracked !== 0) return tracked;
    if (a.score !== b.score) return b.score - a.score;
    return a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id);
  });

  const inView = (i: FindItem) => matchesQuery(i, q) && matchesFilters(i, filters);
  const wanted = wantedRows.map(r => r.item).filter(inView);
  const all = allUnfiltered.filter(inView);

  // Facet counts: each dimension ignores its own filter, so a chip shows what
  // picking it would give.
  const facet = (skip: keyof FindFilters) =>
    allUnfiltered.filter(i => matchesQuery(i, q) && matchesFilters(i, filters, skip));

  return {
    wanted,
    all,
    counts: {
      wanted: wanted.length,
      all: all.length,
      byCategory: tally(facet('category'), i => i.category),
      bySource: tally(facet('source'), i => i.sourceType),
      byExpansion: tally(facet('expansion'), i => i.expansion),
    },
    anyWanted: wantedRows.length > 0,
  };
}

/** The first untracked wanted item, or null. */
export function topWanted(wanted: FindItem[]): FindItem | null {
  return wanted.find(i => i.tracking === null) ?? null;
}
