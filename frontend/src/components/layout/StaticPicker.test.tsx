/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { StaticPicker } from './StaticPicker';
import type { StaticGroup, StaticGroupListItem } from '../../types';

// Radix DropdownMenu needs these in jsdom (FocusScope -> scrollIntoView, pointer capture).
beforeEach(() => {
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
    }))
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
});

const groupA = { id: 'a', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroup;
const listGroups: StaticGroupListItem[] = [
  { id: 'a', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroupListItem,
  { id: 'b', shareCode: 'XYZ', name: 'Beta Static', userRole: 'member' } as unknown as StaticGroupListItem,
];

// Captures the live MemoryRouter location as a data attribute.
function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="loc" data-path={loc.pathname + loc.search} />;
}

function renderAt(path: string, props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationDisplay />
      <StaticPicker
        currentGroup={groupA}
        groups={listGroups}
        onFetchGroups={vi.fn()}
        isMember
        userRole="owner"
        {...props}
      />
    </MemoryRouter>
  );
}

describe('StaticPicker', () => {
  it('renders the active static name', () => {
    renderAt('/group/ABC?shell=v2');
    expect(screen.getByText('Alpha Static')).toBeInTheDocument();
  });

  it('has NO Player Hub or Static Finder segments (those moved to the rail)', () => {
    renderAt('/group/ABC?shell=v2');
    expect(screen.queryByText('Player Hub')).toBeNull();
    expect(screen.queryByText('Static Finder')).toBeNull();
  });

  it('exposes the switch trigger as an IconButton (role=button, aria-label, not a raw button)', () => {
    renderAt('/group/ABC?shell=v2');
    const trigger = screen.getByRole('button', { name: 'Switch static' });
    expect(trigger).toBeInTheDocument();
    // IconButton hallmark class — a raw <button> would not carry the focus-ring token.
    expect(trigger.className).toContain('focus-visible:ring-focus-ring');
  });

  it('navigates via SPA preserving ?shell=v2 when selecting another static while on a static', async () => {
    renderAt('/group/ABC?shell=v2');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Switch static' }), { key: 'Enter' });
    const item = await screen.findByText('Beta Static');
    fireEvent.click(item);
    expect(screen.getByTestId('loc').getAttribute('data-path')).toBe('/group/XYZ?shell=v2');
  });

  it('does NOT navigate when not already on a static (off-route selection only updates intent)', async () => {
    renderAt('/profile', { currentGroup: null });
    const before = screen.getByTestId('loc').getAttribute('data-path');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Switch static' }), { key: 'Enter' });
    const item = await screen.findByText('Beta Static');
    fireEvent.click(item);
    expect(screen.getByTestId('loc').getAttribute('data-path')).toBe(before);
  });
});
