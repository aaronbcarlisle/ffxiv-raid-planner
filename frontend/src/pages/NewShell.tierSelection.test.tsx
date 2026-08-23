/**
 * NewShell — tier-selection effect cadence (D5 carry-forward, Task 5).
 *
 * Locks that the v2 shell's tier-selection effect (`NewShell.tsx`, the
 * `fetchTiers` → resolve URL/localStorage/active → `fetchTier` +
 * `fetchCurrentWeek` + `?tier=` mirror chain) re-runs ONLY on a real group
 * change or a real `?tier=` VALUE change — never on an unrelated URL write
 * (an `lview` switch, `useLogWeek`'s `?week=` mirror — the exact writes D5's
 * grid multiplies). Pre-fix, the effect depended on raw `searchParams` +
 * `setSearchParams` object identities, both of which churn on EVERY URL
 * write (react-router 7.18's `setSearchParams` is
 * `useCallback([navigate, searchParams])`, and `searchParams` itself is
 * `useMemo` keyed on `location.search` — ANY query-string change, related or
 * not, produces a new object) — so an unrelated write refetched tiers/tier/
 * week for no reason. The fix (three legs, `NewShell.tsx`):
 *   1. `urlTierId = searchParams.get('tier')` at component level — a STRING,
 *      stable across unrelated writes (Object.is-equal across renders where
 *      the `tier` param itself didn't change).
 *   2. `setSearchParamsRef` updated in its own effect (lint-legal — this repo
 *      bans render-phase ref writes, not effect-phase ones).
 *   3. The tier effect reads `urlTierId`, writes via `setSearchParamsRef`,
 *      and GUARDS the mirror (`if (urlTierId !== activeTier.tierId)`) so a
 *      cold mount that already has the right `?tier=` doesn't re-issue a
 *      redundant, value-unchanged write.
 *
 * NOTE on the "mount WITHOUT ?tier=" baseline: it settles at fetchTiers ×2,
 * not ×1 — a cold mount with no `?tier=` param genuinely flips `urlTierId`
 * from `null` (run 1, falls back to the `isActive` tier) to a real string
 * (run 2, self-observing its OWN mirror write) — a real value transition the
 * effect's dep array must react to, same category as the disclosed
 * breadcrumb double-`fetchTier` (`groupActionsContext.tsx` `onTierChange`).
 * The guard leg's real, verified job is eliminating the WOULD-BE-REDUNDANT
 * second `setSearchParams` call on run 2 (confirmed observable via the
 * `setSearchParamsCalls` spy below) — not reducing this run count, which a
 * local A/B (temporarily removing the `if` guard) confirmed stays ×2 either
 * way. See the plan doc's Task 5 section
 * (`design/redesign/plans/2026-08-22-phase-d5-grid-chassis.md`, the ruled ×2
 * premise as of commit f43dc84b) for the full trace.
 *
 * Real `react-router-dom` (`MemoryRouter`) drives every URL change here on
 * purpose — the bug and the fix both live in real `useSearchParams`/
 * `setSearchParams` identity behavior, which a hand-rolled stub can't
 * reproduce. `useGroupViewState` is mocked (mirrors the other
 * `NewShell.*.test.tsx` suites' `newShellTestScaffold` fixture) but threads
 * ITS `searchParams`/`setSearchParams` straight from a real `useSearchParams()`
 * call, so `NewShell`'s own effect sees genuine router state. Heavy leaves
 * (`GroupViewContent`, `Home`, banners, `V2SettingsHost`, `CommandPalette`)
 * are stubbed — mirrors `NewShell.banners.test.tsx` — the unit under test is
 * the effect, not the render tree.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockTier {
  id: string;
  tierId: string;
  contentType: string;
  players: unknown[];
  isActive: boolean;
}

const TIER_M5S: MockTier = { id: 'snap-m5s', tierId: 'm5s', contentType: 'savage', players: [], isActive: true };
const TIER_M6S: MockTier = { id: 'snap-m6s', tierId: 'm6s', contentType: 'savage', players: [], isActive: false };

const mocks = vi.hoisted(() => ({
  currentGroup: { id: 'g1', name: 'Crescent', shareCode: 'DEVTST', settings: {} } as unknown | null,
  tiers: [] as MockTier[],
  currentTier: null as MockTier | null,
  fetchTiers: vi.fn(),
  fetchTier: vi.fn(),
  clearTiers: vi.fn(),
  clearTierError: vi.fn(),
  fetchGroupByShareCode: vi.fn(),
  clearGroupError: vi.fn(),
  fetchCurrentWeek: vi.fn(),
  setSearchParamsCalls: 0,
  setSearchParamsLastOptions: undefined as { replace?: boolean } | undefined,
}));

vi.mock('./GroupViewContent', () => ({
  GroupViewContent: () => <div data-testid="gvc" />,
}));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
// V2SettingsHost pulls in the full StaticSettingsHost tree — irrelevant to the
// effect under test, stubbed the way banners/slot tests stub heavy leaves.
vi.mock('./V2SettingsHost', () => ({ V2SettingsHost: () => null }));
vi.mock('../components/layout/CommandPalette', () => ({ CommandPalette: () => null }));

// useGroupViewState is mocked (its ~30-field return isn't relevant here) but
// its searchParams/setSearchParams are threaded from a REAL useSearchParams()
// call so NewShell's tier effect observes genuine router identity churn —
// the exact thing this test locks down. setSearchParams is wrapped with a
// call-count spy (NOT a fake — every call still reaches the real router) so
// the "mirror guard" leg has an observable signature distinct from the
// final URL value: a guarded vs. unguarded write can produce the SAME final
// `?tier=` string while differing in how many times setSearchParams actually
// fired — the "written exactly once" premise needs the call count, not just
// the settled value, to mean anything. The wrapper also captures the call's
// second argument (the navigate-options object) so a test can assert the
// mirror write is a `{ replace: true }` history replace, not a push.
vi.mock('../hooks/useGroupViewState', async () => {
  const { useSearchParams: realUseSearchParams } = await import('react-router-dom');
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return {
    useGroupViewState: () => {
      const [searchParams, realSetSearchParams] = realUseSearchParams();
      const setSearchParams: typeof realSetSearchParams = (...args) => {
        mocks.setSearchParamsCalls += 1;
        mocks.setSearchParamsLastOptions = args[1];
        return realSetSearchParams(...args);
      };
      return makeGroupViewStateMock({ searchParams, setSearchParams, pageMode: 'overview' });
    },
  };
});

vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      currentGroup: mocks.currentGroup,
      isLoading: false,
      error: null,
      errorStack: null,
      clearError: mocks.clearGroupError,
      fetchGroupByShareCode: mocks.fetchGroupByShareCode,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/tierStore', () => {
  const useTierStoreImpl = (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      tiers: mocks.tiers,
      isLoading: false,
      error: null,
      errorStack: null,
      currentTier: mocks.currentTier,
      fetchTiers: mocks.fetchTiers,
      fetchTier: mocks.fetchTier,
      clearTiers: mocks.clearTiers,
      clearError: mocks.clearTierError,
    };
    return selector ? selector(state) : state;
  };
  useTierStoreImpl.getState = () => ({ tiers: mocks.tiers, currentTier: mocks.currentTier });
  return {
    useTierStore: useTierStoreImpl,
    useCurrentTier: () => mocks.currentTier,
  };
});

vi.mock('../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { fetchCurrentWeek: mocks.fetchCurrentWeek };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: true,
    canManageInvitations: true,
  }),
}));

import { NewShell } from './NewShell';

beforeEach(() => {
  mocks.currentGroup = { id: 'g1', name: 'Crescent', shareCode: 'DEVTST', settings: {} };
  mocks.tiers = [];
  mocks.currentTier = null;
  mocks.fetchTiers.mockReset();
  mocks.fetchTier.mockReset();
  mocks.clearTiers.mockReset();
  mocks.clearTierError.mockReset();
  mocks.fetchGroupByShareCode.mockReset();
  mocks.clearGroupError.mockReset();
  mocks.fetchCurrentWeek.mockReset();
  mocks.setSearchParamsCalls = 0;
  mocks.setSearchParamsLastOptions = undefined;
  mocks.fetchTiers.mockImplementation(async () => {
    mocks.tiers = [TIER_M5S, TIER_M6S];
  });
  mocks.fetchTier.mockImplementation(async (_groupId: string, tierId: string) => {
    mocks.currentTier = mocks.tiers.find((t) => t.tierId === tierId) ?? null;
  });
  localStorage.clear();
});

/** Test-only sibling mounted alongside <NewShell/> under the SAME router, so
 *  clicking its buttons drives REAL location changes NewShell's own
 *  useSearchParams() call observes — "a REAL search-param change through the
 *  same router instance after settle" per the task's ambiguity resolution. */
