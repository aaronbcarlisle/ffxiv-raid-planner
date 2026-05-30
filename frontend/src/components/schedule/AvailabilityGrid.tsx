import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, MousePointer2, RefreshCw, Users } from 'lucide-react';
import type { Membership, ScheduleSession, ScheduleSessionCreate } from '../../types';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useAuthStore } from '../../stores/authStore';
import { getBrowserTimezone, resolveNearestUpcomingDatetime } from '../../utils/timezone';
import { Badge, Button } from '../primitives';
import { AvailabilityRecommendations } from './AvailabilityRecommendations';
import { TemplateRecommendations } from './TemplateRecommendations';
import {
  buildHeatMap,
  buildTemplateHeatMap,
  buildTemplateUserSlotSet,
  buildUserSlotSet,
  computeAvailabilityRecommendations,
  computeTemplateRecommendations,
  DAY_LABELS,
  DAYS_OF_WEEK,
  formatDateHeader,
  formatHoveredSlotLabel,
  formatTimeLabel,
  getNextNDates,
  getScheduleReferenceTimezone,
  getUtcDateRange,
  localSlotsToUtcMap,
  TIME_SLOTS,
} from './availabilityUtils';

type AvailabilityMode = 'this-week' | 'typical-week';

interface AvailabilityGridProps {
  groupId: string;
  canSubmit: boolean;
  canCreateSession: boolean;
  sessions: ScheduleSession[];
  members: Membership[];
  staticName: string;
  shareCode: string;
  onCreateSessionDraft: (draft: ScheduleSessionCreate) => void;
}

function buildRecommendationSlotRanks(recommendations: ReturnType<typeof computeAvailabilityRecommendations>) {
  const ranks = new Map<string, number>();
  recommendations.forEach((recommendation, index) => {
    recommendation.slotKeys.forEach((slotKey) => {
      const existing = ranks.get(slotKey);
      if (existing === undefined || index < existing) {
        ranks.set(slotKey, index);
      }
    });
  });
  return ranks;
}

