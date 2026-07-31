import { describe, it, expect } from 'vitest';
import {
  sortByPosition, buildGearMatrixRows, buildMaterialMatrixRows, materialNeedCount, materialNeedProgress,
} from './needMatrixData';
import {
  getPriorityForItem, getPriorityForRing, getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone,
} from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { FLOOR_LOOT_TABLES, getFloorForUpgradeMaterial, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type {
  SnapshotPlayer, GearSlot, GearSlotStatus, RaidPosition, TomeWeaponStatus, MaterialLogEntry, MaterialType,
} from '../../types';

const ALL_GEAR_SLOTS: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];

function makePlayer(id: string, name: string, opts: {
  position?: RaidPosition | null;
  gear?: Partial<Record<GearSlot, Partial<GearSlotStatus>>>;
  tomeWeapon?: Partial<TomeWeaponStatus>;
} = {}): SnapshotPlayer {
  const gear: GearSlotStatus[] = ALL_GEAR_SLOTS.map((slot) => ({
    slot, bisSource: null, hasItem: false, isAugmented: false,
    ...(opts.gear?.[slot] ?? {}),
  }));
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    position: opts.position ?? null,
    configured: true, sortOrder: 0, isSubstitute: false,
    gear,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false, ...opts.tomeWeapon },
    weaponPriorities: [], weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as unknown as SnapshotPlayer;
}

let logId = 1;
function makeMaterialEntry(
  materialType: MaterialType, recipientPlayerId: string, slotAugmented?: GearSlot | 'tome_weapon' | null,
): MaterialLogEntry {
  return {
    id: logId++, tierSnapshotId: 't1', weekNumber: 1, floor: 'M9S', materialType,
    recipientPlayerId, recipientPlayerName: 'x', method: 'drop',
    slotAugmented: slotAugmented ?? null,
    createdAt: '2026-01-01T00:00:00Z', createdByUserId: 'u', createdByUsername: 'u',
  } as MaterialLogEntry;
}

const settings = { ...DEFAULT_SETTINGS };

describe('sortByPosition', () => {
  it('orders T1,T2,H1,H2,M1,M2,R1,R2; no/unknown position sorts last, original order preserved among them', () => {
    const r2 = makePlayer('1', 'R2p', { position: 'R2' });
    const noPos = makePlayer('2', 'NoPos', { position: null });
    const t1 = makePlayer('3', 'T1p', { position: 'T1' });
    const unknownPos = makePlayer('4', 'UnknownPos', { position: 'XX' as unknown as RaidPosition });
    const h1 = makePlayer('5', 'H1p', { position: 'H1' });

    const out = sortByPosition([r2, noPos, t1, unknownPos, h1]);

    expect(out.map((p) => p.id)).toEqual(['3', '5', '1', '2', '4']);
  });
});

describe('buildGearMatrixRows — row order', () => {
  it('is floor-banded F4→F1, derived from FLOOR_LOOT_TABLES (ring1 collapses to slot "ring")', () => {
    const expectedFloors = ([4, 3, 2, 1] as FloorNumber[]);
    const expectedSlots = expectedFloors.flatMap(
      (floor) => FLOOR_LOOT_TABLES[floor].gearDrops.map((slot) => (slot === 'ring1' ? 'ring' : slot)),
    );
    const expectedFloorNumbers = expectedFloors.flatMap(
      (floor) => FLOOR_LOOT_TABLES[floor].gearDrops.map(() => floor),
    );

    // Lock in the literal D3-ruled sequence so a silent tier-data change is caught.
    expect(expectedSlots).toEqual([
      'weapon', 'body', 'legs', 'head', 'hands', 'feet', 'earring', 'necklace', 'bracelet', 'ring',
    ]);
    expect(expectedFloorNumbers).toEqual([4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);

    const rows = buildGearMatrixRows([], settings);

    expect(rows.map((r) => r.slot)).toEqual(expectedSlots);
    expect(rows.map((r) => r.floorNumber)).toEqual(expectedFloorNumbers);
    expect(rows.find((r) => r.slot === 'ring')?.label).toBe('Ring');
    rows.filter((r) => r.slot !== 'ring').forEach((r) => {
      expect(r.label).toBe(GEAR_SLOT_NAMES[r.slot as GearSlot]);
    });
  });
});

describe('buildGearMatrixRows — membership consistency (R-6 invariant)', () => {
  const alice = makePlayer('a', 'Alice', { gear: { earring: { bisSource: 'raid', hasItem: false } } });
  const bob = makePlayer('b', 'Bob', { gear: { earring: { bisSource: 'raid', hasItem: true } } });
  const cara = makePlayer('c', 'Cara', { gear: { earring: { bisSource: 'tome', hasItem: false } } });
  const dana = makePlayer('d', 'Dana', { gear: { ring2: { bisSource: 'raid', hasItem: false } } });
  const players = [alice, bob, cara, dana];

  it('every gear row.needers equals the corresponding pool (getPriorityForRing / getPriorityForItem)', () => {
    const rows = buildGearMatrixRows(players, settings);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const pool = row.slot === 'ring'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, row.slot as GearSlot, settings);
      expect(row.needers).toEqual(new Set(pool.map((e) => e.player.id)));
    }
  });

  it('ring semantics: the ring2-only needer is in the "ring" row needers', () => {
    const rows = buildGearMatrixRows(players, settings);
    const ringRow = rows.find((r) => r.slot === 'ring')!;
    expect(ringRow.needers.has('d')).toBe(true);
  });

  it('earring row needers is exactly {alice}', () => {
    const rows = buildGearMatrixRows(players, settings);
    const earringRow = rows.find((r) => r.slot === 'earring')!;
    expect(earringRow.needers).toEqual(new Set(['a']));
  });
});

