import { describe, it, expect } from 'vitest';
import { buildSlotJumpTargets, jumpMenuAnchor } from './rosterLedgerJumps';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

function loot(overrides: Partial<LootLogEntry> & { id: number; itemSlot: string }): LootLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'floor1',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Tank One',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-07-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'owner',
    ...overrides,
  };
}

function material(
  overrides: Partial<MaterialLogEntry> & { id: number }
): MaterialLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'floor1',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Tank One',
    method: 'drop',
    createdAt: '2026-07-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'owner',
    ...overrides,
  };
}

describe('buildSlotJumpTargets (C7, D-05)', () => {
  it('maps a slot to its loot entry id', () => {
    const targets = buildSlotJumpTargets([loot({ id: 7, itemSlot: 'head' })], [], 'p1');
    expect(targets.head?.loot).toBe(7);
  });

  it('ignores entries belonging to another player', () => {
    const targets = buildSlotJumpTargets(
      [loot({ id: 7, itemSlot: 'head', recipientPlayerId: 'p2' })],
      [],
      'p1'
    );
    expect(targets.head).toBeUndefined();
  });

  it('prefers a non-extra entry over an extra one for the same slot', () => {
    const targets = buildSlotJumpTargets(
      [loot({ id: 1, itemSlot: 'body', isExtra: true }), loot({ id: 2, itemSlot: 'body' })],
      [],
      'p1'
    );
    expect(targets.body?.loot).toBe(2);
  });

  it('falls back to an extra entry when that is all the slot has', () => {
    const targets = buildSlotJumpTargets(
      [loot({ id: 1, itemSlot: 'body', isExtra: true })],
      [],
      'p1'
    );
    expect(targets.body?.loot).toBe(1);
  });

  it('serves both ring slots from a generic "ring" entry', () => {
    const targets = buildSlotJumpTargets([loot({ id: 3, itemSlot: 'ring' })], [], 'p1');
    expect(targets.ring1?.loot).toBe(3);
    expect(targets.ring2?.loot).toBe(3);
  });

  it('prefers an exact ring2 entry over the generic ring fallback', () => {
    const targets = buildSlotJumpTargets(
      [loot({ id: 3, itemSlot: 'ring' }), loot({ id: 4, itemSlot: 'ring2' })],
      [],
      'p1'
    );
    expect(targets.ring2?.loot).toBe(4);
    expect(targets.ring1?.loot).toBe(3);
  });

  it('maps an augment material to the slot it augmented', () => {
    const targets = buildSlotJumpTargets([], [material({ id: 11, slotAugmented: 'legs' })], 'p1');
    expect(targets.legs?.material).toBe(11);
  });

  it('never maps a tome-weapon material onto a gear slot (the sub-row owns it)', () => {
    const targets = buildSlotJumpTargets(
      [],
      [material({ id: 12, materialType: 'universal_tomestone', slotAugmented: null })],
      'p1'
    );
    expect(targets.weapon).toBeUndefined();
  });

  it('carries both kinds when a slot has a loot entry and an augment material', () => {
    const targets = buildSlotJumpTargets(
      [loot({ id: 5, itemSlot: 'hands' })],
      [material({ id: 13, slotAugmented: 'hands' })],
      'p1'
    );
    expect(targets.hands).toEqual({ loot: 5, material: 13 });
  });

  it('returns no targets for an empty ledger', () => {
    expect(buildSlotJumpTargets([], [], 'p1')).toEqual({});
  });
});

describe('jumpMenuAnchor (C7, D-05)', () => {
  const rect = { left: 120, bottom: 80 };

  it('uses the cursor position for a real right-click', () => {
    expect(jumpMenuAnchor({ clientX: 40, clientY: 50 }, rect)).toEqual({ x: 40, y: 50 });
  });

  it('keeps a legitimate zero coordinate instead of falling back', () => {
    // A right-click against the viewport's left edge reports clientX 0 — that
    // is a real position, not the "no position" the keyboard case reports
    // (PR #200 review: `e.clientX || rect.left` swallowed it).
    expect(jumpMenuAnchor({ clientX: 0, clientY: 300 }, rect)).toEqual({ x: 0, y: 300 });
    expect(jumpMenuAnchor({ clientX: 300, clientY: 0 }, rect)).toEqual({ x: 300, y: 0 });
  });

  it('anchors to the icon only when the event carries no position at all', () => {
    // Shift+F10 / the context-menu key dispatch with both coordinates 0.
    expect(jumpMenuAnchor({ clientX: 0, clientY: 0 }, rect)).toEqual({ x: 120, y: 80 });
  });
});
