/**
 * StaticFinder — the V2 page frame's states, header and guest branch.
 * FinderFilters/FinderSummary/FinderCard behavior is covered in their own
 * test files; this file exercises how StaticFinder composes them.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StaticFinder } from './StaticFinder';
import type { UseFinderQueryResult } from './useFinderQuery';
import type { FinderItem } from './types';

const authState: { user: Record<string, unknown> | null } = { user: { id: 'u1' } };
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector?: (s: typeof authState) => unknown) =>
    (selector ? selector(authState) : authState),
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

beforeEach(() => {
  authState.user = { id: 'u1' };
  hookResult = baseHook();
});

describe('StaticFinder', () => {
  it('renders the header, subtitle and opt-in line', () => {
    render(<StaticFinder />);
    expect(screen.getByText('Static Finder')).toBeInTheDocument();
    expect(screen.getByText('Find a static that fits your content, schedule and role.')).toBeInTheDocument();
    expect(screen.getByText(/All listings are opt-in/)).toBeInTheDocument();
  });

  it('shows three skeletons while loading', () => {
    hookResult = baseHook({ loading: true });
    render(<StaticFinder />);
    expect(screen.getByTestId('finder-loading').children.length).toBe(3);
  });

  it('shows the error state with Retry', () => {
    const retry = vi.fn();
    hookResult = baseHook({ error: "Couldn't load statics.", retry });
    render(<StaticFinder />);
    expect(screen.getByText("Couldn't load statics.")).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows "No statics match" with Clear filters when filters are set and nothing matches', () => {
    const clearFilters = vi.fn();
    hookResult = baseHook({ items: [], total: 0, hasFilters: true, clearFilters });
    render(<StaticFinder />);
    expect(screen.getByText('No statics match')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Clear filters' }).click();
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows "No statics are recruiting yet" with no filters set', () => {
    hookResult = baseHook({ items: [], total: 0, hasFilters: false });
    render(<StaticFinder />);
    expect(screen.getByText('No statics are recruiting yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('renders a card per item and the summary', () => {
    hookResult = baseHook({ items: [item(), item({ shareCode: 'def', name: 'Savage Clears Co' })], total: 2, fitCounts: null });
    render(<StaticFinder />);
    expect(screen.getByText('Twilight Wardens')).toBeInTheDocument();
    expect(screen.getByText('Savage Clears Co')).toBeInTheDocument();
  });

  it('guest branch: plain count summary, no role chips, fit checkboxes or tier tags', () => {
    authState.user = null;
    hookResult = baseHook({
      items: [item({ fitV2: null })],
      total: 1,
      fitCounts: null,
      viewer: null,
    });
    render(<StaticFinder />);
    expect(screen.getByText('1 static')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tank' })).toBeNull();
    expect(screen.queryByText('Fits my typical week')).toBeNull();
    expect(within(screen.getByTestId('finder-card')).queryByText(/fit$/)).toBeNull();
  });
});
