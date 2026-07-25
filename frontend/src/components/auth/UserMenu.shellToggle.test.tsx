/**
 * UserMenu — shell-toggle items.
 *
 * "Switch to classic UI" (Phase R §5, rekeyed Stage-1 T1 per matrix H14/G2):
 * gated on the V2ChromeContext chrome signal, NOT on route or resolvedShell.
 * The provider is mounted only by the v2 chrome host (NewShell today, AppChrome
 * after T3), so the item renders in every v2-chromed menu on ANY route and is
 * structurally impossible in the legacy Header's UserMenu — including for
 * v2-resolved users on `/`, where the legacy Header still renders (the G2
 * no-leak case, pinned explicitly below). Selecting it must still route
 * through useShellToggle('v2-user-menu') with target 'legacy'.
 *
 * Discord/GitHub community links (matrix M2): chrome-context gated,
 * `sm:hidden` (mobile-v2 re-home only; desktop v2 carries the links in the
 * top bar), opened via window.open with noopener,noreferrer.
 *
 * "Try the new UI" (S1 + D7 launch gate): unchanged legacy-side gates.
 *
 * Radix DropdownMenu trigger is driven via keyDown per established convention
 * (see SessionList.test.tsx / WeekScopeControl.test.tsx) — a plain click does
 * not flip the trigger's data-state in jsdom.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { TooltipProvider } from '../primitives';
import { useShellPreferenceStore } from '../../lib/shellPreference';
import { V2ChromeContext } from '../../lib/chromeContext';
import { DISCORD_INVITE_URL, GITHUB_REPO_URL } from '../../config';
import { analytics } from '../../services/analytics';

// isAdmin is mutable so the S1 launch-gate rows (D7: admin-only until Stage 1)
// can flip it per test; default true keeps the S1 rendering rows exercising the
// item's own gates rather than the launch gate.
const authMock = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('../../stores/authStore', () => {
  const authState = () => ({
    user: { id: 'u1', discordId: '123456789', discordUsername: 'tester', displayName: 'Tester', isAdmin: authMock.isAdmin, activityDisplayMode: 'named' },
    logout: vi.fn(), updatePreferences: vi.fn().mockResolvedValue(undefined),
  });
  const useAuthStoreMock = () => authState();
  // shellPreference.ts's setPreference reads useAuthStore.getState() directly
  // (Task 8's backend mirror) — the mock must support both call forms.
  useAuthStoreMock.getState = () => authState();
  return { useAuthStore: useAuthStoreMock };
});
vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({ unreadCount: 0, fetchNotifications: vi.fn() }),
}));
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => null }));

function openMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: /user menu/i }), { key: 'Enter' });
}

// Captures the live MemoryRouter location as a data attribute so tests can
// assert on the real URL (see StaticPicker.test.tsx for the same pattern).
function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="loc" data-path={loc.pathname + loc.search} />;
}

/** `inV2Chrome: true` wraps the menu in the V2ChromeContext provider, exactly
 *  as the v2 chrome host does; omitted = the legacy render shape (no provider
 *  anywhere in the tree, default `false`). */
function renderAt(
  url: string,
  opts: { variant?: 'header' | 'rail'; inV2Chrome?: boolean } = {},
) {
  const menu = (
    <TooltipProvider>
      <UserMenu variant={opts.variant} />
    </TooltipProvider>
  );
  return render(
    <MemoryRouter initialEntries={[url]}>
      {opts.inV2Chrome ? (
        <V2ChromeContext.Provider value={true}>{menu}</V2ChromeContext.Provider>
      ) : (
        menu
      )}
      <LocationDisplay />
    </MemoryRouter>
  );
}

beforeEach(() => {
  // The strip test's setPreference persists ui-shell to localStorage; clear it
  // so test order can never leak a stored preference into the resolver. The S2
  // session-override tier (sessionStorage) resolves ABOVE the preference, so it
  // must be reset too or a leaked override flips useResolvedShell mid-suite.
  localStorage.clear();
  sessionStorage.clear();
  useShellPreferenceStore.setState({ preference: null, sessionOverride: null });
  // jsdom has no matchMedia; emulate a desktop environment (see RosterCard.test.tsx).
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
    }))
  );
});

