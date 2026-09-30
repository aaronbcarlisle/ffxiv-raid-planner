/**
 * SessionList — the scoped week's session cards (F6e spec, Task 5).
 *
 * Renders one SessionRsvpCard (variant "later", member-grid detail) per
 * session in the scoped week, plus the kebab actions menu (Edit / Share /
 * Copy for Discord / Manage occurrences / Delete). The first card in the
 * CURRENT week that hasn't ended is promoted to variant "next". Share and
 * Copy-for-Discord are fresh, small handlers living here — the legacy
 * versions are inlined in `SessionCard.tsx` and can't be imported directly,
 * so the 3 tiny formatting helpers below are a deliberate fresh-audited copy
 * of `SessionCard.tsx:31-64` (not a re-export).
 *
 * R-P0-12 (RSVP-0): an RSVP is stored per SERIES, not per occurrence, so a
 * recurring series collapses to ONE card per week, carrying a scope note
 * ("Every Tue/Fri · next Fri Oct 2 · RSVP applies to every week"). Only the
 * card showing the series' next (or in-progress) occurrence takes an RSVP.
 * The caller's occurrence expansion is untouched (the heatmap still gets
 * every occurrence); only this list collapses.
 */
import { CalendarPlus, MoreVertical } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from '../primitives/Dropdown';
import { EmptyStateInvite, SessionRsvpCard } from '../ui';
import { formatShortDate } from '../ui/formatShortDate';
import { toast } from '../../stores/toastStore';
import { computeNextOccurrence, parseRRule } from '../../utils/recurrence';
import type { SessionOccurrence } from './scheduleWeek';
import type { ScheduleSession, RsvpStatus } from '../../types';

export interface SessionListProps {
  occurrences: SessionOccurrence[];          // already scoped + sorted (Task 1)
  isCurrentWeek: boolean;                    // clock.isCurrent(scopedWeek)
  members: Array<{ userId: string; username: string | null }>;
  currentUserId: string | null;
  canManage: boolean;
  canRsvp: boolean;
  shareCode: string;
  staticName: string;
  viewerTimezone?: string;
  highlightedSessionId: string | null;
  nextSessionHint?: { week: number; occursAt: string } | null; // empty-week hint
  onJumpToWeek: (week: number) => void;
  onRsvp: (sessionId: string, status: RsvpStatus) => void;
  onEdit: (session: ScheduleSession) => void;
  onDelete: (occ: SessionOccurrence) => void;               // Task 8 branches recurring/plain
  onManageOccurrences: (session: ScheduleSession) => void;
  onAddSession: () => void;
  /** Cancelled occurrence date keys per recurring session (the scoped expansion's own). */
  cancelledBySession: ReadonlyMap<string, ReadonlySet<string>>;
}

// ── Fresh-audited copies of SessionCard.tsx:31-64 (unexported legacy helpers) ──

function formatInTimezone(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  }).format(new Date(isoString));
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * `SessionRsvpCard` derives day/time from `session.startTime`. For a
 * recurring occurrence where `occursAt` differs from the base start, build a
 * display-only session with the occurrence's instant substituted in (duration
 * preserved). Callbacks always receive the REAL session — this is a display
 * substitution only.
 */
function buildDisplaySession(occ: SessionOccurrence): ScheduleSession {
  const { session, occursAt } = occ;
  if (occursAt === session.startTime) return session;
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const newEnd = new Date(new Date(occursAt).getTime() + (endMs - startMs)).toISOString();
  return { ...session, startTime: occursAt, endTime: newEnd };
}

/** One rendered card: the occurrence it shows, plus the series-only extras. */
interface SessionCardEntry {
  occ: SessionOccurrence;
  /** Recurring series only (R-P0-12): what an RSVP on this card covers. */
  scopeNote?: string;
  /** False for a series card that isn't showing the series' next / in-progress occurrence. */
  takesRsvp: boolean;
}

const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSeries(session: ScheduleSession): session is ScheduleSession & { recurrenceRule: string } {
  return session.isRecurring && !!session.recurrenceRule;
}

function sessionDurationMs(session: ScheduleSession): number {
  const ms = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** An occurrence's end instant (the base session's duration, as `buildDisplaySession`). */
function occurrenceEndMs(occ: SessionOccurrence): number {
  return new Date(occ.occursAt).getTime() + sessionDurationMs(occ.session);
}

/** The session's own weekday in its zone — a WEEKLY rule with no BYDAY recurs on it. */
function weekdayInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date(iso));
  } catch {
    return WEEKDAY_LABEL[new Date(iso).getUTCDay()];
  }
}

/**
 * "Every Tue/Fri · next Fri Oct 2 · RSVP applies to every week". The days come
 * from BYDAY in rule order, joined with "/" like `deriveRecurringSummary`;
 * "next" is the series' next start after now, and is dropped when there is none.
 */
