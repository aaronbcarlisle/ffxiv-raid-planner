/**
 * @vitest-environment jsdom
 *
 * Layout — the route × shell × auth chrome matrix (Stage-1 T4, plan §4).
 *
 * THIS IS THE V1 GUARD. Stage 1's whole risk (R1) is that flipping
 * `chromeActive` from "v2 group routes" to "every v2 route except `/`" loses or
 * doubles the legacy Header somewhere. The rows below pin, per route class:
 *
 *   • no `?shell=` (the default every existing user is on) → legacy Header +
 *     SettingsDockToggle, no rail, no v2 top bar — on EVERY route class;
 *   • `?shell=legacy` on a group route → legacy Header (the dual-shell opt-out);
 *   • `?shell=v2` off-`/` → AppRail + NonGroupTopBar, and NEITHER the Header
 *     NOR the SettingsDockToggle (G1: the gear moved into the top bar);
 *   • `?shell=v2` on `/` → the legacy Header (the deliberate exclusion, matrix
 *     §8) — which is precisely why UserMenu's escape item keys on the chrome
 *     CONTEXT and not on `resolvedShell` (G2);
 *   • guest + v2 → LoginButton in the bar, no bell/gear (H12 + RC4);
 *   • pre-hydration → the pulse skeleton, never a LoginButton flash (H13).
 *
 * Real: Layout, AppChrome, AppRail, NonGroupTopBar, UserMenu, and the stores.
 * Stubbed: the legacy Header and SettingsDockToggle (presence sentinels — their
 * own suites own their internals), the settings panel/controller and
 * ViewAsBanner (mounted in both branches; irrelevant to the branch decision),
 * and the routed page bodies (plain divs — the flip must not depend on them).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('./Header', () => ({ Header: () => <div data-testid="legacy-header" /> }));
vi.mock('./SettingsDockToggle', () => ({ SettingsDockToggle: () => <div data-testid="settings-dock-toggle" /> }));
vi.mock('./GlobalSettingsPanel', () => ({ GlobalSettingsPanel: () => <div data-testid="global-settings-panel" /> }));
vi.mock('./SettingsPanelController', () => ({ SettingsPanelController: () => null }));
vi.mock('../admin', () => ({ ViewAsBanner: () => null }));

import { Layout } from './Layout';
import { TooltipProvider } from '../primitives';
import { ThemeProvider } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useShellPreferenceStore } from '../../lib/shellPreference';
import type { User } from '../../types';

const authedUser = {
  id: 'u1',
  discordId: '123456789',
  discordUsername: 'tester',
  displayName: 'Tester',
  isAdmin: false,
  activityDisplayMode: 'named',
} as unknown as User;

beforeEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  // No stored/session shell preference: the resolver must fall through to the
  // 'legacy' default unless a row pins `?shell=` explicitly.
  useShellPreferenceStore.setState({ preference: null, sessionOverride: null });
  useAuthStore.setState({ user: authedUser, isLoading: false });
  useNotificationStore.setState({ unreadCount: 0, centerOpen: false, fetchNotifications: vi.fn(), openCenter: vi.fn() });
  useSettingsPanelStore.setState({ isOpen: false });
  useJoinRequestStore.setState({ pendingCount: 0, fetchGroupRequests: vi.fn() });
  useStaticGroupStore.setState({ groups: [], currentGroup: null, fetchGroups: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The real App route shape, with page bodies replaced by sentinels. */
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<div data-testid="page-body" />} />
              <Route path="dashboard" element={<div data-testid="page-body" />} />
              <Route path="discover" element={<div data-testid="page-body" />} />
              <Route path="profile" element={<div data-testid="page-body" />} />
              <Route path="docs" element={<div data-testid="page-body" />} />
              <Route path="admin" element={<div data-testid="page-body" />} />
              <Route path="group/:shareCode" element={<div data-testid="page-body" />} />
              <Route path="*" element={<div data-testid="page-body" />} />
            </Route>
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const rail = () => screen.queryByRole('navigation', { name: 'Primary navigation' });
const topBar = () => screen.queryByTestId('non-group-topbar');
const header = () => screen.queryByTestId('legacy-header');
const dockToggle = () => screen.queryByTestId('settings-dock-toggle');

/** Every route class Layout owns (the `/` exclusion is asserted separately). */
const NON_ROOT_ROUTES = ['/profile', '/discover', '/docs', '/dashboard', '/admin', '/group/ABC', '/nope-404'];

describe('Layout chrome — no `?shell=` param (the default population)', () => {
  it.each(['/', ...NON_ROOT_ROUTES])('%s renders the legacy Header + dock toggle and no v2 chrome', (path) => {
    renderAt(path);
    expect(header()).toBeInTheDocument();
    expect(dockToggle()).toBeInTheDocument();
    expect(rail()).toBeNull();
    expect(topBar()).toBeNull();
    // The page body still renders — the branch decision never gates content.
    expect(screen.getByTestId('page-body')).toBeInTheDocument();
  });
});

describe('Layout chrome — `?shell=legacy` (explicit opt-out)', () => {
  it.each(['/group/ABC', '/profile'])('%s keeps the legacy Header', (path) => {
    renderAt(`${path}?shell=legacy`);
    expect(header()).toBeInTheDocument();
    expect(dockToggle()).toBeInTheDocument();
    expect(rail()).toBeNull();
  });
});

