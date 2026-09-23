import { describe, it, expect } from 'vitest';
import {
  buildTeamSummaryRows,
  filterMainsOnly,
  teamSummaryTotals,
  roleLabelsByPlayer,
} from './teamSummaryRows';
import type { SnapshotPlayer, GearSlotStatus, PageBalance, MaterialBalance, StaticCharacterRegistration } from '../../types';

function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
    name: 'Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createRegistration(overrides: Partial<StaticCharacterRegistration> = {}): StaticCharacterRegistration {
  return {
    id: 'reg-1',
    staticGroupId: 'static-1',
    snapshotPlayerId: 'player-1',
    playerCharacterId: null,
    manualCharacterName: null,
    manualWorld: null,
    manualDataCenter: null,
    roleInStatic: 'main',
    job: null,
    isPrimaryForStatic: true,
    source: 'manual',
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedName: null,
    resolvedWorld: null,
    resolvedDataCenter: null,
    linkedCharacter: null,
    ...overrides,
  };
}

// Gear array that gives each book key and each material key a distinct,
// non-zero value: floor1=3 (necklace), floor2=4 (head), floor3=6 (body),
// floor4=8 (weapon); twine=3 (legs+feet+hands), glaze=2 (earring+bracelet),
// solvent=1 (tome weapon pursuit — independent of the weapon slot itself).
const DISTINCT_GEAR: GearSlotStatus[] = [
  createGearSlot({ slot: 'necklace', bisSource: 'raid', hasItem: false }),
  createGearSlot({ slot: 'head', bisSource: 'raid', hasItem: false }),
  createGearSlot({ slot: 'body', bisSource: 'raid', hasItem: false }),
  createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: false }),
  createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: false }),
  createGearSlot({ slot: 'feet', bisSource: 'tome', hasItem: false }),
  createGearSlot({ slot: 'hands', bisSource: 'tome', hasItem: false }),
  createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: false }),
  createGearSlot({ slot: 'bracelet', bisSource: 'tome', hasItem: false }),
];

describe('buildTeamSummaryRows', () => {
  it('keeps only configured, non-substitute players, ordered by standard role display order', () => {
    const tank = createPlayer({ id: 'tank', role: 'tank', name: 'Tank' });
    const healer = createPlayer({ id: 'healer', role: 'healer', name: 'Healer' });
    const caster = createPlayer({ id: 'caster', role: 'caster', name: 'Caster' });
    const unconfigured = createPlayer({ id: 'unconfigured', role: 'tank', configured: false });
    const substitute = createPlayer({ id: 'sub', role: 'tank', isSubstitute: true });

    // Pass in reverse role order to prove sorting, not input order, decides it.
    const rows = buildTeamSummaryRows([caster, healer, unconfigured, substitute, tank], [], []);

    expect(rows.map((r) => r.player.id)).toEqual(['tank', 'healer', 'caster']);
  });

  it('gives zeros, never undefined, when a player has no balance entry', () => {
    const player = createPlayer({ gear: DISTINCT_GEAR });
    const [row] = buildTeamSummaryRows([player], [], []);

    expect(row.booksBalance).toEqual({ I: 0, II: 0, III: 0, IV: 0 });
    expect(row.matsReceived).toEqual({ twine: 0, glaze: 0, solvent: 0 });
  });

  it('reads real balance entries for the matching player', () => {
    const player = createPlayer({ id: 'p1', gear: DISTINCT_GEAR });
    const pageBalance: PageBalance = { playerId: 'p1', playerName: 'p1', bookI: 1, bookII: 2, bookIII: 3, bookIV: 4 };
    const materialBalance: MaterialBalance = { playerId: 'p1', playerName: 'p1', twine: 5, glaze: 6, solvent: 7, universalTomestone: 0 };

    const [row] = buildTeamSummaryRows([player], [pageBalance], [materialBalance]);

    expect(row.booksBalance).toEqual({ I: 1, II: 2, III: 3, IV: 4 });
    expect(row.matsReceived).toEqual({ twine: 5, glaze: 6, solvent: 7 });
  });

  it('maps floor1..floor4 to I..IV and twine/glaze/solvent from the calc utils, each with a distinct non-zero value', () => {
    const player = createPlayer({
      gear: DISTINCT_GEAR,
      tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
    });
    const [row] = buildTeamSummaryRows([player], [], []);

    expect(row.booksNeeded).toEqual({ I: 3, II: 4, III: 6, IV: 8 });
    expect(row.matsNeeded).toEqual({ twine: 3, glaze: 2, solvent: 1 });

    // Every book key and every material key is distinct — a swapped key fails this.
    expect(new Set(Object.values(row.booksNeeded)).size).toBe(4);
    expect(new Set(Object.values(row.matsNeeded)).size).toBe(3);
  });

  it('computes gearPercent from calculatePlayerCompletion', () => {
    const complete = createPlayer({
      job: 'DRG',
      gear: [createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: true })],
    });
    const [row] = buildTeamSummaryRows([complete], [], []);
    expect(row.gearPercent).toBe(100);
  });
});

