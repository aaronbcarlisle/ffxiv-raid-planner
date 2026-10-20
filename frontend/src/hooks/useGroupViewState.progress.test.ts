/**
 * useGroupViewState — the Progress tab's URLs (S2a-2·F1 TF2, R-S2-3).
 *
 * `progress`, `goals`, `mount-farms` and `collections` all resolve to the
 * `goals` mode. V2 writes `?tab=progress` for it (setPageMode and the
 * first-render reflect); tab memory keeps `goals`. The legacy shell still
 * writes `tab=goals`, and opens Goals & Farms for `?tab=progress` (V1 delta (d)).
 *
 * The hook runs for real under a MemoryRouter at `/group/:shareCode`; the shell
 * resolves from `?shell=` or the stored preference, as in the app. New cases
 * live here so `useGroupViewState.test.ts` stays unedited (R-S2-2, vet M-2).
 */
import { createElement, useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The D-9 jump renders Progress as a guest, which makes no request; any stray one resolves empty.
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { pageModeFromTabParam, tabParamFor, useGroupViewState } from './useGroupViewState';
import { stubCanHover, TooltipWrapper } from '../components/progress/__fixtures__/tooltipEnv';
import { ProgressPage } from '../components/progress/ProgressPage';
import { useShellPreferenceStore } from '../lib/shellPreference';
import { useAuthStore } from '../stores/authStore';
import type { StaticGroup, TierSnapshot, User } from '../types';

const TAB_KEY = 'group-view-tab:ABC';

function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(Routes, null, createElement(Route, { path: '/group/:shareCode', element: children })),
    );
  return renderHook(
    () => ({ gv: useGroupViewState(), location: useLocation(), navigate: useNavigate() }),
    { wrapper },
  );
}

type Rendered = ReturnType<typeof renderAt>;
const tabOf = (r: Rendered) => new URLSearchParams(r.result.current.location.search).get('tab');
const trackOf = (r: Rendered) => new URLSearchParams(r.result.current.location.search).get('track');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useShellPreferenceStore.setState({ preference: null, sessionOverride: null });
  useAuthStore.setState({ user: null });
  // setPageMode resets the scroll position; jsdom does not implement scrollTo.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

describe('pageModeFromTabParam — the Progress aliases', () => {
  it.each(['progress', 'goals', 'mount-farms', 'collections'])('maps ?tab=%s -> goals', (param) => {
    expect(pageModeFromTabParam(param)).toBe('goals');
  });
});

describe('tabParamFor', () => {
  it('names goals "progress" in V2 only, and every other mode as itself', () => {
    expect(tabParamFor('goals', 'v2')).toBe('progress');
    expect(tabParamFor('goals', 'legacy')).toBe('goals');
    expect(tabParamFor('roster', 'v2')).toBe('roster');
    expect(tabParamFor('gear', 'v2')).toBe('gear');
  });
});

describe('useGroupViewState under ?shell=v2', () => {
  it('setPageMode("goals") writes tab=progress and remembers goals', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=roster');
    expect(r.result.current.gv.pageMode).toBe('roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
    expect(localStorage.getItem(TAB_KEY)).toBe('goals');
  });

  it('setPageMode("roster") still writes tab=roster', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(r.result.current.gv.pageMode).toBe('roster');
    expect(tabOf(r)).toBe('roster');
  });

  it('a recalled goals opens goals, and the first-render reflect writes tab=progress', () => {
    localStorage.setItem(TAB_KEY, 'goals');
    const r = renderAt('/group/ABC?shell=v2');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
  });

  it('the stored V2 preference (no ?shell=) writes tab=progress too', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    const r = renderAt('/group/ABC?tab=roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(tabOf(r)).toBe('progress');
  });

  it('?tab=progress opens goals and is left as written', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
  });

  it('browser back to a tab=progress entry returns to goals', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(r.result.current.gv.pageMode).toBe('roster');
    act(() => { void r.result.current.navigate(-1); });
    expect(tabOf(r)).toBe('progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
  });
});

// S2a-3a·G2 (R-S3-3, vet I-7): the open farm row's `?track` is a sub-tab param. The default tab
// memory keeps it across a primary-tab switch, so Progress reopens the row; 'reset' clears it.
describe('useGroupViewState and ?track', () => {
  it('keeps ?track across a tab switch under the default tab memory, so coming back reopens the row', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress&track=goal-1');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(tabOf(r)).toBe('roster');
    expect(trackOf(r)).toBe('goal-1');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(tabOf(r)).toBe('progress');
    expect(trackOf(r)).toBe('goal-1');
  });

  it('removes ?track on a tab switch under the reset tab memory, so Progress comes back closed', () => {
    useAuthStore.setState({ user: { tabPersistence: 'reset' } as unknown as User });
    const r = renderAt('/group/ABC?shell=v2&tab=progress&track=goal-1');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(tabOf(r)).toBe('roster');
    expect(trackOf(r)).toBeNull();
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(tabOf(r)).toBe('progress');
    expect(trackOf(r)).toBeNull();
  });
});

