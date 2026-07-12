import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deriveLootActivityItems } from './lootActivity';
import type { LootLogEntry, MaterialLogEntry } from '../types';

// Loot/material fold for the v2 Home activity feed (Phase A / A6).
// Labels are terse, mount-row style:
//   loot     → "{recipient} received {slot display name} — {fight}"
//   material → "{recipient} received {material display name}"
// Slot names come from GEAR_SLOT_NAMES, material names from
// UPGRADE_MATERIAL_DISPLAY_NAMES — the same sources LootEntryRow uses.
// `relativeTime` reads Date.now(), so the clock is frozen for determinism.

const NOW = '2026-06-30T12:00:00Z';

function lootEntry(partial: Partial<LootLogEntry> & { id: number }): LootLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-30T11:58:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

function materialEntry(partial: Partial<MaterialLogEntry> & { id: number }): MaterialLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p2',
    recipientPlayerName: 'Bob',
    method: 'drop',
    createdAt: '2026-06-30T11:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveLootActivityItems', () => {
  it('returns [] for empty inputs', () => {
    expect(deriveLootActivityItems([], [])).toEqual([]);
  });

  it('formats a loot row: recipient, slot display name, fight, relative time (exact output)', () => {
    const items = deriveLootActivityItems([lootEntry({ id: 1 })], []);
    expect(items).toEqual([
      {
        key: 'loot-1',
        type: 'loot_received',
        icon: 'loot',
        label: 'Alice received Body — M11S',
        createdAt: '2026-06-30T11:58:00Z',
        time: '2m ago',
      },
    ]);
  });

  it('falls back to the raw itemSlot when it has no display name', () => {
    const items = deriveLootActivityItems([lootEntry({ id: 2, itemSlot: 'mystery_slot' })], []);
    expect(items[0].label).toBe('Alice received mystery_slot — M11S');
  });

  it('formats a material row: recipient + material display name, no fight (exact output)', () => {
    const items = deriveLootActivityItems([], [materialEntry({ id: 7 })]);
    expect(items).toEqual([
      {
        key: 'material-7',
        type: 'material_received',
        icon: 'material',
        label: 'Bob received Twine',
        createdAt: '2026-06-30T11:00:00Z',
        time: '1h ago',
      },
    ]);
  });

  it('merges both logs sorted by createdAt desc', () => {
    const items = deriveLootActivityItems(
      [
        lootEntry({ id: 1, createdAt: '2026-06-30T09:00:00Z' }),
        lootEntry({ id: 2, createdAt: '2026-06-30T11:58:00Z' }),
      ],
      [materialEntry({ id: 7, createdAt: '2026-06-30T11:00:00Z' })],
    );
    expect(items.map((i) => i.key)).toEqual(['loot-2', 'material-7', 'loot-1']);
  });
});
