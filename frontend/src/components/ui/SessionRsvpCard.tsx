import type { ReactNode } from 'react';
import { CardShell } from './CardShell';
import { PlayerIdentity } from './PlayerIdentity';
import { SafeAvatar } from './SafeAvatar';
import { Tag } from './Tag';
import { Button } from '../primitives/Button';
import type { ScheduleSession, ScheduleRsvp, RsvpStatus } from '../../types';

/**
 * SessionRsvpCard — the next-session glance + inline RSVP action.
 *
 * Shared `ui/` layer (presentational, props-in / callbacks-out, NO store
 * imports). Consumed by Home (ring0, F6b) and Schedule (ring1, F6e); shared
 * placement is mandatory so both rings can import it without crossing a ring
 * edge. Held to the shared-layer error-level design-system rules: token colors
 * only (no hex/rgb), 12px readable floor, jsx-a11y at error.
 *
 * Anatomy (the built 'next' variant):
 *   CardShell ("Next session" + countdown chip)
 *     · day/time line (display font)
 *     · timezone line (session tz → viewer's local time)
 *     · RSVP avatar stack (one per rsvp, ring colored by RSVP status)
 *     · "N in · M tentative" counts
 *     · 3-button RSVP strip (I'm in / Tentative / Can't make it)
 *
 * Avatar-ring coloring decision: `ScheduleRsvp` carries no member ROLE field
 * (`{ id, sessionId, userId, username, status, note, updatedAt }`). Per the
 * task brief, when the rsvp object does not carry a role we color the ring by
 * RSVP **status** (available / tentative / unavailable) via status tokens — we
 * do NOT fabricate a role field. If a role is added to `ScheduleRsvp` later,
 * switch the ring to `var(--color-role-*)` here.
 */

/**
 * Layout variant.
 *  - 'next'  — the prominent next-session card (BUILT, F6b). CardShell titled
 *    "Next session" with the DS-contracted accent ring; inactive RSVP buttons
 *    are `secondary`.
 *  - 'later' — the Schedule (F6e) list card: CardShell titled with the session
 *    title, no accent ring, and ghost inactive RSVP buttons.
 */
type SessionRsvpVariant = 'next' | 'later';

/** A roster member entry used to derive the member grid + "no answer" tally. */
interface RsvpMember {
  userId: string;
  username: string | null;
}

export interface SessionRsvpCardProps {
  /** The session to display. Avatar stack + counts derive from `session.rsvps`. */
  session: ScheduleSession;
  /** The viewer's own RSVP status, if any — drives the pressed RSVP button. */
  currentUserRsvp?: RsvpStatus;
  /** Inline RSVP callback. Optional — the strip renders inert when omitted. */
  onRsvp?: (status: RsvpStatus) => void;
  /** See {@link SessionRsvpVariant}. Default 'next'. */
  variant?: SessionRsvpVariant;
  /**
   * IANA timezone for the "your time" line. Defaults to the runtime's resolved
   * timezone. Falls back gracefully if the value is missing or invalid.
   */
  viewerTimezone?: string;
  /**
   * Full roster. When provided (with `memberDetail="grid"`) it enables the
   * member grid, the "no answer" count segment, and the contextual warning
   * note. Omitted (Home) → the avatar stack renders and counts stay unchanged.
   */
  members?: RsvpMember[];
  /**
   * 'stack' (default, Home) → RSVP avatar stack. 'grid' (Schedule) → one row
   * per member with a status glyph. 'grid' requires `members`.
   */
  memberDetail?: 'stack' | 'grid';
  /** Kebab / action slot rendered beside the countdown Tag in the header row. */
  headerActions?: ReactNode;
  /** Show the day-of-month + weekday pill before the day/time block. Default false. */
  showDayPill?: boolean;
}

/** RSVP status → status-color CSS token (no hex literals — shared-layer rule). */
const STATUS_TOKEN: Record<RsvpStatus, string> = {
  available: 'var(--color-status-success)',
  tentative: 'var(--color-status-warning)',
  unavailable: 'var(--color-status-error)',
};

