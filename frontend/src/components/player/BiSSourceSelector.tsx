/**
 * BiSSourceSelector - 2x2 grid BiS source selection
 *
 * Popover layout:
 *   [  Raid ] [  Tome ]
 *   [Crafted] [B. Tome]
 *        Clear Slot
 *
 * Based on TankRoleSelector pattern with Popover.
 */

import { useState } from 'react';
import type { GearSource, TomeWeaponStatus, ItemStats } from '../../types';
import { BIS_SOURCE_FULL_NAMES } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Tooltip } from '../primitives/Tooltip'; // Only used for WeaponBiSSelector
import { ConfirmModal } from '../ui/ConfirmModal';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { ArrowRight } from 'lucide-react';
import { logger as baseLogger } from '../../lib/logger';

const logger = baseLogger.scope('bis-source');

// BiS source display info
const BIS_SOURCE_INFO: Record<GearSource, { short: string; label: string; description: string }> = {
  raid: {
    short: 'R',
    label: 'Raid',
    description: 'BiS gear from Savage raids',
  },
  tome: {
    short: 'T',
    label: 'Tome',
    description: 'Tomestone gear that needs augmentation',
  },
  base_tome: {
    short: 'BT',
    label: 'B. Tome',
    description: 'Tomestone gear where base version is BiS',
  },
  crafted: {
    short: 'C',
    label: 'Crafted',
    description: 'Crafted pentamelded gear',
  },
};

// Grid layout: 2 rows x 2 columns
const GRID_LAYOUT: GearSource[][] = [
  ['raid', 'tome'],
  ['crafted', 'base_tome'],
];

/**
 * Color mapping for BiS sources - uses gear color tokens from design system
 */
const SOURCE_COLORS: Record<GearSource, { bg: string; text: string; bgFaded: string; bgHover: string }> = {
  raid: { bg: 'bg-gear-raid', text: 'text-gear-raid', bgFaded: 'bg-gear-raid/20', bgHover: 'hover:bg-gear-raid/30' },
  tome: { bg: 'bg-gear-tome', text: 'text-gear-tome', bgFaded: 'bg-gear-tome/20', bgHover: 'hover:bg-gear-tome/30' },
  base_tome: { bg: 'bg-gear-base-tome', text: 'text-gear-base-tome', bgFaded: 'bg-gear-base-tome/20', bgHover: 'hover:bg-gear-base-tome/30' },
  crafted: { bg: 'bg-gear-crafted', text: 'text-gear-crafted', bgFaded: 'bg-gear-crafted/20', bgHover: 'hover:bg-gear-crafted/30' },
};

/**
 * Get color classes for a BiS source button
 */
function getSourceButtonClasses(source: GearSource, isSelected: boolean): string {
  const baseClasses = 'px-2 py-1 rounded text-xs font-bold transition-colors';
  const colors = SOURCE_COLORS[source];

  return isSelected
    ? `${baseClasses} ${colors.bg} text-surface-base`
    : `${baseClasses} ${colors.bgFaded} ${colors.text} ${colors.bgHover}`;
}

/**
 * Get trigger button classes based on current source
 * Fixed width (w-7) to accommodate 2-character labels like "BT"
 */
function getTriggerClasses(source: GearSource | null, disabled: boolean): string {
  const baseClasses = 'w-7 py-0.5 rounded text-xs font-bold transition-colors text-center';

  if (!source) {
    return disabled
      ? `${baseClasses} bg-surface-interactive text-text-muted opacity-50 cursor-not-allowed`
      : `${baseClasses} bg-surface-interactive text-text-muted hover:text-text-secondary`;
  }

  const colors = SOURCE_COLORS[source];
  return disabled
    ? `${baseClasses} ${colors.bgFaded} ${colors.text} opacity-50 cursor-not-allowed`
    : `${baseClasses} ${colors.bgFaded} ${colors.text} ${colors.bgHover}`;
}

