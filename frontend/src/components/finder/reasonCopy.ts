/**
 * reasonCopy — pure copy builders for the Static Finder's reason rows and
 * the "Your time:" line (R-SF-P). No English lives on the backend; every
 * string here is derived from a `FitReason`'s `kind`/`status`/`params` and,
 * for schedule, the fit's own `FitNight[]`.
 *
 * Every exported text function takes a trailing `subject: 'you' | 'they'`
 * (default `'you'`, R-RH-K) so the Applicants tab (RH1c) can render the same
 * copy in the third person for a lead reading an applicant's fit. The
 * substitution is table-driven (`your`→`their`, `you're`→`they're`,
 * `yours`→`theirs`, `Your`→`Their`) rather than a string replace, so the
 * `'you'` strings stay byte-identical to before this file gained a subject.
 */
import { formatTimeLabel } from '../schedule/availabilityUtils';
import { ROLE_FIT_LABELS, type FitNight, type FitReason, type RoleKey } from './types';

export type ReasonSubject = 'you' | 'they';

const SUBJECT_WORDS: Record<ReasonSubject, { your: string; youre: string; yours: string; Your: string }> = {
  you: { your: 'your', youre: "you're", yours: 'yours', Your: 'Your' },
  they: { your: 'their', youre: "they're", yours: 'theirs', Your: 'Their' },
};

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
export function roleReasonText(reason: FitReason, subject: ReasonSubject = 'you'): string {
  const p = reason.params as unknown as RoleReasonParams;
  const role = roleLabel(p.matchedRole);
  const { your } = SUBJECT_WORDS[subject];

  if (reason.status === 'conflict') {
    return p.asRole ? `Not recruiting a ${role}` : `Not recruiting ${your} role`;
  }
  if (reason.status === 'match') {
    return p.asRole ? `Needs a ${role}` : `Needs a ${role} — ${your} ${p.matchedJob} (main)`;
  }
  // partial
  if (p.priority === 'nice_to_have') {
    return p.asRole ? `Would like a ${role}` : `Would like a ${role} — ${your} ${p.matchedJob}`;
  }
  return `Needs a ${role} — ${your} ${p.matchedJob} (alt)`;
}

function coverageWord(coverage: FitNight['coverage']): string {
  return coverage === 'full' ? 'free' : coverage === 'part' ? 'partly free' : 'busy';
}

function dayBasisSuffix(status: 'match' | 'partial' | 'conflict', subject: ReasonSubject): string {
  const { your, youre } = SUBJECT_WORDS[subject];
  if (status === 'match') return `, ${youre} free those days`;
  if (status === 'partial') return `, ${youre} free some of those days`;
  return `, not on ${your} free days`;
}

/** R-SF-P "Schedule reason" (time basis and day basis). */
export function scheduleReasonText(reason: FitReason, nights: FitNight[], subject: ReasonSubject = 'you'): string {
  const basis = (reason.params as { basis?: string }).basis;
  if (basis === 'day') {
    const days = nights.map(n => dayShort(n.day)).join('/');
    const suffix = dayBasisSuffix(reason.status, subject);
    return `Raids ${days} — no time listed${suffix}`;
  }
  // The time basis's contract says localStart/localEnd are never null here —
  // but if that's ever wrong, skip the night's time text rather than invent
  // "12:00 AM" (whole-branch review item 9).
  return nights
    .filter(n => n.localStart != null && n.localEnd != null)
    .map(n => `${dayShort(n.localDay ?? n.day)} ${formatTimeLabel(n.localStart!)}–${formatTimeLabel(n.localEnd!)} ${coverageWord(n.coverage)}`)
    .join(' · ');
}

/** R-SF-P "Goals": match `{n} goal{s} in common`; partial/conflict are fixed strings. */
export function goalsReasonText(reason: FitReason, subject: ReasonSubject = 'you'): string {
  if (reason.status === 'match') {
    const n = (reason.params as { aligned?: number }).aligned ?? 0;
    return `${n} goal${n === 1 ? '' : 's'} in common`;
  }
  if (reason.status === 'partial') return 'Goals partly overlap';
  return `Goals conflict with ${SUBJECT_WORDS[subject].yours}`;
}

/** R-SF-P "Comms". */
export function commsReasonText(reason: FitReason): string {
  if (reason.status === 'match') return 'Comms match';
  if (reason.status === 'partial') return 'Comms partly match';
  return 'Needs voice chat';
}

/** R-SF-P "BiS" (backend never emits a bis reason with status "conflict"). */
export function bisReasonText(reason: FitReason, subject: ReasonSubject = 'you'): string {
  const { Your } = SUBJECT_WORDS[subject];
  return reason.status === 'match' ? `${Your} BiS is ready to share` : `${Your} BiS is partly set`;
}

/** Dispatches on `kind`; an unrecognized kind returns `null` rather than throwing. */
export function reasonText(reason: FitReason, nights: FitNight[] = [], subject: ReasonSubject = 'you'): string | null {
  switch (reason.kind) {
    case 'role': return roleReasonText(reason, subject);
    case 'schedule': return scheduleReasonText(reason, nights, subject);
    case 'goals': return goalsReasonText(reason, subject);
    case 'comms': return commsReasonText(reason);
    case 'bis': return bisReasonText(reason, subject);
    default: return null;
  }
}

/**
 * R-SF-P "Local times without a typical week" (OWNER-2): when
 * `schedule.status` is `unknown`, backend emits no schedule reason row, so
 * the card reads this line straight off the nights instead.
 */
export function unknownScheduleTimeText(nights: FitNight[], subject: ReasonSubject = 'you'): string | null {
  const qualifying = nights.filter(n => n.localStart != null && n.localEnd != null);
  if (qualifying.length === 0) return null;
  const parts = qualifying.map(
    n => `${dayShort(n.localDay ?? n.day)} ${formatTimeLabel(n.localStart!)}–${formatTimeLabel(n.localEnd!)}`,
  );
  return `${SUBJECT_WORDS[subject].Your} time: ${parts.join(' · ')}`;
}