function buildScopeNote(
  session: ScheduleSession & { recurrenceRule: string },
  nowMs: number,
  cancelled: ReadonlySet<string> | undefined,
  viewerTimezone: string | undefined,
): string {
  const rule = parseRRule(session.recurrenceRule);
  const days = rule && rule.byday.length > 0
    ? rule.byday.map((d) => WEEKDAY_LABEL[d]).join('/')
    : weekdayInZone(session.startTime, session.timezone);
  const next = computeNextOccurrence(
    session.startTime, session.recurrenceRule, new Date(nowMs), cancelled, session.timezone,
  );
  const nextLabel = next ? formatShortDate(next, viewerTimezone) : null;
  return [`Every ${days}`, nextLabel && `next ${nextLabel}`, 'RSVP applies to every week']
    .filter(Boolean)
    .join(' · ');
}

/**
 * Collapse the scoped occurrences to one card per session (R-P0-12).
 *  - A card shows the session's first occurrence in the week that hasn't
 *    ended; if every one has, the week's last (so the card reads Played).
 *  - A series card takes an RSVP only when it shows the series' live
 *    occurrence: the first whose end is after now, found as the next start
 *    after `now - duration` (so an in-progress one counts).
 *  - `nextIndex` is the first card in the CURRENT week that hasn't ended
 *    (promoted to variant "next"); -1 otherwise.
 * A plain helper (rather than an inline `Date.now()` call in the component
 * body) keeps the render function itself pure per the react-hooks/purity rule.
 */
function buildCardEntries(
  occurrences: SessionOccurrence[],
  isCurrentWeek: boolean,
  cancelledBySession: ReadonlyMap<string, ReadonlySet<string>>,
  viewerTimezone: string | undefined,
): { entries: SessionCardEntry[]; nextIndex: number } {
  const nowMs = Date.now();
  const bySession = new Map<string, SessionOccurrence[]>();
  for (const occ of occurrences) {
    const list = bySession.get(occ.session.id);
    if (list) list.push(occ);
    else bySession.set(occ.session.id, [occ]);
  }

  const entries: SessionCardEntry[] = [];
  for (const occs of bySession.values()) {
    const shown = occs.find((o) => occurrenceEndMs(o) > nowMs) ?? occs[occs.length - 1];
    const { session } = shown;
    if (!isSeries(session)) {
      entries.push({ occ: shown, takesRsvp: true });
      continue;
    }
    const cancelled = cancelledBySession.get(session.id);
    const live = computeNextOccurrence(
      session.startTime, session.recurrenceRule, new Date(nowMs - sessionDurationMs(session)),
      cancelled, session.timezone,
    );
    entries.push({
      occ: shown,
      scopeNote: buildScopeNote(session, nowMs, cancelled, viewerTimezone),
      takesRsvp: live !== null && live.getTime() === new Date(shown.occursAt).getTime(),
    });
  }
  entries.sort((a, b) => a.occ.occursAt.localeCompare(b.occ.occursAt));

  const nextIndex = isCurrentWeek ? entries.findIndex((e) => occurrenceEndMs(e.occ) > nowMs) : -1;
  return { entries, nextIndex };
}

