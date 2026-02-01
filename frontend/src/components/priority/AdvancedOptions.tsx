/**
 * Advanced Priority Options
 *
 * Flat layout for configuring priority calculation settings.
 * Shows preset selector, toggles, and expandable sections.
 * Uses the Recessed Orb Toggle design for feature toggles.
 * Each setting has an info icon with a helpful tooltip.
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Label, NumberInput, Toggle } from '../ui';
import { Button, Tooltip } from '../primitives';
import { PresetSelector } from './PresetSelector';
import { PlayerAdjustmentsModal } from './PlayerAdjustmentsModal';
import { PRESET_CONFIGS } from './presetConfigs';
import type { AdvancedPriorityOptions as AdvancedOptions, PriorityPreset, SnapshotPlayer } from '../../types';

interface AdvancedOptionsProps {
  options: AdvancedOptions;
  onChange: (options: AdvancedOptions) => void;
  disabled?: boolean;
  /** Whether the priority mode is disabled (affects UI messaging) */
  priorityDisabled?: boolean;
  /** Players for loot adjustments section */
  players?: SnapshotPlayer[];
  /** Group ID for saving adjustments */
  groupId?: string;
  /** Tier ID for saving adjustments */
  tierId?: string;
}

/**
 * Info icon with tooltip - always visible next to settings
 */
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <Info className="w-4 h-4 text-text-muted hover:text-text-secondary cursor-help flex-shrink-0" />
    </Tooltip>
  );
}

/**
 * Toggle with info icon component
 */
