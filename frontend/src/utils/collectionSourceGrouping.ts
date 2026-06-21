/**
 * Groups flat CatalogItem[] into SourceFarmGroup[] keyed by source duty.
 *
 * One group = one duty/source (e.g. "The Windward Wilds (Extreme)").
 * All rewards from that duty — mount, music, minion, weapon — appear
 * inside the same group so the UI can render one card per farm, not one
 * row per reward.
 */

import type { CatalogItem, CatalogCategory, CatalogExpansion } from '../stores/collectionGoalStore';

export interface SourceFarmGroup {
  /** Stable key for React rendering and filtering. */
  sourceDutyKey: string;
  /** Human-readable duty/source name. */
  sourceDutyName: string;
  /** extreme | savage | ultimate | other | null */
  sourceType: string | null;
  expansion: CatalogExpansion | null;
  patch: string | null;
  /** All catalog items from this source, ordered: curated first. */
  rewards: CatalogItem[];
  /** Categories present in this group. */
  categories: CatalogCategory[];
  /** Shared token info (from first reward that has it). */
  tokenName: string | null;
  tokenCost: number | null;
}

const EXPANSION_ORDER: Record<string, number> = {
  dt: 0, ew: 1, shb: 2, sb: 3, hw: 4, arr: 5,
};

const SOURCE_TYPE_ORDER: Record<string, number> = {
  ultimate: 0, savage: 1, extreme: 2, criterion: 3, other: 99,
};

export function groupCatalogBySource(items: CatalogItem[]): SourceFarmGroup[] {
  const groups = new Map<string, SourceFarmGroup>();

  for (const item of items) {
    // Items without a source_duty_key get their own solo group keyed by id.
    const key = item.sourceDutyKey ?? `_solo_${item.id}`;
    const name = item.sourceDutyName ?? item.sourceText ?? item.name;

    if (!groups.has(key)) {
      groups.set(key, {
        sourceDutyKey: key,
        sourceDutyName: name,
        sourceType: item.sourceType,
        expansion: item.expansion,
        patch: item.patch,
        rewards: [],
        categories: [],
        tokenName: null,
        tokenCost: null,
      });
    }

    const group = groups.get(key)!;
    group.rewards.push(item);

    if (item.category && !group.categories.includes(item.category)) {
      group.categories.push(item.category);
    }

    // First reward with token data wins for the group header.
    if (item.tokenName && !group.tokenName) {
      group.tokenName = item.tokenName;
      group.tokenCost = item.tokenCost;
    }
  }

  // Sort groups: newest expansion first, then source type priority, then name.
  return Array.from(groups.values()).sort((a, b) => {
    const expA = EXPANSION_ORDER[a.expansion ?? ''] ?? 9;
    const expB = EXPANSION_ORDER[b.expansion ?? ''] ?? 9;
    if (expA !== expB) return expA - expB;

    const stA = SOURCE_TYPE_ORDER[a.sourceType ?? ''] ?? 99;
    const stB = SOURCE_TYPE_ORDER[b.sourceType ?? ''] ?? 99;
    if (stA !== stB) return stA - stB;

    return a.sourceDutyName.localeCompare(b.sourceDutyName);
  });
}

/**
 * Filter groups by category chip selection.
 * Returns groups that have AT LEAST ONE reward in the selected category.
 * Filters reward chips inside each group too.
 */
export function filterGroups(
  groups: SourceFarmGroup[],
  category: CatalogCategory | 'all',
  expansion: CatalogExpansion | 'all',
  sourceType: string | 'all',
  searchQuery: string,
): SourceFarmGroup[] {
  const q = searchQuery.trim().toLowerCase();

  return groups
    .filter(g => {
      if (expansion !== 'all' && g.expansion !== expansion) return false;
      if (sourceType !== 'all' && g.sourceType !== sourceType) return false;
      if (category !== 'all' && !g.categories.includes(category as CatalogCategory)) return false;
      if (q) {
        const haystack = [
          g.sourceDutyName,
          ...g.rewards.map(r => r.name),
          g.tokenName ?? '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .map(g => {
      // When filtering by category, only show reward chips for that category
      // (but keep full group visible so context isn't lost).
      if (category === 'all') return g;
      return {
        ...g,
        rewards: g.rewards.filter(r => r.category === category),
      };
    });
}

/** Count how many groups contain at least one reward of each category. */
export function countByCategory(
  groups: SourceFarmGroup[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of groups) {
    for (const cat of g.categories) {
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
  }
  return counts;
}
