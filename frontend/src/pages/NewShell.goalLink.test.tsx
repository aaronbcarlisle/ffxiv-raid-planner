/**
 * NewShell — `?goal=objectives` on arrival (S2a-5a·C2b Task C2-3, C-5, R-M-7, Review Focus 4).
 *
 * Renders the REAL `NewShell` under a MemoryRouter with both group routes, as
 * `NewShell.recruit.test.tsx` does, with the same heavy leaves stubbed. The difference is the role:
 * `useStaticPermissions`, `useViewAsUrlSync`, `viewAsStore` and `authStore` are all REAL here, so
 * `canEdit` moves when View As lands, as it does live. `api.get` is spied, and each
 * `admin/user-role` GET stays held until the test releases or rejects it.
 *
 * Nothing here waits on time: a held read lands inside `act`, and everything else is synchronous.
 *
 * "Nothing navigates" cases end with a control: the same render then does navigate, on the held read
 * landing or on arriving at another static with the link. So a shell with no handler fails them too.
 */
import { useEffect, useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PageMode } from '../types';

/** Same ordering as the writer in `NewShell.recruit.test.tsx`: a sibling after the routes, so its
 *  replace lands in the commit of NewShell's redirect, with the pre-redirect search in its closure. */
const stale = { armed: false };
function StaleTabWriter({ armed }: { armed: boolean }) {
  const [, setSearchParams] = useSearchParams();
  const fired = useRef(false);
  useEffect(() => {
    if (!armed || fired.current) return;
    fired.current = true;
    setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', 'overview'); return p; }, { replace: true });
  }, [armed, setSearchParams]);
  return null;
}

interface MockGroup {
  id: string;
  name: string;
  shareCode: string;
  settings: Record<string, unknown>;
  userRole: string | null;
  isAdminAccess: boolean;
}

const mocks = vi.hoisted(() => ({
  currentGroup: null as MockGroup | null,
  tiers: [] as unknown[],
  fetchTiers: vi.fn(async () => {}),
  fetchTier: vi.fn(async () => {}),
  clearTiers: vi.fn(),
  clearTierError: vi.fn(),
  fetchGroupByShareCode: vi.fn(),
  clearGroupError: vi.fn(),
  fetchCurrentWeek: vi.fn(),
}));

vi.mock('./GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('./RecruitPage', () => ({ RecruitPage: () => <div data-testid="recruit-page-mock" /> }));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('./V2SettingsHost', () => ({ V2SettingsHost: () => null }));
vi.mock('../components/layout/TopBar', () => ({ TopBar: () => null }));
vi.mock('../components/layout/Spine', () => ({
  Spine: ({ onTabChange }: { onTabChange: (t: PageMode) => void }) => (
    <button type="button" data-testid="spine-stub" onClick={() => onTabChange('roster')}>spine</button>
  ),
}));
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
      tiers: mocks.tiers, isLoading: false, error: null, errorStack: null, currentTier: null,
      fetchTiers: mocks.fetchTiers, fetchTier: mocks.fetchTier,
      clearTiers: mocks.clearTiers, clearError: mocks.clearTierError,
    };
    return selector ? selector(state) : state;
  };
  useTierStoreImpl.getState = () => ({ tiers: mocks.tiers, currentTier: null });
  return { useTierStore: useTierStoreImpl, useCurrentTier: () => null };
});
vi.mock('../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { fetchCurrentWeek: mocks.fetchCurrentWeek };
    return selector ? selector(state) : state;
  },
}));

import { NewShell } from './NewShell';
import { ChromeSlotNodesContext } from './chrome/chromeSlots';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore, type ViewAsUserInfo } from '../stores/viewAsStore';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import type { MemberRole, User } from '../types';

const TIER = { id: 'snap-t1', tierId: 't1', contentType: 'savage', players: [], isActive: true };
const group = (userRole: string | null, over: Partial<MockGroup> = {}): MockGroup => ({
  id: 'g1', name: 'Crescent', shareCode: 'abc', settings: {}, userRole, isAdminAccess: false, ...over,
});
const GROUP_DEF = (userRole: string | null) => group(userRole, { id: 'g2', shareCode: 'def' });

