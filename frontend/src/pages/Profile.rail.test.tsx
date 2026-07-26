/**
 * @vitest-environment jsdom
 *
 * ProfileSidebarNav — including the Stage-1 T5 seam (matrix P4/M4).
 *
 * The footer UserMenu is suppressed under v2 chrome because the AppRail footer
 * already carries the identical menu. The gate is the chrome CONTEXT, whose
 * provider only ever exists inside AppChrome — so the without-provider row
 * below is the legacy pin: the legacy Player Hub keeps its footer menu.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileSidebarNav } from './Profile';
import { V2ChromeContext } from '../lib/chromeContext';

vi.mock('../components/auth', () => ({ UserMenu: () => <div>USER_MENU</div> }));

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

function renderNav(inV2Chrome?: boolean) {
  const nav = <ProfileSidebarNav activeTab="overview" onTabChange={vi.fn()} characterName="Hero" />;
  return render(
    <MemoryRouter>
      {inV2Chrome ? <V2ChromeContext.Provider value={true}>{nav}</V2ChromeContext.Provider> : nav}
    </MemoryRouter>
  );
}

describe('ProfileSidebarNav', () => {
  it('renders Player Hub items and the user-menu footer', () => {
    renderNav();
    expect(screen.getByText('Jobs & Gear')).toBeInTheDocument();
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });

  it('keeps all seven nav entries in both chrome states (P1 KEPT)', () => {
    for (const inV2Chrome of [false, true]) {
      const { unmount } = renderNav(inV2Chrome);
      for (const label of ['Overview', 'Sync & Gear', 'Jobs & Gear', 'Tracking', 'Availability', 'Share', 'My Statics']) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      unmount();
    }
  });
});

describe('ProfileSidebarNav — v2 chrome seam (P4/M4)', () => {
  it('suppresses the footer UserMenu under v2 chrome (the AppRail footer has it)', () => {
    renderNav(true);
    expect(screen.queryByText('USER_MENU')).toBeNull();
    // Everything else about the sidebar is untouched.
    expect(screen.getByText('Jobs & Gear')).toBeInTheDocument();
  });

  it('LEGACY PIN: without the provider the footer UserMenu renders exactly as before', () => {
    renderNav(false);
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });
});
