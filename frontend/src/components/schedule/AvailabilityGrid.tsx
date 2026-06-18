import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Eye, Moon, MousePointer2, RefreshCw, Sun, Sunrise, Sunset, Users } from 'lucide-react';
import type { Membership, ScheduleSession, ScheduleSessionCreate } from '../../types';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useAuthStore } from '../../stores/authStore';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { toast } from '../../stores/toastStore';
import { getBrowserTimezone, resolveNearestUpcomingDatetime } from '../../utils/timezone';
import { Badge, Button } from '../primitives';
import { AvailabilityRecommendations } from './AvailabilityRecommendations';
import { QuickFillHelper } from './QuickFillHelper';
import { TemplateRecommendations } from './TemplateRecommendations';
import { buildPersonalSourceByDay, getExistingTemplateDays } from './quickFillUtils';
import {
  buildHeatMap,
  buildTemplateHeatMap,
  buildTemplateUserSlotSet,
  buildUserSlotSet,
  computeAvailabilityRecommendations,
  computeTemplateRecommendations,
  DAY_FULL_LABELS,
  DAY_LABELS,
  DAYS_OF_WEEK,
  filterSlotsByPreset,
  formatDateHeader,
  formatHoveredSlotLabel,
  formatTimeLabel,
  getAvailabilitySlotKeyForPresetColumn,
  getNextNDates,
  getScheduleReferenceTimezone,
  getUtcDateRange,
  isSlotInPreset,
  localSlotsToUtcMap,
  splitAvailabilitySlotKey,
  TIME_PRESETS,
  type TimePreset,
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
  const fetchPersonalAvailability = usePersonalAvailabilityStore((s) => s.fetchPersonalAvailability);
  const [mode, setMode] = useState<AvailabilityMode>('this-week');
  const [importingPersonalTemplate, setImportingPersonalTemplate] = useState(false);
  const [dates] = useState(() => getNextNDates(7));
  const [durationMinutes, setDurationMinutes] = useState(120);
  const localTimezone = getBrowserTimezone();
  const canEditAvailability = canSubmit && !!user;

  const PRESET_STORAGE_KEY = 'schedule-time-preset';
  const [timePreset, setTimePreset] = useState<TimePreset>(() => {
    const saved = localStorage.getItem(PRESET_STORAGE_KEY);
    if (saved === 'prime' || saved === 'evening' || saved === 'full') return saved;
    return 'prime';
  });
  const primeStartRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const filteredTimeSlots = useMemo(() => filterSlotsByPreset(timePreset), [timePreset]);

  const isSelectingRef = useRef(false);
  const selectModeRef = useRef<'add' | 'remove'>('add');
  const pendingCellsRef = useRef<Set<string>>(new Set());
  const committedSlotsRef = useRef<Set<string>>(new Set());
  const inFlightSavesRef = useRef(0);
  const [selectMode, setSelectMode] = useState<'add' | 'remove'>('add');
  const [pendingCellsSnapshot, setPendingCellsSnapshot] = useState<Set<string>>(() => new Set());
  const [committedSlotsSnapshot, setCommittedSlotsSnapshot] = useState<Set<string>>(() => new Set());
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
  const activeUserSlotsKey = useMemo(
    () => Array.from(activeUserSlots).sort().join('\u0000'),
    [activeUserSlots]
  );

  useEffect(() => {
    if (isSelectingRef.current || inFlightSavesRef.current > 0) {
      return;
    }
    const nextCommittedSlots = new Set(activeUserSlots);
    committedSlotsRef.current = nextCommittedSlots;
    setCommittedSlotsSnapshot(nextCommittedSlots);
  }, [activeUserSlotsKey, activeUserSlots, mode]);

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

  const stableRef = useRef({ groupId, submitAvailability, submitTemplate, user, mode });
  useEffect(() => {
    stableRef.current = { groupId, submitAvailability, submitTemplate, user, mode };
  }, [groupId, submitAvailability, submitTemplate, user, mode]);

  const getEffectiveSelection = (key: string): boolean => {
    if (pendingCellsSnapshot.has(key)) {
      return selectMode === 'add';
    }
    return committedSlotsSnapshot.has(key);
  };

  const effectiveSelectedSlots = useMemo(() => {
    const slots = new Set(committedSlotsSnapshot);
    for (const key of pendingCellsSnapshot) {
      if (selectMode === 'add') {
        slots.add(key);
      } else {
        slots.delete(key);
      }
    }
    return slots;
  }, [committedSlotsSnapshot, pendingCellsSnapshot, selectMode]);

  const saveIdRef = useRef(0);

  const handleCellMouseDown = (key: string) => {
    if (!canEditAvailability) {
      return;
    }

    const isSelected = pendingCellsRef.current.has(key)
      ? selectModeRef.current === 'add'
      : committedSlotsRef.current.has(key);
    const nextMode = isSelected ? 'remove' : 'add';
    selectModeRef.current = nextMode;
    setSelectMode(nextMode);
    isSelectingRef.current = true;
    const nextPendingCells = new Set([key]);
    pendingCellsRef.current = nextPendingCells;
    saveIdRef.current += 1;
    setPendingCellsSnapshot(nextPendingCells);
  };

  const handleCellMouseEnter = (key: string) => {
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

      const previousCommittedSlots = new Set(committedSlotsRef.current);
      const nextUserSlots = new Set(previousCommittedSlots);
      for (const cell of pending) {
        if (paintMode === 'add') {
          nextUserSlots.add(cell);
        } else {
          nextUserSlots.delete(cell);
        }
      }

      committedSlotsRef.current = nextUserSlots;
      setCommittedSlotsSnapshot(new Set(nextUserSlots));
      inFlightSavesRef.current += 1;

      let anyFailed = false;

      try {
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
          const previousUtcMap = localSlotsToUtcMap(previousCommittedSlots);
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
      } finally {
        inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
      }

      if (saveIdRef.current === mySaveId) {
        if (anyFailed) {
          committedSlotsRef.current = previousCommittedSlots;
          setCommittedSlotsSnapshot(new Set(previousCommittedSlots));
        }
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

  const hiddenSlotCount = useMemo(() => {
    if (timePreset === 'full') return 0;
    const visibleSlotKeys = new Set<string>();
    for (const col of columns) {
      for (const time of filteredTimeSlots) {
        visibleSlotKeys.add(getAvailabilitySlotKeyForPresetColumn(col, time, timePreset));
      }
    }

    let count = 0;
    for (const key of effectiveSelectedSlots) {
      const { slot } = splitAvailabilitySlotKey(key);
      if (!isSlotInPreset(slot, timePreset) || !visibleSlotKeys.has(key)) count++;
    }
    return count;
  }, [timePreset, columns, filteredTimeSlots, effectiveSelectedSlots]);

  const handlePresetChange = (next: TimePreset) => {
    setTimePreset(next);
    localStorage.setItem(PRESET_STORAGE_KEY, next);
    if (next === 'full') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          primeStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  };

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
    return effectiveSelectedSlots.size;
  }, [effectiveSelectedSlots]);

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

  const handleImportPersonalTemplate = async () => {
    if (!user) return;
    setImportingPersonalTemplate(true);
    try {
      await fetchPersonalAvailability();
      const personalDays = usePersonalAvailabilityStore.getState().days;
      const personalByDay = buildPersonalSourceByDay(personalDays);

      if (personalByDay.size === 0) {
        toast.info('Set up Player Hub availability first.');
        return;
      }

      const existingDays = getExistingTemplateDays(templateData, user.id);
      const importedDays: string[] = [];
      const skippedDays: string[] = [];

      for (const [dayOfWeek, slots] of personalByDay.entries()) {
        if (existingDays.has(dayOfWeek)) {
          skippedDays.push(dayOfWeek);
          continue;
        }
        await submitTemplate(groupId, dayOfWeek, slots);
        importedDays.push(dayOfWeek);
      }

      await fetchTemplates(groupId);

      if (importedDays.length > 0) {
        const skippedText = skippedDays.length > 0
          ? ` Skipped ${skippedDays.length} existing day${skippedDays.length !== 1 ? 's' : ''}.`
          : '';
        toast.success(`Imported ${importedDays.length} day${importedDays.length !== 1 ? 's' : ''} from Player Hub.${skippedText}`);
      } else if (skippedDays.length > 0) {
        toast.info('No empty Typical Week days to import - existing static templates were preserved.');
      } else {
        toast.info('No Player Hub availability days matched this static template.');
      }
    } catch {
      toast.error('Failed to import Player Hub availability.');
    } finally {
      setImportingPersonalTemplate(false);
    }
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

      <div className="overflow-clip rounded-2xl border border-border-default bg-linear-to-br from-surface-raised via-surface-card to-surface-raised shadow-lg shadow-black/20">
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

        {/* Quick fill helper — only in This Week mode for editable users */}
        {mode === 'this-week' && canEditAvailability && user && (
          <div className="px-3 pt-3 sm:px-4 lg:px-6">
            <QuickFillHelper groupId={groupId} userId={user.id} dates={dates} />
          </div>
        )}

        {mode === 'typical-week' && canEditAvailability && user && (
          <div className="px-3 pt-3 sm:px-4 lg:px-6">
            <div className="rounded-xl border border-border-default bg-surface-elevated/60 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-text-primary">Import from Player Hub availability</span>
                    <Badge variant="default" size="sm">Empty days only</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Use your personal default as this static&apos;s Typical Week. Existing static days are preserved.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleImportPersonalTemplate}
                    loading={importingPersonalTemplate}
                  >
                    Import from Player Hub availability
                  </Button>
                  <Link
                    to="/profile?tab=availability&focus=availability"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 sm:min-h-0"
                  >
                    Edit Player Hub availability
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
          {/* Toolbar: preset chips + hints */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2 text-center lg:justify-between lg:text-left">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5 text-xs text-text-secondary">
                  <MousePointer2 className="h-3.5 w-3.5 text-accent" />
                  {canEditAvailability ? 'Drag to paint availability' : 'Hover to inspect overlap'}
                </div>
                {hiddenSlotCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => handlePresetChange('full')}
                    className="rounded-full border border-status-warning/40 bg-status-warning/10 text-xs font-medium text-status-warning hover:bg-status-warning/20"
                  >
                    {hiddenSlotCount} slot{hiddenSlotCount !== 1 ? 's' : ''} in hidden hours — show all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-surface-elevated p-0.5">
                  {(['prime', 'evening', 'full'] as const).map((preset) => {
                    const icons = { prime: Sunset, evening: Moon, full: Clock3 };
                    const Icon = icons[preset];
                    return (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={timePreset === preset ? 'accent-subtle' : 'ghost'}
                        leftIcon={<Icon className="h-3.5 w-3.5" />}
                        onClick={() => handlePresetChange(preset)}
                      >
                        {TIME_PRESETS[preset].label}
                      </Button>
                    );
                  })}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3 py-1.5 text-xs text-text-secondary">
                  <Clock3 className="h-3.5 w-3.5 text-accent" />
                  {localTimezone}
                </div>
              </div>
            </div>
            {timePreset === 'prime' && (
              <p className="text-center text-xs text-text-muted lg:text-left">
                Showing 6 PM – 2 AM. Slots after midnight are the next calendar day.
              </p>
            )}
          </div>

          {/* Grid: sticky header (outside overflow-x) + scrollable body */}
          <div
            className="rounded-2xl border border-border-default bg-surface-base/90 select-none shadow-sm"
            onMouseLeave={() => setHoveredCell(null)}
          >
            {/* Sticky header — no overflow-x so sticky binds to <main> scroll */}
            <div
              ref={headerScrollRef}
              className="sticky top-0 z-20 overflow-hidden rounded-t-2xl border-b border-border-subtle bg-surface-card/95 backdrop-blur-sm"
            >
              <div
                className="grid gap-x-0.5 gap-y-0.5 px-1.5 py-1.5 sm:gap-x-1"
                style={{
                  gridTemplateColumns: `2.75rem repeat(${columns.length}, minmax(2.5rem, 1fr))`,
                  minWidth: `${2.75 + columns.length * 2.5}rem`,
                }}
              >
                <div className="sticky left-0 z-[1] rounded-xl bg-surface-card/90 p-1" />
                {columns.map((col) => {
                  const isTemplate = mode === 'typical-week';
                  const label = isTemplate ? DAY_LABELS[col as keyof typeof DAY_LABELS] : formatDateHeader(col).day;
                  const sublabel = isTemplate ? null : formatDateHeader(col).date;
                  return (
                    <div
                      key={col}
                      className="rounded-lg border border-border-subtle bg-surface-elevated px-1 py-1.5 text-center sm:px-2 sm:py-2"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted sm:text-xs sm:tracking-[0.14em]">
                        {label}
                      </div>
                      {sublabel && <div className="mt-0.5 text-xs font-medium text-text-primary sm:text-sm">{sublabel}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid body — overflow-x-auto for horizontal scroll on mobile */}
            <div
              ref={bodyScrollRef}
              className="overflow-x-auto"
              onScroll={(e) => {
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div
                className="grid gap-x-0.5 gap-y-0.5 rounded-b-2xl bg-border-subtle px-1.5 pb-1.5 sm:gap-x-1"
                style={{
                  gridTemplateColumns: `2.75rem repeat(${columns.length}, minmax(2.5rem, 1fr))`,
                  minWidth: `${2.75 + columns.length * 2.5}rem`,
                }}
              >

              {filteredTimeSlots.map((time, slotIndex) => {
                const hour = Number(time.split(':')[0]);
                const isHourBoundary = time.endsWith(':00');
                const prevHour = slotIndex > 0 ? Number(filteredTimeSlots[slotIndex - 1].split(':')[0]) : -1;
                const isPrimeStart = time === '18:00';

                // Section dividers: 6-hour blocks in full mode, midnight crossing in prime mode
                let sectionDivider: React.ReactNode = null;
                if (timePreset === 'full' && isHourBoundary && hour % 6 === 0) {
                  const sections: Record<number, { label: string; Icon: typeof Sun }> = {
                    0: { label: 'Late Night', Icon: Moon },
                    6: { label: 'Morning', Icon: Sunrise },
                    12: { label: 'Afternoon', Icon: Sun },
                    18: { label: 'Evening', Icon: Sunset },
                  };
                  const section = sections[hour];
                  if (section) {
                    const { label: sectionLabel, Icon } = section;
                    sectionDivider = (
                      <div
                        key={`section-${hour}`}
                        className="col-span-full flex items-center gap-2 rounded-lg bg-surface-elevated/60 px-2 py-1"
                      >
                        <Icon className="h-3.5 w-3.5 text-text-muted" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          {sectionLabel}
                        </span>
                        <div className="h-px flex-1 bg-border-subtle" />
                      </div>
                    );
                  }
                } else if (timePreset === 'prime' && hour < prevHour) {
                  // Midnight crossing in prime mode
                  sectionDivider = (
                    <div
                      key="section-midnight"
                      className="col-span-full flex items-center gap-2 rounded-lg bg-surface-elevated/60 px-2 py-1"
                    >
                      <Moon className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        After Midnight (+1 day)
                      </span>
                      <div className="h-px flex-1 bg-border-subtle" />
                    </div>
                  );
                }

                const row = [
                  <div
                    key={`label-${time}`}
                    ref={isPrimeStart ? primeStartRef : undefined}
                    className={`sticky left-0 z-[1] flex h-6 items-center justify-end rounded-lg bg-surface-card/90 px-1.5 text-right ${
                      isHourBoundary ? 'border border-border-subtle' : 'border border-transparent'
                    }`}
                  >
                    {isHourBoundary && (
                      <span className="text-[10px] font-medium leading-tight text-text-secondary">
                        {formatTimeLabel(time)}
                      </span>
                    )}
                  </div>,
                  ...columns.map((col) => {
                    const key = getAvailabilitySlotKeyForPresetColumn(col, time, timePreset);
                    const isUserSelected = getEffectiveSelection(key);
                    const heat = activeHeatMap.get(key);
                    const count = heat?.count ?? 0;
                    const intensity = count / totalMembers;
                    const isHovered = hoveredCell === key;
                    const recommendationRank = recommendationSlotRanks.get(key);

                    let bgColor = 'bg-surface-card';
                    let borderColor = 'border-border-default/50';
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
                        className={`h-6 rounded-md border ${bgColor} ${borderColor} ${recommendationClass} transition-all duration-100 ${
                          isHovered ? 'scale-[1.02] ring-2 ring-inset ring-accent/50' : ''
                        } ${canEditAvailability ? 'cursor-pointer hover:border-accent/35' : ''}`}
                        onMouseDown={() => handleCellMouseDown(key)}
                        onMouseEnter={() => handleCellMouseEnter(key)}
                        onMouseMove={() => handleCellMouseEnter(key)}
                        onMouseUp={() => handleCellMouseEnter(key)}
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

                return sectionDivider ? [sectionDivider, ...row] : row;
              }).flat()}
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
