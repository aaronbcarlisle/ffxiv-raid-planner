/**
 * Tier Selector
 *
 * Dropdown for switching between tier snapshots.
 * Migrated to Radix DropdownMenu for accessibility.
 */

import { getTierById } from '../../gamedata';
import type { TierSnapshot } from '../../types';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
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
  // Get current tier info
  const currentTier = tiers.find((t) => t.tierId === currentTierId);
  const currentTierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Get other tiers (exclude current)
  const otherTiers = tiers.filter((t) => t.tierId !== currentTierId);

  if (tiers.length === 0) return null;

  // If no other tiers, just show the current tier name without dropdown
  if (otherTiers.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-border-default rounded">
        <span className="text-text-primary text-sm">
          {currentTierInfo?.name || currentTierId || 'Select Tier'}
        </span>
      </div>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <button className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-border-default rounded hover:border-accent/30 transition-colors">
          <span className="text-text-primary text-sm">
            {currentTierInfo?.name || currentTierId || 'Select Tier'}
          </span>
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownTrigger>

      <DropdownContent align="start" matchTriggerWidth>
        {otherTiers.map((tier) => {
          const info = getTierById(tier.tierId);
          return (
            <DropdownItem
              key={tier.tierId}
              onSelect={() => onTierChange(tier.tierId)}
            >
              {info?.name || tier.tierId}
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
}