describe('materialNeedCount — twine', () => {
  it('tome + hasItem + !isAugmented + augmenting itemName → 1', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedCount(p, 'twine', [])).toBe(1);
  });

  it('hasItem: false → 0', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: false, isAugmented: false, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedCount(p, 'twine', [])).toBe(0);
  });

  it('bisSource raid → 0', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedCount(p, 'twine', [])).toBe(0);
  });

  it('isAugmented: true → 0', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedCount(p, 'twine', [])).toBe(0);
  });

  it('non-augmenting itemName (base-tome BiS) → 0', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Quetzalli Coat' } },
    });
    expect(materialNeedCount(p, 'twine', [])).toBe(0);
  });
});

describe('materialNeedCount — received subtraction (twine)', () => {
  const p = makePlayer('p', 'P', {
    gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest of X' } },
  });

  it('a log entry with slotAugmented: null subtracts 1', () => {
    const log = [makeMaterialEntry('twine', 'p', null)];
    expect(materialNeedCount(p, 'twine', log)).toBe(0);
  });

  it('a log entry WITH slotAugmented set does NOT subtract (mirrors priority.ts:417-431)', () => {
    const log = [makeMaterialEntry('twine', 'p', 'body')];
    expect(materialNeedCount(p, 'twine', log)).toBe(1);
  });
});