interface BiSSourceSelectorProps {
  /** Current BiS source (null for unset) */
  bisSource: GearSource | null;
  /** Called when BiS source changes */
  onSelect: (source: GearSource | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Reason shown in tooltip when disabled */
  disabledReason?: string;
  /** Whether slot has imported item data that would be cleared on source change */
  hasItemData?: boolean;
  /** Item name for confirmation message */
  itemName?: string;
  /** Current item icon URL (from BiS import) */
  itemIcon?: string;
  /** Generic slot icon URL (fallback/placeholder) */
  slotIcon?: string;
  /** Item level for hover card */
  itemLevel?: number;
  /** Item stats for hover card */
  itemStats?: ItemStats;
  /** Whether player has this item */
  hasItem?: boolean;
  /** Whether item is augmented */
  isAugmented?: boolean;
}

/**
 * Determine if confirmation is needed for a source change operation.
 * Returns true if the slot has any data that would be lost.
 */
function shouldConfirmSourceChange(
  hasItemData: boolean,
  hasItem: boolean | undefined,
  isAugmented: boolean | undefined,
  currentSource: GearSource | null,
  newSource: GearSource | null
): boolean {
  // No confirmation needed if not actually changing
  if (newSource !== null && newSource === currentSource) return false;

  // Confirm if any data would be lost
  return hasItemData || !!hasItem || !!isAugmented || (newSource === null && currentSource !== null);
}

export function BiSSourceSelector({
  bisSource,
  onSelect,
  disabled = false,
  disabledReason,
  hasItemData = false,
  itemName,
  itemIcon,
  slotIcon,
  itemLevel,
  itemStats,
  hasItem,
  isAugmented,
}: BiSSourceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'source-change' | 'clear';
    pendingSource?: GearSource;
  } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSelect = (source: GearSource) => {
    // Check if confirmation is needed before changing source
    if (shouldConfirmSourceChange(hasItemData, hasItem, isAugmented, bisSource, source)) {
      setConfirmModal({ type: 'source-change', pendingSource: source });
      return;
    }
    onSelect(source);
    setOpen(false);
  };

  const handleClear = () => {
    // Check if confirmation is needed before clearing
    if (shouldConfirmSourceChange(hasItemData, hasItem, isAugmented, bisSource, null)) {
      setConfirmModal({ type: 'clear' });
      return;
    }
    onSelect(null);
    setOpen(false);
  };

