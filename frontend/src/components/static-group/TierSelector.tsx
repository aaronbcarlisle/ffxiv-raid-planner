/**
 * Tier Selector
 *
 * Controls for selecting, creating, and managing tier snapshots.
 * Includes tier dropdown, new tier button, rollover, delete, add player, and player count.
 */

import { getTierById, type RaidTier } from '../../gamedata';
import type { TierSnapshot } from '../../types';

interface TierSelectorProps {
  tiers: TierSnapshot[];
  currentTierId?: string;
  availableTiers: RaidTier[];
  canEdit: boolean;
  isSaving: boolean;
  configuredCount?: number;
  totalSlots?: number;
  onTierChange: (tierId: string) => void;
  onCreateTier: () => void;
  onRollover: () => void;
  onDeleteTier: () => void;
  onAddPlayer: () => void;
}

export function TierSelector({
  tiers,
  currentTierId,
  availableTiers,
  canEdit,
  isSaving,
  configuredCount = 0,
  totalSlots = 0,
  onTierChange,
  onCreateTier,
  onRollover,
  onDeleteTier,
  onAddPlayer,
}: TierSelectorProps) {
  const hasTiers = tiers.length > 0;
  const hasCurrentTier = !!currentTierId;
  const canCreateTier = canEdit && availableTiers.length > 0;
  const canRollover = canEdit && hasCurrentTier && availableTiers.length > 0;
  const canDeleteTier = canEdit && hasCurrentTier && tiers.length > 1;
  const canAddPlayer = canEdit && hasCurrentTier;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Tier dropdown */}
      {hasTiers && (
        <select
          value={currentTierId || ''}
          onChange={(e) => onTierChange(e.target.value)}
          className="bg-bg-card border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
        >
          {tiers.map((tier) => {
            const info = getTierById(tier.tierId);
            return (
              <option key={tier.tierId} value={tier.tierId}>
                {info?.shortName || info?.name || tier.tierId} {tier.isActive && '(Active)'}
              </option>
            );
          })}
        </select>
      )}

      {/* New Tier button */}
      {canCreateTier && (
        <button
          onClick={onCreateTier}
          className="bg-accent/20 text-accent px-3 py-2 rounded font-medium hover:bg-accent/30 text-sm"
          title="Create new tier"
        >
          +
        </button>
      )}

      {/* Rollover button */}
      {canRollover && (
        <button
          onClick={onRollover}
          className="bg-purple-500/20 text-purple-400 px-2 py-2 rounded font-medium hover:bg-purple-500/30 text-sm"
          title="Copy roster to a new tier"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}

      {/* Delete tier button */}
      {canDeleteTier && (
        <button
          onClick={onDeleteTier}
          className="text-red-400 hover:text-red-300 px-2 py-2 text-sm"
          title="Delete this tier"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Add Player button with count badge */}
      {canAddPlayer && (
        <button
          onClick={onAddPlayer}
          disabled={isSaving}
          className="flex items-center gap-2 bg-accent/20 text-accent px-3 py-2 rounded font-medium hover:bg-accent/30 text-sm disabled:opacity-50"
        >
          + Add
          {totalSlots > 0 && (
            <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
              {configuredCount}/{totalSlots}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
