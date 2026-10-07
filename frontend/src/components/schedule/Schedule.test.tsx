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
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, it, expect, vi, type Mock } from 'vitest';
import { ApiError } from '../../services/api';
import { toast } from '../../stores/toastStore';

// Task 10: AvailabilityGrid + CreateSessionModal are mounted only inside the
// edit/create modals — mocked to prop-capturing stubs (project convention, see
// WeaponPriorityBridge.test.tsx) so this suite stays store/router-only and
// never has to satisfy AvailabilityGrid's own store dependencies.
let mockAvailabilityGridProps: Record<string, unknown> | null = null;
vi.mock('./AvailabilityGrid', () => ({
  AvailabilityGrid: (props: Record<string, unknown>) => {
    mockAvailabilityGridProps = props;
    return <div data-testid="availability-grid-stub" />;
  },
}));

let mockCreateSessionModalProps: Record<string, unknown> | null = null;
vi.mock('./CreateSessionModal', () => ({
  CreateSessionModal: (props: Record<string, unknown>) => {
    mockCreateSessionModalProps = props;
    return <div data-testid="create-session-modal-stub" />;
  },
}));

// R-P0-12: the heatmap must keep receiving EVERY occurrence while the list
// collapses a series. A pass-through wrapper records the props and still
// renders the real heatmap, so the tests that query its cells are unaffected.
let mockHeatmapProps: { sessions: Array<{ session: { id: string }; occursAt: string }> } | null = null;
vi.mock('./AvailabilityHeatmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AvailabilityHeatmap')>();
  return {
    AvailabilityHeatmap: (props: Parameters<typeof actual.AvailabilityHeatmap>[0]) => {
      mockHeatmapProps = props;
      return <actual.AvailabilityHeatmap {...props} />;
    },
  };
});