describe('Layout chrome — `?shell=v2` off-`/` (THE COVERAGE FLIP)', () => {
  it.each(['/profile', '/discover', '/docs', '/dashboard', '/admin', '/nope-404'])(
    '%s renders the rail + NonGroupTopBar, and neither the Header nor the dock toggle',
    (path) => {
      renderAt(`${path}?shell=v2`);
      expect(rail()).toBeInTheDocument();
      expect(topBar()).toBeInTheDocument();
      expect(header()).toBeNull();
      // G1: the dock toggle is replaced by the top bar's SettingsGear.
      expect(dockToggle()).toBeNull();
      expect(screen.getByTestId('page-body')).toBeInTheDocument();
    },
  );

  it('the group route gets the rail but NOT the NonGroupTopBar (the route supplies its own)', () => {
    renderAt('/group/ABC?shell=v2');
    expect(rail()).toBeInTheDocument();
    expect(topBar()).toBeNull();
    expect(screen.getByTestId('chrome-topbar-slot')).toBeInTheDocument();
    expect(header()).toBeNull();
  });

  it('mounts the account settings panel and keeps chrome outside the page body', () => {
    renderAt('/profile?shell=v2');
    expect(screen.getByTestId('global-settings-panel')).toBeInTheDocument();
    // Structural guarantee: the host owns the single #main-content, and the
    // routed body lives inside it while the chrome does not.
    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    expect(main).toContainElement(screen.getByTestId('page-body'));
    expect(main).not.toContainElement(screen.getByTestId('non-group-topbar'));
  });
});

describe('Layout chrome — `/` stays legacy even for v2-resolved users (matrix §8 / G2)', () => {
  it('renders the legacy Header and no v2 chrome on the home page', () => {
    renderAt('/?shell=v2');
    expect(header()).toBeInTheDocument();
    expect(dockToggle()).toBeInTheDocument();
    expect(rail()).toBeNull();
    expect(topBar()).toBeNull();
  });
});

describe('Layout chrome — a stored v2 preference flips the chrome without a URL param', () => {
  it('/profile with preference=v2 and no param is chromed', () => {
    useShellPreferenceStore.setState({ preference: 'v2', sessionOverride: null });
    renderAt('/profile');
    expect(rail()).toBeInTheDocument();
    expect(topBar()).toBeInTheDocument();
    expect(header()).toBeNull();
  });
});

describe('Layout chrome — guest under v2 (H12 + RC4)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false });
  });

  it('/discover shows a LoginButton in the top bar and no bell/gear', () => {
    renderAt('/discover?shell=v2');
    const bar = within(screen.getByTestId('non-group-topbar'));
    expect(bar.getAllByRole('button', { name: /login with discord/i }).length).toBeGreaterThan(0);
    expect(bar.queryByRole('button', { name: /^Notifications/ })).toBeNull();
    expect(bar.queryByRole('button', { name: 'Settings' })).toBeNull();
    // Guest rail: Static Finder only, and no footer user menu.
    expect(rail()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Player Hub' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Static Finder' })).toBeInTheDocument();
  });
});

describe('Layout chrome — pre-hydration auth slot (H13)', () => {
  it('renders the pulse skeleton, never a LoginButton flash', () => {
    vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
    useAuthStore.setState({ user: null, isLoading: false });
    renderAt('/profile?shell=v2');
    expect(screen.getAllByTestId('auth-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /login with discord/i })).toBeNull();
  });
});

/**
 * PR-2 director nit #3: every other suite that asserts the escape item mounts
 * the chrome context by hand. This row proves the SHIPPED host publishes it —
 * real Layout → real AppChrome → real AppRail footer → real UserMenu.
 */
describe('Layout chrome — the v2→legacy escape hatch under the REAL host (H14/G2)', () => {
  // Two real UserMenus are in the v2 DOM off-group — the rail footer (desktop)
  // and the mobile top bar — so each row scopes to the one it means. Only one
  // is ever visible at a time in a browser (`hidden sm:flex` / `sm:hidden`).
  it('the rail footer user menu offers "Switch to classic UI" off-group', async () => {
    renderAt('/profile?shell=v2');
    const railMenu = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
      .getByRole('button', { name: /user menu for/i });
    fireEvent.keyDown(railMenu, { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: /switch to classic ui/i })).toBeInTheDocument();
  });

  it('the mobile top-bar user menu offers it too (the only menu below sm)', async () => {
    renderAt('/profile?shell=v2');
    const mobileMenu = within(screen.getByTestId('non-group-topbar-mobile'))
      .getByRole('button', { name: /user menu for/i });
    fireEvent.keyDown(mobileMenu, { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: /switch to classic ui/i })).toBeInTheDocument();
    // M2: the mobile-only community links ride along in that same menu.
    expect(screen.getByRole('menuitem', { name: /join our discord/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /view on github/i })).toBeInTheDocument();
  });

  it('the legacy Header path never publishes the context (no escape item on `/`)', () => {
    renderAt('/?shell=v2');
    // The legacy Header is stubbed here, so there is no menu at all to open —
    // which is the point: nothing inside the legacy branch is wrapped in the
    // chrome provider. Pinned end-to-end for the real menu in
    // UserMenu.shellToggle.test.tsx's without-provider rows.
    expect(screen.queryByRole('button', { name: /user menu for/i })).toBeNull();
  });
});
