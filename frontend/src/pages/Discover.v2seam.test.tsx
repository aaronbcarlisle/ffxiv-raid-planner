/**
 * Discover — the Stage-4 SF1b seam (R-SF-H). Without the V2 chrome provider
 * (every legacy render path) V1's Discover renders unchanged; with it,
 * StaticFinder renders instead. Same pattern as Profile.v2seam.test.tsx.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Discover from './Discover';
import { V2ChromeContext } from '../lib/chromeContext';

const mockAuthRequest = vi.fn();

vi.mock('../services/api', () => ({
  authRequest: (...args: unknown[]) => mockAuthRequest(...args),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { user: null, login: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { myRequests: [], fetchMyRequests: vi.fn(), cancelRequest: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

function renderDiscover(inV2Chrome: boolean) {
  const page = (
    <MemoryRouter initialEntries={['/discover']}>
      <Discover />
    </MemoryRouter>
  );
  return render(inV2Chrome ? <V2ChromeContext.Provider value={true}>{page}</V2ChromeContext.Provider> : page);
}

beforeEach(() => {
  mockAuthRequest.mockReset();
  mockAuthRequest.mockResolvedValue({ items: [], total: 0, fitCounts: null, viewer: null });
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

describe('Discover — V2 seam (SF1b, R-SF-H)', () => {
  it('without the provider renders V1 (the legacy heading), and static-finder is absent', () => {
    renderDiscover(false);
    expect(screen.getByText('Find a Static')).toBeInTheDocument();
    expect(screen.queryByTestId('static-finder')).toBeNull();
  });

  it('with the provider renders the Static Finder, not V1, and never fires V1\'s request (no fitV2)', () => {
    renderDiscover(true);
    expect(screen.getByTestId('static-finder')).toBeInTheDocument();
    expect(screen.queryByText('Find a Static')).toBeNull();
    expect(mockAuthRequest).toHaveBeenCalled();
    for (const call of mockAuthRequest.mock.calls) {
      expect(call[0] as string).toContain('fitV2=true');
    }
  });
});
