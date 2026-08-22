import { describe, it, expect } from 'vitest';
import { buildLogWeekGrid, type LogGridFloor } from './logWeekGridData';
import { FLOOR_LOOT_TABLES } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

// ── Fixture factories (local — no shared loot fixtures exist in the repo;
// shape modeled on QuickLogMaterialModal.test.tsx / needMatrixData.test.ts) ──

let nextLootId = 1;
function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: nextLootId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    itemSlot: 'earring',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

let nextMaterialId = 1;
function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: nextMaterialId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M10S',
    materialType: 'glaze',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

function floorByNumber(grid: LogGridFloor[], n: number): LogGridFloor {
  const f = grid.find((g) => g.floorNumber === n);
  if (!f) throw new Error(`floor ${n} missing from grid`);
  return f;
}

describe('buildLogWeekGrid — shape', () => {
  it('always returns exactly 4 floors, ascending 1 -> 4 (rule: §4 mockup order)', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    expect(grid).toHaveLength(4);
    expect(grid.map((f) => f.floorNumber)).toEqual([1, 2, 3, 4]);
  });

  it('empty floors array still yields 4 floors with fallback names', () => {
    const grid = buildLogWeekGrid({ floors: [], week: 1, lootLog: [], materialLog: [] });
    expect(grid.map((f) => f.floorName)).toEqual(['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4']);
  });

  it('uses the provided floor names when present', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    expect(grid.map((f) => f.floorName)).toEqual(FLOORS);
  });

  it('bookNumeral comes from FLOOR_LOOT_TABLES[n].bookType verbatim', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    for (const f of grid) {
      expect(f.bookNumeral).toBe(FLOOR_LOOT_TABLES[f.floorNumber].bookType);
    }
    expect(grid.map((f) => f.bookNumeral)).toEqual(['I', 'II', 'III', 'IV']);
  });

  it('floor-4 has exactly one gear cell (weapon) and zero material cells', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    const floor4 = floorByNumber(grid, 4);
    expect(floor4.gearCells).toHaveLength(1);
    expect(floor4.gearCells[0]).toMatchObject({ slot: 'weapon', label: 'Weapon' });
    expect(floor4.materialCells).toHaveLength(0);
  });

  it('floor-1 has zero material cells (first floor never drops materials)', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    expect(floorByNumber(grid, 1).materialCells).toHaveLength(0);
  });

  it('rule 1: floor-1 gear cells collapse ring1 to {slot: "ring", label: "Ring"}; other slots use GEAR_SLOT_NAMES', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    const floor1 = floorByNumber(grid, 1);
    expect(floor1.gearCells.map((c) => c.slot)).toEqual(['earring', 'necklace', 'bracelet', 'ring']);
    expect(floor1.gearCells.find((c) => c.slot === 'ring')?.label).toBe('Ring');
    floor1.gearCells.filter((c) => c.slot !== 'ring').forEach((c) => {
      expect(c.label).toBe(GEAR_SLOT_NAMES[c.slot as keyof typeof GEAR_SLOT_NAMES]);
    });
  });

  it('rule 1: material cell labels are the SHORT forms (Twine/Glaze/Solvent/Tome), not the long display names', () => {
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog: [] });
    const floor2Labels = floorByNumber(grid, 2).materialCells.map((c) => c.label);
    const floor3Labels = floorByNumber(grid, 3).materialCells.map((c) => c.label);
    expect(floor2Labels).toEqual(['Glaze', 'Tome']);
    expect(floor3Labels).toEqual(['Twine', 'Solvent']);
  });
});