interface ToggleWithInfoProps {
  label: string;
  hint?: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

function ToggleWithInfo({ label, hint, tooltip, checked, onChange, disabled, children }: ToggleWithInfoProps) {
  return (
    <div className="space-y-3">
      <div className="py-3 flex items-start gap-2">
        <div className="flex-1">
          <Toggle
            label={label}
            hint={hint}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
        <div className="pt-0.5">
          <InfoTooltip content={tooltip} />
        </div>
      </div>
      {checked && children && (
        <div className="p-4 bg-surface-elevated border border-border-default rounded-lg">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Label with info icon for settings within expandable sections
 */
function LabelWithInfo({ children, tooltip, size = 'sm' }: { children: React.ReactNode; tooltip: string; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <Label size={size} className="mb-0">{children}</Label>
      <InfoTooltip content={tooltip} />
    </div>
  );
}

export function AdvancedOptions({
  options,
  onChange,
  disabled,
  priorityDisabled,
  players = [],
  groupId,
  tierId,
}: AdvancedOptionsProps) {
  const [isAdjustmentsModalOpen, setIsAdjustmentsModalOpen] = useState(false);

  const handlePresetChange = (preset: PriorityPreset) => {
    if (preset === 'custom') {
      // Keep current values, just switch to custom mode
      onChange({ ...options, preset });
    } else {
      // Apply preset values
      const presetConfig = PRESET_CONFIGS[preset];
      onChange({
        ...options,
        ...presetConfig,
        preset,
        showPriorityScores: options.showPriorityScores, // Preserve this setting
      });
    }
  };

  const handleOptionChange = (key: keyof AdvancedOptions, value: boolean | number) => {
    // When manually changing a value, switch to custom preset
    const newOptions = { ...options, [key]: value };
    if (options.preset !== 'custom') {
      newOptions.preset = 'custom';
    }
    onChange(newOptions);
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Disabled mode note */}
      {priorityDisabled && (
        <div className="p-3 bg-surface-elevated border border-border-default rounded-lg text-sm text-text-muted">
          These settings are saved but won't affect priority when mode is "Disabled".
        </div>
      )}

      {/* Calculation Preset - always visible at top */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Label className="mb-0">Calculation Preset</Label>
          <InfoTooltip content="Quick presets that configure multiple settings at once. Choose 'Custom' to fine-tune individual values." />
        </div>
        <PresetSelector
          value={options.preset}
          onChange={handlePresetChange}
          disabled={disabled}
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Show Priority Scores */}
      <div className="py-3 flex items-start gap-2">
        <div className="flex-1">
          <Toggle
            checked={options.showPriorityScores}
            onChange={(checked) => onChange({ ...options, showPriorityScores: checked })}
            disabled={disabled}
            label="Show priority scores"
            hint="Display numeric scores in the Loot tab"
          />
        </div>
        <div className="pt-0.5">
          <InfoTooltip content="When enabled, shows the calculated priority score next to each player in the Gear Priority list. Useful for understanding why players are ranked the way they are." />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Use Weighted Need */}
      <ToggleWithInfo
        label="Use weighted need"
        hint="Weight gear slots by value"
        tooltip="When enabled, high-value slots (weapon, body, legs) contribute more to priority than accessories. When disabled, all incomplete slots are weighted equally."
        checked={options.useWeightedNeed}
        onChange={(checked) => handleOptionChange('useWeightedNeed', checked)}
        disabled={disabled}
      />

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Player Loot Adjustments - toggle with edit button and multiplier */}
      {players.length > 0 && groupId && tierId && (
        <>
          <ToggleWithInfo
            label="Enable player loot adjustments"
            hint="Manual per-player priority adjustments"
            tooltip="Use this for mid-tier roster changes. Give positive values to players who need to catch up (joined late, missed drops), or negative values to players who've received extra loot."
            checked={options.useLootAdjustments}
            onChange={(checked) => handleOptionChange('useLootAdjustments', checked)}
            disabled={disabled}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  Set per-player adjustment values to boost or reduce their priority.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAdjustmentsModalOpen(true)}
                  disabled={disabled}
                >
                  Edit Values
                </Button>
              </div>

              <div className="max-w-xs">
                <LabelWithInfo tooltip="Each point of adjustment is multiplied by this value. Example: +5 adjustment × 15 multiplier = +75 priority boost.">
                  Adjustment Multiplier
                </LabelWithInfo>
                <NumberInput
                  value={options.lootReceivedPenalty}
                  onChange={(value) =>
                    handleOptionChange('lootReceivedPenalty', value ?? 15)
                  }
                  min={0}
                  max={50}
                  step={5}
                  size="sm"
                  disabled={disabled}
                />
                <p className="text-xs text-text-muted mt-1">
                  Points per adjustment value (default: 15)
                </p>
              </div>
            </div>
          </ToggleWithInfo>

          {/* Divider */}
          <div className="h-px bg-border-subtle" />

          {/* Player Adjustments Modal */}
          <PlayerAdjustmentsModal
            isOpen={isAdjustmentsModalOpen}
            onClose={() => setIsAdjustmentsModalOpen(false)}
            players={players}
            groupId={groupId}
            tierId={tierId}
            disabled={disabled}
          />
        </>
      )}

      {/* Enhanced Fairness */}
      <ToggleWithInfo
        label="Enable enhanced fairness"
        hint="Automatic adjustments based on loot history"
        tooltip="Automatically adjusts priority based on who has received loot. Players who haven't gotten drops recently get a bonus, while players who've received more than average get a penalty. Great for ensuring everyone gets geared evenly over time."
        checked={options.enableEnhancedFairness}
        onChange={(checked) => handleOptionChange('enableEnhancedFairness', checked)}
        disabled={disabled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelWithInfo tooltip="Priority bonus given for each week a player hasn't received any drops. Helps players who've had bad luck catch up.">
              Drought Bonus Multiplier
            </LabelWithInfo>
            <NumberInput
              value={options.droughtBonusMultiplier}
              onChange={(value) =>
                handleOptionChange('droughtBonusMultiplier', value ?? 10)
              }
              min={0}
              max={50}
              step={5}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Bonus per week without drops (default: 10)
            </p>
          </div>

          <div>
            <LabelWithInfo tooltip="Maximum number of weeks to count for the drought bonus. Prevents the bonus from growing infinitely for very unlucky players.">
              Drought Bonus Cap (Weeks)
            </LabelWithInfo>
            <NumberInput
              value={options.droughtBonusCapWeeks}
              onChange={(value) =>
                handleOptionChange('droughtBonusCapWeeks', value ?? 5)
              }
              min={1}
              max={99}
              step={1}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Max weeks to count (default: 5)
            </p>
          </div>

          <div>
            <LabelWithInfo tooltip="Priority penalty for each drop a player has received above the group average. Helps prevent any one player from getting too far ahead.">
              Balance Penalty Multiplier
            </LabelWithInfo>
            <NumberInput
              value={options.balancePenaltyMultiplier}
              onChange={(value) =>
                handleOptionChange('balancePenaltyMultiplier', value ?? 15)
              }
              min={0}
              max={50}
              step={5}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Penalty per excess drop (default: 15)
            </p>
          </div>

          <div>
            <LabelWithInfo tooltip="Maximum number of excess drops to penalize. Prevents the penalty from becoming too harsh for lucky players.">
              Balance Penalty Cap (Drops)
            </LabelWithInfo>
            <NumberInput
              value={options.balancePenaltyCapDrops}
              onChange={(value) =>
                handleOptionChange('balancePenaltyCapDrops', value ?? 3)
              }
              min={1}
              max={99}
              step={1}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Max excess drops to penalize (default: 3)
            </p>
          </div>
        </div>
      </ToggleWithInfo>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Priority Multipliers */}
      <ToggleWithInfo
        label="Enable priority multipliers"
        hint="Customize how the base score is calculated"
        tooltip="Override the default multipliers used to calculate priority scores. Use this to emphasize or de-emphasize certain factors like role priority or gear need."
        checked={options.useMultipliers}
        onChange={(checked) => handleOptionChange('useMultipliers', checked)}
        disabled={disabled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelWithInfo tooltip="Points given based on role priority order. Higher values make role order more important. Example: If melee is #1 and healer is #5, melee gets (5-0)×25=125 while healer gets (5-4)×25=25.">
              Role Priority Multiplier
            </LabelWithInfo>
            <NumberInput
              value={options.rolePriorityMultiplier}
              onChange={(value) =>
                handleOptionChange('rolePriorityMultiplier', value ?? 25)
              }
              min={0}
              max={100}
              step={5}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Points per role rank (default: 25)
            </p>
          </div>

          <div>
            <LabelWithInfo tooltip="Points given based on how much gear a player still needs. Higher values make gear need more important relative to role priority.">
              Gear Need Multiplier
            </LabelWithInfo>
            <NumberInput
              value={options.gearNeededMultiplier}
              onChange={(value) =>
                handleOptionChange('gearNeededMultiplier', value ?? 10)
              }
              min={0}
              max={50}
              step={5}
              size="sm"
              disabled={disabled}
            />
            <p className="text-xs text-text-muted mt-1">
              Points per weighted gear need (default: 10)
            </p>
          </div>
        </div>
      </ToggleWithInfo>
    </div>
  );
}
