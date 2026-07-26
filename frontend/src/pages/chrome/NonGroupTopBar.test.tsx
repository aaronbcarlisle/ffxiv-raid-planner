/**
 * @vitest-environment jsdom
 *
 * NonGroupTopBar — the off-group v2 top bar (Stage-1 T4).
 *
 * Covers the matrix rows this bar owns:
 *   • H2/H3 — page identity per route class;
 *   • H8/H9/H10 — Discord + GitHub + ThemeToggle on the desktop row (and on the
 *     GUEST mobile row, which has no user menu to hold them);
 *   • H7/H15/G1 — bell + SettingsGear, the gear writing settingsPanelStore
 *     (the re-homed desktop account-settings affordance);
 *   • RC4 — the guest branch gates bell AND gear off, not just the auth slot;
 *   • H12/H13 — LoginButton for guests, the pulse skeleton before hydration /
 *     while auth is loading, and NO desktop UserMenu for authed users (that one
 *     lives in the AppRail footer — a second would be a double menu).
 *
 * REAL: the bar, NotificationBell, SettingsGear, ThemeToggle, LoginButton and
 * the Zustand stores (seeded via setState; nothing hits the network at render).
 * STUBBED: UserMenu only — its Radix dropdown + API-key modal are covered by
 * `UserMenu.shellToggle.test.tsx` and are not what this bar is responsible for.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/auth')>()),
  UserMenu: () => <div data-testid="user-menu-stub" />,
}));

import { NonGroupTopBar } from './NonGroupTopBar';
import { TooltipProvider } from '../../components/primitives';
import { ThemeProvider } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { DISCORD_INVITE_URL, GITHUB_REPO_URL } from '../../config';
import type { User } from '../../types';

const authedUser = {
  id: 'u1',
  discordId: '123456789',
  discordUsername: 'tester',
  displayName: 'Tester',
  isAdmin: false,
} as unknown as User;

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
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
  useAuthStore.setState({ user: authedUser, isLoading: false });
  useNotificationStore.setState({ unreadCount: 0, centerOpen: false, openCenter: vi.fn() });
  useSettingsPanelStore.setState({ isOpen: false });
  useJoinRequestStore.setState({ pendingCount: 0, fetchGroupRequests: vi.fn() });
  useStaticGroupStore.setState({ currentGroup: null, groups: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBar(path = '/profile') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <TooltipProvider>
          <NonGroupTopBar />
        </TooltipProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const desktop = () => within(screen.getByTestId('non-group-topbar-desktop'));
const mobile = () => within(screen.getByTestId('non-group-topbar-mobile'));

describe('NonGroupTopBar — page identity (H2/H3)', () => {
  it.each([
    ['/profile', 'Player Hub'],
    ['/profile/ABCDEF', 'Player Profile'],
    ['/discover', 'Static Finder'],
    ['/dashboard', 'Dashboard'],
    ['/docs', 'Docs'],
    ['/docs/faq', 'Docs'],
    ['/design-system', 'Docs'],
    ['/admin', 'Admin'],
    ['/admin/statics', 'Admin'],
    ['/this-route-does-not-exist', 'FFXIV Raid Planner'],
  ])('%s → "%s"', (path, identity) => {
    renderBar(path);
    expect(desktop().getByText(identity)).toBeInTheDocument();
  });
});

describe('NonGroupTopBar — desktop cluster, authed', () => {
  it('carries Discord, GitHub, theme, bell and gear', () => {
    renderBar();
    const row = desktop();
    expect(row.getByRole('link', { name: 'Join our Discord community' })).toHaveAttribute('href', DISCORD_INVITE_URL);
    expect(row.getByRole('link', { name: 'View source on GitHub' })).toHaveAttribute('href', GITHUB_REPO_URL);
    expect(row.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /^Notifications/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens external links in a new tab with noopener (mirrors the legacy Header)', () => {
    renderBar();
    const discord = desktop().getByRole('link', { name: 'Join our Discord community' });
    expect(discord).toHaveAttribute('target', '_blank');
    expect(discord).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does NOT render a desktop UserMenu — that one lives in the AppRail footer (H11)', () => {
    renderBar();
    expect(desktop().queryByTestId('user-menu-stub')).toBeNull();
    expect(desktop().queryByRole('button', { name: /login with discord/i })).toBeNull();
  });

  it('the gear toggles the settings panel open-state (G1 re-home)', () => {
    renderBar();
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    fireEvent.click(desktop().getByRole('button', { name: 'Settings' }));
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
  });

  it('the bell opens the app-level notification center', () => {
    renderBar();
    const openCenter = useNotificationStore.getState().openCenter;
    fireEvent.click(desktop().getByRole('button', { name: /^Notifications/ }));
    expect(openCenter).toHaveBeenCalledTimes(1);
  });
});

describe('NonGroupTopBar — guest branch (H12 + RC4)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false });
  });

  it('desktop guest: identity + Discord/GitHub + theme + LoginButton, and NO bell or gear', () => {
    renderBar('/discover');
    const row = desktop();
    expect(row.getByText('Static Finder')).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'Join our Discord community' })).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'View source on GitHub' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /login with discord/i })).toBeInTheDocument();
    // RC4: V1 gates both of these on `user`; a guest bell/gear would be a NEW
    // dead affordance (the panel they open renders null for guests).
    expect(row.queryByRole('button', { name: /^Notifications/ })).toBeNull();
    expect(row.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('mobile guest: logo → /, community links + theme + LoginButton, no bell/gear/menu', () => {
    renderBar('/discover');
    const row = mobile();
    expect(row.getByRole('link', { name: 'FFXIV Raid Planner — home' })).toHaveAttribute('href', '/');
    expect(row.getByRole('link', { name: 'Join our Discord community' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /login with discord/i })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: /^Notifications/ })).toBeNull();
    expect(row.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(row.queryByTestId('user-menu-stub')).toBeNull();
  });

  it('a guest on the public-profile share target still gets a login affordance (§4)', () => {
    renderBar('/profile/ABCDEF');
    expect(desktop().getByRole('button', { name: /login with discord/i })).toBeInTheDocument();
  });
});

describe('NonGroupTopBar — mobile row, authed', () => {
  it('logo → /profile, bell, gear and the avatar menu (the only menu below sm)', () => {
    renderBar();
    const row = mobile();
    expect(row.getByRole('link', { name: 'Player Hub — home' })).toHaveAttribute('href', '/profile');
    expect(row.getByRole('button', { name: /^Notifications/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(row.getByTestId('user-menu-stub')).toBeInTheDocument();
  });

  it('leaves Discord/GitHub/theme to the user menu (M2 de-dup)', () => {
    renderBar();
    const row = mobile();
    expect(row.queryByRole('link', { name: 'Join our Discord community' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Toggle theme' })).toBeNull();
  });
});

describe('NonGroupTopBar — auth-loading skeleton (H13)', () => {
  it('renders the pulse placeholder while the auth store is loading', () => {
    useAuthStore.setState({ user: null, isLoading: true });
    renderBar();
    expect(screen.getAllByTestId('auth-skeleton').length).toBeGreaterThan(0);
    // Critically: no LoginButton flash for a user who IS signed in.
    expect(screen.queryByRole('button', { name: /login with discord/i })).toBeNull();
  });

  it('renders the pulse placeholder before the persisted store has hydrated', () => {
    vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
    useAuthStore.setState({ user: null, isLoading: false });
    renderBar();
    expect(screen.getAllByTestId('auth-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /login with discord/i })).toBeNull();
  });

  it('resolves to the guest LoginButton once hydration completes', () => {
    useAuthStore.setState({ user: null, isLoading: false });
    renderBar();
    expect(screen.queryByTestId('auth-skeleton')).toBeNull();
    expect(desktop().getByRole('button', { name: /login with discord/i })).toBeInTheDocument();
  });

  it('mobile row renders NEITHER cluster pre-hydration — no guest-links flash for authed users (M8)', () => {
    vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
    useAuthStore.setState({ user: null, isLoading: false });
    renderBar();
    const row = mobile();
    // Not the guest cluster (would swap to bell/gear a beat later for an
    // authed user — the wrong-affordance flash class H13 forbids)…
    expect(row.queryByRole('link', { name: 'Join our Discord community' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Toggle theme' })).toBeNull();
    // …and not the authed cluster either. Logo + skeleton only.
    expect(row.queryByRole('button', { name: /^Notifications/ })).toBeNull();
    expect(row.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(row.getByTestId('auth-skeleton')).toBeInTheDocument();
  });
});
