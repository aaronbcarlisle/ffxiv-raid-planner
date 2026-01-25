import type { SortPreset } from '../../types';
import { SORT_PRESETS } from '../../utils/constants';
import { Select, type SelectOption } from './Select';
import { Tooltip } from '../primitives/Tooltip';

interface SortModeSelectorProps {
  sortPreset: SortPreset;
  onPresetChange: (preset: SortPreset) => void;
}

const presetKeys: SortPreset[] = ['standard', 'dps-first', 'healer-first', 'custom'];

export function SortModeSelector({ sortPreset, onPresetChange }: SortModeSelectorProps) {
  const options: SelectOption[] = presetKeys.map((key) => ({
    value: key,
    label: SORT_PRESETS[key].name,
  }));

  return (
    <Tooltip content={SORT_PRESETS[sortPreset].description}>
      <div className="w-36">
        <Select
          value={sortPreset}
          onChange={(value) => onPresetChange(value as SortPreset)}
          options={options}
          className="w-full"
        />
      </div>
    </Tooltip>
  );
}
