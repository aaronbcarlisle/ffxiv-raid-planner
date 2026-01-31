/**
 * Priority Preset Selector
 *
 * Dropdown for selecting priority calculation presets.
 * Each preset configures the advanced options with sensible defaults.
 */

import { Zap, Scale, Target, Settings2 } from 'lucide-react';
import { Select } from '../ui';
import type { PriorityPreset } from '../../types';

const PRESET_OPTIONS: {
  value: PriorityPreset;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: 'balanced',
    label: 'Balanced (Recommended)',
    description: 'Equal weight to role priority, gear need, and fairness',
    icon: Zap,
  },
  {
    value: 'strict-fairness',
    label: 'Strict Fairness',
    description: 'Even distribution above all else - everyone gets roughly equal drops',
    icon: Scale,
  },
  {
    value: 'gear-need-focus',
    label: 'Gear Need Focus',
    description: 'Players missing more gear get higher priority',
    icon: Target,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Manually configure all priority multipliers',
    icon: Settings2,
  },
];

interface PresetSelectorProps {
  value: PriorityPreset;
  onChange: (preset: PriorityPreset) => void;
  disabled?: boolean;
}

export function PresetSelector({ value, onChange, disabled }: PresetSelectorProps) {
  const currentPreset = PRESET_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onChange={(newValue) => onChange(newValue as PriorityPreset)}
        disabled={disabled}
        options={PRESET_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
      />
      {currentPreset && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <currentPreset.icon className="w-3.5 h-3.5" />
          {currentPreset.description}
        </p>
      )}
    </div>
  );
}
