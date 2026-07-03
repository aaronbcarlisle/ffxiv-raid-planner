/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { localSlotToUtc } from './availabilityUtils';
import { AvailabilityHeatmap } from './AvailabilityHeatmap';
import type { AvailabilityDateSummary, Membership, ScheduleSession, ScheduleSessionCreate } from '../../types';

function makeMember(userId: string, username: string): Membership {
  return {
    id: `member-${userId}`,
    userId,
    staticGroupId: 'group-1',
    role: 'member',
    joinedAt: '2026-06-17T00:00:00Z',
    user: { id: userId, discordId: `discord-${userId}`, discordUsername: username },
  };
}

/** Seeds AvailabilityDateSummary[] from viewer-local (date, time, user) entries via
 * localSlotToUtc, so tests are TZ-safe regardless of the runner's timezone. */
function buildData(
  entries: Array<{ date: string; time: string; userId: string; username: string }>,
): AvailabilityDateSummary[] {
  const byDate = new Map<string, Map<string, { id: string; userId: string; username: string; date: string; slots: string[] }>>();
  entries.forEach(({ date, time, userId, username }, index) => {
    const { utcDate, utcTime } = localSlotToUtc(date, time);
    if (!byDate.has(utcDate)) byDate.set(utcDate, new Map());
    const users = byDate.get(utcDate)!;
    if (!users.has(userId)) {
      users.set(userId, { id: `r${index}`, userId, username, date: utcDate, slots: [] });
    }
    users.get(userId)!.slots.push(utcTime);
  });
  return [...byDate.entries()].map(([date, users]) => ({ date, responses: [...users.values()] }));
}

const WEEK_DATES = ['2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13'];

function makeSession(overrides: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id: 's1', staticGroupId: 'group-1', createdById: 'u1', title: 'Raid',
    description: null, startTime: '2026-07-07T20:00:00.000Z', endTime: '2026-07-07T22:00:00.000Z',
    timezone: 'UTC', isRecurring: false, recurrenceRule: null,
    category: 'raid', contentId: null, contentName: null, bannerUrl: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', rsvps: [],
    ...overrides,
  } as ScheduleSession;
}

