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
import { MemoryRouter } from 'react-router-dom';
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

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <TooltipProvider>
        <UserMenu />
      </TooltipProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
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
    track.mockRestore();
  });
});
