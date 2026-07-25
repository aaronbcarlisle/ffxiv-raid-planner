/**
 * AppChrome — the Stage-1 T3 chrome host (retargeted from NewShell.rail.test).
 *
 * Covers the host-owned rail behavior that moved out of NewShell:
 *   • rail avatar static-switch restores saved tabs (Task 7 follow-up, FIX 3 —
 *     the buildStaticNavHref repoint, kept verbatim from the NewShell suite);
 *   • Person-layer entries navigate to real routes with REAL `isActive`
 *     (the host sees every route, unlike NewShell's hardcoded false);
 *   • the M1 logo link — authed → /profile ("Player Hub"), guest → /
 *     ("FFXIV Raid Planner — home") — accessible name matches the target;
 *   • the §1 host contract (RC8): `currentParams` is consulted ONLY when
 *     already on /group/* — pinned with `tabPersistence: 'reset'` because
 *     `buildStaticNavHref` only reads `currentParams` on the non-remember
 *     branch (the default 'remember' preference would pass vacuously);
 *   • G5: no dangling rail divider for a zero-statics account; guest rail is
 *     logo + Static Finder only with no footer UserMenu;
 *   • the portal slot containers: children portal into the host-owned nodes,
 *     and unmounting the portaling child leaves the containers EMPTY (the
 *     group-route placeholder styling, `empty:h-14`, takes over — no stale
 *     chrome content).
 *
 * Heavy mocking isolates the host wiring (stores + UserMenu); AppRail renders
 * REAL so aria-current/divider assertions hit the shipped markup.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be declared before vi.mock so the factory can close over it.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mocks = vi.hoisted(() => ({
  groups: [] as unknown[],
  fetchGroups: vi.fn(),
  user: null as { id: string; tabPersistence?: 'remember' | 'reset' } | null,
}));

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groups: mocks.groups, fetchGroups: mocks.fetchGroups }),
}));
// Dual-form + stable identity (user lives on the shared mocks object) — an
// unstable identity would re-fire the user-keyed cold-fetch effect per render.
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel?: (s: { user: unknown }) => unknown) => {
    const state = { user: mocks.user };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../../components/auth', () => ({
  UserMenu: () => <div data-testid="user-menu-stub" />,
}));

import { AppChrome } from './AppChrome';
import { useChromeSlotNodes } from './chromeSlots';

beforeEach(() => {
  mockNavigate.mockClear();
  mocks.fetchGroups.mockClear();
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
  mocks.groups = [
    { id: 'a', shareCode: 'ABC', name: 'Alpha Static' },
    { id: 'b', shareCode: 'XYZ', name: 'Beta Static' },
  ];
  mocks.user = { id: 'u1' };
});

function renderChrome(initialEntry: string, children: React.ReactNode = <div data-testid="content" />) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        {/* Catch-all: AppChrome keys on useLocation/matchPath, not useParams,
            so one splat route exercises every pathname. */}
        <Route path="*" element={<AppChrome>{children}</AppChrome>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppChrome rail avatar static-switch — restores saved tabs', () => {
  it('restores the target static\'s saved tab (remember ON, the default)', () => {
    localStorage.setItem('static-nav-XYZ', 'tab=loot&sub=weapon');
    renderChrome('/group/ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ?tab=loot&sub=weapon');
  });

  it('falls back to a bare href when there is no saved tab for the target static', () => {
    renderChrome('/group/ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ');
  });
});

describe('AppChrome rail Person-layer entries — navigate to real routes (Phase A, A5a)', () => {
  it('Player Hub navigates to /profile', () => {
    renderChrome('/group/ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Player Hub' }));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('Static Finder navigates to /discover', () => {
    renderChrome('/group/ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Static Finder' }));
    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });
});

