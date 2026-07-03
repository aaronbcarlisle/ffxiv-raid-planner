/**
 * Schedule assembly tests (Task 8). Drives interaction via `fireEvent` (project
 * convention — no `@testing-library/user-event`) and wraps every render in a
 * `MemoryRouter` (Schedule reads `useSearchParams`/`useNavigate`). Every store
 * fetch ACTION is stubbed in `beforeEach` so the mount/scoped-week effects never
 * fall through to the real api client — in CI (no backend) an un-stubbed fetch
 * rejects with ECONNREFUSED as an UNHANDLED rejection and fails the whole run.
 * The shared week clock is seeded via `useLootTrackingStore.setState`
 * (weekStartDate '2026-06-23', currentWeek 2 → week 2 = 2026-06-30…07-06).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, it, expect, vi, type Mock } from 'vitest';
import { Schedule } from './Schedule';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import type { ScheduleSession, StaticGroup } from '../../types';

function makeSession(overrides: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id: 's1',
    staticGroupId: 'g1',
    createdById: 'u1',
    title: 'Session',
    description: null,
    startTime: '2026-07-01T20:00:00Z',
    endTime: '2026-07-01T22:00:00Z',
    timezone: 'UTC',
    isRecurring: false,
    recurrenceRule: null,
    trackAvailability: true,
    category: null,
    contentId: null,
    contentName: null,
    bannerUrl: null,
    createdAt: '',
    updatedAt: '',
    rsvps: [],
    ...overrides,
  };
}

// s2 lives inside week 2 (2026-06-30…07-06); s3 lives inside week 3 (07-07…07-13).
const s2 = makeSession({ id: 's2', title: 'Week Two Session', startTime: '2026-07-01T20:00:00Z', endTime: '2026-07-01T22:00:00Z' });
const s3 = makeSession({ id: 's3', title: 'Week Three Session', startTime: '2026-07-08T20:00:00Z', endTime: '2026-07-08T22:00:00Z' });
const sRec = makeSession({ id: 'sRec', title: 'Recurring Session', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE', startTime: '2026-06-24T20:00:00Z', endTime: '2026-06-24T22:00:00Z' });

const group: StaticGroup = {
  id: 'g1',
  name: 'Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [{ id: 'm1', userId: 'u1', staticGroupId: 'g1', role: 'owner', joinedAt: '', user: { displayName: 'Alice' } }],
} as unknown as StaticGroup;

function renderSchedule(
  props: Partial<Parameters<typeof Schedule>[0]> = {},
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Schedule group={group} tier={null} canManage={true} currentUserId="u1" {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
  // jsdom doesn't implement scrollIntoView; the deep-link effect calls it.
  Element.prototype.scrollIntoView = vi.fn();

  useScheduleStore.setState({
    sessions: [s2, s3], settings: null, isLoading: false, error: null,
    fetchSessions: vi.fn(), fetchExceptions: vi.fn(async () => []),
    submitRsvp: vi.fn(async () => {}), createSession: vi.fn(async () => {}),
    updateSession: vi.fn(async () => {}), deleteSession: vi.fn(async () => {}),
    createException: vi.fn(async () => ({}) as never),
  } as never);
  useAvailabilityStore.setState({ data: [], fetchAvailability: vi.fn() } as never);
  useLootTrackingStore.setState({ currentWeek: 2, maxWeek: 2, weekStartDate: '2026-06-23' } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

const availabilityMock = () => useAvailabilityStore.getState().fetchAvailability as unknown as Mock;

describe('Schedule', () => {
  it('mounts the two-region screen, subtitle, and fires the fetch topology', async () => {
    renderSchedule();
    expect(screen.getByTestId('schedule-screen')).toBeInTheDocument();
    expect(
      screen.getByText("This week's sessions and when everyone's free · the same week drives loot"),
    ).toBeInTheDocument();

    expect(useScheduleStore.getState().fetchSessions).toHaveBeenCalledTimes(1);
    expect(useScheduleStore.getState().fetchSessions).toHaveBeenCalledWith('g1');

    await waitFor(() => expect(availabilityMock()).toHaveBeenCalled());
    const [gid, startDate, endDate] = availabilityMock().mock.calls[0];
    expect(gid).toBe('g1');
    // Padded UTC range around week 2's dates (2026-06-30 … 07-06).
    expect(startDate < '2026-06-30').toBe(true);
    expect(endDate > '2026-07-06').toBe(true);
  });

  it('re-fetches availability for the previous week when stepping back', async () => {
    renderSchedule();
    await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(1));
    const firstStart = availabilityMock().mock.calls[0][1];

    fireEvent.click(screen.getByLabelText('Previous week'));

    await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(2));
    const secondStart = availabilityMock().mock.calls[1][1];
    expect(secondStart < firstStart).toBe(true);
  });

  it('renders only sessions inside the scoped week, with a jump hint for empty weeks', async () => {
    // Week 2 shows s2; s3 (week 3) is absent.
    const { unmount } = renderSchedule();
    expect(screen.getByText('Week Two Session')).toBeInTheDocument();
    expect(screen.queryByText('Week Three Session')).not.toBeInTheDocument();
    unmount();

    // With s3 as the ONLY session, week 2 is empty → hint points to Week 3.
    useScheduleStore.setState({ sessions: [s3] } as never);
    renderSchedule();
    const hint = await screen.findByText(/Week 3/);
    fireEvent.click(hint);
    expect(await screen.findByText('Week Three Session')).toBeInTheDocument();
  });

  it('honors the ?sessionId= deep link by jumping the scoped week and highlighting', async () => {
    const { container } = renderSchedule({}, ['/?sessionId=s3']);
    expect(await screen.findByText('Week Three Session')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.highlight-pulse')).not.toBeNull());
  });

  // Regression pins for the exceptions-map identity churn defect: the exceptions
  // effect publishes a FRESH Map after mount/resolution; because the map is a dep
  // of the deep-link RESOLVING effect, that effect's cleanup must NOT own the
  // 50ms scroll / 5000ms highlight timers — the churn would clear them and the
  // handledRef early-return would never re-arm them.
  it('fires the deep-link scroll after 50ms despite exceptions-map churn', async () => {
    vi.useFakeTimers();
    // A recurring session (alongside the deep-linked s3) forces the exceptions
    // effect down the async path, so the fresh-Map identity churn lands BEFORE
    // the 50ms scroll timer fires — the same hazard the highlight-clear test
    // pins below. Without this, the test can't discriminate a partial revert
    // that re-introduces the timer-ownership bug.
    useScheduleStore.setState({ sessions: [sRec, s3] } as never);
    renderSchedule({}, ['/?sessionId=s3']);
    // Flush the fetchExceptions microtasks so the fresh Map lands.
    await act(async () => {});
    expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalledWith('g1', 'sRec');
    const scrollSpy = Element.prototype.scrollIntoView as unknown as Mock;
    expect(scrollSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the highlight after 5000ms even when exceptions publish a fresh map', async () => {
    vi.useFakeTimers();
    // A recurring session forces the exceptions effect down the async path: the
    // Promise.all resolution publishes a genuinely fresh Map AFTER the deep link
    // was handled — the exact identity churn that killed the clear timer.
    useScheduleStore.setState({ sessions: [sRec, s3] } as never);
    const { container } = renderSchedule({}, ['/?sessionId=s3']);
    // Flush the fetchExceptions microtasks so the fresh Map lands.
    await act(async () => {});
    expect(container.querySelector('.highlight-pulse')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelector('.highlight-pulse')).toBeNull();
  });

  it('fetches exceptions once per recurring id and none when no session recurs', async () => {
    const { unmount } = renderSchedule();
    // Baseline fixtures are non-recurring → no exception fetch.
    expect(useScheduleStore.getState().fetchExceptions).not.toHaveBeenCalled();
    unmount();

    useScheduleStore.setState({ sessions: [s2, sRec] } as never);
    renderSchedule();
    await waitFor(() => {
      expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalledTimes(1);
    });
    expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalledWith('g1', 'sRec');
  });

  it('hides RSVP controls from viewers and submits an RSVP for members', () => {
    // Viewer: session renders, but no RSVP buttons.
    const viewerGroup = { ...group, userRole: 'viewer' } as unknown as StaticGroup;
    const { unmount } = render(
      <MemoryRouter>
        <Schedule group={viewerGroup} tier={null} canManage={false} currentUserId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Week Two Session')).toBeInTheDocument();
    expect(screen.queryByText("I'm in")).not.toBeInTheDocument();
    unmount();

    // Owner: clicking "I'm in" submits an RSVP for that session.
    renderSchedule();
    fireEvent.click(screen.getByText("I'm in"));
    expect(useScheduleStore.getState().submitRsvp).toHaveBeenCalledWith('g1', 's2', 'available');
  });

  it('hides "Add session" affordances when the viewer cannot manage', () => {
    useScheduleStore.setState({ sessions: [] } as never);
    renderSchedule({ canManage: false });
    expect(screen.queryByText('Add session')).not.toBeInTheDocument();
  });

  it('never clears the shared session store on unmount', () => {
    const clearSessions = vi.fn();
    useScheduleStore.setState({ clearSessions } as never);
    const { unmount } = renderSchedule();
    unmount();
    expect(clearSessions).not.toHaveBeenCalled();
  });
});
