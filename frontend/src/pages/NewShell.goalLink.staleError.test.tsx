/**
 * NewShell — `?goal=objectives` with a leftover View As error (S2a-5a·C2b, R-M-7 as amended).
 *
 * A failed read leaves `error` in `viewAsStore`, a singleton. `useViewAsUrlSync` runs first in the
 * commit of a new arrival and `startViewAs` clears that error synchronously, but this render was
 * made with the old value. So the hold has to read the store, not the render, or the stale failure
 * ends it and the admin lands on their own role's target.
 *
 * Same rig as `NewShell.goalLink.test.tsx` (real `useStaticPermissions`, `useViewAsUrlSync`,
 * `viewAsStore` and `authStore`; each `admin/user-role` GET held), kept apart because that file is
 * locked. The two errors share one string on purpose, so the store's `error` going from the leftover
 * to the new failure is only visible as the null between them.
 */
import { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockGroup {
  id: string;
  name: string;
  shareCode: string;
  settings: Record<string, unknown>;
  userRole: string | null;
  isAdminAccess: boolean;
}

const mocks = vi.hoisted(() => ({ currentGroup: null as MockGroup | null }));

vi.mock('./GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('./RecruitPage', () => ({ RecruitPage: () => <div data-testid="recruit-page-mock" /> }));
vi.mock('../components/home/Home', () => ({ Home: () => null }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('./V2SettingsHost', () => ({ V2SettingsHost: () => null }));
vi.mock('../components/layout/TopBar', () => ({ TopBar: () => null }));
vi.mock('../components/layout/Spine', () => ({ Spine: () => null }));
vi.mock('../components/layout/CommandPalette', () => ({ CommandPalette: () => null }));

vi.mock('../hooks/useGroupViewState', async (importOriginal) => {
  const { useSearchParams: realUseSearchParams } = await import('react-router-dom');
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return {
    ...(await importOriginal<typeof import('../hooks/useGroupViewState')>()),
    useGroupViewState: () => {
      const [searchParams, setSearchParams] = realUseSearchParams();
      return makeGroupViewStateMock({ searchParams, setSearchParams, pageMode: 'overview' });
    },
  };
});

vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      currentGroup: mocks.currentGroup, isLoading: false, error: null, errorStack: null,
      clearError: vi.fn(), fetchGroupByShareCode: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));
vi.mock('../stores/tierStore', () => {
  const state = {
    tiers: [], isLoading: false, error: null, errorStack: null, currentTier: null,
    fetchTiers: async () => {}, fetchTier: async () => {}, clearTiers: () => {}, clearError: () => {},
  };
  const useTierStore = (selector?: (s: Record<string, unknown>) => unknown) => (selector ? selector(state) : state);
  useTierStore.getState = () => state;
  return { useTierStore, useCurrentTier: () => null };
});
vi.mock('../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { fetchCurrentWeek: () => {} };
    return selector ? selector(state) : state;
  },
}));

import { NewShell } from './NewShell';
import { ChromeSlotNodesContext } from './chrome/chromeSlots';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore, type ViewAsUserInfo } from '../stores/viewAsStore';
import type { MemberRole, User } from '../types';

const FAILURE = 'View As refused';
const group = (userRole: string | null, over: Partial<MockGroup> = {}): MockGroup => ({
  id: 'g1', name: 'Crescent', shareCode: 'abc', settings: {}, userRole, isAdminAccess: false, ...over,
});

/** The `admin/user-role` GETs in flight, oldest first. */
let reads: Array<{ url: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
/** Every location the router showed, in order. */
let seen: string[] = [];

const viewAsInfo = (role: MemberRole, groupId: string): ViewAsUserInfo => ({
  userId: 'u2', discordUsername: 'Viewed', displayName: null, avatarUrl: null,
  groupId, groupName: 'Crescent', isMember: true, role,
  isLinkedPlayer: false, linkedPlayerId: null, linkedPlayerName: null,
});

async function landRead(role: MemberRole, groupId = 'g1') {
  const read = reads.shift();
  expect(read, 'no admin/user-role GET was in flight').toBeDefined();
  await act(async () => { read?.resolve(viewAsInfo(role, groupId)); });
}

async function failRead() {
  const read = reads.shift();
  expect(read, 'no admin/user-role GET was in flight').toBeDefined();
  await act(async () => { read?.reject(new Error(FAILURE)); });
}

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname + location.search;
  useEffect(() => { seen.push(current); }, [current]);
  return (
    <>
      <div data-testid="location" data-path={current} />
      <button type="button" data-testid="go-def" onClick={() => navigate('/group/def?tab=goals&goal=objectives&viewAs=u2')}>go</button>
    </>
  );
}

