/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home, Search } from 'lucide-react';
import { AppRail } from './AppRail';
import type { RailEntry } from './railTypes';

beforeEach(() => {
  // jsdom has no matchMedia; Tooltip -> useDevice depends on it.
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

function makeEntries(onSelect = vi.fn()): RailEntry[] {
  return [
    {
      kind: 'icon',
      id: 'player-hub',
      label: 'Player Hub',
      icon: Home,
      isActive: true,
      onSelect,
    },
    {
      kind: 'icon',
      id: 'static-finder',
      label: 'Static Finder',
      icon: Search,
      isActive: false,
      onSelect,
    },
    {
      kind: 'divider',
      id: 'div-1',
    },
    {
      kind: 'avatar',
      id: 'static-1',
      label: 'My Static',
      initials: 'MS',
      isActive: false,
      onSelect,
    },
  ];
}

describe('AppRail', () => {
  it('renders a nav landmark labelled "Primary navigation"', () => {
    render(<AppRail entries={makeEntries()} />);
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
  });

  it('has w-[72px] class on the nav element', () => {
    render(<AppRail entries={makeEntries()} />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(nav.className).toContain('w-[72px]');
  });

  it('renders sr-only labels for icon items', () => {
    render(<AppRail entries={makeEntries()} />);
    expect(screen.getByText('Player Hub')).toBeInTheDocument();
    expect(screen.getByText('Static Finder')).toBeInTheDocument();
  });

  it('marks the active item with aria-current="page"', () => {
    render(<AppRail entries={makeEntries()} />);
    const activeBtn = screen.getByRole('button', { name: 'Player Hub' });
    expect(activeBtn).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current on inactive items', () => {
    render(<AppRail entries={makeEntries()} />);
    const inactiveBtn = screen.getByRole('button', { name: 'Static Finder' });
    expect(inactiveBtn).not.toHaveAttribute('aria-current');
  });

  it('renders avatar item with initials in a chip', () => {
    render(<AppRail entries={makeEntries()} />);
    expect(screen.getByText('MS')).toBeInTheDocument();
    const avatarBtn = screen.getByRole('button', { name: 'My Static' });
    expect(avatarBtn).toBeInTheDocument();
  });

  it('renders exactly one <hr> divider', () => {
    const { container } = render(<AppRail entries={makeEntries()} />);
    const hrs = container.querySelectorAll('hr');
    expect(hrs).toHaveLength(1);
  });

  it('calls onSelect when an icon item is clicked', () => {
    const onSelect = vi.fn();
    render(<AppRail entries={makeEntries(onSelect)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Player Hub' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not fire onSelect when clicking the divider (it is not interactive)', () => {
    const onSelect = vi.fn();
    const { container } = render(<AppRail entries={makeEntries(onSelect)} />);
    const hr = container.querySelector('hr');
    if (hr) fireEvent.click(hr);
    expect(onSelect).toHaveBeenCalledTimes(0);
  });

  it('calls onSelect when an avatar item is clicked', () => {
    const onSelect = vi.fn();
    render(<AppRail entries={makeEntries(onSelect)} />);
    fireEvent.click(screen.getByRole('button', { name: 'My Static' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('skip link appears before <nav> in DOM order', () => {
    const { container } = render(<AppRail entries={makeEntries()} />);
    const skipLink = container.querySelector('a[href="#main-content"]');
    const nav = container.querySelector('nav');
    expect(skipLink).not.toBeNull();
    expect(nav).not.toBeNull();
    // compareDocumentPosition: if skipLink precedes nav, nav has DOCUMENT_POSITION_FOLLOWING (4)
    expect(
      skipLink!.compareDocumentPosition(nav!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders footer when provided', () => {
    render(<AppRail entries={makeEntries()} footer={<div>FOOTER</div>} />);
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
  });

  it('renders logo when provided', () => {
    render(<AppRail entries={makeEntries()} logo={<span>LOGO</span>} />);
    expect(screen.getByText('LOGO')).toBeInTheDocument();
  });

  // §3.9 LOCKED: inactive icon items must carry hover bg + icon-color-shift class tokens.
  // jsdom cannot compute :hover paint; asserting the class is wired is the correct pattern.
  it('inactive icon items carry hover-bg and hover-icon-color classes (§3.9)', () => {
    render(<AppRail entries={makeEntries()} />);
    const inactiveIconBtn = screen.getByRole('button', { name: 'Static Finder' });
    expect(inactiveIconBtn.className).toContain('hover:bg-[var(--color-nav-item-bg-hover)]');
    expect(inactiveIconBtn.className).toContain('hover:text-[var(--color-nav-item-icon-hover)]');
  });

  it('active icon items do NOT carry the hover-bg class (accent state is preserved)', () => {
    render(<AppRail entries={makeEntries()} />);
    const activeIconBtn = screen.getByRole('button', { name: 'Player Hub' });
    expect(activeIconBtn.className).not.toContain('hover:bg-[var(--color-nav-item-bg-hover)]');
  });

  it('inactive avatar items carry hover-bg class (§3.9)', () => {
    render(<AppRail entries={makeEntries()} />);
    const avatarBtn = screen.getByRole('button', { name: 'My Static' });
    expect(avatarBtn.className).toContain('hover:bg-[var(--color-nav-item-bg-hover)]');
  });

  // A12: flex centers the line box, not the glyph ink — leading-none collapses the
  // line box so initials sit optically centered (codebase convention: UserMenu
  // badges, RosterCard:372, DashboardCard). jsdom can't paint; pin the class.
  it('avatar fallback initials span carries leading-none (A12 centering)', () => {
    render(<AppRail entries={makeEntries()} />);
    const initialsSpan = screen.getByText('MS');
    expect(initialsSpan.className).toContain('leading-none');
  });

  // Task 6: below `sm`, the rail must be hidden (display:none) so MobileBottomNav serves
  // small viewports instead of a stacked 72px rail — mirrors legacy SidebarRail.tsx:42
  // (`hidden sm:flex`). Split on whitespace so a bare `flex` token (display:flex at ALL
  // sizes) can't hide behind a substring match against `sm:flex`.
  it('is hidden below sm and flex at sm+ — no bare `flex` token (§3.9)', () => {
    render(<AppRail entries={makeEntries()} />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const classTokens = nav.className.split(/\s+/).filter(Boolean);
    expect(classTokens).toContain('hidden');
    expect(classTokens).toContain('sm:flex');
    expect(classTokens).toContain('flex-col');
    expect(classTokens).not.toContain('flex');
  });
});
