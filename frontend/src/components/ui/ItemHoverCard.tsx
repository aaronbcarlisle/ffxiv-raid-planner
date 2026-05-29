import type { ItemStats, GearSource, MateriaSlot } from '../../types';

interface ItemHoverCardProps {
  itemName?: string;
  itemLevel?: number;
  itemId?: number;
  itemIcon?: string;
  itemStats?: ItemStats;
  bisSource: GearSource | null;
  /** Whether the player has this item (shows "missing" indicator if false) */
  hasItem?: boolean;
  /** Whether the tome item is augmented (only relevant when bisSource is 'tome') */
  isAugmented?: boolean;
  /** Materia melds on this item */
  materia?: MateriaSlot[];
  /** Currently equipped item from Tomestone sync */
  equippedItemId?: number;
  equippedItemName?: string;
  equippedItemLevel?: number;
  equippedItemIcon?: string;
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

// Materia stat bonus by tier (secondary stats)
// Current as of FFXIV 7.x - tier XII is highest available
// Falls back to 0 for unknown tiers
const MATERIA_STAT_VALUES: Record<number, number> = {
  12: 54,
  11: 36,
  10: 18,
  9: 12,
  8: 6,
  7: 6,
  6: 6,
  5: 6,
  4: 5,
  3: 4,
  2: 3,
  1: 1,
};

type ComparisonState = 'matched' | 'upgrade' | 'no_bis' | 'not_detected' | 'none';

function getComparisonState(
  itemId: number | undefined,
  equippedItemId: number | undefined,
  hasBis: boolean,
  hasEquipped: boolean,
): ComparisonState {
  if (!hasBis && !hasEquipped) return 'none';
  if (hasBis && itemId && hasEquipped && equippedItemId !== undefined) {
    return equippedItemId === itemId ? 'matched' : 'upgrade';
  }
  if (hasBis && !hasEquipped) return 'not_detected';
  if (!hasBis && hasEquipped) return 'no_bis';
  return 'none';
}

export function ItemHoverCard({
  itemName,
  itemLevel,
  itemId,
  itemIcon,
  itemStats,
  bisSource,
  isAugmented: _isAugmented,
  materia,
  equippedItemId,
  equippedItemName,
  equippedItemLevel,
  equippedItemIcon,
}: ItemHoverCardProps) {
  const hasBis = !!(itemName || (itemLevel ?? 0) > 0);
  const hasEquipped = !!(equippedItemName || (equippedItemLevel ?? 0) > 0);
  const compState = getComparisonState(itemId, equippedItemId, hasBis, hasEquipped);

  // Sort and filter stats (BiS stats)
  const sortedStats = itemStats
    ? STAT_ORDER.filter((stat) => itemStats[stat as keyof ItemStats])
        .map((stat) => ({
          name: stat,
          abbrev: STAT_ABBREV[stat] || stat,
          value: itemStats[stat as keyof ItemStats]!,
        }))
    : [];

  // Split stats into two columns
  const midPoint = Math.ceil(sortedStats.length / 2);
  const leftStats = sortedStats.slice(0, midPoint);
  const rightStats = sortedStats.slice(midPoint);

  // Get color class for BiS source
  const getSourceColorClass = () => {
    if (bisSource === 'raid') return 'text-gear-raid';
    if (bisSource === 'crafted') return 'text-gear-crafted';
    if (bisSource === 'tome') return 'text-gear-tome';
    if (bisSource === 'base_tome') return 'text-gear-base-tome';
    return 'text-text-muted';
  };

  // Get source badge info
  const getSourceBadge = () => {
    if (bisSource === 'raid') return { text: 'Savage', classes: 'bg-gear-raid/20 text-gear-raid' };
    if (bisSource === 'crafted') return { text: 'Crafted', classes: 'bg-gear-crafted/20 text-gear-crafted' };
    if (bisSource === 'tome') return { text: 'Tome (Aug.)', classes: 'bg-gear-tome/20 text-gear-tome' };
    if (bisSource === 'base_tome') return { text: 'Base Tome', classes: 'bg-gear-base-tome/20 text-gear-base-tome' };
    return null;
  };

  // Comparison badge config
  const getComparisonBadge = () => {
    switch (compState) {
      case 'matched':
        return { text: 'BiS matched ✓', classes: 'bg-status-success/20 text-status-success' };
      case 'upgrade':
        return { text: 'Upgrade needed', classes: 'bg-status-warning/20 text-status-warning' };
      case 'not_detected':
        return { text: 'Not currently detected', classes: 'bg-surface-interactive text-text-muted' };
      case 'no_bis':
        return { text: 'No BiS target configured', classes: 'bg-surface-interactive text-text-muted' };
      default:
        return null;
    }
  };

  const sourceBadge = hasBis ? getSourceBadge() : null;
  const compBadge = getComparisonBadge();

  // Whether to show the equipped section (not needed when matched — BiS item IS the equipped item)
  const showEquippedSection = hasEquipped && compState !== 'matched';
  // Show a label on the BiS section when both sections will be visible
  const showBisLabel = hasBis && (showEquippedSection || compState === 'matched');

  return (
    <div className="min-w-[200px] max-w-[290px]">
      {/* BiS target section */}
      {hasBis && (
        <>
          {showBisLabel && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1">
              BiS target
            </div>
          )}

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
              <div className={`text-sm font-medium leading-tight ${getSourceColorClass()}`}>
                {itemName ?? '—'}
              </div>
              {(itemLevel ?? 0) > 0 && (
                <div className="text-xs text-text-muted mt-0.5">Item Level {itemLevel}</div>
              )}
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

          {/* Materia melds - horizontal layout */}
          {materia && materia.length > 0 && (
            <>
              <div className="border-t border-border-default my-2" />
              <div className="flex flex-wrap gap-3 text-xs">
                {materia.map((m, idx) => {
                  const statValue = m.tier ? MATERIA_STAT_VALUES[m.tier] || 0 : 0;
                  const statAbbrev = STAT_ABBREV[m.stat || ''] || m.stat || '';
                  const fullStatName = m.stat || m.itemName;
                  const tooltipText = `${m.itemName}: +${statValue} ${fullStatName}`;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1 cursor-default"
                      title={tooltipText}
                    >
                      {m.icon && (
                        <img
                          src={m.icon}
                          alt={m.itemName}
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <span className="text-text-primary">
                        {statValue > 0 && <span className="text-text-muted">{statValue} </span>}
                        {statAbbrev}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Currently wearing section — shown when equipped data exists and is a different item than BiS */}
      {showEquippedSection && (
        <>
          <div className="border-t border-border-default my-2" />
          <div className="text-xs text-text-muted mb-1">Currently wearing</div>
          <div className="flex items-center gap-2">
            {equippedItemIcon && (
              <img
                src={equippedItemIcon}
                alt={equippedItemName ?? 'Equipped item'}
                className="w-7 h-7 rounded border border-border-default shrink-0"
              />
            )}
            <div className="min-w-0">
              {equippedItemName && (
                <p className="text-xs text-text-secondary leading-tight truncate">{equippedItemName}</p>
              )}
              {(equippedItemLevel ?? 0) > 0 && (
                <p className="text-[11px] text-text-muted mt-0.5">
                  iLv {equippedItemLevel}
                  {(itemLevel ?? 0) > 0 && equippedItemLevel !== itemLevel && (
                    <span className="ml-1 text-status-warning">
                      ({(itemLevel ?? 0) - (equippedItemLevel ?? 0) > 0 ? '+' : ''}{(itemLevel ?? 0) - (equippedItemLevel ?? 0)} vs BiS)
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer: source badge + comparison badge */}
      {(sourceBadge || compBadge) && (
        <div className="border-t border-border-default mt-2 pt-2 flex flex-wrap gap-1.5">
          {sourceBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${sourceBadge.classes}`}>
              {sourceBadge.text}
            </span>
          )}
          {compBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${compBadge.classes}`}>
              {compBadge.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