function signIn(user: { isAdmin: boolean } | null, authInitialized = true) {
  useAuthStore.setState({
    user: user ? ({ id: 'me', discordId: 'd', discordUsername: 'Me', isAdmin: user.isAdmin } as unknown as User) : null,
    isAuthenticated: user !== null,
    authInitialized,
  });
}

const signInAdmin = () => signIn({ isAdmin: true });
const signInUser = () => signIn({ isAdmin: false });

/** The `admin/user-role` GETs in flight, oldest first. */
let reads: Array<{ url: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const viewAsInfo = (role: MemberRole | null, over: Partial<ViewAsUserInfo> = {}): ViewAsUserInfo => ({
  userId: 'u2', discordUsername: 'Viewed', displayName: null, avatarUrl: null,
  groupId: 'g1', groupName: 'Crescent', isMember: role !== null, role,
  isLinkedPlayer: false, linkedPlayerId: null, linkedPlayerName: null, ...over,
});

/** Lands the oldest held read, and everything it queues, inside `act`. */
async function landRead(role: MemberRole | null, over: Partial<ViewAsUserInfo> = {}) {
  const read = reads.shift();
  expect(read, 'no admin/user-role GET was in flight').toBeDefined();
  await act(async () => { read?.resolve(viewAsInfo(role, over)); });
}

async function failRead() {
  const read = reads.shift();
  expect(read, 'no admin/user-role GET was in flight').toBeDefined();
  await act(async () => { read?.reject(new Error('View As refused')); });
}

/** Every location the router showed, in order. */
let seen: string[] = [];

function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const current = location.pathname + location.search;
  useEffect(() => { seen.push(current); }, [current]);
  return (
    <>
      <div data-testid="location" data-path={current} data-type={type} />
      <button type="button" data-testid="go-def-goal" onClick={() => navigate('/group/def?tab=goals&goal=objectives')}>go</button>
      <button type="button" data-testid="go-def-plain" onClick={() => navigate('/group/def')}>go</button>
      <button type="button" data-testid="go-abc-roster" onClick={() => navigate('/group/abc?tab=roster&viewAs=u2&tier=t1')}>go</button>
      <button type="button" data-testid="back" onClick={() => navigate(-1)}>back</button>
      <button
        type="button"
        data-testid="push-goal"
        onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('goal', 'objectives'); return p; })}
      >
        push-goal
      </button>
      <button
        type="button"
        data-testid="push-week"
        onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('week', '3'); return p; })}
      >
        push-week
      </button>
    </>
  );
}

function renderShell(initialPath: string, opts: { from?: string } = {}) {
  const spine = document.createElement('div');
  document.body.appendChild(spine);
  const slots = { topBar: null, spine };
  const entries = opts.from ? [opts.from, initialPath] : [initialPath];
  const tree = () => (
    <ChromeSlotNodesContext.Provider value={slots}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Probe />
        <Routes>
          <Route path="/group/:shareCode" element={<NewShell />} />
          <Route path="/group/:shareCode/recruit" element={<NewShell />} />
          <Route path="*" element={null} />
        </Routes>
        <StaleTabWriter armed={stale.armed} />
      </MemoryRouter>
    </ChromeSlotNodesContext.Provider>
  );
  const utils = render(tree());
  return { ...utils, rerenderShell: () => utils.rerender(tree()) };
}

const path = () => screen.getByTestId('location').getAttribute('data-path');
const navType = () => screen.getByTestId('location').getAttribute('data-type');
const located = () => {
  const [pathname, search = ''] = (path() ?? '').split('?');
  return { pathname, params: Object.fromEntries(new URLSearchParams(search)) };
};
const click = (testId: string) => act(() => { fireEvent.click(screen.getByTestId(testId)); });

