/**
 * JoinAction — R-SF-I: pending/under_review, accepted/declined tags,
 * Request to join, the guest branch, and matching by `id` (never name).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JoinAction } from './JoinAction';
import type { FinderItem } from './types';
import type { JoinRequest } from '../../types';

const authState: { user: Record<string, unknown> | null } = { user: { id: 'u1' } };
const login = vi.fn();
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: unknown; login: () => void }) => unknown) =>
    selector({ user: authState.user, login }),
}));

const cancelRequest = vi.fn();
let myRequests: JoinRequest[] = [];
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector: (s: { myRequests: JoinRequest[]; cancelRequest: (id: string) => Promise<void> }) => unknown) =>
    selector({ myRequests, cancelRequest }),
}));

const toastError = vi.fn();
vi.mock('../../stores/toastStore', () => ({
  toast: { error: (msg: string) => toastError(msg) },
}));

function item(overrides: Partial<FinderItem> = {}): FinderItem {
  return {
    id: 'g1', name: 'Twilight Wardens', shareCode: 'abc123', recruitmentStatus: 'open',
    description: null, contactMethod: null, contactValue: null, neededRoles: null, neededJobs: null,
    scheduleDays: null, scheduleStartTime: null, scheduleEndTime: null, timezone: null, languages: null,
    intensity: null, dataCenter: null, server: null, memberCount: 0, lastUpdated: null,
    recruitingRoles: null, communicationStyle: null, objectiveCategories: [], goalAlignment: null,
    fitSummary: null, fitV2: null, ...overrides,
  };
}

function request(overrides: Partial<JoinRequest> = {}): JoinRequest {
  return {
    id: 'r1', staticGroupId: 'g1', requesterUserId: 'u1', status: 'pending',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as JoinRequest;
}

beforeEach(() => {
  authState.user = { id: 'u1' };
  myRequests = [];
  cancelRequest.mockReset();
  login.mockClear();
  toastError.mockClear();
});

describe('JoinAction', () => {
  it('pending reads "Request pending" + Cancel request, which calls cancelRequest(id)', async () => {
    myRequests = [request({ id: 'r9', status: 'pending' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    expect(screen.getByText('Request pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledWith('r9'));
  });

  it('under_review reads "Request pending" with no Cancel action — the API only allows cancelling pending (PR-review fix wave item 5)', () => {
    myRequests = [request({ id: 'r9', status: 'under_review' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    expect(screen.getByText('Request pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });

  it('a rejected cancel shows a toast', async () => {
    cancelRequest.mockRejectedValueOnce(new Error('nope'));
    myRequests = [request({ id: 'r9', status: 'pending' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't cancel the request"));
  });

  it('accepted shows the Accepted tag', () => {
    myRequests = [request({ status: 'accepted' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('declined shows the Declined tag', () => {
    myRequests = [request({ status: 'declined' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('no request opens the modal (via onRequestJoin) with the item\'s shareCode and name', () => {
    const onRequestJoin = vi.fn();
    const target = item({ id: 'g1', shareCode: 'abc123', name: 'Twilight Wardens' });
    render(<JoinAction item={target} onRequestJoin={onRequestJoin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request to join' }));
    expect(onRequestJoin).toHaveBeenCalledWith(expect.objectContaining({ shareCode: 'abc123', name: 'Twilight Wardens' }));
  });

  it('cancelled reads Request to join again', () => {
    myRequests = [request({ status: 'cancelled' })];
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Request to join' })).toBeInTheDocument();
  });

  it('two items with the same name and different ids — only the matching one shows pending', () => {
    myRequests = [request({ id: 'r1', staticGroupId: 'g1', status: 'pending' })];
    const { rerender } = render(<JoinAction item={item({ id: 'g1', name: 'Twilight Wardens' })} onRequestJoin={vi.fn()} />);
    expect(screen.getByText('Request pending')).toBeInTheDocument();

    rerender(<JoinAction item={item({ id: 'g2', name: 'Twilight Wardens' })} onRequestJoin={vi.fn()} />);
    expect(screen.queryByText('Request pending')).toBeNull();
    expect(screen.getByRole('button', { name: 'Request to join' })).toBeInTheDocument();
  });

  it('a guest sees "Log in to join", which calls login()', () => {
    authState.user = null;
    render(<JoinAction item={item()} onRequestJoin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in to join' }));
    expect(login).toHaveBeenCalledTimes(1);
  });
});
