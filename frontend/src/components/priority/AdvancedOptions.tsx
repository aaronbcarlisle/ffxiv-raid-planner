/**
 * Advanced Priority Options
 *
 * Flat layout for configuring priority calculation settings.
 * Shows preset selector, toggles, and expandable sections.
 * Uses the Recessed Orb Toggle design for feature toggles.
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
 * Toggle section component for toggle + expandable content
 * Uses the Recessed Orb Toggle design
 */
interface ToggleSectionProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToggleSection({ label, hint, checked, onChange, disabled, children }: ToggleSectionProps) {
  return (
    <div className="space-y-3">
      {/* Toggle with divider styling */}
      <div className="py-3">
        <Toggle
          label={label}
          hint={hint}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      {checked && (
        <div className="p-4 bg-surface-elevated border border-border-default rounded-lg">
          {children}
        </div>
      )}
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
        <Label>Calculation Preset</Label>
        <PresetSelector
          value={options.preset}
          onChange={handlePresetChange}
          disabled={disabled}
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Show Priority Scores - Toggle */}
      <div className="py-3">
        <Toggle
          checked={options.showPriorityScores}
          onChange={(checked) => onChange({ ...options, showPriorityScores: checked })}
          disabled={disabled}
          label="Show priority scores"
          hint="Display numeric priority scores in the loot panel"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Use Weighted Need - Toggle */}
      <div className="py-3">
        <Toggle
          checked={options.useWeightedNeed}
          onChange={(checked) => handleOptionChange('useWeightedNeed', checked)}
          disabled={disabled}
          label="Use weighted need"
          hint="Weight slots by value (weapon > body > accessories)"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Player Loot Adjustments - toggle with edit button */}
      {players.length > 0 && groupId && tierId && (
        <>
          <div className="py-3 flex items-start justify-between gap-4">
            <Toggle
              checked={options.useLootAdjustments}
              onChange={(checked) => handleOptionChange('useLootAdjustments', checked)}
              disabled={disabled}
              label="Enable player loot adjustments"
              hint="Per-player priority adjustments for mid-tier roster changes"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAdjustmentsModalOpen(true)}
              disabled={disabled || !options.useLootAdjustments}
            >
              Edit Values
            </Button>
          </div>

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

      {/* Enhanced Fairness - toggle with expandable */}
      <ToggleSection
        label="Enable enhanced fairness"
        hint="Adds drought bonus and balance penalty based on loot history"
        checked={options.enableEnhancedFairness}
        onChange={(checked) => handleOptionChange('enableEnhancedFairness', checked)}
        disabled={disabled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label size="sm">Drought Bonus Multiplier</Label>
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
            <Label size="sm">Drought Bonus Cap (Weeks)</Label>
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
            <Label size="sm">Balance Penalty Multiplier</Label>
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
            <Label size="sm">Balance Penalty Cap (Drops)</Label>
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
      </ToggleSection>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Priority Multipliers - toggle with expandable */}
      <ToggleSection
        label="Enable priority multipliers"
        hint="Fine-tune how priority scores are calculated"
        checked={options.useMultipliers}
        onChange={(checked) => handleOptionChange('useMultipliers', checked)}
        disabled={disabled}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tooltip content="These values control how priority scores are calculated. Higher multipliers mean that factor has more weight.">
              <Info className="w-4 h-4 text-text-muted" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label size="sm">Role Priority Multiplier</Label>
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
              <Label size="sm">Gear Need Multiplier</Label>
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

            <div>
              <Label size="sm">Loot Received Penalty</Label>
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
                Penalty per loot received (default: 15)
              </p>
            </div>
          </div>
        </div>
      </ToggleSection>
    </div>
  );
}
