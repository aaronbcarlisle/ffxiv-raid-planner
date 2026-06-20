import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Filter, Music, Ghost } from 'lucide-react';
import { Button } from '../primitives/Button';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CatalogItem, CatalogCategory, CatalogExpansion, CollectionGoal } from '../../stores/collectionGoalStore';
import { FALLBACK_CATALOG } from '../../data/curatedCatalog';
import { CatalogFarmRow } from './CatalogFarmRow';

interface CatalogBrowseProps {
  groupId: string;
  activeGoals: CollectionGoal[];
  myParticipantTokenCounts: Record<string, number>;
}

const CATEGORY_TABS: { key: CatalogCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mount', label: 'Mounts' },
  { key: 'orchestrion', label: 'Music' },
  { key: 'minion', label: 'Minions' },
  { key: 'weapon', label: 'Weapons' },
  { key: 'other', label: 'Other' },
];

const EXPANSION_FILTERS: { key: CatalogExpansion | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dt', label: 'Dawntrail' },
  { key: 'ew', label: 'Endwalker' },
  { key: 'shb', label: 'Shadowbringers' },
  { key: 'sb', label: 'Stormblood' },
  { key: 'hw', label: 'Heavensward' },
  { key: 'arr', label: 'A Realm Reborn' },
];

export function CatalogBrowse({ groupId, activeGoals, myParticipantTokenCounts }: CatalogBrowseProps) {
  const { catalog, catalogLoading, catalogLoaded, catalogError, fetchCatalog } = useCollectionGoalStore();

  function retry() {
    // Reset loaded state so the effect triggers again, then fetch
    useCollectionGoalStore.setState({ catalogLoaded: false, catalogError: null });
    fetchCatalog();
  }

  const [activeCategory, setActiveCategory] = useState<CatalogCategory | 'all'>('all');
  const [activeExpansion, setActiveExpansion] = useState<CatalogExpansion | 'all'>('all');

  useEffect(() => {
    if (!catalogLoaded && !catalogLoading) fetchCatalog();
  }, [catalogLoaded, catalogLoading, fetchCatalog]);

  // Fall back to static curated data if API failed or returned empty
  const usingFallback = !catalogLoading && (catalogError !== null || (catalogLoaded && catalog.length === 0));
  const effectiveCatalog: CatalogItem[] = usingFallback ? FALLBACK_CATALOG : catalog;

  // Build lookup: catalogItemId → goal
  const goalByCatalogId = useMemo(() => {
    const map: Record<string, CollectionGoal> = {};
    for (const g of activeGoals) {
      if (g.catalogItemId) map[g.catalogItemId] = g;
    }
    return map;
  }, [activeGoals]);

  const filtered = useMemo(() => {
    return effectiveCatalog.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (activeExpansion !== 'all' && item.expansion !== activeExpansion) return false;
      return true;
    });
  }, [effectiveCatalog, activeCategory, activeExpansion]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isCurated !== b.isCurated) return a.isCurated ? -1 : 1;
      // Expansion order: dt first, then ew, then older
      const expOrder: Record<string, number> = { dt: 0, ew: 1, shb: 2, sb: 3, hw: 4, arr: 5 };
      const expDiff = (expOrder[a.expansion ?? ''] ?? 9) - (expOrder[b.expansion ?? ''] ?? 9);
      if (expDiff !== 0) return expDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const hasActiveFilters = activeCategory !== 'all' || activeExpansion !== 'all';

  // True when the selected category has zero items anywhere in the catalog
  // (not a filter mismatch — the whole category is unpopulated)
  const COLLECT_SYNCED_CATEGORIES: (CatalogCategory | 'all')[] = ['orchestrion', 'minion', 'other'];
  const categoryTotallyEmpty =
    activeCategory !== 'all' &&
    !usingFallback &&
    COLLECT_SYNCED_CATEGORIES.includes(activeCategory) &&
    effectiveCatalog.filter((item) => item.category === activeCategory).length === 0;

  function clearFilters() {
    setActiveCategory('all');
    setActiveExpansion('all');
  }

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Loading catalog…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fallback warning banner */}
      {usingFallback && (
        <div className="flex items-center gap-2 bg-status-warning/10 border border-status-warning/30 text-status-warning rounded-xl px-4 py-2.5 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span className="flex-1">
            {catalogError
              ? 'Catalog service unavailable — showing built-in curated farms. Track is disabled until the service recovers.'
              : 'Catalog returned empty — showing built-in curated farms.'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={retry}
            className="flex items-center gap-1 text-status-warning hover:bg-status-warning/10"
          >
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORY_TABS.map(({ key, label }) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory(key)}
            className={`rounded-lg text-sm font-medium transition-colors ${
              activeCategory === key
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-surface-card text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Expansion filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {EXPANSION_FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => setActiveExpansion(key)}
            className={`rounded-full text-xs font-medium transition-colors px-2.5 py-1 ${
              activeExpansion === key
                ? 'bg-surface-raised text-text-primary ring-1 ring-accent'
                : 'bg-surface-card text-text-muted hover:bg-surface-hover'
            }`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Catalog rows or empty state */}
      {sorted.length === 0 ? (
        categoryTotallyEmpty ? (
          <div className="flex flex-col items-center gap-3 py-10 text-text-muted">
            {activeCategory === 'orchestrion' ? (
              <Music size={32} className="opacity-30" />
            ) : activeCategory === 'minion' ? (
              <Ghost size={32} className="opacity-30" />
            ) : (
              <Filter size={32} className="opacity-30" />
            )}
            <p className="font-medium text-sm">
              {activeCategory === 'orchestrion' ? 'Music rolls' : activeCategory === 'minion' ? 'Minions' : 'Items'} are loading from FFXIV Collect
            </p>
            <p className="text-xs opacity-60 text-center max-w-xs">
              These populate automatically in the background. Refresh in a moment to see orchestrion rolls, minions, and other collectables.
            </p>
            <Button variant="ghost" size="sm" onClick={() => fetchCatalog()} className="flex items-center gap-1">
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>
        ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-text-muted">
          <Filter size={32} className="opacity-30" />
          <p className="font-medium text-sm">No items match these filters</p>
          {hasActiveFilters && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setActiveCategory('all'); setActiveExpansion('all'); }}>
                Show all
              </Button>
            </div>
          )}
        </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <CatalogFarmRow
              key={item.id}
              item={item}
              groupId={groupId}
              existingGoal={goalByCatalogId[item.id]}
              myTokenCount={myParticipantTokenCounts[item.id]}
              trackDisabled={usingFallback}
            />
          ))}
        </div>
      )}
    </div>
  );
}