function TestUrlDriver() {
  const [, setSearchParams] = useSearchParams();
  return (
    <div>
      <button
        type="button"
        data-testid="push-week"
        onClick={() =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('week', '3');
            return next;
          })
        }
      >
        push-week
      </button>
      <button
        type="button"
        data-testid="push-tier-m6s"
        onClick={() =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tier', 'm6s');
            return next;
          })
        }
      >
        push-tier-m6s
      </button>
    </div>
  );
}

/** MemoryRouter has no `window.location` — read the router's own location
 *  string back out through a debug node instead of the browser URL bar. */
function UrlDebug() {
  const location = useLocation();
  return <div data-testid="url-debug">{location.search}</div>;
}

function renderNewShell(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/group/:shareCode"
          element={
            <>
              <NewShell />
              <TestUrlDriver />
              <UrlDebug />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function currentSearchParams(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('url-debug').textContent ?? '');
}

describe('NewShell tier-selection effect — stable tier identity', () => {
  it('mount WITH ?tier= settles at fetchTiers x1 / fetchTier x1 / fetchCurrentWeek x1', async () => {
    renderNewShell('/group/DEVTST?tier=m5s');

    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledTimes(1));
    // Give any spurious extra effect run a chance to land before asserting the
    // exact ceiling — a >= assertion would hide a regression back to ×2.
    await new Promise((r) => setTimeout(r, 50));

    expect(mocks.fetchTiers).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTier).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTier).toHaveBeenCalledWith('g1', 'm5s');
    expect(mocks.fetchCurrentWeek).toHaveBeenCalledTimes(1);
  });

  // NOTE ON THE COUNT (verified empirically, see the plan doc's Task 5
  // section — design/redesign/plans/2026-08-22-phase-d5-grid-chassis.md,
  // the "Corrected at build" note, ruled ×2 premise as of commit f43dc84b):
  // a cold mount with NO `?tier=` genuinely transitions
  // `urlTierId` from `null` (render 1) to the resolved tierId (render 2) —
  // that IS the mirror write, and it's a real value change the effect's own
  // dep array must react to. So this settles at fetchTiers ×2 (run 1: no URL
  // tier, fall back to `isActive`; run 2: self-observes its own write, source
  // "URL", re-fetches, guard now skips the WRITE since urlTierId already
  // equals activeTier.tierId). Confirmed by A/B: temporarily removing the
  // `if (urlTierId !== activeTier.tierId)` guard produces the SAME ×2 here
  // (not ×3) — the guard's effect is eliminating one redundant, value-
  // unchanged `setSearchParams` call (see the "mirror preserved" test below:
  // exactly one write reaches the URL), not reducing this run count. That's
  // the SAME accepted-and-disclosed category as the breadcrumb path's
  // intentional double `fetchTier` (groupActionsContext.tsx onTierChange) —
  // a self-heal echo of the effect's own write, not the unrelated-write storm
  // this task fixes (see "the storm" test below, which IS ×0 growth).
  it('mount WITHOUT ?tier= settles at fetchTiers x2 (one unavoidable self-heal re-run from the mirror write itself)', async () => {
    renderNewShell('/group/DEVTST');

    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));

    expect(mocks.fetchTiers).toHaveBeenCalledTimes(2);
    expect(mocks.fetchTier).toHaveBeenCalledTimes(2);
    expect(mocks.fetchTier).toHaveBeenLastCalledWith('g1', 'm5s');
    expect(mocks.fetchCurrentWeek).toHaveBeenCalledTimes(2);
  });

  it('the storm: pushing an unrelated ?week= param after settle does NOT increase fetchTiers/fetchTier counts', async () => {
    renderNewShell('/group/DEVTST?tier=m5s');

    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    const tiersCountAtSettle = mocks.fetchTiers.mock.calls.length;
    const tierCountAtSettle = mocks.fetchTier.mock.calls.length;

    await act(async () => {
      screen.getByTestId('push-week').click();
    });
    await waitFor(() => expect(currentSearchParams().get('week')).toBe('3'));
    // Settle window — the whole point is nothing new fires.
    await new Promise((r) => setTimeout(r, 50));

    expect(mocks.fetchTiers).toHaveBeenCalledTimes(tiersCountAtSettle);
    expect(mocks.fetchTier).toHaveBeenCalledTimes(tierCountAtSettle);
  });

  it('changing ?tier= to another tier calls fetchTier with the new tierId (back/forward-equivalent)', async () => {
    renderNewShell('/group/DEVTST?tier=m5s');

    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));

    await act(async () => {
      screen.getByTestId('push-tier-m6s').click();
    });

    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledWith('g1', 'm6s'));
  });

  it('mirror preserved: mount with no ?tier= writes tier=<selected> to the URL exactly once (replace) — the guard leg', async () => {
    renderNewShell('/group/DEVTST');

    // Settle through both runs (see the x2 test above for why there are two).
    await waitFor(() => expect(mocks.fetchTier).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));

    expect(currentSearchParams().get('tier')).toBe('m5s');
    // The observable proof the guard leg does real work: run 2 resolves the
    // SAME tier (urlTierId === activeTier.tierId by then) and skips its own
    // write — setSearchParams reaches the router exactly once, not twice for
    // an identical value. (Verified this leg matters via a local A/B: pulling
    // the `if` guard out of NewShell.tsx while running just this test flips
    // this assertion to 2 — see the plan doc's Task 5 section,
    // design/redesign/plans/2026-08-22-phase-d5-grid-chassis.md, the ruled
    // ×2 premise as of commit f43dc84b.)
    expect(mocks.setSearchParamsCalls).toBe(1);
    // The mode, not just the count: the mirror write must be a history
    // `replace` (NewShell.tsx's `setSearchParamsRef.current(prev => …, {
    // replace: true })`), never a push that would grow the back-stack for a
    // value the user never navigated to.
    expect(mocks.setSearchParamsLastOptions).toEqual({ replace: true });
  });
});
