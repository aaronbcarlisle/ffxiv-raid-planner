/**
 * useWeeklyLootSummary Hook
 *
 * Static-wide per-fight loot aggregation for the redesigned Home (F6b).
 * Sibling of the per-player `useWeekSummary`: instead of summarizing each
 * player, it summarizes each fight (floor) across the whole static for a
 * given week.
 *
 * Per fight, for the target week:
 *   - `cleared`   — an `'earned'` page-ledger entry exists for that floor
 *                   (the same signal `useWeekSummary` uses for floorsCleared).
 *   - `dropCount` — number of loot-log entries logged on that floor.
 *
 * `computeWeeklyLootSummary` is exported as a pure function so it can be
 * unit-tested directly against fixtures.
 */

import { useMemo } from 'react';
import type { LootLogEntry, PageLedgerEntry } from '../types';
import { getTierById } from '../gamedata/raid-tiers';

export interface FightLootSummary {
  fight: string;
  cleared: boolean;
  dropCount: number;
}

export function computeWeeklyLootSummary(
  floors: string[],
  lootLog: LootLogEntry[],
  pageLedger: PageLedgerEntry[],
  week: number,
): FightLootSummary[] {
  const weekLoot = lootLog.filter((e) => e.weekNumber === week);
  const clearedFloors = new Set(
    pageLedger
      .filter((e) => e.weekNumber === week && e.transactionType === 'earned')
      .map((e) => e.floor),
  );
  return floors.map((fight) => ({
    fight,
    cleared: clearedFloors.has(fight),
    dropCount: weekLoot.filter((e) => e.floor === fight).length,
  }));
}

export function useWeeklyLootSummary({
  tierId,
  lootLog,
  pageLedger,
  week,
}: {
  tierId?: string;
  lootLog: LootLogEntry[];
  pageLedger: PageLedgerEntry[];
  week: number;
}): FightLootSummary[] {
  return useMemo(() => {
    const floors = tierId ? getTierById(tierId)?.floors ?? [] : [];
    return computeWeeklyLootSummary(floors, lootLog, pageLedger, week);
  }, [tierId, lootLog, pageLedger, week]);
}