import { Schedule } from './Schedule';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useAuthStore } from '../../stores/authStore';
import { utcSlotToLocal, formatTimeLabel } from './availabilityUtils';
import { buildDiscordDeliverySummary } from './discordDeliverySummary';
import type { ScheduleSession, ScheduleSessionCreate, ScheduleSettings, StaticGroup } from '../../types';

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
  // Prop-capture stubs are module-level `let`s assigned by the mocked
  // components; without a reset a later test could read a previous test's
  // captured props if its own render never re-mounts that stub.
  mockAvailabilityGridProps = null;
  mockCreateSessionModalProps = null;
  mockHeatmapProps = null;

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
    fetchSettings: vi.fn(async () => {}),
    submitRsvp: vi.fn(async () => {}), createSession: vi.fn(async () => {}),
    updateSession: vi.fn(async () => {}), deleteSession: vi.fn(async () => {}),
    createException: vi.fn(async () => ({}) as never),
  } as never);
  useAvailabilityStore.setState({ data: [], layeredData: [], fetchAvailability: vi.fn() } as never);
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
    const [gid, startDate, endDate, options] = availabilityMock().mock.calls[0];
    expect(gid).toBe('g1');
    // Padded UTC range around week 2's dates (2026-06-30 … 07-06).
    expect(startDate < '2026-06-30').toBe(true);
    expect(endDate > '2026-07-06').toBe(true);
    expect(options).toEqual({ includeTemplates: true });
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

  // Regression pin for the deep-link-before-exceptions defect (Bugbot finding):
  // on the FIRST pass of the resolving effect, `cancelledBySession` has no entry
  // for a recurring target yet (fetchExceptions is still in flight), so
  // computeNextOccurrence would treat every occurrence as non-cancelled. Without
  // the exceptions-wait gate, the effect marks `handledRef` and permanently
  // scopes to 07-01's week (week 2) even though 07-01 is actually cancelled —
  // the real next occurrence is 07-08 (week 3). This test fails against the
  // ungated code (reverting the `!cancelledBySession.has(...)` gate makes the
  // scoped week lock to week 2 / "Jul 1", never reaching week 3 / "Jul 8").
  it('waits for exceptions before resolving a recurring deep link, landing on the first NON-cancelled occurrence instead of the cancelled one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T00:00:00Z'));
    useScheduleStore.setState({
      sessions: [sRec],
      fetchExceptions: vi.fn(async (_groupId: string, sessionId: string) =>
        sessionId === 'sRec'
          ? [
              {
                id: 'ex1', sessionId: 'sRec', occurrenceDate: '2026-07-01', type: 'cancelled',
                overrideStartTime: null, overrideEndTime: null, overrideTitle: null,
                overrideDescription: null, overrideBannerUrl: null, overrideBannerKey: null,
                cancellationReason: null, createdById: 'u1', createdAt: '',
              },
            ]
          : [],
      ),
    } as never);

    renderSchedule({}, ['/?sessionId=sRec']);
    // Flush the fetchExceptions microtasks so the cancellation lands. `waitFor`
    // polls via real timers, which never fire under `vi.useFakeTimers()`, so
    // assert directly once the microtask queue (the Promise.all resolution) drains.
    await act(async () => {});

    expect(screen.getByTestId('session-daytime').textContent).toMatch(/Jul 8/);
    expect(screen.getByTestId('session-daytime').textContent).not.toMatch(/Jul 1/);
  });

  it('R-P0-12: the list shows one card for a Tue/Fri series while the heatmap still receives both occurrences', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z')); // Wed of week 2 (Tue Jun 30 … Mon Jul 6)
    const sTueFri = makeSession({
      id: 'sTF', title: 'Tue Fri Series', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,FR',
      startTime: '2026-06-23T20:00:00Z', endTime: '2026-06-23T22:00:00Z',
    });
    useScheduleStore.setState({ sessions: [sTueFri] } as never);
    renderSchedule();
    await waitFor(() => expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalledWith('g1', 'sTF'));

    expect(screen.getAllByTestId('session-daytime')).toHaveLength(1);
    expect(screen.getByTestId('session-daytime').textContent).toMatch(/Jul 3/);
    expect(mockHeatmapProps?.sessions.map((o) => o.occursAt)).toEqual([
      '2026-06-30T20:00:00.000Z',
      '2026-07-03T20:00:00.000Z',
    ]);
  });

  it('hides RSVP controls from viewers and submits an RSVP for members', () => {
    // s2 (Jul 1) must still be upcoming: an ended session hides RSVP (R-P0-12).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-25T00:00:00Z'));
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

  describe('a failed RSVP (#324)', () => {
    function rejectRsvpWith(err: unknown) {
      // s2 (Jul 1) must still be upcoming: an ended session hides RSVP (R-P0-12).
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-06-25T00:00:00Z'));
      const submitRsvp = vi.fn().mockRejectedValue(err);
      useScheduleStore.setState({ submitRsvp } as never);
      const toastError = vi.spyOn(toast, 'error').mockReturnValue('toast-id');
      renderSchedule();
      fireEvent.click(screen.getByText("I'm in"));
      return { submitRsvp, toastError };
    }

    it('toasts once when submitRsvp rejects with a plain Error', async () => {
      const { toastError } = rejectRsvpWith(new Error('boom'));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to save RSVP'));
      expect(toastError).toHaveBeenCalledTimes(1);
      toastError.mockRestore();
    });

    it('does not toast again when the API client already toasted the error', async () => {
      const { submitRsvp, toastError } = rejectRsvpWith(
        new ApiError(403, 'Only leads can do that', true),
      );
      await waitFor(() => expect(submitRsvp).toHaveBeenCalledTimes(1));
      // Let the handler's catch run before asserting the absence.
      await act(async () => {});
      expect(toastError).not.toHaveBeenCalled();
      toastError.mockRestore();
    });
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

  it("shows the pipe's 'Your availability' copy", () => {
    renderSchedule();
    expect(
      screen.getByText("Your typical week lives on your profile and fills this schedule for any week you haven't painted."),
    ).toBeInTheDocument();
  });

  // R-PH3-F: the heatmap and Best Times must derive from `layeredData`, never
  // `data`. `data` is seeded with a CONFLICTING fixture (a UTC slot the pipe
  // never emitted, and too few slots to ever form a 2h recommendation) so a
  // regression that reads `data` instead renders the all-zero/empty-state copy.
  it('derives the heatmap and Best Times from layeredData, not the conflicting data fixture', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T00:00:00Z'));
    useAvailabilityStore.setState({
      data: [
        {
          date: '2026-07-01',
          responses: [{ id: 'd1', userId: 'u1', username: 'Alice', date: '2026-07-01', slots: ['12:00', '12:30'], source: 'dated' }],
        },
      ],
      layeredData: [
        {
          date: '2026-07-01',
          responses: [
            {
              id: null,
              userId: 'u1',
              username: 'Alice',
              date: '2026-07-01',
              slots: ['22:00', '22:30', '23:00', '23:30'],
              source: 'personal_template',
            },
          ],
        },
      ],
    } as never);

    renderSchedule();
    await act(async () => {});

    expect(
      screen.getByText(/Aggregated from each member's availability/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No availability marked yet/)).not.toBeInTheDocument();
    // The heatmap cell itself: only layeredData's 22:00/23:00 UTC slots can
    // ever produce a "1 of 1 free — Alice" cell here — the conflicting `data`
    // fixture's noon slot falls outside the prime-hour window (18:00–02:00,
    // scheduleWeek.ts PRIME_HOURS) and can never surface a cell at all. Labels
    // are derived through the same UTC→local conversion the component uses,
    // but PRIME_HOURS is local, so the cell only renders from UTC−5 to UTC+3;
    // vitest.config.ts pins TZ=UTC so every host runs it the way CI does.
    const heatmapHourLabels = ['22:00', '23:00'].map((utcTime) =>
      formatTimeLabel(utcSlotToLocal('2026-07-01', utcTime).localTime),
    );
    expect(
      screen.getAllByLabelText(new RegExp(`(${heatmapHourLabels.join('|')}) — 1 of 1 free — Alice`)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.queryByText('Not enough availability data yet.')).not.toBeInTheDocument();
  });

  // Task 10 (§5.1 stopgap): the only availability EDITOR reachable from v2 is
  // the legacy AvailabilityGrid, hosted in a modal off the heatmap's Edit-week
  // affordance (H-10: the pipe fills the schedule but does not replace this
  // exceptions editor).
  describe('availability edit modal (Task 10 stopgap)', () => {
    it("opens via the heatmap's Edit week affordance, mounting AvailabilityGrid with legacy-mirrored props", async () => {
      renderSchedule();
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalled());

      expect(screen.queryByTestId('availability-grid-stub')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Edit week' }));

      expect(screen.getByTestId('availability-grid-stub')).toBeInTheDocument();
      expect(mockAvailabilityGridProps).toMatchObject({
        groupId: 'g1',
        canSubmit: true, // canRsvp mirrored (owner, non-viewer)
        canCreateSession: true, // canManage
        staticName: 'Test Static',
        shareCode: 'DEVTST',
      });
      expect(mockAvailabilityGridProps?.sessions).toEqual([s2, s3]);
      expect(mockAvailabilityGridProps?.members).toEqual(group.members);
      expect(typeof mockAvailabilityGridProps?.onCreateSessionDraft).toBe('function');
    });

    it('hides the Edit week affordance for viewers (canRsvp=false)', async () => {
      const viewerGroup = { ...group, userRole: 'viewer' } as unknown as StaticGroup;
      render(
        <MemoryRouter>
          <Schedule group={viewerGroup} tier={null} canManage={false} currentUserId="u1" />
        </MemoryRouter>,
      );
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: 'Edit week' })).not.toBeInTheDocument();
    });

    it('re-fires the scoped-week availability fetch when the modal closes', async () => {
      renderSchedule();
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(1));
      const [, firstStart, firstEnd] = availabilityMock().mock.calls[0];

      fireEvent.click(screen.getByRole('button', { name: 'Edit week' }));
      expect(screen.getByTestId('availability-grid-stub')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close modal'));

      expect(screen.queryByTestId('availability-grid-stub')).not.toBeInTheDocument();
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(2));
      const [gid, secondStart, secondEnd, secondOptions] = availabilityMock().mock.calls[1];
      expect(gid).toBe('g1');
      expect(secondStart).toBe(firstStart);
      expect(secondEnd).toBe(firstEnd);
      expect(secondOptions).toEqual({ includeTemplates: true });
    });

    it("the grid's draft callback re-fetches scoped-week availability, then closes the edit modal and opens the create modal with the draft", async () => {
      renderSchedule();
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(1));
      const [, firstStart, firstEnd] = availabilityMock().mock.calls[0];

      fireEvent.click(screen.getByRole('button', { name: 'Edit week' }));
      expect(screen.getByTestId('availability-grid-stub')).toBeInTheDocument();
      expect(screen.queryByTestId('create-session-modal-stub')).not.toBeInTheDocument();

      const draft: ScheduleSessionCreate = {
        title: 'Recommended Raid Night',
        startTime: '2026-07-01T20:00:00Z',
        endTime: '2026-07-01T22:00:00Z',
        timezone: 'UTC',
        isRecurring: false,
      };
      const onCreateSessionDraft = mockAvailabilityGridProps?.onCreateSessionDraft as (
        d: ScheduleSessionCreate,
      ) => void;
      act(() => onCreateSessionDraft(draft));

      expect(screen.queryByTestId('availability-grid-stub')).not.toBeInTheDocument();
      expect(screen.getByTestId('create-session-modal-stub')).toBeInTheDocument();
      expect(mockCreateSessionModalProps?.initialDraft).toEqual(draft);

      // Regression pin: AvailabilityGrid fetches its OWN rolling window
      // (today→+6d) into the shared store on mount, wholesale-replacing
      // `data`. If the draft path only closes the modal (no re-fetch), the
      // store is left holding that rolling-window data instead of the
      // scoped week's — the heatmap + BestTimesCard would silently derive
      // from the wrong range until something else re-fetches. Must re-fire
      // the SAME scoped range the plain-close path re-fetches.
      await waitFor(() => expect(availabilityMock()).toHaveBeenCalledTimes(2));
      const [gid, secondStart, secondEnd] = availabilityMock().mock.calls[1];
      expect(gid).toBe('g1');
      expect(secondStart).toBe(firstStart);
      expect(secondEnd).toBe(firstEnd);
    });
  });

  // #39 (v2 half): the delete chain at Schedule.tsx:354-383 (deleteChoice,
  // handleCancelOccurrence) and :505-527 (the modal) had no test.
  describe('delete flow (#39)', () => {
    function openSessionActions() {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Session actions' }), { key: 'Enter' });
    }

    it('T4-d1: recurring delete → "Delete recurring session" → "Cancel just this occurrence" calls the cancel path and closes the modal', async () => {
      useScheduleStore.setState({ sessions: [sRec] } as never);
      renderSchedule();
      await waitFor(() => expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalled());

      openSessionActions();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByText('Delete recurring session')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel just this occurrence' }));

      await waitFor(() => expect(useScheduleStore.getState().createException).toHaveBeenCalledWith(
        'g1',
        'sRec',
        { occurrenceDate: '2026-07-01', type: 'cancelled' },
      ));
      // The modal closes in `handleCancelOccurrence`'s `finally`, after the
      // awaited `createException` settles — wait for it rather than racing it
      // (flaked under full-suite load on #280).
      await waitFor(() => expect(screen.queryByText('Delete recurring session')).not.toBeInTheDocument());
    });

    it('T4-d2: recurring delete → "Delete entire series" → ConfirmModal → the delete is called', async () => {
      useScheduleStore.setState({ sessions: [sRec] } as never);
      renderSchedule();
      await waitFor(() => expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalled());

      openSessionActions();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByText('Delete recurring session')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete entire series' }));
      expect(screen.queryByText('Delete recurring session')).not.toBeInTheDocument();
      expect(screen.getByText('Delete session')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(useScheduleStore.getState().deleteSession).toHaveBeenCalledWith('g1', 'sRec'));
    });
  });

  // W0 DEL-1 R-D1-6: the V2 session modal shows V1's Discord Delivery block,
  // built from THIS static's settings only.
  describe('Discord Delivery summary (W0 DEL-1)', () => {
    const ownSettings: ScheduleSettings = {
      staticGroupId: 'g1',
      webhookConfigured: true,
      mentionTarget: 'here',
      enable24hReminder: true,
      enable1hReminder: false,
      enableMissingRsvpReminder: false,
      calendarEnabled: false,
      canManage: true,
      discordLinkStatus: 'connected',
      discordGuildName: 'Raid Guild',
    };
    const ownSummary = {
      serverLabel: 'Raid Guild',
      mirrorEnabled: true,
      remindersEnabled: true,
      reminderLabels: ['24 hrs before'],
      pingLabel: '@here',
    };
    const fetchSettingsMock = () => useScheduleStore.getState().fetchSettings as unknown as Mock;

    it("passes this static's summary on the create and the edit path", async () => {
      useScheduleStore.setState({ settings: ownSettings } as never);
      renderSchedule();

      fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
      expect(screen.getByTestId('create-session-modal-stub')).toBeInTheDocument();
      expect(mockCreateSessionModalProps?.editSession).toBeNull();
      expect(mockCreateSessionModalProps?.discordDeliverySummary).toStrictEqual(buildDiscordDeliverySummary(ownSettings));
      expect(mockCreateSessionModalProps?.discordDeliverySummary).toStrictEqual(ownSummary);

      act(() => (mockCreateSessionModalProps?.onClose as () => void)());
      expect(screen.queryByTestId('create-session-modal-stub')).not.toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Session actions' }), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
      expect(screen.getByTestId('create-session-modal-stub')).toBeInTheDocument();
      // editSession is null on the create path, so s2 proves this is the edit mount.
      expect(mockCreateSessionModalProps?.editSession).toEqual(s2);
      expect(mockCreateSessionModalProps?.discordDeliverySummary).toStrictEqual(ownSummary);

      // This static's settings are already loaded: no refetch.
      expect(fetchSettingsMock()).not.toHaveBeenCalled();
    });

    it("passes no summary while the store holds another static's settings, and fetches this static's once", async () => {
      useScheduleStore.setState({ settings: { ...ownSettings, staticGroupId: 'g-other' } } as never);
      renderSchedule();

      fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
      expect(screen.getByTestId('create-session-modal-stub')).toBeInTheDocument();
      expect(mockCreateSessionModalProps).not.toBeNull();
      expect(mockCreateSessionModalProps?.discordDeliverySummary).toBeUndefined();

      await act(async () => {});
      expect(fetchSettingsMock()).toHaveBeenCalledTimes(1);
      expect(fetchSettingsMock()).toHaveBeenCalledWith('g1');
    });

    it("shows the summary once this static's settings land, without fetching again", async () => {
      const fetchSettings = vi.fn(async (groupId: string) => {
        await Promise.resolve();
        useScheduleStore.setState({ settings: { ...ownSettings, staticGroupId: groupId } } as never);
      });
      useScheduleStore.setState({ settings: null, fetchSettings } as never);
      renderSchedule();

      fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
      await waitFor(() => expect(mockCreateSessionModalProps?.discordDeliverySummary).toStrictEqual(ownSummary));
      await act(async () => {});
      expect(fetchSettings).toHaveBeenCalledTimes(1);
      expect(fetchSettings).toHaveBeenCalledWith('g1');
    });

    it.each(['member', 'viewer'] as const)('(pin) a %s who cannot manage never fetches the settings', async (role) => {
      const roleGroup = { ...group, userRole: role } as unknown as StaticGroup;
      render(
        <MemoryRouter>
          <Schedule group={roleGroup} tier={null} canManage={false} currentUserId="u1" />
        </MemoryRouter>,
      );
      await act(async () => {});
      expect(useScheduleStore.getState().settings).toBeNull();
      expect(fetchSettingsMock()).not.toHaveBeenCalled();
    });
  });
});

