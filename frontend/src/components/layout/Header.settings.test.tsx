/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../hooks/useTheme';

vi.mock('../auth', () => ({ UserMenu: () => <div>U</div>, LoginButton: () => <div>login</div> }));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }),
  useAuthHydrated: () => true,
}));
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({ currentGroup: { id: 'g1', name: 'S', userRole: 'owner' }, groups: [], fetchGroups: vi.fn() }),
}));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));

import { Header } from './Header';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
});

function renderHeaderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}><Header /></MemoryRouter>
    </ThemeProvider>
  );
}

describe('Header settings toggle', () => {
  it('dispatches a settings toggle event when the gear is clicked', () => {
    const handler = vi.fn();
    window.addEventListener('header:settings', handler);
    renderHeaderAt('/group/abc');
    fireEvent.click(screen.getByLabelText(/static settings/i));
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0][0] as CustomEvent;
    expect(ev.detail?.toggle).toBe(true);
    window.removeEventListener('header:settings', handler);
  });

  it('reflects the open-state from the URL via aria-expanded', () => {
    renderHeaderAt('/group/abc?showSettings=true');
    expect(screen.getByLabelText(/static settings/i)).toHaveAttribute('aria-expanded', 'true');
  });

  it('is collapsed when the settings param is absent', () => {
    renderHeaderAt('/group/abc');
    expect(screen.getByLabelText(/static settings/i)).toHaveAttribute('aria-expanded', 'false');
  });
});
