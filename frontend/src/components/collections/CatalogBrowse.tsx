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
import { groupCatalogBySource, filterGroups, countByCategory, countBySourceType, totalRewardCount } from '../../utils/collectionSourceGrouping';
import { SourceFarmCard } from './SourceFarmCard';
import { FALLBACK_CATALOG } from '../../data/curatedCatalog';
import {
  EXPANSION_FULL,
  EXPANSION_SHORT,
  EXPANSION_KEYS,
  SOURCE_TYPE_BADGE,
  SOURCE_TYPE_ACTIVE_CLASS,
} from '../../utils/collectionBadgeConfig';

interface CatalogBrowseProps {
  groupId: string;
  activeGoals: CollectionGoal[];
}

// Categories shown as filter chips, in display order.
// Labels reflect what the curated catalog actually contains:
//   Mounts / Music   = all extreme+ultimate trial rewards  (comprehensive)
//   Trial Minions    = only farm-obtained minions, not vendor/achievement
//   Ultimate Weapons = only ultimate weapon farm groups, not savage BiS drops
const CHIP_CATEGORIES: { key: CatalogCategory; label: string }[] = [
  { key: 'mount',       label: 'Mounts'           },
  { key: 'orchestrion', label: 'Music'             },
  { key: 'minion',      label: 'Trial Minions'     },
  { key: 'weapon',      label: 'Ultimate Weapons'  },
  { key: 'other',       label: 'Rare'              },
];

// Source type chips are built dynamically from data; never hardcoded.
// This prevents showing "Savage" when there are zero Savage source groups.
// Active classes imported from shared badge config.
const SOURCE_TYPE_ORDER = ['ultimate', 'savage', 'extreme', 'criterion', 'chaotic_alliance', 'collaboration', 'field_operation'];

// Expansion chips use full names on sm+, abbreviations on mobile — labels resolved in JSX.
const EXPANSION_CHIP_KEYS = EXPANSION_KEYS as unknown as CatalogExpansion[];

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
  }, [catalog, catalogLoaded, catalogLoading, usingFallback]);

  // Group items by source/duty
  const allGroups = useMemo(() => groupCatalogBySource(effectiveCatalog), [effectiveCatalog]);

  // Category chips count individual reward items (not source groups) so numbers are consistent:
  // "Mounts 41" = 41 mount items, "Music 38" = 38 orchestrion items, etc.
  const categoryCounts = useMemo(() => countByCategory(allGroups), [allGroups]);

  // Total reward items across all groups — used for the "All rewards" chip label.
  const totalRewards = useMemo(() => totalRewardCount(allGroups), [allGroups]);

  // Source type counts (groups, not items) — chips are hidden when count is 0.
  const sourceTypeCounts = useMemo(() => countBySourceType(allGroups), [allGroups]);

  // Sorted, non-zero source type chips derived from actual data.
  const sourceTypeChips = useMemo(
    () =>
      SOURCE_TYPE_ORDER
        .filter(st => (sourceTypeCounts[st] ?? 0) > 0)
        .map(st => ({
          key: st,
          label: SOURCE_TYPE_BADGE[st]?.label ?? st,
          count: sourceTypeCounts[st] ?? 0,
          activeClass: SOURCE_TYPE_ACTIVE_CLASS[st] ?? 'bg-surface-raised text-text-primary ring-1 ring-accent',
        })),
    [sourceTypeCounts],
  );

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
          // eslint-disable-next-line design-system/no-raw-button
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Result summary + inline clear */}
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">{allGroups.length}</span> farm sources
          {' · '}
          <span className="font-medium text-text-secondary">{totalRewards}</span> rewards
          {hasActiveFilters && (
            <>
              {' · '}
              <span className="text-accent font-medium">{visibleGroups.length} showing</span>
            </>
          )}
        </p>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="flex items-center gap-1 text-text-muted hover:text-text-primary text-xs h-auto py-0.5 px-1.5"
          >
            <X size={11} /> Clear
          </Button>
        )}
      </div>

      {/* Category chips — counts = individual reward items (same unit across all chips) */}
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
          <span className="ml-1.5 opacity-60 font-normal">{totalRewards}</span>
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
        {/* Source type — built from actual data, hidden when count is 0 (no Savage if no Savage rows) */}
        <div className="flex gap-1 flex-wrap">
          {sourceTypeChips.map(({ key, label, count, activeClass }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => setActiveSourceType(key === activeSourceType ? 'all' : key)}
              className={`rounded-md text-xs px-2.5 py-1 transition-colors ${
                activeSourceType === key
                  ? activeClass
                  : 'bg-surface-card text-text-muted hover:bg-surface-hover'
              }`}
            >
              {label}
              <span className="ml-1 opacity-60 font-normal">{count}</span>
            </Button>
          ))}
        </div>

        <span className="w-px h-4 bg-border-subtle self-center flex-shrink-0" />

        {/* Expansion */}
        <div className="flex gap-1 flex-wrap">
          {EXPANSION_CHIP_KEYS.map(key => (
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
              {/* Full expansion name on sm+, abbreviation on mobile */}
              <span className="hidden sm:inline">{EXPANSION_FULL[key]}</span>
              <span className="sm:hidden">{EXPANSION_SHORT[key]}</span>
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
        <div className="flex flex-col gap-2.5">
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
