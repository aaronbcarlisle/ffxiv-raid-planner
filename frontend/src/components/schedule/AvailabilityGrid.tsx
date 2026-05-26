import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, MousePointer2, Users } from 'lucide-react';
import { Badge } from '../primitives';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useAuthStore } from '../../stores/authStore';
import type { AvailabilityDateSummary } from '../../types';

interface AvailabilityGridProps {
  groupId: string;
  canSubmit: boolean;
}

const START_HOUR = 12;
const END_HOUR = 24;

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const hh = String(h % 24).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function formatTimeLabel(slot: string): string {
  const [hStr, mStr] = slot.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${mStr} ${ampm}`;
}

function getNextNDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return dates;
}

function formatDateHeader(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { day, date };
}

function formatHoveredSlotLabel(slotKey: string): string {
  const [date, time] = slotKey.split('|');
  const { day, date: dateLabel } = formatDateHeader(date);
  return `${day}, ${dateLabel} at ${formatTimeLabel(time)}`;
}

function localSlotToUtc(localDate: string, localTime: string): { utcDate: string; utcTime: string } {
  const dt = new Date(`${localDate}T${localTime}:00`);
  const utcDate = dt.toISOString().slice(0, 10);
  const utcTime = dt.toISOString().slice(11, 16);
  return { utcDate, utcTime };
}

function utcSlotToLocal(utcDate: string, utcTime: string): { localDate: string; localTime: string } {
  const dt = new Date(`${utcDate}T${utcTime}:00Z`);
  const localDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const localTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { localDate, localTime };
}

interface HeatMapEntry {
  count: number;
  names: string[];
}

function buildHeatMap(data: AvailabilityDateSummary[]): Map<string, HeatMapEntry> {
  const map = new Map<string, HeatMapEntry>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      for (const utcTime of response.slots) {
        const { localDate, localTime } = utcSlotToLocal(dateSummary.date, utcTime);
        const key = `${localDate}|${localTime}`;
        const existing = map.get(key) ?? { count: 0, names: [] };
        existing.count++;
        if (response.username) existing.names.push(response.username);
        map.set(key, existing);
      }
    }
  }
  return map;
}

function buildUserSlotSet(data: AvailabilityDateSummary[], userId: string): Set<string> {
  const set = new Set<string>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      if (response.userId !== userId) continue;
      for (const utcTime of response.slots) {
        const { localDate, localTime } = utcSlotToLocal(dateSummary.date, utcTime);
        set.add(`${localDate}|${localTime}`);
      }
    }
  }
  return set;
}

function getUtcDateRange(localDates: string[]): { startDate: string; endDate: string } {
  const first = new Date(localDates[0] + 'T00:00:00');
  const last = new Date(localDates[localDates.length - 1] + 'T23:59:59');

  first.setDate(first.getDate() - 1);
  last.setDate(last.getDate() + 1);

  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}

function localSlotsToUtcMap(slots: Set<string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const slot of slots) {
    const [localDate, localTime] = slot.split('|');
    const { utcDate, utcTime } = localSlotToUtc(localDate, localTime);
    if (!map.has(utcDate)) map.set(utcDate, []);
    map.get(utcDate)!.push(utcTime);
  }
  return map;
}

export function AvailabilityGrid({ groupId, canSubmit }: AvailabilityGridProps) {
  const { user } = useAuthStore();
  const { data, error, fetchAvailability, submitAvailability } = useAvailabilityStore();
  const [dates] = useState(() => getNextNDates(7));
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Drag interaction state lives in refs to avoid stale closures in event handlers.
  // React state batches updates and re-renders asynchronously, so a mouseup handler
  // registered before the re-render would capture the OLD isSelecting/pendingCells.
  // Refs are mutable and always current.
  const isSelectingRef = useRef(false);
  const selectModeRef = useRef<'add' | 'remove'>('add');
  const pendingCellsRef = useRef<Set<string>>(new Set());
  const [renderTick, setRenderTick] = useState(0);

  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const utcRange = useMemo(() => getUtcDateRange(dates), [dates]);

  useEffect(() => {
    fetchAvailability(groupId, utcRange.startDate, utcRange.endDate);
  }, [groupId, utcRange.startDate, utcRange.endDate, fetchAvailability]);

  const heatMap = useMemo(() => buildHeatMap(data), [data]);
  const userSlots = useMemo(
    () => (user ? buildUserSlotSet(data, user.id) : new Set<string>()),
    [data, user]
  );

  const totalMembers = useMemo(() => {
    const userIds = new Set<string>();
    for (const d of data) {
      for (const r of d.responses) {
        userIds.add(r.userId);
      }
    }
    return Math.max(userIds.size, 1);
  }, [data]);

  // Keep a stable ref to values the mouseup handler needs
  const stableRef = useRef({ userSlots, groupId, submitAvailability, user });
  stableRef.current = { userSlots, groupId, submitAvailability, user };

  const getEffectiveSelection = (key: string): boolean => {
    if (pendingCellsRef.current.has(key)) {
      return selectModeRef.current === 'add';
    }
    return userSlots.has(key);
  };

  // Counter to prevent a stale save from clearing a newer drag's pending cells
  const saveIdRef = useRef(0);

  const handleCellMouseDown = (date: string, time: string) => {
    if (!canSubmit) return;
    const key = `${date}|${time}`;
    const isSelected = userSlots.has(key);
    selectModeRef.current = isSelected ? 'remove' : 'add';
    isSelectingRef.current = true;
    pendingCellsRef.current = new Set([key]);
    saveIdRef.current++;
    setRenderTick((n) => n + 1);
  };

  const handleCellMouseEnter = (date: string, time: string) => {
    const key = `${date}|${time}`;
    setHoveredCell(key);
    if (!isSelectingRef.current) return;
    pendingCellsRef.current.add(key);
    setRenderTick((n) => n + 1);
  };

  // Single stable mouseup handler — reads everything from refs
  useEffect(() => {
    const onMouseUp = async () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;

      const mySaveId = saveIdRef.current;
      const { userSlots: currentSlots, groupId: gid, submitAvailability: submit, user: u } = stableRef.current;

      if (!u) {
        pendingCellsRef.current = new Set();
        setRenderTick((n) => n + 1);
        return;
      }

      const pending = new Set(pendingCellsRef.current);
      const mode = selectModeRef.current;

      if (pending.size === 0) {
        pendingCellsRef.current = new Set();
        setRenderTick((n) => n + 1);
        return;
      }

      // Keep pending cells visible during the save — getEffectiveSelection
      // will continue to show them based on selectMode. Only clear after
      // the API responds and the store updates userSlots.

      const newUserSlots = new Set(currentSlots);
      for (const cell of pending) {
        if (mode === 'add') newUserSlots.add(cell);
        else newUserSlots.delete(cell);
      }

      const utcMap = localSlotsToUtcMap(newUserSlots);
      const oldUtcMap = localSlotsToUtcMap(currentSlots);
      const allUtcDates = new Set([...utcMap.keys(), ...oldUtcMap.keys()]);

      let anyFailed = false;
      for (const utcDate of allUtcDates) {
        const newSlots = utcMap.get(utcDate) ?? [];
        const oldSlots = new Set(oldUtcMap.get(utcDate) ?? []);

        let changed = newSlots.length !== oldSlots.size;
        if (!changed) {
          for (const s of newSlots) {
            if (!oldSlots.has(s)) { changed = true; break; }
          }
        }

        if (changed) {
          try {
            await submit(gid, utcDate, newSlots);
          } catch {
            anyFailed = true;
          }
        }
      }

      if (saveIdRef.current === mySaveId) {
        if (!anyFailed) {
          pendingCellsRef.current = new Set();
        }
        setRenderTick((n) => n + 1);
      }
    };

    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  const hoveredInfo = hoveredCell ? heatMap.get(hoveredCell) : null;
  let selectedSlotCount = 0;
  for (const date of dates) {
    for (const time of TIME_SLOTS) {
      if (getEffectiveSelection(`${date}|${time}`)) {
        selectedSlotCount++;
      }
    }
  }

  const sharedWindowCount = useMemo(() => {
    const threshold = Math.max(1, Math.ceil(totalMembers / 2));
    let total = 0;
    for (const entry of heatMap.values()) {
      if (entry.count >= threshold) {
        total++;
      }
    }
    return total;
  }, [heatMap, totalMembers]);

  // renderTick is used to force re-renders when refs change
  void renderTick;

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="overflow-hidden rounded-2xl border border-border-default bg-linear-to-br from-surface-raised via-surface-card to-surface-raised shadow-lg shadow-black/20">
        <div className="border-b border-border-subtle bg-surface-raised/80 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center justify-center gap-2 rounded-full border border-border-default bg-accent/10 px-3 py-1 text-xs font-medium text-accent lg:justify-start">
                <Users className="h-3.5 w-3.5" />
                Static Availability
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-xl text-text-primary">
                  Find overlap windows
                </h3>
                <p className="max-w-2xl text-sm text-text-secondary">
                  {canSubmit
                    ? 'Drag across the grid to mark when you are free. Your picks stay highlighted while the static heat map shows the best windows.'
                    : 'Browse the static heat map to spot the strongest overlap windows for the next seven days.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
              <Badge variant={canSubmit ? 'success' : 'info'}>
                {canSubmit ? 'Editable' : 'View only'}
              </Badge>
              <Badge variant="default">{dates.length} days</Badge>
              <Badge variant="default">{localTimezone}</Badge>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border-default bg-surface-elevated/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                Your Slots
              </div>
              <div className="mt-1 font-display text-2xl text-text-primary">
                {selectedSlotCount}
              </div>
              <div className="text-xs text-text-secondary">
                {canSubmit ? 'Marked in the next seven days' : 'Sign in as a static member to add yours'}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-elevated/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                Members Tracked
              </div>
              <div className="mt-1 font-display text-2xl text-text-primary">
                {totalMembers}
              </div>
              <div className="text-xs text-text-secondary">
                Saved responses currently visible in the grid
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-elevated/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                Shared Windows
              </div>
              <div className="mt-1 font-display text-2xl text-text-primary">
                {sharedWindowCount}
              </div>
              <div className="text-xs text-text-secondary">
                Slots where at least half the static is available
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center lg:justify-between lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5 text-xs text-text-secondary">
              <MousePointer2 className="h-3.5 w-3.5 text-accent" />
              {canSubmit ? 'Drag to paint your availability' : 'Hover any slot to inspect overlap'}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5 text-xs text-text-secondary">
              <Clock3 className="h-3.5 w-3.5 text-accent" />
              Times shown in your timezone ({localTimezone})
            </div>
          </div>

          <div
            className="rounded-2xl border border-border-default bg-surface-base/90 p-3 shadow-sm sm:p-4"
            onMouseLeave={() => setHoveredCell(null)}
          >
            <div className="overflow-x-auto select-none">
              <div className="flex min-w-max justify-center">
                <div
                  className="inline-grid gap-1 rounded-2xl bg-border-subtle p-1.5"
                  style={{
                    gridTemplateColumns: `4.5rem repeat(${dates.length}, minmax(5.5rem, 1fr))`,
                    minWidth: `${4.5 + dates.length * 5.5}rem`,
                  }}
                >
                  {/* Header row */}
                  <div className="rounded-xl bg-surface-card/90 p-1" />
                  {dates.map((date) => {
                    const { day, date: dateStr } = formatDateHeader(date);
                    return (
                      <div
                        key={date}
                        className="rounded-xl border border-border-subtle bg-surface-card/90 px-2 py-2 text-center"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {day}
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-text-primary">{dateStr}</div>
                      </div>
                    );
                  })}

                  {/* Time slot rows */}
                  {TIME_SLOTS.map((time) => {
                    const isHourBoundary = time.endsWith(':00');
                    return [
                      <div
                        key={`label-${time}`}
                        className={`flex items-center justify-end rounded-xl bg-surface-card/90 px-2 py-1 text-right ${
                          isHourBoundary ? 'border border-border-subtle' : 'border border-transparent'
                        }`}
                      >
                        {isHourBoundary && (
                          <span className="text-[11px] font-medium text-text-secondary">
                            {formatTimeLabel(time)}
                          </span>
                        )}
                      </div>,
                      ...dates.map((date) => {
                        const key = `${date}|${time}`;
                        const isUserSelected = getEffectiveSelection(key);
                        const heat = heatMap.get(key);
                        const count = heat?.count ?? 0;
                        const intensity = count / totalMembers;
                        const isHovered = hoveredCell === key;

                        let bgColor = 'bg-surface-elevated';
                        let borderColor = 'border-border-subtle/70';
                        let textColor = 'text-text-muted';

                        if (isUserSelected && count > 0) {
                          if (intensity >= 0.75) bgColor = 'bg-status-success/45';
                          else if (intensity >= 0.5) bgColor = 'bg-status-success/35';
                          else if (intensity >= 0.25) bgColor = 'bg-status-success/25';
                          else bgColor = 'bg-status-success/20';
                          borderColor = 'border-status-success/40';
                          textColor = 'text-text-primary';
                        } else if (isUserSelected) {
                          bgColor = 'bg-accent/25';
                          borderColor = 'border-accent/40';
                          textColor = 'text-accent';
                        } else if (count > 0) {
                          if (intensity >= 0.75) bgColor = 'bg-status-success/30';
                          else if (intensity >= 0.5) bgColor = 'bg-status-success/20';
                          else bgColor = 'bg-status-success/10';
                          borderColor = 'border-status-success/20';
                          textColor = 'text-status-success';
                        }

                        return (
                          <div
                            key={key}
                            className={`h-7 rounded-lg border ${bgColor} ${borderColor} transition-all duration-100 ${
                              isHovered ? 'scale-[1.02] ring-2 ring-inset ring-accent/50' : ''
                            } ${canSubmit ? 'cursor-pointer hover:border-accent/35' : ''}`}
                            onMouseDown={() => handleCellMouseDown(date, time)}
                            onMouseEnter={() => handleCellMouseEnter(date, time)}
                          >
                            {count > 0 && (
                              <div className="flex h-full w-full items-center justify-center">
                                <span className={`text-[10px] font-semibold ${textColor}`}>
                                  {count}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }),
                    ];
                  }).flat()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            {hoveredInfo && hoveredInfo.count > 0 ? (
              <div className="inline-flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-elevated px-4 py-2 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  {formatHoveredSlotLabel(hoveredCell!)}
                </span>
                <span className="text-status-success">
                  {hoveredInfo.count} available
                </span>
                <span>{hoveredInfo.names.join(', ')}</span>
              </div>
            ) : (
              <div className="text-xs text-text-muted">
                Hover a populated slot to see who is available there.
              </div>
            )}

            {error && (
              <div className="inline-flex items-center rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-2 text-sm text-status-error">
                Failed to save availability: {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-secondary">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5">
                <div className="h-3 w-3 rounded-sm border border-accent/30 bg-accent/25" />
                <span>Your selection</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5">
                <div className="h-3 w-3 rounded-sm border border-status-success/20 bg-status-success/12" />
                <span>Some overlap</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5">
                <div className="h-3 w-3 rounded-sm border border-status-success/40 bg-status-success/45" />
                <span>Strong overlap</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
