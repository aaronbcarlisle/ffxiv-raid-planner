import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RewardGoalCard } from './RewardGoalCard';
import { TooltipProvider } from '../primitives/Tooltip';
import type { CollectionGoal } from '../../stores/collectionGoalStore';

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
  priorityMode: null,
  summary: null,
  tokenName: null,
  tokenCost: null,
  participantSummary: null,
} as unknown as CollectionGoal;

function renderCard(isViewer: boolean) {
  return render(
    <TooltipProvider>
      <RewardGoalCard
        goal={goal}
        participants={[]}
        onView={vi.fn()}
        onLogDrop={vi.fn()}
        onCopyPlan={vi.fn()}
        canManage={false}
        isViewer={isViewer}
      />
    </TooltipProvider>,
  );
}

describe('RewardGoalCard', () => {
  it('hides Log Drop from viewers but keeps View', () => {
    renderCard(true);
    expect(screen.queryByRole('button', { name: /Log Drop/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View/ })).toBeInTheDocument();
  });

  it('shows Log Drop to a member', () => {
    renderCard(false);
    expect(screen.getByRole('button', { name: /Log Drop/ })).toBeInTheDocument();
  });
});
