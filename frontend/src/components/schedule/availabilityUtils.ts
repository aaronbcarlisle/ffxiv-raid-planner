import type { AvailabilityDateSummary, AvailabilityTemplateDaySummary, Membership, ScheduleSession } from '../../types';

export interface HeatMapEntry {
  count: number;
  names: string[];
}

export interface AvailabilityRecommendation {
  id: string;
  startIso: string;
  endIso: string;
  slotKeys: string[];
  availableCount: number;
  totalMembers: number;
  availableNames: string[];
  missingNames: string[];
}

const SLOT_DURATION_MINUTES = 30;
export const START_HOUR = 0;
export const END_HOUR = 24;
export const RAID_HOURS_START = 16;
export const RAID_HOURS_END = 2; // wraps past midnight

export type TimePreset = 'prime' | 'evening' | 'full';
export const TIME_PRESETS: Record<TimePreset, { label: string; start: number; end: number; crossesMidnight: boolean }> = {
  prime: { label: 'Prime raid time', start: 18, end: 2, crossesMidnight: true },
  evening: { label: 'Evening', start: 16, end: 24, crossesMidnight: false },
  full: { label: 'Full day', start: 0, end: 24, crossesMidnight: false },
};

export function filterSlotsByPreset(preset: TimePreset): string[] {
  const { start, end, crossesMidnight } = TIME_PRESETS[preset];
  if (preset === 'full') return TIME_SLOTS;
  const filtered = TIME_SLOTS.filter((slot) => {
    const hour = Number(slot.split(':')[0]);
    if (crossesMidnight) return hour >= start || hour < end;
    return hour >= start && hour < end;
  });
  if (crossesMidnight) {
    const eveningSlots = filtered.filter((s) => Number(s.split(':')[0]) >= start);
    const lateNightSlots = filtered.filter((s) => Number(s.split(':')[0]) < start);
    return [...eveningSlots, ...lateNightSlots];
  }
  return filtered;
}

