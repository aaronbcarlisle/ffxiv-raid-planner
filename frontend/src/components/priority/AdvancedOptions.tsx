/**
 * Advanced Priority Options
 *
 * Flat layout for configuring priority calculation settings.
 * Shows preset selector, checkboxes, and toggle-controlled expandable sections.
 * Now includes player loot adjustments.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Checkbox, Label, NumberInput } from '../ui';
import { Tooltip } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { PresetSelector } from './PresetSelector';
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
  /** Current loot adjustments by player ID */
  lootAdjustments?: Record<string, number>;
  /** Handler for loot adjustment changes */
  onAdjustmentChange?: (playerId: string, value: number | null) => void;
}

/**
 * Toggle section component for checkbox + expandable content
 */
interface ToggleSectionProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToggleSection({ label, description, checked, onChange, disabled, children }: ToggleSectionProps) {
  return (
    <div className="space-y-3">
      <Checkbox
        label={label}
        description={description}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      {checked && (
        <div className="ml-6 pl-4 border-l-2 border-border-default">
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
  lootAdjustments = {},
  onAdjustmentChange,
}: AdvancedOptionsProps) {
  const [showMultipliers, setShowMultipliers] = useState(options.preset === 'custom');

  const handlePresetChange = (preset: PriorityPreset) => {
    if (preset === 'custom') {
      // Keep current values, just switch to custom mode
      onChange({ ...options, preset });
      setShowMultipliers(true);
    } else {
      // Apply preset values
      const presetConfig = PRESET_CONFIGS[preset];
      onChange({
        ...options,
        ...presetConfig,
        preset,
        showPriorityScores: options.showPriorityScores, // Preserve this setting
      });
      // Keep multipliers visible if they were already shown
    }
  };

  const handleOptionChange = (key: keyof AdvancedOptions, value: boolean | number) => {
    // When manually changing a value, switch to custom preset
    const newOptions = { ...options, [key]: value };
    if (options.preset !== 'custom') {
      newOptions.preset = 'custom';
    }
    onChange(newOptions);
    setShowMultipliers(true);
  };

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
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

      {/* Show Priority Scores - simple checkbox */}
      <Checkbox
        checked={options.showPriorityScores}
        onChange={(checked) => onChange({ ...options, showPriorityScores: checked })}
        disabled={disabled}
        label="Show priority scores"
        description="Display numeric priority scores in the loot panel"
      />

      {/* Enhanced Fairness - toggle with expandable */}
      <ToggleSection
        label="Enable enhanced fairness"
        description="Adds drought bonus and balance penalty based on loot history"
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

      {/* Player Loot Adjustments - toggle with expandable */}
      {players.length > 0 && onAdjustmentChange && (
        <ToggleSection
          label="Enable player loot adjustments"
          description="Per-player priority adjustments for mid-tier roster changes"
          checked={options.useLootAdjustments}
          onChange={(checked) => handleOptionChange('useLootAdjustments', checked)}
          disabled={disabled}
        >
          <p className="text-xs text-text-muted mb-3">
            Positive values increase priority, negative decrease. Use for players who joined late or missed weeks.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-2 bg-surface-elevated rounded-lg border border-border-subtle"
              >
                <JobIcon job={player.job} size="sm" />
                <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                  {player.name}
                </span>
                <NumberInput
                  value={lootAdjustments[player.id] ?? 0}
                  onChange={(value) => onAdjustmentChange(player.id, value)}
                  min={-100}
                  max={100}
                  step={5}
                  size="sm"
                  disabled={disabled}
                  className="w-24"
                />
              </div>
            ))}
          </div>
        </ToggleSection>
      )}

      {/* Custom Multipliers - toggle with expandable */}
      <div className="space-y-3 p-4 bg-surface-elevated rounded-lg border border-border-default">
        {/* design-system-ignore: Collapsible header requires custom styling */}
        <button
          type="button"
          onClick={() => setShowMultipliers(!showMultipliers)}
          className="flex items-center justify-between w-full text-left"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {showMultipliers ? (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-muted" />
            )}
            <h4 className="text-sm font-medium text-text-primary">Custom Multipliers</h4>
            {options.preset === 'custom' && (
              <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">Active</span>
            )}
          </div>
          <Tooltip content="These values control how priority scores are calculated. Higher multipliers mean that factor has more weight.">
            <Info className="w-4 h-4 text-text-muted" />
          </Tooltip>
        </button>

        {showMultipliers && (
          <div className="space-y-4 pt-3 border-t border-border-default">
            {/* Core multipliers */}
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

              <div className="flex flex-col justify-center gap-2">
                <Checkbox
                  checked={options.useWeightedNeed}
                  onChange={(checked) => handleOptionChange('useWeightedNeed', checked)}
                  disabled={disabled}
                  label="Use weighted need"
                  description="Weight slots by value (weapon > body > accessories)"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
