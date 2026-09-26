import { useState, type Dispatch, type SetStateAction } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LootAdjustmentsModal, type AdjustmentUpdate } from './LootAdjustmentsModal';
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

function makePlayer(id: string, name: string, opts: { lootAdjustment?: number; priorityModifier?: number; isSubstitute?: boolean } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'BLM', role: 'caster',
    configured: true, sortOrder: 0, isSubstitute: opts.isSubstitute ?? false,
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

  it('keeps the modal open and toasts the rejection error message when onSave rejects (R-E2-K)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Failed to update 1 player(s)'));
    const onClose = vi.fn();
    render(<LootAdjustmentsModal isOpen players={players} onClose={onClose} onSave={onSave} />);

    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Exactly one toast, carrying onSave's own message (not a generic string).
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Failed to update 1 player(s)');
    expect(onClose).not.toHaveBeenCalled();
    // The draft survives the rejection intact.
    expect(spinbuttons[0]).toHaveValue(10);
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    const onSave = vi.fn().mockRejectedValue('boom');
    render(<LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith('Failed to save adjustments');
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

  it('a player added mid-open (no seed entry) renders its LIVE values, not zeros', () => {
    // Open with just player1/player2 (seeded). Then a store churn adds player3
    // WHILE open — the open-transition guard won't re-seed, so player3 has no
    // draft entry. The render fallback must use player3's live values, not 0/0.
    const { rerender } = render(
      <LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={vi.fn()} />
    );
    const player3 = makePlayer('p3', 'Player Three', { lootAdjustment: 30, priorityModifier: 5 });
    rerender(
      <LootAdjustmentsModal isOpen players={[...players, player3]} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('Player Three')).toBeInTheDocument();
    const spinbuttons = screen.getAllByRole('spinbutton');
    // player3 is the 3rd row → spinbuttons[4] (loot adj), spinbuttons[5] (priority mod).
    expect(spinbuttons[4]).toHaveValue(30);
    expect(spinbuttons[5]).toHaveValue(5);
  });

  it('renders a substitute row under a Substitutes group label, after the main-roster rows (R-E2-L)', () => {
    const sub = makePlayer('s1', 'Sub One', { isSubstitute: true });
    render(<LootAdjustmentsModal isOpen players={[...players, sub]} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText('Substitutes')).toBeInTheDocument();
    expect(screen.getByText('Sub One')).toBeInTheDocument();
    const names = screen.getAllByText(/Player One|Player Two|Sub One/).map((el) => el.textContent);
    expect(names).toEqual(['Player One', 'Player Two', 'Sub One']);
  });

  it('renders no Substitutes group label when there are no subs', () => {
    render(<LootAdjustmentsModal isOpen players={players} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByText('Substitutes')).not.toBeInTheDocument();
  });

  it("saving a substitute's edit reports an update for that substitute", async () => {
    const sub = makePlayer('s1', 'Sub One', { isSubstitute: true });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LootAdjustmentsModal isOpen players={[...players, sub]} onClose={vi.fn()} onSave={onSave} />);

    // Rows: player1 (0,1), player2 (2,3), sub (4,5) — sub's loot-adj input.
    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[4], { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      { playerId: 's1', lootAdjustment: 7, priorityModifier: 0 },
    ]);
  });

  // E2 review I-4: a partial failure keeps the modal open, so the rows the save
  // sent must re-seed from the LIVE post-save values — otherwise reverting a
  // row that DID save diffs equal to its stale open-time seed, sends nothing,
  // and closes as a success while the store keeps the saved value.
  it('after a partial failure, reverting a row that saved sends the revert (I-4)', async () => {
    type SetLive = Dispatch<SetStateAction<SnapshotPlayer[]>>;
    // Stands in for Loot: `players` is live store state the save mutates.
    function Harness({ onSave, onClose }: {
      onSave: (updates: AdjustmentUpdate[], setLive: SetLive) => Promise<void>;
      onClose: () => void;
    }) {
      const [live, setLive] = useState<SnapshotPlayer[]>([
        player1,
        player2,
        makePlayer('p3', 'Player Three', { lootAdjustment: 5 }),
      ]);
      return <LootAdjustmentsModal isOpen players={live} onClose={onClose} onSave={(u) => onSave(u, setLive)} />;
    }

    const onClose = vi.fn();
    const onSave = vi
      .fn<(updates: AdjustmentUpdate[], setLive: SetLive) => Promise<void>>()
      .mockImplementationOnce(async (_updates, setLive) => {
        await Promise.resolve(); // the PUTs are async
        // tierStore.updatePlayer's outcome: p1's PUT succeeded (the store keeps
        // 10), p2's failed (rolled back to 20/-10). p3, which this save never
        // sent, moved remotely (5 → 40) in the meantime.
        setLive((prev) =>
          prev.map((p) =>
            p.id === 'p1' ? { ...p, lootAdjustment: 10 } : p.id === 'p3' ? { ...p, lootAdjustment: 40 } : p
          )
        );
        throw new Error('Failed to update 1 player(s)');
      })
      .mockResolvedValueOnce(undefined);
    render(<Harness onSave={onSave} onClose={onClose} />);

    // Rows: p1 (0,1), p2 (2,3), p3 (4,5).
    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '10' } });
    fireEvent.change(spinbuttons[3], { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update 1 player(s)'));
    expect(onSave).toHaveBeenNthCalledWith(
      1,
      [
        { playerId: 'p1', lootAdjustment: 10, priorityModifier: 0 },
        { playerId: 'p2', lootAdjustment: 20, priorityModifier: 15 },
      ],
      expect.any(Function)
    );
    expect(onClose).not.toHaveBeenCalled();
    // The draft survives: both edits still show.
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(10);
    expect(screen.getAllByRole('spinbutton')[3]).toHaveValue(15);

    // Revert p1 to its ORIGINAL value (0) — the store now holds 10.
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    // p1's revert is sent; p2's failed edit is retried; p3 (never sent, moved
    // remotely) is NOT overwritten with its stale open-time draft.
    expect(onSave).toHaveBeenNthCalledWith(
      2,
      [
        { playerId: 'p1', lootAdjustment: 0, priorityModifier: 0 },
        { playerId: 'p2', lootAdjustment: 20, priorityModifier: 15 },
      ],
      expect.any(Function)
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
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
