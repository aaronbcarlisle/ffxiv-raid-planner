import { CardShell } from './CardShell';
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
 *  - 'next'  — the prominent next-session card (BUILT, F6b).
 *  - 'later' — RESERVED for Schedule (F6e): neutral border, ghost RSVP
 *    buttons. NOT implemented yet (YAGNI); currently renders identically to
 *    'next'. Kept in the union so F6e can drop it in without an API break.
 */
type SessionRsvpVariant = 'next' | 'later';

export interface SessionRsvpCardProps {
  /** The session to display. Avatar stack + counts derive from `session.rsvps`. */
  session: ScheduleSession;
  /** The viewer's own RSVP status, if any — drives the pressed RSVP button. */
  currentUserRsvp?: RsvpStatus;
  /** Inline RSVP callback. Optional — the strip renders inert when omitted. */
  onRsvp?: (status: RsvpStatus) => void;
  /** See {@link SessionRsvpVariant}. Default 'next'; 'later' is API-reserved (F6e). */
  variant?: SessionRsvpVariant;
  /**
   * IANA timezone for the "your time" line. Defaults to the runtime's resolved
   * timezone. Falls back gracefully if the value is missing or invalid.
   */
  viewerTimezone?: string;
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
  // Status conveyed by more than color: the title attribute names the status.
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

export function SessionRsvpCard({
  session,
  currentUserRsvp,
  onRsvp,
  viewerTimezone,
}: SessionRsvpCardProps) {
  const sessionTz = session.timezone;
  const viewerTz = viewerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const dayLabel = formatDay(session.startTime, sessionTz);
  const sessionTime = formatTime(session.startTime, sessionTz);
  const viewerTime = formatTime(session.startTime, viewerTz);
  // Only show the "your time" half when the viewer is in a different zone.
  const showViewerTime = Boolean(viewerTime) && viewerTz !== sessionTz;

  const countdown = countdownLabel(session.startTime, viewerTz);

  const availableCount = session.rsvps.filter((r) => r.status === 'available').length;
  const tentativeCount = session.rsvps.filter((r) => r.status === 'tentative').length;

  return (
    <CardShell
      title="Next session"
      headerRight={
        countdown ? (
          <Tag variant="label" tone="accent">
            <span data-testid="countdown-chip">{countdown}</span>
          </Tag>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {/* Day / time — display font */}
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

        {/* RSVP avatar stack + counts */}
        <div className="flex items-center gap-3">
          {session.rsvps.length > 0 && (
            <div className="flex items-center" aria-hidden="true">
              {session.rsvps.map((rsvp) => (
                <RsvpAvatar key={rsvp.id} rsvp={rsvp} />
              ))}
            </div>
          )}
          <div data-testid="rsvp-counts" className="text-xs text-text-secondary">
            <span className="text-status-success">{availableCount} in</span>
            <span aria-hidden="true" className="text-text-tertiary"> · </span>
            <span className="text-status-warning">{tentativeCount} tentative</span>
          </div>
        </div>

        {/* RSVP button strip */}
        <div className="flex gap-2">
          {RSVP_OPTIONS.map(({ status, label }) => {
            const isActive = currentUserRsvp === status;
            return (
              <Button
                key={status}
                size="sm"
                variant={isActive ? ACTIVE_VARIANT[status] : 'secondary'}
                aria-pressed={isActive}
                onClick={() => onRsvp?.(status)}
                className="flex-1"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}
