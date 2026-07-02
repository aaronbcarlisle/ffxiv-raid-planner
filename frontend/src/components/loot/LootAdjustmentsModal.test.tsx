import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LootAdjustmentsModal } from './LootAdjustmentsModal';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer } from '../../types';

vi.mock('../../stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it.
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

function makePlayer(id: string, name: string, opts: { lootAdjustment?: number; priorityModifier?: number } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'BLM', role: 'caster',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
    lootAdjustment: opts.lootAdjustment,
    priorityModifier: opts.priorityModifier,
  } as unknown as SnapshotPlayer;
}

describe('LootAdjustmentsModal', () => {
  const player1 = makePlayer('p1', 'Player One');
  const player2 = makePlayer('p2', 'Player Two', { lootAdjustment: 20, priorityModifier: -10 });
  const players = [player1, player2];

  it('renders a row per player with a JobIcon, name, and two NumberInputs', () => {
    render(
      <LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />
    );
    expect(screen.getByText('Player One')).toBeInTheDocument();
    expect(screen.getByText('Player Two')).toBeInTheDocument();
    // Two players * two NumberInputs each = 4 spinbutton inputs
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it('saves only the changed player when editing one field', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<LootAdjustmentsModal isOpen players={players} onClose={onClose} onSave={onSave} />);

    const spinbuttons = screen.getAllByRole('spinbutton');
    // player1's loot-adjustment input is the first spinbutton (row order = player order)
    fireEvent.change(spinbuttons[0], { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      { playerId: 'p1', lootAdjustment: 10, priorityModifier: 0 },
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('sends both current values when only one knob changed for a player with an existing value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={onSave} />);

    const spinbuttons = screen.getAllByRole('spinbutton');
    // player2 = spinbuttons[2] (loot adj, seeded 20), spinbuttons[3] (priority mod, seeded -10)
    // Only change priority modifier; loot adjustment must still be reported as its current (unseeded) value.
    fireEvent.change(spinbuttons[3], { target: { value: '15' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      { playerId: 'p2', lootAdjustment: 20, priorityModifier: 15 },
    ]);
  });

  it('"Reset all" zeroes both fields for every row and save includes every player whose stored value was non-zero', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /Reset all/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // player1 was already 0/0 (no change); player2 had non-zero values, now reset to 0
    expect(onSave).toHaveBeenCalledWith([
      { playerId: 'p2', lootAdjustment: 0, priorityModifier: 0 },
    ]);
  });

  it('calls onSave([]) and closes when nothing changed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<LootAdjustmentsModal isOpen players={players} onClose={onClose} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the modal open and toasts an error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    render(<LootAdjustmentsModal isOpen players={players} onClose={onClose} onSave={onSave} />);

    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith('Failed to save adjustments');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('open-transition-only seeding: an in-progress edit survives a mid-open players churn, and a close/reopen re-seeds', () => {
    // 1. Render open, edit player1's loot adjustment to 15.
    const { rerender } = render(
      <LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={vi.fn()} />
    );
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '15' } });
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(15);

    // 2. Store churn while OPEN: new players array reference with DIFFERENT stored
    //    values. A re-seed-on-every-render implementation (no wasOpenRef guard)
    //    would clobber the draft with 99 here.
    const churnedPlayers = [
      makePlayer('p1', 'Player One', { lootAdjustment: 99 }),
      makePlayer('p2', 'Player Two', { lootAdjustment: 20, priorityModifier: -10 }),
    ];
    rerender(<LootAdjustmentsModal isOpen players={churnedPlayers} onClose={vi.fn()} onSave={vi.fn()} />);

    // 3. The in-progress edit SURVIVES the churn (the guard's purpose).
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(15);

    // 4. Close, then reopen with the churned players: the field re-seeds fresh (99).
    rerender(<LootAdjustmentsModal isOpen={false} players={churnedPlayers} onClose={vi.fn()} onSave={vi.fn()} />);
    rerender(<LootAdjustmentsModal isOpen players={churnedPlayers} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(99);
  });

  it('re-seeds the draft from player values on each open transition', () => {
    const { rerender } = render(
      <LootAdjustmentsModal isOpen={false} players={players} onClose={vi.fn()} onSave={vi.fn()} />
    );
    rerender(<LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={vi.fn()} />);
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons[2]).toHaveValue(20);
    expect(spinbuttons[3]).toHaveValue(-10);
  });
});