const expectRecruit = (params: Record<string, string> = {}) => {
  expect(located()).toEqual({ pathname: '/group/abc/recruit', params: { rtab: 'listing', ...params } });
  expect(navType()).toBe('REPLACE');
  expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
};
const expectHome = (params: Record<string, string> = {}) => {
  expect(located()).toEqual({ pathname: '/group/abc', params: { tab: 'overview', ...params } });
  expect(navType()).toBe('REPLACE');
  expect(screen.getByTestId('gvc')).toBeInTheDocument();
  expect(seen.filter((p) => p.includes('/recruit'))).toEqual([]);
};
/** The link is still sitting on the URL and the router hasn't moved. */
const expectUntouched = (url: string) => {
  expect(path()).toBe(url);
  expect(navType()).toBe('POP');
  expect(seen).toEqual([url]);
};
/** The control: this render's router does redirect, at the next static's arrival. */
const expectStillArrives = (role: string) => {
  mocks.currentGroup = GROUP_DEF(role);
  click('go-def-goal');
  const expected = role === 'owner' || role === 'lead' ? '/group/def/recruit' : '/group/def';
  expect(located().pathname).toBe(expected);
  expect(located().params.goal).toBeUndefined();
  expect(navType()).toBe('REPLACE');
};

beforeEach(() => {
  mocks.currentGroup = group('member');
  mocks.tiers = [TIER];
  mocks.fetchTiers.mockClear();
  mocks.fetchTier.mockClear();
  mocks.clearTiers.mockClear();
  mocks.clearTierError.mockClear();
  mocks.fetchGroupByShareCode.mockClear();
  mocks.clearGroupError.mockClear();
  mocks.fetchCurrentWeek.mockClear();
  stale.armed = false;
  seen = [];
  reads = [];
  localStorage.clear();
  useViewAsStore.getState().stopViewAs();
  signInUser();
  useSettingsPanelStore.setState({
    isOpen: false, tab: 'general', recruitmentSection: undefined, highlightCreateInvite: false, recruitRedirect: null,
  });
  vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (!url.includes('/admin/user-role/')) return Promise.resolve([]) as never;
    return new Promise((resolve, reject) => { reads.push({ url, resolve, reject }); }) as never;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const LINK = '/group/abc?tab=goals&goal=objectives';

describe('?goal=objectives — someone who can manage the static (R-M-7)', () => {
  it('a lead lands on Recruit ▸ Listing with no goal or tab, by replace, keeping tier, viewAs and adminMode', () => {
    mocks.currentGroup = group('lead');
    renderShell(`${LINK}&tier=t1&viewAs=u2&adminMode=true`);
    expectRecruit({ tier: 't1', viewAs: 'u2', adminMode: 'true' });
    // One redirect: the arrival and the target, nothing in between.
    expect(seen).toHaveLength(2);
    expect(screen.queryByTestId('gvc')).toBeNull();
  });

  it('an owner lands on the bare Listing URL', () => {
    mocks.currentGroup = group('owner');
    renderShell(LINK);
    expect(path()).toBe('/group/abc/recruit?rtab=listing');
    expect(navType()).toBe('REPLACE');
  });

  it('works with no `tab` in the link', () => {
    mocks.currentGroup = group('lead');
    renderShell('/group/abc?goal=objectives');
    expect(path()).toBe('/group/abc/recruit?rtab=listing');
  });

  it('keeps a tier holding reserved characters and unicode, intact', () => {
    mocks.currentGroup = group('lead');
    renderShell(`${LINK}&tier=${encodeURIComponent('a&b=c 零 $1 %20')}`);
    expectRecruit({ tier: 'a&b=c 零 $1 %20' });
  });

  it('a tierless static still lands (objectives are the static\'s, C-3)', () => {
    mocks.currentGroup = group('lead');
    mocks.tiers = [];
    renderShell(LINK);
    expectRecruit();
  });

  it('leaves no goal URL behind in history: Back goes to where the user came from', () => {
    mocks.currentGroup = group('lead');
    renderShell(LINK, { from: '/somewhere' });
    expectRecruit();
    click('back');
    expect(path()).toBe('/somewhere');
  });

  it('a stale ?tab= write queued behind the redirect does not lose the link', () => {
    mocks.currentGroup = null;
    const { rerenderShell } = renderShell(LINK);
    expect(path()).toBe(LINK);

    mocks.currentGroup = group('lead');
    stale.armed = true;
    rerenderShell();
    expect(located()).toEqual({ pathname: '/group/abc/recruit', params: { rtab: 'listing' } });
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
  });
});

describe('?goal=objectives — anyone else stays on the static (R-M-7)', () => {
  it.each(['member', 'viewer'])('a %s lands on ?tab=overview with no goal, keeping viewAs', (role) => {
    mocks.currentGroup = group(role);
    renderShell(`${LINK}&viewAs=u2`);
    expectHome({ viewAs: 'u2' });
    expect(seen).toHaveLength(2);
  });

  it('keeps the tier and any other param; only goal and tab change', () => {
    renderShell(`${LINK}&tier=t1&week=3`);
    expectHome({ tier: 't1', week: '3' });
  });

  it('sets tab=overview when the link had no tab, and over any other tab', () => {
    const first = renderShell('/group/abc?goal=objectives');
    expectHome();
    first.unmount();
    seen = [];
    renderShell('/group/abc?tab=roster&goal=objectives');
    expectHome();
  });

  it('a guest takes this branch', () => {
    signIn(null);
    mocks.currentGroup = group(null);
    renderShell(LINK);
    expectHome();
  });

  it('a guest keeps a viewAs in the URL and sends no View As read', () => {
    signIn(null);
    mocks.currentGroup = group(null);
    renderShell(`${LINK}&viewAs=u2`);
    expectHome({ viewAs: 'u2' });
    expect(reads).toEqual([]);
  });

  it('a tierless static still lands', () => {
    mocks.tiers = [];
    renderShell(LINK);
    expect(path()).toBe('/group/abc?tab=overview');
    expect(navType()).toBe('REPLACE');
  });

  it('a stale ?tab= write queued behind the strip does not bring the link back', () => {
    mocks.currentGroup = null;
    const { rerenderShell } = renderShell(LINK);
    mocks.currentGroup = group('member');
    stale.armed = true;
    rerenderShell();
    expect(located()).toEqual({ pathname: '/group/abc', params: { tab: 'overview' } });
  });
});

describe('?goal=objectives — before the group loads', () => {
  it.each([
    ['lead', '/group/abc/recruit?rtab=listing'],
    ['member', '/group/abc?tab=overview'],
  ])('nothing happens until it has, then a %s lands', (role, target) => {
    mocks.currentGroup = null;
    mocks.tiers = [];
    const { rerenderShell } = renderShell(LINK);
    expectUntouched(LINK);

    mocks.currentGroup = group(role);
    rerenderShell();
    expect(path()).toBe(target);
    expect(navType()).toBe('REPLACE');
  });

  it('another static still in the store does not trigger it', () => {
    mocks.currentGroup = group('lead', { shareCode: 'zzz' });
    const { rerenderShell } = renderShell(LINK);
    expectUntouched(LINK);

    mocks.currentGroup = group('lead');
    rerenderShell();
    expectRecruit();
  });
});

describe('what the link is not', () => {
  it.each([
    ['goal=farms', '?tab=goals&goal=farms'],
    ['farm=suggested', '?tab=goals&farm=suggested'],
    ['farm=catalog', '?farm=catalog'],
    ['an empty goal', '?tab=goals&goal='],
    ['another case', '?tab=goals&goal=Objectives'],
    ['trailing text', '?tab=goals&goal=objectives2'],
  ])('%s is not redirected', (_name, search) => {
    mocks.currentGroup = group('lead');
    renderShell(`/group/abc${search}`);
    expectUntouched(`/group/abc${search}`);
    expectStillArrives('lead');
  });

  it('does nothing on the Recruit route itself', () => {
    mocks.currentGroup = group('lead');
    const url = '/group/abc/recruit?rtab=applicants&goal=objectives';
    renderShell(url);
    expectUntouched(url);
    expectStillArrives('lead');
  });
});

describe('one redirect, on arrival', () => {
  it('a manager who comes back and gets a later goal write is not redirected again', () => {
    mocks.currentGroup = group('lead');
    renderShell(LINK);
    expectRecruit();

    click('spine-stub');
    expect(path()).toBe('/group/abc?tab=roster');
    click('push-goal');
    expect(path()).toBe('/group/abc?tab=roster&goal=objectives');
    expect(navType()).toBe('PUSH');
  });

  it('a member given a later goal write keeps it', () => {
    renderShell(LINK);
    expectHome();
    click('push-goal');
    expect(located()).toEqual({ pathname: '/group/abc', params: { tab: 'overview', goal: 'objectives' } });
    expect(navType()).toBe('PUSH');
  });

  it('an arrival without the link settles at once: a later goal write does nothing', () => {
    mocks.currentGroup = group('lead');
    renderShell('/group/abc?tab=roster');
    click('push-goal');
    expect(path()).toBe('/group/abc?tab=roster&goal=objectives');
    expect(navType()).toBe('PUSH');
    expectStillArrives('lead');
  });

  it('arriving at another static with the link acts again', () => {
    mocks.currentGroup = group('lead');
    renderShell(LINK);
    expectRecruit();
    mocks.currentGroup = GROUP_DEF('member');
    click('go-def-goal');
    expect(path()).toBe('/group/def?tab=overview');
    expect(navType()).toBe('REPLACE');
  });

  it('an unrelated URL write on the way does not spend the arrival of the next static', () => {
    mocks.currentGroup = group('member');
    renderShell('/group/abc?tab=roster');
    click('push-week');
    mocks.currentGroup = GROUP_DEF('lead');
    click('go-def-goal');
    expect(path()).toBe('/group/def/recruit?rtab=listing');
  });
});

describe('?goal=objectives under View As (R-M-7, Review Focus 4)', () => {
  const HELD = `${LINK}&viewAs=u2`;

  beforeEach(() => signInAdmin());

  describe('nothing navigates until the read lands', () => {
    it('an admin who owns the static, viewing as a member: held, then Home, and never Recruit', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      expect(reads.map((r) => r.url)).toEqual(['/api/static-groups/admin/user-role/g1/u2']);
      expectUntouched(HELD);

      await landRead('member');
      expectHome({ viewAs: 'u2' });
      expect(seen).toHaveLength(2);
    });

    it('an admin with no role here, viewing as a lead: held, then Recruit, and never Home', async () => {
      mocks.currentGroup = group('owner', { isAdminAccess: true });
      renderShell(HELD);
      expectUntouched(HELD);

      await landRead('lead');
      expectRecruit({ viewAs: 'u2' });
      expect(seen).toHaveLength(2);
    });

    it('an admin in adminMode, whose own canEdit is true until it lands, viewing as a member: Home', async () => {
      mocks.currentGroup = group('owner', { isAdminAccess: true });
      const url = `${HELD}&adminMode=true`;
      renderShell(url);
      expectUntouched(url);

      await landRead('member');
      expectHome({ viewAs: 'u2', adminMode: 'true' });
    });

    it('viewing as a viewer lands on Home', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      await landRead('viewer');
      expectHome({ viewAs: 'u2' });
    });

    it('viewing as someone outside the static (role null) lands on Home', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      await landRead(null);
      expectHome({ viewAs: 'u2' });
    });

    it('viewing as a lead keeps the tier and adminMode too', async () => {
      mocks.currentGroup = group('owner', { isAdminAccess: true });
      renderShell(`${HELD}&tier=t1&adminMode=true`);
      await landRead('lead');
      expectRecruit({ viewAs: 'u2', tier: 't1', adminMode: 'true' });
    });

    it('an unrelated URL write during the hold decides nothing, and the arrival stays pending', async () => {
      mocks.currentGroup = group('owner');
      // `tier` in the link: the shell's tier mirror write would otherwise race the assertions.
      renderShell(`${HELD}&tier=t1`);
      click('push-week');
      expect(located().pathname).toBe('/group/abc');
      expect(located().params.goal).toBe('objectives');
      expect(seen.filter((p) => p.includes('/recruit'))).toEqual([]);

      // The URL write restarts the read, and `viewAsStore`'s generation drops the first one.
      expect(reads).toHaveLength(2);
      await landRead('member');
      expect(located().params.goal).toBe('objectives');
      await landRead('member');
      expect(located()).toEqual({ pathname: '/group/abc', params: { tab: 'overview', viewAs: 'u2', tier: 't1', week: '3' } });
    });

    it('another user still in the store does not end the hold', async () => {
      mocks.currentGroup = group('owner');
      useViewAsStore.setState({ viewAsUser: viewAsInfo('lead', { userId: 'someone-else' }) });
      renderShell(HELD);
      expectUntouched(HELD);

      await landRead('member');
      expectHome({ viewAs: 'u2' });
    });

    it('leaving during the hold drops the link: the read landing afterwards moves nothing', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      click('go-abc-roster');
      expect(path()).toBe('/group/abc?tab=roster&viewAs=u2&tier=t1');

      // The navigation restarted the read: both land, and the second is the one that counts.
      expect(reads).toHaveLength(2);
      await landRead('lead');
      await landRead('lead');
      expect(useViewAsStore.getState().viewAsUser?.role).toBe('lead');
      expect(path()).toBe('/group/abc?tab=roster&viewAs=u2&tier=t1');
      expect(navType()).toBe('PUSH');
      expectStillArrives('lead');
    });
  });

  describe('a rejected read falls back to the admin\'s own role', () => {
    it('an admin who owns the static lands on Recruit', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      expectUntouched(HELD);

      await failRead();
      expectRecruit({ viewAs: 'u2' });
    });

    it('an admin with no role here lands on Home', async () => {
      mocks.currentGroup = group('owner', { isAdminAccess: true });
      renderShell(HELD);
      expectUntouched(HELD);

      await failRead();
      expectHome({ viewAs: 'u2' });
    });

    it('an admin in adminMode lands on Recruit', async () => {
      mocks.currentGroup = group('owner', { isAdminAccess: true });
      const url = `${HELD}&adminMode=true`;
      renderShell(url);
      await failRead();
      expectRecruit({ viewAs: 'u2', adminMode: 'true' });
    });
  });

  describe('auth still starting up', () => {
    beforeEach(() => signIn(null, false));

    it('holds with a viewAs, then an admin\'s read decides it', async () => {
      mocks.currentGroup = group('owner');
      renderShell(HELD);
      expectUntouched(HELD);
      expect(reads).toEqual([]);

      act(() => signInAdmin());
      expect(reads).toHaveLength(1);
      expectUntouched(HELD);

      await landRead('member');
      expectHome({ viewAs: 'u2' });
    });

    it('holds with a viewAs, then a non-admin decides on their own role with no read', () => {
      mocks.currentGroup = group('lead');
      renderShell(HELD);
      expectUntouched(HELD);

      act(() => signInUser());
      expect(reads).toEqual([]);
      expectRecruit({ viewAs: 'u2' });
    });

    it('holds with a viewAs, then a guest stays on the static', () => {
      mocks.currentGroup = group(null);
      renderShell(HELD);
      expectUntouched(HELD);

      act(() => signIn(null));
      expectHome({ viewAs: 'u2' });
    });

    it('does not hold without a viewAs', () => {
      mocks.currentGroup = group('lead');
      renderShell(LINK);
      expectRecruit();
    });
  });

  it('a non-admin with a viewAs in the URL is not held: no read will ever come', () => {
    signInUser();
    mocks.currentGroup = group('member');
    renderShell(HELD);
    expect(reads).toEqual([]);
    expectHome({ viewAs: 'u2' });
  });

  it('an admin with no viewAs is not held and goes by their own role', () => {
    mocks.currentGroup = group('owner');
    renderShell(LINK);
    expect(reads).toEqual([]);
    expectRecruit();
  });
});
