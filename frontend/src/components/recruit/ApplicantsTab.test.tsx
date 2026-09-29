/**
 * ApplicantsTab — RH1c. Mount fetch, waiting/resolved ordering, the resolved
 * toggle, the rejected-accept refetch (Review Focus 5), and each empty state
 * (spec §3).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApplicantsTab } from './ApplicantsTab';
import type { DiscoverySettings, JoinRequest, StaticGroup } from '../../types';

const mocks = vi.hoisted(() => ({
  applicants: null as { groupId: string; items: JoinRequest[]; pendingCount: number } | null,
  fetchApplicants: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  markUnderReview: vi.fn(),
  onLinkRoster: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
    applicants: mocks.applicants,
    fetchApplicants: mocks.fetchApplicants,
    acceptRequest: mocks.acceptRequest,
    declineRequest: mocks.declineRequest,
    markUnderReview: mocks.markUnderReview,
  }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock('../../pages/groupActionsContext', () => ({
  useGroupAddToRoster: () => mocks.onLinkRoster,
}));

vi.mock('./ApplicantRow', () => ({
  ApplicantRow: ({ request }: { request: JoinRequest }) => <div data-testid={`row-${request.id}`}>{request.id}</div>,
}));

function group(discovery: DiscoverySettings | undefined, extra: Partial<StaticGroup> = {}): StaticGroup {
  return {
    id: 'g1', name: 'Test Static', shareCode: 'abc', isPublic: true, ownerId: 'u1',
    memberCount: 8, settings: discovery ? { discovery } : {},
    ...extra,
  } as StaticGroup;
}

function request(overrides: Partial<JoinRequest> = {}): JoinRequest {
  return {
    id: 'r1', staticGroupId: 'g1', requesterUserId: 'u1', status: 'pending',
    createdAt: '2026-09-28T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z',
    ...overrides,
  };
}

function renderTab(g: StaticGroup, onTabChange = vi.fn()) {
  return render(
    <MemoryRouter>
      <ApplicantsTab group={g} onTabChange={onTabChange} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.applicants = null;
  mocks.fetchApplicants.mockReset().mockResolvedValue(undefined);
  mocks.acceptRequest.mockReset().mockResolvedValue(undefined);
  mocks.declineRequest.mockReset().mockResolvedValue(undefined);
  mocks.markUnderReview.mockReset().mockResolvedValue(undefined);
  mocks.navigate.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});

describe('ApplicantsTab — mount', () => {
  it('fetches applicants for the group once', () => {
    renderTab(group({ enabled: true, recruitmentStatus: 'open' }));
    expect(mocks.fetchApplicants).toHaveBeenCalledTimes(1);
    expect(mocks.fetchApplicants).toHaveBeenCalledWith('g1');
  });
});

describe('ApplicantsTab — ordering', () => {
  it('waiting rows sort newest first; resolved rows are collapsed behind a toggle', () => {
    mocks.applicants = {
      groupId: 'g1',
      items: [
        request({ id: 'old', status: 'pending', createdAt: '2026-09-01T00:00:00Z' }),
        request({ id: 'new', status: 'under_review', createdAt: '2026-09-10T00:00:00Z' }),
        request({ id: 'accepted', status: 'accepted', createdAt: '2026-09-05T00:00:00Z' }),
      ],
      pendingCount: 2,
    };
    renderTab(group({ enabled: true, recruitmentStatus: 'open' }));

    const rows = screen.getAllByTestId(/^row-/).map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['row-new', 'row-old']);
    expect(screen.queryByTestId('row-accepted')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved (1)' }));
    expect(screen.getByTestId('row-accepted')).toBeInTheDocument();
  });
});

describe('ApplicantsTab — empty states', () => {
  it('listing live, no requests: "No one has asked yet" with a Finder link', () => {
    renderTab(group({ enabled: true, recruitmentStatus: 'open' }));
    expect(screen.getByText('No one has asked yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Browse the Static Finder'));
    expect(mocks.navigate).toHaveBeenCalledWith('/discover');
  });

  it('listing paused: the status message, no listing link', () => {
    renderTab(group({ enabled: true, recruitmentStatus: 'paused' }));
    expect(screen.getByText('Your listing is paused, so no one can ask right now. Change the status above.')).toBeInTheDocument();
  });

  it('listing closed: the status message', () => {
    renderTab(group({ enabled: true, recruitmentStatus: 'closed' }));
    expect(screen.getByText('Your listing is closed, so no one can ask right now. Change the status above.')).toBeInTheDocument();
  });

  it('listing off (enabled but not public): points at the Listing tab', () => {
    const onTabChange = vi.fn();
    renderTab(group({ enabled: true, recruitmentStatus: 'open' }, { isPublic: false }), onTabChange);
    expect(screen.getByText(/Your listing is off\./)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Turn it on in the Listing tab'));
    expect(onTabChange).toHaveBeenCalledWith('listing');
  });

  it('no discovery object at all: "Set up your listing"', () => {
    const onTabChange = vi.fn();
    renderTab(group(undefined), onTabChange);
    fireEvent.click(screen.getByText('Set up your listing'));
    expect(onTabChange).toHaveBeenCalledWith('listing');
  });

  it('a stored limited status reads as selective (not paused/closed) for the empty-state branch', () => {
    renderTab(group({ enabled: true, recruitmentStatus: 'limited' }));
    expect(screen.getByText('No one has asked yet')).toBeInTheDocument();
  });
});

describe('ApplicantsTab — accept error refetch', () => {
  it('a thrown accept error toasts its message and refetches (Review Focus 5)', async () => {
    vi.doMock('./ApplicantRow', () => ({
      ApplicantRow: ({ request: r, onAccept }: { request: JoinRequest; onAccept: (id: string) => Promise<void> }) => (
        <button type="button" onClick={() => onAccept(r.id)}>{`accept-${r.id}`}</button>
      ),
    }));
    vi.resetModules();
    const { ApplicantsTab: FreshTab } = await import('./ApplicantsTab');
    mocks.applicants = { groupId: 'g1', items: [request({ id: 'r1' })], pendingCount: 1 };
    mocks.acceptRequest.mockRejectedValueOnce(new Error('Already accepted'));

    render(
      <MemoryRouter>
        <FreshTab group={group({ enabled: true, recruitmentStatus: 'open' })} onTabChange={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('accept-r1'));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Already accepted'));
    expect(mocks.fetchApplicants).toHaveBeenCalledTimes(2);
  });
});
