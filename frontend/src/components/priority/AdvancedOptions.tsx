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
 * Enhanced tooltip content with title and structured information
 */
function EnhancedTooltipContent({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-xs space-y-1.5">
      <div className="font-medium text-text-primary">{title}</div>
      <div className="text-text-secondary">{children}</div>
    </div>
  );
}

/**
 * Info icon with enhanced tooltip - always visible next to settings
 */
function InfoTooltip({ content }: { content: React.ReactNode }) {
  return (
    <Tooltip content={content} delayDuration={200}>
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
  tooltip: React.ReactNode;
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
function LabelWithInfo({ children, tooltip, size = 'sm' }: { children: React.ReactNode; tooltip: React.ReactNode; size?: 'sm' | 'md' }) {
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
          <InfoTooltip content={
            <EnhancedTooltipContent title="Calculation Preset">
              <p>Quick presets that configure multiple settings at once.</p>
              <ul className="mt-1.5 space-y-0.5 text-text-muted">
                <li><span className="text-text-secondary">Balanced</span> — Equal weight to role and gear need</li>
                <li><span className="text-text-secondary">Role First</span> — Prioritizes role order heavily</li>
                <li><span className="text-text-secondary">Need First</span> — Prioritizes gear need heavily</li>
                <li><span className="text-text-secondary">Custom</span> — Fine-tune individual values</li>
              </ul>
            </EnhancedTooltipContent>
          } />
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
            hint="Display numeric scores in the Priority tab"
          />
        </div>
        <div className="pt-0.5">
          <InfoTooltip content={
            <EnhancedTooltipContent title="Show Priority Scores">
              <p>Display the calculated priority score next to each player in the Gear Priority list.</p>
              <p className="mt-1.5 text-text-muted">Hover over scores to see a breakdown of how they were calculated.</p>
            </EnhancedTooltipContent>
          } />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border-subtle" />

      {/* Use Weighted Need */}
      <ToggleWithInfo
        label="Use weighted need"
        hint="Weight gear slots by value"
        tooltip={
          <EnhancedTooltipContent title="Weighted Need">
            <p>High-value slots contribute more to priority than accessories.</p>
            <div className="mt-1.5 text-text-muted">
              <p className="font-medium text-text-secondary">Slot weights:</p>
              <div className="mt-0.5">Weapon (3) › Body/Legs (2) › Everything else (1)</div>
            </div>
            <p className="mt-1.5 text-text-muted">When disabled, all incomplete slots count equally.</p>
          </EnhancedTooltipContent>
        }
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
            tooltip={
              <EnhancedTooltipContent title="Player Loot Adjustments">
                <p>Manually adjust individual player priorities for mid-tier roster changes.</p>
                <ul className="mt-1.5 space-y-0.5 text-text-muted">
                  <li><span className="text-status-success">+</span> Positive = boost priority (joined late, missed drops)</li>
                  <li><span className="text-status-warning">−</span> Negative = reduce priority (received extra loot)</li>
                </ul>
              </EnhancedTooltipContent>
            }
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
                <LabelWithInfo tooltip={
                  <EnhancedTooltipContent title="Adjustment Multiplier">
                    <p>Each point of adjustment is multiplied by this value.</p>
                    <div className="mt-1.5 p-1.5 bg-surface-base rounded text-text-muted">
                      <span className="text-status-success">+5</span> adjustment × <span className="text-accent">15</span> multiplier = <span className="text-text-primary">+75</span> priority
                    </div>
                  </EnhancedTooltipContent>
                }>
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
        tooltip={
          <EnhancedTooltipContent title="Enhanced Fairness">
            <p>Automatically adjusts priority based on loot history.</p>
            <ul className="mt-1.5 space-y-0.5 text-text-muted">
              <li><span className="text-status-success">Drought bonus</span> — Players who haven't received drops get a boost</li>
              <li><span className="text-status-warning">Balance penalty</span> — Players with more than average drops get reduced priority</li>
            </ul>
            <p className="mt-1.5 text-text-muted">Great for ensuring everyone gets geared evenly over time.</p>
          </EnhancedTooltipContent>
        }
        checked={options.enableEnhancedFairness}
        onChange={(checked) => handleOptionChange('enableEnhancedFairness', checked)}
        disabled={disabled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Drought Bonus">
                <p>Priority boost for each week without drops.</p>
                <div className="mt-1.5 p-1.5 bg-surface-base rounded text-text-muted">
                  <span className="text-accent">3</span> weeks × <span className="text-accent">10</span> multiplier = <span className="text-status-success">+30</span> bonus
                </div>
              </EnhancedTooltipContent>
            }>
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
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Drought Cap">
                <p>Maximum weeks to count for the drought bonus.</p>
                <p className="mt-1.5 text-text-muted">Prevents the bonus from growing infinitely for very unlucky players.</p>
              </EnhancedTooltipContent>
            }>
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
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Balance Penalty">
                <p>Priority reduction for each drop above the group average.</p>
                <div className="mt-1.5 p-1.5 bg-surface-base rounded text-text-muted">
                  <span className="text-accent">2</span> excess drops × <span className="text-accent">15</span> multiplier = <span className="text-status-warning">−30</span> penalty
                </div>
              </EnhancedTooltipContent>
            }>
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
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Balance Cap">
                <p>Maximum excess drops to penalize.</p>
                <p className="mt-1.5 text-text-muted">Prevents the penalty from becoming too harsh for lucky players.</p>
              </EnhancedTooltipContent>
            }>
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
        tooltip={
          <EnhancedTooltipContent title="Priority Multipliers">
            <p>Override the default multipliers for priority calculation.</p>
            <ul className="mt-1.5 space-y-0.5 text-text-muted">
              <li><span className="text-text-secondary">Role</span> — How much role order matters</li>
              <li><span className="text-text-secondary">Gear Need</span> — How much incomplete slots matter</li>
            </ul>
            <p className="mt-1.5 text-text-muted">When disabled, uses defaults (25 role, 10 gear).</p>
          </EnhancedTooltipContent>
        }
        checked={options.useMultipliers}
        onChange={(checked) => handleOptionChange('useMultipliers', checked)}
        disabled={disabled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Role Multiplier">
                <p>Points based on role priority order. Higher = role matters more.</p>
                <div className="mt-1.5 p-1.5 bg-surface-base rounded text-text-muted space-y-0.5">
                  <div>Melee (#1): (5−0) × 25 = <span className="text-text-primary">125</span></div>
                  <div>Healer (#5): (5−4) × 25 = <span className="text-text-primary">25</span></div>
                </div>
              </EnhancedTooltipContent>
            }>
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
            <LabelWithInfo tooltip={
              <EnhancedTooltipContent title="Gear Need Multiplier">
                <p>Points based on how much gear a player still needs.</p>
                <div className="mt-1.5 p-1.5 bg-surface-base rounded text-text-muted">
                  <span className="text-accent">8.5</span> weighted need × <span className="text-accent">10</span> multiplier = <span className="text-text-primary">+85</span> priority
                </div>
                <p className="mt-1.5 text-text-muted">Higher values make gear need more important vs role.</p>
              </EnhancedTooltipContent>
            }>
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
