/**
 * SessionList — the scoped week's session cards (F6e spec, Task 5).
 *
 * Renders one SessionRsvpCard (variant "later", member-grid detail) per
 * occurrence in the scoped week, plus the kebab actions menu (Edit / Share /
 * Copy for Discord / Manage occurrences / Delete). The first upcoming
 * occurrence in the CURRENT week is promoted to variant "next". Share and
 * Copy-for-Discord are fresh, small handlers living here — the legacy
 * versions are inlined in `SessionCard.tsx` and can't be imported directly,
 * so the 3 tiny formatting helpers below are a deliberate fresh-audited copy
 * of `SessionCard.tsx:31-64` (not a re-export).
 */
import { CalendarPlus, MoreVertical } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from '../primitives/Dropdown';
import { EmptyStateInvite, SessionRsvpCard } from '../ui';
import { toast } from '../../stores/toastStore';
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

/**
 * Index of the first occurrence with `occursAt >= now`, when scoped to the
 * current week; -1 otherwise (every card renders as "later"). A plain helper
 * (rather than an inline `Date.now()` call in the component body) keeps the
 * render function itself pure per the react-hooks/purity rule.
 */
function findNextIndex(occurrences: SessionOccurrence[], isCurrentWeek: boolean): number {
  if (!isCurrentWeek) return -1;
  const nowMs = Date.now();
  return occurrences.findIndex((o) => new Date(o.occursAt).getTime() >= nowMs);
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
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success('Copied session details');
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
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied Discord message');
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

  const nextIndex = findNextIndex(occurrences, isCurrentWeek);

  return (
    <div className="grid gap-3.5">
      {occurrences.map((occ, index) => {
        const { session, occursAt } = occ;
        const displaySession = buildDisplaySession(occ);
        const variant = index === nextIndex ? 'next' : 'later';
        const highlighted = highlightedSessionId === session.id;
        const currentUserRsvp = currentUserId
          ? session.rsvps.find((r) => r.userId === currentUserId)?.status
          : undefined;

        return (
          <div
            key={`${session.id}-${occursAt}`}
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
              onRsvp={canRsvp ? (status) => onRsvp(session.id, status) : undefined}
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
