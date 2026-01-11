import type { SortPreset } from '../../types';
import { SORT_PRESETS } from '../../utils/constants';

interface SortModeSelectorProps {
  sortPreset: SortPreset;
  onPresetChange: (preset: SortPreset) => void;
}

const presetKeys: SortPreset[] = ['standard', 'dps-first', 'healer-first', 'custom'];

export function SortModeSelector({ sortPreset, onPresetChange }: SortModeSelectorProps) {
  return (
    <div className="relative">
      <select
        value={sortPreset}
        onChange={(e) => onPresetChange(e.target.value as SortPreset)}
        className="appearance-none bg-surface-raised border border-border-default rounded-md px-3 py-2 pr-8 text-sm font-medium text-text-primary cursor-pointer hover:border-accent focus-visible:border-accent focus:outline-none"
        title={SORT_PRESETS[sortPreset].description}
      >
        {presetKeys.map((key) => (
          <option key={key} value={key}>
            {SORT_PRESETS[key].name}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg
          className="w-4 h-4 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
