import { describe, it, expect } from 'vitest';
import { loggedSlotsForWeek } from './loggedSlots';
import type { LootLogEntry, MaterialLogEntry, LootMethod, MaterialType } from '../../../types';

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

let nextId = 1;
function loot(weekNumber: number, floor: string, itemSlot: string, name: string, method: LootMethod = 'drop'): LootLogEntry {
  return {
    id: nextId++, tierSnapshotId: 't1', weekNumber, floor, itemSlot,
    recipientPlayerId: `p-${name}`, recipientPlayerName: name, method, isExtra: false,
    createdAt: '', createdByUserId: 'u', createdByUsername: 'u',
  };
}
function mat(weekNumber: number, floor: string, materialType: MaterialType, name: string, method: LootMethod = 'drop'): MaterialLogEntry {
  return {
    id: nextId++, tierSnapshotId: 't1', weekNumber, floor, materialType,
    recipientPlayerId: `p-${name}`, recipientPlayerName: name, method,
    createdAt: '', createdByUserId: 'u', createdByUsername: 'u',
  };
}

describe('loggedSlotsForWeek', () => {
  it('locks a gear slot whose drop entry matches the week and the floor', () => {
    const entry = loot(11, 'M9S', 'earring', 'Healer Two');
    const out = loggedSlotsForWeek({ floors: FLOORS, week: 11, lootLog: [entry], materialLog: [] });
    expect(out[1].gear.earring).toBe(entry);
    expect(out[2].gear).toEqual({});
    expect(out[3].gear).toEqual({});
    expect(out[4].gear).toEqual({});
  });

  it('maps the ring aliases (ring, ring1, ring2) onto the wizard key ring1', () => {
    for (const alias of ['ring', 'ring1', 'ring2']) {
      const entry = loot(4, 'M9S', alias, 'Ranged One');
      const out = loggedSlotsForWeek({ floors: FLOORS, week: 4, lootLog: [entry], materialLog: [] });
      expect(out[1].gear.ring1, alias).toBe(entry);
      expect(out[1].gear[alias === 'ring1' ? 'ring2' : alias]).toBeUndefined();
    }
  });

  it('locks a material whose entry matches the week and the floor', () => {
    const entry = mat(3, 'M10S', 'glaze', 'Tank Two');
    const out = loggedSlotsForWeek({ floors: FLOORS, week: 3, lootLog: [], materialLog: [entry] });
    expect(out[2].materials.glaze).toBe(entry);
    expect(out[2].materials.universal_tomestone).toBeUndefined();
    expect(out[1].materials).toEqual({});
  });

  it('ignores other weeks and other floors', () => {
    const lootLog = [
      loot(10, 'M9S', 'earring', 'Healer Two'), // wrong week
      loot(11, 'M10S', 'necklace', 'Caster One'), // necklace is not an M10S drop, and the floor is not M9S
      loot(11, 'M13S', 'bracelet', 'Tank One'), // not a floor of this tier
    ];
    const materialLog = [
      mat(12, 'M10S', 'glaze', 'Tank Two'), // wrong week
      mat(11, 'M11S', 'glaze', 'Tank Two'), // wrong floor for the lookup below
    ];
    const out = loggedSlotsForWeek({ floors: FLOORS, week: 11, lootLog, materialLog });
    expect(out[1].gear).toEqual({});
    expect(out[1].otherMethods).toEqual({});
    expect(out[2].gear.necklace).toBeDefined(); // the helper keys on the entry's floor name, not the loot table
    expect(out[2].materials).toEqual({});
    expect(out[3].materials.glaze).toBeDefined();
    expect(out[4].gear).toEqual({});
  });

  it('only method === "drop" locks; tome, book and purchase entries go to otherMethods', () => {
    const tome = loot(3, 'M10S', 'hands', 'Melee One', 'tome');
    const purchase = loot(3, 'M10S', 'feet', 'Tank Two', 'purchase');
    const book = loot(3, 'M10S', 'head', 'Tank One', 'book');
    const drop = loot(3, 'M10S', 'head', 'Healer One', 'drop');
    const out = loggedSlotsForWeek({ floors: FLOORS, week: 3, lootLog: [tome, purchase, book, drop], materialLog: [] });
    expect(out[2].gear).toEqual({ head: drop });
    expect(out[2].otherMethods.hands).toEqual([tome]);
    expect(out[2].otherMethods.feet).toEqual([purchase]);
    expect(out[2].otherMethods.head).toEqual([book]);
  });

  it('materials follow the same rule: a non-drop material entry does not lock', () => {
    const bought = mat(3, 'M11S', 'twine', 'Caster One', 'purchase');
    const dropped = mat(3, 'M11S', 'solvent', 'Melee One', 'drop');
    const out = loggedSlotsForWeek({ floors: FLOORS, week: 3, lootLog: [], materialLog: [bought, dropped] });
    expect(out[3].materials).toEqual({ solvent: dropped });
    expect(out[3].materialOtherMethods.twine).toEqual([bought]);
  });

  it('returns empty records for a floor the tier does not name', () => {
    const out = loggedSlotsForWeek({ floors: ['M9S', 'M10S'], week: 1, lootLog: [loot(1, 'M11S', 'body', 'X')], materialLog: [] });
    expect(out[3]).toEqual({ gear: {}, materials: {}, otherMethods: {}, materialOtherMethods: {} });
  });
});
