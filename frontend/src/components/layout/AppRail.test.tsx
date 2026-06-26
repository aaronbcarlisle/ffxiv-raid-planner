/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Shield } from 'lucide-react';
import { AppRail } from './AppRail';
import type { RailNavItem } from './railTypes';

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

function makeItems(onSelect = vi.fn()): RailNavItem[] {
  return [
    { id: 'overview', label: 'Overview', description: 'd', icon: Shield, isActive: true, onSelect },
    { id: 'roster', label: 'Roster', description: 'd', icon: Shield, isActive: false, onSelect },
  ];
}

describe('AppRail', () => {
  it('renders identity label and all nav items', () => {
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems()} collapseKey="test-rail-collapsed" />
    );
    expect(screen.getByText('My Static')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Roster')).toBeInTheDocument();
  });

  it('calls onSelect when a nav item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems(onSelect)} collapseKey="test-rail-collapsed" />
    );
    fireEvent.click(screen.getByText('Roster'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders the footer node', () => {
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems()} collapseKey="test-rail-collapsed"
        footer={<div>FOOTER</div>} />
    );
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
  });
});
