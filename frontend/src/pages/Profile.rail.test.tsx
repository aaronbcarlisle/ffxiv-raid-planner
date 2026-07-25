/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileSidebarNav } from './Profile';

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

describe('ProfileSidebarNav', () => {
  it('renders Player Hub items and the user-menu footer', () => {
    render(<MemoryRouter><ProfileSidebarNav activeTab="overview" onTabChange={vi.fn()} characterName="Hero" /></MemoryRouter>);
    expect(screen.getByText('Jobs & Gear')).toBeInTheDocument();
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });
});
