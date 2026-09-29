/**
 * NewShell — the Recruiting sub-route swap and the settings seam (RH1b,
 * R-RH-G / R-RH-I).
 *
 * Renders the REAL `NewShell` (its effects are the unit under test) under a
 * MemoryRouter that registers BOTH group routes, with the heavy leaves stubbed
 * the way `NewShell.tierSelection.test.tsx` stubs them. `RecruitPage`,
 * `GroupViewContent`, `Spine` and `CommandPalette` are stubs that expose what
 * the shell hands them (`activeTab`, `onTabChange`, `onSelectTab`); the Spine
 * stub renders through the real chrome-slot portal, so the slot context is
 * provided with a live node. The settings-panel store is REAL: `open(...)` on
 * it is what the seam must intercept.
 */
import { useEffect, useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PageMode } from '../types';

/**
 * Live, the `?rcsub=` redirect's router update is committed AFTER the sync
 * tier-store update from the same effect flush; the tier-loading render that
 * produces mounts `GroupViewContent` on the stale group location, and its
 * `useGroupViewState` mount effect replace-writes `?tab=` there, so the two
 * router updates collapse into one render that shows the group URL again. The
 * writer below reproduces that ordering: it is a sibling rendered AFTER the
 * routes, so its effect runs in the same commit as NewShell's handler but
 * after it, with the pre-redirect location in its closure.
 */
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

interface MockTier { id: string; tierId: string; contentType: string; players: unknown[]; isActive: boolean }
const TIER_T1: MockTier = { id: 'snap-t1', tierId: 't1', contentType: 'savage', players: [], isActive: true };

const mocks = vi.hoisted(() => ({
  currentGroup: null as { id: string; name: string; shareCode: string; settings: Record<string, unknown> } | null,
  tiers: [] as unknown[],
  canEdit: true,
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
  Spine: ({ activeTab, onTabChange }: { activeTab: PageMode | null; onTabChange: (t: PageMode) => void }) => (
    <button type="button" data-testid="spine-stub" data-active={String(activeTab)} onClick={() => onTabChange('roster')}>
      spine
    </button>
  ),
}));
vi.mock('../components/layout/CommandPalette', () => ({
  CommandPalette: ({ onSelectTab }: { onSelectTab?: (t: PageMode) => void }) => (
    <button
      type="button"
      data-testid="palette-stub"
      data-has-select-tab={String(onSelectTab !== undefined)}
      onClick={() => onSelectTab?.('roster')}
    >
      palette
    </button>
  ),
}));

vi.mock('../hooks/useGroupViewState', async () => {
  const { useSearchParams: realUseSearchParams } = await import('react-router-dom');
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return {
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
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: mocks.canEdit ? 'owner' : 'member', isAdmin: false, isAdminAccess: false,
    isMember: true, canEdit: mocks.canEdit, canManageInvitations: mocks.canEdit,
  }),
}));

import { NewShell } from './NewShell';
import { ChromeSlotNodesContext } from './chrome/chromeSlots';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';

const GROUP_ABC = { id: 'g1', name: 'Crescent', shareCode: 'abc', settings: {} };

beforeEach(() => {
  mocks.currentGroup = GROUP_ABC;
  mocks.tiers = [TIER_T1];
  mocks.canEdit = true;
  mocks.fetchTiers.mockClear();
  mocks.fetchTier.mockClear();
  mocks.clearTiers.mockClear();
  mocks.clearTierError.mockClear();
  mocks.fetchGroupByShareCode.mockClear();
  mocks.clearGroupError.mockClear();
  mocks.fetchCurrentWeek.mockClear();
  stale.armed = false;
  localStorage.clear();
  useSettingsPanelStore.setState({
    isOpen: false, tab: 'general', recruitmentSection: undefined, highlightCreateInvite: false, recruitRedirect: null,
  });
});

function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  return (
    <>
      <div data-testid="location" data-path={location.pathname + location.search} data-type={type} />
      <button type="button" data-testid="go-def" onClick={() => navigate('/group/def')}>go-def</button>
      <button type="button" data-testid="go-def-rcsub" onClick={() => navigate('/group/def?rcsub=listing')}>go-def-rcsub</button>
      <button
        type="button"
        data-testid="push-rcsub"
        onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('rcsub', 'listing'); return p; })}
      >
        push-rcsub
      </button>
    </>
  );
}

