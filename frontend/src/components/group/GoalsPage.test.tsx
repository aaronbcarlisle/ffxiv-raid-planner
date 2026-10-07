/**
 * GoalsPage (GUEST-2 R-G2-5) — Tracking is members-only. A non-member gets the
 * members-only card and NOTHING else mounts, so neither goal fetcher fires
 * (on the default Objectives sub-tab or on ?goal=farms).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { GoalsPage } from './GoalsPage';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function goalRequests(fragment: 'objective-goals' | 'collection-goals') {
  return vi.mocked(api.get).mock.calls.filter(([url]) => String(url).includes(fragment));
}

function renderGoals(isMember: boolean, search = '') {
  return render(
    <MemoryRouter initialEntries={[`/group/DEVTST?tab=goals${search}`]}>
      <GoalsPage
        groupId="g1"
        groupName="Test Static"
        currentUserId="u1"
        canManage={false}
        isViewer={true}
        isMember={isMember}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue([]);
  useAuthStore.setState({ user: null, isLoading: false, authInitialized: true, login: vi.fn() } as never);
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
    })),
  );
});

describe('GoalsPage', () => {
  it('a non-member gets the members-only card, no sub-tab switcher, and no goal requests', async () => {
    renderGoals(false);
    await waitFor(() => expect(screen.getByTestId('members-only-card')).toBeInTheDocument());

    expect(screen.getByText(/Objectives and farms are shared with members of Test Static/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Objectives' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Farms' })).toBeNull();
    expect(goalRequests('objective-goals')).toHaveLength(0);
    expect(goalRequests('collection-goals')).toHaveLength(0);
  });

  it('a non-member on ?goal=farms gets the same card and no goal requests', async () => {
    renderGoals(false, '&goal=farms');
    await waitFor(() => expect(screen.getByTestId('members-only-card')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Farms' })).toBeNull();
    expect(goalRequests('objective-goals')).toHaveLength(0);
    expect(goalRequests('collection-goals')).toHaveLength(0);
  });

  it('(pin) a viewer keeps the page: the switcher shows and the objectives panel fetches', async () => {
    renderGoals(true);

    expect(screen.getByRole('button', { name: 'Objectives' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farms' })).toBeInTheDocument();
    expect(screen.queryByTestId('members-only-card')).toBeNull();
    await waitFor(() => expect(goalRequests('objective-goals').length).toBeGreaterThan(0));
  });

  it('(pin) a viewer on ?goal=farms mounts the farms hub, which fetches collection goals', async () => {
    renderGoals(true, '&goal=farms');

    expect(screen.queryByTestId('members-only-card')).toBeNull();
    await waitFor(() => expect(goalRequests('collection-goals').length).toBeGreaterThan(0));
  });
});