const MS_PER_DAY = 86_400_000;

/** Derive up to two uppercase initials from a name; '?' when unknown. */
function getInitials(name: string | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Format an ISO time-of-day in a timezone (e.g. "8:00 PM EST"). Robust to bad tz. */
function formatTime(iso: string, tz?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try {
    return new Intl.DateTimeFormat('en-US', tz ? { ...opts, timeZone: tz } : opts).format(date);
  } catch {
    // Invalid timeZone → fall back to the runtime's local zone.
    try {
      return new Intl.DateTimeFormat('en-US', opts).format(date);
    } catch {
      return null;
    }
  }
}

/** Format an ISO date as "Weekday, Mon D" in a timezone. Robust to bad tz. */
function formatDay(iso: string, tz?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  try {
    return new Intl.DateTimeFormat('en-US', tz ? { ...opts, timeZone: tz } : opts).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat('en-US', opts).format(date);
    } catch {
      return null;
    }
  }
}

/**
 * Format an ISO date into the day-pill parts (day-of-month + short weekday) in
 * a timezone. Same tz-robustness as {@link formatDay}: an invalid zone falls
 * back to the runtime's local zone; an unparseable date yields null.
 */
function formatDayPill(iso: string, tz?: string): { day: string; weekday: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const dayOpts: Intl.DateTimeFormatOptions = { day: 'numeric' };
  const weekdayOpts: Intl.DateTimeFormatOptions = { weekday: 'short' };
  try {
    return {
      day: new Intl.DateTimeFormat('en-US', tz ? { ...dayOpts, timeZone: tz } : dayOpts).format(date),
      weekday: new Intl.DateTimeFormat('en-US', tz ? { ...weekdayOpts, timeZone: tz } : weekdayOpts).format(date),
    };
  } catch {
    try {
      return {
        day: new Intl.DateTimeFormat('en-US', dayOpts).format(date),
        weekday: new Intl.DateTimeFormat('en-US', weekdayOpts).format(date),
      };
    } catch {
      return null;
    }
  }
}

/** UTC-midnight epoch of `date`'s calendar day as seen in timezone `tz`. */
function dayEpochInTz(date: Date, tz?: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) throw new Error('bad parts');
    return Date.UTC(y, m - 1, d);
  } catch {
    // Invalid tz → use the runtime's local calendar day.
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }
}

/**
 * Calendar-day countdown label relative to now ("today" / "tomorrow" /
 * "in N days"), measured against the viewer's timezone so "today" matches what
 * the viewer sees on their clock.
 */
