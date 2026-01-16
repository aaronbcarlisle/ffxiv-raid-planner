/**
 * StaticDetailsStep - Step 1 of setup wizard
 *
 * Collects static name, tier selection, and public/private visibility.
 */

import { RAID_TIERS } from '../../../gamedata/raid-tiers';
import { Input, Select, Checkbox, Label } from '../../ui';

interface StaticDetailsStepProps {
  staticName: string;
  tierId: string;
  isPublic: boolean;
  onStaticNameChange: (name: string) => void;
  onTierIdChange: (tierId: string) => void;
  onIsPublicChange: (isPublic: boolean) => void;
}

export function StaticDetailsStep({
  staticName,
  tierId,
  isPublic,
  onStaticNameChange,
  onTierIdChange,
  onIsPublicChange,
}: StaticDetailsStepProps) {
  return (
    <div className="space-y-6">
      {/* Static Name */}
      <div>
        <Label htmlFor="static-name" required>
          Static Name
        </Label>
        <Input
          id="static-name"
          value={staticName}
          onChange={onStaticNameChange}
          placeholder="Enter your static's name"
          autoFocus
          helperText="Choose a name that your team will recognize"
        />
      </div>

      {/* Tier Selection */}
      <div>
        <Label htmlFor="tier-select" required>
          Raid Tier
        </Label>
        <Select
          id="tier-select"
          value={tierId}
          onChange={onTierIdChange}
          placeholder="Select a tier..."
          options={RAID_TIERS.map((tier) => ({
            value: tier.id,
            label: `${tier.name} (${tier.shortName})`,
          }))}
        />
        <p className="text-xs text-text-muted mt-1">
          Select which raid tier this static will progress through
        </p>
      </div>

      {/* Visibility Toggle */}
      <div>
        <Checkbox
          id="is-public"
          checked={isPublic}
          onChange={onIsPublicChange}
          label="Make this static public"
          description="Public statics can be discovered by anyone with the share link"
        />
      </div>

      {/* Info box */}
      <div className="bg-surface-elevated border border-border-default rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">Next step:</strong> You'll set up your roster with player names and jobs.
        </p>
      </div>
    </div>
  );
}
