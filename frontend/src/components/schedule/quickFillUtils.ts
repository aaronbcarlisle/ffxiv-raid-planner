import type { PersonalAvailabilityDay } from '../../stores/personalAvailabilityStore';

interface AvailabilityResponseLike {
  userId: string;
  slots: string[];
}

interface AvailabilityDateSummaryLike {
  date: string;
  responses: AvailabilityResponseLike[];
}

interface TemplateDaySummaryLike {
  dayOfWeek: string;
  responses: AvailabilityResponseLike[];
}

interface QuickFillPlan {
  filledDates: { date: string; slots: string[] }[];
  skippedDates: string[];
  missingSourceDates: string[];
}

/** Map a date string (YYYY-MM-DD) to iCal BYDAY key */
export function dateToDayOfWeek(dateStr: string): string {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay(); // 0=Sun
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return BYDAY[day];
}

/** Find existing This Week dates that already have user data */
export function getExistingDates(data: AvailabilityDateSummaryLike[], userId: string): Set<string> {
  const existing = new Set<string>();
  for (const dateSummary of data) {
    for (const response of dateSummary.responses) {
      if (response.userId === userId && response.slots.length > 0) {
        existing.add(dateSummary.date);
      }
    }
  }
  return existing;
}

export function buildQuickFillPlan(
  dates: string[],
  existingDates: Set<string>,
  sourceByDay: Map<string, string[]>
): QuickFillPlan {
  const plan: QuickFillPlan = { filledDates: [], skippedDates: [], missingSourceDates: [] };
  for (const date of dates) {
    if (existingDates.has(date)) {
      plan.skippedDates.push(date);
      continue;
    }

    const slots = sourceByDay.get(dateToDayOfWeek(date));
    if (slots && slots.length > 0) {
      plan.filledDates.push({ date, slots });
    } else {
      plan.missingSourceDates.push(date);
    }
  }
  return plan;
}

export function buildPersonalSourceByDay(days: PersonalAvailabilityDay[]): Map<string, string[]> {
  const sourceByDay = new Map<string, string[]>();
  for (const day of days) {
    if (day.slots.length > 0) {
      sourceByDay.set(day.dayOfWeek, day.slots);
    }
  }
  return sourceByDay;
}

export function buildStaticTemplateSourceByDay(templateData: TemplateDaySummaryLike[], userId: string): Map<string, string[]> {
  const sourceByDay = new Map<string, string[]>();
  for (const daySummary of templateData) {
    const userTemplate = daySummary.responses.find((response) => response.userId === userId);
    if (userTemplate && userTemplate.slots.length > 0) {
      sourceByDay.set(daySummary.dayOfWeek, userTemplate.slots);
    }
  }
  return sourceByDay;
}

export function getExistingTemplateDays(templateData: TemplateDaySummaryLike[], userId: string): Set<string> {
  const existing = new Set<string>();
  for (const daySummary of templateData) {
    const userTemplate = daySummary.responses.find((response) => response.userId === userId);
    if (userTemplate && userTemplate.slots.length > 0) {
      existing.add(daySummary.dayOfWeek);
    }
  }
  return existing;
}
