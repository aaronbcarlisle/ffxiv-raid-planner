/**
 * needMatrixData — v2 Need-matrix derivation (Phase-D D3; R-48/R-9/R-11).
 *
 * Gear membership comes from the SAME pools the queue rows and picker use
 * (getPriorityForItem / getPriorityForRing), so a matrix dot can never
 * disagree with the queue or the picker (R-6's invariant) — a re-expression,
 * not a transcription, of the frozen WhoNeedsItMatrix (jscpd gate).
 *
 * Material counts re-express the eligibility math inside
 * getPriorityForUpgradeMaterial / getPriorityForUniversalTomestone (the
 * pools expose only {player, score}); consistency tests assert
 * count>0 ⟺ pool membership so the two can't drift.
 *
 * Deliberate deltas vs the LEGACY matrix (all pool-faithful — matching the
 * pool is the point; the legacy matrix disagreed with its own panel's pools):
 *   - solvent is ADDITIVE: the pool reads the weapon GEAR row
 *     (UPGRADE_MATERIAL_SLOTS.solvent = ['weapon'], priority.ts:441) AND adds
 *     the tomeWeapon increment (:452-455), so a player on both paths counts 2
 *     where legacy's if/else capped at 1;
 *   - requiresAugmentation gates twine/glaze/solvent counts (legacy applied
 *     no such gate — base-tome-BiS slots never need materials);
 *   - the material-log subtraction applies (legacy's matrix ignored the log).
 *
 * Rows band by floor F4→F1 (Weapon first, matching the Queues stack's
 * newest-first order) — user-ruled 2026-07-30 at D3 build.
 */

import {
  getPriorityForItem, getPriorityForRing,
} from '../../utils/priority';
import { requiresAugmentation } from '../../utils/calculations';
import {
  FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_SLOTS, UPGRADE_MATERIAL_DISPLAY_NAMES,
  getFloorForUpgradeMaterial, type FloorNumber, type UpgradeMaterialType,
} from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, MaterialLogEntry, GearSlot } from '../../types';

const POSITION_ORDER = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
const MATERIAL_ORDER: UpgradeMaterialType[] = ['twine', 'glaze', 'solvent', 'universal_tomestone'];

export function sortByPosition(players: SnapshotPlayer[]): SnapshotPlayer[] {
  return [...players].sort((a, b) => {
    const ai = a.position ? POSITION_ORDER.indexOf(a.position) : -1;
    const bi = b.position ? POSITION_ORDER.indexOf(b.position) : -1;
    return (ai === -1 ? POSITION_ORDER.length : ai) - (bi === -1 ? POSITION_ORDER.length : bi);
  });
}

export interface GearMatrixRow {
  kind: 'gear';
  slot: GearSlot | 'ring';
  label: string;
  floorNumber: FloorNumber;
  needers: Set<string>;
}

export function buildGearMatrixRows(players: SnapshotPlayer[], settings: StaticSettings): GearMatrixRow[] {
  const rows: GearMatrixRow[] = [];
  for (const floorNumber of [4, 3, 2, 1] as FloorNumber[]) {
    for (const tableSlot of FLOOR_LOOT_TABLES[floorNumber].gearDrops) {
      const item = tableSlot === 'ring1'
        ? { slot: 'ring' as const, label: 'Ring' }
        : { slot: tableSlot, label: GEAR_SLOT_NAMES[tableSlot] };
      const pool = item.slot === 'ring'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, item.slot, settings);
      rows.push({ kind: 'gear', ...item, floorNumber, needers: new Set(pool.map((e) => e.player.id)) });
    }
  }
  return rows;
}

/**
 * How many of this material the player still needs — the eligibility math of
 * getPriorityForUpgradeMaterial / getPriorityForUniversalTomestone, exposed
 * as a count (the pools only expose membership).
 */
export function materialNeedCount(
  player: SnapshotPlayer, material: UpgradeMaterialType, materialLog: MaterialLogEntry[],
): number {
  if (material === 'universal_tomestone') {
    const need = player.tomeWeapon?.pursuing && !player.tomeWeapon?.hasItem ? 1 : 0;
    const received = materialLog.filter(
      (e) => e.materialType === 'universal_tomestone' && e.recipientPlayerId === player.id,
    ).length;
    return Math.max(0, need - received);
  }
  let need = player.gear.filter(
    (g) => UPGRADE_MATERIAL_SLOTS[material].includes(g.slot)
      && g.bisSource === 'tome' && g.hasItem && !g.isAugmented && requiresAugmentation(g),
  ).length;
  if (material === 'solvent'
    && player.tomeWeapon?.pursuing && player.tomeWeapon?.hasItem && !player.tomeWeapon?.isAugmented) {
    need++;
  }
  // Entries WITH slotAugmented were already applied to gear (isAugmented=true
  // above), so only slot-less entries count against the remaining need.
  const received = materialLog.filter(
    (e) => e.materialType === material && e.recipientPlayerId === player.id && !e.slotAugmented,
  ).length;
  return Math.max(0, need - received);
}

export interface MaterialMatrixRow {
  kind: 'material';
  material: UpgradeMaterialType;
  label: string;
  floorNumbers: FloorNumber[];
  counts: Map<string, number>;
  totalNeeded: number;
}

export function buildMaterialMatrixRows(
  players: SnapshotPlayer[], materialLog: MaterialLogEntry[],
): MaterialMatrixRow[] {
  return MATERIAL_ORDER.map((material) => {
    const counts = new Map<string, number>();
    for (const p of players) {
      const n = materialNeedCount(p, material, materialLog);
      if (n > 0) counts.set(p.id, n);
    }
    return {
      kind: 'material' as const,
      material,
      label: UPGRADE_MATERIAL_DISPLAY_NAMES[material],
      floorNumbers: getFloorForUpgradeMaterial(material),
      counts,
      totalNeeded: [...counts.values()].reduce((a, b) => a + b, 0),
    };
  });
}
