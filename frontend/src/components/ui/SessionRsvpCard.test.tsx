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
  });
});
