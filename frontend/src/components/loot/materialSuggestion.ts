/**
 * materialSuggestion — the ONE material-priority derivation (Phase-D D5,
 * Task 2). Mirrors FloorCard.tsx's own material-row pipeline exactly
 * (:85-93 for the enhanced gate + averageDrops, :113-118 for the base pool +
 * enhance call) so it can replace FloorCard's inline copy (Step 6) AND back
 * the D5 weekly grid's per-cell suggested-recipient chip — one implementation,
 * not two that could drift (director F-13: returning only the top pick would
 * force the base+enhance pass to run twice per FloorCard material row, and
 * would recompute averageDrops outside FloorCard's own memo).
 *
 * No React here — pure, like logWeekGridData.ts.
 */
import type {
  SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, MaterialType,
} from '../../types';
import { isSlotAugmentationMaterial } from '../../gamedata/loot-tables';
import {
  getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone, isPriorityDisabled,
  type PriorityEntry,
} from '../../utils/priority';
import { enhancePriorityEntries } from '../../utils/priorityEntries';
import { calculateAverageDrops } from '../../utils/lootCoordination';

export interface MaterialPriorityEntriesArgs {
  material: MaterialType;
  players: SnapshotPlayer[];
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  currentWeek: number;
  /** Pass a precomputed value to keep the caller's memo (FloorCard.tsx:87-90); computed when omitted. */
  averageDrops?: number;
}

/**
 * Enhanced, ranked priority entries for one upgrade material. `[0]?.player`
 * is the suggested recipient (see `suggestedMaterialRecipient` below).
 */
export function materialPriorityEntries(args: MaterialPriorityEntriesArgs): PriorityEntry[] {
  const { material, players, settings, lootLog, materialLog, currentWeek } = args;

  // Legacy gate expression (LootPriorityPanel.tsx:404-408, carried verbatim
  // through FloorCard.tsx:85): enhanced scoring requires the setting
  // explicitly enabled, priority mode not disabled, and some loot history to
  // compute drought/balance against.
  const active = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0;

  const base = isSlotAugmentationMaterial(material)
    ? getPriorityForUpgradeMaterial(players, material, settings, materialLog)
    : getPriorityForUniversalTomestone(players, settings, materialLog);

  const averageDrops = args.averageDrops
    ?? (active ? calculateAverageDrops(players.map((p) => p.id), lootLog) : 0);

  return enhancePriorityEntries(base, { settings, lootLog, currentWeek, averageDrops, active });
}

/** Thin wrapper: the top-ranked entry's player, or undefined for an empty pool. */
export function suggestedMaterialRecipient(
  args: Parameters<typeof materialPriorityEntries>[0],
): SnapshotPlayer | undefined {
  return materialPriorityEntries(args)[0]?.player;
}
