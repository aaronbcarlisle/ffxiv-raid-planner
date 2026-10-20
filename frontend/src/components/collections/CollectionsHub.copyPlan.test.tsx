/**
 * Pins V1's "Copy plan" clipboard text (S2a-3a·G1 Task 2, R-S3-2, vet I-4). Written
 * against `CollectionsHub` before `buildDiscordPlan` moved to `utils/discordPlan.ts`,
 * and it must pass unedited after the move. Only Need is sorted in V1's path (by
 * `priorityRank ?? 999`); Want, Have and "Can buy now" keep the participants' input
 * order, and "Can buy now" reads every participant, a Pass player and a Need over the
 * cost included.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CollectionsHub } from './CollectionsHub';
import { TooltipProvider } from '../primitives/Tooltip';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, ParticipantState, ParticipantStateEntry } from '../../stores/collectionGoalStore';

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

const goal = {
  id: 'goal-1',
  staticGroupId: 'g1',
  createdById: 'u1',
  goalType: 'mount',
  contentType: null,
  title: 'Shiny Mount',
  status: 'farming',
  priorityMode: 'priority_order',
  summary: null,
  note: 'Bring food',
  tokenName: 'Tomestone',
  tokenCost: 99,
  participantSummary: null,
} as unknown as CollectionGoal;

function participant(
  userId: string,
  displayName: string | null,
  state: ParticipantState,
  tokenCount: number | null,
  priorityRank: number | null,
): ParticipantStateEntry {
  return {
    id: `p-${userId}`,
    goalId: 'goal-1',
    userId,
    staticGroupId: 'g1',
    state,
    tokenCount,
    priorityRank,
    source: 'manual',
    lastSyncedAt: null,
    notes: null,
    updatedAt: '2026-01-01T00:00:00Z',
    displayName,
    memberRole: 'member',
  };
}

// Input order is deliberate: the Needs' ranks (3, 1, none, 2) put them out of input
// order; the Wants come as Zed, Amy (not alphabetical); Alice (rank 3, 100) and Bob
// (rank 1, 120) can buy, and rank order would swap them in "Can buy now".
const participants: ParticipantStateEntry[] = [
  participant('u-alice', 'Alice', 'need', 100, 3),
  participant('u-zed', 'Zed', 'want', 50, null),
  participant('u-bob', 'Bob', 'need', 120, 1),
  participant('u-pat', 'Pat', 'pass', 99, null),
  participant('u-cara', 'Cara', 'need', 0, null),
  participant('u-amy', 'Amy', 'want', 5, null),
  participant('u-hank', 'Hank', 'have', 0, null),
  participant('user-nameless', null, 'need', null, 2),
];

const EXPECTED = [
  '**Shiny Mount** farm plan',
  'Mode: Priority order',
  'Exchange: 99× Tomestone',
  '',
  '🎯 **Need (4):** Bob, user-nameless, Alice, Cara',
  '⭐ **Want (2):** Zed, Amy',
  '💰 **Can buy now:** Alice, Bob, Pat',
  '✅ **Have (1):** Hank',
  '',
  '📝 Bring food',
].join('\n');

describe('CollectionsHub — Copy plan text (V1 pin)', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    useCollectionGoalStore.setState({
      goals: [goal],
      participants: { 'goal-1': participants },
      isLoading: false,
      fetchGoals: vi.fn().mockResolvedValue(undefined),
      fetchParticipants: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('writes the exact plan text to the clipboard', async () => {
    render(
      <MemoryRouter initialEntries={['/?farm=active']}>
        <TooltipProvider>
          <CollectionsHub groupId="g1" currentUserId="u-alice" canManage={true} isViewer={false} />
        </TooltipProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy farm plan' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    expect(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]).toBe(EXPECTED);
  });
});
