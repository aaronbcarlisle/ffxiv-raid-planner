/**
 * Off-hand loot-economy exclusion + relevance-gated math (D2 plan Tasks 3/9).
 *
 * The shield is bundled with the weapon since patch 6.2 — it never drops,
 * costs, or scores independently. These tests pin that exclusion the strongest
 * way available: byte-equality of priority scores with and without the minted
 * offhand entry, plus zero-contribution assertions for materials/books/iLv.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePlayerCompletion,
  calculatePlayerMaterials,
  calculatePlayerBooks,
  calculateAverageItemLevel,
} from './calculations';
import { calculatePriorityScore } from './priority';
import { DEFAULT_SETTINGS } from './constants';
import type { GearSlotStatus, SnapshotPlayer, StaticSettings } from '../types';

function makeGear(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false, ...overrides };
}

function eleven(): GearSlotStatus[] {
  return [
    makeGear({ slot: 'weapon' }),
    makeGear({ slot: 'head', hasItem: true }),
    makeGear({ slot: 'body' }),
    makeGear({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: false }),
    makeGear({ slot: 'legs' }),
    makeGear({ slot: 'feet' }),
    makeGear({ slot: 'earring' }),
    makeGear({ slot: 'necklace' }),
    makeGear({ slot: 'bracelet' }),
    makeGear({ slot: 'ring1' }),
    makeGear({ slot: 'ring2' }),
  ];
}

const mintedOffhand: GearSlotStatus = { slot: 'offhand', bisSource: null, hasItem: false, isAugmented: false };

function makePlayer(gear: GearSlotStatus[], job = 'DRG'): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Test',
    job,
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
  };
}

const withOffhand = () => [eleven()[0], mintedOffhand, ...eleven().slice(1)];

describe('priority equality — offhand can never move loot priority (B-1)', () => {
  const modes: Array<Partial<StaticSettings>> = [
    {}, // default settings as configured
  ];

  it('calculatePriorityScore is byte-identical with and without a minted offhand entry', () => {
    for (const settingsOverride of modes) {
      const settings = { ...DEFAULT_SETTINGS, ...settingsOverride } as StaticSettings;
      const without = calculatePriorityScore(makePlayer(eleven()), settings);
      const withOh = calculatePriorityScore(makePlayer(withOffhand()), settings);
      expect(withOh).toBe(without);
    }
  });

  it('holds for a PLD with an OBTAINED shield too (no relative ordering shift)', () => {
    const settings = DEFAULT_SETTINGS as StaticSettings;
    const obtained: GearSlotStatus = {
      slot: 'offhand', bisSource: 'raid', hasItem: true, isAugmented: false, itemId: 49679,
    };
    const without = calculatePriorityScore(makePlayer(eleven(), 'PLD'), settings);
    const withObtained = calculatePriorityScore(
      makePlayer([eleven()[0], obtained, ...eleven().slice(1)], 'PLD'),
      settings
    );
    expect(withObtained).toBe(without);
  });
});

describe('completion denominators (relevant-slot count)', () => {
  it('a minted empty offhand does not change a non-PLD completion percentage', () => {
    expect(calculatePlayerCompletion(withOffhand(), 'DRG')).toBe(calculatePlayerCompletion(eleven(), 'DRG'));
  });

  it('a PLD offhand counts in the denominator', () => {
    // 2 complete (head raid+has, hands tome+has unaugmented is NOT complete... head only)
    const gearNo = eleven();
    const gearWith = withOffhand();
    const pctNo = calculatePlayerCompletion(gearNo, 'PLD');
    const pctWith = calculatePlayerCompletion(gearWith, 'PLD');
    // Same numerator over 12 instead of 11 — percentage must drop.
    expect(pctWith).toBeLessThan(pctNo);
  });
});

describe('materials/books — offhand contributes nothing and never throws', () => {
  it('a tome-sourced obtained shield adds NO solvent/twine/glaze and does not throw', () => {
    const tomeShield: GearSlotStatus = {
      slot: 'offhand', bisSource: 'tome', hasItem: true, isAugmented: false,
    };
    const gear = [eleven()[0], tomeShield, ...eleven().slice(1)];
    // getUpgradeMaterialForSlot throws on unknown slots — this pins the guard.
    const withOh = calculatePlayerMaterials(gear);
    const without = calculatePlayerMaterials(eleven());
    expect(withOh).toEqual(without);
  });

  it('a raid-sourced unobtained shield adds NO books', () => {
    const raidShield: GearSlotStatus = {
      slot: 'offhand', bisSource: 'raid', hasItem: false, isAugmented: false,
    };
    const gear = [eleven()[0], raidShield, ...eleven().slice(1)];
    expect(calculatePlayerBooks(gear)).toEqual(calculatePlayerBooks(eleven()));
  });
});

describe('loot surfaces — offhand can never appear (exclusion pins)', () => {
  it('the Need matrix gear rows contain no offhand on any floor', async () => {
    const { buildGearMatrixRows } = await import('../components/loot/needMatrixData');
    const { DEFAULT_SETTINGS: settings } = await import('./constants');
    const pld = makePlayer(withOffhand(), 'PLD');
    const rows = buildGearMatrixRows([pld], settings as StaticSettings);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.slot !== ('offhand' as never))).toBe(true);
  });

  it('the roster ledger jump targets never populate offhand', async () => {
    const { buildSlotJumpTargets } = await import('../components/roster/rosterLedgerJumps');
    const targets = buildSlotJumpTargets([], [], 'p1');
    expect(targets['offhand' as never]).toBeUndefined();
  });
});

describe('average item level — relevance-gated, weapon ladder (B-2)', () => {
  it('a minted empty offhand contributes nothing to a non-PLD average', () => {
    // High-iLv gear so the phantom "crafted"-priced 12th slot would MOVE the
    // average if counted (an all-crafted fixture passes this vacuously).
    const highGear: GearSlotStatus[] = [
      makeGear({ slot: 'weapon', hasItem: true, itemLevel: 795 }),
      makeGear({ slot: 'head', hasItem: true, itemLevel: 790 }),
      makeGear({ slot: 'body', hasItem: true, itemLevel: 790 }),
      makeGear({ slot: 'legs', hasItem: true, itemLevel: 790 }),
    ];
    const withMinted = [...highGear, mintedOffhand];
    expect(calculateAverageItemLevel(withMinted, 'aac-heavyweight', 'DRG')).toBe(
      calculateAverageItemLevel(highGear, 'aac-heavyweight', 'DRG')
    );
  });

  it('a PLD tome offhand with the item prices on the WEAPON ladder', () => {
    const tomeShield: GearSlotStatus = {
      slot: 'offhand', bisSource: 'tome', hasItem: true, isAugmented: false,
    };
    const tomeWeaponSlot: GearSlotStatus = {
      slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false,
    };
    const shieldAvg = calculateAverageItemLevel([tomeShield], 'aac-heavyweight', 'PLD');
    const weaponAvg = calculateAverageItemLevel([tomeWeaponSlot], 'aac-heavyweight', 'PLD');
    expect(shieldAvg).toBeGreaterThan(0);
    expect(shieldAvg).toBe(weaponAvg);
  });
});
