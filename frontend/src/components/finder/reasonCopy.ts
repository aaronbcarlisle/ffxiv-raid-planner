/**
 * reasonCopy — pure copy builders for the Static Finder's reason rows and
 * the "Your time:" line (R-SF-P). No English lives on the backend; every
 * string here is derived from a `FitReason`'s `kind`/`status`/`params` and,
 * for schedule, the fit's own `FitNight[]`.
 */
import { formatTimeLabel } from '../schedule/availabilityUtils';
import { ROLE_FIT_LABELS, type FitNight, type FitReason, type RoleKey } from './types';

const DAY_SHORT: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};

function dayShort(code: string): string {
  return DAY_SHORT[code] ?? code;
}

function roleLabel(role: string | null): string {
  return role ? (ROLE_FIT_LABELS[role as RoleKey] ?? role) : 'role';
}

interface RoleReasonParams {
  matchedJob: string | null;
  matchedRole: string | null;
  priority: 'needed' | 'nice_to_have' | null;
  isMain: boolean;
  asRole: string | null;
}

/** R-SF-P "Role reasons" table (5 rows, 3 with an `asRole` alternate). */
export function roleReasonText(reason: FitReason): string {
  const p = reason.params as unknown as RoleReasonParams;
  const role = roleLabel(p.matchedRole);

  if (reason.status === 'conflict') {
    return p.asRole ? `Not recruiting a ${role}` : 'Not recruiting your role';
  }
  if (reason.status === 'match') {
    return p.asRole ? `Needs a ${role}` : `Needs a ${role} — your ${p.matchedJob} (main)`;
  }
  // partial
  if (p.priority === 'nice_to_have') {
    return p.asRole ? `Would like a ${role}` : `Would like a ${role} — your ${p.matchedJob}`;
  }
  return `Needs a ${role} — your ${p.matchedJob} (alt)`;
}

function coverageWord(coverage: FitNight['coverage']): string {
  return coverage === 'full' ? 'free' : coverage === 'part' ? 'partly free' : 'busy';
}

const DAY_BASIS_SUFFIX: Record<'match' | 'partial' | 'conflict', string> = {
  match: ", you're free those days",
  partial: ", you're free some of those days",
  conflict: ', not on your free days',
};

/** R-SF-P "Schedule reason" (time basis and day basis). */
export function scheduleReasonText(reason: FitReason, nights: FitNight[]): string {
  const basis = (reason.params as { basis?: string }).basis;
  if (basis === 'day') {
    const days = nights.map(n => dayShort(n.day)).join('/');
    const suffix = DAY_BASIS_SUFFIX[reason.status];
    return `Raids ${days} — no time listed${suffix}`;
  }
  return nights
    .map(n => `${dayShort(n.localDay ?? n.day)} ${formatTimeLabel(n.localStart ?? '00:00')}–${formatTimeLabel(n.localEnd ?? '00:00')} ${coverageWord(n.coverage)}`)
    .join(' · ');
}

/** R-SF-P "Goals": match `{n} goal{s} in common`; partial/conflict are fixed strings. */
export function goalsReasonText(reason: FitReason): string {
  if (reason.status === 'match') {
    const n = (reason.params as { aligned?: number }).aligned ?? 0;
    return `${n} goal${n === 1 ? '' : 's'} in common`;
  }
  if (reason.status === 'partial') return 'Goals partly overlap';
  return 'Goals conflict with yours';
}

/** R-SF-P "Comms". */
export function commsReasonText(reason: FitReason): string {
  if (reason.status === 'match') return 'Comms match';
  if (reason.status === 'partial') return 'Comms partly match';
  return 'Needs voice chat';
}

/** R-SF-P "BiS" (backend never emits a bis reason with status "conflict"). */
export function bisReasonText(reason: FitReason): string {
  return reason.status === 'match' ? 'Your BiS is ready to share' : 'Your BiS is partly set';
}

/** Dispatches on `kind`; an unrecognized kind returns `null` rather than throwing. */
export function reasonText(reason: FitReason, nights: FitNight[] = []): string | null {
  switch (reason.kind) {
    case 'role': return roleReasonText(reason);
    case 'schedule': return scheduleReasonText(reason, nights);
    case 'goals': return goalsReasonText(reason);
    case 'comms': return commsReasonText(reason);
    case 'bis': return bisReasonText(reason);
    default: return null;
  }
}

/**
 * R-SF-P "Local times without a typical week" (OWNER-2): when
 * `schedule.status` is `unknown`, backend emits no schedule reason row, so
 * the card reads this line straight off the nights instead.
 */
export function unknownScheduleTimeText(nights: FitNight[]): string | null {
  const qualifying = nights.filter(n => n.localStart != null && n.localEnd != null);
  if (qualifying.length === 0) return null;
  const parts = qualifying.map(
    n => `${dayShort(n.localDay ?? n.day)} ${formatTimeLabel(n.localStart!)}–${formatTimeLabel(n.localEnd!)}`,
  );
  return `Your time: ${parts.join(' · ')}`;
}
