/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SessionRsvpCard } from './SessionRsvpCard';
import type { ScheduleSession, ScheduleRsvp, RsvpStatus } from '../../types';

function makeRsvp(partial: Partial<ScheduleRsvp> & { username: string | null; status: RsvpStatus }): ScheduleRsvp {
  return {
    id: `r-${partial.username ?? 'x'}-${partial.status}`,
    sessionId: 's1',
    userId: `u-${partial.username ?? 'x'}`,
    note: null,
    updatedAt: '2026-07-01T00:00:00Z',
    ...partial,
  };
}

function makeSession(overrides: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id: 's1',
    staticGroupId: 'g1',
    createdById: 'u1',
    title: 'Prog night',
    description: null,
    startTime: '2026-07-03T00:00:00Z',
    endTime: '2026-07-03T03:00:00Z',
    timezone: 'America/New_York',
    isRecurring: false,
    recurrenceRule: null,
    category: null,
    contentId: null,
    contentName: null,
    bannerUrl: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    rsvps: [
      makeRsvp({ username: 'Tank One', status: 'available' }),
      makeRsvp({ username: 'Healer Two', status: 'tentative' }),
    ],
    ...overrides,
  } as ScheduleSession;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionRsvpCard', () => {
  it('renders the session day/time line', () => {
    render(<SessionRsvpCard session={makeSession()} />);
    // The day/time line is present (display font day-time).
    expect(screen.getByTestId('session-daytime')).toBeInTheDocument();
  });

  it('renders the timezone line', () => {
    render(<SessionRsvpCard session={makeSession()} viewerTimezone="America/Los_Angeles" />);
    const tz = screen.getByTestId('session-tz-line');
    expect(tz).toBeInTheDocument();
    // Session is 8:00 PM EST; viewer LA is 5:00 PM PST.
    expect(tz.textContent).toMatch(/your time/i);
  });

  it('fires onRsvp with "available" when "I\'m in" clicked', () => {
    const onRsvp = vi.fn();
    render(<SessionRsvpCard session={makeSession()} onRsvp={onRsvp} />);
    fireEvent.click(screen.getByRole('button', { name: /i'm in/i }));
    expect(onRsvp).toHaveBeenCalledWith('available');
  });

  it('fires onRsvp with "tentative" when "Tentative" clicked', () => {
    const onRsvp = vi.fn();
    render(<SessionRsvpCard session={makeSession()} onRsvp={onRsvp} />);
    fireEvent.click(screen.getByRole('button', { name: /tentative/i }));
    expect(onRsvp).toHaveBeenCalledWith('tentative');
  });

  it('fires onRsvp with "unavailable" when "Can\'t make it" clicked', () => {
    const onRsvp = vi.fn();
    render(<SessionRsvpCard session={makeSession()} onRsvp={onRsvp} />);
    fireEvent.click(screen.getByRole('button', { name: /can't make it/i }));
    expect(onRsvp).toHaveBeenCalledWith('unavailable');
  });

  it('marks the current RSVP button pressed and others not pressed', () => {
    render(<SessionRsvpCard session={makeSession()} currentUserRsvp="tentative" onRsvp={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tentative/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /i'm in/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /can't make it/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not mark any button pressed when currentUserRsvp is omitted', () => {
    render(<SessionRsvpCard session={makeSession()} onRsvp={vi.fn()} />);
    expect(screen.getByRole('button', { name: /i'm in/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /tentative/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the correct "N in · M tentative" counts', () => {
    const session = makeSession({
      rsvps: [
        makeRsvp({ username: 'A', status: 'available' }),
        makeRsvp({ username: 'B', status: 'available' }),
        makeRsvp({ username: 'C', status: 'tentative' }),
        makeRsvp({ username: 'D', status: 'unavailable' }),
      ],
    });
    render(<SessionRsvpCard session={session} />);
    const counts = screen.getByTestId('rsvp-counts');
    expect(counts.textContent).toMatch(/2 in/);
    expect(counts.textContent).toMatch(/1 tentative/);
  });

  it('renders one avatar per rsvp', () => {
    const session = makeSession({
      rsvps: [
        makeRsvp({ username: 'A', status: 'available' }),
        makeRsvp({ username: 'B', status: 'tentative' }),
        makeRsvp({ username: 'C', status: 'unavailable' }),
      ],
    });
    render(<SessionRsvpCard session={session} />);
    expect(screen.getAllByTestId('rsvp-avatar')).toHaveLength(3);
    // The stack wrapper opts out of index.css's global aria-hidden centering
    // override (role="presentation" alongside aria-hidden="true") — without
    // it the stack's flex row would blockify to a vertical pile in a real browser.
    const stack = screen.getAllByTestId('rsvp-avatar')[0].parentElement as HTMLElement;
    expect(stack).toHaveAttribute('role', 'presentation');
  });

  it('does not crash and buttons are inert when onRsvp is omitted', () => {
    render(<SessionRsvpCard session={makeSession()} />);
    // Clicking with no handler must not throw.
    expect(() => fireEvent.click(screen.getByRole('button', { name: /i'm in/i }))).not.toThrow();
  });

  it('renders a countdown chip ("in N days")', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'));
    // Pin viewer tz to UTC so the calendar-day diff is deterministic on any CI runner.
    render(<SessionRsvpCard session={makeSession({ startTime: '2026-07-03T00:00:00Z' })} viewerTimezone="UTC" />);
    const chip = screen.getByTestId('countdown-chip');
    expect(chip.textContent).toMatch(/3 days/);
  });

  it('renders a "today" countdown chip for a same-day session', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T01:00:00Z'));
    render(<SessionRsvpCard session={makeSession({ startTime: '2026-07-03T20:00:00Z' })} viewerTimezone="UTC" />);
    expect(screen.getByTestId('countdown-chip').textContent).toMatch(/today/i);
  });

  it('renders gracefully with an empty rsvp list', () => {
    render(<SessionRsvpCard session={makeSession({ rsvps: [] })} />);
    expect(screen.queryAllByTestId('rsvp-avatar')).toHaveLength(0);
    expect(screen.getByTestId('rsvp-counts').textContent).toMatch(/0 in/);
  });

  it('colors each avatar ring by RSVP status token', () => {
    const session = makeSession({
      rsvps: [makeRsvp({ username: 'A', status: 'available' })],
    });
    render(<SessionRsvpCard session={session} />);
    const avatar = screen.getByTestId('rsvp-avatar');
    // Ring border color resolves to the success status token (no hex literal).
    expect(within(avatar).getByTestId('rsvp-avatar-ring').style.borderColor).toContain('--color-status-success');
    // The initials fallback renders through the shared InitialsAvatar (Task 7
    // swap) — its hard-coded role="presentation" is the signature.
    expect(within(avatar).getByText('A')).toHaveAttribute('role', 'presentation');
  });
});

// ---------------------------------------------------------------------------
// F6e additive extensions (member grid, 'later' variant, day pill, actions).
// The regression lock is written FIRST — with only the original props, the
// card renders the F6b anatomy EXCEPT the two sanctioned default-render deltas:
//   1. the 'next'-variant accent ring (ring-1 ring-accent/40), and
//   2. trackAvailability === false → "Availability not required".
// ---------------------------------------------------------------------------

describe('SessionRsvpCard — F6e regression lock (no new props → Home render)', () => {
  it('renders exactly the F6b anatomy with only the original props', () => {
    const session = makeSession();
    render(<SessionRsvpCard session={session} currentUserRsvp="available" onRsvp={vi.fn()} />);
    expect(screen.getByText('Next session')).toBeInTheDocument();
    expect(screen.queryByTestId('day-pill')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-member-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-warning-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('rsvp-counts').textContent).not.toContain('no answer');
    expect(screen.getAllByTestId('rsvp-avatar').length).toBe(session.rsvps.length); // stack, not grid
    // The ONE sanctioned default delta: the next-variant accent ring.
    expect(document.querySelector('.ring-accent\\/40')).toBeInTheDocument();
  });
});

describe('SessionRsvpCard — F6e new behaviors', () => {
  const gridMembers = [
    { userId: 'u-Alpha', username: 'Alpha' },
    { userId: 'u-Bravo', username: 'Bravo' },
    { userId: 'u-Charlie', username: 'Charlie' },
    { userId: 'u-Delta', username: 'Delta' },
  ];

  it("'later' variant: title = session.title, no accent ring, ghost inactive buttons", () => {
    render(
      <SessionRsvpCard session={makeSession()} variant="later" currentUserRsvp="available" onRsvp={vi.fn()} />,
    );
    // Title becomes the session title (CardShell <h3>), not "Next session".
    expect(screen.getByText('Prog night')).toBeInTheDocument();
    expect(screen.queryByText('Next session')).not.toBeInTheDocument();
    expect(document.querySelector('.ring-accent\\/40')).not.toBeInTheDocument();
    // Inactive button carries the ghost variant (bg-transparent); the active
    // one (success) does not — class difference proves the ghost mapping.
    const inactive = screen.getByRole('button', { name: /tentative/i });
    const active = screen.getByRole('button', { name: /i'm in/i });
    expect(inactive.className).toContain('bg-transparent');
    expect(active.className).not.toContain('bg-transparent');
  });

  it('member grid: replaces the avatar stack, one row per member, counts include no-answer', () => {
    const session = makeSession({
      rsvps: [
        makeRsvp({ username: 'Alpha', status: 'available' }),
        makeRsvp({ username: 'Bravo', status: 'tentative' }),
      ],
    });
    render(<SessionRsvpCard session={session} members={gridMembers} memberDetail="grid" />);
    const grid = screen.getByTestId('rsvp-member-grid');
    expect(grid).toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-avatar')).not.toBeInTheDocument(); // stack gone
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
    const counts = screen.getByTestId('rsvp-counts').textContent ?? '';
    expect(counts).toContain('1 in');
    expect(counts).toContain('1 tentative');
    expect(counts).toContain('2 no answer');
    // Charlie + Delta have no rsvp → two no-answer glyphs in the grid.
    expect(within(grid).getAllByText('·')).toHaveLength(2);
  });

  it('no-answer derivation is members-minus-rsvps (a member with an rsvp never shows ·)', () => {
    const session = makeSession({
      rsvps: [
        makeRsvp({ username: 'Alpha', status: 'available' }),
        makeRsvp({ username: 'Bravo', status: 'tentative' }),
        makeRsvp({ username: 'Charlie', status: 'unavailable' }),
      ],
    });
    const members = [
      { userId: 'u-Alpha', username: 'Alpha' },
      { userId: 'u-Bravo', username: 'Bravo' },
      { userId: 'u-Charlie', username: 'Charlie' },
    ];
    render(<SessionRsvpCard session={session} members={members} memberDetail="grid" />);
    const grid = screen.getByTestId('rsvp-member-grid');
    expect(screen.getByTestId('rsvp-counts').textContent).toContain('0 no answer');
    expect(within(grid).queryByText('·')).not.toBeInTheDocument();
  });

  it('trackAvailability === false: hides grid, counts, and RSVP strip', () => {
    render(
      <SessionRsvpCard
        session={makeSession({ trackAvailability: false })}
        members={gridMembers}
        memberDetail="grid"
        onRsvp={vi.fn()}
      />,
    );
    expect(screen.getByTestId('availability-not-required')).toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-counts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-member-grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /i'm in/i })).not.toBeInTheDocument();
  });

  it('headerActions: renders the passed node in the header row', () => {
    render(
      <SessionRsvpCard
        session={makeSession()}
        headerActions={<button aria-label="kebab" data-testid="kebab-probe" />}
      />,
    );
    expect(screen.getByTestId('kebab-probe')).toBeInTheDocument();
  });

  it('showDayPill: shows the day number + short weekday in the session tz', () => {
    render(<SessionRsvpCard session={makeSession()} showDayPill />);
    const pill = screen.getByTestId('day-pill');
    const iso = '2026-07-03T00:00:00Z';
    const tz = 'America/New_York';
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: tz }).format(new Date(iso));
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(new Date(iso));
    expect(pill.textContent).toContain(day);
    expect(pill.textContent).toContain(weekday);
  });

  it('warning note: renders only when members present and an rsvp is tentative/unavailable', () => {
    const session = makeSession({
      rsvps: [makeRsvp({ username: 'Bob', status: 'tentative' })],
    });
    const members = [{ userId: 'u-Bob', username: 'Bob' }];
    const { rerender } = render(
      <SessionRsvpCard session={session} members={members} memberDetail="grid" />,
    );
    expect(screen.getByTestId('rsvp-warning-note').textContent).toMatch(/Bob tentative — sub may be needed/);
    // Without members the note is absent (Home's line is unchanged).
    rerender(<SessionRsvpCard session={session} />);
    expect(screen.queryByTestId('rsvp-warning-note')).not.toBeInTheDocument();
  });

  it('viewer omission: members provided + no onRsvp → RSVP strip omitted', () => {
    render(<SessionRsvpCard session={makeSession()} members={gridMembers} memberDetail="grid" />);
    expect(screen.queryByRole('button', { name: /i'm in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentative/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /can't make it/i })).not.toBeInTheDocument();
  });
});
