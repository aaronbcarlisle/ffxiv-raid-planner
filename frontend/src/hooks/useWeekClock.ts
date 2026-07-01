/**
 * useWeekClock — the shared week object (F6d, spec §5.4). One clock for the
 * whole shell: Loot consumes it now (WeekScopeControl, floor chips, picker
 * default week); F6e's Schedule/WeekNavigatorStrip reuses it. Weeks are
 * tier-relative integers anchored to the backend's `week_start_date`
 * (7-day buckets — see backend calculate_week_number).
 */
import { useCallback } from 'react';
import { useLootTrackingStore, type WeekEntryType } from '../stores/lootTrackingStore';

export interface WeekRange { start: Date; end: Date }

export interface WeekClock {
  currentWeek: number;
  maxWeek: number;
  weekStartDate: string | null;
  weeksWithData: Set<number>;
  weekDataTypes: Map<number, WeekEntryType[]>;
  rangeOfWeek: (week: number) => WeekRange | null;
  isCurrent: (week: number) => boolean;
  startNextWeek: () => Promise<number>;
  revertWeek: () => Promise<number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useWeekClock(groupId: string | undefined, tierId: string | undefined): WeekClock {
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);
  const maxWeek = useLootTrackingStore((s) => s.maxWeek);
  const weekStartDate = useLootTrackingStore((s) => s.weekStartDate);
  const weeksWithData = useLootTrackingStore((s) => s.weeksWithEntries);
  const weekDataTypes = useLootTrackingStore((s) => s.weekDataTypes);
  const storeStartNextWeek = useLootTrackingStore((s) => s.startNextWeek);
  const storeRevertWeek = useLootTrackingStore((s) => s.revertWeek);

  const rangeOfWeek = useCallback((week: number): WeekRange | null => {
    if (!weekStartDate) return null;
    const anchor = new Date(weekStartDate);
    if (Number.isNaN(anchor.getTime())) return null;
    const start = new Date(anchor.getTime() + (week - 1) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    return { start, end };
  }, [weekStartDate]);

  const isCurrent = useCallback((week: number) => week === currentWeek, [currentWeek]);

  const startNextWeek = useCallback(async () => {
    if (!groupId || !tierId) throw new Error('useWeekClock: missing group/tier context');
    return storeStartNextWeek(groupId, tierId);
  }, [groupId, tierId, storeStartNextWeek]);

  const revertWeek = useCallback(async () => {
    if (!groupId || !tierId) throw new Error('useWeekClock: missing group/tier context');
    return storeRevertWeek(groupId, tierId);
  }, [groupId, tierId, storeRevertWeek]);

  return {
    currentWeek, maxWeek, weekStartDate, weeksWithData, weekDataTypes,
    rangeOfWeek, isCurrent, startNextWeek, revertWeek,
  };
}
