/**
 * Advanced Priority Options
 *
 * Collapsible panel for configuring priority calculation multipliers.
 * Shows a preset selector and optionally exposes individual multiplier controls.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Checkbox, Label, NumberInput } from '../ui';
import { Tooltip } from '../primitives';
import { PresetSelector } from './PresetSelector';
import { PRESET_CONFIGS } from './presetConfigs';
import type { AdvancedPriorityOptions as AdvancedOptions, PriorityPreset } from '../../types';

interface AdvancedOptionsProps {
  options: AdvancedOptions;
  onChange: (options: AdvancedOptions) => void;
  disabled?: boolean;
  /** Whether the priority mode is disabled (affects UI messaging) */
  priorityDisabled?: boolean;
}

export function AdvancedOptions({
  options,
  onChange,
  disabled,
  priorityDisabled,
}: AdvancedOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      setShowMultipliers(false);
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
    <div className="border-t border-border-default pt-4 mt-4">
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors w-full text-left"
        disabled={disabled}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">Advanced Options</span>
      </button>

      {isExpanded && (
        <div
          className={`mt-4 space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Disabled mode note */}
          {priorityDisabled && (
            <div className="p-3 bg-surface-elevated border border-border-default rounded-lg text-sm text-text-muted">
              These settings are saved but won't affect priority when mode is "Disabled".
            </div>
          )}

          {/* Preset selector */}
          <div>
            <Label>Calculation Preset</Label>
            <PresetSelector
              value={options.preset}
              onChange={handlePresetChange}
              disabled={disabled}
            />
          </div>

          {/* Show Priority Scores */}
          <Checkbox
            checked={options.showPriorityScores}
            onChange={(checked) => onChange({ ...options, showPriorityScores: checked })}
            disabled={disabled}
            label="Show priority scores"
            description="Display numeric priority scores in the loot panel"
          />

          {/* Enhanced Fairness Toggle */}
          <Checkbox
            checked={options.enableEnhancedFairness}
            onChange={(checked) => handleOptionChange('enableEnhancedFairness', checked)}
            disabled={disabled}
            label="Enable enhanced fairness"
            description="Adds drought bonus and balance penalty based on loot history"
          />

          {/* Custom multiplier controls */}
          {showMultipliers && (
            <div className="space-y-4 p-4 bg-surface-elevated rounded-lg border border-border-default">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-text-primary">Custom Multipliers</h4>
                <Tooltip content="These values control how priority scores are calculated. Higher multipliers mean that factor has more weight.">
                  <Info className="w-4 h-4 text-text-muted" />
                </Tooltip>
              </div>

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
                  <Checkbox
                    checked={options.useLootAdjustments}
                    onChange={(checked) => handleOptionChange('useLootAdjustments', checked)}
                    disabled={disabled}
                    label="Apply loot adjustments"
                    description="Use per-player loot adjustments for roster changes"
                  />
                </div>
              </div>

              {/* Enhanced fairness multipliers */}
              {options.enableEnhancedFairness && (
                <>
                  <div className="border-t border-border-default pt-4 mt-4">
                    <h5 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
                      Enhanced Fairness Settings
                    </h5>
                  </div>

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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
