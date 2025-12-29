/**
 * Rollover Dialog
 *
 * Copies roster from current tier to a new tier, optionally resetting gear.
 */

import { useState } from 'react';
import { useTierStore } from '../../stores/tierStore';
import { getTierById, RAID_TIERS } from '../../gamedata';
import type { TierSnapshot } from '../../types';

interface RolloverDialogProps {
  groupId: string;
  currentTier: TierSnapshot;
  existingTierIds: string[];
  onClose: () => void;
}

export function RolloverDialog({ groupId, currentTier, existingTierIds, onClose }: RolloverDialogProps) {
  const { rollover, isSaving } = useTierStore();

  const [targetTierId, setTargetTierId] = useState('');
  const [resetGear, setResetGear] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available tiers for rollover (filter out existing)
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));
  const sourceTierInfo = getTierById(currentTier.tierId);

  const handleRollover = async () => {
    if (!targetTierId) return;

    setError(null);

    try {
      await rollover(groupId, currentTier.tierId, targetTierId, resetGear);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollover');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/80 backdrop-blur-sm">
      <div className="bg-surface-card rounded-lg border border-border-default p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-display text-accent mb-4">Roll Over to New Tier</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Source Tier */}
        <div className="mb-4 p-3 bg-surface-elevated rounded border border-border-subtle">
          <span className="text-text-muted text-sm">Source:</span>
          <span className="text-text-primary ml-2 font-medium">
            {sourceTierInfo?.name || currentTier.tierId}
          </span>
          <span className="text-text-muted ml-1">
            ({currentTier.players?.filter(p => p.configured).length || 0} players)
          </span>
        </div>

        {/* Target Tier Selector */}
        <div className="mb-4">
          <label className="block text-sm text-text-secondary mb-2">Target Tier</label>
          {availableTiers.length > 0 ? (
            <select
              value={targetTierId}
              onChange={(e) => setTargetTierId(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select a tier...</option>
              {availableTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} ({tier.shortName})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-text-muted text-sm italic">
              No available tiers. All tiers have been created.
            </p>
          )}
        </div>

        {/* Gear Reset Option */}
        <div className="mb-6">
          <label className="block text-sm text-text-secondary mb-2">Gear Progress</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={resetGear}
                onChange={() => setResetGear(true)}
                className="w-4 h-4 text-accent focus:ring-accent"
              />
              <div>
                <span className="text-text-primary">Reset gear (start fresh)</span>
                <p className="text-xs text-text-muted">
                  All gear slots will be unchecked in the new tier
                </p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!resetGear}
                onChange={() => setResetGear(false)}
                className="w-4 h-4 text-accent focus:ring-accent"
              />
              <div>
                <span className="text-text-primary">Keep current gear progress</span>
                <p className="text-xs text-text-muted">
                  Copy gear state as-is (useful for mid-tier roster changes)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Info Note */}
        <div className="mb-6 p-3 bg-accent/10 border border-accent/20 rounded text-sm">
          <p className="text-text-secondary">
            Rollover will copy all players (names, jobs, roles, positions) to the new tier.
            The new tier will become active, and the source tier will remain accessible.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleRollover}
            disabled={!targetTierId || isSaving}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Rolling Over...' : 'Roll Over'}
          </button>
        </div>
      </div>
    </div>
  );
}
