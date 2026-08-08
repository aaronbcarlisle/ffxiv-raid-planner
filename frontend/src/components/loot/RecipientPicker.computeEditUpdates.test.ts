// Wire-shape tests for the v2 loot edit door's single diff derivation.
// Regression: an erased note must reach the payload as '' — `notes || undefined`
// made JSON.stringify drop the key, so the backend's model_fields_set gate saw
// an absent field and the note could never be cleared.
import { describe, it, expect } from 'vitest';
import { computeEditUpdates } from './recipientPickerEditUpdates';
import type { LootLogEntry } from '../../types';

function makeEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
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

const baseArgs = {
  slot: 'head' as const,
  floorName: 'M9S',
  week: 2,
  method: 'drop' as const,
  recipientPlayerId: 'p1',
  recipientJob: undefined,
};

describe('computeEditUpdates — notes wire shape', () => {
  it("an erased note is included as '' (not dropped as undefined)", () => {
    const updates = computeEditUpdates({ ...baseArgs, editEntry: makeEntry(), notes: '' });
    expect('notes' in updates).toBe(true);
    expect(updates.notes).toBe('');
  });

  it('an unchanged note emits no notes key at all', () => {
    const updates = computeEditUpdates({ ...baseArgs, editEntry: makeEntry(), notes: 'old note' });
    expect('notes' in updates).toBe(false);
  });

  it('a changed note is included verbatim', () => {
    const updates = computeEditUpdates({ ...baseArgs, editEntry: makeEntry(), notes: 'new note' });
    expect(updates.notes).toBe('new note');
  });

  it('erasing the note on an entry that never had one emits no key', () => {
    const updates = computeEditUpdates({ ...baseArgs, editEntry: makeEntry({ notes: undefined }), notes: '' });
    expect('notes' in updates).toBe(false);
  });
});