  const handleConfirm = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      if (confirmModal?.type === 'source-change' && confirmModal.pendingSource) {
        await Promise.resolve(onSelect(confirmModal.pendingSource));
      } else if (confirmModal?.type === 'clear') {
        await Promise.resolve(onSelect(null));
      }
      setConfirmModal(null);
      setOpen(false);
    } catch (error) {
      // Error during onSelect callback - log but don't crash
      // Parent component is responsible for error handling/toast display
      logger.error('Error during source change:', error);
    } finally {
      setIsPending(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmModal(null);
  };

  // Get display label and ARIA label
  const displayLabel = bisSource ? BIS_SOURCE_INFO[bisSource].short : '--';
  const ariaLabel = disabled && disabledReason
    ? disabledReason
    : bisSource
      ? `BiS source: ${BIS_SOURCE_FULL_NAMES[bisSource]}`
      : 'BiS source not set';

  // Icon comparison header for confirmation dialogs - compact horizontal layout with dark background
  const getConfirmHeader = () => {
    if (!itemIcon || !slotIcon) return undefined;

    // For source changes, show the new source label; for clear, show "Empty"
    const isSourceChange = confirmModal?.type === 'source-change' && confirmModal.pendingSource;
    const targetLabel = isSourceChange
      ? BIS_SOURCE_INFO[confirmModal.pendingSource!].label
      : 'Empty';

    // Render hover card content if we have full item data
    const hoverCardContent = itemName && itemLevel ? (
      <ItemHoverCard
        itemName={itemName}
        itemLevel={itemLevel}
        itemIcon={itemIcon}
        itemStats={itemStats}
        bisSource={bisSource}
        hasItem={hasItem}
        isAugmented={isAugmented}
      />
    ) : itemName;

    return (
      <div className="flex items-center justify-center gap-2 p-3 bg-surface-base rounded-lg border border-border-default text-sm">
        <Tooltip content={hoverCardContent}>
          <img
            src={itemIcon}
            alt={itemName || 'Current gear'}
            className="w-6 h-6 rounded flex-shrink-0 cursor-help"
            onError={(e) => {
              // Fall back to slot icon if item icon fails to load
              if (slotIcon) (e.target as HTMLImageElement).src = slotIcon;
            }}
          />
        </Tooltip>
        <span className="text-text-secondary truncate min-w-0">{itemName}</span>
        <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        <img
          src={slotIcon}
          alt={targetLabel}
          className="w-6 h-6 opacity-50 flex-shrink-0"
          onError={(e) => {
            // Hide broken image icon
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="text-text-muted flex-shrink-0">{targetLabel}</span>
      </div>
    );
  };

  // Determine confirmation message
  const getConfirmMessage = () => {
    if (confirmModal?.type === 'source-change') {
      const newSourceLabel = confirmModal.pendingSource
        ? BIS_SOURCE_INFO[confirmModal.pendingSource].label
        : '';
      return `Changing BiS source to ${newSourceLabel} will clear the current gear data for this slot.`;
    }
    return 'Clear this slot? All gear data will be reset.';
  };

  return (
    <>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* design-system-ignore: Badge-style button with specific toggle styling */}
          <button
            className={getTriggerClasses(bisSource, disabled)}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-disabled={disabled}
          >
            {displayLabel}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={4} className="p-2 w-auto">
          {/* 2x2 grid layout */}
          <div className="grid grid-cols-2 gap-1">
            {GRID_LAYOUT.flat().map((source) => {
              const isSelected = bisSource === source;
              return (
                <button
                  key={source}
                  onClick={() => handleSelect(source)}
                  className={`${getSourceButtonClasses(source, isSelected)} min-w-[4rem] text-center`}
                  aria-label={`${BIS_SOURCE_INFO[source].label}: ${BIS_SOURCE_INFO[source].description}`}
                  aria-pressed={isSelected}
                >
                  {BIS_SOURCE_INFO[source].label}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Clear Slot
          </button>
        </PopoverContent>
      </Popover>

      <ConfirmModal
        isOpen={confirmModal !== null}
        title={confirmModal?.type === 'source-change' ? 'Change BiS Source' : 'Clear Slot'}
        header={getConfirmHeader()}
        message={getConfirmMessage()}
        confirmLabel={confirmModal?.type === 'source-change' ? 'Change' : 'Clear'}
        variant="warning"
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />
    </>
  );
}

/**
 * WeaponBiSSelector - Special selector for weapon slot
 *
 * Shows "Raid" as fixed label with a + toggle for tome weapon tracking.
 * Weapon BiS is always raid - the + toggle is for interim tome weapon.
 */
interface WeaponBiSSelectorProps {
  /** Tome weapon tracking status */
  tomeWeapon: TomeWeaponStatus;
  /** Called when tome weapon status changes */
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Reason shown in tooltip when disabled */
  disabledReason?: string;
}

export function WeaponBiSSelector({
  tomeWeapon,
  onTomeWeaponChange,
  disabled = false,
  disabledReason,
}: WeaponBiSSelectorProps) {
  return (
    <div className="flex justify-center gap-1">
      {/* Raid is always on for weapon - fixed width to match other BiS badges */}
      <span className={`inline-flex items-center justify-center w-7 py-0.5 rounded text-xs bg-gear-raid/20 text-gear-raid font-bold ${disabled ? 'opacity-50' : ''}`}>
        R
      </span>
      {/* + is a toggle for interim tome weapon */}
      <Tooltip
        content={
          disabled
            ? disabledReason
            : tomeWeapon.pursuing
              ? 'Stop tracking tome weapon'
              : 'Track interim tome weapon'
        }
      >
        <button
          onClick={() => onTomeWeaponChange({ pursuing: !tomeWeapon.pursuing })}
          className={`inline-flex items-center justify-center w-6 py-0.5 rounded text-xs font-bold transition-colors ${
            tomeWeapon.pursuing
              ? 'bg-gear-tome/20 text-gear-tome'
              : `bg-surface-interactive text-text-muted ${!disabled ? 'hover:text-text-secondary' : ''}`
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          +
        </button>
      </Tooltip>
    </div>
  );
}
