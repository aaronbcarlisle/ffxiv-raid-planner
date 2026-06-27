/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';

vi.mock('../../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../auth', () => ({ UserMenu: () => <div>USER_MENU</div> }));

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

describe('SidebarNav', () => {
  it('renders a Plugin nav item immediately before More', () => {
    render(<MemoryRouter><SidebarNav activeTab="overview" onTabChange={vi.fn()} staticName="X" /></MemoryRouter>);
    const labels = screen.getAllByText(/Overview|Schedule|Roster|Goals & Farms|Gear & Sync|Plugin|More/).map(n => n.textContent);
    expect(labels).toContain('Plugin');
    expect(labels.indexOf('Plugin')).toBeLessThan(labels.indexOf('More'));
  });

  it('renders the user menu in the footer', () => {
    render(<MemoryRouter><SidebarNav activeTab="overview" onTabChange={vi.fn()} staticName="X" /></MemoryRouter>);
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });

  it('navigates to the plugin tab when Plugin is clicked', () => {
    const onTabChange = vi.fn();
    render(<MemoryRouter><SidebarNav activeTab="overview" onTabChange={onTabChange} staticName="X" /></MemoryRouter>);
    fireEvent.click(screen.getByText('Plugin'));
    expect(onTabChange).toHaveBeenCalledWith('plugin');
  });
});
