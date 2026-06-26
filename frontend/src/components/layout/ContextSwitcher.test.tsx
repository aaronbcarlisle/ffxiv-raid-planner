/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContextSwitcher } from './ContextSwitcher';

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

function renderAt(path: string, props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ContextSwitcher currentGroup={null} groups={[]} onFetchGroups={vi.fn()} isMember={false} {...props} />
    </MemoryRouter>
  );
}

describe('ContextSwitcher', () => {
  it('renders a Static Finder segment linking to /discover', () => {
    renderAt('/profile');
    const finder = screen.getByText('Static Finder').closest('a');
    expect(finder).toHaveAttribute('href', '/discover');
  });

  it('marks Static Finder active on /discover', () => {
    renderAt('/discover');
    expect(screen.getByText('Static Finder').closest('a')).toHaveAttribute('aria-current', 'page');
  });
});
