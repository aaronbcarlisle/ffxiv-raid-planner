// Edit-mode regression test for AddLootEntryModal (legacy V1's loot edit
// door): an erased note must reach the onUpdate diff as '' — the previous
// `notes || undefined` mapping made JSON.stringify drop the key, so the
// backend's model_fields_set gate saw an absent field and the note could
// never be cleared. (The create/onSubmit branch is untouched.)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AddLootEntryModal } from './AddLootEntryModal';
import type { LootLogEntry, SnapshotPlayer, GearSlotStatus } from '../../types';

function makeGear(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false, ...overrides };
}

function makePlayer(): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Alice',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [
      makeGear({ slot: 'weapon' }),
      makeGear({ slot: 'head' }),
      makeGear({ slot: 'body' }),
    ],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
  };
}

function makeEditEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M9S',
    itemSlot: 'head',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    notes: 'old note',
    createdAt: '2026-08-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'tester',
    ...overrides,
  };
}

function renderEditModal(onUpdate: (updates: unknown) => Promise<void>) {
  return render(
    <AddLootEntryModal
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onUpdate={onUpdate as never}
      players={[makePlayer()]}
      floors={['M9S', 'M10S', 'M11S', 'M12S']}
      currentWeek={3}
      editEntry={makeEditEntry()}
    />
  );
}

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice needs it.
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

describe('AddLootEntryModal edit mode — notes clear wire shape', () => {
  it("an erased note reaches the onUpdate diff as '' (not dropped)", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal(onUpdate);

    const notesField = screen.getByLabelText(/notes/i);
    expect(notesField).toHaveValue('old note');
    fireEvent.change(notesField, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const updates = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect('notes' in updates).toBe(true);
    expect(updates.notes).toBe('');
  });

  it('an unchanged note emits no notes key in the diff', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderEditModal(onUpdate);

    // Change only the week so the diff is non-empty and submits.
    // (NumberInput renders type="number" → spinbutton role; the modal has one.)
    const weekField = screen.getByRole('spinbutton');
    fireEvent.change(weekField, { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const updates = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect('notes' in updates).toBe(false);
    expect(updates.weekNumber).toBe(3);
  });
});
