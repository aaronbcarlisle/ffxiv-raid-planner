/**
 * StaticDetailsStep - Step 1 of setup wizard
 *
 * Collects static name, tier selection, and public/private visibility.
 */

import { useTranslation } from 'react-i18next';
import { RAID_TIERS } from '../../../gamedata/raid-tiers';
import { Input, Select, Checkbox, Label } from '../../ui';

interface StaticDetailsStepProps {
  staticName: string;
  tierId: string;
  isPublic: boolean;
  splitClearEnabled: boolean;
  onStaticNameChange: (name: string) => void;
  onTierIdChange: (tierId: string) => void;
  onIsPublicChange: (isPublic: boolean) => void;
  onSplitClearEnabledChange: (enabled: boolean) => void;
}

export function StaticDetailsStep({
  staticName,
  tierId,
  isPublic,
  splitClearEnabled,
  onStaticNameChange,
  onTierIdChange,
  onIsPublicChange,
  onSplitClearEnabledChange,
}: StaticDetailsStepProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* Static Name */}
      <div>
        <Label htmlFor="static-name" required>
          {t('wizard.staticNameLabel')}
        </Label>
        <Input
          id="static-name"
          value={staticName}
          onChange={onStaticNameChange}
          placeholder={t('wizard.staticNamePlaceholder')}
          autoFocus
          helperText={t('wizard.staticNameHelper')}
        />
      </div>

      {/* Tier Selection */}
      <div>
        <Label htmlFor="tier-select" required>
          {t('wizard.raidTierLabel')}
        </Label>
        <Select
          id="tier-select"
          value={tierId}
          onChange={onTierIdChange}
          placeholder={t('wizard.raidTierPlaceholder')}
          options={RAID_TIERS.map((tier) => ({
            value: tier.id,
            label: `${tier.name} (${tier.shortName})`,
          }))}
        />
        <p className="text-xs text-text-muted mt-1">
          {t('wizard.raidTierHelper')}
        </p>
      </div>

      {/* Visibility Toggle */}
      <div>
        <Checkbox
          id="is-public"
          checked={isPublic}
          onChange={onIsPublicChange}
          label={t('wizard.makePublicLabel')}
          description={t('wizard.makePublicDescription')}
        />
      </div>

      <div>
        <Checkbox
          id="split-clear-enabled"
          checked={splitClearEnabled}
          onChange={onSplitClearEnabledChange}
          label={t('wizard.splitClearLabel')}
          description={t('wizard.splitClearDescription')}
        />
      </div>

      {/* Info box */}
      <div className="bg-surface-elevated border border-border-default rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{t('wizard.nextStepLabel')}</strong>{' '}{t('wizard.nextStepText')}
        </p>
      </div>
    </div>
  );
}
