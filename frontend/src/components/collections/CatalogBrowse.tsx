import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../primitives/Button';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CatalogCategory, CatalogExpansion, CollectionGoal } from '../../stores/collectionGoalStore';
import { CatalogFarmRow } from './CatalogFarmRow';

interface CatalogBrowseProps {
  groupId: string;
  activeGoals: CollectionGoal[];
  myParticipantTokenCounts: Record<string, number>; // catalogItemId → token count
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
  const { catalog, catalogLoading, catalogLoaded, fetchCatalog } = useCollectionGoalStore();

  const [activeCategory, setActiveCategory] = useState<CatalogCategory | 'all'>('all');
  const [activeExpansion, setActiveExpansion] = useState<CatalogExpansion | 'all'>('all');

  useEffect(() => {
    if (!catalogLoaded) fetchCatalog();
  }, [catalogLoaded, fetchCatalog]);

  // Build lookup: catalogItemId → goal
  const goalByCatalogId = useMemo(() => {
    const map: Record<string, CollectionGoal> = {};
    for (const g of activeGoals) {
      if (g.catalogItemId) map[g.catalogItemId] = g;
    }
    return map;
  }, [activeGoals]);

  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (activeExpansion !== 'all' && item.expansion !== activeExpansion) return false;
      return true;
    });
  }, [catalog, activeCategory, activeExpansion]);

  // Curated items first, then alphabetical
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isCurated !== b.isCurated) return a.isCurated ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Loading catalog…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* Catalog rows */}
      {sorted.length === 0 ? (
        <p className="text-text-muted text-sm py-4 text-center">
          No items match the current filters.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <CatalogFarmRow
              key={item.id}
              item={item}
              groupId={groupId}
              existingGoal={goalByCatalogId[item.id]}
              myTokenCount={myParticipantTokenCounts[item.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