function renderShell(initialPath: string) {
  const spine = document.createElement('div');
  document.body.appendChild(spine);
  const slots = { topBar: null, spine };
  // A fresh element per render: re-rendering the SAME element object makes
  // React bail out, so the mocked store values would never be re-read.
  // MemoryRouter reads `initialEntries` only on mount, so its history survives.
  const tree = () => (
    <ChromeSlotNodesContext.Provider value={slots}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Probe />
        <Routes>
          <Route path="/group/:shareCode" element={<NewShell />} />
          <Route path="/group/:shareCode/recruit" element={<NewShell />} />
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
const openRecruitment = (opts: Parameters<ReturnType<typeof useSettingsPanelStore.getState>['open']>[0]) =>
  act(() => { useSettingsPanelStore.getState().open(opts); });

describe('NewShell — the Recruiting sub-route body (R-RH-G)', () => {
  it('/group/abc/recruit renders RecruitPage and not the group content', () => {
    renderShell('/group/abc/recruit?tier=t1');
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('gvc')).toBeNull();
    expect(screen.queryByTestId('home')).toBeNull();
    expect(screen.getByTestId('new-shell')).toBeInTheDocument();
  });

  it('/group/abc renders the group content and not RecruitPage', () => {
    renderShell('/group/abc?tier=t1');
    expect(screen.getByTestId('gvc')).toBeInTheDocument();
    expect(screen.queryByTestId('recruit-page-mock')).toBeNull();
  });

  it('a tierless static still renders RecruitPage (M2) while /group/abc shows "No Raid Tiers"', () => {
    mocks.tiers = [];
    const first = renderShell('/group/abc/recruit');
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
    expect(screen.queryByText('No Raid Tiers')).toBeNull();
    first.unmount();

    renderShell('/group/abc');
    expect(screen.getByText('No Raid Tiers')).toBeInTheDocument();
    expect(screen.queryByTestId('recruit-page-mock')).toBeNull();
  });

  it('the Spine gets no selected tab on the recruit path and its tab change navigates to the static (M1)', () => {
    renderShell('/group/abc/recruit?rtab=listing&tier=t1');
    const spine = screen.getByTestId('spine-stub');
    expect(spine).toHaveAttribute('data-active', 'null');
    fireEvent.click(spine);
    expect(path()).toBe('/group/abc?tab=roster&tier=t1');
    expect(screen.getByTestId('gvc')).toBeInTheDocument();
  });

  it('⌘K gets onSelectTab on the recruit path only, and it navigates the same way', () => {
    renderShell('/group/abc/recruit?tier=t1');
    const palette = screen.getByTestId('palette-stub');
    expect(palette).toHaveAttribute('data-has-select-tab', 'true');
    fireEvent.click(palette);
    expect(path()).toBe('/group/abc?tab=roster&tier=t1');
    // Back on the group route the override is gone and the Spine has its tab.
    expect(screen.getByTestId('palette-stub')).toHaveAttribute('data-has-select-tab', 'false');
    expect(screen.getByTestId('spine-stub')).toHaveAttribute('data-active', 'overview');
  });

  it('a tab change with no tier param carries none', () => {
    renderShell('/group/abc/recruit');
    fireEvent.click(screen.getByTestId('spine-stub'));
    expect(path()).toBe('/group/abc?tab=roster');
  });
});

describe('NewShell — the settings seam (R-RH-I)', () => {
  it('open({ recruitment, invitations, highlightCreateInvite }) navigates to the Invites create form with the tier; the dock stays closed', () => {
    renderShell('/group/abc?tier=t1');
    openRecruitment({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true });
    expect(path()).toBe('/group/abc/recruit?rtab=invites&create=1&tier=t1');
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    expect(navType()).toBe('PUSH');
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
  });

  it('open({ recruitment, requests }) lands on Applicants', () => {
    renderShell('/group/abc?tier=t1');
    openRecruitment({ tab: 'recruitment', section: 'requests' });
    expect(path()).toBe('/group/abc/recruit?tier=t1');
  });

  it('after the shell\'s shareCode changes to def, the same call navigates to /group/def/… (M10)', () => {
    renderShell('/group/abc?tier=t1');
    act(() => { fireEvent.click(screen.getByTestId('go-def')); });
    expect(path()).toBe('/group/def');
    openRecruitment({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true });
    expect(path()).toBe('/group/def/recruit?rtab=invites&create=1');
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('opening a non-recruitment tab still opens the dock', () => {
    renderShell('/group/abc?tier=t1');
    openRecruitment({ tab: 'members' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(path()).toBe('/group/abc?tier=t1');
  });

  it('unmounting the shell clears the redirect', () => {
    const { unmount } = renderShell('/group/abc?tier=t1');
    expect(useSettingsPanelStore.getState().recruitRedirect).not.toBeNull();
    unmount();
    expect(useSettingsPanelStore.getState().recruitRedirect).toBeNull();
  });
});

describe('NewShell — ?rcsub= on the group route (M11)', () => {
  it('does nothing until the group loads, then replaces to /group/abc/recruit for a manager', () => {
    mocks.currentGroup = null;
    mocks.tiers = [];
    const { rerenderShell } = renderShell('/group/abc?rcsub=requests');
    expect(path()).toBe('/group/abc?rcsub=requests');

    mocks.currentGroup = GROUP_ABC;
    rerenderShell();
    expect(path()).toBe('/group/abc/recruit');
    expect(navType()).toBe('REPLACE');
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
  });

  it('a member has the param stripped in place instead', () => {
    mocks.currentGroup = null;
    mocks.tiers = [];
    mocks.canEdit = false;
    const { rerenderShell } = renderShell('/group/abc?rcsub=requests');
    expect(path()).toBe('/group/abc?rcsub=requests');

    mocks.currentGroup = GROUP_ABC;
    rerenderShell();
    expect(path()).toBe('/group/abc');
    expect(navType()).toBe('REPLACE');
  });

  it('maps the section: rcsub=listing → ?rtab=listing, carrying the tier', () => {
    mocks.tiers = [];
    renderShell('/group/abc?rcsub=listing&tier=t1');
    expect(path()).toBe('/group/abc/recruit?rtab=listing&tier=t1');
  });

  it('a stale group for another static does not trigger it', () => {
    mocks.currentGroup = { ...GROUP_ABC, shareCode: 'zzz' };
    mocks.tiers = [];
    renderShell('/group/abc?rcsub=requests');
    expect(path()).toBe('/group/abc?rcsub=requests');
  });

  it('is one-shot per arrival: after the static has loaded once, a later rcsub write (dock closed) does not navigate', () => {
    mocks.tiers = [];
    renderShell('/group/abc?tier=t1');
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    act(() => { fireEvent.click(screen.getByTestId('push-rcsub')); });
    expect(path()).toBe('/group/abc?tier=t1&rcsub=listing');
  });

  it('does not fire again for the same static after it acted once (Spine back, then a dock rcsub write)', () => {
    mocks.tiers = [];
    renderShell('/group/abc?rcsub=requests');
    expect(path()).toBe('/group/abc/recruit');
    act(() => { fireEvent.click(screen.getByTestId('spine-stub')); });
    expect(path()).toBe('/group/abc?tab=roster');
    act(() => { fireEvent.click(screen.getByTestId('push-rcsub')); });
    expect(path()).toBe('/group/abc?tab=roster&rcsub=listing');
  });

  it('a stale ?tab= replace write queued behind the redirect does not lose the deep link (live regression, cold arrival)', () => {
    mocks.currentGroup = null;
    const { rerenderShell } = renderShell('/group/abc?rcsub=listing');
    expect(path()).toBe('/group/abc?rcsub=listing');

    // The group loads; in the same commit the handler redirects and then the
    // tab-memory write (pre-redirect closure) replaces the group URL over it.
    mocks.currentGroup = GROUP_ABC;
    stale.armed = true;
    rerenderShell();
    expect(path()).toBe('/group/abc/recruit?rtab=listing');
    expect(screen.getByTestId('recruit-page-mock')).toBeInTheDocument();
  });

  it('arriving at another static with ?rcsub= acts again', () => {
    mocks.tiers = [];
    renderShell('/group/abc?tier=t1');
    mocks.currentGroup = { ...GROUP_ABC, id: 'g2', shareCode: 'def' };
    act(() => { fireEvent.click(screen.getByTestId('go-def-rcsub')); });
    expect(path()).toBe('/group/def/recruit?rtab=listing');
    expect(navType()).toBe('REPLACE');
  });
});