describe('AvailabilityHeatmap', () => {
  it('renders a color-mix background for a cell with both half-slots marked, with count-aware aria/name-list', () => {
    const alice = makeMember('u1', 'Alice');
    const bob = makeMember('u2', 'Bob');
    const data = buildData([
      // Hour 20 (8 PM) on 2026-07-07: only Alice marks both half-slots → 1 of 2 free.
      { date: '2026-07-07', time: '20:00', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '20:30', userId: 'u1', username: 'Alice' },
    ]);
    render(
      <AvailabilityHeatmap
        data={data}
        members={[alice, bob]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    const cell = screen.getByTitle('Alice');
    expect(cell.getAttribute('style')).toContain('color-mix(in srgb, var(--color-accent) 28%, var(--color-surface-card))');
  });

  it('shows the count number on a full-count cell (all members marked)', () => {
    const alice = makeMember('u1', 'Alice');
    const bob = makeMember('u2', 'Bob');
    const data = buildData([
      // Hour 19 (7 PM) on 2026-07-07: both Alice and Bob mark both half-slots → 2 of 2 free.
      { date: '2026-07-07', time: '19:00', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '19:30', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '19:00', userId: 'u2', username: 'Bob' },
      { date: '2026-07-07', time: '19:30', userId: 'u2', username: 'Bob' },
    ]);
    render(
      <AvailabilityHeatmap
        data={data}
        members={[alice, bob]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    const cell = screen.getByTitle('Alice, Bob');
    expect(cell).toHaveTextContent('2');
  });

  it('renders the exact empty-data copy when no availability is marked', () => {
    const alice = makeMember('u1', 'Alice');
    render(
      <AvailabilityHeatmap
        data={[]}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    expect(
      screen.getByText('No availability marked yet. Set yours via “Your availability” below — the picture fills in as members add theirs.'),
    ).toBeInTheDocument();
  });

  it('canManage cells expose role="button" with the composed aria-label and fire onProposeSession with a 2h draft', () => {
    const alice = makeMember('u1', 'Alice');
    const bob = makeMember('u2', 'Bob');
    const data = buildData([
      { date: '2026-07-07', time: '19:00', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '19:30', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '19:00', userId: 'u2', username: 'Bob' },
      { date: '2026-07-07', time: '19:30', userId: 'u2', username: 'Bob' },
    ]);
    const onProposeSession = vi.fn<(draft: ScheduleSessionCreate) => void>();
    render(
      <AvailabilityHeatmap
        data={data}
        members={[alice, bob]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage
        onProposeSession={onProposeSession}
      />,
    );
    const button = screen.getByRole('button', { name: 'Tue 7:00 PM — 2 of 2 free' });
    fireEvent.click(button);
    expect(onProposeSession).toHaveBeenCalledTimes(1);
    const draft = onProposeSession.mock.calls[0][0];
    expect(draft.title).toBe('Raid session');
    expect(draft.isRecurring).toBe(false);
    const start = new Date(draft.startTime).getTime();
    const end = new Date(draft.endTime).getTime();
    expect(end - start).toBe(2 * 60 * 60 * 1000);
  });

  it('renders no role="button" cells when canManage is false (inert divs with title)', () => {
    const alice = makeMember('u1', 'Alice');
    const data = buildData([
      { date: '2026-07-07', time: '19:00', userId: 'u1', username: 'Alice' },
      { date: '2026-07-07', time: '19:30', userId: 'u1', username: 'Alice' },
    ]);
    render(
      <AvailabilityHeatmap
        data={data}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTitle('Alice')).toBeInTheDocument();
  });

  it('marks the hour-top cells a session overlaps, even for an off-the-hour local start', () => {
    const alice = makeMember('u1', 'Alice');
    // Session occurring at local 2026-07-07 20:30, 90-min duration → span
    // [20:30, 22:00) overlaps hour tops 20 and 21; hour 22 must NOT be marked.
    const start = new Date(2026, 6, 7, 20, 30, 0);
    const end = new Date(2026, 6, 7, 22, 0, 0);
    const session = makeSession({ startTime: start.toISOString(), endTime: end.toISOString() });
    render(
      <AvailabilityHeatmap
        data={[]}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[{ session, occursAt: start.toISOString() }]}
        canManage
        onProposeSession={vi.fn()}
      />,
    );
    const hour20 = screen.getByRole('button', { name: 'Tue 8:00 PM — 0 of 1 free' });
    const hour21 = screen.getByRole('button', { name: 'Tue 9:00 PM — 0 of 1 free' });
    const hour22 = screen.getByRole('button', { name: 'Tue 10:00 PM — 0 of 1 free' });
    expect(hour20).toHaveAttribute('data-scheduled', 'true');
    expect(hour21).toHaveAttribute('data-scheduled', 'true');
    expect(hour22).not.toHaveAttribute('data-scheduled');
  });

  it('renders the legend with "Fewer free", "All {total}", "scheduled", and ascending density swatches', () => {
    const alice = makeMember('u1', 'Alice');
    const { container } = render(
      <AvailabilityHeatmap
        data={[]}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    expect(screen.getByText('Fewer free')).toBeInTheDocument();
    expect(screen.getByText('All 1')).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
    // Swatches ascend from lightest (8%) beside "Fewer free" to darkest (70%)
    // beside "All {total}" — matching the note's "darker = more free".
    const swatches = [...container.querySelectorAll('.h-2\\.5.w-2\\.5')];
    expect(swatches).toHaveLength(6); // 5 density steps + 1 scheduled-ring swatch
    const styles = swatches.slice(0, 5).map((swatch) => swatch.getAttribute('style') ?? '');
    expect(styles[0]).toContain('var(--color-accent) 8%');
    expect(styles[1]).toContain('var(--color-accent) 16%');
    expect(styles[2]).toContain('var(--color-accent) 28%');
    expect(styles[3]).toContain('var(--color-accent) 45%');
    expect(styles[4]).toContain('var(--color-accent) 70%');
  });

  // Task 10 (§5.1 stopgap): an optional Edit-week affordance in the card header,
  // additive-only — see the paired regression pin below for the unset case.
  it('renders an "Edit week" button that fires onEditWeek when set', () => {
    const alice = makeMember('u1', 'Alice');
    const onEditWeek = vi.fn();
    render(
      <AvailabilityHeatmap
        data={[]}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
        onEditWeek={onEditWeek}
      />,
    );
    const button = screen.getByRole('button', { name: 'Edit week' });
    fireEvent.click(button);
    expect(onEditWeek).toHaveBeenCalledTimes(1);
    // The raiders count still renders alongside the button.
    expect(screen.getByText('1 raiders')).toBeInTheDocument();
  });

  // Regression pin: default render (onEditWeek unset) must stay byte-identical
  // to every other test above — no button, just the bare raiders span.
  it('renders the bare raiders span with no "Edit week" button when onEditWeek is unset', () => {
    const alice = makeMember('u1', 'Alice');
    render(
      <AvailabilityHeatmap
        data={[]}
        members={[alice]}
        weekDates={WEEK_DATES}
        sessions={[]}
        canManage={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit week' })).not.toBeInTheDocument();
    expect(screen.getByText('1 raiders')).toBeInTheDocument();
  });
});
