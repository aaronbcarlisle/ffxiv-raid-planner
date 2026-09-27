/**
 * StaticFinder — the V2 page frame's states, header and guest branch.
 * FinderFilters/FinderSummary/FinderCard/JoinAction/LeadingStaticRow/
 * FinderNudge behavior is covered in their own test files; this file
 * exercises how StaticFinder composes them.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StaticFinder } from './StaticFinder';
import type { UseFinderQueryResult } from './useFinderQuery';
import type { FinderItem } from './types';

const authState: { user: Record<string, unknown> | null } = { user: { id: 'u1' } };
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector?: (s: typeof authState) => unknown) =>
    (selector ? selector(authState) : authState),
}));

const fetchMyRequests = vi.fn();
const joinRequestState = { myRequests: [] as unknown[], fetchMyRequests, cancelRequest: vi.fn(), createRequest: vi.fn() };
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector?: (s: typeof joinRequestState) => unknown) =>
    (selector ? selector(joinRequestState) : joinRequestState),
}));

const fetchGroups = vi.fn();
const staticGroupState = { groups: [] as unknown[], fetchGroups, createGroup: vi.fn() };
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (selector?: (s: typeof staticGroupState) => unknown) =>
    (selector ? selector(staticGroupState) : staticGroupState),
}));

const openSettings = vi.fn();
vi.mock('../../stores/settingsPanelStore', () => ({
  useSettingsPanelStore: (selector: (s: { open: () => void }) => unknown) => selector({ open: openSettings }),
}));

let hookResult: UseFinderQueryResult;
vi.mock('./useFinderQuery', () => ({
  useFinderQuery: () => hookResult,
}));

function item(overrides: Partial<FinderItem> = {}): FinderItem {
  return {
    name: 'Twilight Wardens', shareCode: 'abc', recruitmentStatus: 'open',
    description: null, contactMethod: null, contactValue: null,
    neededRoles: null, neededJobs: null, scheduleDays: null,
    scheduleStartTime: null, scheduleEndTime: null, timezone: null,
    languages: null, intensity: null, dataCenter: 'Crystal', server: 'Balmung',
    memberCount: 0, lastUpdated: null, recruitingRoles: null, communicationStyle: null,
    objectiveCategories: [], goalAlignment: null, fitSummary: null, fitV2: null,
    ...overrides,
  };
}

function baseHook(overrides: Partial<UseFinderQueryResult> = {}): UseFinderQueryResult {
  return {
    state: {
      q: '', sort: 'best', asRole: '', dayGroup: '', goalCategory: [],
      scheduleOverlap: false, hideGoalConflicts: false, job: '', recruitmentStatus: '',
      intensity: '', dataCenter: '', server: '', timezone: '', language: '',
    },
    setters: {
      setQ: vi.fn(), setSort: vi.fn(), setAsRole: vi.fn(), setDayGroup: vi.fn(),
      setGoalCategory: vi.fn(), setScheduleOverlap: vi.fn(), setHideGoalConflicts: vi.fn(),
      setJob: vi.fn(), setRecruitmentStatus: vi.fn(), setIntensity: vi.fn(),
      setDataCenter: vi.fn(), setServer: vi.fn(), setTimezone: vi.fn(), setLanguage: vi.fn(),
    },
    items: [],
    total: 0,
    fitCounts: null,
    viewer: null,
    loading: false,
    error: null,
    retry: vi.fn(),
    clearFilters: vi.fn(),
    hasFilters: false,
    moreFiltersInitiallyOpen: false,
    ...overrides,
  };
}

function renderFinder() {
  return render(<MemoryRouter><StaticFinder /></MemoryRouter>);
}

beforeEach(() => {
  authState.user = { id: 'u1' };
  hookResult = baseHook();
  fetchMyRequests.mockClear();
  fetchGroups.mockClear();
  openSettings.mockClear();
  // jsdom has no matchMedia; Modal (JoinRequestModal / SetupWizard) -> useDevice depends on it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
});

describe('StaticFinder', () => {
  it('renders the header, subtitle and opt-in line', () => {
    renderFinder();
    expect(screen.getByText('Static Finder')).toBeInTheDocument();
    expect(screen.getByText('Find a static that fits your content, schedule and role.')).toBeInTheDocument();
    expect(screen.getByText(/All listings are opt-in/)).toBeInTheDocument();
  });

  it('fetches myRequests on mount when signed in', () => {
    renderFinder();
    expect(fetchMyRequests).toHaveBeenCalledTimes(1);
  });

  it('shows three skeletons while loading', () => {
    hookResult = baseHook({ loading: true });
    renderFinder();
    expect(screen.getByTestId('finder-loading').children.length).toBe(3);
  });

  it('shows the error state with Retry', () => {
    const retry = vi.fn();
    hookResult = baseHook({ error: "Couldn't load statics.", retry });
    renderFinder();
    expect(screen.getByText("Couldn't load statics.")).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows "No statics match" with Clear filters when filters are set and nothing matches', () => {
    const clearFilters = vi.fn();
    hookResult = baseHook({ items: [], total: 0, hasFilters: true, clearFilters });
    renderFinder();
    expect(screen.getByText('No statics match')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Clear filters' }).click();
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows "No statics are recruiting yet" with no filters set', () => {
    hookResult = baseHook({ items: [], total: 0, hasFilters: false });
    renderFinder();
    expect(screen.getByText('No statics are recruiting yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('renders a card per item and the summary', () => {
    hookResult = baseHook({ items: [item(), item({ shareCode: 'def', name: 'Savage Clears Co' })], total: 2, fitCounts: null });
    renderFinder();
    expect(screen.getByText('Twilight Wardens')).toBeInTheDocument();
    expect(screen.getByText('Savage Clears Co')).toBeInTheDocument();
  });

  it('the nudge shows for a signed-in viewer missing a typical week', () => {
    hookResult = baseHook({ items: [item()], total: 1, viewer: { mainJob: 'DRG', mainRole: 'melee', missing: ['template'] } });
    renderFinder();
    expect(screen.getByText('Add your typical week on the Hub to match raid times.')).toBeInTheDocument();
  });

  it('the Leading a static row renders for a signed-in viewer', () => {
    renderFinder();
    expect(screen.getByText('Leading a static?')).toBeInTheDocument();
  });

  it('clicking Request to join on a card opens the shared JoinRequestModal with that item', () => {
    hookResult = baseHook({ items: [item({ shareCode: 'abc', name: 'Twilight Wardens' })], total: 1 });
    renderFinder();
    // The modal is absent (Modal returns null when closed) until the click.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Request to join' }));
    // `staticName` renders in a <span> inside the dialog body, not a heading
    // (the dialog's own title is fixed: "Request to Join") — and the card's
    // own <h3> already matches the name, so this must scope to the dialog.
    expect(within(screen.getByRole('dialog')).getByText('Twilight Wardens')).toBeInTheDocument();
  });

  it('guest branch: plain count summary, no role chips, fit checkboxes, tier tags, nudge or Leading row; no fetchMyRequests/fetchGroups', () => {
    authState.user = null;
    hookResult = baseHook({
      items: [item({ fitV2: null })],
      total: 1,
      fitCounts: null,
      viewer: null,
    });
    renderFinder();
    expect(screen.getByText('1 static')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tank' })).toBeNull();
    expect(screen.queryByText('Fits my typical week')).toBeNull();
    expect(within(screen.getByTestId('finder-card')).queryByText(/fit$/)).toBeNull();
    expect(screen.queryByText('Leading a static?')).toBeNull();
    expect(screen.queryByTestId('finder-nudge')).toBeNull();
    expect(fetchMyRequests).not.toHaveBeenCalled();
    expect(fetchGroups).not.toHaveBeenCalled();
  });
});
