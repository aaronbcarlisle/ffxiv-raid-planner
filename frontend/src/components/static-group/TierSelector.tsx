/**
 * Tier Selector
 *
 * Simple tier dropdown for switching between tier snapshots.
 */

import { getTierById } from '../../gamedata';
import type { TierSnapshot } from '../../types';

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
  if (tiers.length === 0) return null;

  return (
    <select
      value={currentTierId || ''}
      onChange={(e) => onTierChange(e.target.value)}
      className="bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
    >
      {tiers.map((tier) => {
        const info = getTierById(tier.tierId);
        return (
          <option key={tier.tierId} value={tier.tierId}>
            {info?.shortName || info?.name || tier.tierId}
          </option>
        );
      })}
    </select>
  );
}