function countdownLabel(iso: string, viewerTz?: string): string | null {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const diffDays = Math.round((dayEpochInTz(start, viewerTz) - dayEpochInTz(new Date(), viewerTz)) / MS_PER_DAY);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays} days`;
}

/** One avatar in the RSVP stack — ring color encodes the rsvp's status. */
function RsvpAvatar({ rsvp }: { rsvp: ScheduleRsvp }) {
  const name = rsvp.username ?? 'Unknown';
  const initials = getInitials(rsvp.username);
  // NOTE: The avatar stack wrapper is aria-hidden="true" (decorative), so the
  // `title` attribute here is NOT exposed to assistive tech. Accessible status
  // semantics are carried by the visible "N in · M tentative" counts and the
  // labeled RSVP buttons below. The ring color (and this title) are decorative
  // reinforcement for sighted users only.
  const title = `${name} — ${rsvp.status}`;
  return (
    <div data-testid="rsvp-avatar" className="-ml-1.5 first:ml-0" title={title}>
      <div
        data-testid="rsvp-avatar-ring"
        className="w-8 h-8 rounded-full border-2 bg-surface-card"
        style={{ borderColor: STATUS_TOKEN[rsvp.status] }}
      >
        <SafeAvatar
          alt={name}
          className="w-full h-full rounded-full object-cover"
          fallback={
            <span className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary">
              {initials}
            </span>
          }
        />
      </div>
    </div>
  );
}

/** Active RSVP button → matching status Button variant; inactive → secondary. */
const ACTIVE_VARIANT: Record<RsvpStatus, 'success' | 'warning' | 'danger'> = {
  available: 'success',
  tentative: 'warning',
  unavailable: 'danger',
};

const RSVP_OPTIONS: Array<{ status: RsvpStatus; label: string }> = [
  { status: 'available', label: "I'm in" },
  { status: 'tentative', label: 'Tentative' },
  { status: 'unavailable', label: "Can't make it" },
];

/**
 * Member-grid status glyph — a TEXT glyph plus an sr-only label so status is
 * never color-only (a11y). The '·' no-answer case lives in NO_ANSWER_GLYPH.
 */
const GRID_GLYPH: Record<RsvpStatus, { ch: string; cls: string; label: string }> = {
  available: { ch: '✓', cls: 'text-status-success', label: 'available' },
  tentative: { ch: '?', cls: 'text-status-warning', label: 'tentative' },
  unavailable: { ch: '✗', cls: 'text-status-error', label: "can't make it" },
};

const NO_ANSWER_GLYPH = { ch: '·', cls: 'text-text-muted', label: 'no answer' };

export function SessionRsvpCard({
  session,
  currentUserRsvp,
  onRsvp,
  variant = 'next',
  viewerTimezone,
  members,
  memberDetail = 'stack',
  headerActions,
  showDayPill = false,
}: SessionRsvpCardProps) {
  const sessionTz = session.timezone;
  const viewerTz = viewerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const isLater = variant === 'later';

  const dayLabel = formatDay(session.startTime, sessionTz);
  const sessionTime = formatTime(session.startTime, sessionTz);
  const viewerTime = formatTime(session.startTime, viewerTz);
  // Only show the "your time" half when the viewer is in a different zone.
  const showViewerTime = Boolean(viewerTime) && viewerTz !== sessionTz;
  const dayPill = showDayPill ? formatDayPill(session.startTime, sessionTz) : null;

  const countdown = countdownLabel(session.startTime, viewerTz);

  const availableCount = session.rsvps.filter((r) => r.status === 'available').length;
  const tentativeCount = session.rsvps.filter((r) => r.status === 'tentative').length;

  // Grid + "no answer" derivation (members-minus-rsvps). Only meaningful when
  // `members` is provided; the map is cheap so we build it unconditionally.
  const rsvpByUser = new Map(session.rsvps.map((r) => [r.userId, r]));
  const noAnswerCount = members ? members.filter((m) => !rsvpByUser.has(m.userId)).length : 0;
  // Narrowed (not `members!`) so the grid render below is type-safe without an
  // assertion: defined only when grid mode is actually active.
  const gridMembers = memberDetail === 'grid' ? members : undefined;

  // Contextual warning note — gated on `members` (Home's line is unchanged).
  const tentativeNames = session.rsvps.filter((r) => r.status === 'tentative').map((r) => r.username ?? 'Unknown');
  const unavailableNames = session.rsvps.filter((r) => r.status === 'unavailable').map((r) => r.username ?? 'Unknown');
  const warningParts: string[] = [];
  if (tentativeNames.length) warningParts.push(`${tentativeNames.join(', ')} tentative`);
  if (unavailableNames.length) warningParts.push(`${unavailableNames.join(', ')} can't make it`);
  const warningNote = members && warningParts.length ? `${warningParts.join(' · ')} — sub may be needed` : null;

  // Sanctioned default-render deltas: 'next' gains the accent ring; a
  // tracking-off session hides the whole RSVP pressure UI (legacy parity).
  const trackingOff = session.trackAvailability === false;
  const inactiveVariant = isLater ? 'ghost' : 'secondary';
  // Viewer mode: a Schedule viewer (members provided, no callback) sees no
  // dead RSVP buttons. Home (no members) keeps the existing inert render.
  const omitStrip = Boolean(members) && !onRsvp;

  const countdownTag = countdown ? (
    <Tag variant="label" tone="accent">
      <span data-testid="countdown-chip">{countdown}</span>
    </Tag>
  ) : undefined;

  const countsNode = (
    <div data-testid="rsvp-counts" className="text-xs text-text-secondary">
      <span className="text-status-success">{availableCount} in</span>
      <span aria-hidden="true" className="text-text-tertiary"> · </span>
      <span className="text-status-warning">{tentativeCount} tentative</span>
      {members && (
        <>
          <span aria-hidden="true" className="text-text-tertiary"> · </span>
          <span className="text-text-muted">{noAnswerCount} no answer</span>
        </>
      )}
    </div>
  );

  const dayTimeBlock = (
    <div>
      <div data-testid="session-daytime" className="font-display text-lg font-semibold text-text-primary">
        {dayLabel ? `${dayLabel}` : session.title}
        {sessionTime && <span className="ml-2 text-text-secondary">{sessionTime}</span>}
      </div>
      <div data-testid="session-tz-line" className="text-xs text-text-tertiary">
        {sessionTime ?? ''}
        {showViewerTime && (
          <>
            <span aria-hidden="true"> · </span>
            <span>your time {viewerTime}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <CardShell
      title={isLater ? session.title : 'Next session'}
      className={isLater ? '' : 'ring-1 ring-accent/40'}
      headerRight={
        headerActions ? (
          <div className="flex items-center gap-1.5">
            {countdownTag}
            {headerActions}
          </div>
        ) : (
          countdownTag
        )
      }
    >
      <div className="flex flex-col gap-3">
        {/* Day / time — display font, optionally preceded by the day pill */}
        {showDayPill && dayPill ? (
          <div className="flex items-center gap-3">
            <div data-testid="day-pill" className="flex flex-col items-center leading-none">
              <span className="font-display text-sm font-extrabold text-text-primary">{dayPill.day}</span>
              <span className="text-xs text-text-tertiary">{dayPill.weekday}</span>
            </div>
            {dayTimeBlock}
          </div>
        ) : (
          dayTimeBlock
        )}

        {trackingOff ? (
          <div data-testid="availability-not-required" className="text-xs text-text-tertiary">
            Availability not required
          </div>
        ) : (
          <>
            {/* Member grid (Schedule) OR avatar stack (Home) + counts */}
            {gridMembers ? (
              <div className="flex flex-col gap-2">
                <ul data-testid="rsvp-member-grid" className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                  {gridMembers.map((member) => {
                    const rsvp = rsvpByUser.get(member.userId);
                    const glyph = rsvp ? GRID_GLYPH[rsvp.status] : NO_ANSWER_GLYPH;
                    return (
                      <li
                        key={member.userId}
                        className="flex min-w-0 items-center gap-1.5"
                        title={rsvp?.note ?? undefined}
                      >
                        <PlayerIdentity variant="rsvp-row" name={member.username ?? 'Unknown'} />
                        <span aria-hidden="true" className={`ml-auto text-xs font-bold ${glyph.cls}`}>
                          {glyph.ch}
                        </span>
                        <span className="sr-only">{glyph.label}</span>
                      </li>
                    );
                  })}
                </ul>
                {countsNode}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {session.rsvps.length > 0 && (
                  <div className="flex items-center" aria-hidden="true">
                    {session.rsvps.map((rsvp) => (
                      <RsvpAvatar key={rsvp.id} rsvp={rsvp} />
                    ))}
                  </div>
                )}
                {countsNode}
              </div>
            )}

            {warningNote && (
              <div data-testid="rsvp-warning-note" className="text-xs text-text-tertiary">
                {warningNote}
              </div>
            )}

            {/* RSVP button strip — omitted for Schedule viewers */}
            {!omitStrip && (
              <div className="flex gap-2">
                {RSVP_OPTIONS.map(({ status, label }) => {
                  const isActive = currentUserRsvp === status;
                  return (
                    <Button
                      key={status}
                      size="sm"
                      variant={isActive ? ACTIVE_VARIANT[status] : inactiveVariant}
                      aria-pressed={isActive}
                      onClick={() => onRsvp?.(status)}
                      className="flex-1"
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </CardShell>
  );
}
