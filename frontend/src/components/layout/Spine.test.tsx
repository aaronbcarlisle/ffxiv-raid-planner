/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Spine } from './Spine';
import { analytics } from '../../services/analytics';

beforeEach(() => {
  // jsdom has no matchMedia; stub for any transitive dep that uses it
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

describe('Spine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders exactly the 4 spine tabs and no retired ones', () => {
    render(<Spine activeTab="overview" onTabChange={vi.fn()} />);
    ['Home', 'Roster', 'Loot', 'Schedule'].forEach(l =>
      expect(screen.getByRole('tab', { name: l })).toBeInTheDocument()
    );
    expect(screen.queryByRole('tab', { name: /Goals|More|Plugin|Gear/ })).toBeNull();
  });

  it('maps Loot tab to pageMode gear and marks active', () => {
    const onTabChange = vi.fn();
    render(<Spine activeTab="roster" onTabChange={onTabChange} />);
    expect(screen.getByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Loot' }));
    expect(onTabChange).toHaveBeenCalledWith('gear');
  });

  it('marks the active tab with aria-selected=true and others false', () => {
    render(<Spine activeTab="gear" onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Loot' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires analytics(navigation, tab_switch, {tab, surface:spine}) before onTabChange on click', () => {
    const onTabChange = vi.fn();
    const spy = vi.spyOn(analytics, 'track');
    render(<Spine activeTab="overview" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }));
    expect(spy).toHaveBeenCalledWith('navigation', 'tab_switch', { tab: 'schedule', surface: 'spine' });
    expect(onTabChange).toHaveBeenCalledWith('schedule');
    // analytics fires before onTabChange
    expect(spy.mock.invocationCallOrder[0]).toBeLessThan(onTabChange.mock.invocationCallOrder[0]);
  });

  it('ArrowRight moves focus to and activates the next tab', () => {
    const onTabChange = vi.fn();
    const spy = vi.spyOn(analytics, 'track');
    render(<Spine activeTab="overview" onTabChange={onTabChange} />);
    screen.getByRole('tab', { name: 'Home' }).focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(spy).toHaveBeenCalledWith('navigation', 'tab_switch', { tab: 'roster', surface: 'spine' });
    expect(onTabChange).toHaveBeenCalledWith('roster');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Roster' }));
  });
});

// Helper: captures the current MemoryRouter location as a data attribute
function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location" data-path={loc.pathname + loc.search} />;
}

describe('Spine routing guardrail', () => {
  it('clicking a tab calls onTabChange only and never changes the route', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter initialEntries={['/group/DEVTST?tab=overview']}>
        <LocationDisplay />
        <Spine activeTab="overview" onTabChange={onTabChange} />
      </MemoryRouter>
    );

    const initialPath = screen.getByTestId('location').getAttribute('data-path');

    fireEvent.click(screen.getByRole('tab', { name: 'Roster' }));

    // onTabChange called with the correct PageMode id
    expect(onTabChange).toHaveBeenCalledWith('roster');
    // Route unchanged — Spine never calls navigate
    expect(screen.getByTestId('location').getAttribute('data-path')).toBe(initialPath);
  });
});
