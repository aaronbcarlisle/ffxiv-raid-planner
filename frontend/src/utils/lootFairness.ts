/**
 * Floor/week fairness derivations (F6d, spec §5.2, §5.5).
 * `deriveFloorWeekStatus` — pending/logged/cleared status for a single floor
 * in a single week, used by FloorCard's header chip + auto-collapse.
 * `computeTierFairness` — whole-tier fairness rollup behind FairnessSummary.
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

export interface TierFairnessStat { names: string[]; count: number }
export interface TierFairness {
  dropsThisTier: number; weeksSpanned: number;
  most: TierFairnessStat | null; fewest: TierFairnessStat | null;
  spread: number; even: boolean;
  thisWeekCount: number; thisWeekPending: number;
}

/**
 * Whole-tier fairness rollup for FairnessSummary (spec §5.5). Substitutes are
 * excluded (LootCountBar parity plus configured-only); per-player counts use every loot entry (any
 * method) while `dropsThisTier` counts method='drop' only. Materials count in
 * the week total (floor loggedCount parity) but not per-player fairness.
 */
export function computeTierFairness(args: {
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  currentWeek: number; floors: string[];
}): TierFairness {
  const { players, settings, lootLog, materialLog, pageLedger, currentWeek, floors } = args;
  const mains = players.filter((p) => p.configured && !p.isSubstitute);
  const mainIds = new Set(mains.map((p) => p.id));

  const counts = new Map<string, number>(mains.map((p) => [p.id, 0]));
  for (const e of lootLog) {
    if (mainIds.has(e.recipientPlayerId)) counts.set(e.recipientPlayerId, (counts.get(e.recipientPlayerId) ?? 0) + 1);
  }

  let most: TierFairnessStat | null = null;
  let fewest: TierFairnessStat | null = null;
  if (mains.length > 0) {
    const max = Math.max(...counts.values());
    const min = Math.min(...counts.values());
    const namesAt = (n: number) => mains.filter((p) => counts.get(p.id) === n).map((p) => p.name);
    most = { names: namesAt(max), count: max };
    fewest = { names: namesAt(min), count: min };
  }
  const spread = most && fewest ? most.count - fewest.count : 0;

  const dropsThisTier = lootLog.filter((e) => e.method === 'drop' && mainIds.has(e.recipientPlayerId)).length;
  const thisWeekCount =
    lootLog.filter((e) => e.weekNumber === currentWeek && mainIds.has(e.recipientPlayerId)).length +
    materialLog.filter((e) => e.weekNumber === currentWeek && mainIds.has(e.recipientPlayerId)).length;

  let thisWeekPending = 0;
  for (const floorNumber of [1, 2, 3, 4] as FloorNumber[]) {
    thisWeekPending += deriveFloorWeekStatus({
      floorNumber, floorName: floors[floorNumber - 1] ?? `Floor ${floorNumber}`,
      week: currentWeek, players: mains, settings, lootLog, materialLog, pageLedger,
    }).pendingCount;
  }

  return { dropsThisTier, weeksSpanned: currentWeek, most, fewest, spread, even: spread <= 2, thisWeekCount, thisWeekPending };
}
