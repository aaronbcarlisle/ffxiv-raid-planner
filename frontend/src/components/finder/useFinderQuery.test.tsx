/**
 * useFinderQuery — the Static Finder's URL ↔ state ↔ request loop (R-SF-O).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useFinderQuery } from './useFinderQuery';
import type { UseFinderQueryResult } from './useFinderQuery';
import type { FinderResponse } from './types';

const mockAuthRequest = vi.fn();
vi.mock('../../services/api', () => ({
  authRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const authState: { user: Record<string, unknown> | null } = { user: null };
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector?: (s: typeof authState) => unknown) =>
    (selector ? selector(authState) : authState),
}));

vi.mock('../../utils/timezone', () => ({
  getBrowserTimezone: () => 'Australia/Sydney',
}));

function baseResponse(overrides: Partial<FinderResponse> = {}): FinderResponse {
  return { items: [], total: 0, fitCounts: null, viewer: null, ...overrides };
}

let latest: UseFinderQueryResult;

function Harness() {
  const result = useFinderQuery();
  // Capture the hook's return in an effect (a side effect), not during render.
  useEffect(() => { latest = result; });
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderHarness(initialPath = '/discover') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Harness />
    </MemoryRouter>,
  );
}

const search = () => screen.getByTestId('search').textContent ?? '';
const lastRequestParams = () => {
  const url = mockAuthRequest.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split('?')[1] ?? '');
};

beforeEach(() => {
  mockAuthRequest.mockReset();
  mockAuthRequest.mockResolvedValue(baseResponse());
  authState.user = { id: 'u1' };
});

describe('useFinderQuery', () => {
  it('(a) first load, signed in: fitV2=true, sort=best, viewerTz=Australia/Sydney; neither sort nor viewerTz land in the URL', async () => {
    renderHarness();
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    const params = lastRequestParams();
    expect(params.get('fitV2')).toBe('true');
    expect(params.get('sort')).toBe('best');
    expect(params.get('viewerTz')).toBe('Australia/Sydney');
    expect(search()).not.toMatch(/(?:^|[?&])sort=/);
    expect(search()).not.toMatch(/viewerTz=/);
  });

  it('(b) URL filters carry through to the request', async () => {
    renderHarness('/discover?asRole=tank&dayGroup=weekends&goalCategory=savage_bis,ultimate_clear&scheduleOverlap=true');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    const params = lastRequestParams();
    expect(params.get('asRole')).toBe('tank');
    expect(params.get('dayGroup')).toBe('weekends');
    expect(params.get('goalCategory')).toBe('savage_bis,ultimate_clear');
    expect(params.get('scheduleOverlap')).toBe('true');
  });

  it('(c) setting a data center clears the server', async () => {
    renderHarness();
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    act(() => { latest.setters.setServer('Cactuar'); });
    expect(latest.state.server).toBe('Cactuar');
    act(() => { latest.setters.setDataCenter('Aether'); });
    expect(latest.state.dataCenter).toBe('Aether');
    expect(latest.state.server).toBe('');
  });

  it('(d) two requests resolving out of order: state holds the later one', async () => {
    let resolveFirst!: (v: FinderResponse) => void;
    let resolveSecond!: (v: FinderResponse) => void;
    mockAuthRequest
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockImplementationOnce(() => new Promise((res) => { resolveSecond = res; }));
    renderHarness();
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    act(() => { latest.setters.setJob('WAR'); });
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(2));

    // Resolve the newer (second) request first, then the stale first one.
    await act(async () => { resolveSecond(baseResponse({ total: 2 })); });
    await act(async () => { resolveFirst(baseResponse({ total: 1 })); });

    expect(latest.total).toBe(2);
  });

  it('(e) clearFilters empties the URL except sort', async () => {
    renderHarness('/discover?job=WAR&sort=members');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    expect(search()).toContain('sort=members');
    expect(search()).toContain('job=WAR');
    act(() => { latest.clearFilters(); });
    await waitFor(() => expect(search()).not.toContain('job='));
    expect(search()).toContain('sort=members');
  });

  it("(f) an error sets error; retry refetches", async () => {
    mockAuthRequest.mockReset();
    mockAuthRequest.mockRejectedValueOnce(new Error('boom'));
    renderHarness();
    await waitFor(() => expect(latest.error).toBe('boom'));

    mockAuthRequest.mockResolvedValueOnce(baseResponse({ total: 3 }));
    act(() => { latest.retry(); });
    await waitFor(() => expect(latest.total).toBe(3));
    expect(latest.error).toBeNull();
  });

  it('(g) a V1 link is read as the new keys, and the URL is rewritten', async () => {
    renderHarness('/discover?role=tank&hideConflicts=true');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    const params = lastRequestParams();
    expect(params.get('asRole')).toBe('tank');
    expect(params.get('hideGoalConflicts')).toBe('true');
    await waitFor(() => {
      expect(search()).toContain('asRole=tank');
      expect(search()).toContain('hideGoalConflicts=true');
    });
    expect(search()).not.toMatch(/(?:^|[?&])role=/);
    expect(search()).not.toContain('hideConflicts=');
  });

  it('(h) values outside the allowed set are dropped, and sort falls back to the default', async () => {
    renderHarness('/discover?asRole=dps&dayGroup=never&sort=oldest');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    const params = lastRequestParams();
    expect(params.has('asRole')).toBe(false);
    expect(params.has('dayGroup')).toBe(false);
    expect(params.get('sort')).toBe('best');
    expect(latest.error).toBeNull();
  });

  it("(i) viewer.missing including 'template': the next request omits scheduleOverlap, the URL keeps it", async () => {
    mockAuthRequest.mockResolvedValueOnce(
      baseResponse({ viewer: { mainJob: null, mainRole: null, missing: ['template'] } }),
    );
    renderHarness('/discover?scheduleOverlap=true');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    expect(lastRequestParams().get('scheduleOverlap')).toBe('true');

    mockAuthRequest.mockResolvedValueOnce(baseResponse());
    act(() => { latest.setters.setJob('WAR'); });
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(2));
    expect(lastRequestParams().has('scheduleOverlap')).toBe(false);
    expect(search()).toContain('scheduleOverlap=true');
  });

  it('(j) a guest defaults to sort=recent, with no sort in the URL', async () => {
    authState.user = null;
    renderHarness();
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    expect(lastRequestParams().get('sort')).toBe('recent');
    expect(search()).not.toMatch(/(?:^|[?&])sort=/);
  });

  it('moreFiltersInitiallyOpen is true when a More-filters key is in the URL (m8)', async () => {
    renderHarness('/discover?server=Tonberry');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    expect(latest.moreFiltersInitiallyOpen).toBe(true);
  });

  it('(k) ?q=zzz alone sets hasFilters, and clearFilters empties it (whole-branch review item 1)', async () => {
    renderHarness('/discover?q=zzz');
    await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.hasFilters).toBe(true));
    act(() => { latest.clearFilters(); });
    await waitFor(() => expect(latest.hasFilters).toBe(false));
  });

  it('(l) an auth flip re-derives an un-set sort (whole-branch review item 7)', async () => {
    authState.user = null;
    const { rerender } = renderHarness();
    await waitFor(() => expect(latest.state.sort).toBe('recent'));

    authState.user = { id: 'u1' };
    rerender(
      <MemoryRouter initialEntries={['/discover']}>
        <Harness />
      </MemoryRouter>,
    );
    await waitFor(() => expect(latest.state.sort).toBe('best'));
  });

  it('(m) an explicit sort pick survives an auth flip', async () => {
    const { rerender } = renderHarness();
    await waitFor(() => expect(latest.state.sort).toBe('best'));
    act(() => { latest.setters.setSort('name'); });
    expect(latest.state.sort).toBe('name');

    authState.user = null;
    rerender(
      <MemoryRouter initialEntries={['/discover']}>
        <Harness />
      </MemoryRouter>,
    );
    expect(latest.state.sort).toBe('name');
  });
});
