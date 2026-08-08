// Edit-mode regression tests for LogMaterialModal (legacy V1's material edit
// door). Focused on the two V1-live bugs fixed together with the ui/Select
// phantom-'' guard:
//  1. A recipient change in edit mode must re-derive the slot selection for
//     the new recipient — the phantom Radix '' event that used to
//     (accidentally) clear the stale slot is now swallowed, so the modal owns
//     the re-derivation explicitly.
//  2. An erased note must reach the update payload as '' (undefined is
//     dropped from the JSON body, so the note could never be cleared).
// Mock surface mirrors QuickLogMaterialModal.test.tsx: only the
// network-touching coordinator and the tier store are mocked; the pure
// eligibility helpers run for real against the fixtures below.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer, GearSlotStatus, MaterialLogEntry } from '../../types';

const { logMaterialAndUpdateGearMock, updatePlayerMock } = vi.hoisted(() => ({
  logMaterialAndUpdateGearMock: vi.fn().mockResolvedValue(undefined),
  updatePlayerMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/materialCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/materialCoordination')>();
  return {
    ...actual,
    logMaterialAndUpdateGear: logMaterialAndUpdateGearMock,
  };
});

vi.mock('../../stores/tierStore', () => ({
  useTierStore: {
    getState: () => ({
      updatePlayer: updatePlayerMock,
      currentTier: { players: [] },
    }),
  },
}));

import { LogMaterialModal } from './LogMaterialModal';

function makeGear(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [
      makeGear({ slot: 'weapon', bisSource: 'raid' }),
      makeGear({ slot: 'head', bisSource: 'raid' }),
      makeGear({ slot: 'body', bisSource: 'raid' }),
      makeGear({ slot: 'hands', bisSource: 'raid' }),
      makeGear({ slot: 'legs', bisSource: 'raid' }),
      makeGear({ slot: 'feet', bisSource: 'raid' }),
      makeGear({ slot: 'earring', bisSource: 'raid' }),
      makeGear({ slot: 'necklace', bisSource: 'raid' }),
      makeGear({ slot: 'bracelet', bisSource: 'raid' }),
      makeGear({ slot: 'ring1', bisSource: 'raid' }),
      makeGear({ slot: 'ring2', bisSource: 'raid' }),
    ],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
    ...overrides,
  };
}

// Twine eligibility = tome-sourced gear obtained but not yet augmented.
// Alice's eligible twine slot is 'head'; Bea's is 'body'.
function fixturePlayers(): { p1: SnapshotPlayer; p2: SnapshotPlayer } {
  const p1 = makePlayer({
    id: 'p1',
    name: 'Alice',
    gear: [
      makeGear({ slot: 'weapon', bisSource: 'raid' }),
      makeGear({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
      makeGear({ slot: 'body', bisSource: 'raid' }),
      makeGear({ slot: 'hands', bisSource: 'raid' }),
      makeGear({ slot: 'legs', bisSource: 'raid' }),
      makeGear({ slot: 'feet', bisSource: 'raid' }),
      makeGear({ slot: 'earring', bisSource: 'raid' }),
      makeGear({ slot: 'necklace', bisSource: 'raid' }),
      makeGear({ slot: 'bracelet', bisSource: 'raid' }),
      makeGear({ slot: 'ring1', bisSource: 'raid' }),
      makeGear({ slot: 'ring2', bisSource: 'raid' }),
    ],
  });
  const p2 = makePlayer({
    id: 'p2',
    name: 'Bea',
    gear: [
      makeGear({ slot: 'weapon', bisSource: 'raid' }),
      makeGear({ slot: 'head', bisSource: 'raid' }),
      makeGear({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
      makeGear({ slot: 'hands', bisSource: 'raid' }),
      makeGear({ slot: 'legs', bisSource: 'raid' }),
      makeGear({ slot: 'feet', bisSource: 'raid' }),
      makeGear({ slot: 'earring', bisSource: 'raid' }),
      makeGear({ slot: 'necklace', bisSource: 'raid' }),
      makeGear({ slot: 'bracelet', bisSource: 'raid' }),
      makeGear({ slot: 'ring1', bisSource: 'raid' }),
      makeGear({ slot: 'ring2', bisSource: 'raid' }),
    ],
  });
  return { p1, p2 };
}

function makeEditEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M11S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    slotAugmented: 'head',
    notes: 'old note',
    createdAt: '2026-08-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'tester',
    ...overrides,
  };
}

function renderEditModal({
  players,
  editEntry,
  onUpdate,
}: {
  players: SnapshotPlayer[];
  editEntry: MaterialLogEntry;
  onUpdate: (data: unknown) => Promise<void>;
}) {
  return render(
    <LogMaterialModal
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onUpdate={onUpdate as never}
      players={players}
      floors={['M9S', 'M10S', 'M11S', 'M12S']}
      currentWeek={3}
      groupId="g1"
      tierId="t1"
      editEntry={editEntry}
    />
  );
}

function slotSelectTrigger(): HTMLElement {
  // Comboboxes in edit mode render in DOM order: floor, recipient, slot.
  const boxes = screen.getAllByRole('combobox');
  return boxes[boxes.length - 1];
}

beforeEach(() => {
  logMaterialAndUpdateGearMock.mockClear();
  updatePlayerMock.mockClear();
  document.body.removeAttribute('style');
  // jsdom has no matchMedia; Modal -> useDevice needs it (same stub as
  // MorePage.test.tsx / WeekScopeControl.test.tsx).
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
    }))
  );
});