function renderShell(url: string) {
  const slots = { topBar: null, spine: null };
  const tree = () => (
    <ChromeSlotNodesContext.Provider value={slots}>
      <MemoryRouter initialEntries={[url]}>
        <Probe />
        <Routes>
          <Route path="/group/:shareCode" element={<NewShell />} />
          <Route path="/group/:shareCode/recruit" element={<NewShell />} />
        </Routes>
      </MemoryRouter>
    </ChromeSlotNodesContext.Provider>
  );
  const utils = render(tree());
  return { rerenderShell: () => utils.rerender(tree()) };
}

const path = () => screen.getByTestId('location').getAttribute('data-path');

const HELD = '/group/abc?tab=goals&goal=objectives&viewAs=u2';
const leftoverError = () => useViewAsStore.setState({ error: FAILURE });

beforeEach(() => {
  seen = [];
  reads = [];
  localStorage.clear();
  useViewAsStore.getState().stopViewAs();
  useAuthStore.setState({
    user: { id: 'me', discordId: 'd', discordUsername: 'Me', isAdmin: true } as unknown as User,
    isAuthenticated: true,
    authInitialized: true,
  });
  vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (!url.includes('/admin/user-role/')) return Promise.resolve([]) as never;
    return new Promise((resolve, reject) => { reads.push({ url, resolve, reject }); }) as never;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('?goal=objectives with a leftover View As error', () => {
  it('an admin who owns the static, viewing as a member: held, then Home, and never Recruit', async () => {
    mocks.currentGroup = group('owner');
    leftoverError();
    renderShell(HELD);
    expect(seen).toEqual([HELD]);
    expect(reads).toHaveLength(1);

    await landRead('member');
    expect(path()).toBe('/group/abc?tab=overview&viewAs=u2');
    expect(seen.filter((p) => p.includes('/recruit'))).toEqual([]);
  });

  it('an admin with no role here, viewing as a lead: held, then Recruit, and never Home', async () => {
    mocks.currentGroup = group('owner', { isAdminAccess: true });
    leftoverError();
    renderShell(HELD);
    expect(seen).toEqual([HELD]);

    await landRead('lead');
    expect(path()).toBe('/group/abc/recruit?rtab=listing&viewAs=u2');
    expect(seen).toHaveLength(2);
  });

  it('the new read failing the same way still ends the hold, on the admin\'s own role', async () => {
    mocks.currentGroup = group('owner');
    leftoverError();
    renderShell(HELD);
    expect(seen).toEqual([HELD]);

    await failRead();
    expect(path()).toBe('/group/abc/recruit?rtab=listing&viewAs=u2');
  });

  it('a failed read at one static does not end the hold at the next', async () => {
    mocks.currentGroup = group('owner');
    const { rerenderShell } = renderShell('/group/abc?tab=roster&viewAs=u2');
    await failRead();

    // The route moves first: the sync hook re-reads at the old static, and that fails too.
    act(() => { fireEvent.click(screen.getByTestId('go-def')); });
    await failRead();
    expect(useViewAsStore.getState().error).toBe(FAILURE);

    mocks.currentGroup = group('owner', { id: 'g2', shareCode: 'def' });
    rerenderShell();
    expect(reads.map((r) => r.url)).toEqual(['/api/static-groups/admin/user-role/g2/u2']);
    expect(path()).toBe('/group/def?tab=goals&goal=objectives&viewAs=u2');

    await landRead('member', 'g2');
    expect(path()).toBe('/group/def?tab=overview&viewAs=u2');
    expect(seen.filter((p) => p.includes('/recruit'))).toEqual([]);
  });
});
