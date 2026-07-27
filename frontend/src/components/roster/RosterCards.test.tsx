import { render, screen, fireEvent } from '@testing-library/react';
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
  onRemove: vi.fn(),
};

const actionsForPlayer = vi.fn(() => stubActions);
const onConfigurePlayer = vi.fn();

const baseProps = {
  reorderMode: false,
  canManage: true,
  userRole: 'owner' as const,
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  actionsForPlayer,
  onConfigurePlayer,
};

describe('RosterCards', () => {
  beforeEach(() => {
    actionsForPlayer.mockClear();
    onConfigurePlayer.mockClear();
    stubActions.onRemove.mockClear();
  });

  // ── C6 / D-08: per-section collapse ──
  describe('section collapse (D-08)', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: 'Tank Two', position: 'T2' }),
      makePlayer({ id: 'p3', name: 'Sub One', isSubstitute: true }),
    ];

    const collapseProps = (collapsedSections: string[] = []) => ({
      isSectionCollapsed: (s: string) => collapsedSections.includes(s),
      onSectionToggle: vi.fn(),
    });

    it('gives every section a fold control naming what it folds', () => {
      render(
        <RosterCards
          players={players}
          groupView
          subsView
          subsHidden={false}
          {...baseProps}
          {...collapseProps()}
        />
      );

      expect(screen.getByRole('button', { name: /light party 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /light party 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /substitutes/i })).toBeInTheDocument();
    });

    it('hides a folded section’s cards but keeps its header', () => {
      render(
        <RosterCards
          players={players}
          groupView
          subsView
          subsHidden={false}
          {...baseProps}
          {...collapseProps(['g1'])}
        />
      );

      expect(screen.getByText('Light Party 1')).toBeInTheDocument();
      expect(screen.queryByText('Tank One')).not.toBeInTheDocument();
      // Other sections are unaffected.
      expect(screen.getByText('Tank Two')).toBeInTheDocument();
      expect(screen.getByText('Sub One')).toBeInTheDocument();
    });

    it('announces fold state and toggles the right section', () => {
      const props = collapseProps(['g1']);
      render(
        <RosterCards
          players={players}
          groupView
          subsView
          subsHidden={false}
          {...baseProps}
          {...props}
        />
      );

      const g1 = screen.getByRole('button', { name: /light party 1/i });
      const g2 = screen.getByRole('button', { name: /light party 2/i });
      expect(g1).toHaveAttribute('aria-expanded', 'false');
      expect(g2).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(g2);
      expect(props.onSectionToggle).toHaveBeenCalledWith('g2');
    });

    it('folds the substitutes section in the flat view too', () => {
      render(
        <RosterCards
          players={players}
          groupView={false}
          subsView
          subsHidden={false}
          {...baseProps}
          {...collapseProps(['subs'])}
        />
      );

      expect(screen.getByText('Substitutes')).toBeInTheDocument();
      expect(screen.queryByText('Sub One')).not.toBeInTheDocument();
      // The main grid is not a foldable section — its cards always render.
      expect(screen.getByText('Tank One')).toBeInTheDocument();
    });

    it('folds the Unassigned section, which legacy could not', () => {
      const withUnassigned = [
        makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
        makePlayer({ id: 'p9', name: 'Nobody', position: undefined }),
      ];
      render(
        <RosterCards
          players={withUnassigned}
          groupView
          subsView
          subsHidden={false}
          {...baseProps}
          {...collapseProps(['unassigned'])}
        />
      );

      expect(screen.getByText('Unassigned')).toBeInTheDocument();
      expect(screen.queryByText('Nobody')).not.toBeInTheDocument();
      expect(screen.getByText('Tank One')).toBeInTheDocument();
    });
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

  it('renders an OpenSeatCard with per-seat Configure/Remove for an unconfigured position', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
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
    // Phase A A1: the old GLOBAL "Add player" CTA (which spawned another blank
    // slot elsewhere) is gone — replaced by per-seat affordances.
    expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove open seat' })).toBeInTheDocument();
    // The open seat gets REAL bound actions too (previously only configured
    // cards invoked the factory — the kebab Remove was unreachable).
    expect(actionsForPlayer).toHaveBeenCalledWith(players[1]);
  });

  it("wires the open seat's Remove to that seat's own onRemove", () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove open seat' }));
    expect(stubActions.onRemove).toHaveBeenCalledTimes(1);
  });

  it("submits the inline configure form through onConfigurePlayer with THAT seat's id", () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'New Healer' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onConfigurePlayer).toHaveBeenCalledTimes(1);
    expect(onConfigurePlayer).toHaveBeenCalledWith('p2', 'New Healer', 'WHM', 'healer');
  });

  it('hides the open-seat Configure/Remove affordances without roster-manage permission', () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
        canManage={false}
      />
    );

    expect(screen.getByText(/Open seat · Healer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
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
