import { describe, it, expect, vi } from 'vitest';
import { materialPriorityEntries, suggestedMaterialRecipient } from './materialSuggestion';
import * as lootCoordination from '../../utils/lootCoordination';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { PriorityEntry } from '../../utils/priority';
import type { EnhancedPriorityEntry } from '../../utils/priorityEntries';
import type {
  SnapshotPlayer, GearSlot, GearSlotStatus, TomeWeaponStatus, LootLogEntry,
} from '../../types';

// materialPriorityEntries is typed PriorityEntry[] (the brief's exact produced
// signature — Task 3/4 rely on it); at runtime it's always the enhanced form.
// This narrows just for the gate-test assertions below.
function enhancedScoreOf(entry: PriorityEntry): number | undefined {
  return (entry as EnhancedPriorityEntry).enhancedScore;
}

// ── Fixture factories (local, modeled on needMatrixData.test.ts /
// QuickLogMaterialModal.test.tsx — no shared loot fixtures exist in the repo) ──

const ALL_GEAR_SLOTS: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];

function makeGear(overrides: Partial<Record<GearSlot, Partial<GearSlotStatus>>> = {}): GearSlotStatus[] {
  return ALL_GEAR_SLOTS.map((slot) => ({
    slot, bisSource: 'raid' as const, hasItem: true, isAugmented: false,
    ...(overrides[slot] ?? {}),
  }));
}

function makePlayer(id: string, name: string, opts: {
  job?: string;
  role?: string;
  gear?: Partial<Record<GearSlot, Partial<GearSlotStatus>>>;
  tomeWeapon?: Partial<TomeWeaponStatus>;
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: opts.job ?? 'WAR', role: opts.role ?? 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: makeGear(opts.gear),
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false, ...opts.tomeWeapon },
    weaponPriorities: [], weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as unknown as SnapshotPlayer;
}

let nextLootId = 1;
function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: nextLootId++, tierSnapshotId: 't1', weekNumber: 1, floor: 'M9S', itemSlot: 'earring',
    recipientPlayerId: 'p1', recipientPlayerName: 'x', method: 'drop', isExtra: false,
    createdAt: '2026-01-01T00:00:00Z', createdByUserId: 'u1', createdByUsername: 'gm',
    ...overrides,
  };
}

const settings = { ...DEFAULT_SETTINGS };

describe('materialPriorityEntries — shape', () => {
  it('returns PriorityEntry-shaped entries ({ player, score }), the actual player objects', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({ player: alice, score: expect.any(Number) }));
  });
});

describe('materialPriorityEntries — top-needer selection', () => {
  it('ranks the higher-role-priority needer first (default lootPriority: melee > ... > tank)', () => {
    const tank = makePlayer('t', 'Tanya', {
      role: 'tank',
      gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } },
    });
    const melee = makePlayer('m', 'Milo', {
      role: 'melee',
      gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } },
    });
    const entries = materialPriorityEntries({
      material: 'glaze', players: [tank, melee], settings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(entries[0].player.id).toBe('m');
    expect(entries[1].player.id).toBe('t');
  });

  it('a fully-raid-geared player (no unaugmented tome pieces) is excluded from the glaze pool', () => {
    const alice = makePlayer('a', 'Alice');
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(entries).toHaveLength(0);
  });
});

describe('materialPriorityEntries — universal tomestone branch', () => {
  it('a player pursuing the tome weapon without it is included; a non-pursuing player is not', () => {
    const pursuing = makePlayer('p', 'Uzo', { tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } });
    const notPursuing = makePlayer('n', 'Nia');
    const entries = materialPriorityEntries({
      material: 'universal_tomestone', players: [pursuing, notPursuing], settings,
      lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(entries.map((e) => e.player.id)).toEqual(['p']);
  });
});

describe('materialPriorityEntries — enhanced-vs-disabled gate (rule 7)', () => {
  it('active (enableEnhancedScoring=true, priorityMode not disabled, lootLog non-empty): entries carry enhancedScore', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };
    const lootLog = [makeLootEntry({ recipientPlayerId: 'a', method: 'drop' })];
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings: enhancedSettings, lootLog, materialLog: [], currentWeek: 1,
    });
    expect(enhancedScoreOf(entries[0])).toBeDefined();
  });

  it('gate off (enableEnhancedScoring=false): entries carry no enhancedScore', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const lootLog = [makeLootEntry({ recipientPlayerId: 'a', method: 'drop' })];
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings, lootLog, materialLog: [], currentWeek: 1,
    });
    expect(enhancedScoreOf(entries[0])).toBeUndefined();
  });

  it('gate off (priorityMode disabled, even with enableEnhancedScoring=true): entries carry no enhancedScore', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const disabledSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true, priorityMode: 'disabled' as const };
    const lootLog = [makeLootEntry({ recipientPlayerId: 'a', method: 'drop' })];
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings: disabledSettings, lootLog, materialLog: [], currentWeek: 1,
    });
    expect(enhancedScoreOf(entries[0])).toBeUndefined();
  });

  it('gate off (empty lootLog, even with enableEnhancedScoring=true): entries carry no enhancedScore', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };
    const entries = materialPriorityEntries({
      material: 'glaze', players: [alice], settings: enhancedSettings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(enhancedScoreOf(entries[0])).toBeUndefined();
  });
});

describe('materialPriorityEntries — averageDrops passthrough', () => {
  it('calculateAverageDrops is NOT called when averageDrops is supplied; the supplied value drives an identical result to computing it', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };
    const lootLog = [makeLootEntry({ recipientPlayerId: 'a', method: 'drop' })];

    const spy = vi.spyOn(lootCoordination, 'calculateAverageDrops');
    const precomputed = lootCoordination.calculateAverageDrops(['a'], lootLog); // the value materialPriorityEntries would compute internally
    spy.mockClear();

    const withArg = materialPriorityEntries({
      material: 'glaze', players: [alice], settings: enhancedSettings, lootLog, materialLog: [], currentWeek: 1,
      averageDrops: precomputed,
    });
    expect(spy).not.toHaveBeenCalled();

    const withoutArg = materialPriorityEntries({
      material: 'glaze', players: [alice], settings: enhancedSettings, lootLog, materialLog: [], currentWeek: 1,
    });
    // Same result whether the caller passes the value or leaves it to be computed.
    expect(enhancedScoreOf(withArg[0])).toBe(enhancedScoreOf(withoutArg[0]));

    spy.mockRestore();
  });
});

describe('suggestedMaterialRecipient — thin [0]?.player wrapper', () => {
  it('returns the top-ranked entry\'s player', () => {
    const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false } } });
    const recipient = suggestedMaterialRecipient({
      material: 'glaze', players: [alice], settings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(recipient).toBe(alice);
  });

  it('returns undefined for an empty pool (nobody needs the material)', () => {
    const alice = makePlayer('a', 'Alice'); // fully raid-geared — needs nothing
    const recipient = suggestedMaterialRecipient({
      material: 'twine', players: [alice], settings, lootLog: [], materialLog: [], currentWeek: 1,
    });
    expect(recipient).toBeUndefined();
  });
});