describe('UserMenu — Switch to classic UI (chrome-context keyed, H14/G2)', () => {
  it('renders inside v2 chrome on a group route', async () => {
    renderAt('/group/ABC?shell=v2', { inV2Chrome: true });
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /switch to classic ui/i })).toBeInTheDocument();
  });

  it('renders inside v2 chrome on a NON-group route (the isGroupRoute gate is gone)', async () => {
    renderAt('/profile', { inV2Chrome: true });
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /switch to classic ui/i })).toBeInTheDocument();
  });

  it('does not render without the provider on a legacy-resolved group route', () => {
    renderAt('/group/ABC');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /switch to classic ui/i })).toBeNull();
  });

  it('G2 no-leak: does not render without the provider even when the resolved shell is v2 (legacy Header on /)', () => {
    // A v2-preference user on `/` still gets the legacy Header (the excluded
    // route) — its UserMenu has no provider, so the item must stay hidden even
    // though useResolvedShell() returns 'v2'. This is the exact leak a bare
    // resolvedShell gate would have caused.
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /switch to classic ui/i })).toBeNull();
  });

  it('selecting it fires the to-legacy toggle: telemetry + preference + strips ?shell=', async () => {
    const track = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    renderAt('/group/ABC?shell=v2', { inV2Chrome: true });
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /switch to classic ui/i }));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-legacy', surface: 'v2-user-menu' });
    expect(useShellPreferenceStore.getState().preference).toBe('legacy');
    // Assert the ?shell= override was really stripped from the live URL —
    // without the strip, ?shell=v2 would keep out-resolving the new preference.
    const path = screen.getByTestId('loc').getAttribute('data-path');
    expect(path).toBe('/group/ABC');
    expect(path).not.toContain('shell=');
    track.mockRestore();
  });
});

describe('UserMenu — Discord/GitHub community links (M2, mobile-v2 re-home)', () => {
  it('renders "Join our Discord" inside v2 chrome with sm:hidden, opening the invite URL', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderAt('/profile', { inV2Chrome: true });
    openMenu();
    const discord = await screen.findByRole('menuitem', { name: /join our discord/i });
    // sm:hidden = mobile-only: the desktop v2 top bar carries the same links,
    // so the menu copy must not duplicate them at ≥sm (director-mandated).
    expect(discord.className).toContain('sm:hidden');
    fireEvent.click(discord);
    expect(open).toHaveBeenCalledWith(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('renders "View on GitHub" inside v2 chrome with sm:hidden, opening the repo URL', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderAt('/profile', { inV2Chrome: true });
    openMenu();
    const github = await screen.findByRole('menuitem', { name: /view on github/i });
    expect(github.className).toContain('sm:hidden');
    fireEvent.click(github);
    expect(open).toHaveBeenCalledWith(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('does not render either item without the provider (legacy menu byte-identical)', () => {
    renderAt('/group/ABC');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /join our discord/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /view on github/i })).toBeNull();
  });
});

describe('UserMenu — Try the new UI (legacy→v2 entry, S1)', () => {
  beforeEach(() => { authMock.isAdmin = true; });

  it('does not render for a non-admin user (D7 launch gate)', () => {
    authMock.isAdmin = false;
    renderAt('/group/ABC');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /try the new ui/i })).toBeNull();
  });

  it('renders when on a group route resolved to legacy', async () => {
    renderAt('/group/ABC');
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /try the new ui/i })).toBeInTheDocument();
  });

  it('does not render on a group route resolved to v2', () => {
    renderAt('/group/ABC?shell=v2');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /try the new ui/i })).toBeNull();
  });

  it('does not render off a group route, even when resolved to legacy', () => {
    renderAt('/profile');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /try the new ui/i })).toBeNull();
  });

  it('is absent from the v2 rail (mutually exclusive with the return path)', () => {
    // The rail only mounts inside v2 chrome; the entry is gated to legacy
    // resolution, so it can never appear there (director checklist #5).
    renderAt('/group/ABC?shell=v2', { variant: 'rail', inV2Chrome: true });
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /try the new ui/i })).toBeNull();
  });

  it('selecting it fires the to-v2 toggle: telemetry (legacy-user-menu surface) + preference', async () => {
    const track = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    renderAt('/group/ABC');
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /try the new ui/i }));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-v2', surface: 'legacy-user-menu' });
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    track.mockRestore();
  });
});
