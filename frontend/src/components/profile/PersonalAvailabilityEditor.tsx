/**
 * PersonalAvailabilityEditor — Full editor for personal typical weekly availability.
 * Uses the same time slot format as the static availability grid.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Trash2 } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { getBrowserTimezone } from '../../utils/timezone';
import { toast } from '../../stores/toastStore';
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_PRESETS,
  filterSlotsByPreset,
  formatTimeLabel,
  getAvailabilitySlotKeyForPresetColumn,
  splitAvailabilitySlotKey,
  type TimePreset,
} from '../schedule/availabilityUtils';

interface PersonalAvailabilityEditorProps {
  onDone?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function PersonalAvailabilityEditor({ onDone, onDirtyChange }: PersonalAvailabilityEditorProps) {
  const {
    days,
    isLoading,
    submitPersonalAvailability,
  } = usePersonalAvailabilityStore();

  const timezone = getBrowserTimezone();
  const [saving, setSaving] = useState<string | null>(null);
  const [localSlots, setLocalSlots] = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    onDirtyChange?.(dirty.size > 0);
  }, [dirty.size, onDirtyChange]);

  const PRESET_STORAGE_KEY = 'personal-avail-time-preset';
  const [timePreset, setTimePreset] = useState<TimePreset>(() => {
    const saved = localStorage.getItem(PRESET_STORAGE_KEY);
    if (saved === 'prime' || saved === 'evening' || saved === 'full') return saved;
    return 'prime';
  });

  const filteredTimeSlots = useMemo(() => filterSlotsByPreset(timePreset), [timePreset]);

  // Initialize local state from store
  useEffect(() => {
    const initial: Record<string, Set<string>> = {};
    for (const day of DAYS_OF_WEEK) {
      const existing = days.find((d) => d.dayOfWeek === day);
      initial[day] = new Set(existing?.slots ?? []);
    }
    setLocalSlots(initial);
    setDirty(new Set());
  }, [days]);

  // Drag-select state
  const isSelectingRef = useRef(false);
  const selectModeRef = useRef<'add' | 'remove'>('add');
  const [, forceUpdate] = useState(0);

  const isCellSelected = useCallback((displayDay: string, time: string) => {
    const { column: day, slot } = splitAvailabilitySlotKey(
      getAvailabilitySlotKeyForPresetColumn(displayDay, time, timePreset)
    );
    return (localSlots[day] ?? new Set()).has(slot);
  }, [localSlots, timePreset]);

  const getDisplayDaySlotCount = useCallback((displayDay: string) => {
    let total = 0;
    for (const time of filteredTimeSlots) {
      if (isCellSelected(displayDay, time)) {
        total += 1;
      }
    }
    return total;
  }, [filteredTimeSlots, isCellSelected]);

  const handleCellMouseDown = useCallback((displayDay: string, time: string) => {
    const { column: day, slot } = splitAvailabilitySlotKey(
      getAvailabilitySlotKeyForPresetColumn(displayDay, time, timePreset)
    );
    const current = localSlots[day] ?? new Set();
    const isSelected = current.has(slot);
    selectModeRef.current = isSelected ? 'remove' : 'add';
    isSelectingRef.current = true;

    setLocalSlots((prev) => {
      const next = { ...prev };
      const set = new Set(prev[day] ?? []);
      if (selectModeRef.current === 'add') {
        set.add(slot);
      } else {
        set.delete(slot);
      }
      next[day] = set;
      return next;
    });
    setDirty((prev) => new Set([...prev, day]));
  }, [localSlots, timePreset]);

  const handleCellMouseEnter = useCallback((displayDay: string, time: string) => {
    if (!isSelectingRef.current) return;

    const { column: day, slot } = splitAvailabilitySlotKey(
      getAvailabilitySlotKeyForPresetColumn(displayDay, time, timePreset)
    );

    setLocalSlots((prev) => {
      const next = { ...prev };
      const set = new Set(prev[day] ?? []);
      if (selectModeRef.current === 'add') {
        set.add(slot);
      } else {
        set.delete(slot);
      }
      next[day] = set;
      return next;
    });
    setDirty((prev) => new Set([...prev, day]));
  }, [timePreset]);

  useEffect(() => {
    const handleUp = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        forceUpdate((n) => n + 1);
      }
    };
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  const handleClearDay = useCallback((day: string) => {
    setLocalSlots((prev) => ({ ...prev, [day]: new Set() }));
    setDirty((prev) => new Set([...prev, day]));
  }, []);

  const handleClearDisplayDay = useCallback((displayDay: string) => {
    const affectedDays = new Set<string>();
    setLocalSlots((prev) => {
      const next = { ...prev };
      for (const time of filteredTimeSlots) {
        const { column: day, slot } = splitAvailabilitySlotKey(
          getAvailabilitySlotKeyForPresetColumn(displayDay, time, timePreset)
        );
        affectedDays.add(day);
        next[day] = new Set(next[day] ?? []);
        next[day].delete(slot);
      }
      return next;
    });
    setDirty((prev) => new Set([...prev, ...affectedDays]));
  }, [filteredTimeSlots, timePreset]);

  const handleClearColumn = timePreset === 'full' ? handleClearDay : handleClearDisplayDay;

  const handleCancel = () => {
    onDone?.();
  };

  const handleSave = async () => {
    const dirtyDays = Array.from(dirty);
    if (dirtyDays.length === 0) {
      onDone?.();
      return;
    }

    setSaving('all');
    try {
      for (const day of dirtyDays) {
        const slots = Array.from(localSlots[day] ?? []);
        await submitPersonalAvailability(day, slots, timezone);
      }
      setDirty(new Set());
      onDirtyChange?.(false);
      toast.success(`Saved availability for ${dirtyDays.length} day${dirtyDays.length !== 1 ? 's' : ''}`);
      onDone?.();
    } catch {
      toast.error('Failed to save availability');
    } finally {
      setSaving(null);
    }
  };

  const configuredCount = Object.values(localSlots).filter((s) => s.size > 0).length;

  if (isLoading && days.length === 0) {
    return <div className="h-32 flex items-center justify-center text-text-tertiary text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default bg-surface-elevated/60 px-4 py-3">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Set your personal weekly default
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          These hours stay private to you and can be reused when filling static schedules.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm text-text-secondary break-all">
            {timezone}
          </span>
        </div>
        <div className="grid w-full grid-cols-1 gap-1.5 sm:w-auto sm:grid-cols-3">
          {(Object.keys(TIME_PRESETS) as TimePreset[]).map((preset) => (
            <Button
              key={preset}
              variant={timePreset === preset ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                setTimePreset(preset);
                localStorage.setItem(PRESET_STORAGE_KEY, preset);
              }}
              className="justify-center"
            >
              {TIME_PRESETS[preset].label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-tertiary">
        Click or drag to select your usual availability. Use presets to keep the grid focused while your saved slots stay intact.
      </p>

      {/* Grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full px-4 sm:px-0">
          <table className="w-full border-collapse select-none">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface-card w-14 text-xs text-text-tertiary font-medium py-1" />
                {DAYS_OF_WEEK.map((day) => {
                  const slotCount = getDisplayDaySlotCount(day);
                  return (
                <th key={day} className="text-center px-0.5 py-1 min-w-[40px]">
                  <div className="text-xs font-medium text-text-secondary">{DAY_LABELS[day]}</div>
                  {slotCount > 0 && (
                        <div className="flex items-center justify-center gap-0.5 mt-0.5">
                          <Badge variant="info" size="sm">{slotCount}</Badge>
                          {/* design-system-ignore: Compact inline clear for day column */}
                          <button
                            type="button"
                            onClick={() => handleClearColumn(day)}
                            className="text-text-tertiary hover:text-status-error transition-colors p-0.5"
                            title={`Clear ${DAY_LABELS[day]}`}
                            aria-label={`Clear ${DAY_LABELS[day]} availability`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredTimeSlots.map((time) => (
                <tr key={time}>
                  <td className="sticky left-0 z-10 bg-surface-card text-[10px] text-text-tertiary font-mono pr-1 py-0 text-right whitespace-nowrap">
                    {time.endsWith(':00') ? formatTimeLabel(time) : ''}
                  </td>
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = isCellSelected(day, time);
                    return (
                      <td
                        key={`${day}|${time}`}
                        onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(day, time); }}
                        onMouseEnter={() => handleCellMouseEnter(day, time)}
                        onMouseMove={() => handleCellMouseEnter(day, time)}
                        onMouseUp={() => handleCellMouseEnter(day, time)}
                        onTouchStart={(e) => { e.preventDefault(); handleCellMouseDown(day, time); }}
                        className={`
                          cursor-pointer border border-border-subtle transition-colors
                          h-4 min-w-[40px]
                          ${isSelected
                            ? 'bg-accent/30 border-accent/40'
                            : 'bg-surface-elevated/30 hover:bg-surface-elevated/60'
                          }
                        `}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border-default sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-text-secondary">
          {configuredCount > 0 ? (
            <span>{configuredCount} day{configuredCount !== 1 ? 's' : ''} configured</span>
          ) : (
            <span className="text-text-tertiary">No days configured</span>
          )}
          {dirty.size > 0 && (
            <span className="text-status-warning ml-2">({dirty.size} unsaved)</span>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={dirty.size === 0 || !!saving}
          >
            {saving ? 'Saving...' : (
              <>
                <Check className="w-4 h-4 mr-1" />
                Save{dirty.size > 0 ? ` ${dirty.size} day${dirty.size !== 1 ? 's' : ''}` : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