describe('LogMaterialModal edit mode — recipient change re-derivation', () => {
  it('re-derives the slot for the NEW recipient instead of keeping the old recipient\'s slot invisibly in state', async () => {
    const { p1, p2 } = fixturePlayers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal({ players: [p1, p2], editEntry: makeEditEntry(), onUpdate });

    // The entry's own slot ('head') is selected on open.
    expect(slotSelectTrigger()).toHaveTextContent('Head');

    // Switch recipient Alice → Bea.
    fireEvent.keyDown(screen.getByRole('combobox', { name: /recipient/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: /Bea/ }));

    // The slot re-derives to Bea's eligible twine slot ('body') — it must not
    // stay 'head' (Alice's slot) in state while the trigger shows a placeholder.
    expect(slotSelectTrigger()).toHaveTextContent('Body');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ recipientPlayerId: 'p2', slotAugmented: 'body' })
    );
  });

  it('switching back to the original recipient restores the entry\'s own slot', async () => {
    const { p1, p2 } = fixturePlayers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal({ players: [p1, p2], editEntry: makeEditEntry(), onUpdate });

    // Alice → Bea → Alice.
    fireEvent.keyDown(screen.getByRole('combobox', { name: /recipient/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: /Bea/ }));
    expect(slotSelectTrigger()).toHaveTextContent('Body');

    fireEvent.keyDown(screen.getByRole('combobox', { name: /recipient/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: /Alice/ }));
    expect(slotSelectTrigger()).toHaveTextContent('Head');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ recipientPlayerId: 'p1', slotAugmented: 'head' })
    );
  });
});

describe('LogMaterialModal edit mode — notes clear wire shape', () => {
  it('an erased note reaches the update payload as \'\' (not undefined), so the server actually clears it', async () => {
    const { p1, p2 } = fixturePlayers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal({ players: [p1, p2], editEntry: makeEditEntry(), onUpdate });

    const notesField = screen.getByLabelText(/notes/i);
    expect(notesField).toHaveValue('old note');
    fireEvent.change(notesField, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const payload = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect('notes' in payload).toBe(true);
    expect(payload.notes).toBe('');
  });

  it('a kept note still reaches the update payload unchanged', async () => {
    const { p1, p2 } = fixturePlayers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal({ players: [p1, p2], editEntry: makeEditEntry(), onUpdate });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ notes: 'old note' })
    );
  });
});
