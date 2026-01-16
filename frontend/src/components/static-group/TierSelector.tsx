/**
 * Tier Selector
 *
 * Dropdown for switching between tier snapshots.
 * Shows the most recent tier with a "current" badge,
 * with older tiers in a "Previous Tiers" submenu.
 */

import { History } from 'lucide-react';
import { getTierById, RAID_TIERS } from '../../gamedata';
import type { TierSnapshot } from '../../types';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownTrigger,
  Tooltip,
} from '../primitives';

interface TierSelectorProps {
  tiers: TierSnapshot[];
  currentTierId?: string;
  onTierChange: (tierId: string) => void;
}

export function TierSelector({
  tiers,
  currentTierId,
  onTierChange,
}: TierSelectorProps) {
  // Get current tier info (currently selected in the UI)
  const selectedTier = tiers.find((t) => t.tierId === currentTierId);
  const selectedTierInfo = selectedTier ? getTierById(selectedTier.tierId) : null;

  // Find the most recent tier (the one marked as isCurrent in gamedata, or first in RAID_TIERS order)
  const getMostRecentTier = () => {
    // First, try to find a tier marked as isCurrent
    for (const tier of tiers) {
      const info = getTierById(tier.tierId);
      if (info?.isCurrent) return tier;
    }
    // Fallback: find the tier that appears earliest in RAID_TIERS (most recent)
    const tierOrder = RAID_TIERS.map(t => t.id);
    return tiers.reduce((mostRecent, tier) => {
      const currentIdx = tierOrder.indexOf(tier.tierId);
      const mostRecentIdx = tierOrder.indexOf(mostRecent.tierId);
      // Lower index = more recent (RAID_TIERS has current first)
      if (currentIdx !== -1 && (mostRecentIdx === -1 || currentIdx < mostRecentIdx)) {
        return tier;
      }
      return mostRecent;
    }, tiers[0]);
  };

  const mostRecentTier = getMostRecentTier();
  const mostRecentTierInfo = mostRecentTier ? getTierById(mostRecentTier.tierId) : null;

  // Get previous tiers (exclude most recent, exclude currently selected since it's shown in trigger)
  const previousTiers = tiers.filter((t) => t.tierId !== mostRecentTier?.tierId);

  if (tiers.length === 0) return null;

  // If only one tier exists, just show the current tier name without dropdown
  if (tiers.length === 1) {
    return (
      <Tooltip
        content={
          <div>
            <div className="font-medium">Current Raid Tier</div>
            <div className="text-text-secondary text-xs mt-0.5">
              {selectedTierInfo?.name || currentTierId || 'No tier selected'}
            </div>
          </div>
        }
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-border-default rounded cursor-help">
          <span className="text-text-primary text-sm">
            {selectedTierInfo?.name || currentTierId || 'Select Tier'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold uppercase">
            Current
          </span>
        </div>
      </Tooltip>
    );
  }

  return (
    <Dropdown>
      <Tooltip
        content={
          <div>
            <div className="flex items-center gap-2 font-medium">
              Switch Raid Tier
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt</kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">[</kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">]</kbd>
              </span>
            </div>
            <div className="text-text-secondary text-xs mt-0.5">
              Click to switch or use shortcuts to cycle
            </div>
          </div>
        }
      >
        <span className="inline-flex">
          <DropdownTrigger>
            {/* design-system-ignore: Dropdown trigger requires native button with Select-like styling */}
            <button
              className="inline-flex items-center justify-between gap-2 px-4 py-2 bg-surface-elevated border border-border-default rounded-lg text-sm hover:border-border-subtle focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base transition-colors"
            >
              <span className="text-text-primary">
                {selectedTierInfo?.name || currentTierId || 'Select Tier'}
              </span>
              {selectedTier?.tierId === mostRecentTier?.tierId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold uppercase">
                  Current
                </span>
              )}
              <svg
                className="w-4 h-4 text-text-muted flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </DropdownTrigger>
        </span>
      </Tooltip>

      <DropdownContent align="start" className="min-w-[220px]">
        {/* Most recent tier - always shown at top */}
        {mostRecentTier && currentTierId !== mostRecentTier.tierId && (
          <>
            <DropdownItem onSelect={() => onTierChange(mostRecentTier.tierId)}>
              <span className="flex items-center gap-2">
                {mostRecentTierInfo?.name || mostRecentTier.tierId}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold uppercase">
                  Current
                </span>
              </span>
            </DropdownItem>
            {previousTiers.length > 0 && <DropdownSeparator />}
          </>
        )}

        {/* Previous tiers submenu - only if there are previous tiers to show */}
        {previousTiers.length > 0 && (
          <DropdownSub>
            <DropdownSubTrigger icon={<History className="w-4 h-4" />} chevronSide="left">
              Previous Tiers
            </DropdownSubTrigger>
            <DropdownSubContent side="left">
              {previousTiers.map((tier) => {
                const info = getTierById(tier.tierId);
                const isSelected = tier.tierId === currentTierId;
                return (
                  <DropdownItem
                    key={tier.tierId}
                    onSelect={() => onTierChange(tier.tierId)}
                    className={isSelected ? 'bg-surface-interactive' : ''}
                  >
                    {info?.name || tier.tierId}
                  </DropdownItem>
                );
              })}
            </DropdownSubContent>
          </DropdownSub>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
