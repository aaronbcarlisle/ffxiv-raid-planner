import { describe, it, expect } from 'vitest';
import {
  buildSlotJumpTargets,
  jumpMenuAnchor,
  jumpAnchorSlotOf,
  gearRowDomId,
  isJumpAnchorSlot,
  entryJumpView,
} from './rosterLedgerJumps';
import type { HistoryItem } from '../loot/logWeekGridData';
import type { LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOTS } from '../../types';

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

// ⚠ Real field names, no `as` cast: `LootLogEntry`/`MaterialLogEntry` carry
// `floor: string` and `recipientPlayerName` (types/index.ts:1242-1259,
// :1292-1307) — NOT `floorNumber`/`recipientName`. A cast would hide the next
// shape change instead of failing on it.
const lootHistoryItem = (over: Partial<LootLogEntry>): HistoryItem => ({
  kind: 'loot',
  entry: {
    id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M11S', itemSlot: 'head',
    recipientPlayerId: 'p1', recipientPlayerName: 'Tank One', method: 'drop', isExtra: false,
    createdAt: '2026-01-01T00:00:00Z', createdByUserId: 'u1', createdByUsername: 'dev',
    ...over,
  },
});

const materialHistoryItem = (over: Partial<MaterialLogEntry>): HistoryItem => ({
  kind: 'material',
  entry: {
    id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M11S', materialType: 'twine',
    recipientPlayerId: 'p1', recipientPlayerName: 'Tank One', method: 'drop',
    slotAugmented: 'head', createdAt: '2026-01-01T00:00:00Z', createdByUserId: 'u1',
    createdByUsername: 'dev',
    ...over,
  },
});

describe('jumpAnchorSlotOf', () => {
  it('maps a loot entry to its own slot', () => {
    expect(jumpAnchorSlotOf(lootHistoryItem({ itemSlot: 'body' }))).toBe('body');
  });

  // R-D12-H: the loot log stores one `ring`; gear tracks ring1/ring2.
  it('anchors a generic ring loot entry to ring1', () => {
    expect(jumpAnchorSlotOf(lootHistoryItem({ itemSlot: 'ring' }))).toBe('ring1');
  });

  it('passes an explicit ring1/ring2 through unchanged', () => {
    expect(jumpAnchorSlotOf(lootHistoryItem({ itemSlot: 'ring2' }))).toBe('ring2');
  });

  it('returns null for an unknown itemSlot', () => {
    expect(jumpAnchorSlotOf(lootHistoryItem({ itemSlot: 'mount' }))).toBeNull();
  });

  it('maps a material entry to its augmented slot', () => {
    expect(jumpAnchorSlotOf(materialHistoryItem({ slotAugmented: 'legs' }))).toBe('legs');
  });

  // R-D12-E: NOT normalized to 'weapon' — the sub-row owns it (C4).
  it('keeps tome_weapon as its own anchor, never the weapon row', () => {
    expect(jumpAnchorSlotOf(materialHistoryItem({ slotAugmented: 'tome_weapon' }))).toBe('tome_weapon');
  });

  // R-D12-F / phase-d-loot-plan.md:200: universal tomestone lands on the card.
  it('returns null for a material entry with no slotAugmented', () => {
    expect(jumpAnchorSlotOf(materialHistoryItem({ slotAugmented: null }))).toBeNull();
    expect(jumpAnchorSlotOf(materialHistoryItem({ slotAugmented: undefined }))).toBeNull();
  });
});

describe('gearRowDomId', () => {
  it('builds the legacy-shaped anchor id', () => {
    expect(gearRowDomId('p1', 'head')).toBe('gear-row-p1-head');
    expect(gearRowDomId('p1', 'tome_weapon')).toBe('gear-row-p1-tome_weapon');
  });
});

describe('isJumpAnchorSlot', () => {
  it('accepts every gear slot and tome_weapon', () => {
    for (const slot of GEAR_SLOTS) {
      expect(isJumpAnchorSlot(slot)).toBe(true);
    }
    expect(isJumpAnchorSlot('tome_weapon')).toBe(true);
  });

  it('rejects invalid slots', () => {
    expect(isJumpAnchorSlot('ring')).toBe(false);   // normalized upstream, never an anchor
    expect(isJumpAnchorSlot('')).toBe(false);
    expect(isJumpAnchorSlot('__proto__')).toBe(false);
    expect(isJumpAnchorSlot('constructor')).toBe(false);
  });
});

describe('entryJumpView', () => {
  // R-D12-A: the displayed week, not "older".
  it('routes an entry in the displayed week to the Log', () => {
    expect(entryJumpView(3, 3)).toBe('log');
  });

  it('routes an OLDER entry to History', () => {
    expect(entryJumpView(2, 5)).toBe('history');
  });

  it('routes a NEWER entry to History too', () => {
    expect(entryJumpView(7, 5)).toBe('history');
  });

  // R-D12-C: a provisional clock is signalled by a null displayedWeek.
  it('routes to History when the displayed week is unknown', () => {
    expect(entryJumpView(3, null)).toBe('history');
  });

  it('routes to History when the entry has no week', () => {
    expect(entryJumpView(null, 3)).toBe('history');
    expect(entryJumpView(undefined, 3)).toBe('history');
  });

  // Kills a `displayedWeek ?? 1` fallback — the provisional-week-1 hazard
  // R-D12-C exists to prevent. Without this, that mutant returns 'history'
  // for (3, null) and passes.
  it('routes a week-1 entry to History when the displayed week is unknown', () => {
    expect(entryJumpView(1, null)).toBe('history');
  });

  // Kills outright deletion of the null guard: `null === null` is true, so an
  // unguarded comparison would return 'log'.
  it('routes to History when NEITHER week is known', () => {
    expect(entryJumpView(null, null)).toBe('history');
  });
});