export function AvailabilityGrid({
  groupId,
  canSubmit,
  canCreateSession,
  sessions,
  members,
  staticName,
  shareCode,
  onCreateSessionDraft,
}: AvailabilityGridProps) {
  const { user } = useAuthStore();
  const {
    data,
    templateData,
    error,
    fetchAvailability,
    submitAvailability,
    fetchTemplates,
    submitTemplate,
  } = useAvailabilityStore();
  const [mode, setMode] = useState<AvailabilityMode>('this-week');
  const [dates] = useState(() => getNextNDates(7));
  const [durationMinutes, setDurationMinutes] = useState(120);
  const localTimezone = getBrowserTimezone();
  const canEditAvailability = canSubmit && !!user;

  const isSelectingRef = useRef(false);
  const selectModeRef = useRef<'add' | 'remove'>('add');
  const pendingCellsRef = useRef<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState<'add' | 'remove'>('add');
  const [pendingCellsSnapshot, setPendingCellsSnapshot] = useState<Set<string>>(() => new Set());
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const utcRange = useMemo(() => getUtcDateRange(dates), [dates]);

  useEffect(() => {
    fetchAvailability(groupId, utcRange.startDate, utcRange.endDate);
    fetchTemplates(groupId);
  }, [groupId, utcRange.startDate, utcRange.endDate, fetchAvailability, fetchTemplates]);

  // Date-specific heat map + user slots
  const heatMap = useMemo(() => buildHeatMap(data), [data]);
  const userSlots = useMemo(
    () => (user ? buildUserSlotSet(data, user.id) : new Set<string>()),
    [data, user]
  );

  // Template heat map + user slots
  const templateHeatMap = useMemo(() => buildTemplateHeatMap(templateData), [templateData]);
  const templateUserSlots = useMemo(
    () => (user ? buildTemplateUserSlotSet(templateData, user.id) : new Set<string>()),
    [templateData, user]
  );

  // Active heat map / user slots depend on current mode
  const activeHeatMap = mode === 'typical-week' ? templateHeatMap : heatMap;
  const activeUserSlots = mode === 'typical-week' ? templateUserSlots : userSlots;

  const trackedMembers = useMemo(
    () => members.filter((member) => member.role !== 'viewer'),
    [members]
  );
  const responderCount = useMemo(() => {
    const ids = new Set<string>();
    for (const dateSummary of data) {
      for (const response of dateSummary.responses) {
        ids.add(response.userId);
      }
    }
    return ids.size;
  }, [data]);
  const totalMembers = trackedMembers.length || responderCount || 1;
  const referenceTimezone = useMemo(
    () => getScheduleReferenceTimezone(sessions, localTimezone),
    [sessions, localTimezone]
  );
  const recommendations = useMemo(
    () => computeAvailabilityRecommendations(data, members, dates, durationMinutes),
    [data, members, dates, durationMinutes]
  );
  const recommendationSlotRanks = useMemo(
    () => buildRecommendationSlotRanks(recommendations),
    [recommendations]
  );

  const stableRef = useRef({ userSlots, templateUserSlots, groupId, submitAvailability, submitTemplate, user, mode });
  useEffect(() => {
    stableRef.current = { userSlots, templateUserSlots, groupId, submitAvailability, submitTemplate, user, mode };
  }, [groupId, submitAvailability, submitTemplate, user, userSlots, templateUserSlots, mode]);

  const getEffectiveSelection = (key: string): boolean => {
    if (pendingCellsSnapshot.has(key)) {
      return selectMode === 'add';
    }
    return activeUserSlots.has(key);
  };

  const saveIdRef = useRef(0);

  const handleCellMouseDown = (date: string, time: string) => {
    if (!canEditAvailability) {
      return;
    }

    const key = `${date}|${time}`;
    const isSelected = activeUserSlots.has(key);
    const nextMode = isSelected ? 'remove' : 'add';
    selectModeRef.current = nextMode;
    setSelectMode(nextMode);
    isSelectingRef.current = true;
    const nextPendingCells = new Set([key]);
    pendingCellsRef.current = nextPendingCells;
    saveIdRef.current += 1;
    setPendingCellsSnapshot(nextPendingCells);
  };

  const handleCellMouseEnter = (date: string, time: string) => {
    const key = `${date}|${time}`;
    setHoveredCell(key);
    if (!isSelectingRef.current) {
      return;
    }
    pendingCellsRef.current.add(key);
    setPendingCellsSnapshot(new Set(pendingCellsRef.current));
  };

  useEffect(() => {
    const onMouseUp = async () => {
      if (!isSelectingRef.current) {
        return;
      }
      isSelectingRef.current = false;

      const mySaveId = saveIdRef.current;
      const {
        userSlots: currentSlots,
        templateUserSlots: currentTemplateSlots,
        groupId: currentGroupId,
        submitAvailability: persistAvailability,
        submitTemplate: persistTemplate,
        user: currentUser,
        mode: currentMode,
      } = stableRef.current;

      if (!currentUser) {
        pendingCellsRef.current = new Set();
        setPendingCellsSnapshot(new Set());
        return;
      }

      const pending = new Set(pendingCellsRef.current);
      const paintMode = selectModeRef.current;
      if (pending.size === 0) {
        pendingCellsRef.current = new Set();
        setPendingCellsSnapshot(new Set());
        return;
      }

      const activeSlots = currentMode === 'typical-week' ? currentTemplateSlots : currentSlots;
      const nextUserSlots = new Set(activeSlots);
      for (const cell of pending) {
        if (paintMode === 'add') {
          nextUserSlots.add(cell);
        } else {
          nextUserSlots.delete(cell);
        }
      }

      let anyFailed = false;

      if (currentMode === 'typical-week') {
        // Group updated slots by day-of-week and persist each day
        const byDay = new Map<string, string[]>();
        for (const key of nextUserSlots) {
          const [day, time] = key.split('|');
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(time);
        }
        // Also persist days where all slots were removed
        const affectedDays = new Set([...pending].map((k) => k.split('|')[0]));
        for (const day of affectedDays) {
          if (!byDay.has(day)) byDay.set(day, []);
        }
        for (const [day, slots] of byDay.entries()) {
          try {
            await persistTemplate(currentGroupId, day, slots);
          } catch {
            anyFailed = true;
          }
        }
      } else {
        const utcMap = localSlotsToUtcMap(nextUserSlots);
        const previousUtcMap = localSlotsToUtcMap(currentSlots);
        const allDates = new Set([...utcMap.keys(), ...previousUtcMap.keys()]);

        for (const utcDate of allDates) {
          const nextSlots = utcMap.get(utcDate) ?? [];
          const previousSlots = new Set(previousUtcMap.get(utcDate) ?? []);
          let changed = nextSlots.length !== previousSlots.size;
          if (!changed) {
            for (const slot of nextSlots) {
              if (!previousSlots.has(slot)) { changed = true; break; }
            }
          }
          if (!changed) continue;
          try {
            await persistAvailability(currentGroupId, utcDate, nextSlots);
          } catch {
            anyFailed = true;
          }
        }
      }

      if (saveIdRef.current === mySaveId) {
        if (!anyFailed) {
          pendingCellsRef.current = new Set();
        }
        setPendingCellsSnapshot(new Set(pendingCellsRef.current));
      }
    };

    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  const columns = mode === 'typical-week' ? DAYS_OF_WEEK : dates;

  const hoveredInfo = hoveredCell ? activeHeatMap.get(hoveredCell) : null;
  const hoveredLabel = hoveredCell
    ? mode === 'typical-week'
      ? (() => {
          const [day, time] = hoveredCell.split('|');
          return `${DAY_FULL_LABELS[day as keyof typeof DAY_FULL_LABELS] ?? day} at ${formatTimeLabel(time)}`;
        })()
      : formatHoveredSlotLabel(hoveredCell)
    : null;
  const selectedSlotCount = useMemo(() => {
    let total = 0;
    for (const col of columns) {
      for (const time of TIME_SLOTS) {
        const key = `${col}|${time}`;
        const isSelected = pendingCellsSnapshot.has(key)
          ? selectMode === 'add'
          : activeUserSlots.has(key);
        if (isSelected) {
          total += 1;
        }
      }
    }
    return total;
  }, [columns, pendingCellsSnapshot, selectMode, activeUserSlots]);

  const sharedWindowCount = useMemo(() => {
    const threshold = Math.max(1, Math.ceil(totalMembers / 2));
    let total = 0;
    for (const entry of activeHeatMap.values()) {
      if (entry.count >= threshold) {
        total += 1;
      }
    }
    return total;
  }, [activeHeatMap, totalMembers]);

  const schedulePageUrl = useMemo(
    () => new URL(`/group/${shareCode}?tab=schedule`, window.location.origin).toString(),
    [shareCode]
  );

  const handleCreateSessionDraft = (recommendation: (typeof recommendations)[number]) => {
    const resolvedStart = resolveNearestUpcomingDatetime(recommendation.startIso);
    const durationMs = new Date(recommendation.endIso).getTime() - new Date(recommendation.startIso).getTime();
    const resolvedEnd = new Date(new Date(resolvedStart).getTime() + durationMs).toISOString();
    const BYDAY_KEYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
    const dayIndex = new Date(resolvedStart).getUTCDay();
    const bydayKey = BYDAY_KEYS[dayIndex];
    onCreateSessionDraft({
      title: 'Recommended Raid Night',
      description: `${recommendation.availableCount}/${recommendation.totalMembers} marked available from the best raid windows panel.`,
      startTime: resolvedStart,
      endTime: resolvedEnd,
      timezone: referenceTimezone,
      isRecurring: true,
      recurrenceRule: `FREQ=WEEKLY;BYDAY=${bydayKey}`,
    });
  };

  const templateRecommendations = useMemo(
    () => computeTemplateRecommendations(templateData, members, durationMinutes),
    [templateData, members, durationMinutes]
  );

  const handleCreateFromTemplate = (rec: (typeof templateRecommendations)[number]) => {
    // Find next upcoming occurrence of this weekday
    const BYDAY_KEYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
    const dayIndex = DAYS_OF_WEEK.indexOf(rec.dayOfWeek);
    // dayIndex in DAYS_OF_WEEK is 0=MO … 6=SU; JS getDay() is 0=SU … 6=SA
    const jsDay = dayIndex === 6 ? 0 : dayIndex + 1;
    const now = new Date();
    const daysUntil = (jsDay - now.getUTCDay() + 7) % 7 || 7;
    const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil));
    const dateStr = nextDate.toISOString().slice(0, 10);
    const startIso = `${dateStr}T${rec.startTime}:00Z`;
    const endIso = `${dateStr}T${rec.endTime}:00Z`;
    onCreateSessionDraft({
      title: 'Recommended Raid Night',
      description: `${rec.availableCount}/${rec.totalMembers} available based on typical weekly schedule.`,
      startTime: startIso,
      endTime: endIso,
      timezone: referenceTimezone,
      isRecurring: true,
      recurrenceRule: `FREQ=WEEKLY;BYDAY=${BYDAY_KEYS[jsDay]}`,
    });
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4" data-testid="availability-grid">
      {mode === 'typical-week' ? (
        <TemplateRecommendations
          recommendations={templateRecommendations}
          durationMinutes={durationMinutes}
          onDurationChange={setDurationMinutes}
          canCreateSession={canCreateSession}
          onCreateSession={handleCreateFromTemplate}
        />
      ) : (
      <AvailabilityRecommendations
        recommendations={recommendations}
        durationMinutes={durationMinutes}
        onDurationChange={setDurationMinutes}
        referenceTimezone={referenceTimezone}
        localTimezone={localTimezone}
        staticName={staticName}
        schedulePageUrl={schedulePageUrl}
        responderCount={responderCount}
        totalMembers={totalMembers}
        canCreateSession={canCreateSession}
        onCreateSession={handleCreateSessionDraft}
      />
      )}

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
                  {mode === 'typical-week' ? 'Typical weekly schedule' : 'Find overlap windows'}
                </h3>
                <p className="max-w-2xl text-sm text-text-secondary">
                  {mode === 'typical-week'
                    ? canSubmit
                      ? 'Mark your usual free hours for each day of the week. This stays saved and helps the static find a permanent raid night.'
                      : 'View the static\'s typical weekly availability. Sign in as a member to add yours.'
                    : canSubmit
                      ? 'Drag across the grid to mark when you are free. Your picks stay highlighted while the static heat map shows the best windows.'
                      : 'Browse the static heat map to spot the best raid windows for the next seven days.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
              <div className="flex items-center gap-1 rounded-lg border border-border-default bg-surface-elevated p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'this-week' ? 'accent-subtle' : 'ghost'}
                  onClick={() => setMode('this-week')}
                >
                  This week
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'typical-week' ? 'accent-subtle' : 'ghost'}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => setMode('typical-week')}
                >
                  Typical week
                </Button>
              </div>
              <Badge variant={canSubmit ? 'success' : 'info'}>
                {canEditAvailability ? 'Editable' : canSubmit ? 'Loading account' : 'View only'}
              </Badge>
              <Badge variant="default">{mode === 'typical-week' ? '7 days' : `${dates.length} days`}</Badge>
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
                {canEditAvailability ? 'Marked in the next seven days' : 'Sign in as a static member to add yours'}
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
                Party members counted for best raid windows
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
              {canEditAvailability ? 'Drag to paint your availability' : 'Hover any slot to inspect overlap'}
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
                    gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(5.5rem, 1fr))`,
                    minWidth: `${4.5 + columns.length * 5.5}rem`,
                  }}
                >
                  <div className="rounded-xl bg-surface-card/90 p-1" />
                  {columns.map((col) => {
                    const isTemplate = mode === 'typical-week';
                    const label = isTemplate ? DAY_LABELS[col as keyof typeof DAY_LABELS] : formatDateHeader(col).day;
                    const sublabel = isTemplate ? null : formatDateHeader(col).date;
                    return (
                      <div
                        key={col}
                        className="rounded-xl border border-border-subtle bg-surface-card/90 px-2 py-2 text-center"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {label}
                        </div>
                        {sublabel && <div className="mt-0.5 text-sm font-medium text-text-primary">{sublabel}</div>}
                      </div>
                    );
                  })}

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
                      ...columns.map((col) => {
                        const key = `${col}|${time}`;
                        const isUserSelected = getEffectiveSelection(key);
                        const heat = activeHeatMap.get(key);
                        const count = heat?.count ?? 0;
                        const intensity = count / totalMembers;
                        const isHovered = hoveredCell === key;
                        const recommendationRank = recommendationSlotRanks.get(key);

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

                        const recommendationClass = recommendationRank === 0
                          ? 'shadow-[0_0_0_1px_rgba(245,158,11,0.7)]'
                          : recommendationRank === 1
                            ? 'shadow-[0_0_0_1px_rgba(34,197,94,0.55)]'
                            : recommendationRank === 2
                              ? 'shadow-[0_0_0_1px_rgba(14,165,233,0.55)]'
                              : '';

                        return (
                          <div
                            key={key}
                            data-testid={`avail-cell-${col}-${time.replace(':', '')}`}
                            data-selected={isUserSelected ? 'true' : undefined}
                            data-user-selected={isUserSelected ? 'true' : 'false'}
                            data-available-count={count}
                            data-recommended={recommendationRank !== undefined ? 'true' : 'false'}
                            className={`h-7 rounded-lg border ${bgColor} ${borderColor} ${recommendationClass} transition-all duration-100 ${
                              isHovered ? 'scale-[1.02] ring-2 ring-inset ring-accent/50' : ''
                            } ${canEditAvailability ? 'cursor-pointer hover:border-accent/35' : ''}`}
                            onMouseDown={() => handleCellMouseDown(col, time)}
                            onMouseEnter={() => handleCellMouseEnter(col, time)}
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
                  {hoveredLabel}
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
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5">
                <div className="h-3 w-3 rounded-sm border border-status-warning/50 bg-status-warning/25" />
                <span>Recommended window</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