describe('AppChrome rail entries — real isActive per route', () => {
  it('on /group/:shareCode the matching avatar is current and Person entries are not', () => {
    renderChrome('/group/ABC');
    expect(screen.getByRole('button', { name: 'Alpha Static' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Beta Static' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Player Hub' })).not.toHaveAttribute('aria-current');
  });

  it('on /profile the Player Hub entry is current (no longer hardcoded false)', () => {
    renderChrome('/profile');
    expect(screen.getByRole('button', { name: 'Player Hub' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Alpha Static' })).not.toHaveAttribute('aria-current');
  });

  it('on /discover the Static Finder entry is current', () => {
    renderChrome('/discover');
    expect(screen.getByRole('button', { name: 'Static Finder' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Player Hub' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppChrome logo link (M1)', () => {
  it('authed: logo links to /profile with the accessible name "Player Hub"', () => {
    renderChrome('/group/ABC');
    const logo = screen.getByRole('link', { name: 'Player Hub' });
    expect(logo).toHaveAttribute('href', '/profile');
  });

  it('guest: logo links to / with the accessible name "FFXIV Raid Planner — home"', () => {
    mocks.user = null;
    mocks.groups = [];
    renderChrome('/discover');
    const logo = screen.getByRole('link', { name: 'FFXIV Raid Planner — home' });
    expect(logo).toHaveAttribute('href', '/');
  });
});

describe('AppChrome §1 host contract — currentParams only on /group/* (RC8)', () => {
  // tabPersistence: 'reset' is REQUIRED for these to be non-vacuous:
  // buildStaticNavHref consults `currentParams` only on the non-remember
  // branch; the default 'remember' preference never reads it, so a
  // default-preference test would pass against the leaky unconditional pass.
  it('rail avatar clicked from /profile?tab=jobs-gear yields /group/CODE with NO foreign params', () => {
    mocks.user = { id: 'u1', tabPersistence: 'reset' };
    renderChrome('/profile?tab=jobs-gear');
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ');
  });

  it('rail avatar clicked from /group/ABC?tab=loot still carries the current tab across (ContextSwitcher semantics)', () => {
    mocks.user = { id: 'u1', tabPersistence: 'reset' };
    renderChrome('/group/ABC?tab=loot');
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ?tab=loot');
  });
});

describe('AppChrome empty-state rail (G5) + guest rail', () => {
  it('suppresses the divider when the statics list is empty (zero-statics account)', () => {
    mocks.groups = [];
    const { container } = renderChrome('/profile');
    expect(container.querySelector('hr')).toBeNull();
    // Person entries and the footer UserMenu are still there for an authed user.
    expect(screen.getByRole('button', { name: 'Player Hub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Static Finder' })).toBeInTheDocument();
    expect(screen.getByTestId('user-menu-stub')).toBeInTheDocument();
  });

  it('renders the divider when statics exist', () => {
    const { container } = renderChrome('/group/ABC');
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('guest rail: logo + Static Finder only — no Player Hub, no avatars, no footer UserMenu', () => {
    mocks.user = null;
    mocks.groups = [];
    const { container } = renderChrome('/discover');
    expect(screen.queryByRole('button', { name: 'Player Hub' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Static Finder' })).toBeInTheDocument();
    expect(screen.queryByTestId('user-menu-stub')).toBeNull();
    expect(container.querySelector('hr')).toBeNull();
  });
});

/** Consumes the published slot nodes exactly like NewShell does. */
function SlotProbe() {
  const { topBar, spine } = useChromeSlotNodes();
  return (
    <>
      {topBar !== null ? createPortal(<div data-testid="probe-topbar" />, topBar) : null}
      {spine !== null ? createPortal(<div data-testid="probe-spine" />, spine) : null}
    </>
  );
}

describe('AppChrome portal slots', () => {
  it('children portal into the host-owned containers; #main-content hosts the routed content', () => {
    renderChrome('/group/ABC', <><div data-testid="content" /><SlotProbe /></>);
    expect(screen.getByTestId('chrome-topbar-slot')).toContainElement(screen.getByTestId('probe-topbar'));
    expect(screen.getByTestId('chrome-spine-slot')).toContainElement(screen.getByTestId('probe-spine'));
    // Structural guarantee: the host owns the page's single #main-content.
    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    expect(main).toContainElement(screen.getByTestId('content'));
  });

  it('unmounting the portaling child leaves the containers empty (placeholder returns, no stale content)', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/group/ABC']}>
        <Routes>
          <Route path="*" element={<AppChrome><SlotProbe /></AppChrome>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('probe-topbar')).toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={['/group/ABC']}>
        <Routes>
          <Route path="*" element={<AppChrome>{null}</AppChrome>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('probe-topbar')).toBeNull();
    expect(screen.getByTestId('chrome-topbar-slot').childElementCount).toBe(0);
    expect(screen.getByTestId('chrome-spine-slot').childElementCount).toBe(0);
  });

  it('the top-bar container carries the empty-placeholder sizing on group routes only', () => {
    renderChrome('/group/ABC');
    expect(screen.getByTestId('chrome-topbar-slot').className).toContain('empty:h-14');
  });

  it('non-group routes get no group placeholder bar', () => {
    renderChrome('/profile');
    expect(screen.getByTestId('chrome-topbar-slot').className).not.toContain('empty:h-14');
  });
});
