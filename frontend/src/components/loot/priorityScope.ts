/**
 * priorityScope — the R-10 default-scope derivation (Phase-D D1).
 *
 * R-10: until the user states a floor scope, Queues opens at "the newest
 * in-progress floor — one card, no scroll". The rule, made concrete:
 *
 *   A floor counts as REACHED once the tier's record shows any activity on it —
 *   a loot entry, a material entry, or an earned book (loot only drops on a
 *   clear, so any of the three proves the floor has been killed). The newest
 *   in-progress floor is one past the highest reached floor, capped at 4:
 *   a static that has cleared F1–F2 is prog'ing F3; a static with F4 activity
 *   is farming F4 (still the floor they act on); a fresh tier opens on F1.
 *
 * Evidence is ALL-TIME, not per-week, so the default never regresses to an
 * earlier floor at weekly reset. This is a v2-local module — legacy has no
 * equivalent derivation to share.
 */
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../../gamedata/loot-tables';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

export type FloorScope = 'all' | FloorNumber;

export function newestInProgressFloor(args: {
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  pageLedger: PageLedgerEntry[];
  /** Floor display names in floor order (tier gamedata) — log entries store the name, not the number. */
  floors: string[];
}): FloorNumber {
  const { lootLog, materialLog, pageLedger, floors } = args;

  let highestReached = 0;
  for (let n = 1; n <= 4; n++) {
    const floorName = floors[n - 1];
    const bookType = FLOOR_LOOT_TABLES[n as FloorNumber].bookType;
    const reached =
      (floorName !== undefined &&
        (lootLog.some((e) => e.floor === floorName) ||
          materialLog.some((e) => e.floor === floorName))) ||
      pageLedger.some((e) => e.transactionType === 'earned' && e.bookType === bookType);
    if (reached) highestReached = n;
  }

  return Math.min(highestReached + 1, 4) as FloorNumber;
}