describe('materialNeedCount — solvent is pool-faithful and additive', () => {
  it('tome-BiS weapon row AND pursuing tomeWeapon both unaugmented → counts 2 and is in the pool', () => {
    const p = makePlayer('p', 'P', {
      gear: { weapon: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Weapon' } },
      tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    });
    expect(materialNeedCount(p, 'solvent', [])).toBe(2);
    const pool = getPriorityForUpgradeMaterial([p], 'solvent', settings, []);
    expect(pool.map((e) => e.player.id)).toContain('p');
  });

  it('ONLY the tomeWeapon path → counts 1', () => {
    const p = makePlayer('p', 'P', {
      tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    });
    expect(materialNeedCount(p, 'solvent', [])).toBe(1);
  });
});

describe('materialNeedCount — universal_tomestone', () => {
  it('pursuing && !hasItem → 1', () => {
    const p = makePlayer('p', 'P', { tomeWeapon: { pursuing: true, hasItem: false } });
    expect(materialNeedCount(p, 'universal_tomestone', [])).toBe(1);
  });

  it('a materialLog entry of that type subtracts regardless of slotAugmented', () => {
    const p = makePlayer('p', 'P', { tomeWeapon: { pursuing: true, hasItem: false } });
    const log = [makeMaterialEntry('universal_tomestone', 'p', 'tome_weapon')];
    expect(materialNeedCount(p, 'universal_tomestone', log)).toBe(0);
  });

  it('not pursuing → 0', () => {
    const p = makePlayer('p', 'P', { tomeWeapon: { pursuing: false, hasItem: false } });
    expect(materialNeedCount(p, 'universal_tomestone', [])).toBe(0);
  });
});

describe('materialNeedCount — pool consistency (load-bearing property test)', () => {
  const twineNeeder = makePlayer('a', 'Alice', {
    gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest' } },
  });
  const glazeNeeder = makePlayer('b', 'Bob', {
    gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Earring' } },
  });
  const solventNeeder = makePlayer('c', 'Cara', {
    gear: { weapon: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Weapon' } },
  });
  const tomestoneNeeder = makePlayer('d', 'Dana', { tomeWeapon: { pursuing: true, hasItem: false } });
  const noNeeds = makePlayer('e', 'Eve');
  const players = [twineNeeder, glazeNeeder, solventNeeder, tomestoneNeeder, noNeeds];
  // Alice already received her twine — exercises the zero-after-subtraction case too.
  const materialLog = [makeMaterialEntry('twine', 'a', null)];

  const materials: ('twine' | 'glaze' | 'solvent' | 'universal_tomestone')[] = [
    'twine', 'glaze', 'solvent', 'universal_tomestone',
  ];

  it.each(materials)('%s: materialNeedCount > 0 iff player is in the matching pool', (material) => {
    const pool = material === 'universal_tomestone'
      ? getPriorityForUniversalTomestone(players, settings, materialLog)
      : getPriorityForUpgradeMaterial(players, material, settings, materialLog);
    const poolIds = new Set(pool.map((e) => e.player.id));

    for (const p of players) {
      const n = materialNeedCount(p, material, materialLog);
      expect(n > 0).toBe(poolIds.has(p.id));
    }
  });
});

describe('buildMaterialMatrixRows', () => {
  const twineNeeder = makePlayer('a', 'Alice', {
    gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest' } },
  });
  const glazeNeeder = makePlayer('b', 'Bob', {
    gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Earring' } },
  });
  const noNeeds = makePlayer('e', 'Eve');
  const players = [twineNeeder, glazeNeeder, noNeeds];

  it('orders rows twine, glaze, solvent, universal_tomestone', () => {
    const rows = buildMaterialMatrixRows(players, []);
    expect(rows.map((r) => r.material)).toEqual(['twine', 'glaze', 'solvent', 'universal_tomestone']);
  });

  it('counts map holds only >0 entries (MaterialNeedProgress values) and totalNeeded is the sum of needed', () => {
    const rows = buildMaterialMatrixRows(players, []);
    const twineRow = rows.find((r) => r.material === 'twine')!;
    expect([...twineRow.counts.entries()]).toEqual([['a', { total: 1, needed: 1 }]]);
    expect(twineRow.totalNeeded).toBe(1);

    const solventRow = rows.find((r) => r.material === 'solvent')!;
    expect(solventRow.counts.size).toBe(0);
    expect(solventRow.totalNeeded).toBe(0);
  });

  it('floorNumbers matches getFloorForUpgradeMaterial(material)', () => {
    const rows = buildMaterialMatrixRows(players, []);
    for (const row of rows) {
      expect(row.floorNumbers).toEqual(getFloorForUpgradeMaterial(row.material));
    }
  });
});

describe('materialNeedProgress — total is augmentation-agnostic, needed is pool-faithful', () => {
  it('twine: an augmented slot counts toward total but NOT needed (it is the "done" slice)', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedProgress(p, 'twine', [])).toEqual({ total: 1, needed: 0 });
  });

  it('twine: an unaugmented slot counts toward both total and needed', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest of X' } },
    });
    expect(materialNeedProgress(p, 'twine', [])).toEqual({ total: 1, needed: 1 });
  });

  it('solvent is additive: gear path (augmented) + tomeWeapon path (unaugmented) → total 2, needed reflects only the unaugmented side', () => {
    const p = makePlayer('p', 'P', {
      gear: { weapon: { bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Weapon' } },
      tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    });
    expect(materialNeedProgress(p, 'solvent', [])).toEqual({ total: 2, needed: 1 });
  });

  it('universal_tomestone: total is 1 whenever pursuing, regardless of hasItem (an acquired-but-tracked tome weapon is a "done" slice)', () => {
    expect(materialNeedProgress(
      makePlayer('p', 'P', { tomeWeapon: { pursuing: true, hasItem: false } }), 'universal_tomestone', [],
    )).toEqual({ total: 1, needed: 1 });
    expect(materialNeedProgress(
      makePlayer('q', 'Q', { tomeWeapon: { pursuing: true, hasItem: true } }), 'universal_tomestone', [],
    )).toEqual({ total: 1, needed: 0 });
    expect(materialNeedProgress(
      makePlayer('r', 'R', { tomeWeapon: { pursuing: false, hasItem: false } }), 'universal_tomestone', [],
    )).toEqual({ total: 0, needed: 0 });
  });

  it('a slotless log receipt reduces needed but NOT total', () => {
    const p = makePlayer('p', 'P', {
      gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest of X' } },
    });
    const log = [makeMaterialEntry('twine', 'p', null)];
    expect(materialNeedProgress(p, 'twine', log)).toEqual({ total: 1, needed: 0 });
  });

  it('invariant across a mixed fixture: needed ≤ total, and needed > 0 ⟹ total > 0', () => {
    const players = [
      makePlayer('a', 'Alice', {
        gear: { body: { bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Chest' } },
      }),
      makePlayer('b', 'Bob', {
        gear: { earring: { bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Earring' } },
      }),
      makePlayer('c', 'Cara', {
        gear: { weapon: { bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Weapon' } },
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      }),
      makePlayer('d', 'Dana', { tomeWeapon: { pursuing: true, hasItem: false } }),
      makePlayer('e', 'Eve'),
    ];
    const materials: ('twine' | 'glaze' | 'solvent' | 'universal_tomestone')[] = [
      'twine', 'glaze', 'solvent', 'universal_tomestone',
    ];
    const log = [makeMaterialEntry('twine', 'a', null)];

    for (const material of materials) {
      for (const p of players) {
        const { total, needed } = materialNeedProgress(p, material, log);
        expect(needed).toBeLessThanOrEqual(total);
        if (needed > 0) expect(total).toBeGreaterThan(0);
      }
    }
  });
});
