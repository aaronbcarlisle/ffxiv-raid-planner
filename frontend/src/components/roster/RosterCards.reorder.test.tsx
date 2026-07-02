import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer } from '../../types';

// Stub RosterCard so this test asserts only the reorder MODE TOGGLE: whether the
// grid wires drag handles onto cards. The stub surfaces `reorderMode` and spreads
// the `dragHandle` it receives so dnd-kit's draggable attributes (e.g.
// `aria-roledescription="draggable"`) land on the card DOM when — and only when —
// reorder mode wraps the card in a draggable.
vi.mock('./RosterCard', () => ({
  RosterCard: ({
    player,
    reorderMode,
    dragHandle,
  }: {
    player: SnapshotPlayer;
    reorderMode: boolean;
    dragHandle?: { attributes?: Record<string, unknown>; listeners?: Record<string, unknown> };
  }) => (
    <div
      data-testid="roster-card"
      data-reorder={String(reorderMode)}
      {...(dragHandle ? { ...dragHandle.attributes, ...dragHandle.listeners } : {})}
    >
      {player.name}
    </div>
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

const baseProps = {
  canManage: true,
  userRole: 'owner' as const,
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  actionsForPlayer: () => ({ onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn() }),
  onAddPlayer: vi.fn(),
  onReorder: vi.fn(),
};

const players = [
  makePlayer({ id: 'p1', name: 'Tank One', position: 'T1', sortOrder: 0 }),
  makePlayer({ id: 'p2', name: 'Melee One', position: 'M1', sortOrder: 1 }),
];

describe('RosterCards — reorder mode', () => {
  it('renders static cards with no drag wiring when reorderMode is false', () => {
    const { container } = render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        reorderMode={false}
        {...baseProps}
      />
    );

    // No droppable wrappers and no dnd-kit draggable attributes on any card.
    expect(container.querySelector('[data-droppable-id]')).toBeNull();
    expect(container.querySelector('[aria-roledescription="draggable"]')).toBeNull();

    const card = screen.getByText('Tank One').closest('[data-testid="roster-card"]');
    expect(card).toHaveAttribute('data-reorder', 'false');
  });

  it('wraps each configured card in a droppable + draggable when reorderMode is true', () => {
    const { container } = render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        reorderMode
        {...baseProps}
      />
    );

    // One droppable wrapper per configured player (the DnD context is active).
    expect(container.querySelectorAll('[data-droppable-id]')).toHaveLength(2);

    // The card root now carries dnd-kit's draggable attributes.
    const card = screen.getByText('Tank One').closest('[data-testid="roster-card"]');
    expect(card).toHaveAttribute('aria-roledescription', 'draggable');
    expect(card).toHaveAttribute('data-reorder', 'true');
  });
});
