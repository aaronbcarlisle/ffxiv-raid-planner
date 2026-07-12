/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../hooks/useTheme';

vi.mock('../auth', () => ({ UserMenu: () => <div data-testid="header-usermenu">U</div>, LoginButton: () => <div>login</div> }));
// minimal store mocks: signed-in user; currentGroup is switchable (hoisted) so
// the group-route cases can simulate a loaded static.
const mocks = vi.hoisted(() => ({
  currentGroup: null as Record<string, unknown> | null,
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }),
  useAuthHydrated: () => true,
}));
vi.mock('../../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup: mocks.currentGroup, groups: [], fetchGroups: vi.fn() }) }));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));
// Structural stubs for the group-route renders: this suite asserts Header's own
// responsive wrappers, not these leaves. The banner stub surfaces the className
// Header passes it (the mobile instance carries the below-sm classes; the
// banner's own self-gating is covered by TryNewUiBanner.test.tsx).
vi.mock('./TryNewUiBanner', () => ({
  TryNewUiBanner: ({ className }: { className?: string }) => (
    <div data-testid="try-banner-stub" className={className} />
  ),
}));
vi.mock('../static-group', () => ({
  StaticSwitcher: () => <div data-testid="static-switcher-stub" />,
  TierSelector: () => null,
}));
vi.mock('../ui', () => ({
  TierActionsMenu: () => null,
  TipsCarousel: () => null,
  DiscordIcon: () => null,
  GitHubIcon: () => null,
  ThemeToggle: () => null,
}));

import { Header } from './Header';

beforeEach(() => {
  mocks.currentGroup = null;
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

function renderHeaderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}><Header /></MemoryRouter>
    </ThemeProvider>
  );
}

function userMenuWrapper(): HTMLElement {
  return screen.getByTestId('header-usermenu').closest('[data-rail-present]') as HTMLElement;
}

describe('Header avatar gating — routes WITHOUT their own rail keep the header UserMenu', () => {
  // /profile/SOMECODE is PublicProfile (someone else's shared profile, no rail)
  // — it must NOT be swallowed by a startsWith('/profile') match.
  it.each(['/dashboard', '/discover', '/docs', '/profile/SOMECODE'])(
    'shows the header UserMenu at all widths on %s (no rail there)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('false');
      expect(wrapper.className).not.toContain('sm:hidden');
    },
  );
});

describe('Header avatar gating — routes WITH their own rail hide the desktop avatar', () => {
  // Group routes (both shells render a rail/sidebar UserMenu) and the own
  // Player Hub at exactly /profile (ProfileSidebarNav → SidebarRail footer).
  it.each(['/group/ABC', '/profile'])(
    'hides the header UserMenu on desktop on %s (route renders its own rail UserMenu)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('true');
      expect(wrapper.className).toContain('sm:hidden');
    },
  );
});

describe('Header mobile shell opt-in row (Phase A, A5c)', () => {
  // jsdom can't evaluate media queries — assert the responsive classNames and
  // structure, per this suite's conventions. The stub bypasses the banner's
  // self-gating, so BOTH instances render whenever Header mounts them.
  it('mounts a second, below-sm TryNewUiBanner instance on a loaded group route', () => {
    mocks.currentGroup = { id: 'g1', name: 'S', userRole: 'owner' };
    renderHeaderAt('/group/ABC');
    const banners = screen.getAllByTestId('try-banner-stub');
    expect(banners).toHaveLength(2);
    // Desktop instance: unchanged, inside the `hidden sm:block` wrapper.
    expect(banners.some((b) => b.parentElement?.className === 'hidden sm:block')).toBe(true);
    // Mobile instance: the banner itself carries the below-sm classes (no
    // wrapper div, so a dismissed banner leaves no phantom flex-wrap row).
    expect(banners.map((b) => b.className)).toContain('sm:hidden w-full');
  });

  it('renders no banner instances off group routes', () => {
    renderHeaderAt('/dashboard');
    expect(screen.queryAllByTestId('try-banner-stub')).toHaveLength(0);
  });
});
