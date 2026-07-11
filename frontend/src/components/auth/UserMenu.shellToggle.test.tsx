/**
 * UserMenu — "Switch to classic UI" item (Phase R §5, v2→legacy return path).
 * Gated on: pathname starts with /group/ AND the resolved shell is v2.
 * Selecting it must route through useShellToggle('v2-user-menu') with target 'legacy'.
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
import { analytics } from '../../services/analytics';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', discordId: '123456789', discordUsername: 'tester', displayName: 'Tester', isAdmin: false, activityDisplayMode: 'named' },
    logout: vi.fn(), updatePreferences: vi.fn(),
  }),
}));
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

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <TooltipProvider>
        <UserMenu />
      </TooltipProvider>
      <LocationDisplay />
    </MemoryRouter>
  );
}

beforeEach(() => {
  // The strip test's setPreference persists ui-shell to localStorage; clear it
  // so test order can never leak a stored preference into the resolver.
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
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

describe('UserMenu — Switch to classic UI', () => {
  it('renders when on a group route resolved to v2', async () => {
    renderAt('/group/ABC?shell=v2');
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /switch to classic ui/i })).toBeInTheDocument();
  });

  it('does not render on a group route resolved to legacy', () => {
    renderAt('/group/ABC');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /switch to classic ui/i })).toBeNull();
  });

  it('does not render off a group route, even when the preference is v2', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/profile');
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /switch to classic ui/i })).toBeNull();
  });

  it('selecting it fires the to-legacy toggle: telemetry + preference + strips ?shell=', async () => {
    const track = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    renderAt('/group/ABC?shell=v2');
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
