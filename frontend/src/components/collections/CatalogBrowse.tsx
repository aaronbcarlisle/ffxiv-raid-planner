/**
 * CatalogBrowse — Collections & Farms board.
 *
 * Renders one SourceFarmCard per source/duty instead of one row per reward.
 * Category chips show counts and hide when 0. Filters don't destroy grouping:
 * selecting "Mounts" shows only groups that have a mount reward, while
 * keeping other rewards visible inside expanded cards.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Input } from '../../components/ui/Input';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CatalogCategory, CatalogExpansion, CollectionGoal } from '../../stores/collectionGoalStore';
import { groupCatalogBySource, filterGroups, countByCategory } from '../../utils/collectionSourceGrouping';
import { SourceFarmCard } from './SourceFarmCard';
import { FALLBACK_CATALOG } from '../../data/curatedCatalog';

interface CatalogBrowseProps {
  groupId: string;
  activeGoals: CollectionGoal[];
}

// Categories shown as filter chips, in display order.
const CHIP_CATEGORIES: { key: CatalogCategory; label: string }[] = [
  { key: 'mount',       label: 'Mounts'   },
  { key: 'orchestrion', label: 'Music'    },
  { key: 'minion',      label: 'Minions'  },
  { key: 'weapon',      label: 'Weapons'  },
  { key: 'other',       label: 'Rare'     },
];

const SOURCE_TYPE_CHIPS: { key: string; label: string }[] = [
  { key: 'extreme',  label: 'Extreme'  },
  { key: 'savage',   label: 'Savage'   },
  { key: 'ultimate', label: 'Ultimate' },
];

const EXPANSION_CHIPS: { key: CatalogExpansion; label: string }[] = [
  { key: 'dt',  label: 'DT'  },
  { key: 'ew',  label: 'EW'  },
  { key: 'shb', label: 'ShB' },
  { key: 'sb',  label: 'SB'  },
  { key: 'hw',  label: 'HW'  },
  { key: 'arr', label: 'ARR' },
];

export function CatalogBrowse({ groupId, activeGoals }: CatalogBrowseProps) {
  const { catalog, catalogLoading, catalogLoaded, catalogError, fetchCatalog } = useCollectionGoalStore();

  const [activeCategory, setActiveCategory] = useState<CatalogCategory | 'all'>('all');
  const [activeExpansion, setActiveExpansion] = useState<CatalogExpansion | 'all'>('all');
  const [activeSourceType, setActiveSourceType] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!catalogLoaded && !catalogLoading) fetchCatalog();
  }, [catalogLoaded, catalogLoading, fetchCatalog]);

  // Fall back to static curated data if API failed or returned empty
  const usingFallback = !catalogLoading && (catalogError !== null || (catalogLoaded && catalog.length === 0));

  // When orchestrion isn't in the live catalog yet, supplement from fallback
  const effectiveCatalog = useMemo(() => {
    if (usingFallback) return FALLBACK_CATALOG;
    if (!catalogLoaded || catalogLoading) return [];
    const missing = (['orchestrion'] as CatalogCategory[]).filter(
      cat => !catalog.some(i => i.category === cat),
    );
    if (missing.length === 0) return catalog;
    return [...catalog, ...FALLBACK_CATALOG.filter(i => missing.includes(i.category as CatalogCategory))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, catalogLoaded, catalogLoading, usingFallback]);

  // Group items by source/duty
  const allGroups = useMemo(() => groupCatalogBySource(effectiveCatalog), [effectiveCatalog]);

  // Count per category for chip badges
  const categoryCounts = useMemo(() => countByCategory(allGroups), [allGroups]);

  // Apply filters
  const visibleGroups = useMemo(
    () => filterGroups(allGroups, activeCategory, activeExpansion, activeSourceType, searchQuery),
    [allGroups, activeCategory, activeExpansion, activeSourceType, searchQuery],
  );

  // Goal lookup by catalog item id
  const goalsByItemId = useMemo(() => {
    const map: Record<string, CollectionGoal> = {};
    for (const g of activeGoals) {
      if (g.catalogItemId) map[g.catalogItemId] = g;
    }
    return map;
  }, [activeGoals]);

  const hasActiveFilters =
    activeCategory !== 'all' || activeExpansion !== 'all' ||
    activeSourceType !== 'all' || searchQuery.trim() !== '';

  function clearFilters() {
    setActiveCategory('all');
    setActiveExpansion('all');
    setActiveSourceType('all');
    setSearchQuery('');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Loading collection catalog…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Error banner */}
      {usingFallback && (
        <div className="flex items-center gap-2 bg-status-warning/10 border border-status-warning/30 text-status-warning rounded-xl px-4 py-2.5 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span className="flex-1">
            {catalogError
              ? 'Catalog service unavailable — showing built-in curated farms.'
              : 'Catalog returned empty — showing built-in curated farms.'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              useCollectionGoalStore.setState({ catalogLoaded: false, catalogError: null });
              fetchCatalog();
            }}
            className="flex items-center gap-1 text-status-warning hover:bg-status-warning/10"
          >
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search duties, rewards, tokens…"
          className="pl-8 pr-8"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category chips with counts */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveCategory('all')}
          className={`rounded-full text-xs font-medium px-3 py-1 transition-colors ${
            activeCategory === 'all'
              ? 'bg-accent text-white hover:bg-accent/90'
              : 'bg-surface-card text-text-secondary hover:bg-surface-hover'
          }`}
        >
          All
          <span className="ml-1.5 opacity-60 font-normal">{allGroups.length}</span>
        </Button>
        {CHIP_CATEGORIES.map(({ key, label }) => {
          const count = categoryCounts[key] ?? 0;
          if (count === 0) return null; // hide empty categories
          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory(key === activeCategory ? 'all' : key)}
              className={`rounded-full text-xs font-medium px-3 py-1 transition-colors ${
                activeCategory === key
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-surface-card text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {label}
              <span className="ml-1.5 opacity-60 font-normal">{count}</span>
            </Button>
          );
        })}
      </div>

      {/* Source type + expansion chips */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* Source type */}
        <div className="flex gap-1 flex-wrap">
          {SOURCE_TYPE_CHIPS.map(({ key, label }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => setActiveSourceType(key === activeSourceType ? 'all' : key)}
              className={`rounded-md text-xs px-2.5 py-1 transition-colors ${
                activeSourceType === key
                  ? key === 'extreme'
                    ? 'bg-status-warning/20 text-status-warning ring-1 ring-status-warning/50'
                    : key === 'savage'
                    ? 'bg-status-error/20 text-status-error ring-1 ring-status-error/50'
                    : 'bg-status-info/20 text-status-info ring-1 ring-status-info/50'
                  : 'bg-surface-card text-text-muted hover:bg-surface-hover'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>

        <span className="text-border-default text-xs">|</span>

        {/* Expansion */}
        <div className="flex gap-1 flex-wrap">
          {EXPANSION_CHIPS.map(({ key, label }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => setActiveExpansion(key === activeExpansion ? 'all' : key)}
              className={`rounded-md text-xs px-2.5 py-1 transition-colors ${
                activeExpansion === key
                  ? 'bg-surface-raised text-text-primary ring-1 ring-accent'
                  : 'bg-surface-card text-text-muted hover:bg-surface-hover'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Cards or empty state */}
      {visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-text-muted">
          <Search size={32} className="opacity-20" />
          <p className="font-medium text-sm">
            {hasActiveFilters ? 'No farms match these filters' : 'No catalog data available'}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-1">
              <X size={13} /> Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleGroups.map(group => (
            <SourceFarmCard
              key={group.sourceDutyKey}
              group={group}
              groupId={groupId}
              goalsByItemId={goalsByItemId}
              trackDisabled={usingFallback}
            />
          ))}
        </div>
      )}
    </div>
  );
}
