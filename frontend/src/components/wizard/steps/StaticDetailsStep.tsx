/**
 * StaticDetailsStep - Step 1 of setup wizard
 *
 * Collects static name, tier selection, and public/private visibility.
 */

import { RAID_TIERS } from '../../../gamedata/raid-tiers';

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
        <label htmlFor="static-name" className="block text-sm font-medium text-text-primary mb-2">
          Static Name <span className="text-status-error">*</span>
        </label>
        <input
          id="static-name"
          type="text"
          value={staticName}
          onChange={(e) => onStaticNameChange(e.target.value)}
          placeholder="Enter your static's name"
          className="w-full px-4 py-2 bg-surface-elevated border border-border-default rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          autoFocus
        />
        <p className="text-xs text-text-muted mt-1">
          Choose a name that your team will recognize
        </p>
      </div>

      {/* Tier Selection */}
      <div>
        <label htmlFor="tier-select" className="block text-sm font-medium text-text-primary mb-2">
          Raid Tier <span className="text-status-error">*</span>
        </label>
        <select
          id="tier-select"
          value={tierId}
          onChange={(e) => onTierIdChange(e.target.value)}
          className="w-full px-4 py-2 bg-surface-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        >
          <option value="">Select a tier...</option>
          {RAID_TIERS.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name} ({tier.shortName})
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted mt-1">
          Select which raid tier this static will progress through
        </p>
      </div>

      {/* Visibility Toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => onIsPublicChange(e.target.checked)}
            className="w-4 h-4 rounded border-border-default text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-base cursor-pointer"
          />
          <div>
            <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
              Make this static public
            </span>
            <p className="text-xs text-text-muted mt-0.5">
              Public statics can be discovered by anyone with the share link
            </p>
          </div>
        </label>
      </div>

      {/* Info box */}
      <div className="bg-surface-elevated border border-border-default rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">Next step:</strong> You'll be able to set up your roster with player names, jobs, and BiS imports.
        </p>
      </div>
    </div>
  );
}
