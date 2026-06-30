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
});
