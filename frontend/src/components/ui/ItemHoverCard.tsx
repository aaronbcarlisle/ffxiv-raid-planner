import type { ItemStats } from '../../types';

interface ItemHoverCardProps {
  itemName: string;
  itemLevel: number;
  itemIcon?: string;
  itemStats?: ItemStats;
  bisSource: 'raid' | 'tome';
  /** Whether the player has this item (shows "missing" indicator if false) */
  hasItem?: boolean;
  /** Whether the tome item is augmented (only relevant when bisSource is 'tome') */
  isAugmented?: boolean;
}

// Abbreviations for stat names
const STAT_ABBREV: Record<string, string> = {
  Strength: 'STR',
  Dexterity: 'DEX',
  Vitality: 'VIT',
  Intelligence: 'INT',
  Mind: 'MND',
  'Critical Hit': 'CRT',
  Determination: 'DET',
  'Direct Hit Rate': 'DH',
  'Skill Speed': 'SKS',
  'Spell Speed': 'SPS',
  Tenacity: 'TEN',
  Piety: 'PIE',
};

// Order stats should be displayed in
const STAT_ORDER = [
  'Strength',
  'Dexterity',
  'Intelligence',
  'Mind',
  'Vitality',
  'Critical Hit',
  'Determination',
  'Direct Hit Rate',
  'Skill Speed',
  'Spell Speed',
  'Tenacity',
  'Piety',
];

export function ItemHoverCard({
  itemName,
  itemLevel,
  itemIcon,
  itemStats,
  bisSource,
  hasItem,
  isAugmented,
}: ItemHoverCardProps) {
  // Sort and filter stats
  const sortedStats = itemStats
    ? STAT_ORDER.filter((stat) => itemStats[stat as keyof ItemStats])
        .map((stat) => ({
          name: stat,
          abbrev: STAT_ABBREV[stat] || stat,
          value: itemStats[stat as keyof ItemStats]!,
        }))
    : [];

  // Determine missing status text
  const getMissingText = () => {
    if (hasItem === undefined) return null; // Don't show if not specified
    if (hasItem) {
      // Has item - check if tome needs augment
      if (bisSource === 'tome' && !isAugmented) {
        return '(needs augment)';
      }
      return null; // Complete
    }
    return '(missing)';
  };

  const missingText = getMissingText();

  // Split stats into two columns
  const midPoint = Math.ceil(sortedStats.length / 2);
  const leftStats = sortedStats.slice(0, midPoint);
  const rightStats = sortedStats.slice(midPoint);

  return (
    <div className="min-w-[200px] max-w-[280px]">
      {/* Header with icon and name */}
      <div className="flex items-start gap-3 mb-2">
        {itemIcon && (
          <img
            src={itemIcon}
            alt={itemName}
            className="w-10 h-10 rounded border border-border-default"
          />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium leading-tight ${
              bisSource === 'raid' ? 'text-source-raid' : 'text-accent'
            }`}
          >
            {itemName}
            {missingText && (
              <span className="ml-1 text-text-muted">
                {missingText}
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">Item Level {itemLevel}</div>
        </div>
      </div>

      {/* Stats grid */}
      {sortedStats.length > 0 && (
        <>
          <div className="border-t border-border-default my-2" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div className="space-y-0.5">
              {leftStats.map((stat) => (
                <div key={stat.name} className="flex justify-between">
                  <span className="text-text-muted">{stat.abbrev}</span>
                  <span className="text-text-primary">+{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-0.5">
              {rightStats.map((stat) => (
                <div key={stat.name} className="flex justify-between">
                  <span className="text-text-muted">{stat.abbrev}</span>
                  <span className="text-text-primary">+{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Source badge */}
      <div className="border-t border-border-default mt-2 pt-2">
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            bisSource === 'raid'
              ? 'bg-source-raid/20 text-source-raid'
              : 'bg-accent/20 text-accent'
          }`}
        >
          {bisSource === 'raid' ? 'Savage' : 'Tomestone'}
        </span>
      </div>
    </div>
  );
}