export function isSlotInPreset(slot: string, preset: TimePreset): boolean {
  if (preset === 'full') return true;
  const { start, end, crossesMidnight } = TIME_PRESETS[preset];
  const hour = Number(slot.split(':')[0]);
  if (crossesMidnight) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

function resolveMemberName(member: Membership): string {
  return member.user?.displayName || member.user?.discordUsername || 'Unknown';
}

function buildTrackedMemberIndex(members: Membership[]) {
  const trackedMembers = members.filter((member) => member.role !== 'viewer');
  const trackedNamesById = new Map<string, string>();
  for (const member of trackedMembers) {
    trackedNamesById.set(member.userId, resolveMemberName(member));
  }
  return { trackedMembers, trackedNamesById };
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const hh = String(hour % 24).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots;
}

export const TIME_SLOTS = generateTimeSlots();

export function formatTimeLabel(slot: string): string {
  const [hourText, minuteText] = slot.split(':');
  const hour = Number(hourText);
  const amPm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minuteText} ${amPm}`;
}

export function getNextNDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let index = 0; index < count; index++) {
    const value = new Date(today);
    value.setDate(today.getDate() + index);
    dates.push(
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    );
  }
  return dates;
}

export function formatDateHeader(dateString: string): { day: string; date: string } {
  const value = new Date(`${dateString}T12:00:00`);
  return {
    day: value.toLocaleDateString('en-US', { weekday: 'short' }),
    date: value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

export function formatHoveredSlotLabel(slotKey: string): string {
  const [date, time] = slotKey.split('|');
  const { day, date: dateLabel } = formatDateHeader(date);
  return `${day}, ${dateLabel} at ${formatTimeLabel(time)}`;
}

export function localSlotToUtc(localDate: string, localTime: string): { utcDate: string; utcTime: string } {
  const value = new Date(`${localDate}T${localTime}:00`);
  return {
    utcDate: value.toISOString().slice(0, 10),
    utcTime: value.toISOString().slice(11, 16),
  };
}

export function utcSlotToLocal(utcDate: string, utcTime: string): { localDate: string; localTime: string } {
  const value = new Date(`${utcDate}T${utcTime}:00Z`);
  return {
    localDate: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    localTime: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

export function buildHeatMap(data: AvailabilityDateSummary[]): Map<string, HeatMapEntry> {
  const map = new Map<string, HeatMapEntry>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      for (const utcTime of response.slots) {
        const { localDate, localTime } = utcSlotToLocal(dateSummary.date, utcTime);
        const key = `${localDate}|${localTime}`;
        const existing = map.get(key) ?? { count: 0, names: [] };
        existing.count += 1;
        if (response.username) {
          existing.names.push(response.username);
        }
        map.set(key, existing);
      }
    }
  }
  return map;
}

export function buildUserSlotSet(data: AvailabilityDateSummary[], userId: string): Set<string> {
  const set = new Set<string>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      if (response.userId !== userId) {
        continue;
      }
      for (const utcTime of response.slots) {
        const { localDate, localTime } = utcSlotToLocal(dateSummary.date, utcTime);
        set.add(`${localDate}|${localTime}`);
      }
    }
  }
  return set;
}

export function getUtcDateRange(localDates: string[]): { startDate: string; endDate: string } {
  const first = new Date(`${localDates[0]}T00:00:00`);
  const last = new Date(`${localDates[localDates.length - 1]}T23:59:59`);

  first.setDate(first.getDate() - 1);
  last.setDate(last.getDate() + 1);

  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}

export function localSlotsToUtcMap(slots: Set<string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const slot of slots) {
    const [localDate, localTime] = slot.split('|');
    const { utcDate, utcTime } = localSlotToUtc(localDate, localTime);
    if (!map.has(utcDate)) {
      map.set(utcDate, []);
    }
    map.get(utcDate)!.push(utcTime);
  }
  return map;
}

export function getScheduleReferenceTimezone(
  sessions: ScheduleSession[],
  fallbackTimezone: string
): string {
  if (sessions.length === 0) {
    return fallbackTimezone;
  }

  const counts = new Map<string, number>();
  for (const session of sessions) {
    counts.set(session.timezone, (counts.get(session.timezone) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? fallbackTimezone;
}

export function computeAvailabilityRecommendations(
  data: AvailabilityDateSummary[],
  members: Membership[],
  dates: string[],
  durationMinutes: number,
  now: Date = new Date()
): AvailabilityRecommendation[] {
  const slotsPerBlock = Math.max(1, Math.round(durationMinutes / SLOT_DURATION_MINUTES));
  const { trackedMembers, trackedNamesById } = buildTrackedMemberIndex(members);

  const memberSlots = new Map<string, Set<string>>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      if (trackedNamesById.size > 0 && !trackedNamesById.has(response.userId)) {
        continue;
      }

      let slotSet = memberSlots.get(response.userId);
      if (!slotSet) {
        slotSet = new Set<string>();
        memberSlots.set(response.userId, slotSet);
      }

      for (const utcTime of response.slots) {
        const { localDate, localTime } = utcSlotToLocal(dateSummary.date, utcTime);
        slotSet.add(`${localDate}|${localTime}`);
      }
    }
  }

  if (trackedNamesById.size === 0) {
    for (const dateSummary of data) {
      for (const response of dateSummary.responses) {
        trackedNamesById.set(response.userId, response.username || 'Unknown');
      }
    }
  }

  const trackedIds = trackedMembers.length > 0
    ? trackedMembers.map((member) => member.userId)
    : [...trackedNamesById.keys()];
  const totalMembers = trackedIds.length;

  const recommendations: AvailabilityRecommendation[] = [];
  for (const date of dates) {
    for (let index = 0; index <= TIME_SLOTS.length - slotsPerBlock; index++) {
      const startTime = TIME_SLOTS[index];
      const startInstant = new Date(`${date}T${startTime}:00`);
      if (Number.isNaN(startInstant.getTime()) || startInstant < now) {
        continue;
      }

      const slotKeys = TIME_SLOTS.slice(index, index + slotsPerBlock).map((slot) => `${date}|${slot}`);
      const availableIds = trackedIds.filter((userId) => {
        const set = memberSlots.get(userId);
        return set ? slotKeys.every((slotKey) => set.has(slotKey)) : false;
      });

      if (availableIds.length === 0) {
        continue;
      }

      const durationMs = durationMinutes * 60 * 1000;
      const endInstant = new Date(startInstant.getTime() + durationMs);
      const availableNames = availableIds.map((userId) => trackedNamesById.get(userId) || 'Unknown');
      const missingNames = trackedIds
        .filter((userId) => !availableIds.includes(userId))
        .map((userId) => trackedNamesById.get(userId) || 'Unknown');

      recommendations.push({
        id: `${date}|${startTime}|${durationMinutes}`,
        startIso: startInstant.toISOString(),
        endIso: endInstant.toISOString(),
        slotKeys,
        availableCount: availableIds.length,
        totalMembers: totalMembers || availableIds.length,
        availableNames,
        missingNames,
      });
    }
  }

  return recommendations
    .sort((left, right) => {
      if (right.availableCount !== left.availableCount) {
        return right.availableCount - left.availableCount;
      }
      return left.startIso.localeCompare(right.startIso);
    })
    .slice(0, 3);
}



// ==================== Recurring Template Helpers ====================

export const DAYS_OF_WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

export function buildTemplateHeatMap(
  templateData: AvailabilityTemplateDaySummary[]
): Map<string, HeatMapEntry> {
  const map = new Map<string, HeatMapEntry>();
  for (const daySummary of templateData) {
    for (const response of daySummary.responses) {
      for (const time of response.slots) {
        const key = `${daySummary.dayOfWeek}|${time}`;
        const existing = map.get(key) ?? { count: 0, names: [] };
        existing.count += 1;
        if (response.username) existing.names.push(response.username);
        map.set(key, existing);
      }
    }
  }
  return map;
}

export function buildTemplateUserSlotSet(
  templateData: AvailabilityTemplateDaySummary[],
  userId: string
): Set<string> {
  const set = new Set<string>();
  for (const daySummary of templateData) {
    for (const response of daySummary.responses) {
      if (response.userId !== userId) continue;
      for (const time of response.slots) {
        set.add(`${daySummary.dayOfWeek}|${time}`);
      }
    }
  }
  return set;
}

export interface TemplateRecommendation {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotKeys: string[];
  availableCount: number;
  totalMembers: number;
  availableNames: string[];
  missingNames: string[];
}

export function computeTemplateRecommendations(
  templateData: AvailabilityTemplateDaySummary[],
  members: Membership[],
  durationMinutes: number
): TemplateRecommendation[] {
  const slotsPerBlock = Math.max(1, Math.round(durationMinutes / SLOT_DURATION_MINUTES));
  const { trackedMembers, trackedNamesById } = buildTrackedMemberIndex(members);

  // Build per-member slot sets keyed by "DAY|HH:MM"
  const memberSlots = new Map<string, Set<string>>();
  for (const daySummary of templateData) {
    for (const response of daySummary.responses) {
      if (trackedNamesById.size > 0 && !trackedNamesById.has(response.userId)) continue;
      let slotSet = memberSlots.get(response.userId);
      if (!slotSet) {
        slotSet = new Set<string>();
        memberSlots.set(response.userId, slotSet);
      }
      for (const time of response.slots) {
        slotSet.add(`${daySummary.dayOfWeek}|${time}`);
      }
    }
  }

  if (trackedNamesById.size === 0) {
    for (const daySummary of templateData) {
      for (const response of daySummary.responses) {
        trackedNamesById.set(response.userId, response.username || 'Unknown');
      }
    }
  }

  const trackedIds = trackedMembers.length > 0
    ? trackedMembers.map((m) => m.userId)
    : [...trackedNamesById.keys()];
  const totalMembers = trackedIds.length;

  const recommendations: TemplateRecommendation[] = [];

  for (const day of DAYS_OF_WEEK) {
    for (let index = 0; index <= TIME_SLOTS.length - slotsPerBlock; index++) {
      const slotKeys = TIME_SLOTS.slice(index, index + slotsPerBlock).map(
        (slot) => `${day}|${slot}`
      );
      const availableIds = trackedIds.filter((userId) => {
        const set = memberSlots.get(userId);
        return set ? slotKeys.every((key) => set.has(key)) : false;
      });
      if (availableIds.length === 0) continue;

      const availableNames = availableIds
        .map((id) => trackedNamesById.get(id) ?? 'Unknown')
        .sort();
      const missingNames = trackedIds
        .filter((id) => !availableIds.includes(id))
        .map((id) => trackedNamesById.get(id) ?? 'Unknown')
        .sort();

      recommendations.push({
        id: `${day}|${TIME_SLOTS[index]}|${durationMinutes}`,
        dayOfWeek: day,
        startTime: TIME_SLOTS[index],
        endTime: TIME_SLOTS[Math.min(index + slotsPerBlock, TIME_SLOTS.length - 1)],
        slotKeys,
        availableCount: availableIds.length,
        totalMembers,
        availableNames,
        missingNames,
      });
    }
  }

  return recommendations
    .sort((a, b) => {
      if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
      return DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek)
        || a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 3);
}
