/**
 * Floor/week fairness derivations (F6d, spec §5.2).
 * `deriveFloorWeekStatus` — pending/logged/cleared status for a single floor
 * in a single week, used by FloorCard's header chip + auto-collapse.
 * `computeTierFairness` (whole-tier fairness rollup) is PR2 — not implemented here.
 */
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES, isSlotAugmentationMaterial } from '../gamedata/loot-tables';
import {
  getPriorityForItem, getPriorityForRing,
  getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone,
} from './priority';

export interface FloorWeekStatus { loggedCount: number; pendingCount: number; cleared: boolean }

const RING_SLOTS = new Set(['ring', 'ring1', 'ring2']);

export function deriveFloorWeekStatus(args: {
  floorNumber: FloorNumber; floorName: string; week: number;
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
}): FloorWeekStatus {
  const { floorNumber, floorName, week, players, settings, lootLog, materialLog, pageLedger } = args;
  const table = FLOOR_LOOT_TABLES[floorNumber];
  const weekLoot = lootLog.filter((e) => e.weekNumber === week && e.floor === floorName);
  const weekMats = materialLog.filter((e) => e.weekNumber === week && e.floor === floorName);
  const loggedCount = weekLoot.length + weekMats.length;

  let pendingCount = 0;
  for (const slot of table.gearDrops) {
    const isRing = slot === 'ring1';
    const needers = isRing ? getPriorityForRing(players, settings) : getPriorityForItem(players, slot, settings);
    if (needers.length === 0) continue;
    const logged = weekLoot.some((e) => (isRing ? RING_SLOTS.has(e.itemSlot) : e.itemSlot === slot));
    if (!logged) pendingCount += 1;
  }
  for (const material of table.upgradeMaterials) {
    const needers = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(players, material, settings, materialLog)
      : getPriorityForUniversalTomestone(players, settings, materialLog);
    if (needers.length === 0) continue;
    const logged = weekMats.some((e) => e.materialType === material);
    if (!logged) pendingCount += 1;
  }

  const cleared = pageLedger.some(
    (e) => e.weekNumber === week && e.transactionType === 'earned' && e.bookType === table.bookType,
  );
  return { loggedCount, pendingCount, cleared };
}
