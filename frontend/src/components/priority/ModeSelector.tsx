/**
 * Priority Mode Selector
 *
 * Dropdown for selecting the priority system mode with descriptions.
 */

import { ListOrdered, Calendar, XCircle } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Select } from '../ui';
import type { PrioritySystemMode } from '../../types';

const MODE_OPTIONS: {
  value: PrioritySystemMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'role-based',
    label: 'Role Based (Default)',
    description: 'Prioritize by role order (Tank > Healer > DPS, etc.)',
    icon: <ListOrdered className="w-3.5 h-3.5" />,
  },
  {
    value: 'job-based',
    label: 'Job Based',
    description: 'Prioritize specific jobs regardless of player',
    icon: <XivIcon name="loot" size={14} />,
  },
  {
    value: 'player-based',
    label: 'Player Based',
    description: 'Prioritize specific players regardless of job',
    icon: <XivIcon name="party" size={14} />,
  },
  {
    value: 'manual-planning',
    label: 'Manual Planning',
    description: 'Pre-assign loot to players per week',
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
  {
    value: 'disabled',
    label: 'Disabled',
    description: 'Hide all priority UI (equal distribution)',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
];

interface ModeSelectorProps {
  value: PrioritySystemMode;
  onChange: (mode: PrioritySystemMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  const currentMode = MODE_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onChange={(newValue) => onChange(newValue as PrioritySystemMode)}
        disabled={disabled}
        options={MODE_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
      />
      {currentMode && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          {currentMode.icon}
          {currentMode.description}
        </p>
      )}
    </div>
  );
}