describe('filterMainsOnly', () => {
  it('keeps a row iff playerHasMainRole is true for that player', () => {
    const main = createPlayer({ id: 'main-player' });
    const alt = createPlayer({ id: 'alt-player' });
    const rows = buildTeamSummaryRows([main, alt], [], []);

    const registrationsByPlayer: Record<string, StaticCharacterRegistration[]> = {
      'main-player': [createRegistration({ snapshotPlayerId: 'main-player', roleInStatic: 'main' })],
      'alt-player': [createRegistration({ snapshotPlayerId: 'alt-player', roleInStatic: 'alt' })],
    };

    const filtered = filterMainsOnly(rows, registrationsByPlayer);
    expect(filtered.map((r) => r.player.id)).toEqual(['main-player']);
  });
});

describe('teamSummaryTotals', () => {
  it('is all zeros for an empty row set, never NaN', () => {
    const totals = teamSummaryTotals([]);
    expect(totals).toEqual({
      playerCount: 0,
      gearPercent: 0,
      booksBalance: { I: 0, II: 0, III: 0, IV: 0 },
      booksNeeded: { I: 0, II: 0, III: 0, IV: 0 },
      matsReceived: { twine: 0, glaze: 0, solvent: 0 },
      matsNeeded: { twine: 0, glaze: 0, solvent: 0 },
      booksHave: 0,
      booksNeed: 0,
      matsHave: 0,
      matsNeed: 0,
    });
  });

  it('rounds the mean gearPercent, counts players, and sums grand totals from per-key sums', () => {
    const p1 = createPlayer({
      id: 'p1',
      gear: [createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: true })], // 100%
    });
    const p2 = createPlayer({
      id: 'p2',
      gear: [createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: false })], // 0%
    });
    const rows = buildTeamSummaryRows([p1, p2], [
      { playerId: 'p1', playerName: 'p1', bookI: 1, bookII: 2, bookIII: 0, bookIV: 0 },
      { playerId: 'p2', playerName: 'p2', bookI: 3, bookII: 0, bookIII: 0, bookIV: 0 },
    ], [
      { playerId: 'p1', playerName: 'p1', twine: 1, glaze: 0, solvent: 0, universalTomestone: 0 },
      { playerId: 'p2', playerName: 'p2', twine: 2, glaze: 0, solvent: 0, universalTomestone: 0 },
    ]);

    const totals = teamSummaryTotals(rows);

    // p1 = 100%, p2 = 0% -> mean 50, rounded stays 50 (not a coincidental default).
    expect(totals.gearPercent).toBe(50);
    expect(totals.playerCount).toBe(2);
    expect(totals.booksBalance.I).toBe(4); // 1 + 3
    expect(totals.booksHave).toBe(
      totals.booksBalance.I + totals.booksBalance.II + totals.booksBalance.III + totals.booksBalance.IV,
    );
    expect(totals.matsHave).toBe(totals.matsReceived.twine + totals.matsReceived.glaze + totals.matsReceived.solvent);
    expect(totals.matsHave).toBe(3); // 1 + 2
  });
});

describe('roleLabelsByPlayer', () => {
  it('labels a player by its primary registration', () => {
    const registrationsByPlayer: Record<string, StaticCharacterRegistration[]> = {
      p1: [
        createRegistration({ snapshotPlayerId: 'p1', roleInStatic: 'alt', isPrimaryForStatic: false }),
        createRegistration({ snapshotPlayerId: 'p1', roleInStatic: 'main', isPrimaryForStatic: true }),
      ],
    };
    expect(roleLabelsByPlayer(registrationsByPlayer)).toEqual({ p1: 'main' });
  });

  it('falls back to the first registration when none is marked primary', () => {
    const registrationsByPlayer: Record<string, StaticCharacterRegistration[]> = {
      p1: [
        createRegistration({ snapshotPlayerId: 'p1', roleInStatic: 'substitute', isPrimaryForStatic: false }),
        createRegistration({ snapshotPlayerId: 'p1', roleInStatic: 'main', isPrimaryForStatic: false }),
      ],
    };
    expect(roleLabelsByPlayer(registrationsByPlayer)).toEqual({ p1: 'substitute' });
  });

  it('produces no key for an unrecognized role or an empty registration list', () => {
    // 'manual' is a valid RoleInStatic value but not main/alt/substitute.
    const registrationsByPlayer: Record<string, StaticCharacterRegistration[]> = {
      unknown: [createRegistration({ snapshotPlayerId: 'unknown', roleInStatic: 'manual' })],
      empty: [],
    };
    expect(roleLabelsByPlayer(registrationsByPlayer)).toEqual({});
  });
});
