import type { SortPreset } from '../../types';
import { SORT_PRESETS } from '../../utils/constants';
import { Select, type SelectOption } from './Select';

interface SortModeSelectorProps {
  sortPreset: SortPreset;
  onPresetChange: (preset: SortPreset) => void;
  /**
   * Accessible name for the trigger. Additive (C6): the preset names alone
   * ("Standard", "DPS First") don't say what the control does, and the v2
   * toolbar sits it among several other controls. Omitted → unchanged DOM.
   */
  'aria-label'?: string;
}

const presetKeys: SortPreset[] = ['standard', 'dps-first', 'healer-first', 'custom'];

export function SortModeSelector({
  sortPreset,
  onPresetChange,
  'aria-label': ariaLabel,
}: SortModeSelectorProps) {
  const options: SelectOption[] = presetKeys.map((key) => ({
    value: key,
    label: SORT_PRESETS[key].name,
  }));

  return (
    <div className="w-36">
      <Select
        value={sortPreset}
        onChange={(value) => onPresetChange(value as SortPreset)}
        options={options}
        aria-label={ariaLabel}
      />
    </div>
  );
}