describe('buildLogWeekGrid — rule 2: week+floor bucketing', () => {
  it('a week-2 grid ignores week-3 entries and includes week-2 entries', () => {
    const lootLog = [
      makeLootEntry({ id: 1, weekNumber: 2, floor: 'M9S', itemSlot: 'earring' }),
      makeLootEntry({ id: 2, weekNumber: 3, floor: 'M9S', itemSlot: 'necklace' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 2, lootLog, materialLog: [] });
    const floor1 = floorByNumber(grid, 1);
    expect(floor1.gearCells.find((c) => c.slot === 'earring')?.entries).toHaveLength(1);
    expect(floor1.gearCells.find((c) => c.slot === 'necklace')?.entries).toHaveLength(0);
  });

  it('entries bucket by matching entry.floor to the tier\'s floor NAME, not floor number', () => {
    const lootLog = [makeLootEntry({ weekNumber: 1, floor: 'M10S', itemSlot: 'head' })];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    expect(floorByNumber(grid, 2).gearCells.find((c) => c.slot === 'head')?.entries).toHaveLength(1);
    expect(floorByNumber(grid, 1).gearCells.some((c) => c.entries.length > 0)).toBe(false);
  });

  it('with an empty floors array, entries stored under the "Floor N" fallback string land correctly (v2-write parity, not legacy-lookup parity)', () => {
    const lootLog = [makeLootEntry({ weekNumber: 1, floor: 'Floor 2', itemSlot: 'hands' })];
    const grid = buildLogWeekGrid({ floors: [], week: 1, lootLog, materialLog: [] });
    expect(floorByNumber(grid, 2).gearCells.find((c) => c.slot === 'hands')?.entries).toHaveLength(1);
  });
});

describe('buildLogWeekGrid — rule 3: ring bucketing across all three spellings', () => {
  it('itemSlot "ring", "ring1", and "ring2" all land in the single "ring" cell', () => {
    const lootLog = [
      makeLootEntry({ id: 1, weekNumber: 1, floor: 'M9S', itemSlot: 'ring', recipientPlayerId: 'a' }),
      makeLootEntry({ id: 2, weekNumber: 1, floor: 'M9S', itemSlot: 'ring1', recipientPlayerId: 'b' }),
      makeLootEntry({ id: 3, weekNumber: 1, floor: 'M9S', itemSlot: 'ring2', recipientPlayerId: 'c' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    const ringCell = floorByNumber(grid, 1).gearCells.find((c) => c.slot === 'ring')!;
    expect(ringCell.entries.map((e) => e.recipientPlayerId).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('buildLogWeekGrid — rule 4: exact match for other gear slots and materials', () => {
  it('non-ring gear cells bucket only their exact itemSlot, not sibling floor-2 slots', () => {
    const lootLog = [
      makeLootEntry({ weekNumber: 1, floor: 'M10S', itemSlot: 'head' }),
      makeLootEntry({ weekNumber: 1, floor: 'M10S', itemSlot: 'hands' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    const floor2 = floorByNumber(grid, 2);
    expect(floor2.gearCells.find((c) => c.slot === 'head')?.entries).toHaveLength(1);
    expect(floor2.gearCells.find((c) => c.slot === 'hands')?.entries).toHaveLength(1);
    expect(floor2.gearCells.find((c) => c.slot === 'feet')?.entries).toHaveLength(0);
  });

  it('material cells bucket only their exact materialType', () => {
    const materialLog = [
      makeMaterialEntry({ weekNumber: 1, floor: 'M10S', materialType: 'glaze' }),
      makeMaterialEntry({ weekNumber: 1, floor: 'M10S', materialType: 'universal_tomestone' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog });
    const floor2 = floorByNumber(grid, 2);
    expect(floor2.materialCells.find((c) => c.material === 'glaze')?.entries).toHaveLength(1);
    expect(floor2.materialCells.find((c) => c.material === 'universal_tomestone')?.entries).toHaveLength(1);
  });
});

describe('buildLogWeekGrid — rule 5: newest-first ordering, tie-break, and array (not single) materials', () => {
  it('two same-cell gear entries with different createdAt sort newest-first', () => {
    const lootLog = [
      makeLootEntry({ id: 1, weekNumber: 1, floor: 'M9S', itemSlot: 'earring', createdAt: '2026-01-01T00:00:00Z' }),
      makeLootEntry({ id: 2, weekNumber: 1, floor: 'M9S', itemSlot: 'earring', createdAt: '2026-01-05T00:00:00Z' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    const entries = floorByNumber(grid, 1).gearCells.find((c) => c.slot === 'earring')!.entries;
    expect(entries.map((e) => e.id)).toEqual([2, 1]);
  });

  it('two same-cell entries sharing the same createdAt tie-break by id DESC', () => {
    const lootLog = [
      makeLootEntry({ id: 5, weekNumber: 1, floor: 'M9S', itemSlot: 'earring', createdAt: '2026-01-01T00:00:00Z' }),
      makeLootEntry({ id: 9, weekNumber: 1, floor: 'M9S', itemSlot: 'earring', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    const entries = floorByNumber(grid, 1).gearCells.find((c) => c.slot === 'earring')!.entries;
    expect(entries.map((e) => e.id)).toEqual([9, 5]);
  });

  it('a material cell holds an ARRAY of entries — a double-solvent week is not under-reported to one', () => {
    const materialLog = [
      makeMaterialEntry({ id: 1, weekNumber: 1, floor: 'M11S', materialType: 'solvent', createdAt: '2026-01-01T00:00:00Z' }),
      makeMaterialEntry({ id: 2, weekNumber: 1, floor: 'M11S', materialType: 'solvent', createdAt: '2026-01-02T00:00:00Z' }),
    ];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog: [], materialLog });
    const solventCell = floorByNumber(grid, 3).materialCells.find((c) => c.material === 'solvent')!;
    expect(solventCell.entries).toHaveLength(2);
    expect(solventCell.entries.map((e) => e.id)).toEqual([2, 1]); // newest first
  });
});

describe('buildLogWeekGrid — rule 6: unmatched entries are silently excluded, never throw', () => {
  it('an unknown itemSlot never lands anywhere and does not throw', () => {
    const lootLog = [makeLootEntry({ weekNumber: 1, floor: 'M9S', itemSlot: 'not-a-real-slot' })];
    expect(() => buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] })).not.toThrow();
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    const totalEntries = grid.flatMap((f) => f.gearCells).reduce((sum, c) => sum + c.entries.length, 0);
    expect(totalEntries).toBe(0);
  });

  it('a page-ledger-echo "Adjustment" floor never lands anywhere and does not throw', () => {
    const lootLog = [makeLootEntry({ weekNumber: 1, floor: 'Adjustment', itemSlot: 'earring' })];
    const materialLog = [makeMaterialEntry({ weekNumber: 1, floor: 'Adjustment', materialType: 'glaze' })];
    expect(() => buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog })).not.toThrow();
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog });
    const totalGear = grid.flatMap((f) => f.gearCells).reduce((sum, c) => sum + c.entries.length, 0);
    const totalMaterial = grid.flatMap((f) => f.materialCells).reduce((sum, c) => sum + c.entries.length, 0);
    expect(totalGear).toBe(0);
    expect(totalMaterial).toBe(0);
  });

  it('a week mismatch on an otherwise-valid entry excludes it', () => {
    const lootLog = [makeLootEntry({ weekNumber: 7, floor: 'M9S', itemSlot: 'earring' })];
    const grid = buildLogWeekGrid({ floors: FLOORS, week: 1, lootLog, materialLog: [] });
    expect(floorByNumber(grid, 1).gearCells.find((c) => c.slot === 'earring')?.entries).toHaveLength(0);
  });
});