// GUEST-1 R-G1-7: Schedule is members-only. A non-member (guest or signed-in)
// gets ONE card and no member-only request. The schedule store is shell-shared
// and never cleared (Schedule.tsx), so every test seeds a stale recurring
// session first: without it the exceptions effect returns early on zero
// recurring ids and the `fetchExceptions` assertion would pass trivially.
describe('Schedule — members only (R-G1-7)', () => {
  const nonMember = { ...group, userRole: null } as unknown as StaticGroup;
  const loginMock = vi.fn();

  beforeEach(() => {
    loginMock.mockReset();
    useScheduleStore.setState({ sessions: [sRec] } as never);
    useAuthStore.setState({ user: null, isLoading: false, authInitialized: true, login: loginMock } as never);
  });

  function renderAsNonMember(currentUserId: string | null) {
    return render(
      <MemoryRouter initialEntries={['/group/DEVTST?tab=schedule']}>
        <Schedule group={nonMember} tier={null} canManage={false} currentUserId={currentUserId} />
      </MemoryRouter>,
    );
  }

  function expectNoMemberOnlyRequests() {
    expect(useScheduleStore.getState().fetchSessions).not.toHaveBeenCalled();
    expect(availabilityMock()).not.toHaveBeenCalled();
    expect(useScheduleStore.getState().fetchExceptions).not.toHaveBeenCalled();
    expect(useScheduleStore.getState().fetchSettings).not.toHaveBeenCalled();
  }

  it('a guest gets one members-only card, a Login with Discord action, and no requests', async () => {
    renderAsNonMember(null);
    await act(async () => {});

    expectNoMemberOnlyRequests();
    expect(screen.getByTestId('schedule-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    // CI twin of smoke test 10's strict-mode locator: exactly one "schedule" heading.
    expect(screen.getAllByRole('heading', { name: /schedule/i })).toHaveLength(1);
    expect(
      within(screen.getByTestId('members-only-card')).getByRole('button', { name: 'Login with Discord' }),
    ).toBeInTheDocument();
    expect(screen.getByText(
      'Sessions and availability are shared with members of ' + group.name + '. Log in to ask to join.',
    )).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add session' })).toBeNull();
    expect(screen.queryByText('Your availability')).toBeNull();
    // The heatmap never mounts (its prop-capturing wrapper never ran).
    expect(mockHeatmapProps).toBeNull();
  });

  it('stepping the clock does not fire a member-only request either', async () => {
    renderAsNonMember(null);
    await act(async () => {});
    act(() => {
      useLootTrackingStore.setState({ currentWeek: 3, maxWeek: 3 } as never);
    });
    await act(async () => {});
    expectNoMemberOnlyRequests();
  });

  it('the guest action logs in and returns to this path + search', () => {
    renderAsNonMember(null);
    fireEvent.click(
      within(screen.getByTestId('members-only-card')).getByRole('button', { name: 'Login with Discord' }),
    );
    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(loginMock).toHaveBeenCalledWith('/group/DEVTST?tab=schedule');
  });

  it('a signed-in non-member gets the same card with no action and no requests', async () => {
    useAuthStore.setState({ user: { id: 'u9' } } as never);
    renderAsNonMember('u9');
    await act(async () => {});

    expectNoMemberOnlyRequests();
    expect(screen.getByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /schedule/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /login/i })).toBeNull();
  });

  it('(pin) a viewer still fetches sessions and availability', async () => {
    const viewer = { ...group, userRole: 'viewer' } as unknown as StaticGroup;
    render(
      <MemoryRouter>
        <Schedule group={viewer} tier={null} canManage={false} currentUserId="u1" />
      </MemoryRouter>,
    );
    expect(useScheduleStore.getState().fetchSessions).toHaveBeenCalledWith('g1');
    await waitFor(() => expect(availabilityMock()).toHaveBeenCalled());
    await waitFor(() => expect(useScheduleStore.getState().fetchExceptions).toHaveBeenCalledWith('g1', 'sRec'));
    expect(screen.queryByRole('heading', { name: 'Members only' })).toBeNull();
  });
});
