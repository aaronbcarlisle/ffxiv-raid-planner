import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SnapshotPlayer } from '../../types';

// RosterCard is a heavy composed component (kebab, modals, inline edits) —
// stub it so this test only asserts RosterCards' grouping/forwarding contract.
vi.mock('./RosterCard', () => ({
  RosterCard: ({ player }: { player: SnapshotPlayer }) => (
    <div data-testid="roster-card">{player.name}</div>
  ),
}));

import { RosterCards } from './RosterCards';

function makePlayer(overrides: Partial<SnapshotPlayer> & { id: string }): SnapshotPlayer {
  return {
    tierSnapshotId: 't1',
    name: 'Player',
    job: 'PLD',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const stubActions = {
  onUpdate: vi.fn(),
  onCopy: vi.fn(),
  onDuplicate: vi.fn(),
};

const actionsForPlayer = vi.fn(() => stubActions);

const baseProps = {
  reorderMode: false,
  canManage: true,
  userRole: 'owner' as const,
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  actionsForPlayer,
  onAddPlayer: vi.fn(),
};

describe('RosterCards', () => {
  beforeEach(() => {
    actionsForPlayer.mockClear();
  });

  it('renders G1 + Substitutes party headers and a card per configured player', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: 'Healer One', position: 'H1' }),
      makePlayer({ id: 'p3', name: 'Sub One', isSubstitute: true }),
    ];

    render(
      <RosterCards
        players={players}
        groupView
        subsView
        subsHidden={false}
        {...baseProps}
      />
    );

    expect(screen.getByText('Light Party 1')).toBeInTheDocument();
    expect(screen.getByText('Substitutes')).toBeInTheDocument();
    expect(screen.getAllByTestId('roster-card')).toHaveLength(3);
    expect(screen.getByText('Tank One')).toBeInTheDocument();
    expect(screen.getByText('Healer One')).toBeInTheDocument();
    expect(screen.getByText('Sub One')).toBeInTheDocument();

    // Per-player factory contract: `actionsForPlayer` must be called once per
    // rendered card, each time with that card's own player — never a single
    // shared `actions` object reused across cards (the bug this test guards
    // against: a shared object means every card's mutations act on the wrong
    // player).
    expect(actionsForPlayer).toHaveBeenCalledTimes(3);
    expect(actionsForPlayer).toHaveBeenNthCalledWith(1, players[0]);
    expect(actionsForPlayer).toHaveBeenNthCalledWith(2, players[1]);
    expect(actionsForPlayer).toHaveBeenNthCalledWith(3, players[2]);
  });

  it('renders an EmptyStateInvite "open seat" card for an unconfigured position', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({
        id: 'p2',
        name: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    expect(screen.getAllByTestId('roster-card')).toHaveLength(1);
    expect(screen.getByText(/Open seat · Healer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add player' })).toBeInTheDocument();
  });

  it('does not render a Substitutes section when subsHidden is true', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: 'Sub One', isSubstitute: true }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView
        subsHidden
        {...baseProps}
      />
    );

    expect(screen.queryByText('Substitutes')).not.toBeInTheDocument();
    expect(screen.queryByText('Sub One')).not.toBeInTheDocument();
  });
});