// S2a-3b·H3b (D-9, E-9, R-T-9): the tier cell's jump, through the real hook. NewShell hands
// Progress `gv.setPageMode` as `onNavigate` (`pages/NewShell.tsx`), so an Alt+Click on a tier cell
// writes `tab=roster&rview=board&player=<id>`. GroupViewContent's `?player=` effect then calls
// `setPageMode('roster')` once more (`pages/GroupViewContent.tsx`, the deep-link effect); that
// second call is made by hand below. Under 'reset' tab memory it clears `rview`, so the jump lands
// on Cards (where `?player=` highlights the card, pinned in Roster.test.tsx): D-9's named residual,
// pinned here, not hidden. Under the default memory it lands on the Board.
describe('the Progress tier jump through useGroupViewState (D-9)', () => {
  const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'ABC', settings: {}, userRole: null, members: [] } as unknown as StaticGroup;
  const tier = {
    id: 't1', staticGroupId: 'g1', tierId: 'aac-cruiserweight', isActive: true,
    players: [{ id: 'p1', name: 'Aya', job: 'WAR', role: 'tank', position: 'T1', configured: true, isSubstitute: false, sortOrder: 0, userId: 'u1', gear: [] }],
  } as unknown as TierSnapshot;

  function renderJumpAt(url: string) {
    const latest: { gv: ReturnType<typeof useGroupViewState> | null; search: string } = { gv: null, search: '' };
    function Page() {
      const gv = useGroupViewState();
      const { search } = useLocation();
      useEffect(() => {
        latest.gv = gv;
        latest.search = search;
      });
      // A guest's Progress: it makes no request (D-11), and still gets the jump.
      return createElement(ProgressPage, {
        group, tier, canManage: false, userRole: null, currentUserId: null, isViewingAs: false, onNavigate: gv.setPageMode,
      });
    }
    render(
      createElement(
        TooltipWrapper,
        null,
        createElement(
          MemoryRouter,
          { initialEntries: [url] },
          createElement(Routes, null, createElement(Route, { path: '/group/:shareCode', element: createElement(Page) })),
        ),
      ),
    );
    const params = () => new URLSearchParams(latest.search);
    const altClickAya = () => {
      const row = screen.getByTestId('progress-tier-row');
      fireEvent.click(within(row).getByRole('button', { name: /^Aya, / }), { altKey: true });
    };
    /** GroupViewContent's `?player=` effect, by hand: it switches to Roster again. */
    const deepLinkEffect = () => act(() => latest.gv!.setPageMode('roster'));
    return { params, altClickAya, deepLinkEffect };
  }

  beforeEach(() => stubCanHover());
  afterEach(() => vi.unstubAllGlobals());

  it("lands on Roster ▸ Board with ?player under the default tab memory", () => {
    const r = renderJumpAt('/group/ABC?shell=v2&tab=progress');
    r.altClickAya();
    expect(r.params().get('tab')).toBe('roster');
    expect(r.params().get('rview')).toBe('board');
    expect(r.params().get('player')).toBe('p1');
    r.deepLinkEffect();
    expect(r.params().get('tab')).toBe('roster');
    expect(r.params().get('rview')).toBe('board');
    expect(r.params().get('player')).toBe('p1');
  });

  it("lands on Roster ▸ Cards with ?player kept under the 'reset' tab memory (D-9)", () => {
    useAuthStore.setState({ user: { tabPersistence: 'reset' } as unknown as User });
    const r = renderJumpAt('/group/ABC?shell=v2&tab=progress');
    r.altClickAya();
    expect(r.params().get('tab')).toBe('roster');
    expect(r.params().get('player')).toBe('p1');
    r.deepLinkEffect();
    expect(r.params().get('tab')).toBe('roster');
    // The second switch resets the sub-tabs: no rview, so Roster opens on Cards (its default)…
    expect(r.params().get('rview')).toBeNull();
    // …with ?player kept, which Roster highlights on the card.
    expect(r.params().get('player')).toBe('p1');
  });
});

describe('useGroupViewState under the legacy shell (V1 pin)', () => {
  it('setPageMode("goals") writes tab=goals', () => {
    const r = renderAt('/group/ABC?tab=roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('goals');
  });

  it('a recalled goals reflects as tab=goals', () => {
    localStorage.setItem(TAB_KEY, 'goals');
    const r = renderAt('/group/ABC');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('goals');
  });

  it('?tab=progress opens goals (delta (d))', () => {
    const r = renderAt('/group/ABC?tab=progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
  });
});
