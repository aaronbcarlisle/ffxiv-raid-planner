/**
 * MarkerPicker Component
 *
 * Popup picker for planning markers on gear slots.
 * Shows 6 markers that can be toggled on/off per slot.
 */

import { useState, useRef, useEffect } from 'react';
import type { PlanningMarker } from '../../types';
import { PLANNING_MARKERS } from '../../types';

interface MarkerPickerProps {
  markers: PlanningMarker[];
  onChange: (markers: PlanningMarker[]) => void;
  disabled?: boolean;
}

// Tailwind color classes for marker backgrounds
const MARKER_COLORS: Record<PlanningMarker, string> = {
  craft:    'bg-orange-500/20 hover:bg-orange-500/30',
  pages:    'bg-blue-500/20 hover:bg-blue-500/30',
  floor4:   'bg-green-500/20 hover:bg-green-500/30',
  alliance: 'bg-yellow-500/20 hover:bg-yellow-500/30',
  improve:  'bg-teal-500/20 hover:bg-teal-500/30',
  token:    'bg-purple-500/20 hover:bg-purple-500/30',
};

const MARKER_ACTIVE_COLORS: Record<PlanningMarker, string> = {
  craft:    'bg-orange-500/40 ring-1 ring-orange-500/50',
  pages:    'bg-blue-500/40 ring-1 ring-blue-500/50',
  floor4:   'bg-green-500/40 ring-1 ring-green-500/50',
  alliance: 'bg-yellow-500/40 ring-1 ring-yellow-500/50',
  improve:  'bg-teal-500/40 ring-1 ring-teal-500/50',
  token:    'bg-purple-500/40 ring-1 ring-purple-500/50',
};

export function MarkerPicker({ markers, onChange, disabled }: MarkerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleMarker = (marker: PlanningMarker) => {
    if (disabled) return;

    const newMarkers = markers.includes(marker)
      ? markers.filter(m => m !== marker)
      : [...markers, marker];

    onChange(newMarkers);
  };

  const hasMarkers = markers.length > 0;

  return (
    <div ref={pickerRef} className="relative inline-flex">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center justify-center min-w-[24px] h-6 px-1 rounded transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-hover cursor-pointer'}
          ${hasMarkers ? 'text-text-primary' : 'text-text-muted'}
        `}
        title={hasMarkers ? markers.map(m => PLANNING_MARKERS[m].label).join(', ') : 'Add planning marker'}
      >
        {hasMarkers ? (
          <span className="text-sm leading-none">
            {markers.map(m => PLANNING_MARKERS[m].icon).join('')}
          </span>
        ) : (
          <span className="text-xs text-text-muted">+</span>
        )}
      </button>

      {/* Popup picker */}
      {isOpen && (
        <div className="absolute z-50 top-full right-0 mt-1 p-2 bg-surface-elevated border border-border-default rounded-lg shadow-lg">
          <div className="flex gap-1">
            {(Object.keys(PLANNING_MARKERS) as PlanningMarker[]).map(marker => {
              const { icon, label } = PLANNING_MARKERS[marker];
              const isActive = markers.includes(marker);

              return (
                <button
                  key={marker}
                  type="button"
                  onClick={() => toggleMarker(marker)}
                  className={`
                    w-8 h-8 rounded-md text-base flex items-center justify-center transition-all
                    ${isActive ? MARKER_ACTIVE_COLORS[marker] : MARKER_COLORS[marker]}
                  `}
                  title={label}
                >
                  {icon}
                </button>
              );
            })}
          </div>

          {/* Legend / marker descriptions */}
          <div className="mt-2 pt-2 border-t border-border-subtle">
            <div className="text-[10px] text-text-muted space-y-0.5">
              {(Object.keys(PLANNING_MARKERS) as PlanningMarker[]).map(marker => (
                <div key={marker} className="flex items-center gap-1.5">
                  <span>{PLANNING_MARKERS[marker].icon}</span>
                  <span>{PLANNING_MARKERS[marker].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkerPicker;
