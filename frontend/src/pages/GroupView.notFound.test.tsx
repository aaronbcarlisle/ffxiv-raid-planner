/**
 * GroupView (legacy chrome) — not-found flow against the REAL stores (V1B Task 2).
 *
 * No other test renders `GroupView` (`GroupRoute.test.tsx` stubs it), so this is the
 * first proof of its branches. `authRequest` is routed by path: DEVTST loads with no
 * tiers, ZZZZZZ rejects with a 404. L1 covers a direct visit (R-V1B-1, R-V1B-6/7);
 * L2 covers the in-app navigation from a loaded static, where the old store left
 * DEVTST on screen under the ZZZZZZ URL. The heavy children are stubbed; the
 * `Header` stays real (only its `HEADER_EVENTS` constant is imported here).
 */
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, authRequest: vi.fn() };
});
vi.mock('./GroupViewContent', () => ({
  GroupViewContent: () => <div data-testid="group-view-content" />,
}));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: ReactNode }) => <>{children}</>,
  useGroupActions: () => ({
    onTierChange: vi.fn(),
    onAddPlayer: vi.fn(),
    onNewTier: vi.fn(),
    onRollover: vi.fn(),
    onDeleteTier: vi.fn(),
  }),
  useGroupAddToRoster: () => vi.fn(),
}));
vi.mock('../components/settings', () => ({ StaticSettingsHost: () => null }));
vi.mock('../components/static-group', () => ({ JoinRequestBanner: () => null }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/layout/SidebarNav', () => ({ SidebarNav: () => null }));
vi.mock('../hooks/useDevice', () => ({
  useDevice: () => ({ isSmallScreen: false, isTouch: false, canHover: false, prefersReducedMotion: false }),
}));

import { GroupView } from './GroupView';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { authRequest, ApiError } from '../services/api';
import type { StaticGroup } from '../types';

const mockAuthRequest = vi.mocked(authRequest);

const devGroup = {
  id: 'g1',
  name: 'Test Static',
  shareCode: 'DEVTST',
  userRole: 'owner',
  isAdminAccess: false,
  settings: {},
} as StaticGroup;

function routeRequests() {
  mockAuthRequest.mockImplementation((async (path: string) => {
    if (path.endsWith('/by-code/DEVTST')) return devGroup;
    if (path.endsWith('/by-code/ZZZZZZ')) throw new ApiError(404, 'Static group not found');
    if (path.endsWith('/tiers')) return [];
    throw new Error(`unexpected request: ${path}`);
  }) as never);
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/group/:shareCode', element: <GroupView /> },
      { path: '/profile', element: <div data-testid="profile-probe">PROFILE</div> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('GroupView — not-found flow with the real stores', () => {
  beforeEach(() => {
    mockAuthRequest.mockReset();
    routeRequests();
    useStaticGroupStore.setState({
      currentGroup: null,
      isLoading: false,
      error: null,
      errorStack: null,
      errorSource: null,
    });
    useTierStore.setState({ tiers: [], currentTier: null, isLoading: false, error: null, errorStack: null });
    useAuthStore.setState({ user: null });
    useViewAsStore.setState({ viewAsUser: null });
  });

  it('L1: /group/ZZZZZZ shows Static Not Found (no Error card) with a Go to My Statics action', async () => {
    renderAt('/group/ZZZZZZ');

    const heading = await screen.findByRole('heading', { name: 'Static Not Found' });
    expect(screen.queryByRole('heading', { name: 'Error' })).toBeNull();

    // The Error card has the same button, so scope it to the not-found block.
    const region = heading.parentElement as HTMLElement;
    fireEvent.click(within(region).getByRole('button', { name: 'Go to My Statics' }));
    expect(await screen.findByTestId('profile-probe')).toBeInTheDocument();
  });

  it('L2: navigating from a loaded static to a missing code shows not-found, not the old static or its modal', async () => {
    const router = renderAt('/group/DEVTST');
    expect(await screen.findByText('No Raid Tiers')).toBeInTheDocument();

    await act(() => router.navigate('/group/ZZZZZZ'));

    expect(await screen.findByRole('heading', { name: 'Static Not Found' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('No Raid Tiers')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
