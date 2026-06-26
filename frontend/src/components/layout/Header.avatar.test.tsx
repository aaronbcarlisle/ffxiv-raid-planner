/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../hooks/useTheme';

vi.mock('../auth', () => ({ UserMenu: () => <div data-testid="header-usermenu">U</div>, LoginButton: () => <div>login</div> }));
// minimal store mocks: signed-in user, not a group route
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }),
  useAuthHydrated: () => true,
}));
vi.mock('../../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup: null, groups: [], fetchGroups: vi.fn() }) }));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));

import { Header } from './Header';

beforeEach(() => {
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

describe('Header avatar gating', () => {
  it('renders the desktop avatar wrapper as sm:hidden when the rail is present (signed in)', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}><Header /></MemoryRouter>
      </ThemeProvider>
    );
    const menu = screen.getByTestId('header-usermenu');
    // wrapper is hidden on desktop when rail present
    expect(menu.closest('[data-rail-present="true"]')).toBeTruthy();
  });
});
