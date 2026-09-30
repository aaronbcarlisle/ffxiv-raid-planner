import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RewardGoalDetailModal } from './RewardGoalDetailModal';
import { ParticipantsPanel } from './ParticipantsPanel';
import { TooltipProvider } from '../primitives/Tooltip';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, ParticipantStateEntry } from '../../stores/collectionGoalStore';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const goal = { id: 'goal-1', title: 'Shiny Mount', summary: null } as unknown as CollectionGoal;

const mine = {
  id: 'ps-me',
  goalId: 'goal-1',
  userId: 'me',
  staticGroupId: 'g1',
  state: 'need',
  tokenCount: null,
  priorityRank: null,
  source: 'manual',
  lastSyncedAt: null,
  notes: null,
  updatedAt: '2026-09-30T00:00:00Z',
  displayName: 'Me',
  memberRole: 'member',
} as ParticipantStateEntry;

function seed(list: ParticipantStateEntry[]) {
  useCollectionGoalStore.setState({
    participants: { 'goal-1': list },
    participantsLoading: {},
    fetchParticipants: vi.fn().mockResolvedValue(undefined),
  });
}

function renderDetail(isViewer: boolean) {
  return render(
    <TooltipProvider>
      <RewardGoalDetailModal
        isOpen
        onClose={vi.fn()}
        goal={goal}
        groupId="g1"
        currentUserId="me"
        canManage={false}
        isViewer={isViewer}
        onEdit={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe('my-state control', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, participantsLoading: {} });
  });

  it('is absent from the detail modal for a viewer, with and without participants', () => {
    seed([mine]);
    const { unmount } = renderDetail(true);
    expect(screen.queryByText('My status:')).not.toBeInTheDocument();
    unmount();

    seed([]);
    renderDetail(true);
    expect(screen.queryByRole('button', { name: 'Need' })).not.toBeInTheDocument();
  });

  it('is present in the detail modal for a member', () => {
    seed([mine]);
    renderDetail(false);
    expect(screen.getByText('My status:')).toBeInTheDocument();
  });

  it('ParticipantsPanel renders no control without an onSetMyState handler', () => {
    seed([mine]);
    render(
      <TooltipProvider>
        <ParticipantsPanel groupId="g1" goalId="goal-1" currentUserId="me" canManage={false} />
      </TooltipProvider>,
    );
    expect(screen.queryByText('My status:')).not.toBeInTheDocument();
  });
});
