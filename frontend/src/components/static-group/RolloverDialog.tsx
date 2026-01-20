/**
 * Rollover Dialog
 *
 * Copies roster from current tier to a new tier, optionally resetting gear.
 */

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal, Select, RadioGroup, Label, ErrorBox } from '../ui';
import { Button } from '../primitives';
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
  const [resetGear, setResetGear] = useState('true');
  const [error, setError] = useState<string | null>(null);

  // Available tiers for rollover (filter out existing)
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));
  const sourceTierInfo = getTierById(currentTier.tierId);

  const handleRollover = async () => {
    if (!targetTierId) return;

    setError(null);

    try {
      await rollover(groupId, currentTier.tierId, targetTierId, resetGear === 'true');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollover');
    }
  };

  // Build tier options for Select
  const tierOptions = [
    { value: '', label: 'Select a tier...' },
    ...availableTiers.map((tier) => ({
      value: tier.id,
      label: `${tier.name} (${tier.shortName})`,
    })),
  ];

  // Build gear reset options for RadioGroup
  const gearResetOptions = [
    {
      value: 'true',
      label: 'Reset gear (start fresh)',
      description: 'All gear slots will be unchecked in the new tier',
    },
    {
      value: 'false',
      label: 'Keep current gear progress',
      description: 'Copy gear state as-is (useful for mid-tier roster changes)',
    },
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Copy className="w-5 h-5" />
          Roll Over to New Tier
        </span>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} size="sm" />}

        {/* Source Tier */}
        <div className="p-3 bg-surface-elevated rounded border border-border-subtle">
          <span className="text-text-muted text-sm">Source:</span>
          <span className="text-text-primary ml-2 font-medium">
            {sourceTierInfo?.name || currentTier.tierId}
          </span>
          <span className="text-text-muted ml-1">
            ({currentTier.players?.filter(p => p.configured).length || 0} players)
          </span>
        </div>

        {/* Target Tier Selector */}
        <div>
          <Label htmlFor="targetTier">Target Tier</Label>
          {availableTiers.length > 0 ? (
            <Select
              id="targetTier"
              value={targetTierId}
              onChange={setTargetTierId}
              options={tierOptions}
            />
          ) : (
            <p className="text-text-muted text-sm italic">
              No available tiers. All tiers have been created.
            </p>
          )}
        </div>

        {/* Gear Reset Option */}
        <div>
          <RadioGroup
            name="gearReset"
            label="Gear Progress"
            value={resetGear}
            onChange={setResetGear}
            options={gearResetOptions}
          />
        </div>

        {/* Info Note */}
        <div className="p-3 bg-accent/10 border border-accent/20 rounded text-sm">
          <p className="text-text-secondary">
            Rollover will copy all players (names, jobs, roles, positions) to the new tier.
            The new tier will become active, and the source tier will remain accessible.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRollover}
            disabled={!targetTierId}
            loading={isSaving}
          >
            Roll Over
          </Button>
        </div>
      </div>
    </Modal>
  );
}
