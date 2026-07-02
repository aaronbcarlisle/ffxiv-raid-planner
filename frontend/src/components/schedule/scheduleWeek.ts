/**
 * scheduleWeek — pure derivations binding the Schedule screen to the shared
 * raid-week clock (F6e spec §2.a / §4.2). The v2 Schedule week IS the loot
 * week: occurrences are expanded into half-open 7-day windows anchored at
 * useWeekClock's weekStartDate. No React, no store imports.
 */
import { computeNextOccurrence } from '../../utils/recurrence';
import { TIME_PRESETS, getNextAvailabilityColumn } from './availabilityUtils';
import type { ScheduleSession } from '../../types';

export interface SessionOccurrence { session: ScheduleSession; occursAt: string }
export interface HeatCell { date: string; hour: number; count: number; names: string[] }

const DAY_MS = 86_400_000;
const MAX_OCCURRENCES_PER_WEEK = 8;

/** Prime-window display hours: 18:00 → 02:00 (spec §2.j.4). */
export const PRIME_HOURS: number[] = (() => {
  const { start, end } = TIME_PRESETS.prime; // { start: 18, end: 2, crossesMidnight: true }
  const hours: number[] = [];
  for (let h = start; h < 24; h++) hours.push(h);
  for (let h = 0; h < end; h++) hours.push(h);
  return hours;
})();

export function sessionOccurrencesInRange(
  sessions: ScheduleSession[],
  range: { start: Date; end: Date },
  cancelledBySession?: Map<string, ReadonlySet<string>>,
): SessionOccurrence[] {
  // Half-open [start, start+7d): rangeOfWeek's `end` is start+6d (last day's start).
  const startMs = range.start.getTime();
  const endMs = startMs + 7 * DAY_MS;
  const out: SessionOccurrence[] = [];
  for (const session of sessions) {
    if (!session.isRecurring || !session.recurrenceRule) {
      const t = new Date(session.startTime).getTime();
      if (!Number.isNaN(t) && t >= startMs && t < endMs) {
        out.push({ session, occursAt: new Date(t).toISOString() });
      }
      continue;
    }
    const cancelled = cancelledBySession?.get(session.id);
    let after = new Date(startMs - 1); // strictly-after semantics → window start included
    for (let i = 0; i < MAX_OCCURRENCES_PER_WEEK; i++) {
      const next = computeNextOccurrence(
        session.startTime, session.recurrenceRule, after, cancelled, session.timezone,
      );
      if (!next || next.getTime() >= endMs) break;
      out.push({ session, occursAt: next.toISOString() });
      after = next;
    }
  }
  return out.sort((a, b) => a.occursAt.localeCompare(b.occursAt));
}

/**
 * 30-min store slots → hourly display cells, conservatively: a member counts
 * only when free for BOTH half-slots (min count + name intersection). Designed
 * for the cross-midnight prime window: hours below the window start (0,1) land
 * on the NEXT calendar date of the column.
 */
export function deriveHourlyHeatCells(
  heatMap: Map<string, { count: number; names: string[] }>,
  weekDates: string[],
  presetHours: number[] = PRIME_HOURS,
): HeatCell[][] {
  const windowStart = presetHours[0] ?? 0;
  return presetHours.map((hour) =>
    weekDates.map((dateKey) => {
      const date = hour < windowStart ? getNextAvailabilityColumn(dateKey) : dateKey;
      const hh = String(hour).padStart(2, '0');
      const a = heatMap.get(`${date}|${hh}:00`);
      const b = heatMap.get(`${date}|${hh}:30`);
      const count = Math.min(a?.count ?? 0, b?.count ?? 0);
      const bNames = new Set(b?.names ?? []);
      const names = (a?.names ?? []).filter((n) => bNames.has(n)).sort();
      return { date, hour, count, names };
    }),
  );
}

/** Raid week containing an instant. Pre-anchor instants clamp to week 1. */
export function weekOfDate(weekStartDate: string | null, iso: string): number | null {
  if (!weekStartDate) return null;
  const anchor = new Date(weekStartDate).getTime();
  const t = new Date(iso).getTime();
  if (Number.isNaN(anchor) || Number.isNaN(t)) return null;
  if (t < anchor) return 1;
  return Math.floor((t - anchor) / (7 * DAY_MS)) + 1;
}

/** First week after `fromWeek` (≤ maxWeek) containing a session occurrence. */
export function findNextSessionWeek(
  sessions: ScheduleSession[],
  rangeOfWeek: (week: number) => { start: Date; end: Date } | null,
  fromWeek: number,
  maxWeek: number,
  cancelledBySession?: Map<string, ReadonlySet<string>>,
): { week: number; occursAt: string } | null {
  for (let w = fromWeek + 1; w <= maxWeek; w++) {
    const range = rangeOfWeek(w);
    if (!range) return null;
    const occ = sessionOccurrencesInRange(sessions, range, cancelledBySession);
    if (occ.length > 0) return { week: w, occursAt: occ[0].occursAt };
  }
  return null;
}

const BYDAY_LABEL: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};

/** Display-only strip chip text, e.g. "Recurring: Tue/Fri 8:00 PM" (§2.j.5). */
export function deriveRecurringSummary(sessions: ScheduleSession[]): string | null {
  const parts: string[] = [];
  for (const s of sessions) {
    if (!s.isRecurring || !s.recurrenceRule) continue;
    const match = s.recurrenceRule.match(/BYDAY=([A-Z,]+)/);
    const days = match
      ? match[1].split(',').map((d) => BYDAY_LABEL[d] ?? d).join('/')
      : 'Weekly';
    let time: string;
    try {
      time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: s.timezone,
      }).format(new Date(s.startTime));
    } catch {
      time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
        .format(new Date(s.startTime));
    }
    parts.push(`${days} ${time}`);
  }
  return parts.length > 0 ? `Recurring: ${parts.join(' · ')}` : null;
}

/** Viewer-local 'YYYY-MM-DD|HH:MM' key of an instant (heat/rec slot matching). */
export function localSlotKeyOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}|${p(d.getHours())}:${p(d.getMinutes())}`;
}