export function SessionList({
  occurrences,
  isCurrentWeek,
  members,
  currentUserId,
  canManage,
  canRsvp,
  shareCode,
  staticName,
  viewerTimezone,
  highlightedSessionId,
  nextSessionHint,
  onJumpToWeek,
  onRsvp,
  onEdit,
  onDelete,
  onManageOccurrences,
  onAddSession,
  cancelledBySession,
}: SessionListProps) {
  async function handleShare(occ: SessionOccurrence) {
    const { session, occursAt } = occ;
    const duration = getDurationMinutes(session.startTime, session.endTime);
    const lines = [session.title, `${formatInTimezone(occursAt, session.timezone)} (${formatDuration(duration)})`];
    if (session.trackAvailability !== false) {
      const available = session.rsvps.filter((r) => r.status === 'available').length;
      const tentative = session.rsvps.filter((r) => r.status === 'tentative').length;
      if (available > 0 || tentative > 0) {
        lines.push(`RSVP: ${available} available, ${tentative} tentative`);
      }
    } else {
      lines.push('Availability not required');
    }
    lines.push(`${window.location.origin}/group/${shareCode}?tab=schedule&sessionId=${session.id}`);
    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: session.title, text });
        return;
      } catch {
        // Share-sheet rejection (incl. user cancel) is NOT an error — legacy
        // parity treats it as a no-op and falls through to the clipboard.
      }
    }
    // F6d copyLink pattern (Loot.tsx:244-247): a rejected clipboard write must
    // surface an error toast — never a silent "success" or an unhandled rejection.
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied session details');
    } catch {
      toast.error('Failed to copy');
    }
  }

  async function handleCopyDiscord(occ: SessionOccurrence) {
    const { session, occursAt } = occ;
    const duration = getDurationMinutes(session.startTime, session.endTime);
    const lines: string[] = [`**${session.title}**`];
    if (session.contentName) lines.push(`> ${session.contentName}`);
    lines.push(`\u{1f4c5} ${formatInTimezone(occursAt, session.timezone)} (${formatDuration(duration)})`);
    if (session.isRecurring) lines.push('\u{1f501} Recurring weekly');
    lines.push(`\u{1f465} ${staticName}`);
    if (session.description) lines.push(`> ${session.description}`);

    if (session.trackAvailability !== false) {
      const available = session.rsvps.filter((r) => r.status === 'available').length;
      const tentative = session.rsvps.filter((r) => r.status === 'tentative').length;
      const unavailable = session.rsvps.filter((r) => r.status === 'unavailable').length;
      const parts: string[] = [];
      if (available > 0) parts.push(`\u{2705} ${available}`);
      if (tentative > 0) parts.push(`\u{2753} ${tentative}`);
      if (unavailable > 0) parts.push(`\u{274c} ${unavailable}`);
      if (parts.length > 0) lines.push(parts.join(' \u{2502} '));
    } else {
      lines.push('Availability not required');
    }

    lines.push(`${window.location.origin}/group/${shareCode}?tab=schedule&sessionId=${session.id}`);
    // Same F6d copyLink pattern as handleShare — no silent copy failures.
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Copied Discord message');
    } catch {
      toast.error('Failed to copy Discord message');
    }
  }

  if (occurrences.length === 0) {
    return (
      <div className="grid gap-3.5">
        <EmptyStateInvite
          icon={<CalendarPlus className="h-5 w-5" />}
          title="No sessions this week"
          description={
            canManage
              ? 'Add a session so the team can RSVP.'
              : 'Sessions your leads schedule for this week appear here to RSVP.'
          }
          action={canManage ? { label: 'Add session', onClick: onAddSession } : undefined}
        />
        {nextSessionHint && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => onJumpToWeek(nextSessionHint.week)}>
              Next session: {new Date(nextSessionHint.occursAt).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })} — Week {nextSessionHint.week}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { entries, nextIndex } = buildCardEntries(occurrences, isCurrentWeek, cancelledBySession, viewerTimezone);

  return (
    <div className="grid gap-3.5">
      {entries.map(({ occ, scopeNote, takesRsvp }, index) => {
        const { session } = occ;
        const displaySession = buildDisplaySession(occ);
        const variant = index === nextIndex ? 'next' : 'later';
        // One card per session, so the `schedule-session-{id}` anchor (deep-link
        // scroll target) and its highlight always land on that card.
        const highlighted = highlightedSessionId === session.id;
        const currentUserRsvp = currentUserId
          ? session.rsvps.find((r) => r.userId === currentUserId)?.status
          : undefined;

        return (
          <div
            key={session.id}
            id={`schedule-session-${session.id}`}
            className={highlighted ? 'highlight-pulse rounded-lg' : undefined}
          >
            <SessionRsvpCard
              session={displaySession}
              variant={variant}
              members={members}
              memberDetail="grid"
              showDayPill
              viewerTimezone={viewerTimezone}
              currentUserRsvp={currentUserRsvp}
              scopeNote={scopeNote}
              onRsvp={canRsvp && takesRsvp ? (status) => onRsvp(session.id, status) : undefined}
              headerActions={
                <Dropdown>
                  <DropdownTrigger asChild>
                    <IconButton
                      aria-label="Session actions"
                      variant="ghost"
                      size="sm"
                      icon={<MoreVertical size={16} />}
                    />
                  </DropdownTrigger>
                  <DropdownContent align="end">
                    {canManage && <DropdownItem onSelect={() => onEdit(session)}>Edit</DropdownItem>}
                    <DropdownItem onSelect={() => handleShare(occ)}>Share</DropdownItem>
                    <DropdownItem onSelect={() => handleCopyDiscord(occ)}>Copy for Discord</DropdownItem>
                    {session.isRecurring && canManage && (
                      <DropdownItem onSelect={() => onManageOccurrences(session)}>
                        Manage occurrences
                      </DropdownItem>
                    )}
                    {canManage && (
                      <>
                        <DropdownSeparator />
                        <DropdownItem danger onSelect={() => onDelete(occ)}>
                          Delete
                        </DropdownItem>
                      </>
                    )}
                  </DropdownContent>
                </Dropdown>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
